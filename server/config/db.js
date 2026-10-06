const mongoose = require('mongoose');

const MAX_ATTEMPTS = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async (attempt = 1) => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set. Exiting.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error(`MongoDB connection failed (attempt ${attempt}/${MAX_ATTEMPTS}):`, error.message);
    if (attempt >= MAX_ATTEMPTS) {
      console.error('Max connection attempts reached. Exiting.');
      process.exit(1);
    }
    await sleep(Math.min(1000 * 2 ** attempt, 30000));
    return connectDB(attempt + 1);
  }
};

module.exports = connectDB;
