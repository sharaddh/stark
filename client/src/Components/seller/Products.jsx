import React, { useState } from 'react';
import { motion } from 'framer-motion';
import axios from '../selleraxios';
import toast from 'react-hot-toast';
import { FaPlus, FaEdit, FaTrash, FaSearch } from 'react-icons/fa';
import ProductForm from './ProductForm';
import PropTypes from 'prop-types';

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const Products = ({ products, setProducts, categories, loading }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await axios.delete(`/api/seller/auth/products/${id}`);
      setProducts(products.filter((p) => p._id !== id));
      toast.success('Product deleted successfully');
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const handleToggleProductStatus = async (id) => {
    try {
      const response = await axios.put(`/api/seller/auth/products/${id}/toggle-status`);
      setProducts(products.map((p) => (p._id === id ? response.data.data.product : p)));
      toast.success(`Product ${response.data.data.product.status} successfully`);
    } catch {
      toast.error('Failed to toggle product status');
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-64">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
            aria-label="Search products"
          />
        </div>
        <motion.button
          onClick={() => {
            setEditingProduct(null);
            setShowProductForm(true);
          }}
          whileHover={{ scale: 1.05 }}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all duration-200 shadow-sm"
          aria-label="Add new product"
        >
          <FaPlus /> Add Product
        </motion.button>
      </div>
      {loading ? (
        <div className="text-center text-gray-600 animate-pulse text-lg">Loading products...</div>
      ) : products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
        <div className="text-center text-gray-600 text-lg">No products found</div>
      ) : (
        products
          .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((product) => (
            <motion.div
              key={product._id}
              variants={fadeIn}
              className="bg-blue-50 p-6 driven-2xl shadow-md hover:shadow-lg transition-all duration-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
              <div className="flex items-center gap-4">
                {product.images[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-xl border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    No Image
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{product.name}</h3>
                  <p className="text-sm text-gray-600">
                    ₹{product.price} | Qty: {product.quantity}
                  </p>
                  <p className="text-sm text-gray-600">
                    {product.category?.name || 'No Category'} | Sizes: {product.sizes.join(', ')} | Colors: {product.colors.join(', ')}
                  </p>
                  <p className="text-sm text-gray-600">
                    Brand: {product.brand} |{' '}
                    <span
                      className={product.status === 'enabled' ? 'text-emerald-600' : 'text-red-600'}
                    >
                      {product.status}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  onClick={() => handleEditProduct(product)}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-all duration-200"
                  aria-label={`Edit product ${product.name}`}
                >
                  <FaEdit />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => handleToggleProductStatus(product._id, product.status)}
                  className={`px-4 py-1 text-sm rounded-xl text-white shadow-sm transition-all duration-200 ${
                    product.status === 'enabled'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                  aria-label={`${product.status === 'enabled' ? 'Disable' : 'Enable'} product`}
                >
                  {product.status === 'enabled' ? 'Disable' : 'Enable'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  onClick={() => handleDeleteProduct(product._id)}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-all duration-200"
                  aria-label={`Delete product ${product.name}`}
                >
                  <FaTrash />
                </motion.button>
              </div>
            </motion.div>
          ))
      )}
      {showProductForm && (
        <ProductForm
          editingProduct={editingProduct}
          setProducts={setProducts}
          categories={categories}
          onClose={() => setShowProductForm(false)}
        />
      )}
    </motion.div>
  );
};

Products.propTypes = {
  products: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      price: PropTypes.number.isRequired,
      quantity: PropTypes.number.isRequired,
      category: PropTypes.shape({
        _id: PropTypes.string,
        name: PropTypes.string,
      }),
      sizes: PropTypes.arrayOf(PropTypes.string).isRequired,
      colors: PropTypes.arrayOf(PropTypes.string).isRequired,
      brand: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      images: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
  setProducts: PropTypes.func.isRequired,
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    })
  ).isRequired,
  loading: PropTypes.bool.isRequired,
};

export default Products;