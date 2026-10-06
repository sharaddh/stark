// // const multer = require('multer');

// // const storage = multer.memoryStorage(); // Store in memory, not disk

// // const upload = multer({
// //   storage,
// //   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
// //   fileFilter: (req, file, cb) => {
// //     if (file.mimetype.startsWith('image/')) {
// //       cb(null, true);
// //     } else {
// //       cb(new Error('Only image files are allowed'), false);
// //     }
// //   },
// // });

// // module.exports = {
// //   uploadSingle: upload.single('image'), 
// // };

// // config/multerConfig.js
// // config/multerConfig.js
// const multer = require('multer');

// // Configure storage (in-memory for Cloudinary upload)
// const storage = multer.memoryStorage();

// // File filter to allow only images
// const fileFilter = (req, file, cb) => {
//   const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
//   if (allowedTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Only JPEG, PNG, and JPG files are allowed'), false);
//   }
// };

// // Multer middleware for single file upload
// const uploadSingle = (fieldName) => {
//   const upload = multer({
//     storage: storage,
//     fileFilter: fileFilter,
//     limits: { fileSize: 5 * 1024 * 1024 }, // Increased to 5MB to match frontend
//   }).single(fieldName);

//   return (req, res, next) => {
// //     if (!req || !req.headers) {
//       console.error('Multer Error: req or req.headers is undefined');
//       return res.status(500).json({ success: false, message: 'Internal server error: Request headers are undefined' });
//     }
//     upload(req, res, (err) => {
//       if (err) {
//         if (err instanceof multer.MulterError) {
//           if (err.code === 'LIMIT_FILE_SIZE') {
//             return res.status(400).json({ success: false, message: 'File size exceeds the 5MB limit' });
//           }
//           return res.status(400).json({ success: false, message: err.message });
//         }
//         return res.status(400).json({ success: false, message: err.message });
//       }
//       next();
//     });
//   };
// };

// module.exports = { uploadSingle };


const multer = require('multer');

// Configure storage (in-memory for Cloudinary upload)
const storage = multer.memoryStorage();

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/avif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, JPG, AVIF, and WebP files are allowed'), false);
  }
};

// Multer middleware for single file upload
const uploadSingle = (fieldName) => {
  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  }).single(fieldName);

  return (req, res, next) => {
    if (!req || !req.headers) {
      console.error('Multer Error: req or req.headers is undefined');
      return res.status(500).json({ success: false, message: 'Internal server error: Request headers are undefined' });
    }
    upload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File size exceeds the 5MB limit' });
          }
          return res.status(400).json({ success: false, message: err.message });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  };
};

// Multer middleware for multiple file uploads
const uploadMultiple = (fieldName, maxCount = 10) => {
  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
  }).array(fieldName, maxCount);

  return (req, res, next) => {
    if (!req || !req.headers) {
      console.error('Multer Error: req or req.headers is undefined');
      return res.status(500).json({ success: false, message: 'Internal server error: Request headers are undefined' });
    }
    upload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File size exceeds the 5MB limit' });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ success: false, message: `Too many files uploaded. Maximum allowed is ${maxCount}` });
          }
          return res.status(400).json({ success: false, message: err.message });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  };
};

module.exports = { uploadSingle, uploadMultiple };