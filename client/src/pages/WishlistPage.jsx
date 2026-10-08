import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Heart, LoaderCircle } from 'lucide-react'; // Added LoaderCircle for consistency
import { debounce } from 'lodash';
import axios from '../useraxios';
import WishlistProductCard from '../Components/WishlistProductCard';
import ProductCardSkeleton from '../Components/ProductCardSkeleton';
import fullLogo from '../assets/slogo.webp';
import smallLogo from '../assets/sslogo.png';
import { FaHeart, FaShoppingBag } from 'react-icons/fa';

// Animation Variants

const WishlistPage = React.memo(() => {
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState({ items: [] });
  const [loading, setLoading] = useState(false);
  const toastRef = useRef({}); // Track toast notifications
  const isMounted = useRef(false); // Track component mount state
  const timeoutRef = useRef(null);
  const animationKey = useRef(0); // Forces remount to reset animation
  const [isActive, setIsActive] = useState(false); // Tracks user interaction state

  // Handle user interactions (scroll, click)
  const handleUserAction = useCallback(() => {
    if (!isActive) {
      setIsActive(true);
      clearTimeout(timeoutRef.current);
    }
  }, [isActive]);

  // Revert to full logo after 3 seconds
  useEffect(() => {
    if (isActive) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsActive(false);
        animationKey.current += 1; // Increment key to reset animation
      }, 3000);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [isActive]);

  // Scroll and click event handlers
  useEffect(() => {
    const handleScroll = debounce(() => {
      handleUserAction();
    }, 5, { maxWait: 10 });

    const handleClick = () => handleUserAction();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleClick, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClick);
      clearTimeout(timeoutRef.current);
    };
  }, [handleUserAction]);

  // Debounced fetchWishlist to prevent multiple rapid API calls
  const fetchWishlist = useCallback(
    debounce(async () => {
      if (!isMounted.current) return;
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          if (!toastRef.current['login-error']) {
            toastRef.current['login-error'] = toast.error('Please log in to view your wishlist', {
              duration: 5000,
              style: { background: '#FF4D4F', color: '#fff', borderRadius: '12px', padding: '8px 16px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', fontSize: '14px', fontWeight: '500' },
              onClose: () => delete toastRef.current['login-error'],
            });
          }
          navigate('/login');
          return;
        }
        const response = await axios.get('/api/user/wishlist', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const wishlistItems = (response.data.wishlist || [])
          .filter((item) => item.productId?._id)
          .map((item, index) => ({
            wishlistItemId: index,
            productId: item.productId._id.toString(),
            name: item.productId.name || 'Unnamed Product',
            price: item.productId.price || 0,
            image: Array.isArray(item.productId.images) ? item.productId.images[0] : null,
            images: Array.isArray(item.productId.images) ? item.productId.images : [],
            sizes: Array.isArray(item.productId.sizes) ? item.productId.sizes : ['S', 'M', 'L'],
            colors: Array.isArray(item.productId.colors) ? item.productId.colors : ['Black', 'White'],
            discount: item.productId.discount || 0,
            discountPercentage: item.productId.discountPercentage || 0,
            stock: item.productId.quantity || 0,
            material: item.productId.material || 'Unknown',
          }));

        setWishlist({ items: wishlistItems });
        if (wishlistItems.length === 0 && !toastRef.current['empty-wishlist']) {
          toastRef.current['empty-wishlist'] = toast('Your wishlist is empty', {
            icon: '🩶',
            duration: 3000,
            style: { background: '#f3f4f6', color: '#333', borderRadius: '12px', padding: '8px 16px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', fontSize: '14px', fontWeight: '500' },
            onClose: () => delete toastRef.current['empty-wishlist'],
          });
        }
      } catch (error) {
        if (!toastRef.current['fetch-error']) {
          toastRef.current['fetch-error'] = toast.error('Failed to fetch wishlist: ' + (error.response?.data?.message || error.message), {
            duration: 5000,
            style: { background: '#FF4D4F', color: '#fff', borderRadius: '12px', padding: '8px 16px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', fontSize: '14px', fontWeight: '500' },
            onClose: () => delete toastRef.current['fetch-error'],
          });
        }
        console.error('Fetch Wishlist Error:', error.response?.data || error);
        setWishlist({ items: [] });
      } finally {
        setLoading(false);
      }
    }, 300),
    [navigate]
  );

  useEffect(() => {
    isMounted.current = true;
    fetchWishlist();
    return () => {
      isMounted.current = false;
      fetchWishlist.cancel(); // Cleanup debounce
    };
  }, [fetchWishlist]);

  const removeFromWishlist = useCallback(
    debounce(async (productId) => {
      const originalWishlist = { ...wishlist };
      setWishlist((prev) => ({
        items: prev.items.filter((item) => item.productId !== productId),
      }));
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`/api/user/wishlist/${productId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!toastRef.current[`remove-success-${productId}`]) {
          toastRef.current[`remove-success-${productId}`] = toast.success('Item removed from wishlist!', {
            icon: '💔',
            duration: 3000,
            style: { background: '#f3f4f6', color: '#10b981', borderRadius: '12px', padding: '8px 16px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', fontSize: '14px', fontWeight: '500' },
            onClose: () => delete toastRef.current[`remove-success-${productId}`],
          });
        }
      } catch (error) {
        setWishlist(originalWishlist);
        if (!toastRef.current[`remove-error-${productId}`]) {
          toastRef.current[`remove-error-${productId}`] = toast.error('Failed to remove item from wishlist: ' + (error.response?.data?.message || error.message), {
            duration: 5000,
            style: { background: '#FF4D4F', color: '#fff', borderRadius: '12px', padding: '8px 16px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', fontSize: '14px', fontWeight: '500' },
            onClose: () => delete toastRef.current[`remove-error-${productId}`],
          });
        }
        console.error('Remove Wishlist Error:', error.response?.data || error);
      }
    }, 300),
    [wishlist]
  );

  const moveToCart = useCallback(
    debounce(async (productId, size, color, quantity = 1) => {
      const item = wishlist.items.find((item) => item.productId === productId);
      if (!item) {
        if (!toastRef.current[`move-not-found-${productId}`]) {
          toastRef.current[`move-not-found-${productId}`] = toast.error('Item not found in wishlist', {
            duration: 5000,
            style: { background: '#FF4D4F', color: '#fff', borderRadius: '12px', padding: '8px 16px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', fontSize: '14px', fontWeight: '500' },
            onClose: () => delete toastRef.current[`move-not-found-${productId}`],
          });
        }
        return;
      }

      const originalWishlist = { ...wishlist };
      setWishlist((prev) => ({
        items: prev.items.filter((item) => item.productId !== productId),
      }));

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Please login to add to cart');
        }
        await axios.post('/api/user/wishlist/move-to-cart', { productId, quantity, size, color }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!toastRef.current[`move-success-${productId}`]) {
          toastRef.current[`move-success-${productId}`] = toast.success(`${item.name} moved to cart!`, {
            duration: 3000,
            style: { background: '#f3f4f6', color: '#10b981', borderRadius: '12px', padding: '8px 16px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', fontSize: '14px', fontWeight: '500' },
            onClose: () => delete toastRef.current[`move-success-${productId}`],
          });
        }
      } catch (error) {
        setWishlist(originalWishlist);
        if (!toastRef.current[`move-error-${productId}`]) {
          toastRef.current[`move-error-${productId}`] = toast.error('Failed to move item to cart: ' + (error.response?.data?.message || error.message), {
            duration: 5000,
            style: { background: '#FF4D4F', color: '#fff', borderRadius: '12px', padding: '8px 16px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', fontSize: '14px', fontWeight: '500' },
            onClose: () => delete toastRef.current[`move-error-${productId}`],
          });
        }
        console.error('Move to Cart Error:', error.response?.data || error);
      }
    }, 300),
    [wishlist]
  );

  const { subtotal, discountTotal } = useMemo(() => {
    return wishlist.items.reduce(
      (acc, item) => {
        const discountedPrice =
          item.discount > 0
            ? item.price - item.discount
            : item.discountPercentage > 0
              ? item.price * (1 - item.discountPercentage / 100)
              : item.price;
        return {
          subtotal: acc.subtotal + item.price,
          discountTotal: acc.discountTotal + (item.price - discountedPrice),
        };
      },
      { subtotal: 0, discountTotal: 0 }
    );
  }, [wishlist.items]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans" onClick={handleUserAction}>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-sm font-medium',
          style: { background: '#fff', color: '#333', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
          error: { style: { background: '#FF4D4F', color: '#fff' } },
          success: { style: { background: '#10B981', color: '#fff' } },
        }}
      />

      {/* Header */}
      <header className="bg-white shadow-sm p-4 top-0 relative z-20">
        <div className="max-w-7xl mx-auto flex items-center gap-2 relative">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="text-gray-600"
          >
            <ArrowLeft size={24} />
          </motion.button>
          <div className="overflow-hidden w-10 flex items-center justify-center">
            <motion.img
              key={`full-logo-${animationKey.current}`} // Forces remount to reset animation
              src={fullLogo}
              alt="Full Logo"
              className="absolute w-[135px] -left-2 top-0"
              initial={{ y: -100, opacity: 0 }} // Start off-screen from top
              animate={{
                y: !isActive ? 0 : 40, // Drop to position when inactive, hide when active
                opacity: !isActive ? 1 : 0,
              }}
              transition={{
                y: {
                  type: 'spring',
                  stiffness: 140, // Controls bounce strength
                  damping: 10,   // Controls bounce decay
                  mass: 1,       // Adds weight to the bounce
                  restDelta: 0.1,// Fine-tunes when animation stops
                  duration: 1,   // Overall drop duration
                },
                opacity: { duration: 0.3, ease: 'easeInOut' },
              }}
            />
            <motion.img
              key={`small-logo-${animationKey.current}`} // Forces remount to reset animation
              src={smallLogo}
              alt="Small Logo"
              className="absolute w-[98px] left-8 -top-[19px] h-auto"
              initial={{ y: 40, opacity: 0 }}
              animate={{
                y: isActive ? 0 : 40, // Slide in/out
                opacity: isActive ? 1 : 0,
              }}
              transition={{
                type: 'tween',
                ease: [0.25, 0.1, 0.25, 1],
                duration: 0.4,
              }}
            />
          </div>
          <motion.h1
            className="text-xl font-bold text-gray-800"
            animate={{
              x: isActive ? 59 : 0, // Shift right when active
            }}
            transition={{
              type: 'tween',
              ease: [0.25, 0.1, 0.25, 1],
              duration: 0.4,
            }}
          >
            Your Wishlist
          </motion.h1>
        </div>
      </header>
      <div className="absolute w-full z-0 opacity-90 top-0 left-0 flex items-center justify-center blur-xl">
        <motion.div
          className="w-[30%] h-20 bg-purple-400"
          initial={{ scale: 0.8, opacity: 0.5 }}
          transition={{ duration: 0.6 }}
        />
        <motion.div
          className="w-[40%] h-20 skew-x-12 bg-pink-400"
          initial={{ scale: 0.8, opacity: 0.5 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        />
        <motion.div
          className="w-[30%] h-20 bg-yellow-400"
          initial={{ scale: 0.8, opacity: 0.5 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
      </div>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {Array(3).fill().map((_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        ) : wishlist.items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white rounded-lg shadow-sm"
          >
            <Heart className="mx-auto text-gray-400" size={48} />
            <p className="text-gray-600 mt-4 text-lg">Your wishlist is empty</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="mt-4 bg-green-500 text-white px-6 py-2 rounded-md font-medium hover:bg-green-600 transition-all duration-300"
            >
              Shop Now
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-lg flex items-center justify-end drop-shadow-md font-semibold text-gray-800 mb-3">
                <div className="flex items-center justify-center drop-shadow-md gap-2">
                  <FaShoppingBag className="text-gray-700 text-xl" /> Wishlist ({wishlist.items.length} {wishlist.items.length === 1 ? 'item' : 'items'})
                </div>
              </h3>
              <div className="space-y-4">
                <AnimatePresence>
                  {wishlist.items.map((item) => (
                    <motion.div
                      key={`wishlist-${item.wishlistItemId}-${item.productId}`}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <WishlistProductCard
                        product={item}
                        onRemove={removeFromWishlist}
                        onMoveToCart={moveToCart}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {wishlist.items.length > 0 && (
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-lg shadow-sm sticky top-20">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Price Details</h3>
                  <div className="space-y-3 text-gray-600 text-sm">
                    <div className="flex justify-between">
                      <span>Wishlist Total</span>
                      <span>₹{subtotal.toFixed(2)}</span>
                    </div>
                    {discountTotal > 0 && (
                      <div className="flex justify-between">
                        <span>Discount</span>
                        <span className="text-green-600">−₹{discountTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t pt-3 flex justify-between font-semibold text-gray-900">
                      <span>Net Amount</span>
                      <span>₹{(subtotal - discountTotal).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
});

export default WishlistPage;