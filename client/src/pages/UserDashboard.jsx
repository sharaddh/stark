import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaUser,
  FaSignOutAlt,
  FaShoppingBag,
  FaHeart,
  FaShoppingCart,
  FaQuestionCircle,
  FaCog,
  FaMapMarkerAlt,
  FaCamera,
  FaChevronDown,
  FaTimes,
  FaPlus,
  FaTrash,
} from 'react-icons/fa';
import { isUserLoggedIn, userLogout } from '../utils/authUtils';
import axios from '../useraxios';
import agroLogo from '../assets/profile.png';
import ProductCardSkeleton from '../Components/ProductCardSkeleton';
import { MdArrowBack } from 'react-icons/md';
import { BaggageClaim, ChevronRight, Edit, Edit2, Heart, HeartIcon, HelpCircle, LocateIcon, MapIcon, MapPin, MapPinCheck, Package, Package2, Pointer, Settings, ShoppingCart, Trash, Trash2, User2 } from 'lucide-react';

// Animation Variants
const fadeIn = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } };
const slideIn = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } },
};

const UserDashboard = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    profilePicture: '',
    addresses: [{ street: '', city: '', state: '', postalCode: '', country: 'India', isDefault: false }],
    preferences: { notifications: true, preferredCategories: [] },
  });
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState('all');
  const [showEditProfilePanel, setShowEditProfilePanel] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const loggedIn = isUserLoggedIn();
      setIsAuthenticated(loggedIn);
      if (loggedIn) {
        await fetchUserData();
      }
    };
    checkAuth();
  }, []);

  const fetchUserData = useCallback(async (retryCount = 0) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [profileRes, ordersRes] = await Promise.all([
        axios.get('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/user/orders', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const user = profileRes.data.user;
      const newProfile = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        profilePicture: user.profilePicture || '',
        addresses: user.addresses && user.addresses.length
          ? user.addresses
          : [{ street: '', city: '', state: '', postalCode: '', country: 'India', isDefault: true }],
        preferences: user.preferences || { notifications: true, preferredCategories: [] },
      };
      setProfile(newProfile);
      setProfilePicturePreview(newProfile.profilePicture || null);
      const fetchedOrders = (ordersRes.data.orders || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(fetchedOrders);
      handleOrderFilter(orderFilter, fetchedOrders);
    } catch (error) {
      if (error.response?.status === 401) {
        if (retryCount < 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchUserData(retryCount + 1);
        }
        userLogout(navigate);
        toast.error('Session expired. Please log in again.', {
          style: { background: '#FF4D4F', color: '#FFFFFF', borderRadius: '12px', padding: '12px' },
        });
      } else {
        toast.error(error.response?.data?.message || 'Failed to load data.', {
          style: { background: '#FF4D4F', color: '#FFFFFF', borderRadius: '12px', padding: '12px' },
        });
      }
    } finally {
      setLoading(false);
    }
  }, [orderFilter, navigate]);

  const handleLogout = () => {
    userLogout(navigate);
    toast.success('Logged out successfully!', {
      style: { background: '#FFFFFF', color: '#1F2937', borderRadius: '12px', padding: '12px' },
    });
  };

  const validateAddress = (address) => {
    return address.street && address.city && address.state && address.postalCode && address.country;
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!profile.email.match(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/)) {
      toast.error('Please enter a valid email.', {
        style: { background: '#FF4D4F', color: '#FFFFFF', borderRadius: '12px', padding: '12px' },
      });
      return;
    }

    for (const addr of profile.addresses) {
      if (!validateAddress(addr)) {
        toast.error('All address fields are required.', {
          style: { background: '#FF4D4F', color: '#FFFFFF', borderRadius: '12px', padding: '12px' },
        });
        return;
      }
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('firstName', profile.firstName);
    formData.append('lastName', profile.lastName);
    formData.append('email', profile.email);
    formData.append('addresses', JSON.stringify(profile.addresses));
    formData.append('preferences', JSON.stringify(profile.preferences));
    if (profilePicturePreview instanceof File) {
      formData.append('profilePicture', profilePicturePreview);
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.put('/api/user/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });
      setProfile(prev => ({ ...prev, ...res.data.user }));
      setProfilePicturePreview(res.data.user.profilePicture || null);
      setShowEditProfilePanel(false);
      toast.success('Profile updated successfully!', {
        style: { background: '#FFFFFF', color: '#1F2937', borderRadius: '12px', padding: '12px' },
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile.', {
        style: { background: '#FF4D4F', color: '#FFFFFF', borderRadius: '12px', padding: '12px' },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicturePreview(file);
    }
  };

  const handleAddCurrentLocation = (index) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.', {
        style: { background: '#FF4D4F', color: '#FFFFFF', borderRadius: '12px', padding: '12px' },
      });
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const apiKey = import.meta.env.VITE_OPENCAGE_API_KEY || 'YOUR_OPENCAGE_API_KEY';
          const res = await axios.get(`https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}`);
          const { components } = res.data.results[0];
          const newAddr = {
            street: components.road || 'Unknown Street',
            city: components.city || components.town || 'Unknown City',
            state: components.state || 'Unknown State',
            postalCode: components.postcode || '000000',
            country: components.country || 'India',
            isDefault: profile.addresses.length === 0,
          };
          const newAddresses = [...profile.addresses];
          newAddresses[index] = newAddr;
          setProfile({ ...profile, addresses: newAddresses });
          toast.success('Location fetched successfully! Please save profile.', {
            style: { background: '#FFFFFF', color: '#1F2937', borderRadius: '12px', padding: '12px' },
          });
        } catch {
          toast.error('Failed to fetch location data. Please enter manually.', {
            style: { background: '#FF4D4F', color: '#FFFFFF', borderRadius: '12px', padding: '12px' },
          });
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        toast.error('Unable to retrieve your location. Please allow location access.', {
          style: { background: '#FF4D4F', color: '#FFFFFF', borderRadius: '12px', padding: '12px' },
        });
      }
    );
  };

  const handleOrderFilter = (filter, orderList = orders) => {
    setOrderFilter(filter);
    const filtered = filter === 'all'
      ? orderList
      : orderList.filter(order => order.status.toLowerCase() === filter);
    setFilteredOrders(filtered);
  };

  const renderOrderCard = (order) => {
    const total = order.total || order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const statusColor = order.status.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
    return (
      <motion.div
        key={order._id}
        whileHover={{ scale: 1.02 }}
        className="bg-white rounded-xl p-4 flex items-center gap-4 hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-100"
        onClick={() => navigate(`/order/${order.orderId}`)}
      >
        <img
          src={order.items[0]?.images?.[0] || agroLogo}
          alt={order.items[0]?.name || 'Product'}
          className="w-16 h-16 object-cover rounded-md border border-gray-100"
          onError={(e) => (e.target.src = agroLogo)}
        />
        <div className="flex-1">
          <p className="text-base font-medium text-gray-900">{order.items[0]?.name || 'Unknown Product'}</p>
          <p className="text-xs text-gray-500">Order ID: {order.orderId.slice(0, 10)}...</p>
          <p className="text-xs text-gray-500">Items: {order.items.length}</p>
          <p className="text-xs text-gray-600">Total: ₹{total.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Placed: {new Date(order.createdAt).toLocaleDateString()}</p>
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/order/${order.orderId}`);
          }}
          className="text-pink-600 hover:text-pink-700 text-xs font-medium"
        >
          View
        </button>
      </motion.div>
    );
  };

  const addNewAddress = () => {
    setProfile({
      ...profile,
      addresses: [
        ...profile.addresses,
        { street: '', city: '', state: '', postalCode: '', country: 'India', isDefault: false },
      ],
    });
  };

  const removeAddress = (index) => {
    if (profile.addresses.length === 1) {
      toast.error('At least one address is required.', {
        style: { background: '#FF4D4F', color: '#FFFFFF', borderRadius: '12px', padding: '12px' },
      });
      return;
    }
    const newAddresses = profile.addresses.filter((_, i) => i !== index);
    if (!newAddresses.some(addr => addr.isDefault) && newAddresses.length > 0) {
      newAddresses[0].isDefault = true;
    }
    setProfile({ ...profile, addresses: newAddresses });
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 border-pink-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#FFFFFF', color: '#1F2937', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '12px' },
          success: { style: { background: '#FFFFFF', color: '#1F2937' } },
          error: { style: { background: '#FF4D4F', color: '#FFFFFF' } },
        }}
      />
      <header className="bg-white shadow-sm p-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="text-gray-600"
            >
              <MdArrowBack size={24} />
            </motion.button>
            <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, rotate: 10 }}
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Settings size={25} />
          </motion.button>
        </div>
        {showSettingsMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 right-4 bg-white rounded-xl shadow-lg w-48 z-10 border border-gray-100"
          >
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-xl transition-all duration-200"
            >
              Logout
            </button>
            <button
              onClick={() => navigate('/add-account')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-xl transition-all duration-200"
            >
              Add Another Account
            </button>
          </motion.div>
        )}
      </header>

      <main className="max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-4">
                <div className="w-36">
                  <motion.img
                    src={profile.profilePicture || agroLogo}
                    alt="Profile"
                    className="w-24 h-24 drop-shadow-sm rounded-full object-cover border-2 border-gray-200"
                    onError={(e) => (e.target.src = agroLogo)}
                  />
                </div>
                <div className="flex flex-col w-full">
                  <p className="text-xl font-semibold text-gray-900">{`${profile.firstName} ${profile.lastName}`.trim() || 'User'}</p>
                  <p className="text-sm text-gray-500">{profile.email}</p>
                  <p className="text-sm text-gray-500">{profile.phoneNumber || 'No phone number'}</p>
                  <div
                    className="px-4 drop-shadow-md py-2 w-fit my-2 bg-blue-500 cursor-pointer text-white rounded-xl"
                    onClick={() => setShowEditProfilePanel(true)}
                  >
                    Edit profile
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-3xl drop-shadow-md p-6">
                <p className="text-base font-medium text-gray-900 flex items-center gap-2">
                  <MapPinCheck className="w-6 h-6 text-gray-600" />
                  My Addresses
                </p>
                {profile.addresses && profile.addresses.length > 0 && profile.addresses[0].street ? (
                  <div className="mt-4 space-y-2">
                    {profile.addresses.map((addr, index) => (
                      <div key={index} className="flex gap-2 text-gray-500">
                        <h1>●</h1>
                        <p key={index} className="text-sm text-gray-600 flex items-center gap-2">
                          {`${addr.street}, ${addr.city}, ${addr.state}, ${addr.postalCode}, ${addr.country}`}
                          {addr.isDefault && (
                            <span className="inline-block px-2 py-1 text-xs font-medium text-pink-600 bg-pink-50 rounded-full">
                              Default
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">No addresses provided</p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowEditProfilePanel(true)}
                      className="bg-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-pink-700 transition-all duration-300 flex items-center gap-2"
                    >
                      <FaPlus className="w-4 h-4" /> Add Address
                    </motion.button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4 px-2">
                {[
                  { icon: Package, label: 'Orders', action: () => setShowOrdersModal(true) },
                  { icon: HeartIcon, label: 'Wishlist', action: () => navigate('/wishlist') },
                  { icon: ShoppingCart, label: 'Cart', action: () => navigate('/cart') },
                  { icon: HelpCircle, label: 'Help', action: () => navigate('/help-center') },
                  { icon: User2, label: 'Edit Profile', action: () => setShowEditProfilePanel(true) },
                ].map(({ icon: Icon, label, action }, index) => (
                  <motion.button
                    key={index}
                    whileTap={{ scale: 0.95 }}
                    onClick={action}
                    className=" flex items-center justify-between py-1 text-gray-700 "
                  >
                    <div className="flex items-center justify-center gap-3">
                      <Icon className="w-5 h-5 text-gray-600" />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <ChevronRight className='w-5 h-5 text-gray-600' />
                  </motion.button>
                ))}
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="w-full h-[2px] bg-gray-300 rounded-xl"></div>
                <div className="flex flex-col gap-2">
                  {[
                    { label: 'FAQs', path: '/faq' },
                    { label: 'About Us', path: '/about' },
                    { label: 'Terms of Use', path: '/terms' },
                    { label: 'Privacy Policy', path: '/privacy' },
                  ].map(({ label, path }, index) => (
                    <button
                      key={index}
                      onClick={() => navigate(path)}
                      className="text-sm text-gray-600 flex gap-3 transition-colors duration-200 text-left"
                    >
                      <h1>●</h1>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm">
              <p className="text-lg font-medium text-gray-900 mb-4">Please log in to access your dashboard</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="bg-pink-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-pink-700 transition-all duration-300"
              >
                Login
              </motion.button>
            </div>
          )}
        </motion.div>


        <AnimatePresence>
          {showOrdersModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
                onClick={() => setShowOrdersModal(false)}
              />
              <motion.div
                variants={slideIn}
                initial="initial"
                animate="animate"
                exit="exit"
                className="fixed top-0 right-0 h-full bg-white p-6 shadow-2xl max-w-md w-full z-40 overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <FaShoppingBag className="w-5 h-5 text-pink-600" /> My Orders
                  </h2>
                  <button
                    onClick={() => setShowOrdersModal(false)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <FaTimes className="w-5 h-5" />
                  </button>
                </div>
                <div className="mb-4">
                  <select
                    value={orderFilter}
                    onChange={(e) => handleOrderFilter(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 rounded-lg px-3 py-2 text-sm border border-gray-200 focus:ring-2 focus:ring-pink-600 focus:border-pink-600 outline-none transition-all duration-200"
                  >
                    <option value="all">All Orders</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                {loading ? (
                  <div className="space-y-4">
                    {Array(3).fill().map((_, index) => (
                      <ProductCardSkeleton key={index} />
                    ))}
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <FaShoppingBag className="mx-auto w-12 h-12 text-gray-300" />
                    <p className="text-gray-600 mt-3 text-sm">No orders found</p>
                  </div>
                ) : (
                  <div className="space-y-4">{filteredOrders.map(renderOrderCard)}</div>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowOrdersModal(false)}
                  className="mt-6 w-full bg-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-pink-700 transition-all duration-300"
                >
                  Close
                </motion.button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Edit Profile Panel */}
        <AnimatePresence>
          {showEditProfilePanel && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
                onClick={() => setShowEditProfilePanel(false)}
              />
              <motion.div
                variants={slideIn}
                initial="initial"
                animate="animate"
                exit="exit"
                className="fixed top-0 right-0 h-full bg-white p-6 shadow-2xl max-w-md w-full z-40 overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <FaUser className="w-5 h-5 text-blue-500" /> Edit Profile
                  </h2>
                  <button
                    onClick={() => setShowEditProfilePanel(false)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <FaTimes className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <motion.img
                        src={
                          profilePicturePreview instanceof File
                            ? URL.createObjectURL(profilePicturePreview)
                            : profile.profilePicture || agroLogo
                        }
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-2 border-pink-100"
                        onError={(e) => (e.target.src = agroLogo)}
                        whileHover={{ scale: 1.05 }}
                      />
                      <label
                        htmlFor="profilePicture"
                        className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-all duration-200"
                      >
                        <FaCamera className="w-4 h-4" />
                        <input
                          id="profilePicture"
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePictureChange}
                          className="hidden"
                          disabled={loading}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">First Name</label>
                      <input
                        type="text"
                        value={profile.firstName}
                        onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-600 outline-none transition-all duration-200"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Last Name</label>
                      <input
                        type="text"
                        value={profile.lastName}
                        onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-600 outline-none transition-all duration-200"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-600 outline-none transition-all duration-200"
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Addresses</label>
                    {profile.addresses.map((addr, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3 bg-gray-50 p-4 rounded-lg"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Street"
                            value={addr.street}
                            onChange={(e) => {
                              const newAddresses = [...profile.addresses];
                              newAddresses[index].street = e.target.value;
                              setProfile({ ...profile, addresses: newAddresses });
                            }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-600 outline-none transition-all duration-200"
                            disabled={loading}
                          />
                          <input
                            type="text"
                            placeholder="City"
                            value={addr.city}
                            onChange={(e) => {
                              const newAddresses = [...profile.addresses];
                              newAddresses[index].city = e.target.value;
                              setProfile({ ...profile, addresses: newAddresses });
                            }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-600 outline-none transition-all duration-200"
                            disabled={loading}
                          />
                          <input
                            type="text"
                            placeholder="State"
                            value={addr.state}
                            onChange={(e) => {
                              const newAddresses = [...profile.addresses];
                              newAddresses[index].state = e.target.value;
                              setProfile({ ...profile, addresses: newAddresses });
                            }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-600 outline-none transition-all duration-200"
                            disabled={loading}
                          />
                          <input
                            type="text"
                            placeholder="Postal Code"
                            value={addr.postalCode}
                            onChange={(e) => {
                              const newAddresses = [...profile.addresses];
                              newAddresses[index].postalCode = e.target.value;
                              setProfile({ ...profile, addresses: newAddresses });
                            }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-600 outline-none transition-all duration-200"
                            disabled={loading}
                          />
                          <input
                            type="text"
                            placeholder="Country"
                            value={addr.country}
                            onChange={(e) => {
                              const newAddresses = [...profile.addresses];
                              newAddresses[index].country = e.target.value;
                              setProfile({ ...profile, addresses: newAddresses });
                            }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-600 outline-none transition-all duration-200"
                            disabled={loading}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={addr.isDefault}
                              onChange={(e) => {
                                const newAddresses = profile.addresses.map((a, i) => ({
                                  ...a,
                                  isDefault: i === index ? e.target.checked : false,
                                }));
                                setProfile({ ...profile, addresses: newAddresses });
                              }}
                              className="w-4 h-4 text-pink-600 border-gray-200 rounded focus:ring-pink-600 transition-all duration-200"
                              disabled={loading}
                            />
                            Default
                          </label>
                          {profile.addresses.length > 1 && (
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => removeAddress(index)}
                              className="text-red-600 hover:text-red-700 flex items-center gap-1 text-sm font-medium"
                              disabled={loading}
                            >
                              <Trash2 className="w-4 h-4" /> Remove
                            </motion.button>
                          )}
                        </div>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleAddCurrentLocation(index)}
                          className="text-green-600 font-medium flex items-center gap-1 bg-gray-100 px-3 py-2 rounded-lg transition-all duration-200 w-full"
                          disabled={loading}
                        >
                          <FaMapMarkerAlt className="w-4 h-4" /> Use Current Location
                        </motion.button>
                      </motion.div>
                    ))}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={addNewAddress}
                      className="w-full text-blue-600 font-medium flex items-center justify-center gap-1 bg-gray-100 px-3 py-2 rounded-lg transition-all duration-200"
                      disabled={loading}
                    >
                      <FaPlus className="w-4 h-4" /> Add new Address
                    </motion.button>
                  </div>
                  <div className="flex gap-3">
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={loading}
                      className={`flex-1 py-2 rounded-lg text-white font-medium transition-all duration-200 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 '}`}
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowEditProfilePanel(false)}
                      className="flex-1 py-2 rounded-lg text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default UserDashboard;