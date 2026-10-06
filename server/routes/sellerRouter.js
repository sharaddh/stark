const express = require('express');
const router = express.Router();
const Seller = require('../models/sellerModel');
const Product = require('../models/productModel');
const Category = require('../models/CategoryModel');
const Order = require('../models/orderModel');
const { sendOtp, verifyOtp } = require('../utils/otp');
const jwt = require('jsonwebtoken');
const authenticateToken = require('../middleware/auth');
const { uploadSingle, uploadMultiple } = require('../config/multerConfig');
const { uploadToCloudinary } = require('../config/cloudinaryConfig');
const mongoose = require('mongoose');
const { otpSendLimiter, otpVerifyLimiter, loginLimiter } = require('../middleware/rateLimit');
require('dotenv').config();

// Utility function to generate JWT token
const generateToken = (id, phoneNumber) => {
  return jwt.sign({ id, phoneNumber }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Input validation middleware
const validateRequiredFields = (fields) => (req, res, next) => {
  const missingFields = fields.filter((field) => {
    if (field === 'images') return !req.files || req.files.length === 0;
    if (field === 'profilePicture') return !req.file;
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

// Send OTP
router.post('/send-otp', otpSendLimiter, validateRequiredFields(['phoneNumber']), async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const existingSeller = await Seller.findOne({ phoneNumber });
    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered',
      });
    }

    await sendOtp(phoneNumber);
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    console.error('OTP send error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
      error: error.message,
    });
  }
});

// Register Seller
router.post(
  '/register',
  otpVerifyLimiter,
  uploadSingle('profilePicture'),
  validateRequiredFields(['phoneNumber', 'otp', 'name', 'shopName', 'address', 'password', 'profilePicture']),
  async (req, res) => {
    const { phoneNumber, otp, name, shopName, address, password } = req.body;

    try {
      const isValidOtp = verifyOtp(phoneNumber, otp);
      if (!isValidOtp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP',
        });
      }

      const existingSeller = await Seller.findOne({ phoneNumber });
      if (existingSeller) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered',
        });
      }

      let profilePictureUrl = '';
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: 'seller_profiles',
          resource_type: 'image',
        });
        profilePictureUrl = result.url;
      }

      const seller = new Seller({
        phoneNumber,
        name: name.trim(),
        shopName: shopName.trim(),
        address: address.trim(),
        password,
        role: 'seller',
        profilePicture: profilePictureUrl,
        status: 'pending',
      });

      await seller.save();
      const token = generateToken(seller._id, seller.phoneNumber);

      res.status(201).json({
        success: true,
        message: 'Seller registered successfully',
        data: {
          seller: {
            id: seller._id,
            name: seller.name,
            phoneNumber: seller.phoneNumber,
            role: seller.role,
            profilePicture: seller.profilePicture,
            status: seller.status,
          },
          token,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during registration',
        error: error.message,
      });
    }
  }
);

// Login Seller
router.post('/login', loginLimiter, validateRequiredFields(['phoneNumber', 'password']), async (req, res) => {
  const { phoneNumber, password } = req.body;

  try {
    console.log('Login Attempt:', { phoneNumber, password });
    const seller = await Seller.findOne({ phoneNumber }).select('+password');
    console.log('Seller Found:', seller ? seller.phoneNumber : 'No seller');
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({
        success: false,
        message: 'Seller not found',
      });
    }

    const isMatch = await seller.matchPassword(password);
    console.log('Password Match:', isMatch);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = generateToken(seller._id, seller.phoneNumber);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        seller: {
          id: seller._id,
          name: seller.name,
          phoneNumber: seller.phoneNumber,
          role: seller.role,
          profilePicture: seller.profilePicture,
          status: seller.status,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message,
    });
  }
});

// Get Categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await Category.find().select('name _id');
    res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: { categories },
    });
  } catch (error) {
    console.error('Categories retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving categories',
      error: error.message,
    });
  }
});

// Create Product
router.post(
  '/products',
  authenticateToken,
  uploadMultiple('images', 10),
  validateRequiredFields([
    'name', 'category', 'quantity', 'price', 'description', 'images',
    'sizes', 'colors', 'material', 'gender', 'brand', 'fit', 'careInstructions'
  ]),
  async (req, res) => {
    const {
      name, category, quantity, price, discount, discountPercentage, description,
      sizes, colors, material, gender, brand, fit, careInstructions,
      isReturnable, returnPeriod, dimensions, weight, isCashOnDeliveryAvailable,
      onlinePaymentPercentage
    } = req.body;

    try {
      if (!req.seller?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Seller not authenticated',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID',
        });
      }

      // Parse and validate numeric fields
      const parsedQuantity = Number(quantity);
      const parsedPrice = Number(price);
      const parsedDiscount = discount !== undefined ? Number(discount) : 0;
      const parsedDiscountPercentage = discountPercentage !== undefined ? Number(discountPercentage) : 0;
      const parsedReturnPeriod = Number(returnPeriod) || 0;
      const parsedWeight = weight ? Number(weight) : 0;
      const parsedOnlinePaymentPercentage = onlinePaymentPercentage !== undefined ? Number(onlinePaymentPercentage) : 100;

      // Validate numeric fields
      if (isNaN(parsedQuantity) || parsedQuantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be a non-negative number',
        });
      }
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a positive number',
        });
      }
      if (isNaN(parsedDiscount) || parsedDiscount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Discount must be a non-negative number',
        });
      }
      if (parsedDiscount > parsedPrice) {
        return res.status(400).json({
          success: false,
          message: 'Discount cannot exceed the product price',
        });
      }
      if (isNaN(parsedDiscountPercentage) || parsedDiscountPercentage < 0 || parsedDiscountPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Discount percentage must be between 0 and 100',
        });
      }
      if (isNaN(parsedWeight) || parsedWeight < 0) {
        return res.status(400).json({
          success: false,
          message: 'Weight cannot be negative',
        });
      }
      if (isNaN(parsedOnlinePaymentPercentage) || parsedOnlinePaymentPercentage < 0 || parsedOnlinePaymentPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Online payment percentage must be between 0 and 100',
        });
      }

      const parsedIsCashOnDeliveryAvailable = isCashOnDeliveryAvailable === 'true' || isCashOnDeliveryAvailable === true;
      if (!parsedIsCashOnDeliveryAvailable && parsedOnlinePaymentPercentage !== 100) {
        return res.status(400).json({
          success: false,
          message: 'Online payment percentage must be 100 if COD is not available',
        });
      }

      // Validate sizes and colors
      const parsedSizes = Array.isArray(sizes) ? sizes : JSON.parse(sizes || '[]');
      const parsedColors = Array.isArray(colors) ? colors : JSON.parse(colors || '[]');
      if (parsedSizes.length === 0 || parsedColors.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one size and one color are required',
        });
      }

      // Validate dimensions if provided
      let parsedDimensions = {};
      if (dimensions) {
        parsedDimensions = typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions;
        if (parsedDimensions.chest < 0 || parsedDimensions.length < 0 || parsedDimensions.sleeve < 0) {
          return res.status(400).json({
            success: false,
            message: 'Dimensions cannot be negative',
          });
        }
      }

      // Check category and seller
      const [categoryDoc, seller] = await Promise.all([
        Category.findById(category),
        Seller.findById(req.seller.id),
      ]);

      if (!categoryDoc) {
        return res.status(400).json({
          success: false,
          message: 'Category does not exist',
        });
      }
      if (!seller || seller.status !== 'enabled') {
        return res.status(403).json({
          success: false,
          message: 'Seller account is disabled or not found',
        });
      }

      // Upload images to Cloudinary
      const imageUploads = await Promise.all(
        req.files.map((file) =>
          uploadToCloudinary(file.buffer, { folder: 'products', resource_type: 'image' })
        )
      );
      const imageUrls = imageUploads.map((result) => result.url);

      // Validate return period
      const isProductReturnable = isReturnable === 'true' || isReturnable === true;
      if (isProductReturnable && (parsedReturnPeriod <= 0 || parsedReturnPeriod > 30)) {
        return res.status(400).json({
          success: false,
          message: 'Return period must be between 1 and 30 days for returnable products',
        });
      }

      // Create product
      const product = new Product({
        sellerId: req.seller.id,
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
        weight: parsedWeight || undefined,
        isCashOnDeliveryAvailable: parsedIsCashOnDeliveryAvailable,
        onlinePaymentPercentage: parsedOnlinePaymentPercentage,
      });

      await product.save();
      await product.populate('category', 'name');

      res.status(201).json({
        success: true,
        message: 'Clothing product created successfully',
        data: { product },
      });
    } catch (error) {
      console.error('Product creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error creating product',
        error: error.message,
      });
    }
  }
);

// Get Seller's Products
router.get('/products', authenticateToken, async (req, res) => {
  try {
    if (!req.seller?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Seller not authenticated',
      });
    }

    const products = await Product.find({ sellerId: req.seller.id })
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Clothing products retrieved successfully',
      data: { products },
    });
  } catch (error) {
    console.error('Products retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving products',
      error: error.message,
    });
  }
});

// Update Product
router.put(
  '/products/:id',
  authenticateToken,
  uploadMultiple('images', 10),
  async (req, res) => {
    const { id } = req.params;
    const {
      name, category, quantity, price, discount, discountPercentage, description,
      sizes, colors, material, gender, brand, fit, careInstructions,
      isReturnable, returnPeriod, status, dimensions, weight,
      isCashOnDeliveryAvailable, onlinePaymentPercentage
    } = req.body;

    try {
      if (!req.seller?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Seller not authenticated',
        });
      }

      const product = await Product.findOne({ _id: id, sellerId: req.seller.id });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found or unauthorized',
        });
      }

      // Update fields if provided
      if (name) product.name = name.trim();

      if (category) {
        if (!mongoose.Types.ObjectId.isValid(category)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid category ID',
          });
        }
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
          return res.status(400).json({
            success: false,
            message: 'Category does not exist',
          });
        }
        product.category = category;
      }

      if (quantity !== undefined) {
        const parsedQuantity = Number(quantity);
        if (isNaN(parsedQuantity) || parsedQuantity < 0) {
          return res.status(400).json({
            success: false,
            message: 'Quantity must be a non-negative number',
          });
        }
        product.quantity = parsedQuantity;
      }

      if (price !== undefined) {
        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Price must be a positive number',
          });
        }
        product.price = parsedPrice;
      }

      if (discount !== undefined) {
        const parsedDiscount = Number(discount);
        if (isNaN(parsedDiscount) || parsedDiscount < 0) {
          return res.status(400).json({
            success: false,
            message: 'Discount must be a non-negative number',
          });
        }
        if (parsedDiscount > (price !== undefined ? Number(price) : product.price)) {
          return res.status(400).json({
            success: false,
            message: 'Discount cannot exceed the product price',
          });
        }
        product.discount = parsedDiscount;
      }

      if (discountPercentage !== undefined) {
        const parsedDiscountPercentage = Number(discountPercentage);
        if (isNaN(parsedDiscountPercentage) || parsedDiscountPercentage < 0 || parsedDiscountPercentage > 100) {
          return res.status(400).json({
            success: false,
            message: 'Discount percentage must be between 0 and 100',
          });
        }
        product.discountPercentage = parsedDiscountPercentage;
      }

      if (description !== undefined) product.description = description.trim();

      if (sizes) {
        const parsedSizes = Array.isArray(sizes) ? sizes : JSON.parse(sizes);
        if (parsedSizes.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'At least one size is required',
          });
        }
        product.sizes = parsedSizes;
      }

      if (colors) {
        const parsedColors = Array.isArray(colors) ? colors : JSON.parse(colors);
        if (parsedColors.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'At least one color is required',
          });
        }
        product.colors = parsedColors;
      }

      if (material) product.material = material.trim();
      if (gender) product.gender = gender;
      if (brand) product.brand = brand.trim();
      if (fit) product.fit = fit;
      if (careInstructions) product.careInstructions = careInstructions.trim();

      if (req.files && req.files.length > 0) {
        const imageUploads = await Promise.all(
          req.files.map((file) =>
            uploadToCloudinary(file.buffer, { folder: 'products', resource_type: 'image' })
          )
        );
        product.images = imageUploads.map((result) => result.url);
      }

      if (isReturnable !== undefined) {
        const isProductReturnable = isReturnable === 'true' || isReturnable === true;
        const parsedReturnPeriod = Number(returnPeriod) || product.returnPeriod;
        if (isProductReturnable && (parsedReturnPeriod <= 0 || parsedReturnPeriod > 30)) {
          return res.status(400).json({
            success: false,
            message: 'Return period must be between 1 and 30 days for returnable products',
          });
        }
        product.isReturnable = isProductReturnable;
        product.returnPeriod = isProductReturnable ? parsedReturnPeriod : 0;
      }

      if (status) {
        if (!['enabled', 'disabled'].includes(status)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid status value',
          });
        }
        product.status = status;
      }

      if (dimensions) {
        const parsedDimensions = typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions;
        if (parsedDimensions.chest < 0 || parsedDimensions.length < 0 || parsedDimensions.sleeve < 0) {
          return res.status(400).json({
            success: false,
            message: 'Dimensions cannot be negative',
          });
        }
        product.dimensions = parsedDimensions;
      }

      if (weight !== undefined) {
        const parsedWeight = Number(weight);
        if (isNaN(parsedWeight) || parsedWeight < 0) {
          return res.status(400).json({
            success: false,
            message: 'Weight cannot be negative',
          });
        }
        product.weight = parsedWeight;
      }

      if (isCashOnDeliveryAvailable !== undefined) {
        const parsedIsCashOnDeliveryAvailable = isCashOnDeliveryAvailable === 'true' || isCashOnDeliveryAvailable === true;
        const parsedOnlinePaymentPercentage = onlinePaymentPercentage !== undefined ? Number(onlinePaymentPercentage) : product.onlinePaymentPercentage;

        if (isNaN(parsedOnlinePaymentPercentage) || parsedOnlinePaymentPercentage < 0 || parsedOnlinePaymentPercentage > 100) {
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
      await product.populate('category', 'name');

      res.status(200).json({
        success: true,
        message: 'Clothing product updated successfully',
        data: { product },
      });
    } catch (error) {
      console.error('Product update error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error updating product',
        error: error.message,
      });
    }
  }
);

// Toggle Product Status
router.put('/products/:id/toggle-status', authenticateToken, async (req, res) => {
  try {
    if (!req.seller?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Seller not authenticated',
      });
    }

    const product = await Product.findOne({ _id: req.params.id, sellerId: req.seller.id });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized',
      });
    }

    product.status = product.status === 'enabled' ? 'disabled' : 'enabled';
    await product.save();
    await product.populate('category', 'name');

    res.status(200).json({
      success: true,
      message: `Product ${product.status} successfully`,
      data: { product },
    });
  } catch (error) {
    console.error('Toggle product status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling product status',
      error: error.message,
    });
  }
});

// Delete Product
router.delete('/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    if (!req.seller?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Seller not authenticated',
      });
    }

    const product = await Product.findOneAndDelete({ _id: id, sellerId: req.seller.id });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Product deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting product',
      error: error.message,
    });
  }
});

// Update Seller Profile
router.put('/profile', authenticateToken, uploadSingle('profilePicture'), async (req, res) => {
  try {
    const { name, shopName, phoneNumber, address, paymentId, aadharId, bankAccount, upiId, razorpayAccountId } = req.body;

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (shopName) updateData.shopName = shopName.trim();
    if (phoneNumber) updateData.phoneNumber = phoneNumber.trim();
    if (address) updateData.address = address.trim();
    if (paymentId) updateData.paymentId = paymentId.trim();
    if (aadharId) updateData.aadharId = aadharId.trim();

    if (bankAccount || upiId || razorpayAccountId) {
      updateData.paymentDetails = {};
      if (bankAccount) {
        const parsedBank = typeof bankAccount === 'string' ? JSON.parse(bankAccount) : bankAccount;
        updateData.paymentDetails.bankAccount = {
          accountNumber: parsedBank.accountNumber,
          ifscCode: parsedBank.ifscCode,
          accountHolderName: parsedBank.accountHolderName,
        };
      }
      if (upiId) updateData.paymentDetails.upiId = upiId.trim();
      if (razorpayAccountId) updateData.paymentDetails.razorpayAccountId = razorpayAccountId.trim();
    }

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'seller_profiles',
        resource_type: 'image',
      });
      updateData.profilePicture = result.url;
    }

    const seller = await Seller.findByIdAndUpdate(
      req.seller.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: { seller } });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get Seller Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const seller = await Seller.findById(req.seller.id).select('-password');
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });
    res.status(200).json({ success: true, data: { seller } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Search Products
router.get('/products/search', authenticateToken, async (req, res) => {
  try {
    if (!req.seller?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Seller not authenticated',
      });
    }

    const { name } = req.query;
    const safe = String(name ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const products = await Product.find({
      sellerId: req.seller.id,
      $or: [
        { name: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { brand: { $regex: safe, $options: 'i' } },
      ],
    }).populate('category', 'name');

    res.status(200).json({
      success: true,
      message: 'Clothing products retrieved successfully',
      data: { products },
    });
  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error searching products',
      error: error.message,
    });
  }
});

// Get Seller's Orders
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    if (!req.seller?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Seller not authenticated',
      });
    }

    const orders = await Order.find({ sellerId: req.seller.id }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: { orders },
    });
  } catch (error) {
    console.error('Orders retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving orders',
      error: error.message,
    });
  }
});

// Update Order Status
router.put('/orders/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.seller?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Seller not authenticated',
      });
    }

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
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    const order = await Order.findOne({ _id: req.params.id, sellerId: req.seller.id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or unauthorized',
      });
    }

    order.status = status;
    if (status === 'delivered' && order.paymentMethod !== 'Razorpay') {
      order.paymentStatus = 'completed';
    } else if (status === 'cancelled' || status === 'returned') {
      order.paymentStatus = 'failed';
    }

    await order.save();

    const seller = await Seller.findById(req.seller.id);
    const orders = await Order.find({ sellerId: req.seller.id, status: { $ne: 'cancelled' } });
    seller.revenue.total = orders.reduce((acc, o) => acc + (o.total || 0), 0);
    seller.revenue.online = orders.reduce((acc, o) => acc + (o.onlineAmount || 0), 0);
    seller.revenue.cod = orders.reduce((acc, o) => acc + (o.codAmount || 0), 0);
    seller.revenue.pendingCod = orders
      .filter((o) => o.paymentStatus === 'pending' && o.codAmount > 0)
      .reduce((acc, o) => acc + (o.codAmount || 0), 0);
    await seller.save();

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: { order },
    });
  } catch (error) {
    console.error('Order update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating order',
      error: error.message,
    });
  }
});

// Get Seller Revenue
router.get('/revenue', authenticateToken, async (req, res) => {
  try {
    if (!req.seller?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Seller not authenticated',
      });
    }

    const seller = await Seller.findById(req.seller.id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Revenue retrieved successfully',
      data: {
        totalRevenue: seller.revenue.total,
        onlineRevenue: seller.revenue.online,
        codRevenue: seller.revenue.cod,
        pendingCodRevenue: seller.revenue.pendingCod,
      },
    });
  } catch (error) {
    console.error('Revenue retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving revenue',
      error: error.message,
    });
  }
});

module.exports = router;