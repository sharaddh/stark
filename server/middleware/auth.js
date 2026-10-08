// const jwt = require('jsonwebtoken');
// const Seller = require('../models/sellerModel');

// require('dotenv').config();

// const isSeller = async (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).json({ success: false, message: 'Access token required' });
//   }

//   const token = authHeader.split(' ')[1];

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     const seller = await Seller.findById(decoded.id);
//     if (!seller) {
//       return res.status(404).json({ success: false, message: 'Seller not found' });
//     }

//     req.seller = seller; 
//     next();
//   } catch (error) {
//     console.error("Token verification error:", error);
//     return res.status(403).json({ success: false, message: 'Invalid or expired token' });
//   }
// };

// module.exports = isSeller;

const jwt = require('jsonwebtoken');
const Seller = require('../models/sellerModel');
const { JWT_SECRET } = require('../config/secrets');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const seller = await Seller.findById(decoded.id).select('-password');
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    // An admin-disabled seller must lose API access immediately, not just UI access.
    if (seller.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Seller account is disabled' });
    }
    if (seller.role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Not a seller account' });
    }

    req.seller = { id: seller._id, phoneNumber: seller.phoneNumber }; // Consistent with frontend token usage
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = authenticateToken;