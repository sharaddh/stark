import React, { useState, useMemo, useCallback, useContext, Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import debounce from 'lodash.debounce';
import { DataContext } from '../DataProvider';
import Loading from '../assets/loading.gif';

const SearchBar = lazy(() => import('../Components/home/SearchBar'));
const CategorySection = lazy(() => import('../Components/home/CategorySection'));
const SellerSection = lazy(() => import('../Components/home/SellerSection'));
const ProductSection = lazy(() => import('../Components/home/ProductSection'));
const Topbox = lazy(() => import('../Components/home/Topbox'));
const SingleAdd = lazy(() => import('../Components/home/SingleAdd'));
const DoubleAdd = lazy(() => import('../Components/home/DoubleAdd'));
const TripleAdd = lazy(() => import('../Components/home/TripleAdd'));
const CategorySectionn = lazy(() => import('../Components/home/CategorySectionn'));
const ComboOfferSection = lazy(() => import('../Components/home/ComboOfferSection'));
const TrendingSection = lazy(() => import('../Components/home/TrendingSection'));
const SponsoredSection = lazy(() => import('../Components/home/SponsoredSection'));
const RecentlyViewedSection = lazy(() => import('../Components/home/RecentlyViewedSection'));

const componentMap = {
  SearchBar, Topbox, RecentlyViewedSection, SponsoredSection,
  ComboOfferSection, SingleAdd, CategorySection, SellerSection,
  TripleAdd, DoubleAdd, CategorySectionn, TrendingSection, ProductSection,
};

const DEFAULT_IMAGE = 'https://your-server.com/generic-product-placeholder.jpg';

const Home = React.memo(() => {
  const { cache = {}, isLoading } = useContext(DataContext) || {};
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedGender, setSelectedGender] = useState('all');

  const get = useCallback((key) => cache[key]?.data, [cache]);

  const handleSearch = useMemo(() =>
    debounce(async (query) => {
      if (!query.trim()) {
        setFilteredProducts(get('products') || []);
        return;
      }
      try {
        const axios = (await import('../useraxios')).default;
        const res = await axios.get('/api/user/auth/products', { params: { q: query, limit: 5 } });
        setFilteredProducts((res.data.products || []).map(p => ({
          ...p,
          image: p.image && p.image !== 'https://via.placeholder.com/150' ? p.image : DEFAULT_IMAGE,
        })));
      } catch {
        setFilteredProducts(get('products') || []);
      }
    }, 300),
    [get]
  );

  const handleSearchChange = useCallback((e) => {
    const q = e.target.value;
    setSearchQuery(q);
    handleSearch(q);
  }, [handleSearch]);

  const LoadingUI = useMemo(() => (
    <div className='fixed inset-0 z-50 bg-gray-100 bg-opacity-75 flex items-center justify-center overflow-hidden'>
      <div className="text-center w-screen h-screen bg-white flex flex-col min-h-screen justify-center overflow-hidden items-center">
        <img className='w-[80%]' src={Loading} alt="" loading="lazy" />
      </div>
    </div>
  ), []);

  const defaultLayout = useMemo(() => [
    { name: 'SearchBar', props: {} },
    { name: 'Topbox', props: {} },
    { name: 'RecentlyViewedSection', props: {} },
    { name: 'SponsoredSection', props: {} },
    { name: 'ComboOfferSection', props: {} },
    { name: 'SingleAdd', props: {} },
    { name: 'CategorySection', props: {} },
    { name: 'SellerSection', props: {} },
    { name: 'TripleAdd', props: {} },
    { name: 'DoubleAdd', props: {} },
    { name: 'CategorySectionn', props: { categoryName: 'Featured' } },
    { name: 'TrendingSection', props: {} },
    { name: 'ProductSection', props: {} },
  ], []);

  const renderComponent = useCallback((component, index) => {
    const Component = componentMap[component.name];
    if (!Component) return <div key={index} className="text-center text-red-500 py-4">Component {component.name} not found</div>;

    const props = { ...component.props };
    const products = get('products') || [];

    switch (component.name) {
      case 'SearchBar':
        return (
          <Component
            key={index}
            onSearch={(e) => { e.preventDefault(); handleSearch(searchQuery); }}
            searchQuery={searchQuery}
            setSearchQuery={handleSearchChange}
            placeholder={props.placeholder || 'search by category, product or seller'}
          />
        );
      case 'CategorySection':
        return <Component key={index} categories={get('categories') || []} {...props} />;
      case 'SellerSection':
        return <Component key={index} {...props} />;
      case 'ProductSection':
        return (
          <Component
            key={index}
            products={products}
            filteredProducts={filteredProducts.length ? filteredProducts : products}
            setFilteredProducts={setFilteredProducts}
            onGenderChange={(gender) => {
              setSelectedGender(gender);
              if (gender === 'all') {
                setFilteredProducts(products);
              } else {
                const normalize = (g) => {
                  const l = g?.toLowerCase()?.trim() || '';
                  if (['male', 'men', 'man'].includes(l)) return 'men';
                  if (['female', 'women', 'woman'].includes(l)) return 'women';
                  if (['kid', 'kids', 'child', 'children', 'kidz'].includes(l)) return 'kids';
                  return 'unknown';
                };
                const seen = new Set();
                setFilteredProducts(
                  products.filter(p => normalize(p.gender) === gender && !seen.has(p._id) && (seen.add(p._id), true))
                );
              }
            }}
            selectedGender={selectedGender}
          />
        );
      case 'CategorySectionn': {
        const cat = (get('categories') || []).find(c =>
          c._id === props.categoryId || (props.categoryName && c.name?.toLowerCase() === props.categoryName.toLowerCase())
        );
        return cat ? <Component key={index} category={cat} {...props} /> :
          <p key={index} className="text-center text-gray-500 py-8">{props.categoryName || 'Category'} not available</p>;
      }
      case 'ComboOfferSection':
        return <Component key={index} comboOffers={get('comboOffers') || []} {...props} />;
      case 'RecentlyViewedSection':
        return <Component key={index} recentlyViewed={get('recentlyViewed') || []} {...props} />;
      default:
        return <Component key={index} {...props} />;
    }
  }, [cache, filteredProducts, searchQuery, handleSearchChange, handleSearch, selectedGender, get]);

  const effectiveLayout = get('layout')?.length ? get('layout') : defaultLayout;

  if (isLoading) {
    return <Suspense fallback={LoadingUI}>{LoadingUI}</Suspense>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
      <main className="container mx-auto">
        <Suspense fallback={LoadingUI}>
          {effectiveLayout.map((comp, i) => renderComponent(comp, i))}
        </Suspense>
      </main>
    </div>
  );
});

export default Home;
