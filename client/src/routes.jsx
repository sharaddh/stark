import React from 'react';

const Home = React.lazy(() => import('./pages/Home.jsx'));
const ProductPage = React.lazy(() => import('./pages/ProductPage.jsx'));
const ComboPage = React.lazy(() => import('./pages/ComboPage.jsx'));
const Cart = React.lazy(() => import('./pages/Cart.jsx'));
const LoginRegister = React.lazy(() => import('./pages/LoginRegister.jsx'));
const SellerAuth = React.lazy(() => import('./pages/SellerAuth.jsx'));
const SellerDashboard = React.lazy(() => import('./pages/SellerDashboard.jsx'));
const UserDashboard = React.lazy(() => import('./pages/UserDashboard.jsx'));
const AdminAuth = React.lazy(() => import('./pages/AdminAuth.jsx'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard.jsx'));
const WishlistPage = React.lazy(() => import('./pages/WishlistPage.jsx'));
const WrappedCategoryPage = React.lazy(() => import('./pages/CategoryPage.jsx'));
const OwnerProfilePage = React.lazy(() => import('./pages/OwnerProfilePage.jsx'));
const CheckoutPage = React.lazy(() => import('./pages/CheckoutPage.jsx'));
const OrderConfirmation = React.lazy(() => import('./pages/OrderConfirmation.jsx'));
const OrderDetails = React.lazy(() => import('./pages/OrderDetails.jsx'));
const SellerProducts = React.lazy(() => import('./pages/SellerProducts.jsx'));
const SellerOrders = React.lazy(() => import('./pages/SellerOrders.jsx'));
const SearchResults = React.lazy(() => import('./pages/SearchResults.jsx'));
const FAQs = React.lazy(() => import('./pages/FAQs.jsx'));
const AboutUs = React.lazy(() => import('./pages/AboutUs.jsx'));
const TermsOfUse = React.lazy(() => import('./pages/TermsOfUse.jsx'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy.jsx'));
const ShippingDelivery = React.lazy(() => import('./pages/ShippingDelivery.jsx'));
const CancellationReturn = React.lazy(() => import('./pages/CancellationReturn.jsx'));

// Import route guards
import ProtectedRoute from './Middleware/Protectedroute.jsx';
import AdminProtectedRoute from './Middleware/AdminProtectedRoute.jsx';
// If you have seller auth, import SellerProtectedRoute as well

export const routes = [
  { path: '/', element: <Home />, layout: true, navbar: true },
  { path: '/cart', element: <ProtectedRoute><Cart /></ProtectedRoute>, layout: true, navbar: true },
  { path: '/wishlist', element: <ProtectedRoute><WishlistPage /></ProtectedRoute>, layout: true, navbar: true },
  { path: '/dashboard', element: <ProtectedRoute><UserDashboard /></ProtectedRoute>, layout: true, navbar: true },
  { path: '/seller/products', element: <ProtectedRoute><SellerProducts /></ProtectedRoute>, layout: true, navbar: true },
  { path: '/seller/orders', element: <ProtectedRoute><SellerOrders /></ProtectedRoute>, layout: true, navbar: true },
  { path: '/order/:orderId', element: <ProtectedRoute><OrderDetails /></ProtectedRoute>, layout: true, navbar: true },
  { path: '/category/:categoryName', element: <WrappedCategoryPage />, layout: true, navbar: true },
  { path: '/seller/:sellerId', element: <OwnerProfilePage />, layout: true, navbar: true },
  { path: '/product/:productId', element: <ProductPage />, layout: true },
  { path: '/search', element: <SearchResults />, layout: true, navbar: true },
  { path: '/combo/:comboId', element: <ComboPage />, layout: true, navbar: true },
  { path: '/checkout', element: <ProtectedRoute><CheckoutPage /></ProtectedRoute>, layout: true, navbar: true },
  { path: '/checkout/:productId', element: <ProtectedRoute><CheckoutPage /></ProtectedRoute>, layout: true, navbar: true },
  { path: '/order-confirmation', element: <ProtectedRoute><OrderConfirmation /></ProtectedRoute>, layout: true, navbar: true },
  { path: '/faq', element: <FAQs />, layout: true, navbar: true },
  { path: '/about', element: <AboutUs />, layout: true, navbar: true },
  { path: '/terms', element: <TermsOfUse />, layout: true, navbar: true },
  { path: '/privacy', element: <PrivacyPolicy />, layout: true, navbar: true },
  { path: '/CancellationReturn', element: <CancellationReturn />, layout: true, navbar: true },
  { path: '/Shipping&Delivery', element: <ShippingDelivery />, layout: true, navbar: true },
  { path: '/login', element: <LoginRegister />, layout: false },
  { path: '/seller/login', element: <SellerAuth />, layout: false },
  { path: '/seller/dashboard', element: <ProtectedRoute><SellerDashboard /></ProtectedRoute>, layout: false },
  { path: '/admin/login', element: <AdminAuth />, layout: false },
  { path: '/admin/dashboard', element: <AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>, layout: false },
];