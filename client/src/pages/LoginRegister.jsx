// import React, { useState, useEffect, useCallback, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import axios from '../axios';
// import { toast, Toaster } from 'react-hot-toast';
// import { Button } from '../../@/components/ui/button';
// import { Input } from '../../@/components/ui/input';
// import { Card, CardContent, CardHeader, CardTitle } from '../../@/components/ui/card';
// import { Label } from '../../@/components/ui/label';
// import Logo from '../assets/slogo.webp';
// import bgimage from '../assets/login.jpeg';

// const LoginRegister = () => {
//   const [phoneNumber, setPhoneNumber] = useState('');
//   const [otp, setOtp] = useState(['', '', '', '', '', '']);
//   const [otpSent, setOtpSent] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const otpRefs = useRef([]);
//   const navigate = useNavigate();
//   const countryCode = '+91'; // Fixed country code

//   const fullPhoneNumber = `${countryCode}${phoneNumber}`;

//   const validatePhoneNumber = (number) => {
//     const num = number.replace(/\D/g, '');
//     if (num.length !== 10 || !/^[6-9]\d{9}$/.test(num)) {
//       return 'Invalid India number (10 digits, starts with 6-9)';
//     }
//     return '';
//   };

//   const handleApiCall = useCallback(
//     async (callback, successMessage) => {
//       const loadingToast = toast.loading('Processing...');
//       setLoading(true);
//       try {
//         const res = await callback();
//         toast.dismiss(loadingToast);
//         toast.success(res.data.message || successMessage, { duration: 3000 });
//         if (res.data.token) {
//           localStorage.setItem('token', res.data.token);
//           if (otpSent) {
//             try {
//               await axios.get('/api/user/auth/profile');
//               navigate('/');
//             } catch (err) {
//               console.error('Profile check failed:', err.response?.data || err.message);
//               toast.error('Please complete your profile.');
//               navigate('/');
//             }
//           }
//         }
//         if (!otpSent) setOtpSent(true);
//       } catch (err) {
//         toast.dismiss(loadingToast);
//         const errorMessage =
//           err.response?.status === 404
//             ? 'User not found. Please register.'
//             : err.response?.status === 401
//               ? 'Invalid OTP or session expired.'
//               : err.code === 'ECONNABORTED'
//                 ? 'Request timed out. Check your network.'
//                 : err.response?.data?.message || 'An error occurred';
//         console.error('API Call Error:', {
//           url: err.config?.url,
//           status: err.response?.status,
//           data: err.response?.data,
//           message: err.message,
//         });
//         toast.error(errorMessage, { duration: 4000 });
//       } finally {
//         setLoading(false);
//       }
//     },
//     [otpSent, navigate]
//   );

//   const handleSendOtp = useCallback(() => {
//     const error = validatePhoneNumber(phoneNumber);
//     if (error) return toast.error(error, { duration: 4000 });
//     handleApiCall(
//       () => axios.post('/api/user/auth/send-otp', { phoneNumber: fullPhoneNumber }),
//       'OTP sent successfully!'
//     );
//   }, [phoneNumber, handleApiCall, fullPhoneNumber]);

//   const handleVerifyOtp = useCallback(() => {
//     const otpString = otp.join('');
//     if (otpString.length !== 6) return toast.error('Please enter a 6-digit OTP', { duration: 4000 });
//     handleApiCall(
//       () =>
//         axios.post('/api/user/auth/verify-otp', {
//           phoneNumber: fullPhoneNumber,
//           otp: otpString,
//         }),
//       'OTP verified successfully!'
//     );
//   }, [otp, handleApiCall, fullPhoneNumber]);

//   const handleOtpChange = (index, value) => {
//     const newOtp = [...otp];
//     newOtp[index] = value.replace(/\D/g, '').slice(0, 1);
//     setOtp(newOtp);

//     if (value && index < 5 && otpRefs.current[index + 1]) {
//       otpRefs.current[index + 1].focus();
//     }
//     if (!value && index > 0 && otpRefs.current[index - 1]) {
//       otpRefs.current[index - 1].focus();
//     }
//   };

//   const handleOtpPaste = (e, index) => {
//     const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
//     if (pastedData.length === 6) {
//       const newOtp = pastedData.split('').slice(0, 6);
//       setOtp(newOtp);
//       otpRefs.current[5]?.focus();
//       e.preventDefault();
//     }
//   };

//   const handleKeyDown = (e, index) => {
//     if (e.key === 'Backspace' && !otp[index] && index > 0) {
//       otpRefs.current[index - 1].focus();
//     }
//   };

//   useEffect(() => {
//     if (otpSent && otpRefs.current[0]) otpRefs.current[0].focus();
//   }, [otpSent]);

//   return (
//     <div className="min-h-screen flex items-start relative justify-center bg-gradient-to-br from-purple-200 via-purple-200 to-purple-300 ">
//       <Toaster position="top-center" toastOptions={{ className: 'text-sm sm:text-base font-medium' }} />
//       {/* <img className='h-[70vh]' src={bgimage} alt="" /> */}
//       <div className="w-full h-[70vh] bg-cover bg-center" style={{ backgroundImage: `url(${bgimage})` }}></div>
//       <Card className="absolute bottom-0 w-full max-w-md bg-white shadow-[-3px_0px_20px_-5px] rounded-t-3xl rounded-b-none overflow-hidden">
//         <CardHeader className="flex flex-row items-center gap-2 justify-center mt-2">
//           <div className="w-[26%] bg-gray-300 h-[2px]"></div>
//           <p className="text-sm text-gray-500 font-semibold">Log in or Sign up</p>
//           <div className="w-[26%] bg-gray-300 h-[2px]"></div>
//         </CardHeader>
//         <CardContent className="px-8 pb-10">
//           <div className="space-y-6">
//             <div className="space-y-2">
//               <div className="flex items-center gap-3">
//                 <div className="flex items-center bg-purple-100 border border-purple-200 rounded-lg px-4 py-3 text-sm font-semibold text-purple-700">
//                   {countryCode}
//                 </div>
//                 <Input
//                   id="phoneNumber"
//                   type="tel"
//                   value={phoneNumber}
//                   onChange={(e) => {
//                     const value = e.target.value.replace(/\D/g, '');
//                     if (value.length <= 10) setPhoneNumber(value);
//                   }}
//                   placeholder="Enter 10-digit number"
//                   className="flex-1 h-12 text-sm font-semibold border-gray-200 rounded-lg"
//                 />
//               </div>
//             </div>

//             {otpSent && (
//               <div className="space-y-2">
//                 <Label className="text-sm font-semibold text-gray-700">Enter 6-digit OTP</Label>
//                 <div className="flex justify-between gap-2">
//                   {otp.map((digit, index) => (
//                     <Input
//                       key={index}
//                       ref={(el) => (otpRefs.current[index] = el)}
//                       type="text"
//                       value={digit}
//                       onChange={(e) => handleOtpChange(index, e.target.value)}
//                       onKeyDown={(e) => handleKeyDown(e, index)}
//                       onPaste={(e) => handleOtpPaste(e, index)}
//                       maxLength={1}
//                       className="w-12 h-12 text-center text-lg font-mono border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all duration-300 hover:border-pink-300"
//                       aria-label={`OTP digit ${index + 1}`}
//                     />
//                   ))}
//                 </div>
//               </div>
//             )}

//             <Button
//               onClick={otpSent ? handleVerifyOtp : handleSendOtp}
//               disabled={loading}
//               className={`w-full h-12 text-white tracking-wide font-semibold rounded-lg transition-all duration-300 shadow-lg ${loading
//                 ? 'bg-gray-400 cursor-not-allowed'
//                 : 'bg-purple-500'
//                 } ${loading ? 'animate-pulse' : 'hover:scale-[1.02]'}`}
//             >
//               {otpSent ? 'Verify OTP' : 'Continue'}
//             </Button>
//             <p className="text-xs text-gray-500 text-center">
//               By continuing, you agree to our{' '}
//               <a
//                 href="/terms-of-use"
//                 className="text-purple-600 hover:underline font-semibold"
//                 target="_blank"
//                 rel="noopener noreferrer"
//               >
//                 Terms of Use
//               </a>{' '}
//               and{' '}
//               <a
//                 href="/privacy-policy"
//                 className="text-purple-600 hover:underline font-semibold"
//                 target="_blank"
//                 rel="noopener noreferrer"
//               >
//                 Privacy Policy
//               </a>.
//             </p>
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   );
// };

// export default React.memo(LoginRegister);

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// useraxios, not '../axios': this page talks to /api/user/auth/*. The '../axios' instance
// is the admin one -- it attaches adminToken and hard-redirects to /admin/login on any
// 401/403, which would bounce a customer with a wrong PIN to the admin login page.
import axios from '../useraxios';
import { toast, Toaster } from 'react-hot-toast';
import { Button } from '../../@/components/ui/button';
import { Input } from '../../@/components/ui/input';
import { Card, CardContent, CardHeader } from '../../@/components/ui/card';
import { Label } from '../../@/components/ui/label';
import bgimage from '../assets/login.jpeg';
import { FaGreaterThan } from 'react-icons/fa';

const LoginRegister = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [showPinInput, setShowPinInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const pinRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const countryCode = '+91';

  const fullPhoneNumber = `${countryCode}${phoneNumber}`;

  const validatePhoneNumber = (number) => {
    const num = number.replace(/\D/g, '');
    if (num.length !== 10 || !/^[6-9]\d{9}$/.test(num)) {
      return 'Invalid India number (10 digits, starts with 6-9)';
    }
    return '';
  };

  const handleApiCall = useCallback(
    async (callback, successMessage) => {
      const loadingToast = toast.loading('Processing...');
      setLoading(true);
      try {
        const res = await callback();
        console.log('API Response:', res.data); // Debug API response
        toast.dismiss(loadingToast);
        toast.success(res.data.message || successMessage, { duration: 3000 });
        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
          console.log('Token stored:', res.data.token); // Debug token
          try {
            const profileRes = await axios.get('/api/user/auth/profile', {
              headers: { Authorization: `Bearer ${res.data.token}` },
            });
            console.log('Profile Response:', profileRes.data); // Debug profile
            if (location.pathname !== '/') {
              console.log('Navigating to /');
              navigate('/', { replace: true });
            }
          } catch (err) {
            console.error('Profile check failed:', err.response?.data || err.message);
            toast.error('Profile fetch failed, proceeding to home.');
            if (location.pathname !== '/') {
              console.log('Navigating to / after profile failure');
              navigate('/', { replace: true });
            }
          }
        } else {
          console.warn('No token received in response');
          toast.error('Login failed: No token received');
        }
      } catch (err) {
        toast.dismiss(loadingToast);
        const errorMessage =
          err.response?.status === 404
            ? 'User not found. Please register.'
            : err.response?.status === 401
              ? 'Invalid credentials.'
              : err.code === 'ECONNABORTED'
                ? 'Request timed out. Check your network.'
                : err.response?.data?.message || 'An error occurred';
        console.error('API Call Error:', {
          url: err.config?.url,
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });
        toast.error(errorMessage, { duration: 4000 });
      } finally {
        setLoading(false);
      }
    },
    [navigate, location]
  );

  const handleContinue = useCallback(() => {
    const error = validatePhoneNumber(phoneNumber);
    if (error) return toast.error(error, { duration: 4000 });
    setShowPinInput(true);
  }, [phoneNumber]);

  const handleLoginRegister = useCallback(() => {
    const pinString = pin.join('');
    if (pinString.length !== 6) return toast.error('Please enter a 6-digit PIN', { duration: 4000 });
    handleApiCall(
      () =>
        axios.post('/api/user/auth/login-register', {
          phoneNumber: fullPhoneNumber,
          pin: pinString,
        }),
      'Logged in successfully!'
    );
  }, [pin, handleApiCall, fullPhoneNumber]);

  const handlePinChange = (index, value) => {
    const newPin = [...pin];
    newPin[index] = value.replace(/\D/g, '').slice(0, 1);
    setPin(newPin);

    if (value && index < 5 && pinRefs.current[index + 1]) {
      pinRefs.current[index + 1].focus();
    }
    if (!value && index > 0 && pinRefs.current[index - 1]) {
      pinRefs.current[index - 1].focus();
    }
  };

  const handlePinPaste = (e) => {
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pastedData.length === 6) {
      const newPin = pastedData.split('').slice(0, 6);
      setPin(newPin);
      pinRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1].focus();
    }
  };

  useEffect(() => {
    if (showPinInput && pinRefs.current[0]) pinRefs.current[0].focus();
  }, [showPinInput]);

  // Prevent redirect to /admin/login if token exists
  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('Current path:', location.pathname, 'Token:', !!token); // Debug
    if (token && location.pathname === '/admin/login') {
      console.log('Token found, redirecting to /');
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-start relative justify-center bg-gradient-to-br from-purple-200 via-purple-200 to-purple-300">
      <Toaster position="top-center" toastOptions={{ className: 'text-sm sm:text-base font-medium' }} />
      <div
        className="w-full h-[70vh] bg-cover bg-center"
        style={{ backgroundImage: `url(${bgimage})` }}
      ></div>
      <Card className="absolute bottom-0 w-full max-w-md bg-white shadow-[-3px_0px_20px_-5px] rounded-t-3xl rounded-b-none overflow-hidden border-none">
        <CardHeader className="flex flex-row items-center gap-2 justify-center mt-2">
          <div className="w-[26%] bg-gray-300 h-[2px]"></div>
          <p className="text-sm text-gray-500 font-semibold">Log in or Sign up</p>
          <div className="w-[26%] bg-gray-300 h-[2px]"></div>
        </CardHeader>
        <CardContent className="px-8 pb-10">
          <div className="flex flex-col">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="text-sm font-semibold text-gray-700">
                  Phone Number
                </Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-2 flex items-center pr-3 text-sm font-semibold text-purple-700">
                    {countryCode}
                  </span>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 10) setPhoneNumber(value);
                    }}
                    placeholder="Enter 10-digit number"
                    className="h-12 pl-10 pr-16 text-sm font-semibold border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-lg transition-all duration-300 hover:border-purple-300"
                  />
                </div>
              </div>

              {showPinInput && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">Enter 6-digit PIN</Label>
                  <div className="flex justify-between gap-2">
                    {pin.map((digit, index) => (
                      <Input
                        key={index}
                        ref={(el) => (pinRefs.current[index] = el)}
                        type="text"
                        value={digit}
                        onChange={(e) => handlePinChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        onPaste={(e) => handlePinPaste(e, index)}
                        maxLength={1}
                        className="w-12 h-12 text-center text-lg font-mono border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 hover:border-purple-300"
                        aria-label={`PIN digit ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={showPinInput ? handleLoginRegister : handleContinue}
                disabled={loading}
                className={`w-full h-12 text-white tracking-wide font-semibold rounded-lg transition-all duration-300 shadow-lg ${loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-500 hover:bg-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
                  } ${loading ? 'animate-pulse' : 'hover:scale-[1.02]'}`}
              >
                {showPinInput ? 'Login/Register' : 'Continue'}
              </Button>
              <Button
                variant="link"
                onClick={() => navigate('/')}
                className="w-full m-0 p-0 text-purple-600 font-semibold hover:underline"
              >
                Skip for now
              </Button>
              <p className="text-xs text-gray-500 text-center">
                By continuing, you agree to our{' '}
                <a
                  href="/terms-of-use"
                  className="text-purple-600 hover:underline font-semibold"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms of Use
                </a>{' '}
                and{' '}
                <a
                  href="/privacy-policy"
                  className="text-purple-600 hover:underline font-semibold"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <style>{`
        .min-h-screen {
          background: linear-gradient(135deg, #e9d5ff 0%, #ede9fe 50%, #d8b4fe 100%);
        }
        .shadow-[-3px_0px_20px_-5px] {
          box-shadow: -3px 0px 20px -5px rgba(0, 0, 0, 0.2);
        }
        .rounded-t-3xl {
          border-top-left-radius: 1.75rem;
          border-top-right-radius: 1.75rem;
        }
        .transition-all {
          transition: all 0.3s ease-in-out;
        }
        .hover\\:scale-[1.02]:hover {
          transform: scale(1.02);
        }
        .hover\\:border-purple-300:hover {
          border-color: #c4b5fd;
        }
      `}</style>
    </div>
  );
};

export default React.memo(LoginRegister);