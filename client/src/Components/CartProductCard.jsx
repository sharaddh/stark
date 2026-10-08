import React, { useState, useCallback, useMemo } from 'react';
import { IoTrashOutline, IoHeartOutline, IoHeart } from 'react-icons/io5';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import placeholderImage from '../assets/logo.png';
const FALLBACK_IMAGE = 'https://via.placeholder.com/100';

// Animation Variants
const cardVariants = {
  hover: { scale: 1.02, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.08)' },
  tap: { scale: 0.98 },
};

const buttonVariants = {
  hover: { scale: 1.1 },
  tap: { scale: 0.9 },
};

const CartProductCard = React.memo(
  ({
    item = null,
    onUpdateQuantity = () => {},
    onRemove = () => {},
    onSaveForLater = () => {},
    isSavedForLater = false,
  }) => {
    const navigate = useNavigate();
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Hooks must run before any early return, so destructure defensively first.
    const {
      productId,
      name = 'Unnamed Product',
      price = 0,
      quantity = 1,
      size = 'N/A',
      color = '',
      image = null,
      stock = 0,
      discount = 0,
      sizes = ['S', 'M', 'L'],
    } = item || {};

    // Memoized values
    const displayImage = useMemo(() => {
      if (!image) return placeholderImage;
      return image.replace(/^http:/, 'https:');
    }, [image]);
    const originalPrice = useMemo(
      () => (discount > 0 ? (price / (1 - discount / 100)).toFixed(2) : price.toFixed(2)),
      [price, discount]
    );
    const isLowStock = useMemo(() => stock > 0 && stock <= 5, [stock]);
    const isDisabled = useMemo(() => !localStorage.getItem('token') || stock === 0, [stock]);
    const quantityOptions = useMemo(
      () => Array.from({ length: Math.min(stock, 10) }, (_, i) => i + 1),
      [stock]
    );

    const handleQuantityChange = useCallback(
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newQuantity = parseInt(e.target.value, 10);
        if (isNaN(newQuantity) || newQuantity < 1) {
          toast.error('Invalid quantity');
          return;
        }
        setIsUpdating(true);
        try {
          await onUpdateQuantity(productId, newQuantity, size, color);
          toast.success(`Updated quantity to ${newQuantity}`);
        } catch (error) {
          console.error('Update quantity error:', error.response?.data || error.message);
          toast.error('Failed to update quantity. Please try again.');
        } finally {
          setIsUpdating(false);
        }
      },
      [productId, size, color, onUpdateQuantity]
    );

    const handleSizeChange = useCallback(
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newSize = e.target.value;
        if (!sizes.includes(newSize)) {
          toast.error('Invalid size selected');
          return;
        }
        setIsUpdating(true);
        try {
          await onUpdateQuantity(productId, quantity, newSize, color);
          toast.success(`Updated size to ${newSize}`);
        } catch (error) {
          console.error('Update size error:', error.response?.data || error.message);
          toast.error('Failed to update size. Please try again.');
        } finally {
          setIsUpdating(false);
        }
      },
      [productId, quantity, sizes, color, onUpdateQuantity]
    );

    const handleRemove = useCallback(
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsUpdating(true);
        try {
          await onRemove(productId, size, color);
          toast.success(`${name} removed from ${isSavedForLater ? 'wishlist' : 'cart'}!`);
        } catch (error) {
          console.error('Remove item error:', error.response?.data || error.message);
          toast.error('Failed to remove item. Please try again.');
        } finally {
          setIsUpdating(false);
        }
      },
      [productId, size, color, name, isSavedForLater, onRemove]
    );

    const handleSaveForLater = useCallback(
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsUpdating(true);
        try {
          await onSaveForLater(productId, quantity, size, color);
          toast.success(`${name} ${isSavedForLater ? 'moved to cart' : 'moved to wishlist'}!`);
        } catch (error) {
          console.error('Move to wishlist error:', error.response?.data || error.message);
          toast.error('Failed to move item. Please try again.');
        } finally {
          setIsUpdating(false);
        }
      },
      [productId, quantity, size, color, name, isSavedForLater, onSaveForLater]
    );

    const handleProductClick = useCallback(() => {
      if (productId) {
        navigate(`/products/${productId}`);
      }
    }, [productId, navigate]);

    // All hooks above; validate the item before rendering.
    if (!item || !item.productId) {
      return (
        <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
          Invalid or Missing Item
        </div>
      );
    }

    return (
      <motion.div
        variants={cardVariants}
        whileHover="hover"
        whileTap="tap"
        onClick={handleProductClick}
        className={`w-full max-w-[600px] bg-white rounded-xl border ${
          isSavedForLater ? 'border-amber-200' : 'border-gray-200'
        } flex items-center p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
      >
        {/* Image Section */}
        <div className="relative w-[100px] h-[100px] flex-shrink-0">
          {imageLoading && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-xl">
              <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {imageError && (
            <div className="w-full h-full bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 text-xs">
              Image Unavailable
            </div>
          )}
          <img
            src={displayImage}
            alt={name}
            className={`w-full h-full rounded-xl object-cover drop-shadow-md transition-opacity duration-300 ${
              imageLoading || imageError ? 'opacity-0' : 'opacity-100'
            }`}
            loading="lazy"
            onLoad={() => setImageLoading(false)}
            onError={(e) => {
              console.warn(`Image load failed: ${displayImage}`);
              e.target.src = FALLBACK_IMAGE;
              setImageError(true);
              setImageLoading(false);
            }}
          />
          {discount > 0 && (
            <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
              {discount}% OFF
            </span>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-grow ml-3 sm:ml-4 flex flex-col justify-between h-full">
          {/* Name and Actions */}
          <div className="flex justify-between items-start">
            <h3
              className="text-sm sm:text-base font-semibold text-gray-800 truncate max-w-[60%] hover:text-green-600 transition-colors"
              title={name}
            >
              {name}
            </h3>
            <div className="flex items-center gap-2">
              <motion.button
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                onClick={handleSaveForLater}
                className={`p-2 rounded-full bg-gray-50 border ${
                  isSavedForLater
                    ? 'text-amber-600 border-amber-200 hover:bg-amber-100'
                    : 'text-gray-600 border-gray-200 hover:bg-green-100 hover:text-green-600'
                } transition-all`}
                title={isSavedForLater ? 'Move to Cart' : 'Move to Wishlist'}
                disabled={isDisabled || isUpdating}
                aria-label={isSavedForLater ? 'Move to Cart' : 'Move to Wishlist'}
              >
                {isSavedForLater ? <IoHeart size={18} /> : <IoHeartOutline size={18} />}
              </motion.button>
              <motion.button
                variants={buttonVariants}
                whileHover={{ scale: 1.1, color: '#ef4444' }}
                whileTap="tap"
                onClick={handleRemove}
                className="p-2 rounded-full bg-gray-50 border border-gray-200 text-gray-600 hover:bg-red-100 transition-all"
                title="Remove"
                disabled={isDisabled || isUpdating}
                aria-label="Remove from cart"
              >
                <IoTrashOutline size={18} />
              </motion.button>
            </div>
          </div>

          {/* Price Details */}
          <div className="flex items-center gap-2 sm:gap-3 mt-1 text-sm sm:text-base">
            <span className="font-semibold text-green-600">₹{price.toFixed(2)}</span>
            {discount > 0 && (
              <span className="text-gray-500 line-through">₹{originalPrice}</span>
            )}
            <span className="text-gray-600">Total: ₹{(price * quantity).toFixed(2)}</span>
          </div>

          {/* Quantity, Size, Stock */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-sm text-gray-600">
            {!isSavedForLater && (
              <div className="flex items-center gap-1.5">
                <label className="font-medium text-gray-700">Qty:</label>
                <select
                  value={quantity}
                  onChange={handleQuantityChange}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  disabled={isDisabled || isUpdating}
                  aria-label="Select quantity"
                >
                  {quantityOptions.map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isSavedForLater && sizes.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="font-medium text-gray-700">Size:</label>
                <select
                  value={size}
                  onChange={handleSizeChange}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  disabled={isDisabled || isUpdating}
                  aria-label="Select size"
                >
                  {sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span
              className={`${
                stock === 0 ? 'text-red-500' : isLowStock ? 'text-orange-500' : 'text-gray-500'
              }`}
            >
              {stock === 0 ? 'Out of Stock' : isLowStock ? `Only ${stock} left` : `${stock} in stock`}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }
);

export default CartProductCard;