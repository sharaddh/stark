import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '../../@/components/ui/drawer';
import { Button } from '../../@/components/ui/button';
import axios from './useraxios';
import { X } from 'lucide-react';

const CategoryDrawer = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
 
  useEffect(() => {
    if (isOpen) {
      const fetchCategories = async () => {
        try {
          setLoading(true);
          const response = await axios.get('/api/categories');
          console.log('API Response:', response.data);
          const validCategories = response.data.categories;
          setCategories(validCategories);
          setLoading(false);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to load categories');
          setLoading(false);
          console.error('Fetch categories error:', {
            message: err.message,
            status: err.response?.status,
            data: err.response?.data,
          });
        }
      };
      fetchCategories();
    }
  }, [isOpen]);

  const handleNavigate = (categoryId) => {
    navigate(`/category/${categoryId}`);
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="h-[90vh] bg-gradient-to-b from-violet-50 to-white rounded-t-3xl">
        <DrawerHeader className="flex justify-between items-center border-b border-violet-100">
          <DrawerTitle className="text-2xl font-bold text-gray-900">Shop by Category</DrawerTitle>
          <DrawerDescription className="sr-only">
            Browse and select a category to view related products.
          </DrawerDescription>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-violet-100">
              <X className="h-5 w-5 text-gray-600" />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <div className="flex flex-col h-full p-4 overflow-y-auto">
          {loading ? (
            <p className="text-gray-600">Loading categories...</p>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : categories.length === 0 ? (
            <p className="text-gray-600">No categories available</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 gap-5">
              {categories.map((category) => (
                <div className="flex flex-col items-center justify-center text-center" key={category._id}>
                  <motion.div
                  key={category._id}
                  className="bg-gray-50 rounded-full w-14 h-14 flex flex-col drop-shadow-md overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleNavigate(category._id)}
                >
                  {category.icon && (
                    <img
                      src={category.icon}
                      alt={`${category.name} icon`}
                      className="w-full p-2 bg-slate-50 object-cover"
                      onError={(e) => (e.target.src = 'https://via.placeholder.com/150?text=Category')}
                    />
                  )}
                </motion.div>
                  <div className="pt-3">
                    <h4 className="text-md font-normal text-gray-900 truncate">{category.name}</h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CategoryDrawer;