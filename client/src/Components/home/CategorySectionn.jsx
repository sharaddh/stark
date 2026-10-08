import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DataContext } from '../../DataProvider';
import axios from '../useraxios';
import Cookies from 'js-cookie';
import ProductCard from '../ProductCard4line';
import toast from 'react-hot-toast';

const DEFAULT_PRODUCT_IMAGE = 'https://res.cloudinary.com/your-cloud/image/upload/v123/default-product.jpg';
const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const CategorySectionn = ({ categoryId, categoryName }) => {
  const { cache, updateCache } = useContext(DataContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const trackProductView = useCallback(
    async (productId) => {
      try {
        const userToken = localStorage.getItem('token');
        let updatedRecent = [...(cache.recentlyViewed?.data || [])];
        if (userToken) {
          await axios.post('/api/user/auth/recently-viewed', { productId });
          updatedRecent = [productId, ...updatedRecent.filter((id) => id !== productId)].slice(0, 10);
        } else {
          let cookieViews = Cookies.get('recentlyViewed')
            ? JSON.parse(Cookies.get('recentlyViewed'))
            : [];
          if (!cookieViews.includes(productId)) {
            cookieViews = [productId, ...cookieViews].slice(0, 10);
            Cookies.set('recentlyViewed', JSON.stringify(cookieViews), { expires: 7 });
          }
          updatedRecent = cookieViews;
        }
        updateCache('recentlyViewed', updatedRecent);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error tracking product view:', error);
        }
      }
    },
    [cache.recentlyViewed, updateCache]
  );

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Check cache first
        const cachedProducts = cache[`category_${categoryId}`]?.data;
        if (cachedProducts?.length) {
          console.log(`Category ${categoryId} products from cache:`, cachedProducts.length);
          setProducts(
            cachedProducts.map((product) => ({
              ...product,
              image: product.image && product.image !== 'https://via.placeholder.com/150' ? product.image : DEFAULT_PRODUCT_IMAGE,
            }))
          );
          setLoading(false);
          return;
        }

        // Fetch from API
        const response = await axios.get(`/api/user/auth/category/${categoryId}`);
        const fetchedProducts = response.data.products || [];
        console.log(`Category ${categoryId} products from API:`, fetchedProducts.length);
        setProducts(
          fetchedProducts.map((product) => ({
            ...product,
            image: product.image && product.image !== 'https://via.placeholder.com/150' ? product.image : DEFAULT_PRODUCT_IMAGE,
          }))
        );
      } catch (error) {
        console.error(`Error fetching products for category ${categoryId}:`, error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    if (categoryId) {
      fetchProducts();
    }
  }, [categoryId, cache, trackProductView]);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -224, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 224, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading products...</p>
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="text-center py-4 text-gray-500">
        No products available for {categoryName || 'this category'}.
      </div>
    );
  }

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      className="py-4 "
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex px-[13px] justify-between items-center">
          <h2 className="text-xl font-bold text-gray-700">
            {categoryName || 'Category Products'}
          </h2>
          {products.length > 1 && (
            <div className="flex gap-2">
              <button
                onClick={scrollLeft}
                className="p-1 bg-gray-200 rounded-full hover:bg-gray-300"
                aria-label="Scroll left"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                onClick={scrollRight}
                className="p-1 bg-gray-200 rounded-full hover:bg-gray-300"
                aria-label="Scroll right"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l-7 7 7-7"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
        <motion.div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide py-4 cursor-grab active:cursor-grabbing"
          style={{ scrollBehavior: 'smooth' }}
        >
          {products.map((product, idx) => (
            <div
              key={product._id}
              className={`flex-shrink-0${idx === 0 ? ' pl-[13px]' : ''}${idx === products.length - 1 ? ' pr-[13px]' : ''}`}
            >
              <ProductCard product={product} onAddToCart={() => addToCart(product._id)} />
            </div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};

const addToCart = async (productId) => {
  const userToken = localStorage.getItem('token');
  if (!userToken) {
    toast.error('Please log in to add items to cart');
    return;
  }
  try {
    await axios.post('/api/user/auth/cart', {
      productId,
      quantity: 1,
      size: 'N/A',
      color: 'N/A',
    });
    toast.success('Added to cart');
  } catch (error) {
    toast.error(error.response?.data?.message || 'Failed to add to cart');
  }
};

export default CategorySectionn;