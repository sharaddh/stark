// import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
// import axios from '../axios';
// import toast, { Toaster } from 'react-hot-toast';
// import { motion, AnimatePresence } from 'framer-motion';
// import { FaEye, FaEyeSlash, FaSpinner, FaInfoCircle } from 'react-icons/fa';
// import sellerLogo from '../assets/logo.png';
// import { useNavigate } from 'react-router-dom';

// const countryCodes = [
//   { code: '+91', label: '🇮🇳 India' },
//   { code: '+1', label: '🇺🇸 USA' },
//   { code: '+44', label: '🇬🇧 UK' },
//   { code: '+61', label: '🇦🇺 AUS' },
// ];

// const formVariants = {
//   initial: { opacity: 0, y: 30, scale: 0.95 },
//   animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: 'easeOut' } },
//   exit: { opacity: 0, y: -30, scale: 0.95, transition: { duration: 0.4 } },
// };

// const SellerAuth = () => {
//   const navigate = useNavigate();
//   const [isRegister, setIsRegister] = useState(false);
//   const [formData, setFormData] = useState({
//     phoneNumber: '',
//     countryCode: '+91',
//     name: '',
//     password: '',
//     shopName: '',
//     address: '',
//     otp: ['', '', '', '', '', ''],
//   });
//   const [image, setImage] = useState(null);
//   const [imagePreview, setImagePreview] = useState(null);
//   const [loading, setLoading] = useState({ sendOtp: false, submit: false });
//   const [errors, setErrors] = useState({});
//   const [otpSent, setOtpSent] = useState(false);
//   const [resendTimer, setResendTimer] = useState(30);
//   const [showPassword, setShowPassword] = useState(false);
//   const otpRefs = useRef([]);
//   const phoneInputRef = useRef(null);

//   const storeToken = useCallback((token) => {
//     if (!token || typeof token !== 'string' || token.trim() === '') {
//       console.error('Invalid token received:', token); // Debug: Log invalid token
//       toast.error('Invalid token received from server');
//       return;
//     }
//     console.log('Storing sellerToken:', token.slice(0, 8) + '...'); // Debug: Log token
//     localStorage.setItem('sellerToken', token);
//     axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
//   }, []);

//   useEffect(() => {
//     const storedToken = localStorage.getItem('sellerToken');
//     console.log('Checking stored sellerToken on mount:', storedToken); // Debug: Log stored token
//     if (storedToken && storedToken !== 'login') {
//       storeToken(storedToken);
//       navigate('/seller/dashboard');
//     }
//   }, [navigate, storeToken]);

//   useEffect(() => {
//     return () => {
//       if (imagePreview) URL.revokeObjectURL(imagePreview);
//     };
//   }, [imagePreview]);

//   const validateForm = useCallback(
//     (data = formData) => {
//       const newErrors = {};
//       const num = data.phoneNumber.replace(/\D/g, '');
//       if (!num || !/^\d{10}$/.test(num)) {
//         newErrors.phoneNumber = 'Enter a valid 10-digit number';
//       } else if (data.countryCode === '+91' && !/^[6-9]\d{9}$/.test(num)) {
//         newErrors.phoneNumber = 'India number must start with 6-9';
//       }

//       if (isRegister) {
//         if (!data.name) newErrors.name = 'Full name is required';
//         if (!data.shopName) newErrors.shopName = 'Shop name is required';
//         if (!data.address) newErrors.address = 'Address is required';
//         if (otpSent && data.otp.join('').length !== 6) newErrors.otp = 'Enter a 6-digit OTP';
//         if (!image) newErrors.image = 'Profile picture is required';
//       }

//       if (!data.password || data.password.length < 6) newErrors.password = 'Password must be 6+ characters';

//       return newErrors;
//     },
//     [formData, isRegister, otpSent, image]
//   );

//   const handleChange = useCallback((e) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({
//       ...prev,
//       [name]: name === 'phoneNumber' ? value.replace(/\D/g, '').slice(0, 10) : value,
//     }));
//     setErrors((prev) => ({ ...prev, [name]: '' }));
//   }, []);

//   const handleImageChange = useCallback((e) => {
//     const file = e.target.files[0];
//     if (file) {
//       const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
//       if (!validTypes.includes(file.type)) {
//         setErrors((prev) => ({ ...prev, image: 'Only JPEG, PNG, or JPG files allowed' }));
//         setImage(null);
//         setImagePreview(null);
//         return;
//       }
//       if (file.size > 5 * 1024 * 1024) {
//         setErrors((prev) => ({ ...prev, image: 'Image size must be less than 5MB' }));
//         setImage(null);
//         setImagePreview(null);
//         return;
//       }
//       setImage(file);
//       setErrors((prev) => ({ ...prev, image: '' }));
//       setImagePreview(URL.createObjectURL(file));
//     }
//   }, []);

//   const handleOtpChange = useCallback(
//     (index, value) => {
//       const newOtp = [...formData.otp];
//       newOtp[index] = value.replace(/\D/g, '').slice(0, 1);
//       setFormData((prev) => ({ ...prev, otp: newOtp }));
//       if (value && index < 5) otpRefs.current[index + 1]?.focus();
//       if (!value && index > 0) otpRefs.current[index - 1]?.focus();
//       setErrors((prev) => ({ ...prev, otp: '' }));
//     },
//     [formData.otp]
//   );

//   const handleKeyDown = useCallback(
//     (e, index) => {
//       if (e.key === 'Backspace' && !formData.otp[index] && index > 0) {
//         otpRefs.current[index - 1].focus();
//       }
//     },
//     [formData.otp]
//   );

//   const handleSendOtp = useCallback(async () => {
//     const newErrors = validateForm();
//     if (newErrors.phoneNumber) {
//       setErrors(newErrors);
//       toast.error(newErrors.phoneNumber, { duration: 3000 });
//       return;
//     }

//     setLoading((prev) => ({ ...prev, sendOtp: true }));
//     const loadingToast = toast.loading('Sending OTP...');
//     try {
//       const payload = { phoneNumber: `${formData.countryCode}${formData.phoneNumber}` };
//       console.log('Sending OTP Payload:', payload); // Debug: Log payload
//       const res = await axios.post('/api/seller/auth/send-otp', payload);
//       console.log('OTP Send Response:', res.data); // Debug: Log response
//       toast.dismiss(loadingToast);
//       toast.success(res.data.message, { duration: 4000 });
//       setOtpSent(true);
//       setResendTimer(30);
//       otpRefs.current[0]?.focus();
//     } catch (error) {
//       toast.dismiss(loadingToast);
//       const errorMessage = error.response?.data.message || error.message || 'Failed to send OTP';
//       console.error('OTP Send Error:', error.response?.data || error); // Debug: Log error
//       toast.error(errorMessage, { duration: 5000 });
//     } finally {
//       setLoading((prev) => ({ ...prev, sendOtp: false }));
//     }
//   }, [formData.countryCode, formData.phoneNumber, validateForm]);

//   const handleSubmit = useCallback(
//     async (e) => {
//       e.preventDefault();
//       const newErrors = validateForm();
//       if (Object.keys(newErrors).length > 0) {
//         setErrors(newErrors);
//         Object.values(newErrors).forEach((error) => toast.error(error, { duration: 3000 }));
//         return;
//       }

//       if (isRegister && !otpSent) {
//         toast.error('Please send OTP first', { duration: 3000 });
//         return;
//       }

//       const endpoint = isRegister ? '/api/seller/auth/register' : '/api/seller/auth/login';
//       let submitData;
//       if (isRegister) {
//         const formDataToSend = new FormData();
//         formDataToSend.append('phoneNumber', `${formData.countryCode}${formData.phoneNumber}`);
//         formDataToSend.append('otp', formData.otp.join(''));
//         formDataToSend.append('name', formData.name);
//         formDataToSend.append('shopName', formData.shopName);
//         formDataToSend.append('address', formData.address);
//         formDataToSend.append('password', formData.password);
//         if (image) formDataToSend.append('profilePicture', image);
//         submitData = formDataToSend;
//       } else {
//         submitData = {
//           phoneNumber: `${formData.countryCode}${formData.phoneNumber}`,
//           password: formData.password,
//         };
//       }

//       setLoading((prev) => ({ ...prev, submit: true }));
//       const loadingToast = toast.loading('Processing...');
//       try {
//         const config = isRegister ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
//         console.log('Submitting to:', endpoint, submitData); // Debug: Log payload
//         const res = await axios.post(endpoint, submitData, config);
//         console.log('Server Response:', res.data); // Debug: Log response
//         toast.dismiss(loadingToast);

//         const token = res.data.data?.token;
//         if (token) {
//           storeToken(token);
//           toast.success(`Success! Token: ${token.slice(0, 8)}...`, { duration: 4000 });
//           setFormData({
//             phoneNumber: '',
//             countryCode: '+91',
//             name: '',
//             password: '',
//             shopName: '',
//             address: '',
//             otp: ['', '', '', '', '', ''],
//           });
//           setImage(null);
//           setImagePreview(null);
//           setOtpSent(false);
//           navigate('/seller/dashboard');
//         } else {
//           throw new Error('No token received from server');
//         }
//       } catch (error) {
//         toast.dismiss(loadingToast);
//         const errorMessage = error.response?.data.message || error.message || 'Request failed';
//         console.error('Submission Error:', error.response?.data || error); // Debug: Log error
//         toast.error(errorMessage, { duration: 5000 });
//       } finally {
//         setLoading((prev) => ({ ...prev, submit: false }));
//       }
//     },
//     [isRegister, formData, otpSent, image, validateForm, storeToken, navigate]
//   );

//   const toggleForm = useCallback(() => {
//     setIsRegister((prev) => !prev);
//     setFormData({
//       phoneNumber: '',
//       countryCode: '+91',
//       name: '',
//       password: '',
//       shopName: '',
//       address: '',
//       otp: ['', '', '', '', '', ''],
//     });
//     setImage(null);
//     setImagePreview(null);
//     setErrors({});
//     setOtpSent(false);
//     setResendTimer(30);
//     setShowPassword(false);
//     phoneInputRef.current?.focus();
//   }, []);

//   useEffect(() => {
//     if (otpSent && resendTimer > 0) {
//       const timer = setInterval(() => {
//         setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
//       }, 1000);
//       return () => clearInterval(timer);
//     }
//   }, [otpSent, resendTimer]);

//   useEffect(() => {
//     if (otpSent && otpRefs.current[0]) otpRefs.current[0].focus();
//   }, [otpSent]);

//   const countryCodeOptions = useMemo(() => {
//     return countryCodes.map((country) => (
//       <option key={country.code} value={country.code} className="bg-white">
//         {country.label}
//       </option>
//     ));
//   }, []);

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 pb-40 via-green-100 to-green-100 px-4 py-10 sm:px-6 md:px-8 lg:px-12">
//       <Toaster
//         position="top-right"
//         toastOptions={{
//           className: 'text-sm sm:text-base font-medium',
//           style: { background: '#10B981', color: '#fff', borderRadius: '8px' },
//           error: { style: { background: '#EF4444', color: '#fff', borderRadius: '8px' } },
//         }}
//       />
//       <motion.div
//         initial={{ opacity: 0, y: 50 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.8, ease: 'easeOut' }}
//         className="w-full max-w-md sm:max-w-lg bg-white rounded-2xl shadow-xl p-6 sm:p-8 md:p-10 border border-teal-200"
//       >
//         <motion.div
//           initial={{ scale: 0.8, opacity: 0 }}
//           animate={{ scale: 1, opacity: 1 }}
//           transition={{ duration: 0.5, ease: 'easeOut' }}
//           className="flex justify-center mb-6"
//         >
//           <img
//             src={sellerLogo}
//             alt="AgroTrade Logo"
//             className="h-20 w-20 object-contain drop-shadow-md"
//             onError={(e) => (e.target.style.display = 'none')}
//           />
//         </motion.div>

//         <motion.div
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ delay: 0.3, duration: 0.5 }}
//           className="text-center mb-4"
//         >
//           <h1 className="text-4xl sm:text-5xl font-bold text-teal-700 tracking-wide">AgroTrade</h1>
//           <p className="text-sm sm:text-base text-gray-600 mt-2">
//             {isRegister ? 'Join as a Seller' : 'Welcome Back'}
//           </p>
//         </motion.div>

//         <AnimatePresence mode="wait">
//           <motion.div
//             key={isRegister ? 'register' : 'login'}
//             variants={formVariants}
//             initial="initial"
//             animate="animate"
//             exit="exit"
//             className="space-y-6"
//           >
//             <form onSubmit={handleSubmit} className="space-y-6" noValidate>
//               <div className="grid gap-4">
//                 <label htmlFor="phoneNumber" className="flex items-center text-sm font-medium text-gray-700">
//                   Phone Number <FaInfoCircle className="ml-1 text-gray-400" title="Enter your 10-digit phone number" />
//                 </label>
//                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
//                   <div className="flex items-center gap-2 w-full">
//                     <select
//                       name="countryCode"
//                       value={formData.countryCode}
//                       onChange={handleChange}
//                       className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-400 focus:outline-none"
//                       disabled={loading.sendOtp || loading.submit}
//                     >
//                       {countryCodeOptions}
//                     </select>
//                     <input
//                       id="phoneNumber"
//                       type="tel"
//                       name="phoneNumber"
//                       value={formData.phoneNumber}
//                       onChange={handleChange}
//                       placeholder="1234567890"
//                       className={`flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none ${
//                         errors.phoneNumber ? 'border-red-500' : ''
//                       }`}
//                       required
//                       disabled={loading.sendOtp || loading.submit}
//                       ref={phoneInputRef}
//                       maxLength={10}
//                     />
//                   </div>
//                   {isRegister && (
//                     <button
//                       type="button"
//                       onClick={handleSendOtp}
//                       disabled={loading.sendOtp || otpSent || loading.submit}
//                       className="w-full sm:w-auto px-6 py-2 rounded-lg text-white font-medium bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
//                     >
//                       {loading.sendOtp ? <FaSpinner className="animate-spin inline-block" /> : 'Send OTP'}
//                     </button>
//                   )}
//                 </div>
//                 {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>}
//               </div>

//               {isRegister && otpSent && (
//                 <div className="grid gap-4">
//                   <label htmlFor="otp-0" className="text-sm font-medium text-gray-700">
//                     Enter OTP <FaInfoCircle className="ml-1 text-gray-400" title="Check your phone for the 6-digit OTP" />
//                   </label>
//                   <div className="flex justify-between">
//                     {formData.otp.map((digit, index) => (
//                       <input
//                         key={index}
//                         ref={(el) => (otpRefs.current[index] = el)}
//                         id={`otp-${index}`}
//                         type="text"
//                         value={digit}
//                         onChange={(e) => handleOtpChange(index, e.target.value)}
//                         onKeyDown={(e) => handleKeyDown(e, index)}
//                         maxLength={1}
//                         className={`w-12 h-12 border rounded-lg text-center text-2xl font-mono focus:ring-2 focus:ring-teal-400 focus:outline-none ${
//                           errors.otp ? 'border-red-500' : 'border-gray-300'
//                         }`}
//                         disabled={loading.sendOtp || loading.submit}
//                       />
//                     ))}
//                   </div>
//                   {errors.otp && <p className="text-red-500 text-sm mt-1">{errors.otp}</p>}
//                   {resendTimer > 0 ? (
//                     <p className="text-center text-sm text-gray-500">Resend OTP in {resendTimer}s</p>
//                   ) : (
//                     <button
//                       type="button"
//                       onClick={() => {
//                         setResendTimer(30);
//                         handleSendOtp();
//                       }}
//                       className="w-full text-teal-600 font-medium py-2 rounded-lg hover:text-teal-700 disabled:opacity-70"
//                       disabled={loading.sendOtp || loading.submit}
//                     >
//                       Resend OTP
//                     </button>
//                   )}
//                 </div>
//               )}

//               {isRegister && (
//                 <div className="grid gap-4">
//                   <div>
//                     <label htmlFor="name" className="flex items-center text-sm font-medium text-gray-700">
//                       Full Name <FaInfoCircle className="ml-1 text-gray-400" title="Enter your full name" />
//                     </label>
//                     <input
//                       id="name"
//                       type="text"
//                       name="name"
//                       value={formData.name}
//                       onChange={handleChange}
//                       placeholder="John Doe"
//                       className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none ${
//                         errors.name ? 'border-red-500' : ''
//                       }`}
//                       required
//                       disabled={loading.sendOtp || loading.submit}
//                     />
//                     {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
//                   </div>
//                   <div>
//                     <label htmlFor="shopName" className="flex items-center text-sm font-medium text-gray-700">
//                       Shop Name <FaInfoCircle className="ml-1 text-gray-400" title="Enter your shop name" />
//                     </label>
//                     <input
//                       id="shopName"
//                       type="text"
//                       name="shopName"
//                       value={formData.shopName}
//                       onChange={handleChange}
//                       placeholder="Green Farm"
//                       className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none ${
//                         errors.shopName ? 'border-red-500' : ''
//                       }`}
//                       required
//                       disabled={loading.sendOtp || loading.submit}
//                     />
//                     {errors.shopName && <p className="text-red-500 text-sm mt-1">{errors.shopName}</p>}
//                   </div>
//                   <div>
//                     <label htmlFor="address" className="flex items-center text-sm font-medium text-gray-700">
//                       Shop Address <FaInfoCircle className="ml-1 text-gray-400" title="Enter your shop address" />
//                     </label>
//                     <textarea
//                       id="address"
//                       name="address"
//                       value={formData.address}
//                       onChange={handleChange}
//                       placeholder="123 Farm Lane, City"
//                       className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none ${
//                         errors.address ? 'border-red-500' : ''
//                       }`}
//                       rows="3"
//                       required
//                       disabled={loading.sendOtp || loading.submit}
//                     />
//                     {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
//                   </div>
//                   <div>
//                     <label htmlFor="profilePicture" className="flex items-center text-sm font-medium text-gray-700">
//                       Profile Picture <FaInfoCircle className="ml-1 text-gray-400" title="Upload a profile picture (max 5MB)" />
//                     </label>
//                     <input
//                       id="profilePicture"
//                       type="file"
//                       name="profilePicture"
//                       onChange={handleImageChange}
//                       accept="image/jpeg,image/png,image/jpg"
//                       className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none ${
//                         errors.image ? 'border-red-500' : ''
//                       }`}
//                       required
//                       disabled={loading.sendOtp || loading.submit}
//                     />
//                     {imagePreview && (
//                       <div className="mt-2">
//                         <img
//                           src={imagePreview}
//                           alt="Profile preview"
//                           className="w-20 h-20 rounded-full object-cover border-2 border-teal-500"
//                         />
//                       </div>
//                     )}
//                     {errors.image && <p className="text-red-500 text-sm mt-1">{errors.image}</p>}
//                   </div>
//                 </div>
//               )}

//               <div className="grid gap-2">
//                 <label htmlFor="password" className="flex items-center text-sm font-medium text-gray-700">
//                   Password <FaInfoCircle className="ml-1 text-gray-400" title="Password must be at least 6 characters" />
//                 </label>
//                 <div className="relative">
//                   <input
//                     id="password"
//                     type={showPassword ? 'text' : 'password'}
//                     name="password"
//                     value={formData.password}
//                     onChange={handleChange}
//                     placeholder="••••••••"
//                     className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none ${
//                       errors.password ? 'border-red-500' : ''
//                     }`}
//                     required
//                     disabled={loading.sendOtp || loading.submit}
//                   />
//                   <button
//                     type="button"
//                     onClick={() => setShowPassword((prev) => !prev)}
//                     className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
//                   >
//                     {showPassword ? <FaEyeSlash /> : <FaEye />}
//                   </button>
//                 </div>
//                 {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
//               </div>

//               <button
//                 type="submit"
//                 disabled={loading.sendOtp || loading.submit}
//                 className={`w-full flex justify-center items-center gap-2 py-3 rounded-xl text-white font-medium ${
//                   loading.submit
//                     ? 'bg-gray-300 cursor-not-allowed'
//                     : isRegister
//                     ? 'bg-teal-500 hover:bg-teal-600'
//                     : 'bg-emerald-500 hover:bg-emerald-600'
//                 }`}
//               >
//                 {loading.submit && <FaSpinner className="animate-spin" />}
//                 {loading.submit ? 'Processing...' : isRegister ? 'Register' : 'Login'}
//               </button>
//             </form>

//             <p className="text-center text-sm sm:text-base text-gray-600">
//               {isRegister ? 'Already a member?' : 'New seller?'}{' '}
//               <button
//                 onClick={toggleForm}
//                 className="text-teal-600 font-medium underline hover:text-teal-700 disabled:opacity-70"
//                 disabled={loading.sendOtp || loading.submit}
//               >
//                 {isRegister ? 'Login' : 'Register'}
//               </button>
//             </p>
//           </motion.div>
//         </AnimatePresence>
//       </motion.div>
//     </div>
//   );
// };

// export default React.memo(SellerAuth);

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// selleraxios, not '../axios': this page hits /api/seller/auth/*. The '../axios' instance
// is the admin one -- it attaches adminToken and redirects to /admin/login on any 401.
import axios from '../selleraxios';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import bgImage from '../assets/login.jpeg'; // Placeholder for background image
import logo from '../assets/slogo.webp'; // Placeholder for logo

const SellerAuth = () => {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    phoneNumber: '',
    name: '',
    password: '',
    shopName: '',
    address: '',
    otp: ['', '', '', '', '', ''],
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState({ sendOtp: false, submit: false });
  const [errors, setErrors] = useState({});
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [showPassword, setShowPassword] = useState(false);
  const otpRefs = useRef([]);
  const phoneInputRef = useRef(null);
  const countryCode = '+91';

  const storeToken = useCallback((token) => {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      toast.error('Invalid token received');
      return;
    }
    localStorage.setItem('sellerToken', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('sellerToken');
    if (storedToken && storedToken !== 'login') {
      storeToken(storedToken);
      navigate('/seller/dashboard');
    }
  }, [navigate, storeToken]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const validateForm = useCallback(
    (data = formData) => {
      const newErrors = {};
      const num = data.phoneNumber.replace(/\D/g, '');
      if (!num || !/^\d{10}$/.test(num) || !/^[6-9]\d{9}$/.test(num)) {
        newErrors.phoneNumber = 'Enter a valid 10-digit India number (starts with 6-9)';
      }
      if (isRegister) {
        if (!data.name) newErrors.name = 'Full name is required';
        if (!data.shopName) newErrors.shopName = 'Shop name is required';
        if (!data.address) newErrors.address = 'Address is required';
        if (otpSent && data.otp.join('').length !== 6) newErrors.otp = 'Enter a 6-digit OTP';
        if (!image) newErrors.image = 'Profile picture is required';
      }
      if (!data.password || data.password.length < 6) newErrors.password = 'Password must be 6+ characters';
      return newErrors;
    },
    [formData, isRegister, otpSent, image]
  );

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'phoneNumber' ? value.replace(/\D/g, '').slice(0, 10) : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  }, []);

  const handleImageChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        setErrors((prev) => ({ ...prev, image: 'Only JPEG, PNG, or JPG allowed' }));
        setImage(null);
        setImagePreview(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, image: 'Image size must be < 5MB' }));
        setImage(null);
        setImagePreview(null);
        return;
      }
      setImage(file);
      setErrors((prev) => ({ ...prev, image: '' }));
      setImagePreview(URL.createObjectURL(file));
    }
  }, []);

  const handleOtpChange = useCallback(
    (index, value) => {
      const newOtp = [...formData.otp];
      newOtp[index] = value.replace(/\D/g, '').slice(0, 1);
      setFormData((prev) => ({ ...prev, otp: newOtp }));
      if (value && index < 5) otpRefs.current[index + 1]?.focus();
      if (!value && index > 0) otpRefs.current[index - 1]?.focus();
      setErrors((prev) => ({ ...prev, otp: '' }));
    },
    [formData.otp]
  );

  const handleKeyDown = useCallback(
    (e, index) => {
      if (e.key === 'Backspace' && !formData.otp[index] && index > 0) {
        otpRefs.current[index - 1].focus();
      }
    },
    [formData.otp]
  );

  const handleSendOtp = useCallback(async () => {
    const newErrors = validateForm();
    if (newErrors.phoneNumber) {
      setErrors(newErrors);
      toast.error(newErrors.phoneNumber, { duration: 3000 });
      return;
    }
    setLoading((prev) => ({ ...prev, sendOtp: true }));
    const loadingToast = toast.loading('Sending OTP...');
    try {
      const payload = { phoneNumber: `${countryCode}${formData.phoneNumber}` };
      const res = await axios.post('/api/seller/auth/send-otp', payload);
      toast.dismiss(loadingToast);
      toast.success(res.data.message, { duration: 4000 });
      setOtpSent(true);
      setResendTimer(30);
      otpRefs.current[0]?.focus();
    } catch (error) {
      toast.dismiss(loadingToast);
      const errorMessage = error.response?.data.message || error.message || 'Failed to send OTP';
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setLoading((prev) => ({ ...prev, sendOtp: false }));
    }
  }, [formData.phoneNumber, validateForm]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const newErrors = validateForm();
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        Object.values(newErrors).forEach((error) => toast.error(error, { duration: 3000 }));
        return;
      }
      if (isRegister && !otpSent) {
        toast.error('Please send OTP first', { duration: 3000 });
        return;
      }
      const endpoint = isRegister ? '/api/seller/auth/register' : '/api/seller/auth/login';
      let submitData;
      if (isRegister) {
        const formDataToSend = new FormData();
        formDataToSend.append('phoneNumber', `${countryCode}${formData.phoneNumber}`);
        formDataToSend.append('otp', formData.otp.join(''));
        formDataToSend.append('name', formData.name);
        formDataToSend.append('shopName', formData.shopName);
        formDataToSend.append('address', formData.address);
        formDataToSend.append('password', formData.password);
        if (image) formDataToSend.append('profilePicture', image);
        submitData = formDataToSend;
      } else {
        submitData = {
          phoneNumber: `${countryCode}${formData.phoneNumber}`,
          password: formData.password,
        };
      }
      setLoading((prev) => ({ ...prev, submit: true }));
      const loadingToast = toast.loading('Processing...');
      try {
        const config = isRegister ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
        const res = await axios.post(endpoint, submitData, config);
        toast.dismiss(loadingToast);
        const token = res.data.data?.token;
        if (token) {
          storeToken(token);
          toast.success(`Success!`, { duration: 4000 });
          setFormData({
            phoneNumber: '',
            name: '',
            password: '',
            shopName: '',
            address: '',
            otp: ['', '', '', '', '', ''],
          });
          setImage(null);
          setImagePreview(null);
          setOtpSent(false);
          navigate('/seller/dashboard');
        } else {
          throw new Error('No token received from server');
        }
      } catch (error) {
        toast.dismiss(loadingToast);
        const errorMessage = error.response?.data.message || error.message || 'Request failed';
        toast.error(errorMessage, { duration: 5000 });
      } finally {
        setLoading((prev) => ({ ...prev, submit: false }));
      }
    },
    [isRegister, formData, otpSent, image, validateForm, storeToken, navigate]
  );

  const toggleForm = useCallback(() => {
    setIsRegister((prev) => !prev);
    setFormData({
      phoneNumber: '',
      name: '',
      password: '',
      shopName: '',
      address: '',
      otp: ['', '', '', '', '', ''],
    });
    setImage(null);
    setImagePreview(null);
    setErrors({});
    setOtpSent(false);
    setResendTimer(30);
    setShowPassword(false);
    phoneInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (otpSent && resendTimer > 0) {
      const timer = setInterval(() => {
        setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpSent, countryCode, formData.phoneNumber, validateForm]);

  useEffect(() => {
    if (otpSent && otpRefs.current[0]) otpRefs.current[0].focus();
  }, [otpSent]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-emerald-100 to-teal-200 relative overflow-hidden">
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium bg-white/90 text-gray-800 shadow-lg' }} />
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${bgImage})` }}
      ></div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-white/80 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/30"
      >
        <div className="flex justify-center mb-6">
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            src={logo}
            alt="AgroTrade Logo"
            className="h-16 w-16 object-contain"
          />
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-center mb-6"
        >
          <p className="text-sm text-gray-600 mt-1">{isRegister ? 'Join as a Seller' : 'Seller Login'}</p>
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.form
            key={isRegister ? 'register' : 'login'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">Phone Number</label>
              <div className="flex items-center gap-2">
                <div className="bg-teal-100 text-teal-700 text-sm font-medium px-3 py-2.5 rounded-lg border border-teal-200">
                  {countryCode}
                </div>
                <input
                  id="phoneNumber"
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="Enter 10-digit number"
                  className={`flex-1 p-2.5 rounded-lg border ${errors.phoneNumber ? 'border-red-400' : 'border-gray-200'} focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300 text-sm`}
                  disabled={loading.sendOtp || loading.submit}
                  ref={phoneInputRef}
                  maxLength={10}
                />
              </div>
              {errors.phoneNumber && <p className="text-red-500 text-xs">{errors.phoneNumber}</p>}
              {isRegister && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading.sendOtp || otpSent || loading.submit}
                  className="w-full mt-2 py-2.5 text-white font-medium rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {loading.sendOtp ? 'Sending...' : 'Send OTP'}
                </button>
              )}
            </div>

            {isRegister && otpSent && (
              <div className="space-y-2">
                <label htmlFor="otp-0" className="text-sm font-medium text-gray-700">Enter 6-digit OTP</label>
                <div className="flex justify-between gap-2">
                  {formData.otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      id={`otp-${index}`}
                      type="text"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      maxLength={1}
                      className={`w-10 h-10 text-center text-lg font-mono rounded-lg border ${errors.otp ? 'border-red-400' : 'border-gray-200'} focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300`}
                      disabled={loading.sendOtp || loading.submit}
                    />
                  ))}
                </div>
                {errors.otp && <p className="text-red-500 text-xs">{errors.otp}</p>}
                {resendTimer > 0 ? (
                  <p className="text-center text-xs text-gray-500">Resend OTP in {resendTimer}s</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setResendTimer(30);
                      handleSendOtp();
                    }}
                    className="w-full text-teal-600 text-xs font-medium hover:text-teal-700 disabled:opacity-50"
                    disabled={loading.sendOtp || loading.submit}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            )}

            {isRegister && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className={`w-full p-2.5 rounded-lg border ${errors.name ? 'border-red-400' : 'border-gray-200'} focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300 text-sm`}
                    disabled={loading.sendOtp || loading.submit}
                  />
                  {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="shopName" className="text-sm font-medium text-gray-700">Shop Name</label>
                  <input
                    id="shopName"
                    type="text"
                    name="shopName"
                    value={formData.shopName}
                    onChange={handleChange}
                    placeholder="Green Farm"
                    className={`w-full p-2.5 rounded-lg border ${errors.shopName ? 'border-red-400' : 'border-gray-200'} focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300 text-sm`}
                    disabled={loading.sendOtp || loading.submit}
                  />
                  {errors.shopName && <p className="text-red-500 text-xs">{errors.shopName}</p>}
                </div>
                <div>
                  <label htmlFor="address" className="text-sm font-medium text-gray-700">Shop Address</label>
                  <textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="123 Farm Lane, City"
                    className={`w-full p-2.5 rounded-lg border ${errors.address ? 'border-red-400' : 'border-gray-200'} focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300 text-sm`}
                    rows="3"
                    disabled={loading.sendOtp || loading.submit}
                  />
                  {errors.address && <p className="text-red-500 text-xs">{errors.address}</p>}
                </div>
                <div>
                  <label htmlFor="profilePicture" className="text-sm font-medium text-gray-700">Profile Picture</label>
                  <input
                    id="profilePicture"
                    type="file"
                    name="profilePicture"
                    onChange={handleImageChange}
                    accept="image/jpeg,image/png,image/jpg"
                    className={`w-full p-2.5 rounded-lg border ${errors.image ? 'border-red-400' : 'border-gray-200'} text-sm`}
                    disabled={loading.sendOtp || loading.submit}
                  />
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-12 h-12 rounded-full object-cover mt-2 border border-teal-200"
                    />
                  )}
                  {errors.image && <p className="text-red-500 text-xs">{errors.image}</p>}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  className={`w-full p-2.5 rounded-lg border ${errors.password ? 'border-red-400' : 'border-gray-200'} focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300 text-sm`}
                  disabled={loading.sendOtp || loading.submit}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading.sendOtp || loading.submit}
              className={`w-full py-2.5 text-white font-medium rounded-lg transition-all duration-300 ${loading.submit ? 'bg-gray-400 cursor-not-allowed animate-pulse' : 'bg-teal-600 hover:bg-teal-700 hover:scale-[1.02]'}`}
            >
              {loading.submit ? 'Processing...' : isRegister ? 'Register' : 'Login'}
            </button>
          </motion.form>
        </AnimatePresence>
        <p className="text-center text-xs text-gray-600 mt-4">
          {isRegister ? 'Already a seller?' : 'New seller?'}{' '}
          <button
            onClick={toggleForm}
            className="text-teal-600 font-medium hover:underline disabled:opacity-50"
            disabled={loading.sendOtp || loading.submit}
          >
            {isRegister ? 'Login' : 'Register'}
          </button>
        </p>
        <p className="text-center text-xs text-gray-500 mt-2">
          By continuing, you agree to our{' '}
          <a href="/terms-of-use" className="text-teal-600 hover:underline" target="_blank" rel="noopener noreferrer">
            Terms of Use
          </a>{' '}
          and{' '}
          <a href="/privacy-policy" className="text-teal-600 hover:underline" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>.
        </p>
      </motion.div>
    </div>
  );
};

export default React.memo(SellerAuth);