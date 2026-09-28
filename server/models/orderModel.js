const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
    },
    customer: {
      name: { type: String, required: true, trim: true },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/.+\@.+\..+/, 'Please enter a valid email address'],
      },
      phoneNumber: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
        size: { type: String, required: true, trim: true },
        color: { type: String, required: true, trim: true },
        material: { type: String, trim: true },
        gender: { type: String, trim: true },
        brand: { type: String, trim: true },
        fit: { type: String, trim: true },
        careInstructions: { type: String, trim: true },
        dimensions: {
          chest: { type: Number, min: 0 },
          length: { type: Number, min: 0 },
          sleeve: { type: Number, min: 0 },
        },
        weight: { type: Number, min: 0 },
        image: { type: String, trim: true },
        isReturnable: { type: Boolean, default: false },
        returnPeriod: { type: Number, min: 0, default: 0 },
        onlineAmount: { type: Number, min: 0, default: 0 },
        codAmount: { type: Number, min: 0, default: 0 },
      },
    ],
    total: { type: Number, required: true, min: 0 },
    onlineAmount: { type: Number, min: 0, default: 0 },
    codAmount: { type: Number, min: 0, default: 0 },
    shipping: { type: Number, min: 0, default: 0 },
    paymentMethod: {
      type: String,
      enum: ['Razorpay', 'Cash on Delivery', 'Split Payment'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    paymentId: { type: String, trim: true },
    // Whether product stock was actually decremented when this order was created.
    // Cash-on-Delivery orders reserve nothing at creation time, so a cancellation must
    // not add the quantity back -- that inflated stock on every COD cancellation.
    stockDeducted: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['order confirmed', 'processing', 'shipped', 'out for delivery', 'delivered', 'cancelled', 'returned'],
      default: 'order confirmed',
      lowercase: true,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        details: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
);

orderSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  if (!this.statusHistory) this.statusHistory = [];
  if (!this.statusHistory.length || this.statusHistory[this.statusHistory.length - 1].status !== this.status) {
    this.statusHistory.push({ status: this.status, timestamp: Date.now() });
  }

  const calculatedTotal = this.items.reduce(
    (sum, item) => sum + (item.onlineAmount || 0) + (item.codAmount || 0),
    0
  ) + (this.shipping || 0);
  if (this.total !== calculatedTotal) {
    this.total = calculatedTotal;
  }

  this.onlineAmount = this.items.reduce((sum, item) => sum + (item.onlineAmount || 0), 0);
  this.codAmount = this.items.reduce((sum, item) => sum + (item.codAmount || 0), 0);

  next();
});

orderSchema.virtual('calculatedTotal').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0) + (this.shipping || 0);
});

orderSchema.set('toObject', { virtuals: true });
orderSchema.set('toJSON', { virtuals: true });

orderSchema.index({ userId: 1, sellerId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);