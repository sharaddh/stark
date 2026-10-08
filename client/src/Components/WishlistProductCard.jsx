import React, { useState, useCallback, useMemo } from 'react';
import { HeartOff, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { debounce } from 'lodash';
import placeholderImage from '../assets/logo.png';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
  DrawerDescription,
} from '../../@/components/ui/drawer';
import { Button } from '../../@/components/ui/button';
import { cn } from '../lib/utils';

const FALLBACK_IMAGE = 'https://via.placeholder.com/100';

// Animation Variants
const cardVariants = {
  hover: { scale: 1.02, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.08)' },
  tap: { scale: 0.98 },
};

const buttonVariants = {
  hover: { scale: 1.15 },
  tap: { scale: 0.9 },
};

const WishlistProductCard = React.memo(({ product = {}, onRemove = () => {}, onMoveToCart = () => {} }) => {
  const navigate = useNavigate();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Memoize product data to prevent unnecessary recalculations
  const productData = useMemo(() => ({
    productId: product.productId,
    name: product.name || 'Unnamed Product',
    price: product.price || 0,
    image: product.image || (Array.isArray(product.images) && product.images[0]?.replace(/^http:/, 'https:')) || placeholderImage,
    images: Array.isArray(product.images) ? product.images : [],
    discount: product.discount || 0,
    discountPercentage: product.discountPercentage || 0,
    stock: product.stock || 0,
    sizes: Array.isArray(product.sizes) ? product.sizes : ['S', 'M', 'L'],
    colors: Array.isArray(product.colors) ? product.colors : ['Black', 'White'],
    material: product.material || 'Unknown',
  }), [product]);

  // Calculate discounted price
  const discountedPrice = useMemo(() => 
    productData.discount > 0 
      ? productData.price - productData.discount 
      : productData.discountPercentage > 0 
      ? productData.price * (1 - productData.discountPercentage / 100) 
      : productData.price,
  [productData.price, productData.discount, productData.discountPercentage]);

  const isLowStock = productData.stock > 0 && productData.stock <= 5;
  const isDisabled = !localStorage.getItem('token') || productData.stock === 0 || isUpdating;

  // Debounced remove from wishlist
  const handleRemoveFromWishlist = useCallback(
    debounce(async (e) => {
      e.stopPropagation();
      setIsUpdating(true);
      try {
        await onRemove(productData.productId);
        toast.success(`${productData.name} removed from wishlist!`, {
          icon: '💔',
          duration: 3000,
          style: {
            background: '#f3f4f6',
            color: '#ef4444',
            borderRadius: '12px',
            padding: '8px 16px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            fontSize: '14px',
            fontWeight: '500',
          },
        });
      } catch (error) {
        console.error('Remove from Wishlist Error:', error);
        toast.error('Failed to remove item from wishlist', {
          duration: 5000,
          style: {
            background: '#FF4D4F',
            color: '#fff',
            borderRadius: '12px',
            padding: '8px 16px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            fontSize: '14px',
            fontWeight: '500',
          },
        });
      } finally {
        setIsUpdating(false);
      }
    }, 300),
    [productData.productId, productData.name, onRemove]
  );

  // Debounced move to cart click
  const handleMoveToCartClick = useCallback(
    (e) => {
      e.stopPropagation();
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please login to add to cart', {
          duration: 5000,
          style: {
            background: '#FF4D4F',
            color: '#fff',
            borderRadius: '12px',
            padding: '8px 16px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            fontSize: '14px',
            fontWeight: '500',
          },
        });
        navigate('/login');
        return;
      }
      setSelectedSize(productData.sizes[0] || '');
      setSelectedColor(productData.colors[0] || '');
      setIsDrawerOpen(true);
    },
    [navigate, productData.sizes, productData.colors]
  );

  // Debounced move to cart
  const handleMoveToCart = useCallback(
    debounce(async () => {
      if (!selectedSize || !selectedColor) {
        toast.error('Please select size and color', {
          duration: 5000,
          style: {
            background: '#FF4D4F',
            color: '#fff',
            borderRadius: '12px',
            padding: '8px 16px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            fontSize: '14px',
            fontWeight: '500',
          },
        });
        return;
      }
      setIsUpdating(true);
      try {
        await onMoveToCart(productData.productId, selectedSize, selectedColor, quantity);
        setIsDrawerOpen(false);
        toast.success(`${productData.name} moved to cart!`, {
          duration: 3000,
          style: {
            background: '#f3f4f6',
            color: '#10b981',
            borderRadius: '12px',
            padding: '8px 16px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            fontSize: '14px',
            fontWeight: '500',
          },
        });
      } catch (error) {
        console.error('Move to Cart Error:', error);
        toast.error('Failed to move item to cart: ' + (error.response?.data?.message || error.message), {
          duration: 5000,
          style: {
            background: '#FF4D4F',
            color: '#fff',
            borderRadius: '12px',
            padding: '8px 16px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            fontSize: '14px',
            fontWeight: '500',
          },
        });
      } finally {
        setIsUpdating(false);
      }
    }, 300),
    [productData.productId, productData.name, selectedSize, selectedColor, quantity, onMoveToCart]
  );

  const handleProductClick = useCallback(() => {
    if (productData.productId) {
      navigate(`/products/${productData.productId}`);
    }
  }, [productData.productId, navigate]);

  // All hooks above; validate the product before rendering.
  if (!product || !product.productId) {
    return (
      <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
        Invalid or Missing Product
      </div>
    );
  }

  return (
    <>
      <motion.div
        variants={cardVariants}
        whileHover="hover"
        whileTap="tap"
        onClick={handleProductClick}
        className="w-full max-w-[600px] bg-white rounded-xl border border-gray-200 flex items-center p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        {...(isDrawerOpen ? { inert: '' } : {})}
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
            src={productData.image}
            alt={productData.name}
            className={cn(
              'w-full h-full rounded-xl object-cover drop-shadow-md transition-opacity duration-300',
              imageLoading || imageError ? 'opacity-0' : 'opacity-100'
            )}
            loading="lazy"
            onLoad={() => setImageLoading(false)}
            onError={(e) => {
              console.warn(`Image load failed: ${productData.image}`);
              e.target.src = FALLBACK_IMAGE;
              setImageError(true);
              setImageLoading(false);
            }}
          />
        </div>

        {/* Content Section */}
        <div className="flex-grow ml-3 sm:ml-4 flex flex-col justify-between h-full">
          {/* Name and Actions */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="inline-block bg-violet-100 text-violet-600 text-xs px-1.5 py-0.5 rounded-md mb-1">
                {productData.material}
              </span>
              <h3
                className="text-sm sm:text-base font-semibold text-gray-800 max-w-[70%] hover:text-green-600 transition-colors"
                title={productData.name}
              >
                {productData.name}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                onClick={handleRemoveFromWishlist}
                className={cn(
                  'p-2 rounded-full bg-gray-50 border border-gray-200 text-red-500 hover:bg-red-100 hover:text-red-600 transition-all',
                  isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                )}
                title="Remove from Wishlist"
                disabled={isDisabled}
                aria-label="Remove from Wishlist"
              >
                <HeartOff size={18} className="text-red-600" />
              </motion.button>
              <motion.button
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                onClick={handleMoveToCartClick}
                className={cn(
                  'flex items-center gap-1 bg-green-100 border border-green-300 rounded-md px-2 py-1 text-gray-500 hover:bg-green-200 transition-all',
                  isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                )}
                title="Move to Cart"
                disabled={isDisabled}
                aria-label="Move to Cart"
              >
                <span className="text-xs">Move</span>
                <ShoppingCart size={14} />
              </motion.button>
            </div>
          </div>

          {/* Price Details */}
          <div className="flex items-center gap-2 sm:gap-3 mt-2 text-sm sm:text-base">
            <span className="font-semibold text-green-600">₹{discountedPrice.toFixed(2)}</span>
            {(productData.discount > 0 || productData.discountPercentage > 0) && (
              <>
                <span className="text-gray-500 line-through">₹{productData.price.toFixed(2)}</span>
                <span className="text-xs text-green-500 font-medium">
                  {productData.discount > 0 ? `Save ₹${productData.discount.toFixed(2)}` : `Save ${productData.discountPercentage}%`}
                </span>
              </>
            )}
          </div>

          {/* Stock and Sizes */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-sm text-gray-600">
            <span
              className={cn(
                productData.stock === 0 ? 'text-red-500' : isLowStock ? 'text-orange-500' : 'text-gray-500'
              )}
            >
              {productData.stock === 0 ? 'Out of Stock' : isLowStock ? `Only ${productData.stock} left` : `${productData.stock} in stock`}
            </span>
            {productData.sizes.length > 0 && <span>Sizes: {productData.sizes.join(', ')}</span>}
          </div>
        </div>
      </motion.div>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="bg-gray-100/70 backdrop-blur-xl shadow-[0px_15px_50px] max-h-[80vh] rounded-t-3xl">
          <DrawerHeader className="text-center">
            <DrawerTitle className="text-lg font-semibold">Move {productData.name} to Cart</DrawerTitle>
            <DrawerDescription className="text-sm text-gray-500">
              Select options to move {productData.name} to your cart.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(productData.stock, Number(e.target.value) || 1)))}
                type="number"
                min="1"
                max={productData.stock}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Select quantity"
              />
              <p className="text-xs text-gray-500 mt-1">Available: {productData.stock}</p>
            </div>
            {productData.sizes?.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                <div className="flex gap-2 flex-wrap">
                  {productData.sizes.map((size) => (
                    <motion.button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      className={cn(
                        'border rounded-md px-2 py-1 text-sm',
                        selectedSize === size ? 'bg-blue-100 text-blue-600' : 'border-gray-300 bg-white hover:bg-gray-100'
                      )}
                      aria-label={`Select size ${size}`}
                    >
                      {size}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
            {productData.colors?.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {productData.colors.map((color) => (
                    <motion.button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      className={cn(
                        'border rounded-md px-2 py-1 text-sm',
                        selectedColor === color ? 'bg-blue-100 text-blue-600' : 'border-gray-300 bg-white hover:bg-gray-100'
                      )}
                      aria-label={`Select color ${color}`}
                    >
                      {color}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DrawerFooter className="flex justify-between">
            <DrawerClose asChild>
              <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                <Button variant="outline" className="flex-1 text-sm" aria-label="Cancel">
                  Cancel
                </Button>
              </motion.div>
            </DrawerClose>
            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
              <Button
                onClick={handleMoveToCart}
                className={cn(
                  'flex-1 text-sm',
                  !selectedSize || !selectedColor || isUpdating ? 'opacity-50 cursor-not-allowed' : 'bg-green-400 hover:bg-green-700'
                )}
                disabled={isUpdating || !selectedSize || !selectedColor}
                aria-label="Move to Cart"
              >
                {isUpdating ? 'Moving...' : 'Move to Cart'}
              </Button>
            </motion.div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
});

export default WishlistProductCard;