import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Phone,
  Map,
  Briefcase,
  Award,
  Globe,
  CreditCard,
  FileText
} from "lucide-react";

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    user_type: "",
    // Additional fields based on user type
    nationality: "",
    address: "",
    pan_number: "",
    license_no: "",
    experience_years: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Calculate password strength
    if (name === 'password') {
      let strength = 0;
      if (value.length >= 8) strength += 25;
      if (/[A-Z]/.test(value)) strength += 25;
      if (/[0-9]/.test(value)) strength += 25;
      if (/[^A-Za-z0-9]/.test(value)) strength += 25;
      setPasswordStrength(strength);
    }
  };

  const handleUserTypeChange = (user_type) => {
    setFormData(prev => ({
      ...prev,
      user_type,
      // Reset additional fields when changing user type
      nationality: user_type === "tourist" ? prev.nationality : "",
      address: (user_type === "host" || user_type === "guide") ? prev.address : "",
      pan_number: user_type === "host" ? prev.pan_number : "",
      license_no: user_type === "guide" ? prev.license_no : "",
      experience_years: user_type === "guide" ? prev.experience_years : ""
    }));
  };

  const getStrengthColor = (strength) => {
    if (strength <= 25) return "bg-red-500";
    if (strength <= 50) return "bg-orange-500";
    if (strength <= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthText = (strength) => {
    if (strength <= 25) return "Weak";
    if (strength <= 50) return "Fair";
    if (strength <= 75) return "Good";
    return "Strong";
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!formData.phone || !validatePhone(formData.phone)) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (!formData.user_type) {
      setError("Please select a user type");
      return;
    }

    // Additional validations based on user type
    if (formData.user_type === "tourist" && !formData.nationality) {
      setError("Nationality is required for tourists");
      return;
    }

    if (formData.user_type === "host") {
      if (!formData.address) {
        setError("Address is required for hosts");
        return;
      }
      if (!formData.pan_number) {
        setError("PAN number is required for hosts");
        return;
      }
    }

    if (formData.user_type === "guide") {
      if (!formData.license_no) {
        setError("License number is required for guides");
        return;
      }
      if (!formData.experience_years || formData.experience_years < 0) {
        setError("Please enter valid experience years");
        return;
      }
      if (!formData.address) {
        setError("Address is required for guides");
        return;
      }
    }

    setIsLoading(true);

    try {
      // Prepare data based on user type
      let dataToSend = {
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        user_type: formData.user_type
      };

      // Add additional fields based on user type
      if (formData.user_type === "tourist") {
        dataToSend.nationality = formData.nationality;
      } else if (formData.user_type === "host") {
        dataToSend.address = formData.address;
        dataToSend.pan_number = formData.pan_number;
      } else if (formData.user_type === "guide") {
        dataToSend.license_no = formData.license_no;
        dataToSend.experience_years = parseInt(formData.experience_years);
        dataToSend.address = formData.address;
      }

      await axios.post(
        "http://localhost:5000/api/auth/register",
        dataToSend,
        { withCredentials: true }
      );

      const normalizedEmail = formData.email.trim().toLowerCase();
      setSuccess("Verification OTP sent. Redirecting to OTP verification...");

      setTimeout(() => {
        navigate(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
      }, 1200);

    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const userTypeInfo = {
    tourist: {
      title: "Tourist",
      icon: "🧗",
      description: "Explore Nepal's hidden trails and book unique experiences",
      color: "border-gold bg-gold/5",
      bgColor: "bg-gold/10",
      textColor: "text-gold"
    },
    host: {
      title: "Host",
      icon: "🏠",
      description: "Share your local knowledge and host travelers",
      color: "border-navy bg-navy/5",
      bgColor: "bg-navy/10",
      textColor: "text-navy"
    },
    guide: {
      title: "Guide",
      icon: "🧭",
      description: "Guide adventurers through Nepal's beautiful landscapes",
      color: "border-alpine bg-alpine/10",
      bgColor: "bg-alpine/10",
      textColor: "text-alpine"
    }
  };

  return (
    <div className="min-h-screen flex bg-cream">
      {/* Left Side - Brand & Info */}
      <div
        className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0C2340 0%, #163A5F 55%, #081A2F 100%)" }}
      >
        {/* Decorative rings */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border border-gold/10 pointer-events-none" />

        <div className="relative z-10 h-full flex flex-col justify-between">
          <div>
            <div className="relative w-28 h-28 mb-8">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold/40 via-gold/20 to-gold/40 p-[2px]">
                <div className="h-full w-full rounded-full bg-navy/80 p-0.5">
                  <img
                    src="/offtrail-latest.png"
                    alt="OffTrail Nepal"
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-white mb-1 font-heading">
              Join the Adventure
            </h1>
            <p className="text-gold text-sm font-medium mb-8">Nepal's Off-Trail Platform</p>

            <div className="space-y-4">
              {Object.entries(userTypeInfo).map(([type, info]) => (
                <div key={type} className="flex items-start">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 mr-3" style={{ background: "rgba(200,147,42,0.2)", color: "#C8932A" }}>
                    ✓
                  </span>
                  <div>
                    <h3 className="font-semibold text-sm text-white">{info.title}</h3>
                    <p className="text-white/50 text-xs leading-relaxed">{info.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/25 text-xs italic mt-6 leading-relaxed">
            "The journey of a thousand miles begins with a single step."
          </p>
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {/* Back to Login */}
          <div className="mb-6">
            <Link
              to="/login"
              className="inline-flex items-center text-navy hover:text-gold font-medium group transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2 transform group-hover:-translate-x-1 transition-transform duration-300" />
              Back to Login
            </Link>
          </div>

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold/40 via-gold/20 to-gold/40 p-[2px]">
                <div className="h-full w-full rounded-full bg-white p-0.5">
                  <img
                    src="/offtrail-latest.png"
                    alt="OffTrail Nepal"
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Your Account</h2>
            <p className="text-gray-600">Join our community of explorers and locals</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-green-600 text-sm flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                {success}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Full Name */}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Full Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Phone Number *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                    placeholder="98XXXXXXXX"
                    required
                    maxLength="10"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">10-digit Nepal phone number</p>
              </div>
            </div>

            {/* Password Section */}
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Password */}
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2">
                    Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                      placeholder="Create a strong password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                      placeholder="Confirm your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Strength Meter */}
              {formData.password && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Password strength:</span>
                    <span className={`font-medium ${passwordStrength <= 25 ? "text-red-600" :
                        passwordStrength <= 50 ? "text-orange-600" :
                          passwordStrength <= 75 ? "text-yellow-600" : "text-green-600"
                      }`}>
                      {getStrengthText(passwordStrength)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getStrengthColor(passwordStrength)} transition-all duration-300`}
                      style={{ width: `${passwordStrength}%` }}
                    ></div>
                  </div>
                  <ul className="mt-3 text-sm text-gray-600 grid grid-cols-2 gap-2">
                    <li className={`flex items-center ${formData.password.length >= 8 ? 'text-green-600' : ''}`}>
                      <CheckCircle className={`h-4 w-4 mr-2 ${formData.password.length >= 8 ? 'text-green-600' : 'text-gray-400'}`} />
                      At least 8 characters
                    </li>
                    <li className={`flex items-center ${/[A-Z]/.test(formData.password) ? 'text-green-600' : ''}`}>
                      <CheckCircle className={`h-4 w-4 mr-2 ${/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`} />
                      Uppercase letter
                    </li>
                    <li className={`flex items-center ${/[0-9]/.test(formData.password) ? 'text-green-600' : ''}`}>
                      <CheckCircle className={`h-4 w-4 mr-2 ${/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`} />
                      Number
                    </li>
                    <li className={`flex items-center ${/[^A-Za-z0-9]/.test(formData.password) ? 'text-green-600' : ''}`}>
                      <CheckCircle className={`h-4 w-4 mr-2 ${/[^A-Za-z0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`} />
                      Special character
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* User Type Selection */}
            <div className="mb-8">
              <label className="block text-gray-700 text-sm font-medium mb-4">
                I want to join as a *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(userTypeInfo).map(([type, info]) => (
                  <div
                    key={type}
                    className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 ${formData.user_type === type
                        ? info.color
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    onClick={() => handleUserTypeChange(type)}
                  >
                    <input
                      type="radio"
                      name="user_type"
                      value={type}
                      checked={formData.user_type === type}
                      onChange={() => { }}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${formData.user_type === type ? info.bgColor : 'bg-gray-100'
                        }`}>
                        <span className="text-xl">{info.icon}</span>
                      </div>
                      <h3 className="font-medium text-gray-900">{info.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">{info.description}</p>
                    </div>
                    {formData.user_type === type && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle className="h-5 w-5 text-gold" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Conditional Fields Based on User Type */}
            {formData.user_type === "tourist" && (
              <div className="mb-6 bg-gold/5 p-6 rounded-xl border border-gold/20">
                <div className="flex items-center mb-4">
                  <Globe className="h-5 w-5 text-gold mr-2" />
                  <h3 className="font-medium text-navy">Tourist Information</h3>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2">
                    Nationality *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleChange}
                      className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                      placeholder="e.g., American, British, Indian, etc."
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This helps us provide relevant travel information
                  </p>
                </div>
              </div>
            )}

            {formData.user_type === "host" && (
              <div className="mb-6 bg-navy/5 p-6 rounded-xl border border-navy/10">
                <div className="flex items-center mb-4">
                  <Map className="h-5 w-5 text-navy mr-2" />
                  <h3 className="font-medium text-navy">Host Information</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                      Address *
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                      placeholder="Enter your full address including city and district"
                      rows="3"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This will be shown to tourists looking for accommodation
                    </p>
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                      PAN Number *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <CreditCard className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="pan_number"
                        value={formData.pan_number}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                        placeholder="Enter your PAN number"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Required for tax and payment purposes
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formData.user_type === "guide" && (
              <div className="mb-6 bg-alpine/5 p-6 rounded-xl border border-alpine/20">
                <div className="flex items-center mb-4">
                  <Briefcase className="h-5 w-5 text-alpine mr-2" />
                  <h3 className="font-medium text-alpine">Guide Information</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-2">
                        Citizenship Number *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FileText className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          name="license_no"
                          value={formData.license_no}
                          onChange={handleChange}
                          className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                          placeholder="Enter citizenship number"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Your official citizenship number
                      </p>
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-2">
                        Years of Experience *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Award className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="number"
                          name="experience_years"
                          value={formData.experience_years}
                          onChange={handleChange}
                          className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                          placeholder="5"
                          min="0"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                      Address *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Map className="h-5 w-5 text-gray-400" />
                      </div>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                        placeholder="Enter your full address"
                        rows="2"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Your current residential address
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Terms and Conditions */}
            <div className="mb-8">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  required
                  className="h-4 w-4 text-gold rounded focus:ring-gold/30 border-gray-300 mt-1"
                />
                <span className="ml-2 text-sm text-gray-600">
                  I agree to the{" "}
                  <Link to="/terms" className="text-blue-600 hover:text-blue-800">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-blue-600 hover:text-blue-800">
                    Privacy Policy
                  </Link>{" "}
                  of OffTrailNepal. I confirm that all information provided is accurate.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 font-bold text-navy rounded-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              style={{ background: "linear-gradient(135deg, #C8932A 0%, #E0B04A 100%)", boxShadow: "0 4px 15px rgba(200,147,42,0.35)" }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                  Creating Account...
                </div>
              ) : (
                <span className="flex items-center justify-center gap-2">Create My Account <ArrowRight className="h-4 w-4" /></span>
              )}
            </button>
          </form>

          {/* Already have account */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-navy hover:text-gold transition-colors"
              >
                Sign In →
              </Link>
            </p>
          </div>

          {/* Security Note */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-center text-gray-400 text-xs">
              <Shield className="h-3.5 w-3.5 mr-1.5 text-gold" />
              <span>Your information is secured with 256-bit encryption</span>
            </div>
            <p className="text-center text-gray-400 text-xs mt-2">© {new Date().getFullYear()} OffTrail Nepal. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;