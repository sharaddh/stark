import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
// useraxios, not '../axios': /api/user/auth/products is a public shopper endpoint and the
// '../axios' instance redirects to /admin/login on any 401/403.
import axios from '../useraxios';
import toast, { Toaster } from 'react-hot-toast';
import ProductCard from '../Components/ProductCard';
import ProductCardSkeleton from '../Components/ProductCardSkeleton';
import SearchBar from '../Components/SearchBar';
import { motion } from 'framer-motion';
import { MdArrowBack, MdLogout } from 'react-icons/md';
import { FaFilter } from 'react-icons/fa';

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

const buttonVariants = {
  hover: { scale: 1.05 },
  tap: { scale: 0.95 },
};

const CategoryPage = () => {
  const { categoryName } = useParams();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [sortOption, setSortOption] = useState('default');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get(`/api/user/auth/products?category=${categoryName}`);
        const fetchedProducts = response.data.products || [];
        setProducts(fetchedProducts);
        setFilteredProducts(fetchedProducts);
      } catch (error) {
        console.error('Error fetching products:', error);
        toast.error(error.response?.data?.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categoryName]);

  const applyFilters = useCallback(
    (baseProducts = products) => {
      let filtered = [...baseProducts];

      // Apply price filter
      filtered = filtered.filter(
        (product) => product.price >= priceRange[0] && product.price <= priceRange[1]
      );

      // Apply sorting
      switch (sortOption) {
        case 'price-low-high':
          filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
          break;
        case 'price-high-low':
          filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
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
      toast.success('Filters applied!', { duration: 1500 });
    },
    [products, priceRange, sortOption]
  );

  const debouncedSearch = useCallback(
    debounce((query) => {
      if (!query.trim()) {
        applyFilters(products);
        return;
      }
      const filtered = products.filter((product) =>
        product.name.toLowerCase().includes(query.toLowerCase())
      );
      applyFilters(filtered);
      toast.success(`Showing results for "${query}"`, { duration: 1500 });
    }, 300),
    [products, applyFilters]
  );

  const handleSearch = useCallback(
    (e) => {
      e.preventDefault();
      if (!searchQuery.trim()) {
        toast.error('Please enter a search term');
        applyFilters(products);
        return;
      }
      debouncedSearch(searchQuery);
    },
    [searchQuery, products, debouncedSearch]
  );

  const resetFilters = useCallback(() => {
    setPriceRange([0, 1000]);
    setSortOption('default');
    applyFilters(products);
    toast.success('Filters reset!', { duration: 1500 });
  }, [products, applyFilters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
        <main className="mx-auto py-8 px-2 sm:px-6 lg:px-8">
          <SearchBar
            onSearch={() => { }}
            searchQuery=""
            setSearchQuery={() => { }}
            placeholder="Search products..."
            className="bg-white shadow-sm rounded-full border border-gray-200"
          />
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

  return (
    <div className="min-h-screen bg-gray-50 px-2 py-6">
      <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
      <main className=" mx-auto">
        <motion.div initial="hidden" animate="visible" variants={fadeIn}>
          {/* Search Bar and Filter */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-full">
              <SearchBar
                onSearch={handleSearch}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                placeholder={`Search in ${categoryName}...`}
                className="bg-white shadow-sm rounded-full border border-gray-200"
              />
            </div>
          </div>

          {/* Category Title */}
          <div className="items-center flex mb-6 justify-between">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800 capitalize flex items-center gap-2">
              {categoryName} Products
              <span className="text-blue-500 text-lg">({filteredProducts.length})</span>
            </h1>
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={() => setShowFilter(true)}
              className="rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors duration-200"
              aria-label="Open filter modal"
            >
              <FaFilter size={18} />
            </motion.button>
          </div>
          {/* Products Section */}
          <section>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-600 text-lg mb-4">No products found in this category.</p>
                <motion.button
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => navigate('/')}
                  className="bg-blue-500 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-600 transition-all duration-300"
                  aria-label="Back to Home"
                >
                  Back to Home
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
                    className='w-full'
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
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={resetFilters}
                    className="px-4 py-2 bg-gray-200 rounded-full hover:bg-gray-300 text-gray-700"
                    aria-label="Reset filters"
                  >
                    Reset
                  </motion.button>
                  <motion.button
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={() => setShowFilter(false)}
                    className="px-4 py-2 bg-gray-200 rounded-full hover:bg-gray-300 text-gray-700"
                    aria-label="Cancel filter"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={() => applyFilters()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                    aria-label="Apply filters"
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

export default CategoryPage;