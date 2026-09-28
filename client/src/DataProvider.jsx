import React, { createContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from './useraxios';

export const DataContext = createContext();

const STALE_TIME = 10 * 60 * 1000;

export const DataProvider = ({ children }) => {
  const [cache, setCache] = useState({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const isFetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const updateCache = useCallback((key, data) => {
    setCache(prev => ({ ...prev, [key]: { data, timestamp: Date.now() } }));
  }, []);

  const isDataStale = useCallback((timestamp) => {
    return !timestamp || Date.now() - timestamp > STALE_TIME;
  }, []);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (isFetchingRef.current) return;

    const controller = new AbortController();
    isFetchingRef.current = true;

    axios.get('/api/user/auth/initial-data', { signal: controller.signal })
      .then(({ data }) => {
        const DEFAULT_COMBO_IMAGE = 'https://your-server.com/generic-combo-placeholder.jpg';
        const normalize = (p) => ({
          ...p,
          image: p.image && p.image !== 'https://via.placeholder.com/150' ? p.image : DEFAULT_COMBO_IMAGE,
        });

        const updates = {};
        updates.layout = { data: data.layout?.components || [], timestamp: Date.now() };
        updates.products = { data: (data.products || []).map(normalize), timestamp: Date.now() };
        updates.sellers = { data: data.sellers || [], timestamp: Date.now() };
        // These two are read by CategorySection / CategoryFilterBar / CartSection via
        // cache.categories?.data and cache.cart?.data. They were never written here, so
        // those sections rendered "No categories available." and an empty cart even
        // though the API returned the data.
        updates.categories = { data: data.categories || [], timestamp: Date.now() };
        updates.cart = { data: data.cart || [], timestamp: Date.now() };
        updates.comboOffers = {
          data: (data.comboOffers || [])
            .filter(o => o?._id && Array.isArray(o.products) && o.products.length >= 2)
            .map(o => ({ ...o, products: (o.products || []).map(p => ({
              ...p,
              images: (p.images || []).map(img => img && img !== 'https://via.placeholder.com/150' ? img : DEFAULT_COMBO_IMAGE),
            }))})),
          timestamp: Date.now(),
        };
        updates.banner = { data: data.banner || { url: DEFAULT_COMBO_IMAGE }, timestamp: Date.now() };
        updates.searchSuggestions = { data: data.searchSuggestions || {}, timestamp: Date.now() };
        updates.trendingSearches = { data: data.trendingSearches || {}, timestamp: Date.now() };
        updates.categoryProducts = { data: data.categoryProducts || {}, timestamp: Date.now() };
        updates.recentlyViewed = { data: data.recentlyViewed || [], timestamp: Date.now() };
        updates.sponsoredProducts = { data: (data.sponsoredProducts || []).map(normalize), timestamp: Date.now() };
        updates.trendingProducts = { data: (data.trendingProducts || []).map(normalize), timestamp: Date.now() };

        const ads = data.ads || [];
        updates.singleAds = { data: ads.find(a => a.type === 'Single Ad')?.images || [], timestamp: Date.now() };
        updates.doubleAds = { data: ads.find(a => a.type === 'Double Ad')?.images || [], timestamp: Date.now() };
        updates.tripleAds = { data: ads.find(a => a.type === 'Triple Ad')?.images || [], timestamp: Date.now() };

        setCache(prev => {
          const merged = { ...prev };
          for (const [key, value] of Object.entries(updates)) {
            const existing = merged[key];
            // An explicit refreshData() must win over the staleness gate, otherwise the
            // refetch would fetch fresh data and then throw it away.
            if (refreshToken > 0 || !existing || (Date.now() - (existing.timestamp || 0)) > STALE_TIME) {
              merged[key] = value;
            }
          }
          return merged;
        });

        hasInitializedRef.current = true;
      })
      .catch(err => {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Initial data fetch failed:', err);
        }
      })
      .finally(() => {
        isFetchingRef.current = false;
        setIsInitialLoading(false);
      });

    return () => controller.abort();
  }, [refreshToken]);

  const contextValue = useMemo(() => ({
    cache,
    updateCache,
    isDataStale,
    isLoading: isInitialLoading,
    // Bumping this counter is what actually re-runs the fetch effect. The old version
    // only cleared the refs, but the effect has [] dependencies so it never fired again
    // and the cache kept serving whatever it had on mount.
    refreshData: () => {
      hasInitializedRef.current = false;
      isFetchingRef.current = false;
      setRefreshToken((n) => n + 1);
    },
  }), [cache, updateCache, isDataStale, isInitialLoading]);

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
};
