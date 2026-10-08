import React from 'react';

const HorizontalProductRow = ({ title }) => {
  // Fetch products based on the category
  const products = []; // Replace with API call or props

  return (
    <section className="py-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">{title}</h2>
      <div className="flex gap-4 overflow-x-auto">
        {products.map((product) => (
          <div key={product._id} className="min-w-[200px] bg-white p-4 rounded-lg shadow-md">
            <img
              src={product.image || 'https://via.placeholder.com/150'}
              alt={product.name}
              className="w-full h-40 object-cover rounded-lg"
              loading="lazy"
            />
            <h3 className="text-sm font-medium text-gray-700 mt-2">{product.name}</h3>
            <p className="text-sm text-teal-600">₹{product.price}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HorizontalProductRow;