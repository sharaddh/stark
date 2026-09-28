const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number'],
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/,
      'Please provide a valid email',
    ],
  },
  role: { type: String, default: 'admin' },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
    minlength: [6, 'Password must be at least 6 characters'],
  },
  singleadd: {
    images: [{
      url: {
        type: String,
        trim: true,
        match: [/^https:\/\/res\.cloudinary\.com\/.*$/, 'Please provide a valid Cloudinary URL'],
      },
      disabled: {
        type: Boolean,
        default: false,
      },
    }],
  },
  doubleadd: {
    images: [{
      url: {
        type: String,
        trim: true,
        match: [/^https:\/\/res\.cloudinary\.com\/.*$/, 'Please provide a valid Cloudinary URL'],
      },
      disabled: {
        type: Boolean,
        default: false,
      },
    }],
  },
  tripleadd: {
    images: [{
      url: {
        type: String,
        trim: true,
        match: [/^https:\/\/res\.cloudinary\.com\/.*$/, 'Please provide a valid Cloudinary URL'],
      },
      disabled: {
        type: Boolean,
        default: false,
      },
    }],
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
});

adminSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);