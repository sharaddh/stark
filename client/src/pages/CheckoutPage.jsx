import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../useraxios';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaArrowLeft,
  FaMapPin,
  FaCreditCard,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaWallet,
  FaSearch,
  FaLocationArrow,
  FaEdit,
  FaUser,
} from 'react-icons/fa';
import placeholderImage from '../assets/logo.png';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Load Razorpay script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (document.querySelector('script[src*="checkout.razorpay.com"]')) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://checkout.razorpay.com/v1/checkout.js?t=${Date.now()}`;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay checkout script');
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

// Animation Variants
const stepVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

const mapContainerVariants = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { duration: 0.5 } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.3 } },
};

const popupVariants = {
  initial: { y: '100%', opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { y: '100%', opacity: 0, transition: { duration: 0.2 } },
};

// Country codes for login
const countryCodes = [
  { code: '+91', label: '+91 India' },
  { code: '+1', label: '🇺🇸 USA' },
  { code: '+44', label: '🇬🇧 UK' },
  { code: '+61', label: '🇦🇺 AUS' },
];

const CheckoutPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userDetails, setUserDetails] = useState({ name: '', phoneNumber: '', email: '' });
  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    lat: null,
    lng: null,
  });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [showAddressPopup, setShowAddressPopup] = useState(false);
  const [tempAddress, setTempAddress] = useState(address);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapContainerRef = useRef(null);
  const token = localStorage.getItem('token');

  // Login state for guest users
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const otpRefs = useRef([]);

  // Pre-fill phone number from userDetails
  useEffect(() => {
    if (userDetails.phoneNumber && !phoneNumber) {
      const cleanedPhone = userDetails.phoneNumber.replace(/\D/g, '').slice(-10); // Extract last 10 digits
      setPhoneNumber(cleanedPhone);
      // Assume +91 for India if no country code is present
      setCountryCode('+91');
    }
  }, [userDetails.phoneNumber, phoneNumber]);

  // Set showNewAddressForm for guest users
  useEffect(() => {
    if (!token) {
      setShowNewAddressForm(true);
    }
  }, [token]);

  // Initialize map after animation completes
  const initializeMap = () => {
    if (mapContainerRef.current && !mapRef.current) {
      const mapElement = mapContainerRef.current;
      mapRef.current = L.map(mapElement, {
        zoomControl: false,
        scrollWheelZoom: false,
        touchZoom: false,
        doubleClickZoom: false,
      }).setView([20.5937, 78.9629], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        fetchAddressFromCoords(lat, lng);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
        }
      });

      // Auto-fetch current location for guest users
      if (!token) {
        handleUseCurrentLocation();
      }
    }
  };

  // Clean up map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Fetch checkout data
  useEffect(() => {
    const fetchCheckoutData = async () => {
      try {
        if (token) {
          const userRes = await axios.get('/api/user/auth/profile', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const user = userRes.data.user || userRes.data.data?.user || userRes.data;
          if (!user) throw new Error('User data not found');

          setUserDetails({
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.phoneNumber,
            phoneNumber: user.phoneNumber,
            email: user.email || '',
          });
          setSavedAddresses(user.addresses || []);
          if (user.addresses?.length > 0) setSelectedAddress(user.addresses[0]._id);
        }

        let items = [];
        if (state?.cart?.length) {
          items = await Promise.all(
            state.cart
              .filter((item) => item && item.productId)
              .map(async (item) => {
                try {
                  const endpoint = token
                    ? `/api/user/auth/products/${item.productId}`
                    : `/api/user/auth/products/${item.productId}`;
                  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
                  const productRes = await axios.get(endpoint, config);
                  const product = productRes.data.product || productRes.data.data?.product;
                  if (!product) return null;
                  return {
                    productId: item.productId,
                    name: item.name,
                    price: item.price,
                    mrp: item.mrp || item.price * 1.2,
                    quantity: item.quantity,
                    image: Array.isArray(item.image) ? item.image[0] : item.image,
                    size: item.size,
                    color: item.color,
                    isCashOnDeliveryAvailable: product.isCashOnDeliveryAvailable ?? true,
                    onlinePaymentPercentage: product.onlinePaymentPercentage ?? 100,
                    sellerId: product.sellerId?._id || product.sellerId,
                  };
                } catch (error) {
                  console.error(`Error fetching product ${item.productId}:`, error);
                  return null;
                }
              })
          ).then((items) => items.filter((item) => item !== null));
        } else if (token) {
          const cartRes = await axios.get('/api/user/auth/cart', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const cart = cartRes.data.cart || cartRes.data.data?.cart;
          if (!cart) throw new Error('Cart data not found');
          items = cart
            .filter((item) => item && item.productId)
            .map((item) => ({
              productId: item.productId._id || item.productId,
              name: item.productId.name,
              price: item.priceAtAdd || item.productId.price,
              mrp: item.productId.mrp || item.productId.price * 1.2,
              quantity: item.quantity,
              image: Array.isArray(item.productId.images)
                ? item.productId.images[0]
                : item.productId.images,
              size: item.size,
              color: item.color,
              isCashOnDeliveryAvailable: item.productId.isCashOnDeliveryAvailable ?? true,
              onlinePaymentPercentage: item.productId.onlinePaymentPercentage ?? 100,
              sellerId: item.productId.sellerId?._id || item.productId.sellerId,
            }));
        }

        if (!items.length) {
          toast.error('Your cart is empty');
          navigate('/cart');
        } else {
          setCartItems(items);
        }
      } catch (error) {
        console.error('Fetch Checkout Data Error:', error.response?.data || error.message);
        if (token && error.response?.status === 401) {
          localStorage.removeItem('token');
          toast.error('Session expired, please login again');
          setCurrentStep(4); // Guest login step
        } else {
          toast.error(
            error.response?.data?.message || error.message || 'Failed to load checkout details'
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCheckoutData();
  }, [navigate, state?.cart, token]);

  // Fetch address from coordinates
  const fetchAddressFromCoords = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      if (data.address) {
        const newAddress = {
          street: data.address.road || data.address.street || '',
          city: data.address.city || data.address.town || data.address.village || '',
          state: data.address.state || '',
          postalCode: data.address.postcode || '',
          country: data.address.country || 'India',
          lat,
          lng,
        };
        setAddress(newAddress);
        setTempAddress(newAddress);
        setShowAddressPopup(true);
      } else {
        toast.error('No address found for this location');
      }
    } catch (error) {
      console.error('Error fetching address:', error);
      toast.error('Failed to fetch address details');
    }
  };

  // Search address
  const handleSearchAddress = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&countrycodes=IN`
      );
      const data = await response.json();
      if (data.length > 0) {
        const { lat, lon, address } = data[0];
        const newAddress = {
          street: address.road || address.street || '',
          city: address.city || address.town || address.village || '',
          state: address.state || '',
          postalCode: address.postcode || '',
          country: address.country || 'India',
          lat: parseFloat(lat),
          lng: parseFloat(lon),
        };
        setAddress(newAddress);
        setTempAddress(newAddress);
        setShowAddressPopup(true);
        if (mapRef.current) {
          mapRef.current.setView([lat, lon], 15);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lon]);
          } else {
            markerRef.current = L.marker([lat, lon]).addTo(mapRef.current);
          }
        }
      } else {
        toast.error('No results found for the address');
      }
    } catch (error) {
      console.error('Error searching address:', error);
      toast.error('Failed to search address');
    }
  };

  // Use current location
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsFetchingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchAddressFromCoords(latitude, longitude);
          if (mapRef.current) {
            mapRef.current.setView([latitude, longitude], 15);
            if (markerRef.current) {
              markerRef.current.setLatLng([latitude, longitude]);
            } else {
              markerRef.current = L.marker([latitude, longitude]).addTo(mapRef.current);
            }
          }
          setIsFetchingLocation(false);
          toast.success('Location fetched successfully');
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsFetchingLocation(false);
          toast.error('Unable to access your location. Please allow location access.');
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  // Handle manual address input
  const handleAddressInputChange = (e) => {
    setTempAddress({ ...tempAddress, [e.target.name]: e.target.value });
  };

  // Save address from pop-up
  const handleSaveAddressFromPopup = () => {
    if (!tempAddress.street || !tempAddress.city || !tempAddress.lat || !tempAddress.lng) {
      toast.error('Street, city, and location (lat/lng) are required');
      return;
    }
    setAddress(tempAddress);
    setShowAddressPopup(false);
    toast.success('Address updated successfully');
  };

  // Open manual address pop-up
  const openManualAddressPopup = () => {
    setTempAddress(address);
    setShowAddressPopup(true);
  };

  const handleAddNewAddress = async () => {
    if (!address.street || !address.city || !address.lat || !address.lng) {
      const missingFields = [];
      if (!address.street) missingFields.push('street');
      if (!address.city) missingFields.push('city');
      if (!address.lat || !address.lng) missingFields.push('location (select on map or use current location)');
      toast.error(`Please provide: ${missingFields.join(', ')}`);
      return;
    }

    setIsProcessing(true);
    try {
      if (token) {
        const res = await axios.post('/api/user/auth/add-address', address, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const newAddress = res.data.address;
        setSavedAddresses([...savedAddresses, newAddress]);
        setSelectedAddress(newAddress._id);
        setShowNewAddressForm(false);
        toast.success('Address added successfully');
      } else {
        setSelectedAddress('guest_address');
        setShowNewAddressForm(false);
        toast.success('Address saved for this order');
      }
      setCurrentStep(2);
    } catch (error) {
      console.error('Add Address Error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to add address');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAddress = () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }
    setCurrentStep(2);
  };

  // Login Logic
  const validatePhoneNumber = () => {
    const num = phoneNumber.replace(/\D/g, '');
    if (num.length < 6 || num.length > 15) return 'Phone number must be 6-15 digits';
    if (countryCode === '+91' && (!/^[6-9]\d{9}$/.test(num) || num.length !== 10))
      return 'Invalid India number (10 digits, starts with 6-9)';
    if (countryCode === '+1' && num.length !== 10)
      return 'Invalid USA number (10 digits)';
    return '';
  };

  const handleSendOtp = async () => {
    const error = validatePhoneNumber();
    if (error) {
      toast.error(error);
      return;
    }
    setLoginLoading(true);
    const loadingToast = toast.loading('Sending OTP...');
    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber}`;
      const res = await axios.post('/api/user/auth/send-otp', { phoneNumber: fullPhoneNumber });
      toast.dismiss(loadingToast);
      toast.success(res.data.message || 'OTP sent successfully!');
      setOtpSent(true);
      if (otpRefs.current[0]) otpRefs.current[0].focus();
    } catch (err) {
      toast.dismiss(loadingToast);
      const errorMessage =
        err.response?.status === 404
          ? 'User not found. Please register.'
          : err.response?.status === 401
          ? 'Invalid request.'
          : err.code === 'ECONNABORTED'
          ? 'Request timed out. Check your network.'
          : err.response?.data?.message || 'Failed to send OTP';
      toast.error(errorMessage);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }
    setLoginLoading(true);
    const loadingToast = toast.loading('Verifying OTP...');
    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber}`;
      const res = await axios.post('/api/user/auth/verify-otp', {
        phoneNumber: fullPhoneNumber,
        otp: otpString,
      });
      const token = res.data.token;
      localStorage.setItem('token', token);

      // Update user profile with name and email
      if (userDetails.name || userDetails.email) {
        try {
          const updateData = {};
          if (userDetails.name) {
            const [firstName, ...lastName] = userDetails.name.trim().split(' ');
            updateData.firstName = firstName;
            updateData.lastName = lastName.join(' ') || '';
          }
          if (userDetails.email) updateData.email = userDetails.email;
          await axios.patch('/api/user/auth/profile', updateData, {
            headers: { Authorization: `Bearer ${token}` },
          });
          // Update local userDetails with server response
          setUserDetails((prev) => ({
            ...prev,
            phoneNumber: fullPhoneNumber,
            name: userDetails.name,
            email: userDetails.email,
          }));
          toast.success('Profile updated successfully!');
        } catch (updateError) {
          console.error('Profile Update Error:', updateError.response?.data || updateError.message);
          toast.error('Failed to update profile details');
        }
      } else {
        setUserDetails((prev) => ({ ...prev, phoneNumber: fullPhoneNumber }));
      }

      toast.dismiss(loadingToast);
      toast.success(res.data.message || 'OTP verified successfully!');
      // Proceed to place order
      await handlePlaceOrder(true); // Pass flag to skip login step
    } catch (err) {
      toast.dismiss(loadingToast);
      const errorMessage =
        err.response?.status === 401
          ? 'Invalid OTP or session expired.'
          : err.response?.data?.message || 'Failed to verify OTP';
      toast.error(errorMessage);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, '').slice(0, 1);
    setOtp(newOtp);
    if (value && index < 5 && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
    if (!value && index > 0 && otpRefs.current[index - 1]) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('').slice(0, 6);
      setOtp(newOtp);
      otpRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  const calculatePaymentSplit = () => {
    return cartItems.map((item) => {
      const onlinePercentage = item.onlinePaymentPercentage / 100;
      const totalItemCost = item.price * item.quantity;
      return {
        ...item,
        onlineAmount: paymentMethod === 'cod_full' ? 0 : Number((totalItemCost * onlinePercentage).toFixed(2)),
        codAmount: paymentMethod === 'razorpay_full' ? 0 : Number((totalItemCost * (1 - onlinePercentage)).toFixed(2)),
      };
    });
  };

  const paymentOptions = () => {
    const allCODAvailable = cartItems.every((item) => item.isCashOnDeliveryAvailable);
    const anySplitPayment = cartItems.some(
      (item) => item.onlinePaymentPercentage < 100 && item.isCashOnDeliveryAvailable
    );

    const options = [];
    options.push({
      method: 'Online Payment',
      desc: 'Pay securely via Razorpay',
      value: 'razorpay_full',
    });

    if (allCODAvailable) {
      if (anySplitPayment) {
        options.push({
          method: 'Split Payment',
          desc: 'Pay partial online, rest on delivery',
          value: 'razorpay_split',
        });
      }
      options.push({
        method: 'Cash on Delivery',
        desc: 'Pay on delivery',
        value: 'cod_full',
      });
    }

    return options;
  };

  const handlePlaceOrder = async (skipLogin = false) => {
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      setCurrentStep(2);
      return;
    }
    if (!userDetails.name || !userDetails.phoneNumber) {
      toast.error('Please provide your name and phone number');
      setCurrentStep(3);
      return;
    }
    if (!selectedAddress) {
      toast.error('Please provide a delivery address');
      setCurrentStep(1);
      return;
    }
    if (!token && !skipLogin) {
      setCurrentStep(4); // Go to login step for guest users
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    const itemsWithPayment = calculatePaymentSplit();
    const totalCODAmount = itemsWithPayment.reduce((sum, item) => sum + item.codAmount, 0);
    const totalAmount = subtotal + shipping;

    const orderData = {
      items: itemsWithPayment.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        mrp: item.mrp,
        size: item.size,
        color: item.color,
        onlineAmount: item.onlineAmount,
        codAmount: item.codAmount,
        sellerId: item.sellerId,
      })),
      totalAmount,
      onlineAmount: paymentMethod === 'cod_full' ? 0 : totalAmount,
      codAmount: paymentMethod === 'razorpay_full' ? 0 : totalCODAmount,
      shipping,
      userDetails,
      address: token ? undefined : address,
      addressId: token ? selectedAddress : undefined,
      paymentMethod: paymentMethod === 'cod_full' ? 'Cash on Delivery' : 'Razorpay',
      fromCart: true,
    };

    try {
      if (paymentMethod === 'cod_full') {
        const endpoint = token ? '/api/user/auth/place-order' : '/api/place-order';
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const res = await axios.post(endpoint, orderData, config);
        toast.success('Order placed successfully!');
        navigate('/order-confirmation', {
          state: { orderIds: res.data.orders.map((o) => o.orderId) },
        });
      } else {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error('Failed to load payment gateway. Please check your internet connection.');
        }

        const endpoint = token ? '/api/user/auth/create-order' : '/api/create-order';
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const orderResponse = await axios.post(endpoint, orderData, config);
        const { razorpay } = orderResponse.data;

        if (!razorpay || !razorpay.orderId) {
          throw new Error('Razorpay order creation failed');
        }

        const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY || 'rzp_live_An2Y3brifzg0yN';
        const options = {
          key: RAZORPAY_KEY,
          amount: totalAmount * 100,
          currency: razorpay.currency || 'INR',
          name: 'Stark Strips',
          description: 'Order Payment',
          order_id: razorpay.orderId,
          handler: async (response) => {
            try {
              const verifyEndpoint = token ? '/api/user/auth/verify-payment' : '/api/verify-payment';
              const verifyData = {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderData: {
                  addressId: token ? selectedAddress : undefined,
                  address: token ? undefined : address,
                  fromCart: true,
                },
              };
              const verifyResponse = await axios.post(verifyEndpoint, verifyData, config);
              if (verifyResponse.data.success) {
                toast.success('Payment successful!');
                navigate('/order-confirmation', {
                  state: { orderIds: verifyResponse.data.orders.map((o) => o.orderId) },
                });
              } else {
                setPaymentError(verifyResponse.data.message || 'Payment verification failed');
                toast.error(verifyResponse.data.message || 'Payment verification failed');
              }
            } catch (error) {
              const message = error.response?.data?.message || 'Payment verification error';
              setPaymentError(message);
              toast.error(message);
            }
          },
          prefill: {
            name: userDetails.name,
            contact: userDetails.phoneNumber,
            email: userDetails.email || 'customer@example.com',
          },
          theme: { color: '#14B8A6' },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
              if (!paymentError) {
                toast.error('Payment cancelled by user');
              }
            },
          },
          retry: {
            enabled: true,
            max_count: 3,
          },
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.on('payment.failed', (response) => {
          setIsProcessing(false);
          const message = response.error.description || 'Payment failed';
          setPaymentError(message);
          toast.error(message);
        });
        paymentObject.open();
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to process order';
      setPaymentError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryPayment = () => {
    setPaymentError(null);
    handlePlaceOrder(token); // Pass current token state
  };

  const totalMRP = cartItems.reduce((sum, item) => sum + item.mrp * item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = totalMRP - subtotal;
  const shipping = 1;
  const total = subtotal + shipping;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!cartItems.length) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
        <div className="text-gray-600 text-lg font-medium">Your cart is empty</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 sm:px-6 lg:px-8">
      <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="relative flex items-center justify-between mb-8">
          {[
            { step: 1, label: 'Address', icon: <FaMapPin className="w-6 h-6" /> },
            { step: 2, label: 'Payment', icon: <FaCreditCard className="w-6 h-6" /> },
            { step: 3, label: 'Confirm', icon: <FaCheckCircle className="w-6 h-6" /> },
            ...(token ? [] : [{ step: 4, label: 'Login', icon: <FaUser className="w-6 h-6" /> }]),
          ].map(({ step, label, icon }) => (
            <motion.div
              key={step}
              className="flex-1 text-center z-10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: step * 0.2, duration: 0.5 }}
            >
              <div
                className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                  currentStep >= step ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {icon}
              </div>
              <p
                className={`mt-2 text-sm font-semibold uppercase tracking-wide ${
                  currentStep >= step ? 'text-teal-500' : 'text-gray-500'
                }`}
              >
                {label}
              </p>
            </motion.div>
          ))}
          <div className="absolute inset-x-0 top-6 h-2 bg-gray-200 z-0 rounded-full">
            <motion.div
              className="h-full bg-teal-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${((currentStep - 1) / (token ? 2 : 3)) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {paymentError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg text-sm"
            >
              <p>{paymentError}</p>
              <motion.button
                onClick={handleRetryPayment}
                className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Retry Payment
              </motion.button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-gray-900">Select Delivery Address</h2>
                {token && savedAddresses.length > 0 ? (
                  <div className="space-y-4">
                    {savedAddresses.map((addr) => (
                      <motion.div
                        key={addr._id}
                        className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                          selectedAddress === addr._id
                            ? 'border-teal-500 bg-teal-50 shadow-md'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setSelectedAddress(addr._id)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            id={addr._id}
                            name="address"
                            value={addr._id}
                            checked={selectedAddress === addr._id}
                            onChange={(e) => setSelectedAddress(e.target.value)}
                            className="mt-1 text-teal-500 focus:ring-teal-500 w-5 h-5"
                          />
                          <label
                            htmlFor={addr._id}
                            className="text-sm text-gray-700 leading-tight"
                          >
                            <strong>{addr.street}</strong>
                            <br />
                            {`${addr.city}, ${addr.state}, ${addr.postalCode}, ${addr.country}`}
                          </label>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    {token ? 'No saved addresses. Add one below.' : 'Select your delivery address below.'}
                  </p>
                )}
                {token && (
                  <motion.button
                    onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                    className="text-teal-500 hover:text-teal-600 font-semibold flex items-center gap-2"
                    whileHover={{ scale: 1.05 }}
                  >
                    <FaMapMarkerAlt /> {showNewAddressForm ? 'Cancel' : 'Add New Address'}
                  </motion.button>
                )}
                {(showNewAddressForm || !token) && (
                  <motion.div
                    variants={mapContainerVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="space-y-4"
                    onAnimationComplete={initializeMap}
                  >
                    <div className="relative z-0">
                      <div
                        ref={mapContainerRef}
                        id="address-map"
                        className="h-96 w-full rounded-lg shadow-md"
                        style={{ height: '384px', width: '100%' }}
                      ></div>
                      <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-2">
                        <form onSubmit={handleSearchAddress} className="flex-1">
                          <div className="relative">
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search for your address"
                              className="w-full p-3 pr-10 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 text-sm"
                            />
                            <button
                              type="submit"
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-teal-500"
                            >
                              <FaSearch />
                            </button>
                          </div>
                        </form>
                        <motion.button
                          onClick={handleUseCurrentLocation}
                          disabled={isFetchingLocation}
                          className={`p-3 rounded-lg shadow-sm flex items-center gap-2 text-white ${
                            isFetchingLocation ? 'bg-gray-400' : 'bg-teal-500 hover:bg-teal-600'
                          }`}
                          whileHover={isFetchingLocation ? {} : { scale: 1.05 }}
                          whileTap={isFetchingLocation ? {} : { scale: 0.95 }}
                        >
                          <FaLocationArrow />
                          <span>{isFetchingLocation ? 'Fetching...' : 'Use Current Location'}</span>
                        </motion.button>
                      </div>
                    </div>
                    <motion.button
                      onClick={openManualAddressPopup}
                      className="w-full py-3 bg-teal-100 text-teal-500 font-medium rounded-lg hover:bg-teal-200"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Enter Address Manually
                    </motion.button>
                    <div className="bg-teal-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Selected Address:</strong>{' '}
                        {address.street
                          ? `${address.street}, ${address.city}, ${address.state}, ${address.postalCode}, ${address.country}`
                          : 'Click on the map, search, or use current location to select an address'}
                      </p>
                    </div>
                    <motion.button
                      onClick={handleAddNewAddress}
                      disabled={isProcessing || !address.street || !address.city}
                      className={`w-full py-3 rounded-lg font-medium text-white ${
                        isProcessing || !address.street || !address.city
                          ? 'bg-gray-400'
                          : 'bg-teal-500 hover:bg-teal-600'
                      }`}
                      whileHover={isProcessing || !address.street || !address.city ? {} : { scale: 1.05 }}
                      whileTap={isProcessing || !address.street || !address.city ? {} : { scale: 0.95 }}
                    >
                      {isProcessing ? 'Saving...' : 'Save Address'}
                    </motion.button>
                  </motion.div>
                )}
                {(token ? savedAddresses.length > 0 && !showNewAddressForm : selectedAddress) && (
                  <motion.button
                    onClick={handleConfirmAddress}
                    disabled={isProcessing}
                    className={`w-full py-3 rounded-lg font-medium text-white ${
                      isProcessing ? 'bg-gray-400' : 'bg-teal-500 hover:bg-teal-600'
                    }`}
                    whileHover={!isProcessing ? { scale: 1.05 } : {}}
                    whileTap={!isProcessing ? { scale: 0.95 } : {}}
                  >
                    Continue to Payment
                  </motion.button>
                )}
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-gray-900">Payment Method</h2>
                <div className="space-y-4">
                  {paymentOptions().map(({ method, desc, value }) => (
                    <motion.div
                      key={value}
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        paymentMethod === value
                          ? 'border-teal-500 bg-teal-50 shadow-md'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setPaymentMethod(value)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id={value}
                          name="paymentMethod"
                          value={value}
                          checked={paymentMethod === value}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="text-teal-500 focus:ring-teal-500 w-5 h-5"
                        />
                        <div>
                          <label
                            htmlFor={value}
                            className="text-sm font-medium text-gray-700 flex items-center gap-2"
                          >
                            {method === 'Online Payment' && <FaCreditCard />}
                            {method === 'Split Payment' && <FaWallet />}
                            {method === 'Cash on Delivery' && <FaMoneyBillWave />}
                            {method}
                          </label>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {paymentMethod === 'razorpay_split' && (
                  <div className="bg-teal-50 p-4 rounded-lg text-sm text-gray-700">
                    <p>
                      <strong>Payment Split Details:</strong>
                    </p>
                    {calculatePaymentSplit().map((item) => (
                      <p key={item.productId}>
                        {item.name}: ₹{item.onlineAmount} Online, ₹{item.codAmount} COD
                      </p>
                    ))}
                    <p>Shipping: ₹{shipping.toFixed(2)} (Online)</p>
                  </div>
                )}
                <div className="flex gap-4">
                  <motion.button
                    onClick={() => setCurrentStep(1)}
                    disabled={isProcessing}
                    className={`flex-1 py-3 rounded-lg font-medium ${
                      isProcessing ? 'bg-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                    whileHover={!isProcessing ? { scale: 1.05 } : {}}
                    whileTap={!isProcessing ? { scale: 0.95 } : {}}
                  >
                    Back
                  </motion.button>
                  <motion.button
                    onClick={() => setCurrentStep(3)}
                    disabled={!paymentMethod || isProcessing}
                    className={`flex-1 py-3 rounded-lg font-medium text-white ${
                      !paymentMethod || isProcessing ? 'bg-gray-400' : 'bg-teal-500 hover:bg-teal-600'
                    }`}
                    whileHover={paymentMethod && !isProcessing ? { scale: 1.05 } : {}}
                    whileTap={paymentMethod && !isProcessing ? { scale: 0.95 } : {}}
                  >
                    Review Order
                  </motion.button>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-gray-900">Order Summary</h2>
                <div className="space-y-4 bg-teal-50 p-6 rounded-lg">
                  {cartItems.map((item) => (
                    <motion.div
                      key={item.productId}
                      className="flex gap-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <img
                        src={item.image || placeholderImage}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-md shadow-sm"
                        onError={(e) => (e.target.src = placeholderImage)}
                      />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-800">{item.name}</h3>
                        <p className="text-xs text-gray-600">
                          Qty: {item.quantity} | Size: {item.size} | Color: {item.color}
                        </p>
                        <p className="text-sm text-gray-600">
                          MRP: ₹{(item.mrp * item.quantity).toFixed(2)}
                        </p>
                        <p className="text-sm text-teal-500 font-medium">
                          Price: ₹{(item.price * item.quantity).toFixed(2)}
                        </p>
                        {paymentMethod === 'razorpay_split' && (
                          <p className="text-xs text-gray-500">
                            Online: ₹
                            {calculatePaymentSplit().find((i) => i.productId === item.productId)
                              ?.onlineAmount}{' '}
                            | COD: ₹
                            {calculatePaymentSplit().find((i) => i.productId === item.productId)
                              ?.codAmount}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  <div className="text-sm text-gray-700 space-y-2 pt-4 border-t border-gray-200">
                    <p className="flex justify-between">
                      <span>Total MRP:</span>
                      <span>₹{totalMRP.toFixed(2)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Discount:</span>
                      <span>-₹{discount.toFixed(2)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{subtotal.toFixed(2)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Shipping:</span>
                      <span>₹{shipping.toFixed(2)}</span>
                    </p>
                    {paymentMethod !== 'cod_full' && (
                      <p className="flex justify-between">
                        <span>Online Payment:</span>
                        <span>₹{total.toFixed(2)}</span>
                      </p>
                    )}
                    {paymentMethod !== 'razorpay_full' && (
                      <p className="flex justify-between">
                        <span>COD Amount:</span>
                        <span>
                          ₹
                          {calculatePaymentSplit()
                            .reduce((sum, item) => sum + item.codAmount, 0)
                            .toFixed(2)}
                        </span>
                      </p>
                    )}
                    <p className="flex justify-between font-semibold text-gray-800 pt-2">
                      <span>Final Amount:</span>
                      <span className="text-teal-500">₹{total.toFixed(2)}</span>
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Your Details</h3>
                  <input
                    type="text"
                    name="name"
                    value={userDetails.name}
                    onChange={(e) => setUserDetails({ ...userDetails, [e.target.name]: e.target.value })}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-700 text-sm shadow-sm"
                    placeholder="Full Name"
                    required
                    disabled={isProcessing}
                  />
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={userDetails.phoneNumber}
                    onChange={(e) => setUserDetails({ ...userDetails, [e.target.name]: e.target.value })}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-700 text-sm shadow-sm"
                    placeholder="Phone Number"
                    required
                    disabled={isProcessing}
                  />
                  <input
                    type="email"
                    name="email"
                    value={userDetails.email}
                    onChange={(e) => setUserDetails({ ...userDetails, [e.target.name]: e.target.value })}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-700 text-sm shadow-sm"
                    placeholder="Email (optional)"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2 text-sm text-gray-700 bg-teal-50 p-4 rounded-lg">
                  <p>
                    <strong>Address:</strong>{' '}
                    {token && savedAddresses.find((addr) => addr._id === selectedAddress)
                      ? `${savedAddresses.find((addr) => addr._id === selectedAddress).street}, ${
                          savedAddresses.find((addr) => addr._id === selectedAddress).city
                        }, ${savedAddresses.find((addr) => addr._id === selectedAddress).state}, ${
                          savedAddresses.find((addr) => addr._id === selectedAddress).postalCode
                        }, ${savedAddresses.find((addr) => addr._id === selectedAddress).country}`
                      : selectedAddress === 'guest_address'
                      ? `${address.street}, ${address.city}, ${address.state}, ${address.postalCode}, ${address.country}`
                      : 'Not selected'}
                  </p>
                  <p>
                    <strong>Payment Method:</strong>{' '}
                    {paymentMethod === 'razorpay_full'
                      ? 'Online Payment'
                      : paymentMethod === 'razorpay_split'
                      ? 'Split Payment'
                      : 'Cash on Delivery'}
                  </p>
                </div>
                <div className="flex gap-4">
                  <motion.button
                    onClick={() => setCurrentStep(2)}
                    disabled={isProcessing}
                    className={`flex-1 py-3 rounded-lg font-medium ${
                      isProcessing ? 'bg-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                    whileHover={!isProcessing ? { scale: 1.05 } : {}}
                    whileTap={!isProcessing ? { scale: 0.95 } : {}}
                  >
                    Back
                  </motion.button>
                  <motion.button
                    onClick={() => handlePlaceOrder()}
                    disabled={isProcessing}
                    className={`flex-1 py-3 rounded-lg font-medium text-white ${
                      isProcessing ? 'bg-gray-400' : 'bg-teal-500 hover:bg-teal-600'
                    }`}
                    whileHover={!isProcessing ? { scale: 1.05 } : {}}
                    whileTap={!isProcessing ? { scale: 0.95 } : {}}
                  >
                    {isProcessing
                      ? 'Processing...'
                      : token
                      ? paymentMethod === 'cod_full'
                        ? 'Place Order'
                        : 'Pay Now'
                      : 'Continue to Login'}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && !token && (
              <motion.div
                key="step4"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-gray-900">Login to Place Order</h2>
                <p className="text-sm text-gray-500">
                  Sign in using the phone number you provided to complete your order.
                </p>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <select
                      className="w-24 border border-gray-200 rounded-lg px-3 py-3 text-sm bg-white focus:ring-2 focus:ring-teal-500 shadow-sm"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      disabled={loginLoading || userDetails.phoneNumber}
                    >
                      {countryCodes.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex-1 relative">
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 10) setPhoneNumber(value);
                        }}
                        placeholder="Enter phone number"
                        className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-teal-500 shadow-sm disabled:bg-gray-100"
                        disabled={loginLoading || userDetails.phoneNumber}
                      />
                    </div>
                  </div>
                  {otpSent && (
                    <div className="flex justify-between gap-2">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => (otpRefs.current[index] = el)}
                          type="text"
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          onPaste={(e) => handleOtpPaste(e, index)}
                          maxLength={1}
                          className="w-12 h-12 border border-gray-200 rounded-lg text-center text-xl font-mono focus:ring-2 focus:ring-teal-500 shadow-sm"
                          aria-label={`OTP digit ${index + 1}`}
                          disabled={loginLoading}
                        />
                      ))}
                    </div>
                  )}
                  <motion.button
                    onClick={otpSent ? handleVerifyOtp : handleSendOtp}
                    disabled={loginLoading}
                    className={`w-full py-3 rounded-lg font-medium text-white ${
                      loginLoading ? 'bg-gray-400' : 'bg-teal-500 hover:bg-teal-600'
                    }`}
                    whileHover={!loginLoading ? { scale: 1.05 } : {}}
                    whileTap={!loginLoading ? { scale: 0.95 } : {}}
                  >
                    {loginLoading ? 'Processing...' : otpSent ? 'Verify OTP' : 'Send OTP'}
                  </motion.button>
                </div>
                <motion.button
                  onClick={() => setCurrentStep(3)}
                  disabled={loginLoading}
                  className={`w-full py-3 rounded-lg font-medium ${
                    loginLoading ? 'bg-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                  whileHover={!loginLoading ? { scale: 1.05 } : {}}
                  whileTap={!loginLoading ? { scale: 0.95 } : {}}
                >
                  Back
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Address Pop-up */}
        <AnimatePresence>
          {showAddressPopup && (
            <motion.div
              variants={popupVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg p-6 max-w-4xl mx-auto z-[2000]"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Enter Address Details</h3>
                <motion.button
                  onClick={() => setShowAddressPopup(false)}
                  className="text-gray-500 hover:text-gray-700"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  name="street"
                  value={tempAddress.street}
                  onChange={handleAddressInputChange}
                  placeholder="Street Address *"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                  required
                />
                <input
                  type="text"
                  name="city"
                  value={tempAddress.city}
                  onChange={handleAddressInputChange}
                  placeholder="City *"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                  required
                />
                <input
                  type="text"
                  name="state"
                  value={tempAddress.state}
                  onChange={handleAddressInputChange}
                  placeholder="State"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                />
                <input
                  type="text"
                  name="postalCode"
                  value={tempAddress.postalCode}
                  onChange={handleAddressInputChange}
                  placeholder="Postal Code"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                />
                <input
                  type="text"
                  name="country"
                  value={tempAddress.country}
                  onChange={handleAddressInputChange}
                  placeholder="Country"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                />
                <p className="text-xs text-gray-500">* Required fields</p>
              </div>
              <motion.button
                onClick={handleSaveAddressFromPopup}
                disabled={!tempAddress.street || !tempAddress.city}
                className={`w-full mt-6 py-3 rounded-lg font-medium text-white ${
                  !tempAddress.street || !tempAddress.city ? 'bg-gray-400' : 'bg-teal-500 hover:bg-teal-600'
                }`}
                whileHover={tempAddress.street && tempAddress.city ? { scale: 1.05 } : {}}
                whileTap={tempAddress.street && tempAddress.city ? { scale: 0.95 } : {}}
              >
                Confirm Address
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CheckoutPage;