"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
// 1. Import Hook & Animation Libs
import { useNotification } from "@/components/NotificationProvider";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ChevronLeft, 
  CheckCircle, 
  Mail, 
  KeyRound, 
  ShieldCheck 
} from "lucide-react";

// --- ANIMATION VARIANTS ---
const fadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // 2. Initialize Notification Hook
  const { showNotification } = useNotification();

  // Clear error when user types
  useEffect(() => {
    if (error) setError("");
  }, [username, password]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      // 3. Trigger Success Notification
      showNotification("Login successful! Redirecting...", "success");
      
      // Simulate slight delay for effect before redirect
      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    } else {
      setError("Please enter both username and password.");
      // Optional: Trigger error notification
      showNotification("Invalid credentials.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex flex-col font-sans text-gray-800">
      
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#0B3C8A]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-200/20 rounded-full blur-3xl" />
      </div>

      {/* HEADER */}
      <header className="relative z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 md:px-12 py-4 flex items-center gap-3 sticky top-0">
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
          M.T Olaso Optical Clinic
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
              Optical Inventory <br /> Management System
            </motion.h2>

            <motion.p variants={fadeIn} className="text-lg text-slate-600 leading-relaxed max-w-md">
              Streamline your clinic operations. Track frames, lenses, and forecast demand with precision.
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

              <form onSubmit={handleLogin} className="space-y-5">
                {/* Username Input */}
                <div className="space-y-1">
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-[#0B3C8A] transition-colors" />
                    <input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C8A]/20 focus:border-[#0B3C8A] transition-all"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1">
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-[#0B3C8A] transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                  className="w-full rounded-xl bg-[#0B3C8A] py-3.5 text-white font-bold shadow-lg shadow-blue-900/20 hover:bg-[#092e6b] hover:shadow-blue-900/30 transition-all duration-300"
                >
                  LOG IN
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

      {/* FORGOT PASSWORD MODAL */}
      <AnimatePresence>
        {isForgotPasswordOpen && (
          <ForgotPasswordModal
            isOpen={isForgotPasswordOpen}
            onClose={() => setIsForgotPasswordOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- FORGOT PASSWORD MODAL COMPONENT ---
function ForgotPasswordModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"email" | "code" | "reset" | "success">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Hook inside modal
  const { showNotification } = useNotification();

  // Reset state when closing
  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("email");
      setEmail("");
      setCode("");
      setPassword("");
      setConfirmPassword("");
    }, 300); // Wait for animation to finish
  };

  const validatePassword = (password: string) => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  });

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
        {/* Decorative header bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0B3C8A] to-blue-400" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
        >
          ✕
        </button>

        {/* --- STEP 1: EMAIL --- */}
        {step === "email" && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-[#0B3C8A]">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Reset Password</h3>
              <p className="text-sm text-gray-500 mt-2">
                Enter your email address and we'll send you a code to reset your password.
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="email"
                required
                placeholder="name@company.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0B3C8A]/20 focus:border-[#0B3C8A] transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                onClick={() => {
                    setStep("code");
                    showNotification("Verification code sent to email.", "success");
                }}
                className="w-full rounded-xl bg-[#0B3C8A] py-3 text-white font-semibold hover:bg-[#092e6b] transition-colors"
              >
                Send Code
              </button>
            </div>
          </motion.div>
        )}

        {/* --- STEP 2: CODE --- */}
        {step === "code" && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-[#0B3C8A]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Enter Code</h3>
              <p className="text-sm text-gray-500 mt-2">
                We sent a code to <span className="font-semibold text-gray-800">{email}</span>
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="• • • • • •"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.5em] font-bold text-[#0B3C8A] focus:outline-none focus:ring-2 focus:ring-[#0B3C8A]/20 focus:border-[#0B3C8A] transition-all"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
              />
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep("email")}
                  className="flex items-center justify-center gap-2 px-6 rounded-xl border border-gray-200 py-3 text-gray-600 font-medium hover:bg-gray-50 transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => setStep("reset")}
                  className="flex-1 rounded-xl bg-[#0B3C8A] py-3 text-white font-semibold hover:bg-[#092e6b] transition-colors"
                >
                  Verify
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- STEP 3: RESET --- */}
        {step === "reset" && (() => {
          const rules = validatePassword(password);
          const isValid = rules.length && rules.uppercase && rules.number && rules.symbol;
          const isMatch = password === confirmPassword && password !== "";

          return (
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-4">
              <div className="text-center mb-2">
                 <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-[#0B3C8A]">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">New Password</h3>
              </div>

              <div className="space-y-3">
                <div className="relative">
                   <input
                    type="password"
                    placeholder="New password"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0B3C8A]/20 focus:border-[#0B3C8A] transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <input
                  type="password"
                  placeholder="Confirm password"
                  className={`w-full rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 transition-all ${
                    confirmPassword && !isMatch 
                      ? "border-red-300 focus:ring-red-200 focus:border-red-500" 
                      : "border-gray-300 focus:ring-[#0B3C8A]/20 focus:border-[#0B3C8A]"
                  }`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {/* PASSWORD RULES GRID */}
              <div className="bg-gray-50 p-3 rounded-lg grid grid-cols-2 gap-2 text-xs">
                 <RuleItem valid={rules.length} text="8+ Characters" />
                 <RuleItem valid={rules.uppercase} text="Uppercase" />
                 <RuleItem valid={rules.number} text="Number" />
                 <RuleItem valid={rules.symbol} text="Symbol" />
              </div>

              <button
                disabled={!isValid || !isMatch}
                onClick={() => {
                    setStep("success");
                    showNotification("Password has been reset!", "success");
                }}
                className={`w-full rounded-xl py-3 font-bold transition-all duration-300 ${
                  isValid && isMatch
                    ? "bg-[#0B3C8A] text-white shadow-lg hover:bg-[#092e6b]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Reset Password
              </button>
            </motion.div>
          );
        })()}

        {/* --- STEP 4: SUCCESS --- */}
        {step === "success" && (
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
              All Set!
            </h3>

            <p className="text-sm text-gray-600 mb-8 max-w-xs mx-auto">
              Your password has been successfully updated. You can now log in securely.
            </p>

            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-[#0B3C8A] py-3 text-white font-bold hover:bg-[#092e6b] shadow-lg transition-all"
            >
              Back to Login
            </button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// Helper for password rules
function RuleItem({ valid, text }: { valid: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${valid ? "text-green-600" : "text-gray-400"}`}>
      {valid ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />}
      <span>{text}</span>
    </div>
  );
}