import React, { useState } from 'react';
import { motion } from 'framer-motion';
import axios from '../selleraxios';
import toast from 'react-hot-toast';

const fadeIn = { 
  hidden: { opacity: 0, y: 20 }, 
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } 
};

const Orders = ({ orders, setOrders, loading }) => {
  const statusOptions = [
    'order confirmed',
    'processing',
    'shipped',
    'out for delivery',
    'delivered',
    'cancelled',
    'returned',
  ];

  const [statusHistory, setStatusHistory] = useState({});

  const getStatusColor = (status) => {
    switch (status) {
      case 'order confirmed': return 'text-blue-600';
      case 'processing': return 'text-indigo-600';
      case 'shipped': return 'text-purple-600';
      case 'out for delivery': return 'text-orange-600';
      case 'delivered': return 'text-emerald-600';
      case 'cancelled': return 'text-red-600';
      case 'returned': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const handleUpdateOrderStatus = async (id, newStatus) => {
    if (!statusOptions.includes(newStatus)) {
      toast.error('Invalid status selected');
      return;
    }

    try {
      const response = await axios.put(`/api/seller/auth/orders/${id}`, { status: newStatus });
      const updatedOrder = response.data.data.order;

      setOrders(orders.map((o) => (o._id === id ? updatedOrder : o)));
      setStatusHistory((prev) => ({
        ...prev,
        [id]: [...(prev[id] || []), updatedOrder.status].slice(-5), // Keep last 5 statuses
      }));
      toast.success(`Order updated to "${newStatus}"`);
    } catch {
      toast.error('Failed to update order status');
    }
  };

  const handleUndoStatus = async (id) => {
    const history = statusHistory[id] || [];
    if (history.length < 2) {
      toast.error('No previous status to revert to');
      return;
    }

    const previousStatus = history[history.length - 2];
    try {
      const response = await axios.put(`/api/seller/auth/orders/${id}`, { status: previousStatus });
      const updatedOrder = response.data.data.order;

      setOrders(orders.map((o) => (o._id === id ? updatedOrder : o)));
      setStatusHistory((prev) => ({
        ...prev,
        [id]: history.slice(0, -1), // Remove latest status
      }));
      toast.success(`Order reverted to "${previousStatus}"`);
    } catch {
      toast.error('Failed to undo status');
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} className="space-y-6">
      {loading ? (
        <div className="text-center text-gray-600 animate-pulse text-lg">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-600 text-lg">No orders found</div>
      ) : (
        orders.map((order) => (
          <motion.div
            key={order._id}
            variants={fadeIn}
            className="bg-blue-50 p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-800">Order #{order.orderId.slice(-6)}</h3>
                <p className="text-sm text-gray-600">
                  Total: ₹{order.total.toFixed(2)} |{' '}
                  <span className={getStatusColor(order.status)}>{order.status}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Payment: {order.paymentMethod} (
                  {order.onlineAmount > 0 && `Online: ₹${order.onlineAmount.toFixed(2)}`}
                  {order.onlineAmount > 0 && order.codAmount > 0 && ' + '}
                  {order.codAmount > 0 && `COD: ₹${order.codAmount.toFixed(2)}`})
                </p>
                <p className="text-sm text-gray-600">Shipping: ₹{order.shipping.toFixed(2)}</p>
                <p className="text-sm text-gray-600">Items: {order.items.length}</p>
                <p className="text-sm text-gray-600">
                  Payment Status:{' '}
                  <span
                    className={
                      order.paymentStatus === 'completed'
                        ? 'text-emerald-600'
                        : order.paymentStatus === 'pending'
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }
                  >
                    {order.paymentStatus}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  Customer: {order.customer?.name || 'N/A'} ({order.customer?.email || 'N/A'})
                </p>
                <p className="text-sm text-gray-600">
                  Shipping Address: {order.shippingAddress?.street}, {order.shippingAddress?.city},{' '}
                  {order.shippingAddress?.state} {order.shippingAddress?.zip}
                </p>
                <p className="text-sm text-gray-600">
                  Ordered: {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <select
                  value={order.status}
                  onChange={(e) => handleUpdateOrderStatus(order._id, e.target.value)}
                  className={`px-4 py-2 text-sm rounded-xl shadow-sm transition-all duration-200 border ${
                    order.status === 'delivered' || order.status === 'cancelled' || order.status === 'returned'
                      ? 'bg-gray-200 cursor-not-allowed border-gray-300'
                      : 'border-blue-300 focus:ring-2 focus:ring-blue-500'
                  }`}
                  disabled={order.status === 'delivered' || order.status === 'cancelled' || order.status === 'returned'}
                  aria-label="Select order status"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => handleUndoStatus(order._id)}
                  className="px-4 py-2 text-sm rounded-xl text-white bg-gray-600 hover:bg-gray-700 shadow-sm transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={!(statusHistory[order._id]?.length > 1)}
                  aria-label="Undo last status change"
                >
                  Undo Status
                </motion.button>
              </div>
            </div>
            <div className="mt-2">
              <h4 className="text-sm font-medium text-gray-700">Items:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {order.items.map((item, index) => (
                  <li key={index}>
                    {item.name} (Qty: {item.quantity}, Size: {item.size}, Color: {item.color}, ₹
                    {item.price.toFixed(2)})
                    {item.onlineAmount > 0 && ` [Online: ₹${item.onlineAmount.toFixed(2)}]`}
                    {item.codAmount > 0 && ` [COD: ₹${item.codAmount.toFixed(2)}]`}
                  </li>
                ))}
              </ul>
            </div>
            {statusHistory[order._id]?.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-medium text-gray-700">Status History:</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {statusHistory[order._id].map((status, index) => (
                    <li key={index}>{status} - {new Date().toLocaleString()}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        ))
      )}
    </motion.div>
  );
};

export default Orders;