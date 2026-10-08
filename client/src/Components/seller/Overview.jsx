import React from 'react';
import { motion } from 'framer-motion';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  FaBox,
  FaShoppingCart,
  FaDollarSign,
  FaCheckCircle,
  FaExclamationTriangle,
  FaBan,
} from 'react-icons/fa';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler, // Import Filler plugin
} from 'chart.js';

// Register Filler plugin along with others
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const Overview = ({ products, orders, revenue }) => {
  // Calculate metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ordersToday = orders.filter((o) => new Date(o.createdAt) >= today);
  const completedOrders = orders.filter((o) => o.status === 'delivered');
  const inStockProducts = products.filter((p) => p.quantity > 10);
  const lowStockProducts = products.filter((p) => p.quantity > 0 && p.quantity <= 10);
  const outOfStockProducts = products.filter((p) => p.quantity === 0);

  // Overview Chart (Products, Orders, Revenue)
  const overviewChartData = {
    labels: ['Products', 'Orders', 'Revenue'],
    datasets: [
      {
        label: 'Stats',
        data: [products.length, orders.length, revenue.totalRevenue || 0],
        backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'],
        borderRadius: 8,
        borderWidth: 1,
        borderColor: ['#2563eb', '#d97706', '#059669'],
      },
    ],
  };

  // Product Status Chart
  const productStatusChartData = {
    labels: ['Enabled', 'Disabled', 'In Stock', 'Low Stock', 'Out of Stock'],
    datasets: [
      {
        data: [
          products.filter((p) => p.status === 'enabled').length,
          products.filter((p) => p.status === 'disabled').length,
          inStockProducts.length,
          lowStockProducts.length,
          outOfStockProducts.length,
        ],
        backgroundColor: ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#d1d5db'],
        borderWidth: 1,
        borderColor: ['#059669', '#dc2626', '#2563eb', '#d97706', '#9ca3af'],
      },
    ],
  };

  // Daily Orders and Revenue Trend (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }).reverse();

  const dailyOrders = last7Days.map((dateStr) => {
    return orders.filter((o) => {
      const orderDate = new Date(o.createdAt);
      return orderDate.toLocaleDateString('en-US') === dateStr;
    }).length;
  });

  const dailyRevenue = last7Days.map((dateStr) => {
    return orders
      .filter((o) => {
        const orderDate = new Date(o.createdAt);
        return orderDate.toLocaleDateString('en-US') === dateStr && o.status !== 'cancelled';
      })
      .reduce((acc, o) => acc + (o.total || 0), 0);
  });

  const trendChartData = {
    labels: last7Days,
    datasets: [
      {
        label: 'Orders',
        data: dailyOrders,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Revenue (₹)',
        data: dailyRevenue,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y1',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 14 } } },
      title: { display: true, text: 'Overview Stats', font: { size: 18, weight: '600' } },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Count' } },
    },
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 14 } } },
      title: { display: true, text: 'Product Status', font: { size: 18, weight: '600' } },
    },
  };

  const trendOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 14 } } },
      title: { display: true, text: 'Last 7 Days Trend', font: { size: 18, weight: '600' } },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Orders' } },
      y1: {
        beginAtZero: true,
        position: 'right',
        title: { display: true, text: 'Revenue (₹)' },
        grid: { drawOnChartArea: false },
      },
    },
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} className="space-y-6 max-w-7xl mx-auto">
      {/* Quick Stats */}
      <motion.div
        variants={fadeIn}
        className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200"
      >
        <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">Quick Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: <FaBox className="text-2xl text-blue-600" />, title: 'Total Products', value: products.length },
            {
              icon: <FaShoppingCart className="text-2xl text-amber-600" />,
              title: 'Total Orders',
              value: orders.length,
            },
            {
              icon: <FaCheckCircle className="text-2xl text-emerald-600" />,
              title: 'Completed Orders',
              value: completedOrders.length,
            },
            {
              icon: <FaShoppingCart className="text-2xl text-purple-600" />,
              title: 'Orders Today',
              value: ordersToday.length,
            },
            {
              icon: <FaDollarSign className="text-2xl text-green-600" />,
              title: 'Total Revenue',
              value: `₹${(revenue.totalRevenue || 0).toLocaleString()}`,
            },
            {
              icon: <FaDollarSign className="text-2xl text-teal-600" />,
              title: 'Online Revenue',
              value: `₹${(revenue.onlineRevenue || 0).toLocaleString()}`,
            },
            {
              icon: <FaDollarSign className="text-2xl text-orange-600" />,
              title: 'COD Revenue',
              value: `₹${(revenue.codRevenue || 0).toLocaleString()}`,
            },
            {
              icon: <FaExclamationTriangle className="text-2xl text-yellow-600" />,
              title: 'Pending COD',
              value: `₹${(revenue.pendingCodRevenue || 0).toLocaleString()}`,
            },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.05 }}
              className="bg-blue-50 p-4 rounded-xl shadow-sm flex items-center gap-3 hover:shadow-md transition-all duration-200"
            >
              {stat.icon}
              <div>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="text-lg font-bold text-gray-800">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Inventory Status */}
      <motion.div
        variants={fadeIn}
        className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200"
      >
        <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">Inventory Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <FaBox className="text-2xl text-green-600" />,
              title: 'In Stock',
              value: inStockProducts.length,
            },
            {
              icon: <FaExclamationTriangle className="text-2xl text-yellow-600" />,
              title: 'Low Stock',
              value: lowStockProducts.length,
            },
            {
              icon: <FaBan className="text-2xl text-red-600" />,
              title: 'Out of Stock',
              value: outOfStockProducts.length,
            },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.05 }}
              className="bg-blue-50 p-4 rounded-xl shadow-sm flex items-center gap-3 hover:shadow-md transition-all duration-200"
            >
              {stat.icon}
              <div>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="text-lg font-bold text-gray-800">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          variants={fadeIn}
          className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Bar data={overviewChartData} options={chartOptions} />
        </motion.div>
        <motion.div
          variants={fadeIn}
          className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Doughnut data={productStatusChartData} options={doughnutOptions} />
        </motion.div>
        <motion.div
          variants={fadeIn}
          className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 lg:col-span-2"
        >
          <Line data={trendChartData} options={trendOptions} />
        </motion.div>
      </div>

      {/* Recent Orders */}
      <motion.div
        variants={fadeIn}
        className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200"
      >
        <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">Recent Orders</h2>
        {orders.length === 0 ? (
          <p className="text-gray-600">No orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-sm text-gray-600 border-b">
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((order) => (
                  <tr
                    key={order._id}
                    className="text-sm text-gray-700 border-b hover:bg-blue-50 transition-all duration-200"
                  >
                    <td className="p-3">{order.orderId?.slice(-6) || 'Unknown'}</td>
                    <td className="p-3">{order.userId?.firstName || 'N/A'}</td>
                    <td className="p-3">
                      <span
                        className={`capitalize ${
                          order.status === 'delivered'
                            ? 'text-emerald-600'
                            : order.status === 'cancelled' || order.status === 'returned'
                            ? 'text-red-600'
                            : 'text-blue-600'
                        }`}
                      >
                        {order.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-3">₹{(order.total || 0).toFixed(2)}</td>
                    <td className="p-3">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Overview;