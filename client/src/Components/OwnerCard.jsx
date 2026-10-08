import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const OwnerCard = ({ owner }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/owner/${owner._id}`);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      onClick={handleClick}
      className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer"
    >
      <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center">
        <img
          src={owner.profilePicture}
          alt={owner.username || owner.name || 'Seller'}
          className="w-full h-full rounded-full object-cover"
          onError={(e) => {
            e.target.src = '/logo192.png';
          }}
        />
      </div>
      <h3 className="text-sm font-medium text-gray-800">{owner.username}</h3>
    </motion.div>
  );
};

export default OwnerCard;