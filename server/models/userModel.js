const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number'],
      required: [true, 'Phone number is required'],
      trim: true,
      unique: true,
    },
    email: {
      trim: true,
      unique: true,
      sparse: true,
      type: String,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    dateOfBirth: { type: Date, default: null },
    lastName: { type: String, trim: true },
    profilePicture: { type: String, trim: true },
    firstName: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: [500, 'Bio cannot exceed 500 characters'] },
    role: {
      type: String,
      enum: ['user', 'seller', 'admin'],
      default: 'user',
      required: true,
    },
    addresses: [
      {
        postalCode: { type: String, trim: true, required: true },
        country: { type: String, trim: true, default: 'India' },
        street: { type: String, trim: true, required: true },
        city: { type: String, trim: true, required: true },
        state: { type: String, trim: true, required: true },
      },
    ],
    cart: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
          min: [1, 'Quantity must be at least 1'],
        },
        size: {
          type: String,
          required: true,
          trim: true,
        },
        color: {
          type: String,
          required: true,
          trim: true,
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    wishlist: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    savedForLater: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
          min: [1, 'Quantity must be at least 1'],
        },
        size: {
          type: String,
          required: true,
          trim: true,
        },
        color: {
          type: String,
          required: true,
          trim: true,
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    recentSearches: [
      {
        type: String,
        trim: true,
        maxlength: [100, 'Search query cannot exceed 100 characters'],
      },
    ],
    recentlyViewed: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    preferences: {
      notifications: { type: Boolean, default: true },
      preferredCategories: [{ type: String }],
    },
    lastLogin: { type: Date, default: null },
    verificationToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    accountLockedUntil: { type: Date },
  },
  { timestamps: true }
);

// Pre-save hook to update `updatedAt` and log cart/savedForLater for debugging
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  console.log('Cart before save:', JSON.stringify(this.cart));
  console.log('Saved for later before save:', JSON.stringify(this.savedForLater));
  next();
});

// Methods
userSchema.methods.generateVerificationToken = function () {
  this.verificationToken = crypto.randomBytes(32).toString('hex');
  return this.verificationToken;
};

userSchema.methods.toggleWishlist = async function (productId) {
  const existingIndex = this.wishlist.findIndex(
    (item) => item.productId.toString() === productId.toString()
  );
  if (existingIndex >= 0) {
    this.wishlist.splice(existingIndex, 1);
  } else {
    this.wishlist.push({ productId, addedAt: new Date() });
  }
  return await this.save();
};

userSchema.methods.updateCart = async function (cartItem) {
  const { productId, quantity, size, color } = cartItem;
  if (!productId || !quantity || !size || !color) {
    throw new Error('Missing required cart fields: productId, quantity, size, or color');
  }

  const existingItem = this.cart.find(
    (item) =>
      item.productId.toString() === productId.toString() &&
      item.size === size &&
      item.color === color
  );

  if (existingItem) {
    existingItem.quantity = quantity; // Overwrite quantity
    existingItem.addedAt = new Date();
  } else {
    this.cart.push({ productId, quantity, size, color, addedAt: new Date() });
  }
  return await this.save();
};

userSchema.methods.updateSavedForLater = async function (cartItem) {
  const { productId, quantity, size, color } = cartItem;
  if (!productId || !quantity || !size || !color) {
    throw new Error('Missing required saved for later fields: productId, quantity, size, or color');
  }

  const existingItem = this.savedForLater.find(
    (item) =>
      item.productId.toString() === productId.toString() &&
      item.size === size &&
      item.color === color
  );

  if (existingItem) {
    existingItem.quantity = quantity; // Overwrite quantity
    existingItem.addedAt = new Date();
  } else {
    this.savedForLater.push({ productId, quantity, size, color, addedAt: new Date() });
  }
  return await this.save();
};

userSchema.methods.removeFromSavedForLater = async function (productId, size, color) {
  this.savedForLater = this.savedForLater.filter(
    (item) =>
      !(
        item.productId.toString() === productId.toString() &&
        item.size === size &&
        item.color === color
      )
  );
  return await this.save();
};

userSchema.methods.clearCart = async function () {
  this.cart = [];
  return await this.save();
};

// Indexes for performance
userSchema.index({ 'recentlyViewed.viewedAt': -1 });
userSchema.index({ 'wishlist.productId': 1 });
userSchema.index({ 'cart.productId': 1 });

module.exports = mongoose.model('User', userSchema);