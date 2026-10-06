// routes/category.js
const express = require('express');
const router = express.Router();
const Category = require('../models/CategoryModel'); // Ensure the path is correct
const Product = require('../models/productModel'); // Ensure the path is correct
const authMiddleware = require('../middleware/auth'); // Authentication middleware
const adminMiddleware = require('../middleware/adminLoggedin'); // Admin middleware
const { uploadSingle } = require('../config/multerConfig'); // Multer config for single file upload
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinaryConfig'); // Cloudinary config
const mongoose = require('mongoose');

// Escape user input before it is used in a RegExp (prevents ReDoS / SyntaxError)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper function to extract Cloudinary public ID from URL (for deletion)
const getCloudinaryPublicId = (url) => {
  if (!url) return null;
  const parts = url.split('/');
  const fileName = parts[parts.length - 1];
  return fileName.split('.')[0]; // Extract the public ID (e.g., "sample" from "sample.jpg")
};

// Get all categories (Accessible to all authenticated users)
router.get('/' , async (req, res) => {
  try {
    const categories = await Category.find().select('name description icon'); // Include icon field
    res.status(200).json({ categories });
  } catch (error) {
    console.error('Fetch Categories Error:', error);
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
});
 
// Search categories by name (must be registered BEFORE /:id or it gets shadowed)
router.get('/search' , async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ message: 'Search query (name) is required' });
  }

  try {
    const categories = await Category.find({
      name: { $regex: escapeRegex(String(name)), $options: 'i' }, // Case-insensitive search
    }).select('name description icon'); // Include icon field
    res.status(200).json({ categories });
  } catch (error) {
    console.error('Search Categories Error:', error);
    res.status(500).json({ message: 'Failed to search categories', error: error.message });
  }
});

// Get a single category by ID (Accessible to all authenticated users)
router.get('/:id' , async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid category ID' });
  }

  try {
    const category = await Category.findById(id).select('name description icon'); // Include icon field
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json({ category });
  } catch (error) {
    console.error('Fetch Category Error:', error);
    res.status(500).json({ message: 'Failed to fetch category', error: error.message });
  }
});

// Get products associated with a category (Accessible to all authenticated users)
router.get('/:id/products' , async (req, res) => {
  const { id } = req.params;

  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const products = await Product.find({ category: id }).populate('sellerId');
    res.status(200).json({ products });
  } catch (error) {
    console.error('Fetch Category Products Error:', error);
    res.status(500).json({ message: 'Failed to fetch products for category', error: error.message });
  }
});

// Add a new category (Admin only)
router.post('/' , adminMiddleware, uploadSingle('icon'), async (req, res) => {
  const { name, description } = req.body;
  const icon = req.file; // The uploaded icon file

  if (!name) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  // Validate icon (required for new categories)
  if (!icon) {
    return res.status(400).json({ message: 'Category icon is required' });
  }

  try {
    // Check if category already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    // Upload icon to Cloudinary
    const uploadResult = await uploadToCloudinary(icon.buffer);
    const iconUrl = uploadResult.url;
    console.log('Cloudinary Icon URL:', iconUrl);

    const category = new Category({
      name,
      description,
      icon: iconUrl,
    });

    await category.save();
    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error('Category Creation Error:', error);
    res.status(500).json({ message: 'Failed to create category', error: error.message });
  }
});

// Update a category (Admin only)
router.put('/:id' , adminMiddleware, uploadSingle('icon'), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const icon = req.file; // The new icon file (if provided)

  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if the new name already exists (and isn't the current category)
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({ message: 'Category name already exists' });
      }
      category.name = name;
    }

    if (description !== undefined) {
      category.description = description;
    }

    // Update icon if a new one is provided
    if (icon) {
      // Delete the old icon from Cloudinary
      if (category.icon) {
        const publicId = getCloudinaryPublicId(category.icon);
        if (publicId) {
          await deleteFromCloudinary(publicId);
          console.log('Deleted old icon from Cloudinary:', publicId);
        }
      }

      // Upload the new icon to Cloudinary
      const uploadResult = await uploadToCloudinary(icon.buffer);
      category.icon = uploadResult.url;
      console.log('Updated Cloudinary Icon URL:', category.icon);
    }

    category.updatedAt = Date.now();
    await category.save();
    res.status(200).json({ message: 'Category updated successfully', category });
  } catch (error) {
    console.error('Category Update Error:', error);
    res.status(500).json({ message: 'Failed to update category', error: error.message });
  }
});

// Bulk delete categories (Admin only) — must be registered BEFORE /:id
router.delete('/bulk' , adminMiddleware, async (req, res) => {
  const { categoryIds } = req.body;

  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    return res.status(400).json({ message: 'An array of category IDs is required' });
  }

  try {
    // Check for associated products for each category
    const categoriesWithProducts = [];
    for (const id of categoryIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid category ID: ${id}` });
      }
      const products = await Product.find({ category: id });
      if (products.length > 0) {
        categoriesWithProducts.push({ id, productCount: products.length });
      }
    }

    if (categoriesWithProducts.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete categories with associated products',
        categoriesWithProducts,
      });
    }

    // Fetch categories to delete their icons from Cloudinary
    const categories = await Category.find({ _id: { $in: categoryIds } });
    for (const category of categories) {
      if (category.icon) {
        const publicId = getCloudinaryPublicId(category.icon);
        if (publicId) {
          await deleteFromCloudinary(publicId);
          console.log('Deleted icon from Cloudinary:', publicId);
        }
      }
    }

    await Category.deleteMany({ _id: { $in: categoryIds } });
    res.status(200).json({ message: 'Categories deleted successfully' });
  } catch (error) {
    console.error('Bulk Category Deletion Error:', error);
    res.status(500).json({ message: 'Failed to delete categories', error: error.message });
  }
});

// Delete a category (Admin only)
router.delete('/:id' , adminMiddleware, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid category ID' });
  }

  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if any products are using this category
    const products = await Product.find({ category: id });
    if (products.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete category with associated products',
        productCount: products.length,
      });
    }

    // Delete the icon from Cloudinary (if it exists)
    if (category.icon) {
      const publicId = getCloudinaryPublicId(category.icon);
      if (publicId) {
        await deleteFromCloudinary(publicId);
        console.log('Deleted icon from Cloudinary:', publicId);
      }
    }

    await Category.findByIdAndDelete(id);
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Category Deletion Error:', error);
    res.status(500).json({ message: 'Failed to delete category', error: error.message });
  }
});

module.exports = router;