import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, HeartOff, ShoppingCart, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { debounce } from 'lodash';
import axios from '../useraxios';
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

const ProductCard = React.memo(({ product = {}, wishlist = [], cart = [], onAddToCart = () => {} }) => {
  const [isWishlisted, setIsWishlisted] = useState(wishlist.includes(String(product._id)));
  const [isInCart, setIsInCart] = useState(cart.includes(String(product._id)));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [productDetails, setProductDetails] = useState(null);
  const [, setFetchError] = useState(null);
  const navigate = useNavigate();

  const { _id } = product;

  // Memoize product details to prevent unnecessary re-renders
  const productData = useMemo(() => ({
    name: productDetails?.name || product.name || 'Product',
    description: productDetails?.description || product.description || 'Lorem ipsum dolor sit amet',
    price: productDetails?.price || product.price || 225,
    images: productDetails?.images || product.images || [],
    sizes: productDetails?.sizes || product.sizes || ['L', 'X', 'XL'],
    colors: productDetails?.colors || product.colors || [],
    material: productDetails?.material || product.material || 'Polyester',
    discount: productDetails?.discount || product.discount || 0,
    discountPercentage: productDetails?.discountPercentage || product.discountPercentage || 0,
    quantityAvailable: productDetails?.quantityAvailable || product.quantityAvailable || 10,
  }), [product, productDetails]);

  // Calculate discounted price
  const discountedPrice = useMemo(() => 
    productData.discount > 0
      ? productData.price - productData.discount
      : productData.discountPercentage > 0
      ? productData.price * (1 - productData.discountPercentage / 100)
      : productData.price,
  [productData.price, productData.discount, productData.discountPercentage]);

  // Memoize display image
  const displayImage = useMemo(() => 
    Array.isArray(productData.images) && productData.images[0] 
      ? productData.images[0].replace(/^http:/, 'https:') 
      : placeholderImage,
  [productData.images]);

  // Debounced API call for fetching product details
  const fetchProductDetails = useCallback(debounce(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await axios.get(`/api/user/auth/products/${id}`);
      setProductDetails(response.data.product);
    } catch (error) {
      setFetchError(error.response?.data?.message || 'Failed to load product details');
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  }, 300), []);

  useEffect(() => {
    fetchProductDetails(_id);
    return () => fetchProductDetails.cancel(); // Cleanup debounce
  }, [_id, fetchProductDetails]);

  useEffect(() => {
    setIsWishlisted(wishlist.includes(String(_id)));
    setIsInCart(cart.includes(String(_id)));
  }, [wishlist, cart, _id]);

  // Debounced wishlist toggle
  const handleToggleWishlist = useCallback(debounce(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login to update wishlist');
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      await axios.put(`/api/user/auth/wishlist/${_id}`);
      setIsWishlisted((prev) => !prev);
      toast.success(!isWishlisted ? 'Added to Wishlist' : 'Removed from Wishlist');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Wishlist update failed');
    } finally {
      setLoading(false);
    }
  }, 300), [_id, isWishlisted, navigate]);

  const handleAddToCartClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login to add to cart');
      return;
    }
    if (isInCart) return navigate('/cart');
    setSelectedSize(productData.sizes[0] || '');
    setSelectedColor(productData.colors[0] || '');
    setIsDrawerOpen(true);
  }, [isInCart, navigate, productData.sizes, productData.colors]);

  // Debounced add to cart
  const handleAddToCart = useCallback(debounce(async () => {
    if (!selectedSize || !selectedColor) {
      toast.error('Select size and color');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      const payload = { productId: _id, quantity, size: selectedSize, color: selectedColor };
      await axios.post('/api/user/auth/cart/add', payload);
      setIsInCart(true);
      setIsDrawerOpen(false);
      onAddToCart(_id);
      toast.success('Added to Cart');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add to cart');
    } finally {
      setLoading(false);
    }
  }, 300), [_id, quantity, selectedSize, selectedColor, navigate, onAddToCart]);

  const handleProductClick = useCallback(() => navigate(`/product/${_id}`), [_id, navigate]);

  if (!_id) return <div className="w-48 p-4 text-center text-sm text-gray-500">Invalid Product</div>;

  return (
    <div
      className="w-[185px] p-3 flex flex-col rounded-xl drop-shadow-sm bg-white"
      aria-label={`Product: ${productData.name}`}
    >
      <div className="relative w-full h-40 mb-3 rounded" onClick={handleProductClick}>
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <img
          src={displayImage}
          alt={productData.name}
          className={cn(
            'w-full h-full rounded-xl drop-shadow-md object-cover transition-opacity duration-300',
            imageLoading ? 'opacity-0' : 'opacity-100'
          )}
          loading="lazy"
          onLoad={() => setImageLoading(false)}
          onError={(e) => {
            e.target.src = placeholderImage;
            setImageLoading(false);
          }}
        />
        <button
          onClick={handleToggleWishlist}
          className="absolute top-2 right-2 text-gray-500"
          disabled={loading}
          aria-label={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        >
          {isWishlisted ? (
            <Heart size={20} className="text-red-600 fill-red-600" />
          ) : (
            <Heart size={20} />
          )}
        </button>
        <button
          onClick={handleAddToCartClick}
          className="absolute -bottom-3 right-0 bg-green-100 border border-green-300 flex items-center gap-1 rounded-md px-2 py-1 text-gray-500"
          disabled={loading}
          aria-label={isInCart ? 'Go to Cart' : 'Add to Cart'}
        >
          <span className="text-xs">{isInCart ? 'In Cart' : 'Add'}</span>
          {isInCart ? <CheckCircle size={14} className="text-green-600" /> : <ShoppingCart size={14} />}
        </button>
      </div>
      <div className="flex-1">
        <span className="inline-block bg-violet-100 text-violet-600 text-xs px-1.5 py-0.5 rounded-md mb-1">
          {productData.material}
        </span>
        <h3 className="text-sm font-semibold text-gray-800 truncate" title={productData.name}>
          {productData.name}
        </h3>
        <p className="text-xs text-gray-600 truncate">{productData.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-semibold text-sm text-black">₹{Math.round(discountedPrice)}</span>
          {(productData.discount > 0 || productData.discountPercentage > 0) && (
            <>
              <span className="text-xs text-gray-500 line-through">₹{Math.round(productData.price)}</span>
              <span className="text-xs text-green-600 font-medium">
                {productData.discount > 0 ? `₹${Math.round(productData.discount)} OFF` : `${productData.discountPercentage}% OFF`}
              </span>
            </>
          )}
        </div>
        {productData.sizes?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {productData.sizes.map((s) => (
              <span key={s} className="bg-gray-100 text-xs text-gray-600 px-2 py-0.5 rounded">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="bg-white p-4 rounded-t-3xl max-h-[80vh] overflow-y-auto">
          <DrawerHeader className="text-center">
            <DrawerTitle className="text-lg font-semibold">Add {productData.name} to Cart</DrawerTitle>
            <DrawerDescription className="text-sm text-gray-500">
              Select options to add {productData.name} to your cart.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(productData.quantityAvailable, Number(e.target.value) || 1)))}
                type="number"
                min="1"
                max={productData.quantityAvailable}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Available: {productData.quantityAvailable}</p>
            </div>
            {productData.sizes?.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                <div className="flex gap-2 flex-wrap">
                  {productData.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={cn(
                        'border rounded-md px-2 py-1 text-sm',
                        selectedSize === size ? 'bg-blue-100 text-blue-600' : 'border-gray-300 bg-white'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {productData.colors?.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {productData.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        'border rounded-md px-2 py-1 text-sm',
                        selectedColor === color ? 'bg-blue-100 text-blue-600' : 'border-gray-300 bg-white'
                      )}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DrawerFooter className="flex justify-between mt-4">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1 text-sm">
                Cancel
              </Button>
            </DrawerClose>
            <Button
              onClick={handleAddToCart}
              className={cn(
                'flex-1 text-sm',
                !selectedSize || !selectedColor || loading ? 'opacity-50 cursor-not-allowed' : 'bg-green-400 hover:bg-green-600'
              )}
              disabled={loading || !selectedSize || !selectedColor}
            >
              {loading ? 'Adding...' : 'Add to Cart'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
});

export default ProductCard;