const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const axios = require('axios');
const { Client } = require('@elastic/elasticsearch');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const Seller = require('../models/sellerModel');
const Category = require('../models/CategoryModel');
const Order = require('../models/orderModel');
const TempOrder = require('../models/TempOrderModel'); // Updated TempOrder model
const { sendOtp, verifyOtp } = require('../utils/otp');
const userLoggedin = require('../middleware/userLoggedin');
const { uploadSingle } = require('../config/multerConfig');
const { uploadToCloudinary } = require('../config/cloudinaryConfig');
const SponsoredProduct = require('../models/SponsoredProductModel');


const Layout = require('../models/layoutModel'); // Import Layout model
const ComboOffer = require('../models/ComboOfferModel'); // Import ComboOffer model
const Admin = require('../models/adminModel'); // Import Admin model


const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Escapes user-supplied text before it reaches $regex / new RegExp. Without this a
// search for "(" throws an invalid-regex error and a search for ".*" matches everything.
const escapeRegex = (str) => String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Amount a customer actually pays for a unit. Falls back to price when a product was
// created before discountedPrice existed.
const productPrice = (product) => {
  const discounted = Number(product.discountedPrice);
  if (Number.isFinite(discounted) && discounted > 0) return discounted;
  return Number(product.price) || 0;
};

const formatAddress = (address) =>
  address
    ? [address.street, address.city, address.state, address.postalCode, address.country]
        .filter(Boolean)
        .join(', ')
    : '';

// Order amounts are always derived from the product document. The client sends price /
// onlineAmount / codAmount for display convenience, but those values are attacker
// controlled and must never reach the order record or the Razorpay charge.
const buildPricedLine = (product, quantity, paymentMethod) => {
  const lineTotal = round2(product.price * quantity);
  const codAllowed = Boolean(product.isCashOnDeliveryAvailable);
  const onlinePct = codAllowed
    ? Math.min(Math.max(product.onlinePaymentPercentage ?? 100, 0), 100)
    : 100;

  let onlineAmount;
  let codAmount;
  if (paymentMethod === 'Cash on Delivery') {
    onlineAmount = 0;
    codAmount = lineTotal;
  } else if (paymentMethod === 'Razorpay') {
    onlineAmount = lineTotal;
    codAmount = 0;
  } else {
    // Split payment: the product's own online share is paid now, the rest on delivery.
    onlineAmount = round2(lineTotal * (onlinePct / 100));
    codAmount = round2(lineTotal - onlineAmount);
  }

  return { price: product.price, lineTotal, onlineAmount, codAmount };
};

// Optional Elasticsearch Client
const elasticsearch = process.env.ELASTICSEARCH_URL
  ? new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      maxRetries: 5,
      requestTimeout: 60000,
    })
  : null;

// Test Elasticsearch connection on startup (if enabled)
if (elasticsearch) {
  elasticsearch
    .ping()
    .then(() => console.log('Elasticsearch connected successfully'))
    .catch((err) => console.error('Elasticsearch connection failed on startup:', err));
}

// Index data into Elasticsearch (if enabled)
const indexData = async () => {
  if (!elasticsearch) return;

  try {
    const [products, categories, sellers] = await Promise.all([
      Product.find(),
      Category.find(),
      Seller.find(),
    ]);

    const bulkOps = [];
    products.forEach((product) =>
      bulkOps.push(
        { index: { _index: 'products', _id: product._id.toString() } },
        {
          name: product.name,
          description: product.description,
          category: product.category,
          sellerId: product.sellerId,
          image: product.image,
          images: product.images,
          price: product.price,
          viewCount: product.viewCount,
          isSponsored: product.isSponsored,
        }
      )
    );
    categories.forEach((category) =>
      bulkOps.push(
        { index: { _index: 'categories', _id: category._id.toString() } },
        { name: category.name }
      )
    );
    sellers.forEach((seller) =>
      bulkOps.push(
        { index: { _index: 'sellers', _id: seller._id.toString() } },
        { name: seller.name, shopName: seller.shopName }
      )
    );

    if (bulkOps.length) {
      await elasticsearch.bulk({ body: bulkOps });
      console.log('Data indexed into Elasticsearch');
    }
  } catch (error) {
    console.error('Elasticsearch Indexing Error:', error);
  }
};

// Run indexing on startup (if Elasticsearch is enabled)
if (elasticsearch) indexData();

// Authentication Routes
router.post('/send-otp', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ message: 'Phone number is required' });

  try {
    await sendOtp(phoneNumber);
    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { phoneNumber, otp } = req.body;
  if (!phoneNumber || !otp) return res.status(400).json({ message: 'Phone number and OTP are required' });

  try {
    const isValid = await verifyOtp(phoneNumber, otp);
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

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

    res.status(200).json({
      message: isNewUser ? 'Registered and logged in successfully' : 'Logged in successfully',
      user: { id: user._id, phoneNumber: user.phoneNumber, role: user.role },
      token,
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/login-register', async (req, res) => {
  const { phoneNumber, pin } = req.body;
  if (!phoneNumber || !pin) return res.status(400).json({ message: 'Phone number and PIN are required' });
  if (!/^\d{6}$/.test(pin)) return res.status(400).json({ message: 'PIN must be a 6-digit number' });

  try {
    let user = await User.findOne({ phoneNumber }).select('+pin');
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = new User({ phoneNumber, role: 'user', pin });
      await user.save();
    } else if (!(await user.matchPin(pin))) {
      return res.status(401).json({ message: 'Incorrect PIN' });
    }

    const token = jwt.sign(
      { id: user._id, phoneNumber: user.phoneNumber, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: isNewUser ? 'Registered and logged in successfully' : 'Logged in successfully',
      user: { id: user._id, phoneNumber: user.phoneNumber, role: user.role },
      token,
    });
  } catch (error) {
    console.error('Login/Register Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/verify-token', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('phoneNumber role');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      message: 'Token is valid',
      user: { id: user._id, phoneNumber: user.phoneNumber, role: user.role },
    });
  } catch (error) {
    console.error('Token Verification Error:', error);
    res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
});

router.post('/logout', userLoggedin, async (req, res) => {
  try {
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ message: 'Failed to logout', error: error.message });
  }
});

// Profile Routes
router.get('/profile', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      '-verificationToken -resetPasswordToken -resetPasswordExpire -loginAttempts -accountLockedUntil'
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ user });
  } catch (error) {
    console.error('Fetch Profile Error:', error);
    res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

// Address Routes
router.post('/add-address', userLoggedin, async (req, res) => {
  try {
    const { street, city, state, postalCode, country } = req.body;
    if (!street || !city || !state || !postalCode || !country) {
      return res.status(400).json({ message: 'All address fields are required' });
    }

    const user = await User.findById(req.user.id);
    const newAddress = { street, city, state, postalCode, country };
    user.addresses.push(newAddress);
    await user.save();

    const addedAddress = user.addresses[user.addresses.length - 1];
    res.status(200).json({ address: addedAddress });
  } catch (error) {
    console.error('Error adding address:', error);
    res.status(500).json({ message: 'Failed to add address' });
  }
});

router.delete('/remove-address/:addressId', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses.id(req.params.addressId).remove();
    await user.save();
    res.status(200).json({ message: 'Address removed successfully' });
  } catch (error) {
    console.error('Error removing address:', error);
    res.status(500).json({ message: 'Failed to remove address' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const { q, category, sellerId, page = 1, limit = 20 } = req.query;
    let query = { status: 'enabled', quantity: { $gt: 0 } };

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      query.$or = [
        { name: regex },
        { description: regex },
        { brand: regex },
        { material: regex },
      ];
    }

    if (category && category.toLowerCase() !== 'all') {
      const categoryDoc = await Category.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(category)}$`, 'i') },
      });
      if (!categoryDoc) {
        return res.status(404).json({ message: `Category '${category}' not found` });
      }
      query.category = categoryDoc._id;
    }

    if (sellerId) {
      query.sellerId = sellerId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    const totalCount = await Product.countDocuments(query);

    const products = await Product.find(query)
      .skip(skip)
      .limit(parsedLimit)
      .populate('sellerId', 'name phoneNumber shopName')
      .populate('category', 'name');

    return res.status(200).json({
      products,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parsedLimit),
      hasMore: skip + products.length < totalCount,
    });
  } catch (error) {
    console.error('Fetch Products Error:', error);
    return res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
});


router.get('/products/sponsored', async (req, res) => {
  try {
    const products = await Product.find({ isSponsored: true })
      .limit(10)
      .populate('sellerId', 'name shopName')
      .populate('category', 'name');
    res.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching sponsored products:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// NOTE: this route and /products/sponsored are declared ABOVE /products/:productId on
// purpose. Express matches in registration order, so a literal path registered after a
// ':productId' param route is unreachable -- it would be captured as productId='sponsored'
// and 400 out as an invalid ObjectId.
router.get('/products/most-viewed-ordered', async (req, res) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 2);

    // Most viewed
    const viewed = await Product.find({ viewCount: { $gt: 0 }, createdAt: { $gte: startDate } })
      .sort({ viewCount: -1 })
      .limit(10)
      .select('name price images category sellerId')
      .populate('sellerId', 'name shopName')
      .populate('category', 'name');

    // Most ordered
    const ordered = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', count: { $sum: '$items.quantity' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      {
        $project: {
          _id: '$product._id',
          name: '$product.name',
          price: '$product.price',
          images: '$product.images',
          category: '$product.category',
          sellerId: '$product.sellerId',
        },
      },
    ]);

    // Combine and deduplicate
    const combined = [...viewed, ...ordered].reduce((acc, item) => {
      if (!acc.find((p) => p._id.toString() === item._id.toString())) {
        acc.push(item);
      }
      return acc;
    }, []).slice(0, 10);

    // Populate category and seller for ordered products
    await Product.populate(combined, [
      { path: 'category', select: 'name' },
      { path: 'sellerId', select: 'name shopName' },
    ]);

    res.json({ success: true, products: combined });
  } catch (error) {
    console.error('Error fetching most viewed/ordered products:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/products/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(productId)
      .populate('sellerId', 'name shopName')
      .populate('category', 'name');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Track view for authenticated users
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          user.recentlyViewed = [
            { productId, viewedAt: new Date() },
            ...user.recentlyViewed.filter((v) => v.productId.toString() !== productId).slice(0, 9),
          ];
          await user.save();
          await Product.updateOne({ _id: productId }, { $inc: { viewCount: 1, views: 1 } });
        }
      } catch (error) {
        console.warn('Token invalid for view tracking:', error.message);
      }
    }

    res.status(200).json({ product });
  } catch (error) {
    console.error('Fetch Product Error:', error);
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
});

router.post('/products/by-ids', async (req, res) => {
  const { productIds } = req.body;
  try {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'productIds must be a non-empty array' });
    }
    const products = await Product.find({ _id: { $in: productIds } })
      .populate('sellerId', 'name shopName')
      .populate('category', 'name');
    res.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching products by IDs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Seller Routes
router.get('/sellers', async (req, res) => {
  try {
    const sellers = await Seller.find({ role: 'seller', status: 'enabled' })
      .select('name shopName profilePicture phoneNumber address')
      .lean();

    const sellersWithDefaultImage = sellers.map((seller) => ({
      ...seller,
      profilePicture:
        seller.profilePicture && seller.profilePicture !== ''
          ? seller.profilePicture
          : 'https://via.placeholder.com/80x80?text=No+Image',
    }));

    res.status(200).json({ sellers: sellersWithDefaultImage });
  } catch (error) {
    console.error('Fetch Sellers Error:', error);
    res.status(500).json({ message: 'Failed to fetch sellers', error: error.message });
  }
});


router.get('/seller/:sellerId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.sellerId)) {
      return res.status(400).json({ message: 'Invalid seller ID' });
    }
    // Public storefront fields only -- paymentIds, bank account, IFSC and UPI must never
    // leave the server on an unauthenticated route.
    const seller = await Seller.findById(req.params.sellerId)
      .select('name shopName profilePicture phoneNumber address status')
      .lean();
    if (!seller || seller.role !== 'seller' || seller.status !== 'enabled') {
      return res.status(404).json({ message: 'Seller not found' });
    }
    res.status(200).json({
      seller: {
        ...seller,
        profilePicture:
          seller.profilePicture && seller.profilePicture !== ''
            ? seller.profilePicture
            : 'https://via.placeholder.com/80x80?text=No+Image',
      },
    });
  } catch (error) {
    console.error('Fetch Seller Error:', error);
    res.status(500).json({ message: 'Failed to fetch seller', error: error.message });
  }
});

// Seller Authentication Middleware
const authSeller = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const seller = await Seller.findById(decoded.id).select('+password');
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    req.seller = seller;
    next();
  } catch (error) {
    console.error('Auth Seller Error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

// Seller Products Route
router.get('/seller/products', authSeller, async (req, res) => {
  try {
    const products = await Product.find({ sellerId: req.seller._id }).populate('category', 'name');
    res.json({ products });
  } catch (error) {
    console.error('Seller Products Fetch Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Category Routes
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().select('name icon');
    res.status(200).json({ categories });
  } catch (error) {
    console.error('Fetch Categories Error:', error);
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
});

// Wishlist Routes
router.get('/wishlist', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist.productId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ wishlist: user.wishlist });
  } catch (error) {
    console.error('Fetch Wishlist Error:', error);
    res.status(500).json({ message: 'Failed to fetch wishlist', error: error.message });
  }
});

router.put('/wishlist/:productId', userLoggedin, async (req, res) => {
  try {
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const wishlistIndex = user.wishlist.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (wishlistIndex !== -1) {
      user.wishlist.splice(wishlistIndex, 1);
      await user.save();
      return res.status(200).json({ message: 'Removed from Wishlist', inWishlist: false });
    }

    user.wishlist.push({ productId });
    await user.save();
    return res.status(200).json({ message: 'Added to Wishlist', inWishlist: true });
  } catch (error) {
    console.error('Wishlist Error:', error);
    res.status(500).json({ message: 'Failed to update wishlist', error: error.message });
  }
});

router.get('/wishlist/:productId', userLoggedin, async (req, res) => {
  try {
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isInWishlist = user.wishlist.some(
      (item) => item.productId.toString() === productId
    );
    res.status(200).json({ inWishlist: isInWishlist });
  } catch (error) {
    console.error('Fetch Wishlist Status Error:', error);
    res.status(500).json({ message: 'Failed to fetch wishlist status', error: error.message });
  }
});

// Cart Routes
router.get('/cart', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('cart.productId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Transform cart to match frontend expectations
    const cartItems = user.cart.map((item) => ({
      product: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
    }));

    res.status(200).json({ success: true, cart: { items: cartItems } });
  } catch (error) {
    console.error('Fetch Cart Error:', error);
    res.status(500).json({ message: 'Failed to fetch cart', error: error.message });
  }
});

// Add-to-cart is reached at two different URLs by the client:
//   POST /api/user/auth/cart/add  (ProductCard, ProductCard4line, store.js, Components/js.js)
//   POST /api/user/auth/cart      (home/RecentlyViewedSection, home/TrendingSection, home/CategorySectionn)
// Both send { productId, quantity, size, color }, so one handler is registered on both.
const addToCartHandler = async (req, res) => {
  try {
    const { productId, quantity, size, color } = req.body;
    if (!productId || !quantity || !size || !color) {
      return res.status(400).json({ message: 'productId, quantity, size, and color are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (quantity > product.quantity) {
      return res.status(400).json({ message: `Only ${product.quantity} items available in stock` });
    }

    const cartItem = { productId, quantity, size, color };
    await user.updateCart(cartItem);

    await user.populate('cart.productId');
    const cartItems = user.cart.map((item) => ({
      product: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
    }));

    res.status(201).json({ success: true, message: 'Added to cart', cart: { items: cartItems } });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    res.status(500).json({ message: 'Failed to add to cart', error: error.message });
  }
};

router.post('/cart', userLoggedin, addToCartHandler);
router.post('/cart/add', userLoggedin, addToCartHandler);

router.put('/cart/:productId', userLoggedin, async (req, res) => {
  try {
    const { quantity, size, color } = req.body;
    if (!quantity || !size || !color) {
      return res.status(400).json({ message: 'quantity, size, and color are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (quantity > product.quantity) {
      return res.status(400).json({ message: `Only ${product.quantity} items available in stock` });
    }

    const cartIndex = user.cart.findIndex(
      (item) => item.productId.toString() === req.params.productId && item.size === size && item.color === color
    );
    if (cartIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart with specified size and color' });
    }

    user.cart[cartIndex].quantity = quantity;
    await user.save();

    await user.populate('cart.productId');
    const cartItems = user.cart.map((item) => ({
      product: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
    }));

    res.status(200).json({ success: true, message: 'Cart updated', cart: { items: cartItems } });
  } catch (error) {
    console.error('Update Cart Error:', error);
    res.status(500).json({ message: 'Failed to update cart', error: error.message });
  }
});

router.delete('/cart/:productId', userLoggedin, async (req, res) => {
  try {
    const { size, color } = req.body;
    if (!size || !color) {
      return res.status(400).json({ message: 'size and color are required to identify the cart item' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updateResult = await User.findOneAndUpdate(
      { _id: req.user.id, 'cart.productId': req.params.productId, 'cart.size': size, 'cart.color': color },
      { $pull: { cart: { productId: req.params.productId, size, color } } },
      { new: true }
    ).populate('cart.productId');

    if (!updateResult) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    const cartItems = updateResult.cart.map((item) => ({
      product: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
    }));

    res.status(200).json({ success: true, message: 'Item removed from cart', cart: { items: cartItems } });
  } catch (error) {
    console.error('Remove from Cart Error:', error);
    res.status(500).json({ message: 'Failed to remove item from cart', error: error.message });
  }
});

// Save for Later Routes
router.get('/save-for-later', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('savedForLater.productId');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ savedForLater: user.savedForLater });
  } catch (error) {
    console.error('Fetch Saved For Later Error:', error);
    res.status(500).json({ message: 'Failed to fetch saved for later', error: error.message });
  }
});

router.post('/save-for-later', userLoggedin, async (req, res) => {
  try {
    const { productId, quantity, size, color } = req.body;
    if (!productId || !quantity || !size || !color) {
      return res.status(400).json({ message: 'productId, quantity, size, and color are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const updateResult = await User.findOneAndUpdate(
      { _id: req.user.id },
      {
        $pull: { cart: { productId, size, color } },
        $addToSet: { savedForLater: { productId, quantity, size, color } },
      },
      { new: true }
    )
      .populate('cart.productId')
      .populate('savedForLater.productId');

    if (!updateResult) {
      return res.status(500).json({ message: 'Failed to update due to concurrency issue' });
    }

    const cartItems = updateResult.cart.map((item) => ({
      product: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
    }));

    res.status(201).json({
      success: true,
      message: 'Saved for later',
      cart: { items: cartItems },
      savedForLater: updateResult.savedForLater,
    });
  } catch (error) {
    console.error('Save For Later Error:', error);
    res.status(500).json({ message: 'Failed to save for later', error: error.message });
  }
});

router.delete('/save-for-later/:productId', userLoggedin, async (req, res) => {
  try {
    const { size, color } = req.body;
    if (!size || !color) {
      return res.status(400).json({ message: 'size and color are required to identify the saved item' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updateResult = await User.findOneAndUpdate(
      { _id: req.user.id, 'savedForLater.productId': req.params.productId, 'savedForLater.size': size, 'savedForLater.color': color },
      { $pull: { savedForLater: { productId: req.params.productId, size, color } } },
      { new: true }
    ).populate('savedForLater.productId');

    if (!updateResult) {
      return res.status(404).json({ message: 'Item not found in saved for later' });
    }

    res.status(200).json({ success: true, message: 'Item removed from saved for later', savedForLater: updateResult.savedForLater });
  } catch (error) {
    console.error('Remove Saved For Later Error:', error);
    res.status(500).json({ message: 'Failed to remove from saved for later', error: error.message });
  }
});

router.post('/recently-viewed', userLoggedin, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;

    // Validate productId
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await User.findByIdAndUpdate(
      userId,
      {
        $pull: { recentlyViewed: { productId } }, // Remove if already viewed
        $push: {
          recentlyViewed: {
            // $position is a top-level $push modifier, not a field of the stored entry.
            // It has to travel with $each; on its own it was ignored (or rejected as an
            // invalid $-prefixed storage field) and the new view landed at the end of the
            // list, which is the opposite of "recently viewed".
            $each: [{ productId, viewedAt: new Date() }],
            $position: 0, // Add to start
          },
        },
      },
      { new: true }
    );

    // Keep the list bounded to the 10 most recent, newest first.
    await User.updateOne(
      { _id: userId },
      { $push: { recentlyViewed: { $each: [], $slice: -10 } } }
    );

    res.status(200).json({ success: true, message: 'Product view recorded' });
  } catch (error) {
    console.error('Record Recently Viewed Error:', error);
    res.status(500).json({ message: 'Failed to record view', error: error.message });
  }
});

// Fetch recently viewed products
router.get('/recently-viewed', userLoggedin, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('Fetching recently viewed products for user:', userId);

    const user = await User.findById(userId, 'recentlyViewed')
      .populate({
        path: 'recentlyViewed.productId',
        select: '_id name price discountedPrice images category',
        model: Product,
      })
      .lean();

    const products = (user?.recentlyViewed || [])
      .filter((rv) => rv.productId)
      .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
      .map((rv) => ({
        _id: rv.productId._id,
        name: rv.productId.name,
        price: rv.productId.price,
        discountedPrice: rv.productId.discountedPrice,
        images: rv.productId.images || [],
        category: rv.productId.category,
      }))
      .slice(0, 10); // Limit to 10 products

    console.log('Recently viewed products:', products.length);
    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('Fetch Recently Viewed Error:', {
      message: error.message,
      stack: error.stack,
      userId,
    });
    res.status(500).json({ message: 'Failed to fetch recently viewed products', error: error.message });
  }
});

router.post('/products-by-ids', async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty product IDs' });
    }

    const products = await Product.find({
      _id: { $in: productIds },
    })
      .select('_id name price discountedPrice images category')
      .lean();

    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('Fetch Products by IDs Error:', error);
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
});


// Order Routes
router.get('/order/:orderId', userLoggedin, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate({
        path: 'items.productId',
        select: 'name images price',
      })
      .lean();

    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    res.status(200).json({ order });
  } catch (error) {
    console.error('Fetch Order Error:', error);
    res.status(500).json({ message: 'Fetch order failed', error: error.message });
  }
});

router.get('/orders', userLoggedin, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).populate('sellerId', 'name email');
    res.status(200).json({ orders });
  } catch (error) {
    console.error('Fetch Orders Error:', error);
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

router.post('/create-order', userLoggedin, async (req, res) => {
  try {
    const { items, shipping, userDetails, addressId, paymentMethod, fromCart } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !addressId || !paymentMethod || !userDetails) {
      return res.status(400).json({ message: 'Items, addressId, paymentMethod, and userDetails are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const address = user.addresses.id(addressId);
    if (!address) return res.status(400).json({ message: 'Invalid address ID' });

    // Validate items and group by seller
    const itemsBySeller = {};
    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({ message: `Invalid productId: ${item.productId}` });
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Each item requires a positive whole-number quantity' });
      }

      const product = await Product.findById(item.productId).populate('sellerId');
      if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
      if (product.quantity < quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }
      if (product.status !== 'enabled') {
        return res.status(400).json({ message: `${product.name} is no longer available` });
      }

      const priced = buildPricedLine(product, quantity, paymentMethod);
      const sellerId = product.sellerId._id.toString();
      if (!itemsBySeller[sellerId]) itemsBySeller[sellerId] = { items: [], seller: product.sellerId };
      itemsBySeller[sellerId].items.push({
        productId: product._id,
        name: product.name,
        price: priced.price,
        quantity,
        size: item.size,
        color: item.color,
        material: product.material,
        gender: product.gender,
        brand: product.brand,
        fit: product.fit,
        careInstructions: product.careInstructions,
        dimensions: product.dimensions,
        weight: product.weight,
        image: Array.isArray(product.images) ? product.images[0] : product.images,
        isReturnable: product.isReturnable,
        returnPeriod: product.returnPeriod,
        onlineAmount: priced.onlineAmount,
        codAmount: priced.codAmount,
      });
    }

    // Authoritative online total, computed from the priced lines rather than the request.
    const allLines = Object.values(itemsBySeller).flatMap((group) => group.items);
    const shippingTotal = Number(shipping) > 0 ? round2(shipping) : 0;
    const onlineTotal = round2(allLines.reduce((sum, i) => sum + i.onlineAmount, 0));
    const amountDueOnline =
      paymentMethod === 'Cash on Delivery' ? 0 : round2(onlineTotal + shippingTotal);

    // Create Razorpay order if needed
    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' || paymentMethod === 'Split Payment') {
      if (!(amountDueOnline > 0)) {
        return res.status(400).json({ message: 'Online amount must be greater than zero for Razorpay or Split Payment' });
      }
      const razorpayOptions = {
        amount: Math.round(amountDueOnline * 100), // Convert to paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
      };
      razorpayOrder = await razorpay.orders.create(razorpayOptions);
    }

    // Prepare customer details
    const customerDetails = {
      name: userDetails.name || user.firstName || user.phoneNumber,
      email: userDetails.email || user.email || '',
      phoneNumber: userDetails.phoneNumber || user.phoneNumber,
      address: `${address.street}, ${address.city}, ${address.state}, ${address.postalCode}, ${address.country}`,
    };

    // Create temporary orders
    const tempOrders = [];
    const numSellers = Object.keys(itemsBySeller).length;
    for (const sellerId of Object.keys(itemsBySeller)) {
      const { items: sellerItems } = itemsBySeller[sellerId];
      const sellerTotal =
        sellerItems.reduce((sum, item) => sum + item.onlineAmount + item.codAmount, 0) +
        shippingTotal / numSellers;

      const tempOrder = new TempOrder({
        razorpayOrderId: razorpayOrder ? razorpayOrder.id : `COD_${Date.now()}_${sellerId}`,
        userId: req.user.id,
        sellerId,
        customer: customerDetails,
        items: sellerItems,
        total: sellerTotal,
        onlineAmount: sellerItems.reduce((sum, item) => sum + item.onlineAmount, 0),
        codAmount: sellerItems.reduce((sum, item) => sum + item.codAmount, 0),
        shipping: shippingTotal / numSellers || 0,
        paymentMethod,
      });

      await tempOrder.save();
      tempOrders.push(tempOrder);
    }

    // Prepare response
    const response = {
      success: true,
      message: 'Order(s) created, proceed to payment if applicable',
      totalAmount: round2(allLines.reduce((sum, i) => sum + i.onlineAmount + i.codAmount, 0) + shippingTotal),
      codAmount: round2(allLines.reduce((sum, i) => sum + i.codAmount, 0)),
      orders: tempOrders.map((o) => ({ orderId: o._id, sellerId: o.sellerId })),
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
    console.error('Create Order Error:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body,
    });
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
});

router.post('/verify-payment', userLoggedin, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderData) {
      return res.status(400).json({ success: false, message: 'Payment details and order data are required' });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    let isSignatureValid = generatedSignature === razorpay_signature;

    // Fallback: Verify payment status with Razorpay API if signature fails
    if (!isSignatureValid) {
      try {
        const response = await axios.get(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
          auth: {
            username: RAZORPAY_KEY_ID,
            password: RAZORPAY_KEY_SECRET,
          },
        });
        const payment = response.data;
        if (payment.status === 'captured' && payment.order_id === razorpay_order_id) {
          isSignatureValid = true;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Payment verification failed via Razorpay API',
            details: payment.status,
          });
        }
      } catch (apiError) {
        console.error('Razorpay API Error:', apiError.response?.data || apiError.message);
        return res.status(400).json({ success: false, message: 'Invalid payment signature and API verification failed' });
      }
    }

    if (!isSignatureValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Fetch user
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Validate address
    const address = user.addresses.id(orderData.addressId);
    if (!address) return res.status(400).json({ success: false, message: 'Invalid address' });

    // Fetch temporary orders. Scoped to the authenticated user so a captured payment id
    // cannot be replayed to convert somebody else's pending orders.
    const tempOrders = await TempOrder.find({ razorpayOrderId: razorpay_order_id, userId: req.user.id });
    if (!tempOrders || tempOrders.length === 0) {
      return res.status(400).json({ success: false, message: 'No pending orders found' });
    }

    // The amount actually collected must match what the pending orders are worth.
    const expectedOnline = round2(tempOrders.reduce((sum, o) => sum + (o.onlineAmount || 0), 0));
    if (expectedOnline > 0) {
      const tempShipping = round2(tempOrders.reduce((sum, o) => sum + (o.shipping || 0), 0));
      const amountDue = round2(expectedOnline + tempShipping);
      const paidPaise = Number(
        orderData.razorpay_amount ?? orderData.amount ?? (Number(orderData.totalAmount) || 0) * 100
      );
      if (Number.isFinite(paidPaise) && paidPaise > 0 && Math.abs(paidPaise - Math.round(amountDue * 100)) > 1) {
        return res.status(400).json({
          success: false,
          message: 'Payment amount does not match the order total',
        });
      }
    }

    // Process orders
    const orders = [];
    for (const tempOrder of tempOrders) {
      const order = new Order({
        ...tempOrder.toObject(),
        orderId: `ORD_${Date.now()}_${tempOrder.sellerId}_${Math.random().toString(36).substr(2, 5)}`,
        paymentId: razorpay_payment_id,
        paymentStatus: 'completed',
        status: 'order confirmed',
        statusHistory: [{ status: 'order confirmed', timestamp: Date.now() }],
      });
      await order.save();
      orders.push(order);

      // Update product quantities
      for (const item of order.items) {
        await Product.updateOne({ _id: item.productId }, { $inc: { quantity: -item.quantity } });
      }
      order.stockDeducted = true;
      await order.save();
      // Update seller stats
      await Seller.updateOne({ _id: order.sellerId }, { $inc: { totalOrders: 1 } });
    }

    // Clear cart if fromCart is true
    if (orderData.fromCart) {
      user.cart = [];
      await user.save();
    }

    // Delete temporary orders
    await TempOrder.deleteMany({ razorpayOrderId: razorpay_order_id, userId: req.user.id });

    res.status(200).json({
      success: true,
      message: 'Payment verified and order placed successfully',
      orders: orders.map((o) => ({ orderId: o.orderId, sellerId: o.sellerId })),
    });
  } catch (error) {
    console.error('Verify Payment Error:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body,
    });
    res.status(500).json({ success: false, message: 'Failed to verify payment', error: error.message });
  }
});

router.post('/place-order', userLoggedin, async (req, res) => {
  try {
    const { items, shipping, userDetails, addressId, paymentMethod, fromCart } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !addressId || !paymentMethod || !userDetails) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (paymentMethod !== 'Cash on Delivery') {
      return res.status(400).json({ message: 'Use /create-order for online payments' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const address = user.addresses.id(addressId);
    if (!address) return res.status(400).json({ message: 'Invalid address ID' });

    const itemsBySeller = {};
    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({ message: `Invalid productId: ${item.productId}` });
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Each item requires a positive whole-number quantity' });
      }

      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
      if (product.quantity < quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }
      if (product.status !== 'enabled') {
        return res.status(400).json({ message: `${product.name} is no longer available` });
      }

      const priced = buildPricedLine(product, quantity, paymentMethod);
      const sellerId = product.sellerId.toString();
      if (!itemsBySeller[sellerId]) itemsBySeller[sellerId] = { items: [], seller: product.sellerId };
      itemsBySeller[sellerId].items.push({
        productId: product._id,
        name: product.name,
        price: priced.price,
        quantity,
        size: item.size,
        color: item.color,
        material: product.material,
        gender: product.gender,
        brand: product.brand,
        fit: product.fit,
        careInstructions: product.careInstructions,
        dimensions: product.dimensions,
        weight: product.weight,
        image: Array.isArray(product.images) ? product.images[0] : product.images,
        isReturnable: product.isReturnable,
        returnPeriod: product.returnPeriod,
        onlineAmount: priced.onlineAmount,
        codAmount: priced.codAmount,
      });
    }

    const shippingTotal = Number(shipping) > 0 ? round2(shipping) : 0;
    const numSellers = Object.keys(itemsBySeller).length;

    const orders = [];
    for (const sellerId of Object.keys(itemsBySeller)) {
      const { items: sellerItems } = itemsBySeller[sellerId];
      const sellerTotal =
        sellerItems.reduce((sum, item) => sum + item.onlineAmount + item.codAmount, 0) +
        shippingTotal / numSellers;

      const order = new Order({
        orderId: `ORD_${Date.now()}_${sellerId}_${Math.random().toString(36).substr(2, 5)}`,
        userId: req.user.id,
        sellerId,
        customer: {
          name: userDetails.name,
          email: userDetails.email || user.email,
          phoneNumber: userDetails.phoneNumber || user.phoneNumber,
          address: `${address.street}, ${address.city}, ${address.state}, ${address.postalCode}, ${address.country}`,
        },
        items: sellerItems,
        total: sellerTotal,
        onlineAmount: sellerItems.reduce((sum, item) => sum + item.onlineAmount, 0),
        codAmount: sellerItems.reduce((sum, item) => sum + item.codAmount, 0),
        shipping: shippingTotal / numSellers || 0,
        paymentMethod,
        paymentStatus: 'pending',
        status: 'order confirmed',
        statusHistory: [{ status: 'order confirmed', timestamp: Date.now() }],
      });

      await order.save();
      orders.push(order);

      // No stock deduction for COD until delivery
      await Seller.updateOne({ _id: sellerId }, { $inc: { totalOrders: 1 } });
    }

    if (fromCart) {
      user.cart = [];
      await user.save();
    }

    res.status(200).json({
      message: 'Order placed successfully',
      codAmount: round2(orders.reduce((sum, o) => sum + (o.codAmount || 0), 0)),
      orders: orders.map((o) => ({ orderId: o.orderId, sellerId: o.sellerId })),
    });
  } catch (error) {
    console.error('Place Order Error:', error);
    res.status(500).json({ message: 'Failed to place order', error: error.message });
  }
});

router.put('/orders/:orderId/cancel', userLoggedin, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId, userId: req.user.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderDate = new Date(order.createdAt);
    const now = new Date();
    const hoursDiff = (now - orderDate) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
      return res.status(400).json({ message: 'Order can only be cancelled within 24 hours' });
    }

    if (order.status === 'cancelled' || order.status === 'delivered') {
      return res.status(400).json({ message: 'Order cannot be cancelled' });
    }

    order.status = 'cancelled';
    order.statusHistory.push({ status: 'cancelled', timestamp: Date.now() });
    await order.save();

    // Only give the stock back if it was actually taken when the order was created.
    // Cash-on-Delivery orders never decrement quantity, so restoring here would invent
    // inventory out of nothing on every cancellation.
    if (order.stockDeducted) {
      for (const item of order.items) {
        await Product.updateOne({ _id: item.productId }, { $inc: { quantity: item.quantity } });
      }
    }

    res.status(200).json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({ message: 'Failed to cancel order', error: error.message });
  }
});

// Checkout Routes
router.post('/checkout', userLoggedin, async (req, res) => {
  try {
    const paymentMethod = req.body?.paymentMethod || 'Cash on Delivery';

    const user = await User.findById(req.user.id).populate('cart.productId');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.cart || user.cart.length === 0) return res.status(400).json({ message: 'Cart is empty' });
    if (!user.addresses || user.addresses.length === 0) {
      return res.status(400).json({ message: 'Please add a delivery address' });
    }

    // A cart row whose product was deleted populates as null, so drop those before pricing.
    const liveCart = user.cart.filter((item) => item.productId);
    if (liveCart.length === 0) {
      user.cart = [];
      await user.save();
      return res.status(400).json({ message: 'No items in your cart are still available' });
    }

    const total = round2(
      liveCart.reduce((sum, item) => sum + productPrice(item.productId) * item.quantity, 0)
    );

    const itemsBySeller = {};
    for (const item of liveCart) {
      const priced = buildPricedLine(item.productId, item.quantity, paymentMethod);
      const sellerId = item.productId.sellerId.toString();
      if (!itemsBySeller[sellerId]) {
        itemsBySeller[sellerId] = { items: [], seller: item.productId.sellerId };
      }
      itemsBySeller[sellerId].items.push({
        productId: item.productId._id,
        name: item.productId.name,
        price: priced.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        material: item.productId.material,
        gender: item.productId.gender,
        brand: item.productId.brand,
        fit: item.productId.fit,
        image: Array.isArray(item.productId.images) ? item.productId.images[0] : item.productId.images,
        isReturnable: item.productId.isReturnable,
        returnPeriod: item.productId.returnPeriod,
        onlineAmount: priced.onlineAmount,
        codAmount: priced.codAmount,
      });
    }

    const orders = [];
    for (const sellerId of Object.keys(itemsBySeller)) {
      const { items: sellerItems } = itemsBySeller[sellerId];
      const sellerTotal = round2(sellerItems.reduce((sum, item) => sum + item.onlineAmount + item.codAmount, 0));

      const order = new Order({
        orderId: `ORD_${Date.now()}_${sellerId}_${Math.random().toString(36).substr(2, 5)}`,
        userId: req.user.id,
        sellerId,
        customer: {
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.phoneNumber,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: formatAddress(user.addresses[0]),
        },
        items: sellerItems,
        total: sellerTotal,
        onlineAmount: round2(sellerItems.reduce((sum, item) => sum + item.onlineAmount, 0)),
        codAmount: round2(sellerItems.reduce((sum, item) => sum + item.codAmount, 0)),
        shipping: 0,
        paymentMethod,
        paymentStatus: 'pending',
        status: 'order confirmed',
        statusHistory: [{ status: 'order confirmed', timestamp: Date.now() }],
      });

      await order.save();
      orders.push(order);
    }

    for (const item of liveCart) {
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { quantity: -item.quantity } }
      );
    }
    await Order.updateMany({ _id: { $in: orders.map((o) => o._id) } }, { $set: { stockDeducted: true } });

    user.cart = [];
    await user.save();

    res.status(200).json({ message: 'Checkout successful', total, orders: orders.map((o) => o.orderId) });
  } catch (error) {
    console.error('Checkout Error:', error);
    res.status(500).json({ message: 'Failed to process checkout', error: error.message });
  }
});

router.post('/checkout/:productId', userLoggedin, async (req, res) => {
  try {
    const productId = req.params.productId;
    const { quantity, size, color } = req.body;
    const paymentMethod = req.body?.paymentMethod || 'Cash on Delivery';

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0 || !size || !color) {
      return res.status(400).json({ message: 'Valid quantity, size, and color are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.addresses || user.addresses.length === 0) {
      return res.status(400).json({ message: 'Please add a delivery address' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (qty > product.quantity) {
      return res.status(400).json({ message: 'Requested quantity exceeds available stock' });
    }

    const priced = buildPricedLine(product, qty, paymentMethod);

    const order = new Order({
      orderId: `ORD_${Date.now()}_${product.sellerId}_${Math.random().toString(36).substr(2, 5)}`,
      userId: req.user.id,
      sellerId: product.sellerId,
      customer: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.phoneNumber,
        email: user.email,
        phoneNumber: user.phoneNumber,
        address: formatAddress(user.addresses[0]),
      },
      items: [{
        productId: product._id,
        name: product.name,
        price: priced.price,
        quantity: qty,
        size,
        color,
        material: product.material,
        gender: product.gender,
        brand: product.brand,
        fit: product.fit,
        image: Array.isArray(product.images) ? product.images[0] : product.images,
        isReturnable: product.isReturnable,
        returnPeriod: product.returnPeriod,
        onlineAmount: priced.onlineAmount,
        codAmount: priced.codAmount,
      }],
      total: priced.lineTotal,
      onlineAmount: priced.onlineAmount,
      codAmount: priced.codAmount,
      shipping: 0,
      paymentMethod,
      paymentStatus: 'pending',
      status: 'order confirmed',
      statusHistory: [{ status: 'order confirmed', timestamp: Date.now() }],
    });

    order.stockDeducted = true;
    await order.save();
    // Conditional decrement: never drive stock negative; roll the order back if sold out.
    const stockUpdate = await Product.updateOne(
      { _id: productId, quantity: { $gte: qty } },
      { $inc: { quantity: -qty } }
    );
    if (stockUpdate.modifiedCount === 0) {
      await Order.deleteOne({ _id: order._id });
      return res.status(400).json({ message: 'Requested quantity exceeds available stock' });
    }
    await Seller.updateOne({ _id: product.sellerId }, { $inc: { totalOrders: 1 } });

    res.status(200).json({
      orderId: order.orderId,
      amount: priced.lineTotal,
      productName: product.name,
      message: 'Order created, proceed to payment',
    });
  } catch (error) {
    console.error('Checkout Error:', error);
    res.status(500).json({ message: 'Failed to initiate checkout', error: error.message });
  }
});

// Additional Routes for Categories
router.get('/productss', async (req, res) => {
  try {
    const { category, gender, brand, excludeProductId, limit, random } = req.query;
    let query = {
      ...(category && { category }),
      ...(gender && { gender }),
      ...(brand && { brand }),
      ...(excludeProductId && { _id: { $ne: excludeProductId } }),
      status: 'enabled',
    };

    let products = await Product.find(query)
      .limit(parseInt(limit) || 10)
      .populate('category', 'name')
      .populate('sellerId', 'name shopName');

    if (products.length === 0 || random === 'true') {
      products = await Product.aggregate([
        { $match: { status: 'enabled', _id: { $ne: excludeProductId } } },
        { $sample: { size: parseInt(limit) || 10 } },
      ]);
      products = await Product.populate(products, [
        { path: 'category', select: 'name' },
        { path: 'sellerId', select: 'name shopName' },
      ]);
    }

    res.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().lean();
    res.status(200).json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/category/:categoryId?', async (req, res) => {
  try {
    const { categoryId } = req.params;

    // If no categoryId or it's "all", return all products
    if (!categoryId || categoryId.toLowerCase() === 'all') {
      const products = await Product.find().lean();
      return res.status(200).json({ products });
    }

    // Check if categoryId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Fetch products by category
    const products = await Product.find({ category: categoryId }).lean();
    res.status(200).json({ products });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/trending', async (req, res) => {
  try {
    console.log('Fetching trending products...');
    const trendingProducts = await Product.find({ viewCount: { $gt: 100 }, status: 'enabled', quantity: { $gt: 0 } })
      .select('_id name price discountedPrice images sizes colors brand ratings category material gender fit careInstructions status quantity isReturnable returnPeriod isCashOnDeliveryAvailable onlinePaymentPercentage dimensions weight tags viewCount views orders availabilityDate createdAt updatedAt')
      .populate('category', '_id name')
      .sort({ viewCount: -1 })
      .limit(10)
      .lean();

    console.log('Trending products found:', trendingProducts.length);

    const products = trendingProducts.map((product) => ({
      ...product,
      image: product.images?.[0],
      sizes: product.sizes || ['Free Size'], // Backend fallback
      colors: product.colors || ['Other'], // Backend fallback
      brand: product.brand || 'No Brand',
      ratings: product.ratings || { average: 0, count: 0 },
      category: product.category || { _id: 'unknown', name: 'Unknown' },
    }));

    console.log('Formatted trending products:', products.length);

    res.status(200).json({
      success: true,
      products,
      totalCount: products.length,
      currentPage: 1,
      totalPages: 1,
    });
  } catch (error) {
    console.error('List Trending Products Error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch trending products', error: error.message });
  }
});


router.get('/sponsored', async (req, res) => {
  try {
    console.log('Fetching sponsored products...');
    const sponsoredProducts = await SponsoredProduct.find()
      .populate({
        path: 'productId',
        select: '_id name price discountedPrice images sizes colors brand ratings category material gender fit careInstructions status quantity isReturnable returnPeriod isCashOnDeliveryAvailable onlinePaymentPercentage dimensions weight tags viewCount views orders availabilityDate createdAt updatedAt',
        match: { status: 'enabled', quantity: { $gt: 0 } },
        populate: {
          path: 'category',
          select: '_id name',
        },
      })
      .lean();

    console.log('Sponsored products found:', JSON.stringify(sponsoredProducts, null, 2));

    // Filter out invalid references and flatten response
    const products = sponsoredProducts
      .filter((sp) => sp.productId)
      .map((sp) => ({
        _id: sp.productId._id,
        name: sp.productId.name,
        price: sp.productId.price,
        discountedPrice: sp.productId.discountedPrice,
        images: sp.productId.images,
        sizes: sp.productId.sizes || ['Free Size'], // Backend fallback
        colors: sp.productId.colors || ['Other'], // Backend fallback
        brand: sp.productId.brand || 'No Brand',
        ratings: sp.productId.ratings || { average: 0, count: 0 },
        category: sp.productId.category || { _id: 'unknown', name: 'Unknown' },
        material: sp.productId.material,
        gender: sp.productId.gender,
        fit: sp.productId.fit,
        careInstructions: sp.productId.careInstructions || [],
        status: sp.productId.status || undefined,
        quantity: sp.productId.quantity || undefined,
        isReturnable: sp.productId.isReturnable || undefined,
        returnPeriod: sp.productId.returnPeriod || undefined,
        isCashOnDeliveryAvailable: sp.productId.isCashOnDeliveryAvailable || undefined,
        onlinePaymentPercentage: sp.productId.onlinePaymentPercentage || undefined,
        dimensions: sp.productId.dimensions || undefined,
        weight: sp.productId.weight || undefined,
        tags: sp.productId.tags || [],
        viewCount: sp.productId.viewCount || 0,
        views: sp.productId.views || [],
        orders: sp.productId.orders || [],
        availabilityDate: sp.productId.availabilityDate,
        createdAt: sp.productId.createdAt,
        updatedAt: sp.productId.updatedAt,
        image: sp.productId.images?.[0],
      }));

    console.log('Formatted products:', JSON.stringify(products, null, 2));

    res.status(200).json({
      success: true,
      products,
      totalCount: products.length,
      currentPage: 1,
      totalPages: 1,
    });
  } catch (error) {
    console.error('List Sponsored Products Error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch sponsored products', error: error.message });
  }
});

// Search Routes
router.get('/searches/recent', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('recentSearches');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const searchesWithSimilar = await Promise.all(
      (user.recentSearches || []).map(async (query) => {
        let similarProducts = [];
        if (elasticsearch) {
          try {
            const productSearch = await elasticsearch.search({
              index: 'products',
              body: {
                query: { multi_match: { query, fields: ['name', 'description'], fuzziness: 'AUTO' } },
                size: 4,
              },
            });
            similarProducts = productSearch.hits.hits.map((hit) => ({ _id: hit._id, ...hit._source }));
          } catch (elasticError) {
            console.warn('Elasticsearch unavailable, falling back to MongoDB:', elasticError);
          }
        }
        if (!similarProducts.length) {
          similarProducts = await Product.find({
            $or: [
              { name: { $regex: escapeRegex(query), $options: 'i' } },
              { description: { $regex: escapeRegex(query), $options: 'i' } },
            ],
          })
            .limit(4)
            .select('name price images category sellerId')
            .populate('sellerId', 'name shopName')
            .populate('category', 'name');
        }
        return { query, similarProducts };
      })
    );

    res.json({ success: true, searches: searchesWithSimilar });
  } catch (error) {
    console.error('Recent Searches Error:', error);
    res.status(500).json({ message: 'Failed to fetch recent searches' });
  }
});

router.post('/searches', userLoggedin, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ message: 'Query is required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.recentSearches) user.recentSearches = [];
    user.recentSearches = [query, ...user.recentSearches.filter((q) => q !== query)].slice(0, 5);
    await user.save();

    res.json({ success: true, message: 'Search saved' });
  } catch (error) {
    console.error('Save Recent Search Error:', error);
    res.status(500).json({ message: 'Failed to save search' });
  }
});

router.get('/search/recent', userLoggedin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const searchesWithSimilar = await Promise.all(
      (user.recentSearches || []).map(async (query) => {
        let similarProducts = [];
        if (elasticsearch) {
          try {
            const productSearch = await elasticsearch.search({
              index: 'products',
              body: {
                query: { multi_match: { query, fields: ['name', 'description'], fuzziness: 'AUTO' } },
                size: 4,
              },
            });
            similarProducts = productSearch.hits.hits.map((hit) => ({ _id: hit._id, ...hit._source }));
          } catch (elasticError) {
            console.warn('Elasticsearch unavailable, falling back to MongoDB:', elasticError);
          }
        }
        if (!similarProducts.length) {
          similarProducts = await Product.find({
            $or: [
              { name: { $regex: escapeRegex(query), $options: 'i' } },
              { description: { $regex: escapeRegex(query), $options: 'i' } },
            ],
          })
            .limit(4)
            .select('name price images category sellerId')
            .populate('sellerId', 'name shopName')
            .populate('category', 'name');
        }
        return { query, similarProducts };
      })
    );

    res.status(200).json({ recentSearches: searchesWithSimilar });
  } catch (error) {
    console.error('Recent Searches Error:', error);
    res.status(500).json({ message: 'Failed to fetch recent searches' });
  }
});

router.post('/search/recent', userLoggedin, async (req, res) => {
  try {
    const { query } = req.body;
    const user = await User.findById(req.user.id);

    if (!query) {
      user.recentSearches = [];
      await user.save();
      return res.status(200).json({ message: 'Recent searches cleared' });
    }

    if (!user.recentSearches) user.recentSearches = [];
    user.recentSearches = [query, ...user.recentSearches.filter((q) => q !== query)].slice(0, 5);
    await user.save();
    res.status(200).json({ message: 'Search saved' });
  } catch (error) {
    console.error('Save/Clear Recent Search Error:', error);
    res.status(500).json({ message: 'Failed to save or clear search' });
  }
});

router.get('/search/trending', async (req, res) => {
  try {
    const trendingSearches = ['phones', 'laptops', 'clothes', 'shoes', 'accessories'];
    const topSellers = await Seller.find()
      .sort({ totalOrders: -1 })
      .limit(5)
      .select('name shopName _id');
    const topCategories = await Category.find()
      .sort({ productCount: -1 })
      .limit(5)
      .select('name _id');
    const topProducts = await Product.find()
      .sort({ viewCount: -1 })
      .limit(5)
      .select('name images _id');

    res.status(200).json({
      trendingSearches,
      topSellers,
      topCategories,
      topProducts,
    });
  } catch (error) {
    console.error('Trending Data Error:', error);
    res.status(500).json({ message: 'Failed to fetch trending data' });
  }
});

router.get('/search/suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    let products = [];
    let categories = [];
    let sellers = [];
    let recentSearches = [];

    if (!q) {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const user = await User.findById(decoded.id).select('recentSearches');
          recentSearches = user?.recentSearches || [];
        } catch (e) {
          recentSearches = [];
        }
      }
    }

    if (q) {
      if (elasticsearch) {
        try {
          const [productSearch, categorySearch, sellerSearch] = await Promise.all([
            elasticsearch.search({
              index: 'products',
              body: {
                query: { multi_match: { query: q, fields: ['name', 'description'], fuzziness: 'AUTO' } },
                size: 8,
              },
            }),
            elasticsearch.search({
              index: 'categories',
              body: { query: { match: { name: q } }, size: 8 },
            }),
            elasticsearch.search({
              index: 'sellers',
              body: {
                query: { multi_match: { query: q, fields: ['name', 'shopName'], fuzziness: 'AUTO' } },
                size: 8,
              },
            }),
          ]);

          products = productSearch.hits.hits.map((hit) => ({ _id: hit._id, ...hit._source }));
          categories = categorySearch.hits.hits.map((hit) => ({ _id: hit._id, ...hit._source }));
          sellers = sellerSearch.hits.hits.map((hit) => ({ _id: hit._id, ...hit._source }));
          console.log('Elasticsearch search successful');
        } catch (elasticError) {
          console.warn('Elasticsearch unavailable, falling back to MongoDB:', elasticError);
        }
      }

      if (!products.length) {
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const [mongoProducts, mongoCategories, mongoSellers] = await Promise.all([
          Product.find({ $or: [{ name: regex }, { description: regex }] })
            .limit(8)
            .select('name images _id'),
          Category.find({ name: regex })
            .limit(8)
            .select('name _id'),
          Seller.find({ $or: [{ name: regex }, { shopName: regex }] })
            .limit(8)
            .select('name shopName _id'),
        ]);

        products = mongoProducts;
        categories = mongoCategories;
        sellers = mongoSellers;
        console.log('MongoDB search successful');
      }
    }

    res.status(200).json({
      recentSearches,
      products,
      categories,
      sellers,
    });
  } catch (error) {
    console.error('Search Suggestions Error:', error);
    res.status(500).json({ message: 'Failed to fetch suggestions' });
  }
});

router.get('/search', userLoggedin, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Query parameter is required' });

    let products = [];
    if (elasticsearch) {
      try {
        const productSearch = await elasticsearch.search({
          index: 'products',
          body: {
            query: { multi_match: { query: q, fields: ['name', 'description'], fuzziness: 'AUTO' } },
          },
        });
        products = productSearch.hits.hits.map((hit) => ({ _id: hit._id, ...hit._source }));
        console.log('Elasticsearch full search successful');
      } catch (elasticError) {
        console.warn('Elasticsearch unavailable for full search, falling back to MongoDB:', elasticError);
      }
    }

    if (!products.length) {
      products = await Product.find({ $text: { $search: q } })
        .select('name images _id description')
        .populate('sellerId', 'name shopName');
      console.log('MongoDB full search successful');
    }

    res.status(200).json({ products });
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ message: 'Failed to perform search' });
  }
});
// Optional auth: resolves req.user when a valid token is present, but never rejects the
// request. /initial-data is fetched by the public home page, so it has to work for
// anonymous visitors while still returning personalised data (recent searches, recently
// viewed) to signed-in users. Without this, req.user was always undefined and that
// personalisation was silently always empty.
const optionalUserLogin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id || decoded._id;
    if (!userId) return next();
    req.user = await User.findById(userId);
  } catch (error) {
    // A bad or expired token is not an error here -- just treat the caller as anonymous.
    req.user = undefined;
  }
  return next();
};

// optimized-initial-data.js
// Updated backend: /initial-data route with improved comboOffers and ads
router.get('/initial-data', optionalUserLogin, async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user?._id;

    // Constants
    const DEFAULTS = {
      PRODUCT_IMAGE: 'https://via.placeholder.com/150?text=Product',
      COMBO_IMAGE: 'https://via.placeholder.com/150?text=Combo',
      AD_IMAGE: 'https://via.placeholder.com/150?text=Ad',
      BANNER_IMAGE: 'https://via.placeholder.com/150?text=Banner',
      CATEGORY_ICON: 'https://via.placeholder.com/50?text=Category',
      PROFILE_PICTURE: 'https://via.placeholder.com/80x80?text=No+Image',
    };

    const sanitizeImage = (img, fallback) => {
      if (!img || typeof img !== 'string' || img.includes('placeholder')) return fallback;
      return img;
    };

    const getFirstImage = (arr, fallback) => {
      if (!Array.isArray(arr)) return fallback;
      const found = arr.find(i => typeof i === 'string' ? i.trim() : i?.url?.trim());
      return sanitizeImage(found?.url || found, fallback);
    };

    const sanitizeProducts = (prods = []) =>
      prods.map(p => ({
        ...p,
        image: getFirstImage(p.images, DEFAULTS.PRODUCT_IMAGE),
        sizes: p.sizes || ['Free Size'],
        colors: p.colors || ['Other'],
        brand: p.brand || 'No Brand',
        ratings: p.ratings || { average: 0, count: 0 },
        category: p.category || { _id: 'unknown', name: 'Unknown' },
        gender: p.gender || 'Unisex',
        fit: p.fit || 'Regular',
        isReturnable: p.isReturnable ?? true,
        returnPeriod: p.returnPeriod || 7,
        isCashOnDeliveryAvailable: p.isCashOnDeliveryAvailable ?? true,
        onlinePaymentPercentage: p.onlinePaymentPercentage || 100,
        dimensions: p.dimensions || {},
        weight: p.weight || 0,
      }));

    // Fetch all core data in parallel
    const [layout, products, comboOffersRaw, categories, sellers, sponsoredRaw, adminAds, trendingRaw, userData] = await Promise.all([
      Layout.findOne().sort({ updatedAt: -1 }).select('components').lean(),
      Product.find({ status: 'enabled', quantity: { $gt: 0 } }).limit(limit).skip(skip).select('-__v').populate(['category', 'sellerId']).lean(),
      ComboOffer.find({ isActive: true }).limit(3).populate({
        path: 'products',
        match: { status: 'enabled', quantity: { $gt: 0 } },
        populate: ['category', 'sellerId']
      }).lean(),
      Category.find().limit(8).lean(),
      Seller.find().limit(5).lean(),
      SponsoredProduct.find().limit(5).populate({
        path: 'productId',
        match: { status: 'enabled', quantity: { $gt: 0 } },
        populate: ['category', 'sellerId']
      }).lean(),
      Admin.findOne().lean(),
      Product.find({ viewCount: { $gt: 100 }, status: 'enabled', quantity: { $gt: 0 } }).sort({ viewCount: -1 }).limit(5).populate(['category', 'sellerId']).lean(),
      userId ? User.findById(userId).select('recentSearches recentlyViewed').lean() : { recentSearches: [], recentlyViewed: [] },
    ]);

    // Sanitize combo offers
    console.log('ðŸ§ª Raw Combo Offers:', comboOffersRaw.length);
    const comboOffers = comboOffersRaw.filter(o => {
      const valid = o.products?.length >= 2;
      if (!valid) console.log('âŒ Skipped combo (less than 2 valid products):', o._id);
      return valid;
    }).map(o => ({
      ...o,
      image: getFirstImage(o.images, getFirstImage(o.products?.[0]?.images, DEFAULTS.COMBO_IMAGE)),
      products: sanitizeProducts(o.products),
    }));
    console.log('âœ… Final sanitized comboOffers:', comboOffers.length);

    // Sanitize ads with corrected casing
    const ads = ['singleadd', 'doubleadd', 'tripleadd'].map(type => ({
      type: type.charAt(0).toUpperCase() + type.slice(1).replace('add', ' Ad'),
      images: (adminAds?.[type]?.images || []).filter(i => i?.url?.trim()).map(i => ({
        ...i,
        url: sanitizeImage(i.url, DEFAULTS.AD_IMAGE)
      }))
    }));
    console.log('ðŸª§ Ads processed:', ads.map(a => `${a.type}: ${a.images.length}`));

    const banner = {
      url: sanitizeImage(adminAds?.singleadd?.images?.find(i => i?.url?.trim())?.url, DEFAULTS.BANNER_IMAGE)
    };

    const allCats = await Category.find().lean().select('_id');
    const catProds = await Promise.all(allCats.map(cat =>
      Product.find({ category: cat._id, status: 'enabled', quantity: { $gt: 0 } })
        .limit(10).select('-__v').populate(['category', 'sellerId']).lean()
        .then(prods => ({ [cat._id]: prods }))
    ));
    const categoryProductsMap = Object.assign({}, ...catProds);

    // recentlyViewed is stored as [{ productId, viewedAt }]. $in needs bare ids, and the
    // documents have to be re-ordered by recency afterwards because MongoDB returns
    // $in results in natural order, not in the order the ids were supplied.
    const recentIds = (userData.recentlyViewed || [])
      .map((rv) => (rv && rv.productId ? rv.productId : rv))
      .filter(Boolean)
      .slice(0, 10);

    const recentDocs = recentIds.length
      ? await Product.find({ _id: { $in: recentIds } }).populate(['category', 'sellerId']).lean()
      : [];

    const byId = new Map(recentDocs.map((p) => [String(p._id), p]));
    const recentlyViewed = recentIds
      .map((id) => byId.get(String(id)))
      .filter(Boolean);

    const searches = await User.aggregate([
      { $match: { _id: userId } }, // Never aggregate another user's search history
      { $unwind: '$recentSearches' },
      { $match: { recentSearches: { $ne: '' } } },
      { $group: { _id: '$recentSearches', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, query: '$_id' } },
    ]);

    const trendingProducts = sanitizeProducts(trendingRaw);
    const sponsoredProducts = sanitizeProducts(sponsoredRaw.map(sp => sp.productId).filter(Boolean));
    const topProducts = await Product.find({ status: 'enabled', quantity: { $gt: 0 } }).sort({ viewCount: -1 }).limit(3).populate(['category', 'sellerId']).lean();

    // The home page reads the cart out of the shared DataProvider cache, which is filled
    // from this one response. Serve it here (only for a signed-in caller) so CartSection
    // has something to render instead of an always-empty cache key.
    const cartItems = userId
      ? (
          await User.findById(userId)
            .select('cart')
            .populate('cart.productId')
            .lean()
        )?.cart?.filter((item) => item.productId)
          .map((item) => ({
            product: item.productId,
            quantity: item.quantity,
            size: item.size,
            color: item.color,
          })) || []
      : [];

    return res.json({
      layout: { components: layout?.components || [] },
      products: sanitizeProducts(products),
      comboOffers,
      categories: categories.map(c => ({ ...c, icon: sanitizeImage(c.icon, DEFAULTS.CATEGORY_ICON) })),
      sellers: sellers.map(s => ({ ...s, profilePicture: sanitizeImage(s.profilePicture, DEFAULTS.PROFILE_PICTURE) })),
      sponsoredProducts,
      trendingProducts,
      recentlyViewed: sanitizeProducts(recentlyViewed),
      cart: cartItems,
      ads,
      tripleAds: ads.filter(a => a.type === 'Triple Ad'),
      banner,
      searchSuggestions: {
        recentSearches: userData.recentSearches?.slice(0, 5) || [],
        categories: categories.slice(0, 3).map(c => ({ ...c, icon: sanitizeImage(c.icon, DEFAULTS.CATEGORY_ICON) })),
        sellers: sellers.slice(0, 3).map(s => ({ ...s, profilePicture: sanitizeImage(s.profilePicture, DEFAULTS.PROFILE_PICTURE) })),
        products: sanitizeProducts(topProducts),
      },
      trendingSearches: {
        trendingSearches: searches.map(s => s.query),
        topSellers: sellers.slice(0, 3).map(s => ({ ...s, profilePicture: sanitizeImage(s.profilePicture, DEFAULTS.PROFILE_PICTURE) })),
        topCategories: categories.slice(0, 3).map(c => ({ ...c, icon: sanitizeImage(c.icon, DEFAULTS.CATEGORY_ICON) })),
        topProducts: sanitizeProducts(topProducts),
      },
      categoryProducts: Object.fromEntries(
        Object.entries(categoryProductsMap).map(([catId, prods]) => [catId, sanitizeProducts(prods)])
      ),
    });
  } catch (err) {
    console.error('Initial data fetch error:', err);
    return res.status(500).json({ error: 'Failed to load data', details: err.message });
  }
});

module.exports = router;
