import { configureStore, createSlice } from '@reduxjs/toolkit';
import axios from './useraxios';
import { toast } from 'react-hot-toast';

const dataSlice = createSlice({
  name: 'data',
  initialState: {
    cache: {
      products: { data: [], timestamp: null, skeletonCount: 4 },
      searchSuggestions: { data: { recentSearches: [], categories: [], sellers: [], products: [] }, timestamp: null },
      trendingSearches: { data: { trendingSearches: [], topSellers: [], topCategories: [], topProducts: [] }, timestamp: null },
      singleAds: { data: [], timestamp: null, skeletonCount: 1 },
      doubleAds: { data: [], timestamp: null, skeletonCount: 2 },
      tripleAds: { data: [], timestamp: null, skeletonCount: 3 },
      sponsoredProducts: { data: [], timestamp: null, skeletonCount: 4 },
      trendingProducts: { data: [], timestamp: null, skeletonCount: 4 },
      recentlyViewed: { data: [], timestamp: null },
      categories: { data: [], timestamp: null, skeletonCount: 6 },
      sellers: { data: [], timestamp: null, skeletonCount: 4 },
      banner: { data: {}, timestamp: null },
      comboOffers: { data: [], timestamp: null, skeletonCount: 4 },
      layout: { data: [], timestamp: null },
    },
    isInitialLoading: false,
    isFetching: false,
    errors: { general: null, suggestions: null, trending: null },
  },
  reducers: {
    updateCache(state, action) {
      const { key, data } = action.payload;
      state.cache[key] = { data, timestamp: Date.now() };
    },
    setInitialLoading(state, action) {
      state.isInitialLoading = action.payload;
    },
    setFetching(state, action) {
      state.isFetching = action.payload;
    },
    setError(state, action) {
      state.errors = { ...state.errors, ...action.payload };
    },
    clearRecentSearches(state) {
      state.cache.searchSuggestions.data.recentSearches = [];
      state.cache.searchSuggestions.timestamp = Date.now();
    },
    removeRecentSearch(state, action) {
      const searchText = action.payload;
      state.cache.searchSuggestions.data.recentSearches = state.cache.searchSuggestions.data.recentSearches.filter(
        (search) => (typeof search === 'string' ? search : search.query || 'Unknown') !== searchText
      );
      state.cache.searchSuggestions.timestamp = Date.now();
    },
  },
});

const categoriesSlice = createSlice({
  name: 'categories',
  initialState: {
    categoryProducts: {},
    isLoading: false,
    error: null,
  },
  reducers: {
    setCategoryProducts(state, action) {
      const { categoryId, products } = action.payload;
      state.categoryProducts[categoryId] = products;
    },
    setCategoryLoading(state, action) {
      state.isLoading = action.payload;
    },
    setCategoryError(state, action) {
      state.error = action.payload;
    },
  },
});

const searchSlice = createSlice({
  name: 'search',
  initialState: {
    searchQuery: '',
    filteredProducts: [],
    selectedGender: 'all',
    isSearching: false,
    searchError: null,
    productPage: 1,
    hasMore: true,
  },
  reducers: {
    setSearchQuery(state, action) {
      state.searchQuery = action.payload;
      if (process.env.NODE_ENV === 'development') {
        console.log('setSearchQuery:', action.payload);
      }
    },
    setFilteredProducts(state, action) {
      state.filteredProducts = action.payload;
    },
    setSelectedGender(state, action) {
      state.selectedGender = action.payload;
    },
    setSearchLoading(state, action) {
      state.isSearching = action.payload;
    },
    setSearchError(state, action) {
      state.searchError = action.payload;
    },
    incrementProductPage(state) {
      state.productPage += 1;
    },
    resetProductPage(state) {
      state.productPage = 1;
    },
    setHasMore(state, action) {
      state.hasMore = action.payload;
    },
  },
});

const cartSlice = createSlice({
  name: 'cart',
  initialState: { cartItems: [], isLoading: false, error: null },
  reducers: {
    setCartItems(state, action) { state.cartItems = action.payload; },
    setCartLoading(state, action) { state.isLoading = action.payload; },
    setCartError(state, action) { state.error = action.payload; },
  },
});

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: { items: [], isLoading: false, error: null },
  reducers: {
    setWishlistItems(state, action) { state.items = action.payload; },
    setWishlistLoading(state, action) { state.isLoading = action.payload; },
    setWishlistError(state, action) { state.error = action.payload; },
  },
});

const userSlice = createSlice({
  name: 'user',
  initialState: { profile: null, isLoading: false, error: null },
  reducers: {
    setProfile(state, action) { state.profile = action.payload; },
    setUserLoading(state, action) { state.isLoading = action.payload; },
    setUserError(state, action) { state.error = action.payload; },
  },
});

export const { updateCache, setInitialLoading, setFetching, setError, clearRecentSearches, removeRecentSearch } = dataSlice.actions;
export const { setCategoryProducts, setCategoryLoading, setCategoryError } = categoriesSlice.actions;
export const { setSearchQuery, setFilteredProducts, setSelectedGender, setSearchLoading, setSearchError, incrementProductPage, resetProductPage, setHasMore } = searchSlice.actions;
export const { setCartItems, setCartLoading, setCartError } = cartSlice.actions;
export const { setWishlistItems, setWishlistLoading, setWishlistError } = wishlistSlice.actions;
export const { setProfile, setUserLoading, setUserError } = userSlice.actions;

const DEFAULT_IMAGE = 'https://res.cloudinary.com/your-cloud/image/upload/v123/default-product.jpg';

export const fetchCriticalData = (force = false) => async (dispatch, getState) => {
  const { cache } = getState().data;
  const isDataStale = (timestamp) => !timestamp || Date.now() - timestamp > 10 * 60 * 1000;
  const needsFetch = force || Object.values(cache).some((entry) => !entry.data?.length || isDataStale(entry.timestamp));
  if (!needsFetch) return;

  dispatch(setInitialLoading(true));
  dispatch(setError({ general: null }));

  try {
    const response = await axios.get('/api/user/auth/initial-data', { params: { limit: 20 } });
    if (process.env.NODE_ENV === 'development') {
      console.log('fetchCriticalData response:', response.data);
    }
    const data = response.data;
    const normalizeImages = (p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      gender: p.gender,
      image: p.image?.trim() || (Array.isArray(p.images) && p.images[0] ? p.images[0] : DEFAULT_IMAGE),
      images: Array.isArray(p.images) ? p.images.filter(img => img && img !== 'https://via.placeholder.com/150').slice(0, 3) : [DEFAULT_IMAGE],
    });

    const normalizedData = {
      layout: data.layout?.components || [],
      products: (data.products || []).map(normalizeImages),
      sellers: (data.sellers || []).map(s => ({ ...s, skeletonCount: 4 })),
      categories: (data.categories || []).map(c => ({ ...c, skeletonCount: 6 })),
      comboOffers: (data.comboOffers || []).map(co => ({ ...co, skeletonCount: 4 })),
      sponsoredProducts: (data.sponsoredProducts || []).map(normalizeImages),
      singleAds: (data.ads?.find((ad) => ad.type === 'Single Ad')?.images || []).map((img) => ({
        ...img,
        url: img.url && img.url !== 'https://via.placeholder.com/150' ? img.url : DEFAULT_IMAGE,
        skeletonCount: 1,
      })),
      doubleAds: (data.ads?.find((ad) => ad.type === 'Double Ad')?.images || []).map((img) => ({
        ...img,
        url: img.url && img.url !== 'https://via.placeholder.com/150' ? img.url : DEFAULT_IMAGE,
        skeletonCount: 2,
      })),
      tripleAds: (data.ads?.find((ad) => ad.type === 'Triple Ad')?.images || []).map((img) => ({
        ...img,
        url: img.url && img.url !== 'https://via.placeholder.com/150' ? img.url : DEFAULT_IMAGE,
        skeletonCount: 3,
      })),
      trendingProducts: (data.trendingProducts || []).map(normalizeImages),
      banner: data.banner || { url: DEFAULT_IMAGE },
      searchSuggestions: data.searchSuggestions || {
        recentSearches: [], categories: [], sellers: [], products: [],
      },
      trendingSearches: data.trendingSearches || {
        trendingSearches: [], topSellers: [], topCategories: [], topProducts: [],
      },
      recentlyViewed: data.recentlyViewed || [],
    };

    Object.entries(normalizedData).forEach(([key, value]) => {
      dispatch(updateCache({ key, data: value }));
    });
    dispatch(setFilteredProducts(normalizedData.products));
    dispatch(setHasMore(data.hasMore ?? normalizedData.products.length >= 20));
    if (process.env.NODE_ENV === 'development') {
      console.log('fetchCriticalData state update:', { products: normalizedData.products, hasMore: data.hasMore });
    }
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to load homepage data';
    dispatch(setError({ general: errorMsg }));
    toast.error(errorMsg);
    console.error('fetchCriticalData error:', error);
  } finally {
    dispatch(setInitialLoading(false));
  }
};

export const fetchCategoryProducts = (categoryId) => async (dispatch) => {
  dispatch(setCategoryLoading(true));
  try {
    const userToken = localStorage.getItem('token');
    const response = await axios.get('/api/user/auth/products', {
      params: { categoryId, limit: 10, page: 1 },
      headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
    });
    const data = response.data;
    const normalizeImages = (p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      gender: p.gender,
      image: p.image?.trim() || (Array.isArray(p.images) && p.images[0] ? p.images[0] : DEFAULT_IMAGE),
      images: Array.isArray(p.images) ? p.images.filter(img => img && img !== 'https://via.placeholder.com/150').slice(0, 3) : [DEFAULT_IMAGE],
    });
    const products = (data.products || []).map(normalizeImages);
    dispatch(setCategoryProducts({ categoryId, products }));
    dispatch(setCategoryError(null));
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to fetch category products';
    dispatch(setCategoryError(errorMsg));
    toast.error(errorMsg);
    console.error('fetchCategoryProducts error:', error);
  } finally {
    dispatch(setCategoryLoading(false));
  }
};

export const fetchSearchSuggestions = (query) => async (dispatch, getState) => {
  if (!query.trim()) return;
  dispatch(setFetching(true));
  try {
    const userToken = localStorage.getItem('token');
    const isTokenValid = userToken && typeof userToken === 'string' && userToken.length > 0;
    const endpoint = '/api/user/auth/search/suggestions';
    console.log('Fetching search suggestions:', {
      url: `${axios.defaults.baseURL || 'No baseURL set'}${endpoint}`,
      query,
      headers: isTokenValid ? { Authorization: `Bearer ${userToken}` } : {},
    });
    const response = await axios.get(endpoint, {
      params: { q: query, limit: 5 },
      headers: isTokenValid ? { Authorization: `Bearer ${userToken}` } : {},
    });
    const data = response.data;
    const normalizeImages = (p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      gender: p.gender,
      image: p.image?.trim() || (Array.isArray(p.images) && p.images[0] ? p.images[0] : DEFAULT_IMAGE),
      images: Array.isArray(p.images) ? p.images.filter(img => img && img !== 'https://via.placeholder.com/150').slice(0, 3) : [DEFAULT_IMAGE],
    });
    dispatch(updateCache({
      key: 'searchSuggestions',
      data: {
        recentSearches: data.recentSearches || [],
        categories: data.categories || [],
        sellers: data.sellers || [],
        products: (data.products || []).map(normalizeImages),
      },
    }));
    dispatch(setError({ suggestions: null }));
  } catch (error) {
    let errorMsg = 'Failed to fetch search suggestions';
    if (error.response?.status === 404) {
      errorMsg = `Search suggestions endpoint not found: ${error.config.url}`;
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      errorMsg = 'Authentication failed for search suggestions';
      localStorage.removeItem('token');
    } else {
      errorMsg = error.response?.data?.message || errorMsg;
    }
    dispatch(setError({ suggestions: errorMsg }));
    toast.error(errorMsg);
    console.error('fetchSearchSuggestions error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message,
      error,
    });
  } finally {
    dispatch(setFetching(false));
  }
};

export const fetchTrendingSearches = () => async (dispatch, getState) => {
  dispatch(setFetching(true));
  try {
    const userToken = localStorage.getItem('token');
    const isTokenValid = userToken && typeof userToken === 'string' && userToken.length > 0;
    const endpoint = '/api/user/auth/search/trending';

    console.log('Fetching trending searches:', {
      url: `${axios.defaults.baseURL || 'No baseURL set'}${endpoint}`,
      headers: isTokenValid ? { Authorization: `Bearer ${userToken}` } : {},
      isTokenValid,
    });

    const response = await axios.get(endpoint, {
      headers: isTokenValid ? { Authorization: `Bearer ${userToken}` } : {},
    });
    const data = response.data;
    const normalizeImages = (p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      gender: p.gender,
      image: p.image?.trim() || (Array.isArray(p.images) && p.images[0] ? p.images[0] : DEFAULT_IMAGE),
      images: Array.isArray(p.images) ? p.images.filter(img => img && img !== 'https://via.placeholder.com/150').slice(0, 3) : [DEFAULT_IMAGE],
    });
    const normalizedData = {
      trendingSearches: data.trendingSearches || [],
      topSellers: data.topSellers || [],
      topCategories: data.topCategories || [],
      topProducts: (data.topProducts || []).map(normalizeImages),
    };
    dispatch(updateCache({
      key: 'trendingSearches',
      data: normalizedData,
    }));
    dispatch(setError({ trending: null }));
    if (process.env.NODE_ENV === 'development') {
      console.log('fetchTrendingSearches success:', normalizedData);
    }
  } catch (error) {
    let errorMsg = 'Failed to fetch trending searches';
    if (error.response?.status === 404) {
      errorMsg = `Trending searches endpoint not found: ${error.config.url}`;
      dispatch(updateCache({
        key: 'trendingSearches',
        data: {
          trendingSearches: [],
          topSellers: [],
          topCategories: [],
          topProducts: [],
        },
      }));
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      errorMsg = 'Authentication failed. Please log in again.';
      localStorage.removeItem('token');
      try {
        console.log('Retrying with public endpoint: /api/user/auth/search/trending');
        const response = await axios.get('/api/user/auth/search/trending');
        const data = response.data;
        const normalizeImages = (p) => ({
          _id: p._id,
          name: p.name,
          price: p.price,
          gender: p.gender,
          image: p.image?.trim() || (Array.isArray(p.images) && p.images[0] ? p.images[0] : DEFAULT_IMAGE),
          images: Array.isArray(p.images) ? p.images.filter(img => img && img !== 'https://via.placeholder.com/150').slice(0, 3) : [DEFAULT_IMAGE],
        });
        dispatch(updateCache({
          key: 'trendingSearches',
          data: {
            trendingSearches: data.trendingSearches || [],
            topSellers: data.topSellers || [],
            topCategories: data.topCategories || [],
            topProducts: (data.topProducts || []).map(normalizeImages),
          },
        }));
        dispatch(setError({ trending: null }));
      } catch (publicError) {
        errorMsg = `Public trending searches endpoint failed: ${publicError.config.url}`;
        dispatch(updateCache({
          key: 'trendingSearches',
          data: {
            trendingSearches: [],
            topSellers: [],
            topCategories: [],
            topProducts: [],
          },
        }));
        dispatch(setError({ trending: errorMsg }));
        toast.error(errorMsg);
        console.error('fetchTrendingSearches public endpoint error:', {
          url: publicError.config?.url,
          status: publicError.response?.status,
          message: publicError.response?.data?.message,
          error: publicError,
        });
      }
    } else {
      errorMsg = error.response?.data?.message || errorMsg;
      dispatch(setError({ trending: errorMsg }));
      toast.error(errorMsg);
    }
    console.error('fetchTrendingSearches error details:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message,
      error,
    });
  } finally {
    dispatch(setFetching(false));
  }
};

export const saveSearch = (query) => async (dispatch, getState) => {
  if (!query.trim()) return;
  try {
    const userToken = localStorage.getItem('token');
    const { searchSuggestions } = getState().data.cache;
    let recentSearches = [...(searchSuggestions.data.recentSearches || [])];
    if (!recentSearches.includes(query)) {
      recentSearches = [query, ...recentSearches].slice(0, 10);
      dispatch(updateCache({
        key: 'searchSuggestions',
        data: { ...searchSuggestions.data, recentSearches },
      }));
      if (userToken) {
        await axios.post('/api/user/auth/search/recent', { query }, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
      }
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('saveSearch:', { query, recentSearches });
    }
  } catch (error) {
    console.error('saveSearch error:', error);
  }
};

export const searchProducts = (query) => async (dispatch, getState) => {
  dispatch(setSearchQuery(query));
  if (!query.trim()) {
    const { cache } = getState().data;
    dispatch(setFilteredProducts(cache.products?.data || []));
    dispatch(resetProductPage());
    dispatch(setHasMore(true));
    dispatch(setSearchError(null));
    return { products: cache.products?.data || [], hasMore: true };
  }
  dispatch(setSearchLoading(true));
  try {
    const userToken = localStorage.getItem('token');
    const isTokenValid = userToken && typeof userToken === 'string' && userToken.length > 0;
    const endpoint = '/api/user/auth/products';
    console.log('searchProducts request:', {
      url: `${axios.defaults.baseURL || 'No baseURL set'}${endpoint}`,
      query,
      headers: isTokenValid ? { Authorization: `Bearer ${userToken}` } : {},
    });
    const response = await axios.get(endpoint, {
      params: { q: query, limit: 20, page: 1 },
      headers: isTokenValid ? { Authorization: `Bearer ${userToken}` } : {},
    });
    const data = response.data;
    const normalizeImages = (p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      gender: p.gender,
      image: p.image?.trim() || (Array.isArray(p.images) && p.images[0] ? p.images[0] : DEFAULT_IMAGE),
      images: Array.isArray(p.images) ? p.images.filter(img => img && img !== 'https://via.placeholder.com/150').slice(0, 3) : [DEFAULT_IMAGE],
    });
    const filtered = (data.products || []).map(normalizeImages);
    dispatch(setFilteredProducts(filtered));
    dispatch(resetProductPage());
    dispatch(setHasMore(data.hasMore ?? filtered.length >= 20));
    dispatch(setSearchError(null));
    if (process.env.NODE_ENV === 'development') {
      console.log('searchProducts success:', { products: filtered, hasMore: data.hasMore });
    }
    return { products: filtered, hasMore: data.hasMore ?? filtered.length >= 20 };
  } catch (error) {
    let errorMsg = 'Failed to search products';
    if (error.response?.status === 404) {
      errorMsg = `Search endpoint not found: ${error.config.url}`;
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      errorMsg = 'Authentication failed. Please log in again.';
      localStorage.removeItem('token');
      try {
        console.log('Retrying with public endpoint: /api/user/auth/products');
        const response = await axios.get('/api/user/auth/products', {
          params: { q: query, limit: 20, page: 1 },
        });
        const data = response.data;
        const normalizeImages = (p) => ({
          _id: p._id,
          name: p.name,
          price: p.price,
          gender: p.gender,
          image: p.image?.trim() || (Array.isArray(p.images) && p.images[0] ? p.images[0] : DEFAULT_IMAGE),
          images: Array.isArray(p.images) ? p.images.filter(img => img && img !== 'https://via.placeholder.com/150').slice(0, 3) : [DEFAULT_IMAGE],
        });
        const filtered = (data.products || []).map(normalizeImages);
        dispatch(setFilteredProducts(filtered));
        dispatch(resetProductPage());
        dispatch(setHasMore(data.hasMore ?? filtered.length >= 20));
        dispatch(setSearchError(null));
        return { products: filtered, hasMore: data.hasMore ?? filtered.length >= 20 };
      } catch (publicError) {
        errorMsg = `Public search endpoint failed: ${publicError.config.url}`;
        dispatch(setSearchError(errorMsg));
        toast.error(errorMsg);
        console.error('searchProducts public endpoint error:', {
          url: publicError.config?.url,
          status: publicError.response?.status,
          message: publicError.response?.data?.message,
          error: publicError,
        });
      }
    } else {
      errorMsg = error.response?.data?.message || errorMsg;
      dispatch(setSearchError(errorMsg));
      toast.error(errorMsg);
    }
    console.error('searchProducts error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message,
      error,
    });
    const { cache } = getState().data;
    dispatch(setFilteredProducts(cache.products?.data || []));
    dispatch(setHasMore(false));
    return { products: [], hasMore: false };
  } finally {
    dispatch(setSearchLoading(false));
  }
};

export const fetchMoreProducts = () => async (dispatch, getState) => {
  const { searchQuery, productPage, filteredProducts, hasMore } = getState().search;
  if (!hasMore) return { products: [], hasMore: false };
  dispatch(setSearchLoading(true));
  try {
    const userToken = localStorage.getItem('token');
    const isTokenValid = userToken && typeof userToken === 'string' && userToken.length > 0;
    const endpoint = '/api/user/auth/products';
    console.log('fetchMoreProducts request:', {
      url: `${axios.defaults.baseURL || 'No baseURL set'}${endpoint}`,
      query: searchQuery,
      page: productPage + 1,
      headers: isTokenValid ? { Authorization: `Bearer ${userToken}` } : {},
    });
    const response = await axios.get(endpoint, {
      params: { q: searchQuery, limit: 10, page: productPage + 1 },
      headers: isTokenValid ? { Authorization: `Bearer ${userToken}` } : {},
    });
    const data = response.data;
    const normalizeImages = (p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      gender: p.gender,
      image: p.image?.trim() || (Array.isArray(p.images) && p.images[0] ? p.images[0] : DEFAULT_IMAGE),
      images: Array.isArray(p.images) ? p.images.filter(img => img && img !== 'https://via.placeholder.com/150').slice(0, 3) : [DEFAULT_IMAGE],
    });
    const newProducts = (data.products || []).map(normalizeImages);
    const newHasMore = data.hasMore ?? newProducts.length >= 10;
    if (newProducts.length > 0) {
      dispatch(setFilteredProducts([...filteredProducts, ...newProducts]));
      dispatch(incrementProductPage());
    }
    dispatch(setHasMore(newHasMore));
    if (process.env.NODE_ENV === 'development') {
      console.log('fetchMoreProducts success:', { products: newProducts, hasMore: newHasMore });
    }
    return { products: newProducts, hasMore: newHasMore };
  } catch (error) {
    let errorMsg = 'Failed to load more products';
    if (error.response?.status === 404) {
      errorMsg = `More products endpoint not found: ${error.config.url}`;
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      errorMsg = 'Authentication failed. Please log in again.';
      localStorage.removeItem('token');
    } else {
      errorMsg = error.response?.data?.message || errorMsg;
    }
    dispatch(setSearchError(errorMsg));
    toast.error(errorMsg);
    console.error('fetchMoreProducts error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message,
      error,
    });
    dispatch(setHasMore(false));
    return { products: [], hasMore: false };
  } finally {
    dispatch(setSearchLoading(false));
  }
};

export const updateGenderFilter = (gender) => (dispatch, getState) => {
  dispatch(setSelectedGender(gender));
  const { cache } = getState().data;
  if (gender === 'all') {
    dispatch(setFilteredProducts(cache.products?.data || []));
    dispatch(resetProductPage());
    dispatch(setHasMore(true));
  } else {
    const normalizedGender = (g) => {
      const lower = g?.toLowerCase()?.trim() || 'unknown';
      if (['male', 'men', 'man'].includes(lower)) return 'men';
      if (['female', 'women', 'woman'].includes(lower)) return 'women';
      if (['kid', 'kids', 'child', 'children', 'kidz'].includes(lower)) return 'kids';
      return 'unknown';
    };
    const filtered = (cache.products?.data || [])
      .filter((product) => normalizedGender(product.gender) === gender)
      .sort((a, b) => (a.price || 0) - (b.price || 0));
    const seenIds = new Set();
    const uniqueFiltered = filtered.filter((product) => {
      if (!product._id || seenIds.has(product._id)) return false;
      seenIds.add(product._id);
      return true;
    });
    dispatch(setFilteredProducts(uniqueFiltered));
    dispatch(resetProductPage());
    dispatch(setHasMore(uniqueFiltered.length >= 10));
  }
};

export const addToCart = (productId, quantity = 1, size = 'N/A', color = 'N/A') => async (dispatch) => {
  const userToken = localStorage.getItem('token');
  if (!userToken) {
    toast.error('Please log in to add items to cart');
    return;
  }
  dispatch(setCartLoading(true));
  try {
    await axios.post('/api/user/auth/cart/add', {
      productId,
      quantity,
      size,
      color,
    }, { headers: { Authorization: `Bearer ${userToken}` } });
    toast.success('Added to cart');
    dispatch(fetchCartItems());
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to add to cart';
    dispatch(setCartError(errorMsg));
    toast.error(errorMsg);
    console.error('addToCart error:', error);
  } finally {
    dispatch(setCartLoading(false));
  }
};

export const fetchCartItems = () => async (dispatch) => {
  const userToken = localStorage.getItem('token');
  if (!userToken) return;
  dispatch(setCartLoading(true));
  try {
    const { data } = await axios.get('/api/user/auth/cart', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    // GET /cart responds { success, cart: { items } } -- reading data.items always
    // yielded undefined, so the redux cart was permanently empty.
    dispatch(setCartItems(data.cart?.items || []));
    dispatch(setCartError(null));
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to fetch cart';
    dispatch(setCartError(errorMsg));
    toast.error(errorMsg);
    console.error('fetchCartItems error:', error);
  } finally {
    dispatch(setCartLoading(false));
  }
};

export const removeFromCart = (productId) => async (dispatch) => {
  const userToken = localStorage.getItem('token');
  if (!userToken) return;
  dispatch(setCartLoading(true));
  try {
    await axios.delete(`/api/user/auth/cart/${productId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    toast.success('Removed from cart');
    dispatch(fetchCartItems());
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to remove from cart';
    dispatch(setCartError(errorMsg));
    toast.error(errorMsg);
    console.error('removeFromCart error:', error);
  } finally {
    dispatch(setCartLoading(false));
  }
};

export const addToWishlist = (productId) => async (dispatch) => {
  const userToken = localStorage.getItem('token');
  if (!userToken) {
    toast.error('Please log in to add items to wishlist');
    return;
  }
  dispatch(setWishlistLoading(true));
  try {
    await axios.post('/api/user/auth/wishlist', { productId }, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    toast.success('Added to wishlist');
    dispatch(fetchWishlistItems());
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to add to wishlist';
    dispatch(setWishlistError(errorMsg));
    toast.error(errorMsg);
    console.error('addToWishlist error:', error);
  } finally {
    dispatch(setWishlistLoading(false));
  }
};

export const removeFromWishlist = (productId) => async (dispatch) => {
  const userToken = localStorage.getItem('token');
  if (!userToken) return;
  dispatch(setWishlistLoading(true));
  try {
    await axios.delete(`/api/user/auth/wishlist/${productId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    toast.success('Removed from wishlist');
    dispatch(fetchWishlistItems());
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to remove from wishlist';
    dispatch(setWishlistError(errorMsg));
    toast.error(errorMsg);
    console.error('removeFromWishlist error:', error);
  } finally {
    dispatch(setWishlistLoading(false));
  }
};

export const fetchWishlistItems = () => async (dispatch) => {
  const userToken = localStorage.getItem('token');
  if (!userToken) return;
  dispatch(setWishlistLoading(true));
  try {
    const { data } = await axios.get('/api/user/auth/wishlist', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    // GET /wishlist responds { wishlist }, not { items }.
    dispatch(setWishlistItems(data.wishlist || []));
    dispatch(setWishlistError(null));
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to fetch wishlist';
    dispatch(setWishlistError(errorMsg));
    toast.error(errorMsg);
    console.error('fetchWishlistItems error:', error);
  } finally {
    dispatch(setWishlistLoading(false));
  }
};

export const trackProductView = (productId) => async (dispatch, getState) => {
  try {
    const userToken = localStorage.getItem('token');
    let updatedRecent = [...(getState().data.cache.recentlyViewed?.data || [])];
    if (userToken) {
      await axios.get('/api/user/auth/recently-viewed', { params: { productId } });
      updatedRecent = [productId, ...updatedRecent.filter((id) => id !== productId)].slice(0, 10);
    } else {
      let cookieViews = localStorage.getItem('recentlyViewed')
        ? JSON.parse(localStorage.getItem('recentlyViewed'))
        : [];
      if (!cookieViews.includes(productId)) {
        cookieViews = [productId, ...cookieViews].slice(0, 10);
        localStorage.setItem('recentlyViewed', JSON.stringify(cookieViews));
      }
      updatedRecent = cookieViews;
    }
    dispatch(updateCache({ key: 'recentlyViewed', data: updatedRecent }));
  } catch (error) {
    console.error('trackProductView error:', error);
  }
};

export const fetchUserProfile = () => async (dispatch) => {
  const userToken = localStorage.getItem('token');
  if (!userToken) return;
  dispatch(setUserLoading(true));
  try {
    const { data } = await axios.get('/api/user/auth/profile', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    dispatch(setProfile(data));
    dispatch(setUserError(null));
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to fetch profile';
    dispatch(setUserError(errorMsg));
    toast.error(errorMsg);
    console.error('fetchUserProfile error:', error);
  } finally {
    dispatch(setUserLoading(false));
  }
};

export const store = configureStore({
  reducer: {
    data: dataSlice.reducer,
    categories: categoriesSlice.reducer,
    search: searchSlice.reducer,
    cart: cartSlice.reducer,
    wishlist: wishlistSlice.reducer,
    user: userSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;
// import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit';
// import axios from 'axios';

// axios.defaults.baseURL = 'http://localhost:3000/api';

// // Thunk: Login
// export const login = createAsyncThunk('user/login', async (phoneNumber, { rejectWithValue }) => {
//   try {
//     const response = await axios.post('/login', { phoneNumber });
//     return response.data;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Verify Token
// export const verifyToken = createAsyncThunk('user/verify', async ({ phoneNumber, token }, { rejectWithValue }) => {
//   try {
//     const response = await axios.post('/verify', { phoneNumber, token });
//     localStorage.setItem('token', response.data.token);
//     axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
//     return response.data;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Fetch Profile
// export const fetchProfile = createAsyncThunk('user/fetchProfile', async (_, { rejectWithValue }) => {
//   try {
//     const response = await axios.get('/profile');
//     return response.data.user;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Update Profile
// export const updateProfile = createAsyncThunk('user/updateProfile', async (profileData, { rejectWithValue }) => {
//   try {
//     const response = await axios.put('/profile', profileData);
//     return response.data.user;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Add to Cart
// export const addToCart = createAsyncThunk('cart/addToCart', async (cartItem, { rejectWithValue }) => {
//   try {
//     const response = await axios.post('/cart/add', cartItem);
//     return response.data.cart;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Remove from Cart
// export const removeFromCart = createAsyncThunk('cart/removeFromCart', async ({ productId, size, color }, { rejectWithValue }) => {
//   try {
//     const response = await axios.delete('/cart/remove', { data: { productId, size, color } });
//     return response.data.cart;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Clear Cart
// export const clearCart = createAsyncThunk('cart/clearCart', async (_, { rejectWithValue }) => {
//   try {
//     const response = await axios.delete('/cart/clear');
//     return response.data.cart;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Add to Wishlist
// export const toggleWishlist = createAsyncThunk('wishlist/toggleWishlist', async (productId, { rejectWithValue }) => {
//   try {
//     const response = await axios.post('/wishlist/add', { productId });
//     return response.data.wishlist;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Add to Saved for Later
// export const addToSavedForLater = createAsyncThunk('savedForLater/addToSavedForLater', async (cartItem, { rejectWithValue }) => {
//   try {
//     const response = await axios.post('/saved-for-later/add', cartItem);
//     return response.data.savedForLater;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Remove from Saved for Later
// export const removeFromSavedForLater = createAsyncThunk('savedForLater/removeFromSavedForLater', async ({ productId, size, color }, { rejectWithValue }) => {
//   try {
//     const response = await axios.delete('/saved-for-later/remove', { data: { productId, size, color } });
//     return response.data.savedForLater;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Track Product View
// export const trackProductView = createAsyncThunk('products/trackProductView', async (productId, { rejectWithValue }) => {
//   try {
//     const response = await axios.get(`/products/${productId}`);
//     return response.data.product;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Fetch Products
// export const fetchProducts = createAsyncThunk('products/fetchProducts', async ({ page = 1, limit = 20, category }, { rejectWithValue }) => {
//   try {
//     const response = await axios.get('/products', { params: { page, limit, category } });
//     return response.data;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Fetch Search Suggestions
// export const fetchSearchSuggestions = createAsyncThunk('search/fetchSearchSuggestions', async (query, { rejectWithValue }) => {
//   try {
//     const response = await axios.get('/search/suggestions', { params: { q: query } });
//     return response.data;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Search Products (client-side filtering)
// export const searchProducts = createAsyncThunk('search/searchProducts', async (query, { getState, dispatch, rejectWithValue }) => {
//   try {
//     const { initialData } = getState();
//     const products = initialData.products || [];

//     if (!query) {
//       return { products, filteredProducts: products };
//     }

//     // Client-side filtering
//     const filteredProducts = products.filter(
//       (product) =>
//         product.name.toLowerCase().includes(query.toLowerCase()) ||
//         product.description?.toLowerCase().includes(query.toLowerCase()) ||
//         product.tags?.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
//     );

//     // Optionally fetch fresh results from backend
//     const response = await axios.get('/search/suggestions', { params: { q: query } });
//     return { products: response.data.products || [], filteredProducts };
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Create Order
// export const createOrder = createAsyncThunk('orders/createOrder', async (orderData, { rejectWithValue }) => {
//   try {
//     const response = await axios.post('/orders', orderData);
//     return response.data.orders;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Verify Order
// export const verifyOrder = createAsyncThunk('orders/verifyOrder', async (paymentData, { rejectWithValue }) => {
//   try {
//     const response = await axios.post('/orders/verify', paymentData);
//     return response.data.order;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Fetch Orders
// export const fetchOrders = createAsyncThunk('orders/fetchOrders', async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
//   try {
//     const response = await axios.get('/orders', { params: { page, limit } });
//     return response.data;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // Thunk: Fetch Initial Data
// export const fetchInitialData = createAsyncThunk('initialData/fetchInitialData', async ({ page = 1, limit = 20 }, { getState, rejectWithValue }) => {
//   try {
//     const { initialData } = getState();
//     if (initialData.products?.length && initialData.categories?.length) {
//       return initialData;
//     }
//     const response = await axios.get('/initial-data', { params: { page, limit } });
//     return response.data;
//   } catch (error) {
//     return rejectWithValue(error.response?.data || { message: error.message });
//   }
// });

// // User Slice
// const userSlice = createSlice({
//   name: 'user',
//   initialState: { user: null, token: localStorage.getItem('token'), status: 'idle', error: null },
//   reducers: {
//     logout: (state) => {
//       state.user = null;
//       state.token = null;
//       localStorage.removeItem('token');
//       delete axios.defaults.headers.common['Authorization'];
//     },
//   },
//   extraReducers: (builder) => {
//     builder
//       .addCase(login.pending, (state) => { state.status = 'loading'; state.error = null; })
//       .addCase(login.fulfilled, (state, action) => { state.status = 'succeeded'; state.token = action.payload.token; })
//       .addCase(login.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(verifyToken.fulfilled, (state, action) => { state.status = 'succeeded'; state.token = action.payload.token; })
//       .addCase(verifyToken.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(fetchProfile.fulfilled, (state, action) => { state.status = 'succeeded'; state.user = action.payload; })
//       .addCase(fetchProfile.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(updateProfile.fulfilled, (state, action) => { state.status = 'succeeded'; state.user = action.payload; })
//       .addCase(updateProfile.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; });
//   },
// });

// // Cart Slice
// const cartSlice = createSlice({
//   name: 'cart',
//   initialState: { items: [], status: 'idle', error: null },
//   reducers: {},
//   extraReducers: (builder) => {
//     builder
//       .addCase(addToCart.pending, (state) => { state.status = 'loading'; state.error = null; })
//       .addCase(addToCart.fulfilled, (state, action) => { state.status = 'succeeded'; state.items = action.payload.items; })
//       .addCase(addToCart.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(removeFromCart.fulfilled, (state, action) => { state.status = 'succeeded'; state.items = action.payload.items; })
//       .addCase(removeFromCart.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(clearCart.fulfilled, (state) => { state.status = 'succeeded'; state.items = []; })
//       .addCase(clearCart.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(fetchProfile.fulfilled, (state, action) => { state.items = action.payload.cart || []; });
//   },
// });

// // Wishlist Slice
// const wishlistSlice = createSlice({
//   name: 'wishlist',
//   initialState: { items: [], status: 'idle', error: null },
//   reducers: {},
//   extraReducers: (builder) => {
//     builder
//       .addCase(toggleWishlist.pending, (state) => { state.status = 'loading'; state.error = null; })
//       .addCase(toggleWishlist.fulfilled, (state, action) => { state.status = 'succeeded'; state.items = action.payload; })
//       .addCase(toggleWishlist.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(fetchProfile.fulfilled, (state, action) => { state.items = action.payload.wishlist || []; });
//   },
// });

// // Saved for Later Slice
// const savedForLaterSlice = createSlice({
//   name: 'savedForLater',
//   initialState: { items: [], status: 'idle', error: null },
//   reducers: {},
//   extraReducers: (builder) => {
//     builder
//       .addCase(addToSavedForLater.pending, (state) => { state.status = 'loading'; state.error = null; })
//       .addCase(addToSavedForLater.fulfilled, (state, action) => { state.status = 'succeeded'; state.items = action.payload; })
//       .addCase(addToSavedForLater.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(removeFromSavedForLater.fulfilled, (state, action) => { state.status = 'succeeded'; state.items = action.payload; })
//       .addCase(removeFromSavedForLater.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(fetchProfile.fulfilled, (state, action) => { state.items = action.payload.savedForLater || []; });
//   },
// });

// // Products Slice
// const productsSlice = createSlice({
//   name: 'products',
//   initialState: { products: [], product: null, total: 0, page: 1, pages: 1, status: 'idle', error: null },
//   reducers: {},
//   extraReducers: (builder) => {
//     builder
//       .addCase(fetchProducts.pending, (state) => { state.status = 'loading'; state.error = null; })
//       .addCase(fetchProducts.fulfilled, (state, action) => {
//         state.status = 'succeeded';
//         state.products = action.payload.products;
//         state.total = action.payload.total;
//         state.page = action.payload.page;
//         state.pages = action.payload.pages;
//       })
//       .addCase(fetchProducts.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(trackProductView.fulfilled, (state, action) => { state.status = 'succeeded'; state.product = action.payload; })
//       .addCase(trackProductView.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; });
//   },
// });

// // Search Slice
// const searchSlice = createSlice({
//   name: 'search',
//   initialState: {
//     suggestions: { recentSearches: [], products: [], categories: [], sellers: [] },
//     searchQuery: '',
//     filteredProducts: [],
//     selectedGender: null,
//     status: 'idle',
//     error: null,
//   },
//   reducers: {
//     setSearchQuery: (state, action) => {
//       state.searchQuery = action.payload;
//     },
//     setFilteredProducts: (state, action) => {
//       state.filteredProducts = action.payload;
//     },
//     updateGenderFilter: (state, action) => {
//       state.selectedGender = action.payload;
//       // Apply gender filter to products
//       const products = state.filteredProducts.length ? state.filteredProducts : state.suggestions.products;
//       state.filteredProducts = action.payload
//         ? products.filter((product) => product.gender === action.payload || product.gender === 'Unisex')
//         : products;
//     },
//   },
//   extraReducers: (builder) => {
//     builder
//       .addCase(fetchSearchSuggestions.pending, (state) => { state.status = 'loading'; state.error = null; })
//       .addCase(fetchSearchSuggestions.fulfilled, (state, action) => {
//         state.status = 'succeeded';
//         state.suggestions = action.payload;
//         state.filteredProducts = action.payload.products;
//       })
//       .addCase(fetchSearchSuggestions.rejected, (state, action) => {
//         state.status = 'failed';
//         state.error = action.payload.message;
//       })
//       .addCase(searchProducts.pending, (state) => { state.status = 'loading'; state.error = null; })
//       .addCase(searchProducts.fulfilled, (state, action) => {
//         state.status = 'succeeded';
//         state.suggestions.products = action.payload.products;
//         state.filteredProducts = action.payload.filteredProducts;
//         if (state.selectedGender) {
//           state.filteredProducts = state.filteredProducts.filter(
//             (product) => product.gender === state.selectedGender || product.gender === 'Unisex'
//           );
//         }
//       })
//       .addCase(searchProducts.rejected, (state, action) => {
//         state.status = 'failed';
//         state.error = action.payload.message;
//       });
//   },
// });

// // Orders Slice
// const ordersSlice = createSlice({
//   name: 'orders',
//   initialState: { orders: [], total: 0, page: 1, pages: 1, status: 'idle', error: null },
//   reducers: {},
//   extraReducers: (builder) => {
//     builder
//       .addCase(createOrder.pending, (state) => { state.status = 'loading'; state.error = null; })
//       .addCase(createOrder.fulfilled, (state, action) => { state.status = 'succeeded'; })
//       .addCase(createOrder.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(verifyOrder.pending, (state) => { state.status = 'loading'; state.error = null; })
//       .addCase(verifyOrder.fulfilled, (state, action) => { state.status = 'succeeded'; state.orders.push(action.payload); })
//       .addCase(verifyOrder.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; })
//       .addCase(fetchOrders.pending, (state) => { state.status = 'loading'; state.error = null; })
//       .addCase(fetchOrders.fulfilled, (state, action) => {
//         state.status = 'succeeded';
//         state.orders = action.payload.orders;
//         state.total = action.payload.total;
//         state.page = action.payload.page;
//         state.pages = action.payload.pages;
//       })
//       .addCase(fetchOrders.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload.message; });
//   },
// });

// // Initial Data Slice
// const initialDataSlice = createSlice({
//   name: 'initialData',
//   initialState: {
//     layout: { components: [] },
//     products: [],
//     comboOffers: [],
//     categories: [],
//     sellers: [],
//     sponsoredProducts: [],
//     trendingProducts: [],
//     recentlyViewed: [],
//     ads: [],
//     tripleAds: [],
//     banner: {},
//     searchSuggestions: {},
//     trendingSearches: {},
//     categoryProducts: {},
//     status: 'idle',
//     error: null,
//   },
//   reducers: {},
//   extraReducers: (builder) => {
//     builder
//       .addCase(fetchInitialData.pending, (state) => {
//         state.status = 'loading';
//         state.error = null;
//       })
//       .addCase(fetchInitialData.fulfilled, (state, action) => {
//         state.status = 'succeeded';
//         state.layout = action.payload.layout || { components: [] };
//         state.products = action.payload.products || [];
//         state.comboOffers = action.payload.comboOffers || [];
//         state.categories = action.payload.categories || [];
//         state.sellers = action.payload.sellers || [];
//         state.sponsoredProducts = action.payload.sponsoredProducts || [];
//         state.trendingProducts = action.payload.trendingProducts || [];
//         state.recentlyViewed = action.payload.recentlyViewed || [];
//         state.ads = action.payload.ads || [];
//         state.tripleAds = action.payload.tripleAds || [];
//         state.banner = action.payload.banner || {};
//         state.searchSuggestions = action.payload.searchSuggestions || {};
//         state.trendingSearches = action.payload.trendingSearches || {};
//         state.categoryProducts = action.payload.categoryProducts || {};
//       })
//       .addCase(fetchInitialData.rejected, (state, action) => {
//         state.status = 'failed';
//         state.error = action.payload.message;
//       });
//   },
// });

// export const { logout } = userSlice.actions;
// export const { setSearchQuery, setFilteredProducts, updateGenderFilter } = searchSlice.actions;

// export const store = configureStore({
//   reducer: {
//     user: userSlice.reducer,
//     cart: cartSlice.reducer,
//     wishlist: wishlistSlice.reducer,
//     savedForLater: savedForLaterSlice.reducer,
//     products: productsSlice.reducer,
//     search: searchSlice.reducer,
//     orders: ordersSlice.reducer,
//     initialData: initialDataSlice.reducer,
//   },
// });