// const jwt = require('jsonwebtoken');
// const Admin = require('../models/adminModel');

// const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// const adminLoggedin = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return res.status(401).json({ message: 'Authorization header missing or malformed' });
//     }

//     const token = authHeader.split(' ')[1];
//     const decoded = jwt.verify(token, JWT_SECRET);

//     const admin = await Admin.findById(decoded.id);
//     if (!admin) {
//       return res.status(401).json({ message: 'Admin not found' });
//     }

//     req.admin = decoded; 
//     next();
//   } catch (error) {
//     console.error('Admin authentication failed:', error);
//     return res.status(401).json({ message: 'Invalid or expired token' });
//   }
// };

// module.exports = adminLoggedin;const jwt = require('jsonwebtoken');
// const Admin = require('../models/adminModel');

// const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// const adminLoggedin = async (req, res, next) => {
//   try {
//     // 1️⃣ Check if Authorization Header Exists
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return res.status(401).json({ success: false, message: 'Unauthorized: Token missing or invalid' });
//     }

//     // 2️⃣ Extract the Token
//     const token = authHeader.split(' ')[1];

//     // 3️⃣ Verify the Token
//     let decoded;
//     try {
//       decoded = jwt.verify(token, JWT_SECRET);
//     } catch (error) {
//       console.error('JWT Verification Error:', error);
//       return res.status(401).json({
//         success: false,
//         message: error.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token. Authentication failed.',
//       });
//     }

//     // 4️⃣ Find Admin by Decoded ID
//     const admin = await Admin.findById(decoded.id).select('-password'); // Exclude password for security
//     if (!admin) {
//       return res.status(401).json({ success: false, message: 'Unauthorized: Admin not found or removed' });
//     }

//     // 5️⃣ Attach Admin Data to `req`
//     req.admin = admin;
//     next(); // Proceed to the next middleware

//   } catch (error) {
//     console.error('Admin authentication error:', error);
//     return res.status(500).json({ success: false, message: 'Internal server error during authentication' });
//   }
// };

// module.exports = adminLoggedin;



// adminLoggedin.js (middleware)

const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');
const { JWT_SECRET } = require('../config/secrets');

const adminLoggedin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: No token provided' 
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: error.name === 'TokenExpiredError' 
          ? 'Token expired. Please login again.' 
          : 'Invalid token',
      });
    }

    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin access required'
      });
    }

    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Admin not found' 
      });
    }

    req.admin = {
      id: admin._id,
      phoneNumber: admin.phoneNumber,
      role: 'admin'
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during authentication' 
    });
  }
};

module.exports = adminLoggedin;