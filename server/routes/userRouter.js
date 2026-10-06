const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const Seller = require('../models/sellerModel');
const Category = require('../models/CategoryModel');
const Order = require('../models/orderModel');
const { sendOtp, verifyOtp } = require('../utils/otp');
const userLoggedin = require('../middleware/userLoggedin');
const { uploadSingle } = require('../config/multerConfig');
const { uploadToCloudinary } = require('../config/cloudinaryConfig');
const { otpSendLimiter, otpVerifyLimiter, loginLimiter } = require('../middleware/rateLimit');

// Environment Variables
const { JWT_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, razorpayConfigured } = require('../config/secrets');

// Initialize Razorpay only when credentials exist; otherwise payment routes
// respond 503 instead of crashing the whole process at module load.
const razorpay = razorpayConfigured ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET }) : null;

// Middleware for consistent response structure
const sendResponse = (res, status, data) => {
  res.status(status).json(data);
};

// Authentication Routes
router.post('/send-otp', otpSendLimiter, async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return sendResponse(res, 400, { success: false, message: 'Phone number is required' });
  }

  try {
    await sendOtp(phoneNumber);
    sendResponse(res, 200, { success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to send OTP', error: error.message });
  }
});

router.post('/verify-otp', otpVerifyLimiter, async (req, res) => {
  const { phoneNumber, otp } = req.body;
  if (!phoneNumber || !otp) {
    return sendResponse(res, 400, { success: false, message: 'Phone number and OTP are required' });
  }

  try {
    const isValid = await verifyOtp(phoneNumber, otp);
    if (!isValid) {
      return sendResponse(res, 400, { success: false, message: 'Invalid OTP' });
    }

    let user = await User.findOne({ phoneNumber });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = new User({ phoneNumber, role: 'user' });
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, phoneNumber: user.phoneNumber, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    sendResponse(res, 200, {
      success: true,
      message: isNewUser ? 'Registered and logged in successfully' : 'Logged in successfully',
      user: { id: user._id, phoneNumber: user.phoneNumber, role: user.role },
      token,
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    sendResponse(res, 500, { success: false, message: 'Server error', error: error.message });
  }
});

router.get('/verify-token', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('phoneNumber role');
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }

    sendResponse(res, 200, {
      success: true,
      message: 'Token is valid',
      user: { id: user._id, phoneNumber: user.phoneNumber, role: user.role },
    });
  } catch (error) {
    console.error('Token Verification Error:', error);
    sendResponse(res, 401, { success: false, message: 'Invalid or expired token', error: error.message });
  }
});

router.post('/logout', userLoggedin, async (req, res) => {
  try {
    sendResponse(res, 200, { success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to logout', error: error.message });
  }
});


// GET User Profile
router.get('/profile', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }
    sendResponse(res, 200, { success: true, user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    sendResponse(res, 500, { success: false, message: 'Server error', error: error.message });
  }
});

// PUT Update User Profile
router.put('/profile', userLoggedin, uploadSingle('profilePicture'), async (req, res) => {
  try {
    const { firstName, lastName, email, addresses, preferences } = req.body;
    let parsedAddresses = [];
    let parsedPreferences = { notifications: true, preferredCategories: [] };

    // Validate and parse addresses
    if (addresses) {
      try {
        parsedAddresses = JSON.parse(addresses);
        if (!Array.isArray(parsedAddresses)) {
          return sendResponse(res, 400, { success: false, message: 'Addresses must be an array' });
        }
        for (const addr of parsedAddresses) {
          if (!addr.street || !addr.city || !addr.state || !addr.postalCode || !addr.country) {
            return sendResponse(res, 400, { success: false, message: 'All address fields are required' });
          }
          addr.isDefault = !!addr.isDefault; // Ensure boolean
        }
      } catch (error) {
        return sendResponse(res, 400, { success: false, message: 'Invalid addresses format' });
      }
    }

    // Validate and parse preferences
    if (preferences) {
      try {
        parsedPreferences = JSON.parse(preferences);
        if (typeof parsedPreferences.notifications !== 'boolean') {
          return sendResponse(res, 400, { success: false, message: 'Notifications must be a boolean' });
        }
        if (!Array.isArray(parsedPreferences.preferredCategories)) {
          return sendResponse(res, 400, { success: false, message: 'Preferred categories must be an array' });
        }
      } catch (error) {
        return sendResponse(res, 400, { success: false, message: 'Invalid preferences format' });
      }
    }

    // Validate email
    if (email && !/.+\@.+\..+/.test(email)) {
      return sendResponse(res, 400, { success: false, message: 'Please enter a valid email address' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }

    // Check if email is already in use by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return sendResponse(res, 400, { success: false, message: 'Email already in use' });
      }
    }

    // Update user fields
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.email = email || user.email;
    user.addresses = parsedAddresses.length ? parsedAddresses : user.addresses;
    user.preferences = parsedPreferences;

    // Handle profile picture upload to Cloudinary
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: 'profile_pictures',
          public_id: `user_${req.user.id}_${Date.now()}`,
        });
        user.profilePicture = result.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary Upload Error:', uploadError);
        return sendResponse(res, 400, { success: false, message: 'Failed to upload image to Cloudinary', error: uploadError.message });
      }
    }

    await user.save();

    const updatedUser = await User.findById(req.user.id).select('-password');
    sendResponse(res, 200, { success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating profile:', error);
    if (error.message.includes('Only JPEG, JPG, and PNG')) {
      return sendResponse(res, 400, { success: false, message: error.message });
    }
    sendResponse(res, 500, { success: false, message: 'Server error', error: error.message });
  }
});


// Address Routes
router.post('/add-address', userLoggedin, async (req, res) => {
  try {
    const { street, city, state, postalCode, country } = req.body;
    if (!street || !city || !state || !postalCode || !country) {
      return sendResponse(res, 400, { success: false, message: 'All address fields are required' });
    }

    const user = await User.findById(req.user.id);
    const newAddress = { street, city, state, postalCode, country };
    user.addresses.push(newAddress);
    await user.save();

    const addedAddress = user.addresses[user.addresses.length - 1];
    sendResponse(res, 200, { success: true, address: addedAddress });
  } catch (error) {
    console.error('Error adding address:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to add address', error: error.message });
  }
});

router.delete('/remove-address/:addressId', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return sendResponse(res, 404, { success: false, message: 'Address not found' });
    }
    address.remove();
    await user.save();
    sendResponse(res, 200, { success: true, message: 'Address removed successfully' });
  } catch (error) {
    console.error('Error removing address:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to remove address', error: error.message });
  }
});

// Product Routes
router.get('/products', async (req, res) => {
  try {
    const { category, sellerId } = req.query;
    let query = {};

    if (category && category.toLowerCase() !== 'all') {
      const safeCategory = String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const categoryDoc = await Category.findOne({ name: { $regex: new RegExp(`^${safeCategory}$`, 'i') } });
      if (!categoryDoc) {
        return sendResponse(res, 404, { success: false, message: `Category '${category}' not found` });
      }
      query.category = categoryDoc._id;
    }

    if (sellerId) {
      if (!mongoose.Types.ObjectId.isValid(sellerId)) {
        return sendResponse(res, 400, { success: false, message: 'Invalid seller ID' });
      }
      query.sellerId = sellerId;
    }

    const products = await Product.find(query)
      .populate('sellerId', 'name phoneNumber')
      .populate('category', 'name');

    if (!products.length) {
      return sendResponse(res, 200, { success: true, message: 'No products found', products: [] });
    }

    sendResponse(res, 200, { success: true, products });
  } catch (error) {
    console.error('Fetch Products Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to fetch products', error: error.message });
  }
});

router.get('/products/:productId', userLoggedin, async (req, res) => {
  try {
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findById(productId).populate('sellerId', 'name shopName');
    if (!product) {
      return sendResponse(res, 404, { success: false, message: 'Product not found' });
    }

    sendResponse(res, 200, { success: true, product });
  } catch (error) {
    console.error('Fetch Product Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to fetch product', error: error.message });
  }
});

// Seller Routes
router.get('/sellers', async (req, res) => {
  try {
    const sellers = await Seller.find({ role: 'seller', status: 'enabled' })
      .select('name shopName profilePicture phoneNumber address');
    sendResponse(res, 200, { success: true, sellers });
  } catch (error) {
    console.error('Fetch Sellers Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to fetch sellers', error: error.message });
  }
});

router.get('/seller/:sellerId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.sellerId)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid seller ID' });
    }
    // Public storefront fields only -- paymentIds, bank account, IFSC and UPI must
    // never leave the server on an unauthenticated route.
    const seller = await Seller.findById(req.params.sellerId)
      .select('name shopName profilePicture phoneNumber address status')
      .lean();
    if (!seller || seller.role !== 'seller' || seller.status !== 'enabled') {
      return sendResponse(res, 404, { success: false, message: 'Seller not found' });
    }
    sendResponse(res, 200, { success: true, seller });
  } catch (error) {
    console.error('Fetch Seller Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to fetch seller', error: error.message });
  }
});

// Category Routes
router.get('/categories', async (req, res) => {
  try {
    const categories = ['Seeds', 'Crops', 'Tools', 'Fertilizers', 'Equipment'];
    sendResponse(res, 200, { success: true, categories });
  } catch (error) {
    console.error('Fetch Categories Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to fetch categories', error: error.message });
  }
});

// Wishlist Routes
router.get('/wishlist', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist.productId');
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }
    sendResponse(res, 200, { success: true, wishlist: user.wishlist });
  } catch (error) {
    console.error('Fetch Wishlist Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to fetch wishlist', error: error.message });
  }
});

router.put('/wishlist/:productId', userLoggedin, async (req, res) => {
  try {
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid product ID' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return sendResponse(res, 404, { success: false, message: 'Product not found' });
    }
    const wishlistIndex = user.wishlist.findIndex((item) => item.productId.toString() === productId);
    let message, inWishlist;
    if (wishlistIndex !== -1) {
      user.wishlist.splice(wishlistIndex, 1);
      message = 'Removed from Wishlist';
      inWishlist = false;
    } else {
      user.wishlist.push({ productId });
      message = 'Added to Wishlist';
      inWishlist = true;
    }
    await user.save();
    await user.populate('wishlist.productId');
    sendResponse(res, 200, { success: true, message, inWishlist, wishlist: user.wishlist });
  } catch (error) {
    console.error('Wishlist Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to update wishlist', error: error.message });
  }
});

router.get('/wishlist/:productId', userLoggedin, async (req, res) => {
  try {
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }

    const isInWishlist = user.wishlist.some((item) => item.productId.toString() === productId);
    sendResponse(res, 200, { success: true, inWishlist });
  } catch (error) {
    console.error('Fetch Wishlist Status Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to fetch wishlist status', error: error.message });
  }
});
router.get('/cart', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'cart.productId',
      select: 'name discountedPrice discount quantity images sizes', // Explicitly include images
    });
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }
    // Map cart items to ensure consistent structure
    const cartItems = user.cart.map((item) => ({
      productId: item.productId?._id?.toString() || item.productId,
      name: item.productId?.name || item.name || 'Unnamed Product',
      price: item.productId?.discountedPrice || item.priceAtAdd || 0,
      quantity: item.quantity || 1,
      size: item.size || 'N/A',
      images: Array.isArray(item.productId?.images) ? item.productId.images : [],
      sizes: Array.isArray(item.productId?.sizes) ? item.productId.sizes : ['S', 'M', 'L'],
      discount: item.productId?.discount || 0,
      stock: item.productId?.quantity || 0,
    }));
    sendResponse(res, 200, { success: true, cart: { items: cartItems } });
  } catch (error) {
    console.error('Fetch Cart Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to fetch cart', error: error.message });
  }
});

// POST /api/user/auth/wishlist/move-to-cart - Move product from wishlist to cart
router.post('/wishlist/move-to-cart', userLoggedin, async (req, res) => {
  try {
    const { productId, quantity, size, color } = req.body;

    // Validate inputs
    if (!productId || !quantity || !size || !color) {
      return sendResponse(res, 400, { success: false, message: 'Missing required fields: productId, quantity, size, color' });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return sendResponse(res, 400, { success: false, message: 'Invalid quantity' });
    }

    // Validate product
    const product = await Product.findById(productId);
    if (!product) {
      return sendResponse(res, 404, { success: false, message: 'Product not found' });
    }
    if (product.quantity < quantity) {
      return sendResponse(res, 400, { success: false, message: `Insufficient stock. Available: ${product.quantity}` });
    }
    if (!product.sizes.includes(size)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid size' });
    }
    if (!product.colors.includes(color)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid color' });
    }

    // Update user cart and wishlist
    const user = await User.findById(req.user.id);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }

    // Check if product is in wishlist
    const wishlistIndex = user.wishlist.findIndex(
      (item) => item.productId.toString() === productId
    );
    if (wishlistIndex === -1) {
      return sendResponse(res, 404, { success: false, message: 'Product not found in wishlist' });
    }

    // Add to cart
    const cartItem = {
      productId,
      quantity: Math.max(1, Math.min(quantity, product.quantity)),
      size,
      color,
    };
    const existingItem = user.cart.find(
      (item) => item.productId.toString() === productId && item.size === size && item.color === color
    );
    if (existingItem) {
      existingItem.quantity = Math.min(existingItem.quantity + quantity, product.quantity);
    } else {
      user.cart.push(cartItem);
    }

    // Remove from wishlist
    user.wishlist.splice(wishlistIndex, 1);

    // Save changes
    await user.save();
    console.log(`Moved to cart: user=${req.user.id}, productId=${productId}, size=${size}, color=${color}, quantity=${quantity}`);
    sendResponse(res, 200, { success: true, message: 'Item moved to cart' });
  } catch (error) {
    console.error('Move to Cart Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to move to cart', error: error.message });
  }
});

// Existing routes (for reference, ensure they coexist)
router.post('/cart/add', userLoggedin, async (req, res) => {
  try {
    const { productId, quantity, size, color } = req.body;
    if (!productId || !quantity || !size || !color) {
      return sendResponse(res, 400, { success: false, message: 'Missing required fields: productId, quantity, size, color' });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return sendResponse(res, 400, { success: false, message: 'Invalid quantity' });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return sendResponse(res, 404, { success: false, message: 'Product not found' });
    }
    if (product.quantity < quantity) {
      return sendResponse(res, 400, { success: false, message: `Insufficient stock. Available: ${product.quantity}` });
    }
    if (!product.sizes.includes(size)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid size' });
    }
    if (!product.colors.includes(color)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid color' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }
    const cartItem = {
      productId,
      quantity: Math.max(1, Math.min(quantity, product.quantity)),
      size,
      color,
    };
    const existingItem = user.cart.find(
      (item) => item.productId.toString() === productId && item.size === size && item.color === color
    );
    if (existingItem) {
      existingItem.quantity = Math.min(existingItem.quantity + quantity, product.quantity);
    } else {
      user.cart.push(cartItem);
    }
    await user.save();
    console.log(`Added to cart: user=${req.user.id}, productId=${productId}, size=${size}, color=${color}, quantity=${quantity}`);
    sendResponse(res, 200, { success: true, message: 'Item added to cart' });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to add to cart', error: error.message });
  }
});

router.delete('/wishlist/:productId', userLoggedin, async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return sendResponse(res, 400, { success: false, message: 'Missing productId' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }
    const wishlistIndex = user.wishlist.findIndex(
      (item) => item.productId.toString() === productId
    );
    if (wishlistIndex === -1) {
      return sendResponse(res, 404, { success: false, message: 'Product not found in wishlist' });
    }
    user.wishlist.splice(wishlistIndex, 1);
    await user.save();
    console.log(`Removed from wishlist: user=${req.user.id}, productId=${productId}`);
    sendResponse(res, 200, { success: true, message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Remove from Wishlist Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to remove from wishlist', error: error.message });
  }
});

router.post('/cart', userLoggedin, async (req, res) => {
  try {
    const { productId, quantity, price, name } = req.body;
    if (!productId || !quantity || !price || !name) {
      return sendResponse(res, 400, { success: false, message: 'productId, quantity, price, and name are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return sendResponse(res, 404, { success: false, message: 'Product not found' });
    }

    const cartIndex = user.cart.findIndex((item) => item.productId.toString() === productId);
    if (cartIndex !== -1) {
      user.cart[cartIndex].quantity = quantity;
      user.cart[cartIndex].priceAtAdd = price;
      user.cart[cartIndex].name = name;
    } else {
      user.cart.push({ productId, quantity, priceAtAdd: price, name });
    }

    await user.save();
    await user.populate('cart.productId');
    sendResponse(res, 200, { success: true, message: 'Cart updated', cart: user.cart });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to update cart', error: error.message });
  }
});

router.put('/cart/:productId', userLoggedin, async (req, res) => {
  try {
    const productId = req.params.productId;
    const { quantity, price, name } = req.body;

    if (!quantity || quantity < 0) {
      return sendResponse(res, 400, { success: false, message: 'Valid quantity is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return sendResponse(res, 404, { success: false, message: 'Product not found' });
    }

    const cartIndex = user.cart.findIndex((item) => item.productId.toString() === productId);
    if (cartIndex === -1) {
      return sendResponse(res, 404, { success: false, message: 'Product not found in cart' });
    }

    user.cart[cartIndex].quantity = quantity;
    user.cart[cartIndex].priceAtAdd = price;
    user.cart[cartIndex].name = name;

    await user.save();
    await user.populate('cart.productId');
    sendResponse(res, 200, { success: true, message: 'Cart updated', cart: user.cart });
  } catch (error) {
    console.error('Update Cart Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to update cart', error: error.message });
  }
});

router.delete('/cart/:productId', userLoggedin, async (req, res) => {
  try {
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }

    const cartIndex = user.cart.findIndex((item) => item.productId.toString() === productId);
    if (cartIndex === -1) {
      return sendResponse(res, 404, { success: false, message: 'Product not found in cart' });
    }

    user.cart.splice(cartIndex, 1);
    await user.save();
    await user.populate('cart.productId');
    sendResponse(res, 200, { success: true, message: 'Item removed from cart', cart: user.cart });
  } catch (error) {
    console.error('Remove from Cart Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to remove item from cart', error: error.message });
  }
});

router.get('/order/:orderId', userLoggedin, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).populate('sellerId', 'name email'); // Optional: populate seller details
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.userId && order.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    res.status(200).json({ order });
  } catch (error) {
    console.error('Fetch Order Error:', error);
    res.status(500).json({ message: 'Failed to fetch order', error: error.message });
  }
});

// Fetch all orders for the user (assuming customer-specific filtering)
router.get('/orders', userLoggedin, async (req, res) => {
  try {
    // Fetch only the logged-in user's orders
    const orders = await Order.find({ userId: req.user.id });
    res.status(200).json({ orders });
  } catch (error) {
    console.error('Fetch Orders Error:', error);
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

router.post('/create-order', userLoggedin, async (req, res) => {
  try {
    const { items, totalAmount, addressId, paymentMethod } = req.body;

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0 || !totalAmount || !addressId || !paymentMethod) {
      return res.status(400).json({ message: 'Items, totalAmount, addressId, and paymentMethod are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const address = user.addresses.id(addressId);
    if (!address) return res.status(400).json({ message: 'Invalid address ID' });

    // Group items by seller
    const itemsBySeller = {};
    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({ message: `Invalid product ID: ${item.productId}` });
      }
      const product = await Product.findById(item.productId).populate('sellerId');
      if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
      if (product.quantity < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }

      const sellerId = product.sellerId._id.toString();
      if (!itemsBySeller[sellerId]) {
        itemsBySeller[sellerId] = { items: [], seller: product.sellerId };
      }
      itemsBySeller[sellerId].items.push({
        name: product.name,
        price: item.price || product.price,
        quantity: item.quantity,
      });
    }

    const orders = [];
    let razorpayOrder = null;

    // Handle payment and order creation
    if (paymentMethod === 'Razorpay') {
      if (!razorpay) {
        return res.status(503).json({ message: 'Payments are temporarily unavailable' });
      }
      const razorpayOptions = {
        amount: totalAmount * 100, // Convert to paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
      };
      razorpayOrder = await razorpay.orders.create(razorpayOptions);
    }

    // Create orders per seller
    for (const sellerId of Object.keys(itemsBySeller)) {
      const { items: sellerItems, seller } = itemsBySeller[sellerId];
      const sellerTotal = sellerItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const order = new Order({
        orderId: razorpayOrder ? razorpayOrder.id : `ORD_${Date.now()}_${sellerId}`,
        sellerId,
        customer: {
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.phoneNumber,
          email: user.email || 'N/A',
          address: `${address.street}, ${address.city}, ${address.state}, ${address.postalCode}, ${address.country}`,
        },
        items: sellerItems,
        total: sellerTotal,
        status: paymentMethod === 'Cash on Delivery' ? 'pending' : 'pending', // Razorpay needs verification
      });

      await order.save();
      orders.push(order);

      // Update product quantities if not COD
      if (paymentMethod !== 'Cash on Delivery') {
        for (const item of sellerItems) {
          const product = await Product.findOne({ _id: item.productId, sellerId });
          if (product) {
            product.quantity -= item.quantity;
            await product.save();
          }
        }
      }
    }

    // Clear cart if coming from cart
    if (req.body.fromCart) {
      user.cart = [];
      await user.save();
    }

    const response = {
      message: 'Order(s) created successfully',
      orders: orders.map(o => ({ orderId: o.orderId, sellerId: o.sellerId })),
    };
    if (razorpayOrder) {
      response.razorpay = {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      };
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
});

router.post('/verify-payment', userLoggedin, async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderData) {
      return sendResponse(res, 400, { success: false, message: 'Payment details and order data are required' });
    }

    const { items, totalAmount, userDetails, addressId, paymentMethod } = orderData;

    if (!RAZORPAY_KEY_SECRET) {
      return sendResponse(res, 503, { success: false, message: 'Payments are temporarily unavailable' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return sendResponse(res, 400, { success: false, message: 'Invalid payment signature' });
    }

    const user = await User.findById(req.user.id).session(session);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return sendResponse(res, 400, { success: false, message: 'Invalid address' });
    }

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        return sendResponse(res, 404, { success: false, message: `Product ${item.productId} not found` });
      }
      if (product.quantity < item.quantity) {
        return sendResponse(res, 400, { success: false, message: `Insufficient stock for ${product.name}` });
      }
      product.quantity -= item.quantity;
      await product.save({ session });
    }

    const order = new Order({
      userId: req.user.id,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      totalAmount,
      userDetails,
      address,
      paymentMethod,
      paymentId: razorpay_payment_id,
      status: 'completed',
    });

    await order.save({ session });
    user.cart = [];
    await user.save({ session });

    await session.commitTransaction();
    sendResponse(res, 200, {
      success: true,
      message: 'Payment verified and order placed successfully',
      orderId: order._id,
    });
  } catch (error) {
    if (session) {
      try { await session.abortTransaction(); } catch (_) { /* already aborted */ }
    }
    console.error('Verify Payment Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to verify payment', error: error.message });
  } finally {
    if (session) session.endSession();
  }
});
router.post('/place-order', userLoggedin, async (req, res) => {
  try {
    const { items, totalAmount, userDetails, addressId, paymentMethod, fromCart } = req.body;

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0 || !totalAmount || !addressId || !paymentMethod || !userDetails) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const address = user.addresses.id(addressId);
    if (!address) return res.status(400).json({ message: 'Invalid address ID' });

    // Group items by seller (assuming multi-seller platform)
    const itemsBySeller = {};
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
      if (product.quantity < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }

      const sellerId = product.sellerId.toString();
      if (!itemsBySeller[sellerId]) {
        itemsBySeller[sellerId] = { items: [], seller: product.sellerId };
      }
      itemsBySeller[sellerId].items.push({
        name: product.name,
        price: item.price || product.price,
        quantity: item.quantity,
      });
    }

    const orders = [];
    for (const sellerId of Object.keys(itemsBySeller)) {
      const { items: sellerItems, seller } = itemsBySeller[sellerId];
      const sellerTotal = sellerItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const order = new Order({
        orderId: `ORD_${Date.now()}_${sellerId}`,
        sellerId,
        customer: {
          name: userDetails.name,
          email: userDetails.email || user.email || 'N/A',
          address: `${address.street}, ${address.city}, ${address.state}, ${address.postalCode}, ${address.country}`,
        },
        items: sellerItems,
        total: sellerTotal,
        status: 'pending',
        paymentMethod,
      });

      await order.save();
      orders.push(order);
    }

    if (fromCart) {
      user.cart = [];
      await user.save();
    }

    res.status(200).json({
      message: 'Order placed successfully',
      orders: orders.map(o => ({ orderId: o.orderId, sellerId: o.sellerId })),
    });
  } catch (error) {
    console.error('Place Order Error:', error);
    res.status(500).json({ message: 'Failed to place order', error: error.message });
  }
});

router.post('/checkout', userLoggedin, async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const user = await User.findById(req.user.id).populate('cart.productId').session(session);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }

    if (!user.cart || user.cart.length === 0) {
      return sendResponse(res, 400, { success: false, message: 'Cart is empty' });
    }

    if (!user.addresses || user.addresses.length === 0) {
      return sendResponse(res, 400, { success: false, message: 'Please add a delivery address' });
    }

    const total = user.cart.reduce((sum, item) => sum + item.priceAtAdd * item.quantity, 0);

    const order = new Order({
      userId: req.user.id,
      items: user.cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.priceAtAdd,
      })),
      totalAmount: total,
      userDetails: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.phoneNumber,
        phoneNumber: user.phoneNumber,
      },
      address: user.addresses[0],
      status: 'pending',
    });

    await order.save({ session });

    for (const item of user.cart) {
      const product = await Product.findById(item.productId).session(session);
      if (product) {
        product.quantity -= item.quantity;
        await product.save({ session });
      }
    }

    user.cart = [];
    await user.save({ session });

    await session.commitTransaction();
    sendResponse(res, 200, { success: true, message: 'Checkout successful', total, orderId: order._id });
  } catch (error) {
    if (session) {
      try { await session.abortTransaction(); } catch (_) { /* already aborted */ }
    }
    console.error('Checkout Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to process checkout', error: error.message });
  } finally {
    if (session) session.endSession();
  }
});

router.post('/checkout/:productId', userLoggedin, async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const productId = req.params.productId;
    const { quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendResponse(res, 400, { success: false, message: 'Invalid product ID' });
    }

    if (!quantity || quantity <= 0) {
      return sendResponse(res, 400, { success: false, message: 'Valid quantity is required' });
    }

    const user = await User.findById(req.user.id).session(session);
    if (!user) {
      return sendResponse(res, 404, { success: false, message: 'User not found' });
    }

    const product = await Product.findById(productId).session(session);
    if (!product) {
      return sendResponse(res, 404, { success: false, message: 'Product not found' });
    }

    if (quantity > product.quantity) {
      return sendResponse(res, 400, { success: false, message: 'Requested quantity exceeds available stock' });
    }

    const total = product.price * quantity;

    const order = new Order({
      userId: req.user.id,
      items: [{ productId, quantity, price: product.price }],
      totalAmount: total,
      userDetails: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.phoneNumber,
        phoneNumber: user.phoneNumber,
      },
      address: user.addresses[0],
      sellerId: product.sellerId,
      status: 'pending',
    });

    await order.save({ session });
    await session.commitTransaction();

    sendResponse(res, 200, {
      success: true,
      orderId: order._id,
      amount: total,
      productName: product.name,
      message: 'Order created, proceed to payment',
    });
  } catch (error) {
    if (session) {
      try { await session.abortTransaction(); } catch (_) { /* already aborted */ }
    }
    console.error('Checkout Error:', error);
    sendResponse(res, 500, { success: false, message: 'Failed to initiate checkout', error: error.message });
  } finally {
    if (session) session.endSession();
  }
});

module.exports = router;