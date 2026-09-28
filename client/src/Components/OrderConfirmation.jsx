import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
// useraxios, not '../axios': /api/user/auth/order/:id is the customer's own order. The
// '../axios' instance redirects to /admin/login on any 401/403.
import axios from '../useraxios';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';

const OrderConfirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const orderId = searchParams.get('order_id');
        if (!orderId) {
          throw new Error('Order ID not found');
        }

        const res = await axios.get(`/api/user/auth/order/${orderId}`);
        setOrder(res.data.order);
      } catch (error) {
        console.error('Error fetching order:', error);
        toast.error('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
        <div className="text-center py-10">Loading...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
        <div className="text-center py-10">Order not found</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto py-6 px-4"
    >
      <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">Order Confirmation</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-medium text-gray-700 mb-2">Thank you for your purchase!</h2>
        <p className="text-gray-600 mb-4">Your order has been successfully placed.</p>
        <div className="space-y-2">
          <p>
            <strong>Order ID:</strong> {order._id}
          </p>
          <p>
            <strong>Total Amount:</strong> ₹{order.total.toFixed(2)}
          </p>
          <p>
            <strong>Items:</strong>
          </p>
          <ul className="list-disc pl-5">
            {order.items.map((item) => (
              <li key={item.productId}>
                Product ID: {item.productId}, Quantity: {item.quantity}, Price: ₹
                {item.price.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => navigate('/')}
          className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-md"
        >
          Continue Shopping
        </button>
      </div>
    </motion.div>
  );
};

export default OrderConfirmation;