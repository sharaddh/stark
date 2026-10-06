const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');
const Seller = require('../models/sellerModel');
const Product = require('../models/productModel');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Category = require('../models/CategoryModel');
const SponsoredProduct = require('../models/SponsoredProductModel');
const ComboOffer = require('../models/ComboOfferModel');
const Layout = require('../models/layoutModel');
const adminLoggedin = require('../middleware/adminLoggedin');
const multer = require('multer');
const { uploadToCloudinary } = require('../config/cloudinaryConfig');
const mongoose = require('mongoose');
require('dotenv').config();

const { JWT_SECRET } = require('../config/secrets');

// Escape user input before it is used in a RegExp (prevents ReDoS / SyntaxError)
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const { loginLimiter } = require('../middleware/rateLimit');

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, or JPG files allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: 'File upload error', error: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: 'Invalid file type or size', error: err.message });
  }
  next();
};

// Validation middleware
const validateRequiredFields = (fields) => (req, res, next) => {
  const missingFields = fields.filter((field) => {
    if (field === 'images') return !req.files || req.files.length === 0;
    return !req.body[field];
  });
  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missingFields.join(', ')}`,
    });
  }
  next();
};

// Admin Creation — only allowed to bootstrap the very first admin.
// After that, admins must be created by an already-authenticated admin.
const bootstrapOrAdmin = async (req, res, next) => {
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) return next(); // first admin: allow unauthenticated bootstrap

    return adminLoggedin(req, res, next);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

router.post('/create', bootstrapOrAdmin, async (req, res) => {
  try {
    const { phoneNumber, email, name, password } = req.body;
    if (password && String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    if (!phoneNumber || !password || !name) {
      return res.status(400).json({ success: false, message: 'Phone number, name, and password are required' });
    }

    const existingAdmin = await Admin.findOne({ phoneNumber });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }

    const admin = new Admin({ phoneNumber, email, name, password, role: 'admin' });
    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: { id: admin._id, phoneNumber, email, name, role: 'admin' },
    });
  } catch (error) {
    console.error('Admin creation failed:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Admin Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    if (!phoneNumber || !password) {
      return res.status(400).json({ success: false, message: 'Phone number and password are required' });
    }

    const admin = await Admin.findOne({ phoneNumber }).select('+password');
    if (!admin || !(await admin.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, phoneNumber: admin.phoneNumber, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      admin: { id: admin._id, phoneNumber: admin.phoneNumber, name: admin.name, role: 'admin' },
      token,
    });
  } catch (error) {
    console.error('Admin login failed:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Verify Token Endpoint
router.get('/verify-token', adminLoggedin, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      admin: {
        id: req.admin.id,
        phoneNumber: req.admin.phoneNumber,
        role: req.admin.role,
        name: req.admin.name, // Include additional fields if needed
      },
    });
  } catch (error) {
    console.error('Verify token error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get All Sellers
router.get('/sellers', adminLoggedin, async (req, res) => {
  try {
    const sellers = await Seller.find({})
      .populate({ path: 'products', select: 'name price status' })
      .populate({ path: 'orders', select: 'orderId total status' });
    res.status(200).json({ success: true, sellers });
  } catch (error) {
    console.error('Failed to fetch sellers:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch sellers', error: error.message });
  }
});

// Search Sellers
router.get('/sellers/search', adminLoggedin, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const sellers = await Seller.find({
      $or: [
        { name: { $regex: escapeRegex(query), $options: 'i' } },
        { shopName: { $regex: escapeRegex(query), $options: 'i' } },
      ],
    })
      .populate({ path: 'products', select: 'name price status' })
      .populate({ path: 'orders', select: 'orderId total status' });

    res.status(200).json({ success: true, sellers });
  } catch (error) {
    console.error('Search sellers error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to search sellers', error: error.message });
  }
});

// Update Seller
router.put('/sellers/:id', adminLoggedin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, name, shopName, address, email, phoneNumber } = req.body;

    if (status && !['pending', 'enabled', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (name) updateData.name = name.trim();
    if (shopName) updateData.shopName = shopName.trim();
    if (address) updateData.address = address.trim();
    if (email) updateData.email = email.trim();
    if (phoneNumber) updateData.phoneNumber = phoneNumber.trim();

    const seller = await Seller.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    res.status(200).json({ success: true, seller });
  } catch (error) {
    console.error('Failed to update seller:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to update seller', error: error.message });
  }
});

// Delete Seller
router.delete('/sellers/:id', adminLoggedin, async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await Seller.findById(id);
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    await Product.deleteMany({ sellerId: id });
    await Order.deleteMany({ sellerId: id });
    await Seller.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Seller and associated data deleted successfully' });
  } catch (error) {
    console.error('Failed to delete seller:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to delete seller', error: error.message });
  }
});

// Get All Products
router.get('/products', adminLoggedin, async (req, res) => {
  try {
    const products = await Product.find({})
      .populate('sellerId', 'name shopName')
      .populate('category', 'name');
    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('Failed to fetch products:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch products', error: error.message });
  }
});

// Search Products
router.get('/products/search', adminLoggedin, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const products = await Product.find({
      name: { $regex: escapeRegex(query), $options: 'i' },
    })
      .populate('sellerId', 'name shopName')
      .populate('category', 'name');

    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('Search products error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to search products', error: error.message });
  }
});

// Create Product
router.post(
  '/products',
  adminLoggedin,
  upload.array('images', 10),
  handleMulterError,
  validateRequiredFields([
    'name',
    'sellerId',
    'category',
    'quantity',
    'price',
    'description',
    'images',
    'sizes',
    'colors',
    'material',
    'gender',
    'brand',
    'fit',
    'careInstructions',
  ]),
  async (req, res) => {
    const {
      name,
      sellerId,
      category,
      quantity,
      price,
      discount,
      discountPercentage,
      description,
      sizes,
      colors,
      material,
      gender,
      brand,
      fit,
      careInstructions,
      isReturnable,
      returnPeriod,
      dimensions,
      weight,
      isCashOnDeliveryAvailable,
      onlinePaymentPercentage,
    } = req.body;

    try {
      if (!mongoose.Types.ObjectId.isValid(category) || !mongoose.Types.ObjectId.isValid(sellerId)) {
        return res.status(400).json({ success: false, message: 'Invalid category or seller ID' });
      }

      const [categoryDoc, seller] = await Promise.all([
        Category.findById(category),
        Seller.findById(sellerId),
      ]);

      if (!categoryDoc) {
        return res.status(400).json({ success: false, message: 'Category does not exist' });
      }
      if (!seller || seller.status !== 'enabled') {
        return res.status(400).json({ success: false, message: 'Seller is disabled or not found' });
      }

      const parsedQuantity = Number(quantity);
      const parsedPrice = Number(price);
      const parsedDiscount = discount !== undefined ? Number(discount) : 0;
      const parsedDiscountPercentage = discountPercentage !== undefined ? Number(discountPercentage) : 0;
      const parsedReturnPeriod = Number(returnPeriod) || 0;
      const parsedWeight = Number(weight) || 0;
      const parsedOnlinePaymentPercentage = Number(onlinePaymentPercentage) || 100;
      const parsedIsCashOnDeliveryAvailable = isCashOnDeliveryAvailable === 'true' || isCashOnDeliveryAvailable === true;
      const parsedSizes = Array.isArray(sizes) ? sizes : JSON.parse(sizes || '[]');
      const parsedColors = Array.isArray(colors) ? colors : JSON.parse(colors || '[]');
      let parsedDimensions = dimensions ? (typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions) : {};

      if (isNaN(parsedQuantity) || parsedQuantity < 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be a non-negative number' });
      }
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({ success: false, message: 'Price must be a positive number' });
      }
      if (isNaN(parsedDiscount) || parsedDiscount < 0) {
        return res.status(400).json({ success: false, message: 'Discount must be a non-negative number' });
      }
      if (parsedDiscount > parsedPrice) {
        return res.status(400).json({ success: false, message: 'Discount cannot exceed the product price' });
      }
      if (isNaN(parsedDiscountPercentage) || parsedDiscountPercentage < 0 || parsedDiscountPercentage > 100) {
        return res.status(400).json({ success: false, message: 'Discount percentage must be between 0 and 100' });
      }
      if (parsedWeight < 0) {
        return res.status(400).json({ success: false, message: 'Weight cannot be negative' });
      }
      if (parsedSizes.length === 0 || parsedColors.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one size and one color are required' });
      }
      if (
        parsedDimensions.chest &&
        parsedDimensions.chest < 0 ||
        parsedDimensions.length &&
        parsedDimensions.length < 0 ||
        parsedDimensions.sleeve &&
        parsedDimensions.sleeve < 0
      ) {
        return res.status(400).json({ success: false, message: 'Dimensions cannot be negative' });
      }
      if (
        isNaN(parsedOnlinePaymentPercentage) ||
        parsedOnlinePaymentPercentage < 0 ||
        parsedOnlinePaymentPercentage > 100
      ) {
        return res.status(400).json({
          success: false,
          message: 'Online payment percentage must be between 0 and 100',
        });
      }
      if (!parsedIsCashOnDeliveryAvailable && parsedOnlinePaymentPercentage !== 100) {
        return res.status(400).json({
          success: false,
          message: 'Online payment percentage must be 100 if COD is not available',
        });
      }

      const imageUploads = await Promise.all(
        req.files.map((file) => uploadToCloudinary(file.buffer, { folder: 'products', resource_type: 'image' }))
      );
      const imageUrls = imageUploads.map((result) => result.url);

      const isProductReturnable = isReturnable === 'true' || isReturnable === true;
      if (isProductReturnable && (parsedReturnPeriod <= 0 || parsedReturnPeriod > 30)) {
        return res.status(400).json({ success: false, message: 'Return period must be between 1 and 30 days' });
      }

      const product = new Product({
        sellerId,
        name: name.trim(),
        category,
        quantity: parsedQuantity,
        price: parsedPrice,
        discount: parsedDiscount,
        discountPercentage: parsedDiscountPercentage,
        description: description.trim(),
        images: imageUrls,
        sizes: parsedSizes,
        colors: parsedColors,
        material: material.trim(),
        gender,
        brand: brand.trim(),
        fit,
        careInstructions: careInstructions.trim(),
        status: 'enabled',
        isReturnable: isProductReturnable,
        returnPeriod: isProductReturnable ? parsedReturnPeriod : 0,
        dimensions: parsedDimensions.chest ? parsedDimensions : undefined,
        weight: parsedWeight,
        isCashOnDeliveryAvailable: parsedIsCashOnDeliveryAvailable,
        onlinePaymentPercentage: parsedOnlinePaymentPercentage,
        views: 0,
        orders: 0,
      });

      await product.save();
      await Seller.findByIdAndUpdate(sellerId, { $push: { products: product._id } });
      await product.populate('category', 'name').populate('sellerId', 'name shopName');

      res.status(201).json({ success: true, message: 'Product created successfully', product });
    } catch (error) {
      console.error('Product creation error:', { message: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: 'Server error creating product', error: error.message });
    }
  }
);

// Update Product
router.put(
  '/products/:id',
  adminLoggedin,
  upload.array('images', 10),
  handleMulterError,
  async (req, res) => {
    const { id } = req.params;
    const {
      name,
      sellerId,
      category,
      quantity,
      price,
      discount,
      discountPercentage,
      description,
      sizes,
      colors,
      material,
      gender,
      brand,
      fit,
      careInstructions,
      isReturnable,
      returnPeriod,
      status,
      dimensions,
      weight,
      isCashOnDeliveryAvailable,
      onlinePaymentPercentage,
    } = req.body;

    try {
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      if (sellerId && !mongoose.Types.ObjectId.isValid(sellerId)) {
        return res.status(400).json({ success: false, message: 'Invalid seller ID' });
      }
      if (category && !mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ success: false, message: 'Invalid category ID' });
      }

      if (sellerId && sellerId !== product.sellerId.toString()) {
        const seller = await Seller.findById(sellerId);
        if (!seller || seller.status !== 'enabled') {
          return res.status(400).json({ success: false, message: 'Seller is disabled or not found' });
        }
        await Seller.findByIdAndUpdate(product.sellerId, { $pull: { products: id } });
        await Seller.findByIdAndUpdate(sellerId, { $push: { products: id } });
        product.sellerId = sellerId;
      }
      if (category) {
        const categoryDoc = await Category.findById(category);
        if (!categoryDoc) {
          return res.status(400).json({ success: false, message: 'Category does not exist' });
        }
        product.category = category;
      }

      if (name) product.name = name.trim();
      if (description) product.description = description.trim();
      if (material) product.material = material.trim();
      if (gender) product.gender = gender;
      if (brand) product.brand = brand.trim();
      if (fit) product.fit = fit;
      if (careInstructions) product.careInstructions = careInstructions.trim();
      if (status && ['enabled', 'disabled'].includes(status)) product.status = status;

      if (quantity !== undefined) {
        const parsedQuantity = Number(quantity);
        if (isNaN(parsedQuantity) || parsedQuantity < 0) {
          return res.status(400).json({ success: false, message: 'Quantity must be a non-negative number' });
        }
        product.quantity = parsedQuantity;
      }
      if (price !== undefined) {
        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
          return res.status(400).json({ success: false, message: 'Price must be a positive number' });
        }
        product.price = parsedPrice;
      }
      if (discount !== undefined) {
        const parsedDiscount = Number(discount);
        if (isNaN(parsedDiscount) || parsedDiscount < 0) {
          return res.status(400).json({ success: false, message: 'Discount must be a non-negative number' });
        }
        if (parsedDiscount > (price !== undefined ? Number(price) : product.price)) {
          return res.status(400).json({ success: false, message: 'Discount cannot exceed the product price' });
        }
        product.discount = parsedDiscount;
      }
      if (discountPercentage !== undefined) {
        const parsedDiscountPercentage = Number(discountPercentage);
        if (isNaN(parsedDiscountPercentage) || parsedDiscountPercentage < 0 || parsedDiscountPercentage > 100) {
          return res.status(400).json({ success: false, message: 'Discount percentage must be between 0 and 100' });
        }
        product.discountPercentage = parsedDiscountPercentage;
      }
      if (sizes) {
        const parsedSizes = Array.isArray(sizes) ? sizes : JSON.parse(sizes || '[]');
        if (parsedSizes.length === 0) {
          return res.status(400).json({ success: false, message: 'At least one size is required' });
        }
        product.sizes = parsedSizes;
      }
      if (colors) {
        const parsedColors = Array.isArray(colors) ? colors : JSON.parse(colors || '[]');
        if (parsedColors.length === 0) {
          return res.status(400).json({ success: false, message: 'At least one color is required' });
        }
        product.colors = parsedColors;
      }
      if (req.files && req.files.length > 0) {
        const imageUploads = await Promise.all(
          req.files.map((file) => uploadToCloudinary(file.buffer, { folder: 'products', resource_type: 'image' }))
        );
        product.images = imageUploads.map((result) => result.url);
      }
      if (isReturnable !== undefined) {
        const isProductReturnable = isReturnable === 'true' || isReturnable === true;
        const parsedReturnPeriod = Number(returnPeriod) || product.returnPeriod;
        if (isProductReturnable && (parsedReturnPeriod <= 0 || parsedReturnPeriod > 30)) {
          return res.status(400).json({ success: false, message: 'Return period must be between 1 and 30 days' });
        }
        product.isReturnable = isProductReturnable;
        product.returnPeriod = isProductReturnable ? parsedReturnPeriod : 0;
      }
      if (dimensions) {
        const parsedDimensions = typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions;
        if (
          parsedDimensions.chest &&
          parsedDimensions.chest < 0 ||
          parsedDimensions.length &&
          parsedDimensions.length < 0 ||
          parsedDimensions.sleeve &&
          parsedDimensions.sleeve < 0
        ) {
          return res.status(400).json({ success: false, message: 'Dimensions cannot be negative' });
        }
        product.dimensions = parsedDimensions;
      }
      if (weight !== undefined) {
        const parsedWeight = Number(weight);
        if (isNaN(parsedWeight) || parsedWeight < 0) {
          return res.status(400).json({ success: false, message: 'Weight cannot be negative' });
        }
        product.weight = parsedWeight;
      }
      if (isCashOnDeliveryAvailable !== undefined) {
        const parsedIsCashOnDeliveryAvailable = isCashOnDeliveryAvailable === 'true' || isCashOnDeliveryAvailable === true;
        const parsedOnlinePaymentPercentage = Number(onlinePaymentPercentage) || product.onlinePaymentPercentage;
        if (
          isNaN(parsedOnlinePaymentPercentage) ||
          parsedOnlinePaymentPercentage < 0 ||
          parsedOnlinePaymentPercentage > 100
        ) {
          return res.status(400).json({
            success: false,
            message: 'Online payment percentage must be between 0 and 100',
          });
        }
        if (!parsedIsCashOnDeliveryAvailable && parsedOnlinePaymentPercentage !== 100) {
          return res.status(400).json({
            success: false,
            message: 'Online payment percentage must be 100 if COD is not available',
          });
        }
        product.isCashOnDeliveryAvailable = parsedIsCashOnDeliveryAvailable;
        product.onlinePaymentPercentage = parsedOnlinePaymentPercentage;
      }

      await product.save();
      await product.populate('sellerId', 'name shopName').populate('category', 'name');

      res.status(200).json({ success: true, message: 'Product updated successfully', product });
    } catch (error) {
      console.error('Product update error:', { message: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: 'Server error updating product', error: error.message });
    }
  }
);

// Delete Product
router.delete('/products/:id', adminLoggedin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (product.sellerId) {
      await Seller.findByIdAndUpdate(product.sellerId, { $pull: { products: id } });
    }
    await Product.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Failed to delete product:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to delete product', error: error.message });
  }
});

// Get All Orders
router.get('/orders', adminLoggedin, async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('sellerId', 'name shopName')
      .populate('userId', 'firstName email')
      .populate('items.productId', 'name images');
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Failed to fetch orders:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch orders', error: error.message });
  }
});

// Search Orders (must be before /orders/:id-style routes)
router.get('/orders/search', adminLoggedin, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }
    const safe = escapeRegex(query);
    const orders = await Order.find({
      $or: [
        { orderId: { $regex: safe, $options: 'i' } },
        { 'customer.name': { $regex: safe, $options: 'i' } },
        { 'customer.phoneNumber': { $regex: safe, $options: 'i' } },
      ],
    })
      .populate('sellerId', 'name shopName')
      .populate('userId', 'firstName email')
      .populate('items.productId', 'name images')
      .limit(100);
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Search orders error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to search orders', error: error.message });
  }
});

// Update Order Status
router.put('/orders/:id', adminLoggedin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = [
      'order confirmed',
      'processing',
      'shipped',
      'out for delivery',
      'delivered',
      'cancelled',
      'returned',
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    if (status === 'delivered' && order.paymentMethod !== 'Razorpay') {
      order.paymentStatus = 'completed';
    } else if (status === 'cancelled' || status === 'returned') {
      order.paymentStatus = 'failed';
    }

    await order.save();

    if (order.sellerId) {
      const seller = await Seller.findById(order.sellerId);
      const orders = await Order.find({ sellerId: order.sellerId, status: { $ne: 'cancelled' } });
      seller.revenue.total = orders.reduce((acc, o) => acc + (o.total || 0), 0);
      seller.revenue.online = orders.reduce((acc, o) => acc + (o.onlineAmount || 0), 0);
      seller.revenue.cod = orders.reduce((acc, o) => acc + (o.codAmount || 0), 0);
      seller.revenue.pendingCod = orders
        .filter((o) => o.paymentStatus === 'pending' && o.codAmount > 0)
        .reduce((acc, o) => acc + (o.codAmount || 0), 0);
      await seller.save();
    }

    await order
      .populate('sellerId', 'name shopName')
      .populate('userId', 'firstName email')
      .populate('items.productId', 'name images');

    res.status(200).json({ success: true, message: 'Order updated successfully', order });
  } catch (error) {
    console.error('Order update error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error updating order', error: error.message });
  }
});

// Get All Users
router.get('/users', adminLoggedin, async (req, res) => {
  try {
    const users = await User.find({})
      .populate({ path: 'wishlist.productId', select: 'name price' })
      .populate({ path: 'savedForLater.productId', select: 'name price' });
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Failed to fetch users:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
});

// Search Users
router.get('/users/search', adminLoggedin, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const users = await User.find({
      $or: [
        { firstName: { $regex: escapeRegex(query), $options: 'i' } },
        { lastName: { $regex: escapeRegex(query), $options: 'i' } },
        { email: { $regex: escapeRegex(query), $options: 'i' } },
        { phoneNumber: { $regex: escapeRegex(query), $options: 'i' } },
      ],
    })
      .populate({ path: 'wishlist.productId', select: 'name price' })
      .populate({ path: 'savedForLater.productId', select: 'name price' });

    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Search users error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to search users', error: error.message });
  }
});

// Update User
router.put('/users/:id', adminLoggedin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, firstName, lastName, email, phoneNumber, status } = req.body;

    if (role && !['user', 'seller', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role value' });
    }
    if (status && !['approved', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const updateData = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (email) updateData.email = email.trim();
    if (phoneNumber) updateData.phoneNumber = phoneNumber.trim();

    const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Failed to update user:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
});

// Delete User
router.delete('/users/:id', adminLoggedin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await Order.deleteMany({ userId: id });
    await User.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'User and associated data deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
});

// Get Analytics
router.get('/analytics', adminLoggedin, async (req, res) => {
  try {
    const topProducts = await Product.find({})
      .sort({ orders: -1, views: -1 })
      .limit(10)
      .populate('sellerId', 'name shopName')
      .populate('category', 'name');

    const topSellers = await Seller.find({})
      .sort({ 'revenue.total': -1 })
      .limit(10)
      .populate({ path: 'products', select: 'name price' })
      .populate({ path: 'orders', select: 'orderId total status' });

    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
        },
      },
    ]);

    const productStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalViews: { $sum: '$views' },
          totalOrders: { $sum: '$orders' },
          totalProducts: { $sum: 1 },
        },
      },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
      { $unwind: '$category' },
      { $project: { categoryName: '$category.name', totalViews: 1, totalOrders: 1, totalProducts: 1 } },
    ]);

    res.status(200).json({
      success: true,
      analytics: {
        topProducts,
        topSellers,
        orderStats,
        productStats,
      },
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch analytics', error: error.message });
  }
});

// Add Ad Images
router.post(
  '/ads/:type',
  adminLoggedin,
  upload.array('images'),
  handleMulterError,
  validateRequiredFields(['images']),
  async (req, res) => {
    const { type } = req.params;
    const validAdTypes = ['single', 'double', 'triple'];
    if (!validAdTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid ad type. Use single, double, or triple.' });
    }

    try {
      const admin = await Admin.findById(req.admin.id);
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin not found' });
      }

      const imageUploads = await Promise.all(
        req.files.map((file) => uploadToCloudinary(file.buffer, { folder: 'ads', resource_type: 'image' }))
      );
      const imageUrls = imageUploads.map((result) => result.url.replace(/^http:/, 'https:'));

      const urlRegex = /^https:\/\/res\.cloudinary\.com\/.*$/;
      const invalidUrls = imageUrls.filter((url) => !urlRegex.test(url));
      if (invalidUrls.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Cloudinary URLs detected',
          invalidUrls,
        });
      }

      const field = `${type}add`;
      const newImages = imageUrls.map((url) => ({ url, disabled: false }));
      admin[field] = { images: [...(admin[field]?.images || []), ...newImages] };
      await admin.save();

      res.status(201).json({
        success: true,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} ad images added successfully`,
        [field]: admin[field],
      });
    } catch (error) {
      console.error(`Failed to add ${type} ad images:`, { message: error.message, stack: error.stack });
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          message: `Validation failed for ${type} ad images`,
          errors,
        });
      }
      res.status(500).json({
        success: false,
        message: `Server error adding ${type} ad images`,
        error: error.message,
      });
    }
  }
);

// Replace Ad Images
router.put(
  '/ads/:type',
  adminLoggedin,
  upload.array('images'),
  handleMulterError,
  validateRequiredFields(['images']),
  async (req, res) => {
    const { type } = req.params;
    const validAdTypes = ['single', 'double', 'triple'];
    if (!validAdTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid ad type. Use single, double, or triple.' });
    }

    try {
      const admin = await Admin.findById(req.admin.id);
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin not found' });
      }

      const imageUploads = await Promise.all(
        req.files.map((file) => uploadToCloudinary(file.buffer, { folder: 'ads', resource_type: 'image' }))
      );
      const imageUrls = imageUploads.map((result) => result.url.replace(/^http:/, 'https:'));

      const urlRegex = /^https:\/\/res\.cloudinary\.com\/.*$/;
      const invalidUrls = imageUrls.filter((url) => !urlRegex.test(url));
      if (invalidUrls.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Cloudinary URLs detected',
          invalidUrls,
        });
      }

      const field = `${type}add`;
      admin[field] = { images: imageUrls.map((url) => ({ url, disabled: false })) };
      await admin.save();

      res.status(200).json({
        success: true,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} ad images updated successfully`,
        [field]: admin[field],
      });
    } catch (error) {
      console.error(`Failed to update ${type} ad images:`, { message: error.message, stack: error.stack });
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          message: `Validation failed for ${type} ad images`,
          errors,
        });
      }
      res.status(500).json({
        success: false,
        message: `Server error updating ${type} ad images`,
        error: error.message,
      });
    }
  }
);

// Toggle Ad Image Status
router.patch('/ads/:type/image/:index/toggle', adminLoggedin, async (req, res) => {
  const { type, index } = req.params;
  const validAdTypes = ['single', 'double', 'triple'];
  if (!validAdTypes.includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid ad type.' });
  }

  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const field = `${type}add`;
    if (!admin[field]?.images[index]) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    admin[field].images[index].disabled = !admin[field].images[index].disabled;
    await admin.save();

    res.status(200).json({
      success: true,
      message: `Image ${admin[field].images[index].disabled ? 'disabled' : 'enabled'} for ${type} ad`,
      [field]: admin[field],
    });
  } catch (error) {
    console.error(`Failed to toggle ${type} ad image:`, { message: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: `Server error toggling ${type} ad image`,
      error: error.message,
    });
  }
});

// Delete Ad Image
router.delete('/ads/:type/image/:index', adminLoggedin, async (req, res) => {
  const { type, index } = req.params;
  const validAdTypes = ['single', 'double', 'triple'];
  if (!validAdTypes.includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid ad type.' });
  }

  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const field = `${type}add`;
    if (!admin[field]?.images[index]) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    admin[field].images.splice(index, 1);
    await admin.save();

    res.status(200).json({
      success: true,
      message: `Image removed from ${type} ad`,
      [field]: admin[field],
    });
  } catch (error) {
    console.error(`Failed to remove ${type} ad image:`, { message: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: `Server error removing ${type} ad image`,
      error: error.message,
    });
  }
});

// Get All Ad Images
router.get('/ads', async (req, res) => {
  try {
    const admins = await Admin.find().select('singleadd doubleadd tripleadd');
    const ads = admins.reduce((acc, admin) => {
      if (admin.singleadd?.images?.length) acc.push({ type: 'Single Ad', images: admin.singleadd.images });
      if (admin.doubleadd?.images?.length) acc.push({ type: 'Double Ad', images: admin.doubleadd.images });
      if (admin.tripleadd?.images?.length) acc.push({ type: 'Triple Ad', images: admin.tripleadd.images });
      return acc;
    }, []);
    res.status(200).json({ success: true, ads });
  } catch (error) {
    console.error('Failed to fetch ad images:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching ad images', error: error.message });
  }
});

// Toggle Sponsored Status for Product
router.patch('/products/:id/sponsored', adminLoggedin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    product.isSponsored = !product.isSponsored;
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    console.error('Error toggling sponsored status:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add Sponsored Product
router.post('/sponsored', adminLoggedin, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const existing = await SponsoredProduct.findOne({ productId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Product is already sponsored' });
    }

    const sponsoredProduct = new SponsoredProduct({ productId });
    await sponsoredProduct.save();

    res.status(201).json({ success: true, message: 'Product added to sponsored list' });
  } catch (error) {
    console.error('Add Sponsored Product Error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to add sponsored product', error: error.message });
  }
});

// Remove Sponsored Product
router.delete('/sponsored/:productId', adminLoggedin, async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const result = await SponsoredProduct.findOneAndDelete({ productId });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Sponsored product not found' });
    }

    res.status(200).json({ success: true, message: 'Product removed from sponsored list' });
  } catch (error) {
    console.error('Remove Sponsored Product Error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to remove sponsored product', error: error.message });
  }
});

// List Sponsored Products
router.get('/sponsored', async (req, res) => {
  try {
    const sponsoredProducts = await SponsoredProduct.find().populate('productId', 'name price images');
    res.status(200).json({ success: true, products: sponsoredProducts });
  } catch (error) {
    console.error('List Sponsored Products Error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch sponsored products', error: error.message });
  }
});

// Create Combo Offer
router.post('/combo-offers', adminLoggedin, async (req, res) => {
  try {
    const { name, productIds, price, discount, isActive } = req.body;

    if (!name || !productIds || !Array.isArray(productIds) || productIds.length < 1 || !price) {
      return res.status(400).json({ success: false, message: 'Name, at least one product ID, and price are required' });
    }

    const invalidIds = productIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ success: false, message: 'Invalid product IDs provided' });
    }

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      return res.status(404).json({ success: false, message: 'One or more products not found' });
    }

    const comboOffer = new ComboOffer({
      name,
      products: productIds,
      price: Number(price),
      discount: Number(discount) || 0,
      isActive: isActive || false,
    });

    await comboOffer.save();
    res.status(201).json({ success: true, message: 'Combo offer created', comboOffer });
  } catch (error) {
    console.error('Error creating combo offer:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Upload Images for Combo Offer
router.post('/combo-offers/:id/images', adminLoggedin, upload.array('images', 5), handleMulterError, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid combo offer ID' });
    }

    const comboOffer = await ComboOffer.findById(id);
    if (!comboOffer) {
      return res.status(404).json({ success: false, message: 'Combo offer not found' });
    }

    const imageUploads = await Promise.all(
      req.files.map((file) => uploadToCloudinary(file.buffer, { folder: 'combo-offers', resource_type: 'image' }))
    );
    const newImages = imageUploads.map((result) => ({
      url: result.url.replace(/^http:/, 'https:'),
      disabled: false,
    }));

    comboOffer.images.push(...newImages);
    await comboOffer.save();

    res.status(200).json({ success: true, message: 'Images uploaded', comboOffer });
  } catch (error) {
    console.error('Error uploading images:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete Image from Combo Offer
router.delete('/combo-offers/:id/image/:index', adminLoggedin, async (req, res) => {
  try {
    const { id, index } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid combo offer ID' });
    }

    const comboOffer = await ComboOffer.findById(id);
    if (!comboOffer) {
      return res.status(404).json({ success: false, message: 'Combo offer not found' });
    }

    if (index < 0 || index >= comboOffer.images.length) {
      return res.status(400).json({ success: false, message: 'Invalid image index' });
    }

    comboOffer.images.splice(index, 1);
    await comboOffer.save();

    res.status(200).json({ success: true, message: 'Image deleted', comboOffer });
  } catch (error) {
    console.error('Error deleting image:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Toggle Image Disabled Status for Combo Offer
router.patch('/combo-offers/:id/image/:index/toggle', adminLoggedin, async (req, res) => {
  try {
    const { id, index } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid combo offer ID' });
    }

    const comboOffer = await ComboOffer.findById(id);
    if (!comboOffer) {
      return res.status(404).json({ success: false, message: 'Combo offer not found' });
    }

    if (index < 0 || index >= comboOffer.images.length) {
      return res.status(400).json({ success: false, message: 'Invalid image index' });
    }

    comboOffer.images[index].disabled = !comboOffer.images[index].disabled;
    await comboOffer.save();

    res.status(200).json({ success: true, message: 'Image status toggled', comboOffer });
  } catch (error) {
    console.error('Error toggling image:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get All Combo Offers
router.get('/combo-offers', adminLoggedin, async (req, res) => {
  try {
    const comboOffers = await ComboOffer.find().populate('products', 'name price images');
    res.status(200).json({ success: true, comboOffers });
  } catch (error) {
    console.error('Error fetching combo offers:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Active Combo Offers
router.get('/combo-offers/active', async (req, res) => {
  try {
    const comboOffers = await ComboOffer.find({ isActive: true }).populate('products', 'name price images');
    res.status(200).json({ success: true, comboOffers });
  } catch (error) {
    console.error('Error fetching active combo offers:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update Combo Offer
router.put('/combo-offers/:id', adminLoggedin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, productIds, price, discount, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid combo offer ID' });
    }

    if (productIds && (!Array.isArray(productIds) || productIds.length < 1)) {
      return res.status(400).json({ success: false, message: 'At least one product ID is required' });
    }

    if (productIds) {
      const invalidIds = productIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ success: false, message: 'Invalid product IDs provided' });
      }

      const products = await Product.find({ _id: { $in: productIds } });
      if (products.length !== productIds.length) {
        return res.status(404).json({ success: false, message: 'One or more products not found' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (productIds) updateData.products = productIds;
    if (price !== undefined) updateData.price = Number(price);
    if (discount !== undefined) updateData.discount = Number(discount);
    if (isActive !== undefined) updateData.isActive = isActive;

    const comboOffer = await ComboOffer.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!comboOffer) {
      return res.status(404).json({ success: false, message: 'Combo offer not found' });
    }

    res.status(200).json({ success: true, message: 'Combo offer updated', comboOffer });
  } catch (error) {
    console.error('Error updating combo offer:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Search Combo Offers — must be registered BEFORE /combo-offers/:id
router.get('/combo-offers/search', adminLoggedin, async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name query parameter is required' });
    }
    const comboOffers = await ComboOffer.find({
      name: { $regex: escapeRegex(String(name)), $options: 'i' },
    }).populate('products', 'name price images');
    res.status(200).json({ success: true, comboOffers });
  } catch (error) {
    console.error('Error searching combo offers:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Single Combo Offer
router.get('/combo-offers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid combo offer ID' });
    }

    const comboOffer = await ComboOffer.findById(id).populate('products', 'name price images');
    if (!comboOffer) {
      return res.status(404).json({ success: false, message: 'Combo offer not found' });
    }
    res.status(200).json({ success: true, comboOffer });
  } catch (error) {
    console.error('Error fetching combo offer:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Bulk Delete Combo Offers
router.delete('/combo-offers/bulk', adminLoggedin, async (req, res) => {
  try {
    const { comboOfferIds } = req.body;
    if (!comboOfferIds || !Array.isArray(comboOfferIds) || comboOfferIds.length === 0) {
      return res.status(400).json({ success: false, message: 'comboOfferIds array is required' });
    }

    const invalidIds = comboOfferIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ success: false, message: 'Invalid combo offer IDs provided' });
    }

    await ComboOffer.deleteMany({ _id: { $in: comboOfferIds } });
    res.status(200).json({ success: true, message: 'Combo offers deleted successfully' });
  } catch (error) {
    console.error('Error deleting combo offers:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Homepage Layout
router.get('/layout', async (req, res) => {
  try {
    const layout = await Layout.findOne();
    if (!layout) {
      return res.status(200).json({ success: true, components: [] });
    }
    res.status(200).json({ success: true, layout });
  } catch (error) {
    console.error('Error fetching layout:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Error fetching layout', error: error.message });
  }
});

// Save Homepage Layout
router.post('/layout', adminLoggedin, async (req, res) => {
  try {
    const { components } = req.body;
    if (!components || !Array.isArray(components)) {
      return res.status(400).json({ success: false, message: 'Components array is required' });
    }

    let layout = await Layout.findOne();
    if (layout) {
      layout.components = components;
      await layout.save();
    } else {
      layout = new Layout({ components });
      await layout.save();
    }
    res.status(200).json({ success: true, message: 'Layout saved successfully', layout });
  } catch (error) {
    console.error('Error saving layout:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Error saving layout', error: error.message });
  }
});

module.exports = router;