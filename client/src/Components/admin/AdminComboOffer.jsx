import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import axios from '../axios';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaCheckSquare, FaSquare, FaImages, FaSpinner, FaEye, FaEyeSlash, FaRedo } from 'react-icons/fa';
import useAdminAuth from '../../hooks/useAdminAuth';

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const AdminComboOffer = ({ comboOffers = [], setComboOffers, products = [], loading: parentLoading }) => {
  const navigate = useNavigate();
  const { isAdmin, error, checkAdmin } = useAdminAuth();
  const [filteredComboOffers, setFilteredComboOffers] = useState(comboOffers);
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [selectedComboOffers, setSelectedComboOffers] = useState([]);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerForm, setOfferForm] = useState({
    name: '',
    productIds: [],
    price: '',
    discount: 0,
    isActive: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState([]);
  const [toggling, setToggling] = useState([]);
  const fileInputRef = useRef(null);

  console.log('ComboOffers prop:', comboOffers);
  console.log('Products prop:', products);

  useEffect(() => {
    setFilteredComboOffers(
      comboOffers.filter((offer) =>
        offer.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [searchQuery, comboOffers]);

  useEffect(() => {
    setFilteredProducts(
      products.filter((product) =>
        product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
      )
    );
  }, [productSearchQuery, products]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const handleOfferFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setOfferForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    console.log('Selected files for combo offer:', files);
    const invalidFiles = files.filter((file) => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast.error('Some files exceed 5MB limit');
      return;
    }
    if (files.length === 0) {
      toast.error('No files selected');
      return;
    }
    setSelectedFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const addProduct = (productId) => {
    if (!offerForm.productIds.includes(productId)) {
      setOfferForm((prev) => ({
        ...prev,
        productIds: [...prev.productIds, productId],
      }));
    }
  };

  const removeProduct = (productId) => {
    setOfferForm((prev) => ({
      ...prev,
      productIds: prev.productIds.filter((id) => id !== productId),
    }));
  };

  const handleOfferSubmit = async (e) => {
    e.preventDefault();
    if (!offerForm.name) {
      toast.error('Offer name is required');
      return;
    }
    if (offerForm.productIds.length < 1) {
      toast.error('At least one product is required');
      return;
    }
    if (!offerForm.price || offerForm.price <= 0) {
      toast.error('Valid price is required');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('adminToken');
      console.log('Submitting combo offer:', offerForm);
      let response;
      if (editingOffer) {
        response = await axios.put(`/api/admin/auth/combo-offers/${editingOffer._id}`, offerForm, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Update response:', response.data);
        setComboOffers(comboOffers.map((offer) => (offer._id === editingOffer._id ? response.data.comboOffer : offer)));
        setFilteredComboOffers(filteredComboOffers.map((offer) => (offer._id === editingOffer._id ? response.data.comboOffer : offer)));
        toast.success('Combo offer updated successfully');
      } else {
        response = await axios.post('/api/admin/auth/combo-offers', offerForm, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Create response:', response.data);
        setComboOffers([...comboOffers, response.data.comboOffer]);
        setFilteredComboOffers([...filteredComboOffers, response.data.comboOffer]);
        toast.success('Combo offer added successfully');
      }

      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((file, index) => {
          formData.append('images', file);
          console.log(`Appending file ${index} for combo offer:`, file.name);
        });
        const imageRes = await axios.post(`/api/admin/auth/combo-offers/${response.data.comboOffer._id}/images`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        console.log('Image upload response:', imageRes.data);
        setComboOffers(comboOffers.map((offer) => (offer._id === response.data.comboOffer._id ? imageRes.data.comboOffer : offer)));
        setFilteredComboOffers(filteredComboOffers.map((offer) => (offer._id === response.data.comboOffer._id ? imageRes.data.comboOffer : offer)));
        toast.success('Images uploaded successfully');
      }

      setOfferForm({ name: '', productIds: [], price: '', discount: 0, isActive: false });
      setSelectedFiles([]);
      setImagePreviews([]);
      setEditingOffer(null);
      setShowOfferForm(false);
    } catch (error) {
      console.error('Error saving combo offer:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error(error.response?.data?.message || 'Failed to save combo offer');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteOffer = async (id) => {
    if (!window.confirm('Are you sure you want to delete this combo offer?')) return;
    try {
      const token = localStorage.getItem('adminToken');
      console.log(`Deleting combo offer ${id}`);
      await axios.delete(`/api/admin/auth/combo-offers/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setComboOffers(comboOffers.filter((offer) => offer._id !== id));
      setFilteredComboOffers(filteredComboOffers.filter((offer) => offer._id !== id));
      setSelectedComboOffers(selectedComboOffers.filter((offerId) => offerId !== id));
      toast.success('Combo offer deleted successfully');
    } catch (error) {
      console.error('Error deleting combo offer:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error(error.response?.data?.message || 'Failed to delete combo offer');
    }
  };

  const handleBulkDeleteOffers = async () => {
    if (selectedComboOffers.length === 0) {
      toast.error('Please select at least one combo offer');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedComboOffers.length} combo offers?`)) return;
    try {
      const token = localStorage.getItem('adminToken');
      console.log('Bulk deleting combo offers:', selectedComboOffers);
      await axios.delete('/api/admin/auth/combo-offers/bulk', {
        headers: { Authorization: `Bearer ${token}` },
        data: { comboOfferIds: selectedComboOffers },
      });
      setComboOffers(comboOffers.filter((offer) => !selectedComboOffers.includes(offer._id)));
      setFilteredComboOffers(filteredComboOffers.filter((offer) => !selectedComboOffers.includes(offer._id)));
      setSelectedComboOffers([]);
      toast.success('Combo offers deleted successfully');
    } catch (error) {
      console.error('Error deleting combo offers:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error(error.response?.data?.message || 'Failed to delete combo offers');
    }
  };

  const handleDeleteImage = async (offerId, index) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    setDeleting((prev) => [...prev, `${offerId}-${index}`]);
    try {
      const token = localStorage.getItem('adminToken');
      console.log(`Deleting image ${index} for combo offer ${offerId}`);
      const res = await axios.delete(`/api/admin/auth/combo-offers/${offerId}/image/${index}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Image delete response:', res.data);
      setComboOffers(comboOffers.map((offer) => (offer._id === offerId ? res.data.comboOffer : offer)));
      setFilteredComboOffers(filteredComboOffers.map((offer) => (offer._id === offerId ? res.data.comboOffer : offer)));
      toast.success('Image deleted');
    } catch (error) {
      console.error('Error deleting image:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error(error.response?.data?.message || 'Failed to delete image');
    } finally {
      setDeleting((prev) => prev.filter((i) => i !== `${offerId}-${index}`));
    }
  };

  const handleToggleImage = async (offerId, index) => {
    setToggling((prev) => [...prev, `${offerId}-${index}`]);
    try {
      const token = localStorage.getItem('adminToken');
      console.log(`Toggling image ${index} for combo offer ${offerId}`);
      const res = await axios.patch(`/api/admin/auth/combo-offers/${offerId}/image/${index}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Image toggle response:', res.data);
      setComboOffers(comboOffers.map((offer) => (offer._id === offerId ? res.data.comboOffer : offer)));
      setFilteredComboOffers(filteredComboOffers.map((offer) => (offer._id === offerId ? res.data.comboOffer : offer)));
      toast.success(`Image ${res.data.comboOffer.images[index].disabled ? 'disabled' : 'enabled'}`);
    } catch (error) {
      console.error('Error toggling image:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error(error.response?.data?.message || 'Failed to toggle image');
    } finally {
      setToggling((prev) => prev.filter((i) => i !== `${offerId}-${index}`));
    }
  };

  const normalizeImageUrl = (image) => {
    if (!image) return null;
    let url = image.url;
    if (!url && typeof image === 'object') {
      url = Object.keys(image)
        .filter((key) => !['disabled', '_id'].includes(key))
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((key) => image[key])
        .join('');
    }
    return url ? url.replace(/^http:/, 'https:') : null;
  };

  const renderComboOffer = (offer) => (
    <motion.div
      key={offer._id}
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      className="bg-white p-6 rounded-2xl shadow-md mb-6"
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => setSelectedComboOffers((prev) =>
              prev.includes(offer._id) ? prev.filter((id) => id !== offer._id) : [...prev, offer._id]
            )}
            className="text-blue-600"
            aria-label={`Select combo offer ${offer.name}`}
          >
            {selectedComboOffers.includes(offer._id) ? <FaCheckSquare /> : <FaSquare />}
          </motion.button>
          <div>
            <h3 className="text-lg font-semibold text-gray-700">{offer.name}</h3>
            <p className="text-sm text-gray-600">Products: {offer.products.map((p) => p.name).join(', ')}</p>
            <p className="text-sm text-gray-600">Price: ${offer.price}</p>
            <p className="text-sm text-gray-600">Discount: {offer.discount}%</p>
            <p className="text-sm text-gray-600">Status: {offer.isActive ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => {
              setEditingOffer(offer);
              setOfferForm({
                name: offer.name,
                productIds: offer.products.map((p) => p._id),
                price: offer.price,
                discount: offer.discount,
                isActive: offer.isActive,
              });
              setSelectedFiles([]);
              setImagePreviews([]);
              setShowOfferForm(true);
            }}
            className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-all duration-200"
            aria-label={`Edit combo offer ${offer.name}`}
          >
            <FaEdit />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => handleDeleteOffer(offer._id)}
            className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-all duration-200"
            aria-label={`Delete combo offer ${offer.name}`}
          >
            <FaTrash />
          </motion.button>
        </div>
      </div>
      {offer.images?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">Images</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {offer.images.map((image, index) => {
              const url = normalizeImageUrl(image);
              if (!url) {
                console.warn(`Invalid image at combo offer ${offer._id}[${index}]:`, image);
                return null;
              }
              return (
                <div key={index} className="relative">
                  <img
                    src={url}
                    alt={`Combo offer ${offer.name} image ${index + 1}`}
                    className={`w-full h-32 object-cover rounded-lg ${image.disabled ? 'opacity-50' : ''}`}
                    loading="lazy"
                    onError={(e) => {
                      console.error(`Failed to load image: ${url}`);
                      e.target.src = 'https://via.placeholder.com/150?text=Image+Not+Found';
                    }}
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      onClick={() => handleToggleImage(offer._id, index)}
                      disabled={toggling.includes(`${offer._id}-${index}`)}
                      className={`p-2 rounded-full text-white ${
                        image.disabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
                      } ${toggling.includes(`${offer._id}-${index}`) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      aria-label={image.disabled ? `Enable image ${index + 1}` : `Disable image ${index + 1}`}
                      title={image.disabled ? 'Enable Image' : 'Disable Image'}
                    >
                      {toggling.includes(`${offer._id}-${index}`) ? (
                        <FaSpinner className="animate-spin" size={14} />
                      ) : image.disabled ? (
                        <FaEye size={14} />
                      ) : (
                        <FaEyeSlash size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteImage(offer._id, index)}
                      disabled={deleting.includes(`${offer._id}-${index}`)}
                      className={`p-2 bg-red-600 text-white rounded-full ${
                        deleting.includes(`${offer._id}-${index}`) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'
                      }`}
                      aria-label={`Delete image ${index + 1}`}
                      title="Delete Image"
                    >
                      {deleting.includes(`${offer._id}-${index}`) ? (
                        <FaSpinner className="animate-spin" size={14} />
                      ) : (
                        <FaTrash size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}
    </motion.div>
  );

  if (!comboOffers || !products) {
    console.error('Invalid props:', { comboOffers, products });
    return <div className="text-red-600 p-6">Error: Invalid combo offer or product data</div>;
  }

  if (parentLoading || isAdmin === null) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-blue-600 text-4xl" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="text-center p-6 bg-red-50 rounded-2xl shadow-md">
        <h3 className="text-lg font-semibold text-red-700">Unable to Access Combo Offers</h3>
        <p className="text-sm text-red-600 mb-4">{error || 'Please try again later.'}</p>
        <div className="flex justify-center gap-4">
          <motion.button
            onClick={checkAdmin}
            whileHover={{ scale: 1.05 }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all duration-200"
          >
            <FaRedo /> Retry
          </motion.button>
          <motion.button
            onClick={() => navigate('/admin/login')}
            whileHover={{ scale: 1.05 }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-300 transition-all duration-200"
          >
            Go to Login
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn}>
      <div className="bg-white p-6 rounded-2xl shadow-md mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!searchQuery.trim()) {
                setFilteredComboOffers(comboOffers);
                return;
              }
              const token = localStorage.getItem('adminToken');
              axios
                .get(`/api/admin/auth/combo-offers/search?name=${encodeURIComponent(searchQuery)}`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                .then((response) => {
                  console.log('Search response:', response.data);
                  setFilteredComboOffers(response.data.comboOffers || []);
                })
                .catch((error) => {
                  console.error('Error searching combo offers:', {
                    message: error.message,
                    status: error.response?.status,
                    data: error.response?.data,
                  });
                  toast.error(error.response?.data?.message || 'Failed to search combo offers');
                });
            }}
            className="flex gap-2 w-full sm:w-auto"
          >
            <div className="relative w-full sm:w-64">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search combo offers..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                aria-label="Search combo offers"
              />
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm"
            >
              Search
            </motion.button>
          </form>
          <div className="flex gap-2">
            <motion.button
              onClick={() => {
                setEditingOffer(null);
                setOfferForm({ name: '', productIds: [], price: '', discount: 0, isActive: false });
                setSelectedFiles([]);
                setImagePreviews([]);
                setShowOfferForm(true);
              }}
              whileHover={{ scale: 1.05 }}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all duration-200 shadow-sm"
              aria-label="Add new combo offer"
            >
              <FaPlus /> Add Combo Offer
            </motion.button>
            <motion.button
              onClick={handleBulkDeleteOffers}
              whileHover={{ scale: 1.05 }}
              className="bg-red-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-red-700 transition-all duration-200 shadow-sm"
              disabled={selectedComboOffers.length === 0}
              aria-label="Delete selected combo offers"
            >
              <FaTrash /> Delete Selected
            </motion.button>
          </div>
        </div>
        {filteredComboOffers.length === 0 ? (
          <p className="text-sm text-gray-500">No combo offers found</p>
        ) : (
          filteredComboOffers.map((offer) => renderComboOffer(offer))
        )}
      </div>
      {showOfferForm && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              {editingOffer ? 'Edit Combo Offer' : 'Add Combo Offer'}
            </h2>
            <form onSubmit={handleOfferSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offer Name *</label>
                <input
                  type="text"
                  name="name"
                  value={offerForm.name}
                  onChange={handleOfferFormChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                  required
                  aria-label="Combo offer name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Products *</label>
                <div className="relative mb-2">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                    aria-label="Search products"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2">
                  {filteredProducts.length === 0 ? (
                    <p className="text-gray-500 text-center">No products found</p>
                  ) : (
                    filteredProducts.map((product) => (
                      <div
                        key={product._id}
                        className="flex items-center justify-between p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => addProduct(product._id)}
                      >
                        <span>{product.name} (${product.price})</span>
                        {offerForm.productIds.includes(product._id) && (
                          <span className="text-green-500">✓</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selected Products</label>
                {offerForm.productIds.length === 0 ? (
                  <p className="text-gray-500">No products selected</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {offerForm.productIds.map((id) => {
                      const product = products.find((p) => p._id === id);
                      return product ? (
                        <div
                          key={id}
                          className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full"
                        >
                          <span>{product.name}</span>
                          <FaTrash
                            className="ml-2 text-red-500 cursor-pointer"
                            onClick={() => removeProduct(id)}
                          />
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bundle Price ($) *</label>
                <input
                  type="number"
                  name="price"
                  value={offerForm.price}
                  onChange={handleOfferFormChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                  min="0"
                  step="0.01"
                  required
                  aria-label="Bundle price"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                <input
                  type="number"
                  name="discount"
                  value={offerForm.discount}
                  onChange={handleOfferFormChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                  min="0"
                  max="100"
                  step="1"
                  aria-label="Discount percentage"
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={offerForm.isActive}
                    onChange={handleOfferFormChange}
                    className="mr-2 h-5 w-5 text-blue-500"
                    aria-label="Activate combo offer"
                  />
                  <span className="text-sm font-medium text-gray-700">Launch Offer (Active)</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Images (JPEG, PNG, JPG, max 5MB)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/jpg"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {imagePreviews.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">{imagePreviews.length} file(s) selected</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {imagePreviews.map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.05 }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
                    uploading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  disabled={uploading}
                  aria-label={editingOffer ? 'Update combo offer' : 'Add combo offer'}
                >
                  {uploading ? <FaSpinner className="animate-spin" /> : (editingOffer ? 'Update' : 'Add')}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setShowOfferForm(false)}
                  whileHover={{ scale: 1.05 }}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all duration-200"
                  aria-label="Cancel"
                >
                  Cancel
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminComboOffer;