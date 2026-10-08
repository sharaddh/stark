import React from 'react';
import { Navigate } from 'react-router-dom';

// Helper to check if JWT is expired
function isTokenValid(token) {
  if (!token) return false;
  try {
    const [, payload] = token.split('.');
    if (!payload) return false;
    const decoded = JSON.parse(atob(payload));
    if (!decoded.exp) return false;
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

// Seller pages must be gated on sellerToken, not the customer 'token':
// otherwise any logged-in customer reaches the seller dashboard shell.
const isSellerAuthenticated = () => {
  const token = localStorage.getItem('sellerToken');
  if (!token || !isTokenValid(token)) {
    localStorage.removeItem('sellerToken');
    return false;
  }
  return true;
};

const SellerProtectedRoute = ({ children }) => {
  if (!isSellerAuthenticated()) {
    return <Navigate to="/seller/login" replace />;
  }
  return children;
};

export default SellerProtectedRoute;
