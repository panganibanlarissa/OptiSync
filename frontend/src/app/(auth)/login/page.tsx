// src/app/(auth)/login/page.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useNotification } from "@/components/NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  Mail, 
  FileText,
  Shield
} from "lucide-react";

// --- ANIMATION VARIANTS ---
const fadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  visible: { transition: { staggerChildren: 0.1 } },
};

// Define error type
interface ErrorWithMessage {
  message: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useFirebase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal States
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  const { showNotification } = useNotification();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Handle login attempt
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (email && password) {
      setIsLoading(true);
      setError(""); // Clear any previous errors
      
      try {
        await login(email, password);
        // Toast removed - no success message needed
      } catch (err: unknown) {
        console.error("Login error:", err);
        
        const error = err as ErrorWithMessage;
        
        if (error.message === "This account has been deactivated. Please contact an administrator.") {
          setError("This account has been deactivated. Please contact an administrator.");
          showNotification("Account deactivated. Contact admin.", "error");
        } else {
          setError("Invalid username or password.");
          showNotification("Login failed. Please check your credentials.", "error");
        }
        
        setIsLoading(false);
      }
    } else {
      setError("Please enter both email and password.");
    }
  };

  // Clear error when user starts typing
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError("");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError("");
  };



  const handlePrivacyAgree = () => {
    setIsPrivacyModalOpen(false);
  };

  const handleTermsAgree = () => {
    setIsTermsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex flex-col font-sans text-gray-800">
      
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#0B3C8A]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-200/20 rounded-full blur-3xl" />
      </div>

      {/* HEADER */}
      <header className="z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 md:px-12 py-4 flex items-center gap-3 sticky top-0">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} 
          animate={{ opacity: 1, scale: 1 }}
        >
          <Image src="/logo.png" alt="MT Olaso Logo" width={42} height={42} className="drop-shadow-sm" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, x: -10 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="text-base md:text-lg font-bold text-[#0B3C8A] tracking-tight"
        >
          OlasoSync
        </motion.h1>
      </header>

      {/* MAIN CONTENT */}
      <section className="relative z-10 flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-6xl flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24">

          {/* LEFT CONTENT (Hero) */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex flex-col items-center text-center md:items-start md:text-left md:flex-1 max-w-lg"
          >
            <motion.div variants={fadeIn} className="relative mb-8 group cursor-default">
              {/* Optional: Add a subtle glow behind the logo */}
              <div className="absolute inset-0 bg-blue-400/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <Image
                src="/logo.png"
                alt="Inventory System"
                width={600}
                height={300}
                priority
                className="relative w-64 sm:w-80 md:w-[450px] h-auto object-contain drop-shadow-xl transition-transform duration-500 hover:scale-[1.02]"
              />
            </motion.div>

            <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-extrabold text-[#0B3C8A] mb-4 leading-tight">
              OlasoSync: Real-Time Inventory Tracking
            </motion.h2>

            <motion.p variants={fadeIn} className="text-lg text-slate-600 leading-relaxed max-w-md">
              Streamline your clinic operations. Track frames, lenses, and low-stocks with precision.
            </motion.p>
          </motion.div>

          {/* LOGIN CARD */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="w-full max-w-[400px]"
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/50 p-8">
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
                <p className="text-sm text-gray-500 mt-2">Please enter your details to sign in.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email Input */}
                <div>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-[#0B3C8A] transition-colors" />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={handleEmailChange}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C8A]/20 focus:border-[#0B3C8A] transition-all"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-[#0B3C8A] transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={handlePasswordChange}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C8A]/20 focus:border-[#0B3C8A] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Terms and Privacy Policy Statement */}
                <div className="text-xs text-gray-600 leading-tight pt-2 pb-1">
                  By logging in, you agree to OlasoSync&apos;s{" "}
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setIsTermsModalOpen(true); }} 
                    className="text-[#0B3C8A] font-semibold hover:underline"
                  >
                    Terms & Conditions
                  </button>
                  {" "}and{" "}
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setIsPrivacyModalOpen(true); }} 
                    className="text-[#0B3C8A] font-semibold hover:underline"
                  >
                    Privacy Policy
                  </button>.
                </div>

                {/* Error Message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-lg border border-red-100"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Login Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className={`w-full rounded-xl mt-2 ${isLoading ? 'bg-blue-400' : 'bg-[#0B3C8A] hover:bg-[#092e6b]'} py-3.5 text-white font-bold shadow-lg shadow-blue-900/20 transition-all duration-300`}
                >
                  {isLoading ? 'LOGGING IN...' : 'LOG IN'}
                </motion.button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-sm font-medium text-[#0B3C8A] hover:text-[#092e6b] hover:underline underline-offset-4 transition-all"
                >
                  Forgot Password?
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {isForgotPasswordOpen && (
          <ForgotPasswordModal
            onClose={() => setIsForgotPasswordOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPrivacyModalOpen && (
          <LegalModal
            title="Privacy Policy"
            icon={<Shield className="w-6 h-6" />}
            onClose={() => setIsPrivacyModalOpen(false)}
            onAgree={handlePrivacyAgree}
          >
            <p>
              OlasoSync (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy and ensuring the security of your personal data. This Privacy Policy explains how we collect, use, and protect your information when you use our Optical Inventory Management System.
            </p>
            <h4 className="font-bold text-gray-900 mt-4 mb-2">1. Compliance with the Data Privacy Act of 2012</h4>
            <p>
              We adhere strictly to the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong> of the Philippines. We ensure that any personal information collected through this system is processed fairly, lawfully, and securely.
            </p>
            <h4 className="font-bold text-gray-900 mt-4 mb-2">2. Information We Collect</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>User Credentials:</strong> Usernames, passwords, and staff roles for system access authentication.</li>
              <li><strong>Activity Logs:</strong> System usage, inventory modifications, and transaction records for auditing purposes.</li>
              <li><strong>Patient Information:</strong> Names and optical prescriptions entered during transactions or inventory allocation.</li>
            </ul>
            <h4 className="font-bold text-gray-900 mt-4 mb-2">3. How We Use Your Information</h4>
            <p>
              The collected data is exclusively used to facilitate clinic operations, manage inventory levels, track sales, and authenticate authorized personnel. We do not sell or share personal or clinic data with third-party entities without explicit consent, unless required by Philippine law.
            </p>
            <h4 className="font-bold text-gray-900 mt-4 mb-2">4. Data Security & Storage</h4>
            <p>
              We implement industry-standard security measures, including encryption and restricted role-based access, to protect data against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </LegalModal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTermsModalOpen && (
          <LegalModal
            title="Terms & Conditions"
            icon={<FileText className="w-6 h-6" />}
            onClose={() => setIsTermsModalOpen(false)}
            onAgree={handleTermsAgree}
          >
            <p>
              Welcome to OlasoSync. By accessing or using this system, you agree to be bound by the following Terms and Conditions.
            </p>
            <h4 className="font-bold text-gray-900 mt-4 mb-2">1. Authorized Access Only</h4>
            <p>
              Access to this system is strictly limited to authorized personnel of M.T. Olaso Optical Clinic. You are responsible for maintaining the confidentiality of your login credentials. Sharing accounts or unauthorized access attempts will result in disciplinary action.
            </p>
            <h4 className="font-bold text-gray-900 mt-4 mb-2">2. Acceptable Use</h4>
            <p>
              You agree to use the system solely for legitimate clinic operations, including inventory tracking, sales recording, and forecasting. You must not use the system to input falsified data, disrupt clinic operations, or extract data for personal gain.
            </p>
            <h4 className="font-bold text-gray-900 mt-4 mb-2">3. Data Confidentiality (RA 10173)</h4>
            <p>
              As a user of this system, you may have access to sensitive clinic data and patient records. In accordance with the <strong>Data Privacy Act of 2012 (RA 10173)</strong>, you are legally obligated to keep all patient data strictly confidential and must not disclose it to unauthorized parties.
            </p>
            <h4 className="font-bold text-gray-900 mt-4 mb-2">4. System Integrity</h4>
            <p>
              We reserve the right to monitor system activity to ensure compliance with these terms. Any misuse, abuse, or unauthorized modification of the inventory system will lead to the immediate revocation of your access privileges.
            </p>
          </LegalModal>
        )}
      </AnimatePresence>

    </div>
  );
}

// --- REUSABLE LEGAL MODAL COMPONENT ---
function LegalModal({
  title,
  icon,
  children,
  onClose,
  onAgree,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  onAgree: () => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Decorative header bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0B3C8A] to-blue-400" />

        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-[#0B3C8A]">
              {icon}
            </div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto text-sm text-gray-600 leading-relaxed custom-scrollbar">
          {children}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
          <button
            onClick={onAgree}
            className="px-6 py-2.5 rounded-xl bg-[#0B3C8A] text-white font-semibold hover:bg-[#092e6b] transition-colors"
          >
            I Understand
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- FORGOT PASSWORD MODAL COMPONENT ---
function ForgotPasswordModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");

  const { showNotification } = useNotification();
  const { resetStaffPassword } = useFirebase();

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setEmail("");
      setIsSent(false);
      setError("");
    }, 300);
  };

  const handleSendResetEmail = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await resetStaffPassword(email);
      setIsSent(true);
      showNotification(`Password reset email sent to ${email}`, "success");
    } catch (err: unknown) {
      console.error("Password reset error:", err);
      
      const error = err as { message: string };
      setError(error.message);
      showNotification("Failed to send reset email", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && !isSent) {
      handleSendResetEmail();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0B3C8A] to-blue-400" />
        <button 
          onClick={handleClose} 
          className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
        >
          ✕
        </button>

        {!isSent ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-[#0B3C8A]">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Reset Password</h3>
              <p className="text-sm text-gray-500 mt-2">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  className={`w-full rounded-xl border ${
                    error ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-[#0B3C8A]/20 focus:border-[#0B3C8A]'
                  } px-4 py-3 focus:outline-none focus:ring-2 transition-all`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                />
                {error && (
                  <p className="text-red-500 text-xs mt-2">{error}</p>
                )}
              </div>

              <button
                onClick={handleSendResetEmail}
                disabled={isLoading}
                className={`w-full rounded-xl ${
                  isLoading ? 'bg-blue-400' : 'bg-[#0B3C8A] hover:bg-[#092e6b]'
                } py-3 text-white font-semibold transition-colors flex items-center justify-center gap-2`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    SENDING...
                  </>
                ) : (
                  'SEND RESET LINK'
                )}
              </button>

              <button
                onClick={handleClose}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Back to Login
              </button>
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="text-center py-6"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-10 h-10" />
            </motion.div>

            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Check Your Email
            </h3>

            <p className="text-sm text-gray-600 mb-8 max-w-xs mx-auto">
              We&apos;ve sent a password reset link to <span className="font-semibold text-gray-800">{email}</span>. Please check your inbox and follow the instructions.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleClose}
                className="w-full rounded-xl bg-[#0B3C8A] py-3 text-white font-bold hover:bg-[#092e6b] shadow-lg transition-all"
              >
                Back to Login
              </button>
              
              <button
                onClick={() => {
                  setIsSent(false);
                  setEmail("");
                }}
                className="w-full text-sm text-[#0B3C8A] hover:text-[#092e6b] transition-colors"
              >
                Send to different email
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}