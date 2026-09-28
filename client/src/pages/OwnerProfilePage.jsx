import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// useraxios, not '../axios': these are public /api/user/auth/ endpoints. The '../axios'
// instance redirects to /admin/login on any 401/403.
import axios from '../useraxios';
import toast, { Toaster } from 'react-hot-toast';
import ProductCard from '../Components/ProductCard';
import ProductCardSkeleton from '../Components/ProductCardSkeleton';
import SearchBar from '../Components/SearchBar';
import agroLogo from '../assets/logo.png';
import { motion } from 'framer-motion';
import { FaStore, FaEnvelope, FaPhone, FaMapMarkerAlt, FaFilter } from 'react-icons/fa';

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const filterModalVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.3 } },
};

const OwnerProfilePage = () => {
  const { sellerId } = useParams();
  const [owner, setOwner] = useState(null);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 1000]); // Default price range
  const [sortOption, setSortOption] = useState('default'); // Sorting option
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      if (!sellerId) {
        console.error('Seller ID is missing in URL parameters');
        toast.error('Seller ID is missing');
        setLoading(false);
        return;
      }

      try {
        console.log(`Fetching seller data for sellerId: ${sellerId}`);
        const sellerResponse = await axios.get(`/api/user/auth/seller/${sellerId}`);
        console.log('Seller response:', sellerResponse.data);
        if (!sellerResponse.data.seller) {
          throw new Error('Seller not found in response');
        }
        setOwner(sellerResponse.data.seller);

        console.log(`Fetching products for sellerId: ${sellerId}`);
        const productsResponse = await axios.get(`/api/user/auth/products?sellerId=${sellerId}`);
        console.log('Products response:', productsResponse.data);
        const fetchedProducts = productsResponse.data.products || [];
        setProducts(fetchedProducts);
        setFilteredProducts(fetchedProducts);
      } catch (error) {
        console.error('Error fetching data:', error);
        const msg = error.response?.data?.message || error.message || 'An unexpected error occurred';
        toast.error(msg);
        setOwner(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sellerId]);

  // Handle search: filter products based on search query
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      applyFilters(products);
      return;
    }

    const filtered = products.filter((product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    applyFilters(filtered);
    toast.success(`Showing results for: "${searchQuery}"`);
  };

  // Apply filters and sorting
  const applyFilters = (baseProducts = products) => {
    let filtered = [...baseProducts];

    // Apply price filter
    filtered = filtered.filter(
      (product) => product.price >= priceRange[0] && product.price <= priceRange[1]
    );

    // Apply sorting
    switch (sortOption) {
      case 'price-low-high':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high-low':
        filtered.sort((a, b) => b.price - b.price);
        break;
      case 'name-a-z':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-z-a':
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        break;
    }

    setFilteredProducts(filtered);
    setShowFilter(false);
    toast.success('Filters applied!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
        <motion.header
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="w-full max-w-7xl mx-auto flex items-center justify-between py-4 px-2 sm:px-6"
        >
        </motion.header>
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <SearchBar
            onSearch={() => { }}
            searchQuery=""
            setSearchQuery={() => { }}
            placeholder="Search products..."
          />
          <div className="flex items-center gap-4 mt-4">
            <div className="w-20 h-20 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="flex flex-col gap-2">
              <div className="w-32 h-6 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-40 h-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-6">
            {Array(5)
              .fill()
              .map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
          </div>
        </main>
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-200">
        <Toaster position="top-center" toastOptions={{ duration: 1500 }} />

        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
          <p className="text-gray-600 text-lg mb-4">Seller not found. Please check the seller ID or try again later.</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="bg-blue-500 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-600 transition-all duration-300"
          >
            Back to Home
          </motion.button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-2 py-6">
      <Toaster position="top-center" toastOptions={{ duration: 1500 }} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto ">
        <motion.div initial="hidden" animate="visible" variants={fadeIn}>
          {/* Search Bar and Filter */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-full max-w-md">
              <SearchBar
                onSearch={handleSearch}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                placeholder={`Search ${owner.name}'s products...`}
              />
            </div>
          </div>

          {/* Seller Profile Section */}
          <div className="flex items-center content-center gap-4 mb-8">
            <motion.img
              src={owner.profilePicture || 'https://via.placeholder.com/150'}
              alt={owner.name}
              className="w-20 h-20 rounded-full object-cover border-2 border-blue-300 hover:scale-105 transition-transform duration-300"
              whileHover={{ scale: 1.05 }}
            />
            <div className="flex flex-col gap-1 ">
              <h1 className="text-xl font-semibold text-gray-800">{owner.name}</h1>
              <p className="text-gray-600 flex items-center gap-2 text-sm">
                <FaStore className="text-blue-500" /> {owner.shopName || 'Unnamed Shop'}
              </p>
            </div>
          </div>

          {/* Products Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800 ">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'}
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowFilter(true)}
                className=" mr-10 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors duration-200"
              >
                <FaFilter size={18} />
              </motion.button>
            </div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-600 text-lg mb-4">No products available from this seller.</p>
                <motion.button
                  onClick={() => navigate('/')}
                  className="bg-blue-500 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-600 transition-all duration-300"
                >
                  Explore Other Sellers
                </motion.button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product._id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    whileHover={{ scale: 1.03 }}
                    className="w-full"
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Filter Modal */}
          {showFilter && (
            <motion.div
              variants={filterModalVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed inset-0 bg-gray-600/10 backdrop-blur-lg bg-opacity-50 flex items-center justify-center z-50"
            >
              <div className="bg-white p-6 rounded-3xl shadow-xl w-80">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter Products</h3>

                {/* Price Range Filter */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Price Range: ₹{priceRange[0]} - ₹{priceRange[1]}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])}
                    className="w-full mb-2"
                  />
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], +e.target.value])}
                    className="w-full"
                  />
                </div>

                {/* Sort Options */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Sort By</label>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="default">Default</option>
                    <option value="price-low-high">Price: Low to High</option>
                    <option value="price-high-low">Price: High to Low</option>
                    <option value="name-a-z">Name: A to Z</option>
                    <option value="name-z-a">Name: Z to A</option>
                  </select>
                </div>

                {/* Modal Buttons */}
                <div className="flex justify-end gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowFilter(false)}
                    className="px-4 py-2 bg-gray-200 rounded-full hover:bg-gray-300 text-gray-700"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => applyFilters()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                  >
                    Apply
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default OwnerProfilePage;