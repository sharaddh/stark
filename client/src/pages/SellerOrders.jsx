import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';
// selleraxios, not '../axios': /api/seller/auth/orders needs sellerToken, and the
// '../axios' instance would redirect to /admin/login on any 401/403.
import axios from '../selleraxios';

const SellerOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('sellerToken');
        const res = await axios.get('/api/seller/auth/orders', { headers: { Authorization: `Bearer ${token}` } });
        setOrders(res.data.orders || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
        toast.error('Failed to load orders.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('sellerToken');
      await axios.put(`/api/seller/auth/orders/${orderId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(orders.map(order => order._id === orderId ? { ...order, status: newStatus } : order));
      toast.success('Order status updated!');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10">
      <Toaster position="top-right" />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-semibold text-teal-700 mb-6">Your Orders</h1>
        {loading ? (
          <div>Loading...</div>
        ) : orders.length === 0 ? (
          <p className="text-gray-600">No orders found.</p>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <motion.div
                key={order._id}
                className="p-4 bg-gray-50 rounded-lg shadow-sm"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-medium text-gray-800">Order ID: {order._id}</p>
                    <p className="text-sm text-gray-600">Total: ₹{order.total?.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">Customer: {order.customerId?.name || 'Unknown'}</p>
                    <p className="text-sm text-gray-600">Address: {order.shippingAddress?.street}, {order.shippingAddress?.city}</p>
                    <p className="text-sm text-indigo-600">Status: {order.status}</p>
                  </div>
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order._id, e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                    disabled={loading}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="mt-2">
                  <h4 className="text-sm font-medium text-gray-700">Items:</h4>
                  <ul className="list-disc ml-4 text-sm text-gray-600">
                    {order.items.map(item => (
                      <li key={item._id}>
                        {item.productId?.name} - Qty: {item.quantity} - ₹{item.price}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SellerOrders;