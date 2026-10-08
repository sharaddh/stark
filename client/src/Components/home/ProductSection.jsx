import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { useInView } from 'react-intersection-observer';
import axios from '../useraxios';
import toast from 'react-hot-toast';
import ProductCard from '../ProductCard';
import GenderFilterBar from './GenderFilterBar';
import { DataContext } from '../../DataProvider';

const FALLBACK_IMAGE = 'https://via.placeholder.com/150?text=No+Image';

const ProductSkeleton = () => (
  <div className="w-full h-64 bg-gray-200 rounded-lg animate-pulse" />
);

const ProductSection = React.memo(({ filteredProducts = [], setFilteredProducts, onGenderChange, selectedGender }) => {
  const { cache, updateCache } = useContext(DataContext);
  const [page, setPage] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { ref: sentinelRef, inView } = useInView({ threshold: 0, rootMargin: '200px' });

  // Safely fallback data from cache
  const cachedProducts = cache?.products?.data ?? [];
  const wishlist = cache?.wishlist?.data ?? [];
  const cart = cache?.cart?.data ?? [];

  const validFilteredProducts = useMemo(() => {
    const seenIds = new Set();
    return filteredProducts.filter((product) => {
      if (!product?._id) return false;
      if (seenIds.has(product._id)) return false;
      seenIds.add(product._id);
      product.image = product.image && typeof product.image === 'string' && product.image.trim() !== ''
        ? product.image
        : FALLBACK_IMAGE;
      return true;
    });
  }, [filteredProducts]);

  const loadMoreProducts = useCallback(async () => {
    if (isFetching || !hasMore) return;
    setIsFetching(true);
    try {
      const response = await axios.get('/api/user/auth/products', {
        params: { page: page + 1, limit: 20 },
      });
      const newProducts = (response.data.products || []).map((product) => ({
        ...product,
        image: product.image && typeof product.image === 'string' && product.image.trim() !== ''
          ? product.image
          : FALLBACK_IMAGE,
      }));

      if (newProducts.length < 20) {
        setHasMore(false);
      }

      const combinedProducts = [...cachedProducts, ...newProducts];
      updateCache('products', combinedProducts);

      setFilteredProducts((prev) => {
        const prevIds = new Set(prev.map((p) => p._id));
        const uniqueNewProducts = newProducts.filter((p) => p._id && !prevIds.has(p._id));
        return [...prev, ...uniqueNewProducts];
      });

      setPage((prev) => prev + 1);
    } catch {
      toast.error('Failed to load more products');
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, hasMore, page, cachedProducts, updateCache, setFilteredProducts]);

  useEffect(() => {
    let timeout;
    if (inView && !isFetching && hasMore) {
      timeout = setTimeout(() => loadMoreProducts(), 300);
    }
    return () => clearTimeout(timeout);
  }, [inView, isFetching, hasMore, loadMoreProducts]);

  if (!cachedProducts.length) {
    return (
      <div className="w-full flex flex-col">
        <GenderFilterBar onGenderChange={onGenderChange} selectedGender={selectedGender} />
        <div className="grid gap-4 p-4 grid-cols-2">
          {Array(3).fill().map((_, i) => (
            <ProductSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      </div>
    );
  }

  if (validFilteredProducts.length === 0) {
    return (
      <div className="w-full flex flex-col">
        <GenderFilterBar onGenderChange={onGenderChange} selectedGender={selectedGender} />
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-gray-600 text-center">No products available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col mb-4">
      <GenderFilterBar onGenderChange={onGenderChange} selectedGender={selectedGender} />
      <div className="grid pt-5 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 m-auto">
        {validFilteredProducts.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            wishlist={wishlist}
            cart={cart}
            wishlistLoading={false}
            cartLoading={false}
            wishlistError={null}
            cartError={null}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="h-10">
        {isFetching && (
          <div className="flex justify-center py-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {!hasMore && validFilteredProducts.length > 0 && (
          <p className="text-gray-600 text-center py-4">No more products to load.</p>
        )}
      </div>
    </div>
  );
});

export default ProductSection;
