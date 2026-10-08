import React, { useMemo, useRef, useContext, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FaEye } from 'react-icons/fa';
import axios from '../useraxios';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import ProductCard from '../ProductCard4line';
import { DataContext } from '../../DataProvider';

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const DEFAULT_IMAGE = 'https://your-server.com/generic-product-placeholder.jpg';

const RecentlyViewedSection = React.memo(() => {
  const { cache } = useContext(DataContext);
  const products = useMemo(() => {
    const recent = cache.recentlyViewed?.data || [];
    return recent.map((product) => ({
      ...product,
      image: product.image && product.image !== 'https://via.placeholder.com/150' ? product.image : DEFAULT_IMAGE,
    }));
  }, [cache.recentlyViewed]);
  const scrollRef = useRef(null);
  const addToCart = useCallback(async (productId) => {
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
  }, []);

  const scrollLeft = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -224, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 224, behavior: 'smooth' });
    }
  }, []);

  if (products.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      className="py-4 bg-gray-50"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between px-[13px] items-center">
          <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
            <FaEye className="text-blue-500" aria-hidden="true" /> Checkout Again
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
                    d="M9 5l7 7-7 7"
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
});

export default RecentlyViewedSection;