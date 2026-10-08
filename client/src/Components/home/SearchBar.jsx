import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaArrowRight, FaSearch, FaTimes, FaFire, FaStar, FaTag, FaShoppingBag, FaTrash, FaUser } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from '../useraxios';
import toast from 'react-hot-toast';
import agroLogo from '../../assets/slogo.webp';
import slogo from '../../assets/slogo.webp';

// Animation variants

const expandVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
};

const inputVariants = {
  initial: { scale: 1, boxShadow: '0 0 0 0 rgba(168,85,247,0)' },
  focus: { scale: 1.03, boxShadow: '0 4px 24px 0 rgba(168,85,247,0.15)' },
};

const suggestionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.05, duration: 0.4 } },
};

const SearchBar = ({ placeholder = 'search by category, name, id' }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState({ recentSearches: [], categories: [], sellers: [], products: [] });
  const [trending, setTrending] = useState({ trendingSearches: [], topSellers: [], topCategories: [], topProducts: [] });
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  const fetchTrending = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await axios.get('/api/user/auth/search/trending', { headers: { Authorization: `Bearer ${token}` } });
      setTrending({
        trendingSearches: res.data.trendingSearches || [],
        topSellers: res.data.topSellers || [],
        topCategories: res.data.topCategories || [],
        topProducts: res.data.topProducts || [],
      });
    } catch (error) {
      console.error('Fetch Trending Error:', error);
      setTrending({ trendingSearches: [], topSellers: [], topCategories: [], topProducts: [] });
    }
  }, []);

  const fetchSuggestions = useCallback(async (query) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    try {
      const endpoint = query.trim() ? '/api/user/auth/search/suggestions' : '/api/user/auth/search/recent';
      const res = await axios.get(endpoint, {
        params: query.trim() ? { q: query } : {},
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuggestions({
        recentSearches: res.data.recentSearches || [],
        categories: res.data.categories || [],
        sellers: res.data.sellers || [],
        products: res.data.products || [],
      });
    } catch (error) {
      console.error('Fetch Suggestions Error:', error);
      toast.error('Search suggestions unavailable');
      setSuggestions({ recentSearches: [], categories: [], sellers: [], products: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => fetchSuggestions(searchQuery), 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, fetchSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setIsExpanded(false);
    };
    const handleEscape = (e) => e.key === 'Escape' && setIsExpanded(false);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    saveSearch();
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    setIsExpanded(false);
  };

  const saveSearch = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    axios.post('/api/user/auth/search/recent', { query: searchQuery }, { headers: { Authorization: `Bearer ${token}` } }).catch((err) => console.error('Save Search Error:', err));
  };

  const handleQuickSearch = (type, item) => {
    let query = '';
    switch (type) {
      case 'recent':
      case 'trending':
        query = typeof item === 'string' ? item : item.query || 'Unknown';
        setSearchQuery(query);
        navigate(`/search?q=${encodeURIComponent(query)}`);
        break;
      case 'category':
        navigate(`/category/${item._id}`);
        break;
      case 'seller':
        navigate(`/seller/${item._id}`);
        break;
      case 'product':
        navigate(`/product/${item._id}`);
        break;
      default:
        break;
    }
    if (query) saveSearch();
    setIsExpanded(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const clearAllRecent = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    axios
      .post('/api/user/auth/search/recent', { query: '' }, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setSuggestions((prev) => ({ ...prev, recentSearches: [] }));
        toast.success('Recent searches cleared');
      })
      .catch((err) => console.error('Clear Recent Error:', err));
  };

  const removeRecentSearch = (search) => {
    const searchText = typeof search === 'string' ? search : search.query || 'Unknown';
    const updatedSearches = suggestions.recentSearches.filter((item) => (typeof item === 'string' ? item : item.query) !== searchText);
    setSuggestions((prev) => ({ ...prev, recentSearches: updatedSearches }));
    const token = localStorage.getItem('token');
    if (!token) return;
    axios.post('/api/user/auth/search/recent', { query: searchText }, { headers: { Authorization: `Bearer ${token}` } }).catch((err) => console.error('Remove Recent Error:', err));
  };

  const TagItem = ({ text, onRemove, onClick }) => {
    if (typeof text !== 'string') return null;
    return (
      <motion.div
        className="inline-flex items-center bg-gray-100 rounded-full px-3 py-1 mr-2 mb-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
        onClick={onClick}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        layout
      >
        <span>{text}</span>
        {onRemove && (
          <FaTimes
            className="ml-2 text-gray-500 cursor-pointer hover:text-gray-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          />
        )}
      </motion.div>
    );
  };

  const BlockItem = ({ icon, text, image, onClick }) => (
    <motion.div
      className="flex items-center bg-white rounded-lg p-3 m-2 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
      onClick={onClick}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      layout
      style={{ minWidth: '120px', height: '120px', flex: '1 0 auto' }}
    >
      <div className="w-16 h-16 flex items-center justify-center rounded-md overflow-hidden">
        <img
          src={image || agroLogo}
          alt={text}
          className="w-full h-full object-cover"
          onError={(e) => (e.target.src = agroLogo)}
        />
      </div>
      <div className="ml-3 flex-1">
        <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-md mb-2">{icon}</div>
        <span className="text-sm text-gray-700 truncate">{text}</span>
      </div>
    </motion.div>
  );

  const hasResults = () =>
    (Array.isArray(suggestions.products) && suggestions.products.length > 0) ||
    (Array.isArray(suggestions.categories) && suggestions.categories.length > 0) ||
    (Array.isArray(suggestions.sellers) && suggestions.sellers.length > 0);

  return (
    <div className="relative w-full">
      <div ref={searchRef} className="relative mt-4 mb-5 px-2 mx-auto z-20">
        <motion.form
          onSubmit={handleSearch}
          initial="initial"
          animate={isExpanded ? 'focus' : 'initial'}
          variants={inputVariants}
          className="flex w-full items-center bg-white/85 rounded-2xl drop-shadow-lg px-8 py-3 border border-gray-200"
        >
          <div className="flex w-full items-center">
            <div className="relative w-15 flex h-full rounded-full shadow-inner">
              <motion.div
                className="-top-[14px] z-10 -left-8 w-32 absolute"
                initial={{ rotate: 0 }}
                animate={isExpanded ? { rotate: 10 } : { rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <img className="drop-shadow-lg w-full" src={slogo} alt="Logo" />
              </motion.div>
            </div>
            <motion.input
              ref={inputRef}
              className="flex-1 w-[60%] ml-14 text-base font-medium text-gray-800 bg-transparent outline-none placeholder-gray-400"
              placeholder={placeholder}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
            {searchQuery && (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <FaTimes
                  className="text-gray-500 cursor-pointer mr-3 hover:text-gray-700 transition-colors"
                  onClick={clearSearch}
                />
              </motion.div>
            )}
          </div>
          <motion.button
            type="submit"
            className="text-purple-400 text-xl drop-shadow-lg hover:text-purple-500 transition-colors"
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.15 }}
          >
            <FaArrowRight />
          </motion.button>
        </motion.form>

        {isExpanded && (
          <div className="w-full px-2">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={expandVariants}
              className="absolute left-0 right-0 mt-2 bg-white/90 backdrop-blur-md rounded-xl shadow-lg mx-2 z-20 p-6 max-h-[450px] overflow-y-auto border border-gray-100"
            >
              <motion.div variants={suggestionVariants} initial="hidden" animate="visible">
                {loading && searchQuery.trim() ? (
                  <motion.p className="text-gray-500 text-center py-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Searching...
                  </motion.p>
                ) : searchQuery.trim() ? (
                  <>
                    {Array.isArray(suggestions.products) && suggestions.products.length > 0 && (
                      <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <FaShoppingBag className="mr-2 text-blue-500" /> Products
                        </h3>
                        <div className="flex flex-wrap">
                          {suggestions.products.map((product) => (
                            <BlockItem
                              key={product._id}
                              icon={<FaShoppingBag className="text-blue-500" />}
                              text={product.name}
                              image={product.image?.[0]}
                              onClick={() => handleQuickSearch('product', product)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {Array.isArray(suggestions.categories) && suggestions.categories.length > 0 && (
                      <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <FaTag className="mr-2 text-green-500" /> Categories
                        </h3>
                        <div className="flex flex-wrap">
                          {suggestions.categories.map((cat) => (
                            <BlockItem
                              key={cat._id}
                              icon={<FaTag className="text-green-500" />}
                              text={cat.name}
                              image={cat.image?.[0] || agroLogo} // Assuming categories might have images
                              onClick={() => handleQuickSearch('category', cat)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {Array.isArray(suggestions.sellers) && suggestions.sellers.length > 0 && (
                      <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <FaStar className="mr-2 text-yellow-500" /> Sellers
                        </h3>
                        <div className="flex flex-wrap">
                          {suggestions.sellers.map((seller) => (
                            <BlockItem
                              key={seller._id}
                              icon={<FaUser className="text-yellow-500" />}
                              text={`${seller.name} ${seller.shopName ? `(${seller.shopName})` : ''}`}
                              image={seller.image?.[0] || agroLogo} // Assuming sellers might have images
                              onClick={() => handleQuickSearch('seller', seller)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {!hasResults() && !loading && (
                      <motion.p className="text-gray-500 text-center py-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        No results found
                      </motion.p>
                    )}

                    {hasResults() && (
                      <>
                        {Array.isArray(suggestions.recentSearches) && suggestions.recentSearches.length > 0 && (
                          <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                                <FaSearch className="mr-2 text-gray-500" /> Recent Searches
                              </h3>
                              <button
                                className="text-xs text-red-500 hover:text-red-600 flex items-center transition-colors"
                                onClick={clearAllRecent}
                              >
                                <FaTrash className="mr-1" /> Clear All
                              </button>
                            </div>
                            <motion.div className="flex flex-wrap" layout>
                              {suggestions.recentSearches.map((search, index) => (
                                <TagItem
                                  key={index}
                                  text={typeof search === 'string' ? search : search.query || 'Unknown'}
                                  onRemove={() => removeRecentSearch(search)}
                                  onClick={() => handleQuickSearch('recent', search)}
                                />
                              ))}
                            </motion.div>
                          </motion.div>
                        )}

                        {Array.isArray(trending.trendingSearches) && trending.trendingSearches.length > 0 && (
                          <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                              <FaFire className="mr-2 text-red-500" /> Trending Searches
                            </h3>
                            <motion.div className="flex flex-wrap" layout>
                              {trending.trendingSearches.map((search, index) => (
                                <TagItem
                                  key={index}
                                  text={typeof search === 'string' ? search : search.query || 'Unknown'}
                                  onClick={() => handleQuickSearch('trending', search)}
                                />
                              ))}
                            </motion.div>
                          </motion.div>
                        )}

                        {Array.isArray(trending.topCategories) && trending.topCategories.length > 0 && (
                          <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                              <FaTag className="mr-2 text-green-500" /> Top Categories
                            </h3>
                            <div className="flex flex-wrap">
                              {trending.topCategories.map((cat) => (
                                <BlockItem
                                  key={cat._id}
                                  icon={<FaTag className="text-green-500" />}
                                  text={cat.name}
                                  image={cat.icon} 
                                  onClick={() => handleQuickSearch('category', cat)}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {Array.isArray(trending.topSellers) && trending.topSellers.length > 0 && (
                          <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                              <FaStar className="mr-2 text-yellow-500" /> Top Sellers
                            </h3>
                            <div className="flex flex-wrap">
                              {trending.topSellers.map((seller) => (
                                <BlockItem
                                  key={seller._id}
                                  icon={<FaUser className="text-yellow-500" />}
                                  text={`${seller.name} ${seller.shopName ? `(${seller.shopName})` : ''}`}
                                  image={seller.image?.[0] || agroLogo} // Assuming top sellers might have images
                                  onClick={() => handleQuickSearch('seller', seller)}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {Array.isArray(trending.topProducts) && trending.topProducts.length > 0 && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                              <FaShoppingBag className="mr-2 text-blue-500" /> Top Products
                            </h3>
                            <div className="flex flex-wrap">
                              {trending.topProducts.map((product) => (
                                <BlockItem
                                  key={product._id}
                                  icon={<FaShoppingBag className="text-blue-500" />}
                                  text={product.name}
                                  image={product.image?.[0]}
                                  onClick={() => handleQuickSearch('product', product)}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {Array.isArray(suggestions.recentSearches) && suggestions.recentSearches.length > 0 && (
                      <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                            <FaSearch className="mr-2 text-gray-500" /> Recent Searches
                          </h3>
                          <button
                            className="text-xs text-red-500 hover:text-red-600 flex items-center transition-colors"
                            onClick={clearAllRecent}
                          >
                            <FaTrash className="mr-1" /> Clear All
                          </button>
                        </div>
                        <motion.div className="flex flex-wrap" layout>
                          {suggestions.recentSearches.map((search, index) => (
                            <TagItem
                              key={index}
                              text={typeof search === 'string' ? search : search.query || 'Unknown'}
                              onRemove={() => removeRecentSearch(search)}
                              onClick={() => handleQuickSearch('recent', search)}
                            />
                          ))}
                        </motion.div>
                      </motion.div>
                    )}

                    {Array.isArray(trending.trendingSearches) && trending.trendingSearches.length > 0 && (
                      <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <FaFire className="mr-2 text-red-500" /> Trending Searches
                        </h3>
                        <motion.div className="flex flex-wrap" layout>
                          {trending.trendingSearches.map((search, index) => (
                            <TagItem
                              key={index}
                              text={typeof search === 'string' ? search : search.query || 'Unknown'}
                              onClick={() => handleQuickSearch('trending', search)}
                            />
                          ))}
                        </motion.div>
                      </motion.div>
                    )}

                    {Array.isArray(trending.topCategories) && trending.topCategories.length > 0 && (
                      <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <FaTag className="mr-2 text-green-500" /> Top Categories
                        </h3>
                        <div className="flex flex-wrap">
                          {trending.topCategories.map((cat) => (
                            <BlockItem
                              key={cat._id}
                              icon={<FaTag className="text-green-500" />}
                              text={cat.name}
                              image={cat.icon}
                              onClick={() => handleQuickSearch('category', cat)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {Array.isArray(trending.topSellers) && trending.topSellers.length > 0 && (
                      <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <FaStar className="mr-2 text-yellow-500" /> Top Sellers
                        </h3>
                        <div className="flex flex-wrap">
                          {trending.topSellers.map((seller) => (
                            <BlockItem
                              key={seller._id}
                              icon={<FaUser className="text-yellow-500" />}
                              text={`${seller.name} ${seller.shopName ? `(${seller.shopName})` : ''}`}
                              image={seller.image?.[0] || agroLogo}
                              onClick={() => handleQuickSearch('seller', seller)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {Array.isArray(trending.topProducts) && trending.topProducts.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <FaShoppingBag className="mr-2 text-blue-500" /> Top Products
                        </h3>
                        <div className="flex flex-wrap">
                          {trending.topProducts.map((product) => (
                            <BlockItem
                              key={product._id}
                              icon={<FaShoppingBag className="text-blue-500" />}
                              text={product.name}
                              image={product.image?.[0]}
                              onClick={() => handleQuickSearch('product', product)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </>
                )}
              </motion.div>
            </motion.div>
          </div>
        )}
      </div>
      <div className="absolute w-full z-0 opacity-40 top-0 left-0 flex items-center justify-center blur-xl">
        <motion.div
          className="w-[30%] h-20 bg-purple-400"
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: isExpanded ? 1.1 : 0.8, opacity: isExpanded ? 0.7 : 0.5 }}
          transition={{ duration: 0.6 }}
        />
        <motion.div
          className="w-[40%] h-20 skew-x-12 bg-pink-400"
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: isExpanded ? 1.1 : 0.8, opacity: isExpanded ? 0.7 : 0.5 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        />
        <motion.div
          className="w-[30%] h-20 bg-yellow-400"
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: isExpanded ? 1.1 : 0.8, opacity: isExpanded ? 0.7 : 0.5 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
      </div>
    </div>
  );
};

export default SearchBar;