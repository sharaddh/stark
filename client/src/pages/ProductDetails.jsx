// src/pages/ProductDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../useraxios';
import Loading from '../assets/loading.gif';

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`/api/user/auth/product/${id}`);
        setProduct(res.data);
      } catch {
        setError('Product not found');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) return <div className="flex justify-center items-center min-h-screen"><img src={Loading} alt="Loading..." /></div>;
  if (error) return <div className="text-red-500 text-center py-10">{error}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{product.name}</h1>
      <img src={product.image || 'https://via.placeholder.com/300'} alt={product.name} className="w-full max-w-md" />
      <p className="mt-4 text-gray-700">{product.description}</p>
      <p className="mt-2 text-xl font-semibold text-green-600">₹{product.price}</p>
    </div>
  );
};

export default ProductDetails;
