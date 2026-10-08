import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from '../selleraxios';
import toast from 'react-hot-toast';
import { FaUpload, FaTimes } from 'react-icons/fa';
import PropTypes from 'prop-types';

const ProductForm = ({ editingProduct, setProducts, categories, onClose }) => {
  const [productForm, setProductForm] = useState({
    name: editingProduct?.name || '',
    category: editingProduct?.category?._id || '',
    quantity: editingProduct?.quantity || '',
    price: editingProduct?.price || '',
    discount: editingProduct?.discount || 0,
    discountPercentage: editingProduct?.discountPercentage || 0,
    description: editingProduct?.description || '',
    images: [],
    sizes: editingProduct?.sizes || [],
    colors: editingProduct?.colors || [],
    material: editingProduct?.material || '',
    gender: editingProduct?.gender || '',
    brand: editingProduct?.brand || '',
    fit: editingProduct?.fit || '',
    careInstructions: editingProduct?.careInstructions || '',
    isReturnable: editingProduct?.isReturnable || false,
    returnPeriod: editingProduct?.returnPeriod || 0,
    dimensions: editingProduct?.dimensions || { chest: '', length: '', sleeve: '' },
    weight: editingProduct?.weight || '',
    isCashOnDeliveryAvailable: editingProduct?.isCashOnDeliveryAvailable || false,
    onlinePaymentPercentage: editingProduct?.onlinePaymentPercentage || 100,
  });
  const [imagePreviews, setImagePreviews] = useState(
    Array.isArray(editingProduct?.images) ? editingProduct.images : []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const productImageInputRef = useRef(null);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => typeof preview === 'string' || URL.revokeObjectURL(preview));
    };
  }, [imagePreviews]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('dimensions.')) {
      const dimField = name.split('.')[1];
      setProductForm((prev) => ({
        ...prev,
        dimensions: { ...prev.dimensions, [dimField]: value },
      }));
    } else {
      setProductForm((prev) => {
        let newState = { ...prev, [name]: type === 'checkbox' ? checked : value };
        if (name === 'isCashOnDeliveryAvailable') {
          newState.onlinePaymentPercentage = checked ? 0 : 100;
        }
        if (name === 'discount' && value > 0) {
          newState.discountPercentage = 0;
        }
        if (name === 'discountPercentage' && value > 0) {
          newState.discount = 0;
        }
        return newState;
      });
    }
  };

  const handleMultiSelectChange = (e, field) => {
    const options = Array.from(e.target.selectedOptions, (option) => option.value);
    setProductForm((prev) => ({ ...prev, [field]: options }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/jpg', 'image/avif', 'image/webp'].includes(file.type))) {
      toast.error('Only JPEG, PNG, JPG, AVIF, or WebP files allowed');
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    const updatedImages = [...productForm.images, ...files];
    setProductForm((prev) => ({ ...prev, images: updatedImages }));
    setImagePreviews(updatedImages.map((f) => (typeof f === 'string' ? f : URL.createObjectURL(f))));
  };

  const removeImage = (index) => {
    const updatedImages = productForm.images.filter((_, i) => i !== index);
    const updatedPreviews = imagePreviews.filter((_, i) => i !== index);
    setProductForm((prev) => ({ ...prev, images: updatedImages }));
    setImagePreviews(updatedPreviews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const requiredFields = [
      'name',
      'category',
      'quantity',
      'price',
      'description',
      'sizes',
      'colors',
      'material',
      'gender',
      'brand',
      'fit',
      'careInstructions',
    ];
    if (
      requiredFields.some(
        (field) =>
          !productForm[field] || (Array.isArray(productForm[field]) && productForm[field].length === 0)
      )
    ) {
      toast.error('All required fields must be filled');
      return;
    }
    if (!productForm.category) {
      toast.error('Please select a valid category');
      return;
    }
    if (productForm.isReturnable && (!productForm.returnPeriod || productForm.returnPeriod <= 0)) {
      toast.error('Return period must be greater than 0');
      return;
    }
    if (!editingProduct && productForm.images.length === 0) {
      toast.error('At least one image is required');
      return;
    }
    if (productForm.onlinePaymentPercentage < 0 || productForm.onlinePaymentPercentage > 100) {
      toast.error('Online payment percentage must be between 0 and 100');
      return;
    }
    if (!productForm.isCashOnDeliveryAvailable && productForm.onlinePaymentPercentage !== 100) {
      toast.error('Online payment percentage must be 100 if COD is not available');
      return;
    }
    if (productForm.discount < 0) {
      toast.error('Discount cannot be negative');
      return;
    }
    if (productForm.discount > productForm.price) {
      toast.error('Discount cannot exceed the product price');
      return;
    }
    if (productForm.discountPercentage < 0 || productForm.discountPercentage > 100) {
      toast.error('Discount percentage must be between 0 and 100');
      return;
    }
    if (productForm.discount > 0 && productForm.discountPercentage > 0) {
      toast.error('Cannot apply both fixed discount and percentage discount');
      return;
    }

    const formData = new FormData();
    Object.entries(productForm).forEach(([key, value]) => {
      if (key === 'images') value.forEach((file) => formData.append('images', file));
      else if (key === 'sizes' || key === 'colors') formData.append(key, JSON.stringify(value));
      else if (key === 'dimensions') formData.append(key, JSON.stringify(value));
      else formData.append(key, value);
    });

    try {
      setIsSubmitting(true);
      const url = editingProduct
        ? `/api/seller/auth/products/${editingProduct._id}`
        : '/api/seller/auth/products';
      const method = editingProduct ? 'put' : 'post';
      const response = await axios[method](url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setProducts((prev) =>
        editingProduct
          ? prev.map((p) => (p._id === editingProduct._id ? response.data.data.product : p))
          : [...prev, response.data.data.product]
      );
      toast.success(editingProduct ? 'Product updated successfully' : 'Product added successfully');
      onClose();
    } catch {
      toast.error(editingProduct ? 'Failed to update product' : 'Failed to add product');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!Array.isArray(categories) || categories.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-blue-50 p-6 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-6">
            {editingProduct ? 'Edit Product' : 'Add Product'}
          </h2>
          <p className="text-red-600">Error: No categories available. Please try again later.</p>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            className="mt-4 bg-gray-200 text-gray-700 px-6 py-2 rounded-xl hover:bg-gray-300 transition-all duration-200 shadow-sm"
            aria-label="Cancel"
          >
            Close
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-blue-50 p-6 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-6">
          {editingProduct ? 'Edit Product' : 'Add Product'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input
              type="text"
              name="name"
              value={productForm.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              required
              aria-label="Product name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              name="category"
              value={productForm.category}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              required
              aria-label="Product category"
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={productForm.quantity}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                min="0"
                required
                aria-label="Product quantity"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
              <input
                type="number"
                name="price"
                value={productForm.price}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                min="0"
                step="0.01"
                required
                aria-label="Product price"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Discount (₹)</label>
              <input
                type="number"
                name="discount"
                value={productForm.discount}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                min="0"
                step="0.01"
                aria-label="Fixed discount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Percentage (%)</label>
              <input
                type="number"
                name="discountPercentage"
                value={productForm.discountPercentage}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                min="0"
                max="100"
                step="0.1"
                aria-label="Discount percentage"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              name="description"
              value={productForm.description}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              rows="3"
              required
              aria-label="Product description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sizes *</label>
            <select
              multiple
              name="sizes"
              value={productForm.sizes}
              onChange={(e) => handleMultiSelectChange(e, 'sizes')}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              required
              aria-label="Product sizes"
            >
              {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size', 'Custom'].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Colors *</label>
            <select
              multiple
              name="colors"
              value={productForm.colors}
              onChange={(e) => handleMultiSelectChange(e, 'colors')}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              required
              aria-label="Product colors"
            >
              {['Red', 'Blue', 'Green', 'Black', 'White', 'Yellow', 'Gray', 'Other'].map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
            <select
              name="material"
              value={productForm.material}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              required
              aria-label="Product material"
            >
              <option value="">Select Material</option>
              {['Cotton', 'Polyester', 'Wool', 'Silk', 'Linen', 'Denim', 'Leather', 'Rayon', 'Nylon', 'Spandex', 'Blend', 'Other'].map(
                (mat) => (
                  <option key={mat} value={mat}>
                    {mat}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
            <select
              name="gender"
              value={productForm.gender}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              required
              aria-label="Product gender"
            >
              <option value="">Select Gender</option>
              {['Men', 'Women', 'Unisex', 'Kids'].map((gen) => (
                <option key={gen} value={gen}>
                  {gen}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
            <input
              type="text"
              name="brand"
              value={productForm.brand}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              required
              aria-label="Product brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fit *</label>
            <select
              name="fit"
              value={productForm.fit}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              required
              aria-label="Product fit"
            >
              <option value="">Select Fit</option>
              {['Regular', 'Slim', 'Loose', 'Tailored', 'Oversized', 'Athletic', 'Relaxed', 'Skinny', 'Custom'].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Care Instructions *</label>
            <textarea
              name="careInstructions"
              value={productForm.careInstructions}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              rows="2"
              required
              aria-label="Product care instructions"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Images (JPEG, PNG, JPG, AVIF, WebP, max 5MB) *
            </label>
            <motion.button
              type="button"
              onClick={() => productImageInputRef.current.click()}
              whileHover={{ scale: 1.05 }}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all duration-200 shadow-sm"
            >
              <FaUpload /> Upload Images
            </motion.button>
            <input
              type="file"
              ref={productImageInputRef}
              multiple
              accept="image/jpeg,image/png,image/jpg,image/avif,image/webp"
              onChange={handleImageChange}
              className="hidden"
            />
            {imagePreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-xl border border-gray-200"
                    />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      aria-label={`Remove image ${idx + 1}`}
                    >
                      <FaTimes />
                    </motion.button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chest (in)</label>
              <input
                type="number"
                name="dimensions.chest"
                value={productForm.dimensions.chest}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                min="0"
                aria-label="Chest dimension"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Length (in)</label>
              <input
                type="number"
                name="dimensions.length"
                value={productForm.dimensions.length}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                min="0"
                aria-label="Length dimension"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sleeve (in)</label>
            <input
              type="number"
              name="dimensions.sleeve"
              value={productForm.dimensions.sleeve}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              min="0"
              aria-label="Sleeve dimension"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (g)</label>
            <input
              type="number"
              name="weight"
              value={productForm.weight}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              min="0"
              aria-label="Product weight"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isReturnable"
              checked={productForm.isReturnable}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-400"
              aria-label="Returnable product"
            />
            <label className="text-sm font-medium text-gray-700">Returnable</label>
          </div>
          {productForm.isReturnable && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Return Period (days) *</label>
              <input
                type="number"
                name="returnPeriod"
                value={productForm.returnPeriod}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                min="1"
                max="30"
                required
                aria-label="Return period"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isCashOnDeliveryAvailable"
              checked={productForm.isCashOnDeliveryAvailable}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-400"
              aria-label="Cash on delivery available"
            />
            <label className="text-sm font-medium text-gray-700">Cash on Delivery Available</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Online Payment Percentage (%)</label>
            <input
              type="number"
              name="onlinePaymentPercentage"
              value={productForm.onlinePaymentPercentage}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
              min="0"
              max="100"
              step="1"
              disabled={!productForm.isCashOnDeliveryAvailable}
              aria-label="Minimum online payment percentage"
            />
          </div>
          <div className="flex gap-4 mt-6">
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.05 }}
              className={`bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              aria-label={editingProduct ? 'Update product' : 'Add product'}
            >
              {editingProduct ? 'Update' : 'Add'}
            </motion.button>
            <motion.button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              whileHover={{ scale: 1.05 }}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-xl hover:bg-gray-300 transition-all duration-200 shadow-sm"
              aria-label="Cancel"
            >
              Cancel
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

ProductForm.propTypes = {
  editingProduct: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    category: PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string,
    }),
    quantity: PropTypes.number,
    price: PropTypes.number,
    discount: PropTypes.number,
    discountPercentage: PropTypes.number,
    description: PropTypes.string,
    images: PropTypes.arrayOf(PropTypes.string),
    sizes: PropTypes.arrayOf(PropTypes.string),
    colors: PropTypes.arrayOf(PropTypes.string),
    material: PropTypes.string,
    gender: PropTypes.string,
    brand: PropTypes.string,
    fit: PropTypes.string,
    careInstructions: PropTypes.string,
    isReturnable: PropTypes.bool,
    returnPeriod: PropTypes.number,
    dimensions: PropTypes.shape({
      chest: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      length: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      sleeve: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
    weight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    isCashOnDeliveryAvailable: PropTypes.bool,
    onlinePaymentPercentage: PropTypes.number,
  }),
  setProducts: PropTypes.func.isRequired,
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    })
  ).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ProductForm;