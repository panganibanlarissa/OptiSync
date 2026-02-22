"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image"; 
import { 
  Package, 
  TrendingUp, 
  ArrowRight, 
  Menu, 
  X, 
  CheckCircle2,
  AlertTriangle,
  BrainCircuit,
  ShoppingCart,
  FileText,
  Clock,
  Truck,
  Sparkles
} from "lucide-react";

// --- THEME COLORS ---
const THEME_BG = "bg-[#0B3C8A]";
const THEME_TEXT = "text-[#0B3C8A]";

// --- STATIC FORECAST DATA ---
const FORECAST_DATA = [
  { month: "Jan", value: 35, type: "history" },
  { month: "Feb", value: 42, type: "history" },
  { month: "Mar", value: 38, type: "history" },
  { month: "Apr", value: 55, type: "history" },
  { month: "May", value: 62, type: "history" },
  { month: "Jun", value: 78, type: "forecast" }, // Predicted Spike
  { month: "Jul", value: 85, type: "forecast" }, // Peak Prediction
];

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"checkout" | "inventory" | "reports">("checkout");

  // Handle Scroll Effect for Navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 selection:bg-blue-100 overflow-x-hidden">
      
      {/* --- 1. NAVBAR --- */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-white/90 backdrop-blur-md shadow-sm py-3" : "bg-transparent py-4 sm:py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image 
               src="/logo.png" 
               alt="MT Olaso Logo" 
               width={42} 
               height={42} 
               className="drop-shadow-sm w-8 h-8 lg:w-9 lg:h-9" 
            />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">M.T Olaso Optical Clinic</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#features" className="hover:text-[#0B3C8A] transition-colors">System Features</a>
            <a href="#workflow" className="hover:text-[#0B3C8A] transition-colors">How it Works</a>
            <a href="#about" className="hover:text-[#0B3C8A] transition-colors">About</a>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link 
              href="/login" 
              className={`px-6 py-2.5 ${THEME_BG} text-white rounded-xl font-bold text-sm hover:bg-[#08306B] transition-all shadow-lg shadow-blue-900/20 hover:-translate-y-0.5 active:scale-95`}
            >
              Login
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden text-slate-600 p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={26}/> : <Menu size={26}/>}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-100 p-5 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-top-5">
            <a href="#features" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>System Features</a>
            <a href="#workflow" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
            <a href="#about" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>About</a>
            <div className="h-px bg-slate-100 my-1"></div>
            <Link href="/login" className={`w-full text-center py-3.5 ${THEME_BG} text-white rounded-xl font-bold text-base`} onClick={() => setMobileMenuOpen(false)}>
              Log In
            </Link>
          </div>
        )}
      </header>

      {/* --- 2. HERO SECTION --- */}
      <section className="relative pt-28 pb-16 md:pt-40 md:pb-28 overflow-hidden px-4 sm:px-6">
        {/* Background Decorations */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-blue-100/50 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-purple-100/40 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center relative z-10">
          
          {/* Text Content */}
          <div className="animate-in slide-in-from-bottom-10 fade-in duration-700 mt-8 sm:mt-0 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] sm:text-xs font-bold mb-6">
               <Sparkles size={14} /> Smart Inventory Management
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.1] mb-5 tracking-tight">
              Smart Inventory <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0B3C8A] to-purple-600">
                & Sales Management
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-500 mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0 font-medium">
              Easily process patient checkouts, track your glasses and lenses, and let our smart system predict your future sales so you never run out of stock.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
              <Link 
                href="/login" 
                className={`px-8 py-3.5 sm:py-4 ${THEME_BG} text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:bg-[#08306B] transition-all shadow-xl shadow-blue-900/20 hover:-translate-y-1 flex items-center justify-center gap-2`}
              >
                Access Now <ArrowRight size={18} />
              </Link>
            </div>

            <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 text-xs sm:text-sm text-slate-500 font-bold">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> Easy Checkouts</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> Low Stock Alerts</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> Printable Reports</span>
            </div>
          </div>

          {/* Abstract Dashboard Mockup (Responsive Scaling) */}
          <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] flex items-center justify-center animate-in zoom-in-95 fade-in duration-1000 delay-200 mt-4 sm:mt-0">
            <div className="relative w-full max-w-[280px] sm:max-w-sm lg:max-w-lg aspect-square">
                {/* Main Card */}
                <div className="absolute inset-0 bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 p-4 sm:p-6 flex flex-col overflow-hidden rotate-[-2deg] hover:rotate-0 transition-all duration-500">
                   {/* Mock Header */}
                   <div className="flex items-center justify-between mb-4 sm:mb-6 border-b border-slate-100 pb-3 sm:pb-4">
                      <div className="flex gap-1.5 sm:gap-2">
                         <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-200"></div>
                         <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-200"></div>
                      </div>
                      <div className="w-24 sm:w-32 h-2 bg-blue-50 rounded-full"></div>
                   </div>
                   {/* Mock Chart Area */}
                   <div className="flex gap-2 sm:gap-4 items-end h-24 sm:h-32 mb-4 sm:mb-6 px-2 sm:px-4">
                      <div className="w-1/5 h-[40%] bg-blue-100 rounded-t-md sm:rounded-t-lg"></div>
                      <div className="w-1/5 h-[70%] bg-blue-200 rounded-t-md sm:rounded-t-lg"></div>
                      <div className="w-1/5 h-[50%] bg-blue-100 rounded-t-md sm:rounded-t-lg"></div>
                      <div className="w-1/5 h-[90%] bg-gradient-to-t from-[#0B3C8A] to-purple-500 rounded-t-md sm:rounded-t-lg relative shadow-lg">
                         <div className="absolute -top-6 sm:-top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow-lg whitespace-nowrap">AI Forecast</div>
                      </div>
                      <div className="w-1/5 h-[60%] bg-purple-200 rounded-t-md sm:rounded-t-lg"></div>
                   </div>
                   {/* Mock List */}
                   <div className="space-y-2 sm:space-y-3">
                      <div className="h-10 sm:h-12 w-full bg-slate-50 rounded-xl flex items-center justify-between px-3 sm:px-4 border border-slate-100">
                         <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600"><AlertTriangle size={12} className="sm:w-[14px] sm:h-[14px]"/></div>
                            <div className="w-16 sm:w-24 h-1.5 sm:h-2 bg-slate-200 rounded-full"></div>
                         </div>
                         <div className="w-6 sm:w-8 h-3 sm:h-4 bg-orange-200 rounded-full"></div>
                      </div>
                      <div className="h-10 sm:h-12 w-full bg-slate-50 rounded-xl flex items-center justify-between px-3 sm:px-4 border border-slate-100">
                         <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle2 size={12} className="sm:w-[14px] sm:h-[14px]"/></div>
                            <div className="w-20 sm:w-32 h-1.5 sm:h-2 bg-slate-200 rounded-full"></div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Floating Card 1 - POS (Now visible and animated on mobile) */}
                <div className="absolute -right-2 sm:-right-4 lg:-right-12 top-6 sm:top-20 bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl border border-slate-100 animate-bounce duration-1000 z-20">
                   <div className="flex items-center gap-2 sm:gap-3">
                      <div className="bg-emerald-100 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl text-emerald-600">
                         <ShoppingCart className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                      </div>
                      <div>
                         <p className="text-[7px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">New Sale</p>
                         <p className="font-black text-xs sm:text-base text-slate-800">₱4,500.00</p>
                      </div>
                   </div>
                </div>

                {/* Floating Card 2 - Stock Alert (Now visible and animated on mobile) */}
                <div className="absolute -left-2 sm:-left-4 lg:-left-12 bottom-12 sm:bottom-32 bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl border border-slate-100 animate-bounce duration-1000 delay-300 z-20">
                   <div className="flex items-center gap-2 sm:gap-3">
                      <div className="bg-orange-100 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl text-orange-600">
                         <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                      </div>
                      <div>
                         <p className="text-[7px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unsold Item</p>
                         <p className="font-black text-[10px] sm:text-sm text-slate-800">No sales 30+ days</p>
                      </div>
                   </div>
                </div>
            </div>
          </div>

        </div>
      </section>

      {/* --- 3. SYSTEM FEATURES TABS --- */}
      <section id="features" className="py-16 sm:py-24 bg-slate-50 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">Everything You Need in One System</h2>
            <p className="text-slate-500 text-base sm:text-lg font-medium px-2">
              Designed specifically for the fast-paced environment of an optical clinic. No confusing tech jargon—just tools that work.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 lg:gap-12">
            
            {/* TABS CONTROLLER */}
            <div className="lg:w-[40%] flex flex-col gap-3 sm:gap-4">
              
              {/* TAB 1: POS & SALES */}
              <button 
                onClick={() => setActiveTab("checkout")}
                className={`text-left p-4 sm:p-6 rounded-2xl transition-all duration-300 border-2 ${activeTab === 'checkout' ? 'bg-white border-[#0B3C8A] shadow-md sm:shadow-xl lg:scale-[1.02]' : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-200'}`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-sm ${activeTab === 'checkout' ? 'bg-[#0B3C8A] text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <ShoppingCart size={20} className="sm:w-6 sm:h-6" />
                </div>
                <h3 className={`text-lg sm:text-xl font-black mb-1.5 sm:mb-2 ${activeTab === 'checkout' ? 'text-slate-900' : 'text-slate-600'}`}>Patient Checkout</h3>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                  Quickly serve walk-in patients, add glasses or lenses to their cart, apply discounts, and print official receipts.
                </p>
              </button>

              {/* TAB 2: INVENTORY */}
              <button 
                onClick={() => setActiveTab("inventory")}
                className={`text-left p-4 sm:p-6 rounded-2xl transition-all duration-300 border-2 ${activeTab === 'inventory' ? 'bg-white border-[#0B3C8A] shadow-md sm:shadow-xl lg:scale-[1.02]' : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-200'}`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-sm ${activeTab === 'inventory' ? 'bg-[#0B3C8A] text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Package size={20} className="sm:w-6 sm:h-6" />
                </div>
                <h3 className={`text-lg sm:text-xl font-black mb-1.5 sm:mb-2 ${activeTab === 'inventory' ? 'text-slate-900' : 'text-slate-600'}`}>Stock Management</h3>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                  Keep track of all your frames and lenses. The system automatically warns you when you're running low or if items aren't selling.
                </p>
              </button>

              {/* TAB 3: REPORTS & AI */}
              <button 
                onClick={() => setActiveTab("reports")}
                className={`text-left p-4 sm:p-6 rounded-2xl transition-all duration-300 border-2 ${activeTab === 'reports' ? 'bg-white border-[#0B3C8A] shadow-md sm:shadow-xl lg:scale-[1.02]' : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-200'}`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-sm ${activeTab === 'reports' ? 'bg-[#0B3C8A] text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <BrainCircuit size={20} className="sm:w-6 sm:h-6" />
                </div>
                <h3 className={`text-lg sm:text-xl font-black mb-1.5 sm:mb-2 ${activeTab === 'reports' ? 'text-slate-900' : 'text-slate-600'}`}>Reports & Predictions</h3>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                  See which items sell the most, easily print monthly sales records, and get smart predictions for upcoming busy seasons.
                </p>
              </button>
            </div>

            {/* VISUAL MOCKUPS AREA */}
            <div className="lg:w-[60%] bg-slate-200/50 rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-8 flex items-center justify-center relative overflow-hidden min-h-[350px] sm:min-h-[450px]">
               
               <div className="relative z-10 w-full max-w-md sm:max-w-xl">
                 
                 {/* --- MOCKUP 1: POS --- */}
                 {activeTab === 'checkout' && (
                   <div className="animate-in slide-in-from-right-8 fade-in duration-500 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full w-full">
                      <div className="bg-slate-50 p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center">
                         <div className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2"><ShoppingCart size={16} className={`${THEME_TEXT} sm:w-[18px] sm:h-[18px]`}/> Current Sale</div>
                         <div className="text-[10px] sm:text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">In Progress</div>
                      </div>
                      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 bg-white">
                         <div className="flex justify-between items-center p-2 sm:p-3 border border-slate-100 rounded-lg sm:rounded-xl">
                            <div>
                               <div className="font-bold text-xs sm:text-sm text-slate-800 truncate pr-2">Titanium Rimless Frame</div>
                               <div className="text-[10px] sm:text-xs text-slate-400">Qty: 1</div>
                            </div>
                            <div className="font-black text-sm sm:text-base text-slate-800">₱3,500</div>
                         </div>
                         <div className="flex justify-between items-center p-2 sm:p-3 border border-slate-100 rounded-lg sm:rounded-xl">
                            <div>
                               <div className="font-bold text-xs sm:text-sm text-slate-800 truncate pr-2">Anti-Rad Lenses</div>
                               <div className="text-[10px] sm:text-xs text-slate-400">Qty: 1</div>
                            </div>
                            <div className="font-black text-sm sm:text-base text-slate-800">₱1,200</div>
                         </div>
                      </div>
                      <div className="mt-auto bg-slate-50 p-3 sm:p-4 border-t border-slate-200">
                         <div className="flex justify-between text-xs sm:text-sm text-slate-500 mb-1"><span>Subtotal</span> <span>₱4,700</span></div>
                         <div className="flex justify-between text-[10px] sm:text-xs text-slate-400 mb-2 sm:mb-3"><span>Tax (12%)</span> <span>₱564</span></div>
                         <div className="flex justify-between text-base sm:text-lg font-black text-slate-900 mb-3 sm:mb-4"><span>Total Amount</span> <span>₱5,264</span></div>
                         <div className="w-full bg-[#0B3C8A] text-white text-center py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-bold shadow-md cursor-pointer hover:bg-[#082F6E]">Complete Checkout</div>
                      </div>
                   </div>
                 )}

                 {/* --- MOCKUP 2: INVENTORY --- */}
                 {activeTab === 'inventory' && (
                   <div className="animate-in slide-in-from-right-8 fade-in duration-500 space-y-3 sm:space-y-4 w-full">
                      {/* Alert Card */}
                      <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-lg border-l-4 border-l-red-500 flex items-start gap-3 sm:gap-4">
                         <div className="bg-red-50 p-1.5 sm:p-2 rounded-lg text-red-600 shrink-0"><AlertTriangle size={18} className="sm:w-5 sm:h-5"/></div>
                         <div>
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Action Required: Low Stock</h4>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1">System warning for <strong>Multi-Purpose Solution</strong>. Only 5 units left.</p>
                         </div>
                      </div>

                      {/* Deadstock Card */}
                      <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-lg border-l-4 border-l-slate-600 flex items-start gap-3 sm:gap-4">
                         <div className="bg-slate-100 p-1.5 sm:p-2 rounded-lg text-slate-600 shrink-0"><Clock size={18} className="sm:w-5 sm:h-5"/></div>
                         <div>
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Slow-Moving Item Identified</h4>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1"><strong>Kids Flexible Frames</strong> hasn't sold in over a month.</p>
                         </div>
                      </div>

                      {/* Supplier Track */}
                      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                         <div className="bg-slate-50 p-2.5 sm:p-3 border-b border-slate-100 font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                           <Truck size={14} className="text-blue-600 sm:w-4 sm:h-4"/> Restock Deliveries
                         </div>
                         <div className="p-3 sm:p-4 flex justify-between items-center">
                            <div>
                               <div className="font-bold text-xs sm:text-sm text-slate-800">50x Anti-Rad Lenses</div>
                               <div className="text-[10px] sm:text-xs text-slate-500">From: Essilor Vision</div>
                            </div>
                            <div className="text-right">
                               <div className="text-[9px] sm:text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 sm:py-1 rounded">ON THE WAY</div>
                               <div className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Arriving: 3 Days</div>
                            </div>
                         </div>
                      </div>
                   </div>
                 )}

                 {/* --- MOCKUP 3: REPORTS --- */}
                 {activeTab === 'reports' && (
                   <div className="animate-in slide-in-from-right-8 fade-in duration-500 space-y-3 sm:space-y-4 w-full">
                      
                      {/* AI Chart */}
                      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-lg">
                         <div className="flex justify-between items-center mb-4 sm:mb-6">
                            <div className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5 sm:gap-2"><TrendingUp size={14} className={`${THEME_TEXT} sm:w-4 sm:h-4`}/> Projected Sales</div>
                         </div>
                         <div className="relative h-24 sm:h-32 flex items-end justify-between px-1 sm:px-2">
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-0">
                                <div className="border-t border-slate-100 border-dashed w-full h-full"></div>
                                <div className="border-t border-slate-100 border-dashed w-full h-full"></div>
                            </div>
                            {FORECAST_DATA.slice(2, 7).map((item, i) => (
                               <div key={i} className="relative w-6 sm:w-8 flex flex-col justify-end items-center h-full z-10">
                                  <div 
                                    className={`w-full rounded-t-sm sm:rounded-t-md transition-all ${item.type === 'history' ? 'bg-[#0B3C8A]' : 'bg-orange-400'}`} 
                                    style={{ height: `${item.value}%` }}
                                  ></div>
                               </div>
                            ))}
                         </div>
                         <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-600 font-medium">
                            <BrainCircuit size={14} className="text-purple-600 shrink-0"/> The system predicts a 25% sales jump next month.
                         </div>
                      </div>

                      {/* Ledger Export */}
                      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-lg p-4 sm:p-5 flex items-center justify-between">
                         <div>
                            <h4 className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5 sm:gap-2"><FileText size={14} className="text-emerald-600 sm:w-4 sm:h-4"/> Monthly Sales Record</h4>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Ready for accounting</p>
                         </div>
                         <button className="bg-emerald-50 text-emerald-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border border-emerald-200 shrink-0 whitespace-nowrap">
                            Save as PDF
                         </button>
                      </div>
                   </div>
                 )}

               </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- 4. STATS STRIP --- */}
      <section className="bg-[#0B3C8A] py-12 sm:py-16 text-white relative overflow-hidden px-4">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center divide-x-0 md:divide-x divide-blue-800/50 relative z-10">
          <div className="p-2">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2">Automatic</h4>
            <p className="text-blue-200 text-[10px] sm:text-xs md:text-sm uppercase tracking-wider font-bold">Low Stock Alerts</p>
          </div>
          <div className="p-2 border-l md:border-none border-blue-800/50">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2">Smart AI</h4>
            <p className="text-blue-200 text-[10px] sm:text-xs md:text-sm uppercase tracking-wider font-bold">Sales Predictions</p>
          </div>
          <div className="p-2 border-t md:border-t-0 md:border-l border-blue-800/50 pt-6 md:pt-2">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2">Secure</h4>
            <p className="text-blue-200 text-[10px] sm:text-xs md:text-sm uppercase tracking-wider font-bold">Staff & Admin Access</p>
          </div>
          <div className="p-2 border-t border-l md:border-t-0 border-blue-800/50 pt-6 md:pt-2">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2">Instant</h4>
            <p className="text-blue-200 text-[10px] sm:text-xs md:text-sm uppercase tracking-wider font-bold">Printable Reports</p>
          </div>
        </div>
      </section>

      {/* --- 5. WORKFLOW SECTION --- */}
      <section id="workflow" className="py-16 sm:py-24 bg-white px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16 px-2">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">Clinic Operations, Simplified.</h2>
            <p className="text-slate-500 text-base sm:text-lg font-medium">A workflow built specifically for front desk staff and clinic owners.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
             <div className="text-center px-4 sm:px-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 text-slate-400 font-black text-xl sm:text-2xl shadow-inner border border-slate-100">1</div>
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Secure Login</h4>
                <p className="text-slate-500 leading-relaxed text-sm font-medium">Access the system using Admin or Staff accounts, keeping clinic data secure and organized.</p>
             </div>
             <div className="text-center px-4 sm:px-6 relative">
                <div className="hidden md:block absolute top-8 sm:top-10 -left-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 text-[#0B3C8A] font-black text-xl sm:text-2xl shadow-sm relative z-10">2</div>
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Manage Sales & Stock</h4>
                <p className="text-slate-500 leading-relaxed text-sm font-medium">Front desk staff easily process patient checkouts, which automatically updates your inventory.</p>
             </div>
             <div className="text-center px-4 sm:px-6 relative">
                <div className="hidden md:block absolute top-8 sm:top-10 -left-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-purple-50 border border-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 text-purple-600 font-black text-xl sm:text-2xl shadow-sm relative z-10">3</div>
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">View Reports</h4>
                <p className="text-slate-500 leading-relaxed text-sm font-medium">Admins can review smart sales predictions, see restock warnings, and download simple PDF records.</p>
             </div>
          </div>
        </div>
      </section>

      {/* --- 6. FOOTER --- */}
      <footer id="about" className="bg-slate-50 border-t border-slate-200 pt-16 sm:pt-20 pb-8 sm:pb-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 sm:gap-12 mb-12 sm:mb-16">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Image src="/logo.png" alt="MT Olaso Logo" width={42} height={42} className="sm:w-[42px] sm:h-[42px]" />
                <span className="font-bold text-base sm:text-lg text-slate-900">M.T. Olaso Optical Clinic</span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                Empowering vision care with easy-to-use technology. Streamlining inventory and sales for better clinic efficiency.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-16 lg:gap-24 text-sm">
              <div>
                <h5 className="font-black text-slate-900 mb-3 sm:mb-4 uppercase tracking-wider text-[10px] sm:text-xs">System Contacts</h5>
                <ul className="space-y-2 sm:space-y-3 text-slate-500 font-medium text-xs sm:text-sm">
                  <li>202311183@gordoncollege.edu.ph</li>
                  <li>202310500@gordoncollege.edu.ph</li>
                </ul>
              </div>
              <div>
                <h5 className="font-black text-slate-900 mb-3 sm:mb-4 uppercase tracking-wider text-[10px] sm:text-xs">Developers</h5>
                <ul className="space-y-2 sm:space-y-3 text-slate-500 font-medium text-xs sm:text-sm">
                  <li>Larissa Panganiban</li>
                  <li>Rejean Zapanta</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 text-[10px] sm:text-xs font-bold text-slate-400 text-center md:text-left">
            <p>© 2026 M.T. Olaso Optical Clinic System. All rights reserved.</p>
            <div className="flex gap-4 justify-center">
               <span className="hover:text-slate-600 transition-colors cursor-pointer">Data Privacy Compliant (RA 10173)</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}