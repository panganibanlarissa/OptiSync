"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useFirebase } from "@/context/FirebaseContext"; 
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
  Sparkles,
  Barcode,
  ChevronUp
} from "lucide-react";

// --- THEME COLORS ---
const THEME_BG = "bg-[#0B3C8A]";
const THEME_TEXT = "text-[#0B3C8A]";

// --- STATIC PRODUCTS DATA ---
const STATIC_PRODUCTS = [
  {
    id: "p1",
    name: "Classic Aviator Frames",
    category: "Frames",
    image: null,
    imageColor: "bg-blue-100",
    markupPrice: 2500,
  },
  {
    id: "p2",
    name: "Blue Light Blocking Lenses",
    category: "Lenses",
    image: null,
    imageColor: "bg-indigo-100",
    markupPrice: 1500,
  },
  {
    id: "p3",
    name: "Biotrue Contact Solution 300ml",
    category: "Solutions",
    image: null,
    imageColor: "bg-emerald-100",
    markupPrice: 450,
  },
  {
    id: "p4",
    name: "Acuvue Oasys Monthly (6-Pack)",
    category: "Contact Lenses",
    image: null,
    imageColor: "bg-purple-100",
    markupPrice: 1850,
  },
  {
    id: "p5",
    name: "Retro Tortoise Shell Frames",
    category: "Frames",
    image: null,
    imageColor: "bg-orange-100",
    markupPrice: 3200,
  },
  {
    id: "p6",
    name: "Microfiber Cleaning Kit",
    category: "Accessories",
    image: null,
    imageColor: "bg-slate-100",
    markupPrice: 250,
  },
  {
    id: "p7",
    name: "Polarized Sun Lenses",
    category: "Lenses",
    image: null,
    imageColor: "bg-blue-200",
    markupPrice: 2200,
  },
  {
    id: "p8",
    name: "Anti-Fog Spray (Premium)",
    category: "Accessories",
    image: null,
    imageColor: "bg-cyan-100",
    markupPrice: 350,
  }
];

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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"checkout" | "inventory" | "reports">("checkout");
  const { products: firebaseProducts } = useFirebase();
  const [displayProducts, setDisplayProducts] = useState<any[]>([]);

  // Handle Scroll Effect for Navbar and Scroll-to-Top Button
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to Top Handler
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Load products from Firebase or Static Fallback
  useEffect(() => {
    console.log("Landing Page - Firebase Products:", firebaseProducts);
    
    if (firebaseProducts && firebaseProducts.length > 0) {
      // Don't filter, just display what's in the database
      setDisplayProducts(firebaseProducts.slice(0, 12));
    } else {
      setDisplayProducts(STATIC_PRODUCTS);
    }
  }, [firebaseProducts]);

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
               style={{ width: 'auto', height: 'auto' }}
               className="drop-shadow-sm w-8 h-8 lg:w-9 lg:h-9" 
            />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">OlasoSync</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#products" className="hover:text-[#0B3C8A] transition-colors">Products</a>
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
            <a href="#products" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Our Products</a>
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
               <Sparkles size={14} /> Auto Deadstock & Reorder Alerts
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.1] mb-5 tracking-tight">
              Inventory & Sales <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0B3C8A] to-purple-600">
                Management System
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-500 mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0 font-medium">
              Streamline your optical clinic with an integrated POS system, real-time inventory tracking, and comprehensive transaction reports. Manage sales, stock levels, and staff access all in one platform.
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
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> Fast Checkouts</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> Stock Monitoring</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> PDF Reports</span>
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

      {/* --- 3. PRODUCTS SHOWCASE --- */}
      <section id="products" className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">Our Products</h2>
            <p className="text-slate-500 text-base sm:text-lg font-medium px-2">
              Quality optical frames, lenses, and contact solutions for your vision needs.
            </p>
          </div>

          {displayProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {displayProducts.map((product, idx) => {
                const renderImage = () => {
                  if (product.image && !product.image.startsWith('blob:')) {
                    return (
                      <div className="relative w-full h-full">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover"
                        />
                      </div>
                    );
                  }
                  return (
                    <div className={`w-full h-full ${product.imageColor || 'bg-slate-100'} flex items-center justify-center`}>
                      <Package className="opacity-20 text-[#0B3C8A] w-1/3 h-1/3" />
                    </div>
                  );
                };

                return (
                  <div
                    key={product.id || idx}
                    className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300 hover:-translate-y-1 flex flex-col"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
                      {renderImage()}
                    </div>
                    <div className="p-3 sm:p-4 flex flex-col flex-1">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 leading-snug">
                        {product.name}
                      </h3>
                      <div className="mt-auto pt-2 flex items-center justify-between">
                        {product.category && (
                          <p className="text-[10px] sm:text-xs text-slate-400">
                            {product.category}
                          </p>
                        )}
                        {(product.markupPrice || product.price) && (
                          <p className="text-xs sm:text-sm font-bold text-slate-900">
                            ₱{(product.markupPrice || product.price).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 text-base font-medium">Loading our product catalog...</p>
            </div>
          )}
        </div>
      </section>

      {/* --- 4. SYSTEM FEATURES TABS --- */}
      <section id="features" className="py-16 sm:py-24 bg-slate-50 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">Core Features Built for Your Clinic</h2>
            <p className="text-slate-500 text-base sm:text-lg font-medium px-2">
              All the tools you need to run your optical clinic efficiently and securely.
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
                <h3 className={`text-lg sm:text-xl font-black mb-1.5 sm:mb-2 ${activeTab === 'checkout' ? 'text-slate-900' : 'text-slate-600'}`}>Point of Sale</h3>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                  Fast patient checkouts with cart management, receipt generation, and transaction history. Process sales instantly and track every transaction.
                </p>
              </button>

              {/* SMALL SCREEN MOCKUP 1 */}
              {activeTab === 'checkout' && (
                <div className="lg:hidden bg-slate-200/50 rounded-2xl border border-slate-200 p-4 sm:p-6 flex items-center justify-center min-h-[300px]">
                  <div className="relative z-10 w-full max-w-md">
                    <div className="animate-in slide-in-from-right-8 fade-in duration-500 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full w-full">
                      <div className="bg-slate-50 p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center">
                         <div className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2"><ShoppingCart size={16} className={`${THEME_TEXT} sm:w-[18px] sm:h-[18px]`}/> Sales Order</div>
                         <div className="text-[10px] sm:text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">Processing</div>
                      </div>
                      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 bg-white flex-1">
                         <div className="flex justify-between items-center p-2 sm:p-3 border border-slate-100 rounded-lg sm:rounded-xl">
                            <div>
                               <div className="font-bold text-xs sm:text-sm text-slate-800 truncate pr-2">Air Optix Monthly Contacts</div>
                               <div className="text-[10px] sm:text-xs text-slate-400">Qty: 2</div>
                            </div>
                            <div className="font-black text-sm sm:text-base text-slate-800">₱3,000</div>
                         </div>
                         <div className="flex justify-between items-center p-2 sm:p-3 border border-slate-100 rounded-lg sm:rounded-xl">
                            <div>
                               <div className="font-bold text-xs sm:text-sm text-slate-800 truncate pr-2">Essilor Anti-Rad Lenses</div>
                               <div className="text-[10px] sm:text-xs text-slate-400">Qty: 1</div>
                            </div>
                            <div className="font-black text-sm sm:text-base text-slate-800">₱3,200</div>
                         </div>
                      </div>
                      <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200">
                         <div className="flex justify-between text-xs sm:text-sm text-slate-500 mb-2 sm:mb-3"><span>Total</span> <span className="font-bold text-slate-900">₱6,200</span></div>
                         <div className="w-full bg-[#0B3C8A] text-white text-center py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-bold shadow-md cursor-pointer hover:bg-[#082F6E]">Complete Sale</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INVENTORY */}
              <button 
                onClick={() => setActiveTab("inventory")}
                className={`text-left p-4 sm:p-6 rounded-2xl transition-all duration-300 border-2 ${activeTab === 'inventory' ? 'bg-white border-[#0B3C8A] shadow-md sm:shadow-xl lg:scale-[1.02]' : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-200'}`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-sm ${activeTab === 'inventory' ? 'bg-[#0B3C8A] text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Package size={20} className="sm:w-6 sm:h-6" />
                </div>
                <h3 className={`text-lg sm:text-xl font-black mb-1.5 sm:mb-2 ${activeTab === 'inventory' ? 'text-slate-900' : 'text-slate-600'}`}>Inventory Catalog</h3>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                  Organize all frames and lenses in one place. Get automatic alerts for low stock, deadstock items, and manage restock adjustments with multiple reason categories.
                </p>
              </button>

              {/* SMALL SCREEN MOCKUP 2 */}
              {activeTab === 'inventory' && (
                <div className="lg:hidden bg-slate-200/50 rounded-2xl border border-slate-200 p-4 sm:p-6 flex items-center justify-center min-h-[300px]">
                  <div className="relative z-10 w-full max-w-md">
                    <div className="animate-in slide-in-from-right-8 fade-in duration-500 space-y-3 sm:space-y-4 w-full">
                      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                         <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 sm:p-4 border-b border-slate-200 font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                           <Barcode size={14} className="text-blue-600 sm:w-4 sm:h-4"/> Quick QR Lookup
                         </div>
                         <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                            <div className="bg-slate-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-dashed border-slate-300 text-center">
                               <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white border-2 border-slate-300 rounded-lg mx-auto mb-2 flex items-center justify-center">
                                  <Package size={24} className="text-slate-400 sm:w-8 sm:h-8"/>
                               </div>
                               <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Scan product QR code to retrieve details instantly</p>
                            </div>
                            <div className="space-y-2 text-[10px] sm:text-xs text-slate-600">
                               <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Get product name & specs</div>
                               <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Check real-time stock levels</div>
                               <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> View price & availability</div>
                               <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Add directly to cart</div>
                            </div>
                         </div>
                      </div>
                      <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-lg border-l-4 border-l-orange-500 flex items-start gap-3 sm:gap-4">
                         <div className="bg-orange-50 p-1.5 sm:p-2 rounded-lg text-orange-600 shrink-0"><AlertTriangle size={18} className="sm:w-5 sm:h-5"/></div>
                         <div>
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Low Stock Warning</h4>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1"><strong>Essilor Crizal Prevencia</strong> — Only 8 units remaining</p>
                         </div>
                      </div>
                      <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-lg border-l-4 border-l-slate-600 flex items-start gap-3 sm:gap-4">
                         <div className="bg-slate-100 p-1.5 sm:p-2 rounded-lg text-slate-600 shrink-0"><Clock size={18} className="sm:w-5 sm:h-5"/></div>
                         <div>
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Deadstock Detected</h4>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1"><strong>Kids Flexible Frames</strong> not sold in 85+ days</p>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: REPORTS */}
              <button 
                onClick={() => setActiveTab("reports")}
                className={`text-left p-4 sm:p-6 rounded-2xl transition-all duration-300 border-2 ${activeTab === 'reports' ? 'bg-white border-[#0B3C8A] shadow-md sm:shadow-xl lg:scale-[1.02]' : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-200'}`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-sm ${activeTab === 'reports' ? 'bg-[#0B3C8A] text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <FileText size={20} className="sm:w-6 sm:h-6" />
                </div>
                <h3 className={`text-lg sm:text-xl font-black mb-1.5 sm:mb-2 ${activeTab === 'reports' ? 'text-slate-900' : 'text-slate-600'}`}>Transaction Reports</h3>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                  View all sales transactions with detailed filtering by date, status, and month. Export complete transaction ledgers as PDF for accounting and record keeping.
                </p>
              </button>

              {/* SMALL SCREEN MOCKUP 3 */}
              {activeTab === 'reports' && (
                <div className="lg:hidden bg-slate-200/50 rounded-2xl border border-slate-200 p-4 sm:p-6 flex items-center justify-center min-h-[300px]">
                  <div className="relative z-10 w-full max-w-md">
                    <div className="animate-in slide-in-from-right-8 fade-in duration-500 space-y-3 sm:space-y-4 w-full">
                      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-lg">
                         <div className="flex justify-between items-center mb-2 sm:mb-3">
                            <div className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5 sm:gap-2"><TrendingUp size={14} className={`${THEME_TEXT} sm:w-4 sm:h-4`}/> Total Revenue</div>
                            <div className="text-xs sm:text-sm text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">This Month</div>
                         </div>
                         <div className="text-2xl sm:text-3xl font-black text-slate-900">₱245,800</div>
                         <p className="text-[10px] sm:text-xs text-slate-500 mt-2">From 124 completed transactions</p>
                      </div>
                      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                         <div className="bg-slate-50 p-2.5 sm:p-3 border-b border-slate-100 font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                           <FileText size={14} className="text-blue-600 sm:w-4 sm:h-4"/> Available Filters
                         </div>
                         <div className="p-3 sm:p-4 space-y-2 text-[10px] sm:text-xs text-slate-600">
                            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Filter by Date Range</div>
                            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Filter by Month</div>
                            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Filter by Status (Completed/Voided)</div>
                            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Search by Receipt/Patient Name</div>
                         </div>
                      </div>
                      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-lg p-4 sm:p-5 flex items-center justify-between">
                         <div>
                            <h4 className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5 sm:gap-2"><FileText size={14} className="text-emerald-600 sm:w-4 sm:h-4"/> PDF Report</h4>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1">Complete transaction ledger</p>
                         </div>
                         <button className="bg-emerald-50 text-emerald-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border border-emerald-200 shrink-0 whitespace-nowrap hover:bg-emerald-100">
                            Export
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* VISUAL MOCKUPS AREA - LARGE SCREENS ONLY */}
            <div className="hidden lg:flex lg:w-[60%] bg-slate-200/50 rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-8 items-center justify-center relative overflow-hidden min-h-[350px] sm:min-h-[450px]">
               
               <div className="relative z-10 w-full max-w-md sm:max-w-xl">
                 
                 {/* --- MOCKUP 1: POS --- */}
                 {activeTab === 'checkout' && (
                   <div className="animate-in slide-in-from-right-8 fade-in duration-500 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full w-full">
                      <div className="bg-slate-50 p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center">
                         <div className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2"><ShoppingCart size={16} className={`${THEME_TEXT} sm:w-[18px] sm:h-[18px]`}/> Sales Order</div>
                         <div className="text-[10px] sm:text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">Processing</div>
                      </div>
                      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 bg-white flex-1">
                         <div className="flex justify-between items-center p-2 sm:p-3 border border-slate-100 rounded-lg sm:rounded-xl">
                            <div>
                               <div className="font-bold text-xs sm:text-sm text-slate-800 truncate pr-2">Air Optix Monthly Contacts</div>
                               <div className="text-[10px] sm:text-xs text-slate-400">Qty: 2</div>
                            </div>
                            <div className="font-black text-sm sm:text-base text-slate-800">₱3,000</div>
                         </div>
                         <div className="flex justify-between items-center p-2 sm:p-3 border border-slate-100 rounded-lg sm:rounded-xl">
                            <div>
                               <div className="font-bold text-xs sm:text-sm text-slate-800 truncate pr-2">Essilor Anti-Rad Lenses</div>
                               <div className="text-[10px] sm:text-xs text-slate-400">Qty: 1</div>
                            </div>
                            <div className="font-black text-sm sm:text-base text-slate-800">₱3,200</div>
                         </div>
                      </div>
                      <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200">
                         <div className="flex justify-between text-xs sm:text-sm text-slate-500 mb-2 sm:mb-3"><span>Total</span> <span className="font-bold text-slate-900">₱6,200</span></div>
                         <div className="w-full bg-[#0B3C8A] text-white text-center py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-bold shadow-md cursor-pointer hover:bg-[#082F6E]">Complete Sale</div>
                      </div>
                   </div>
                 )}

                 {/* --- MOCKUP 2: INVENTORY --- */}
                 {activeTab === 'inventory' && (
                   <div className="animate-in slide-in-from-right-8 fade-in duration-500 space-y-3 sm:space-y-4 w-full">
                      {/* QR Code Scanning Card */}
                      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                         <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 sm:p-4 border-b border-slate-200 font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                           <Barcode size={14} className="text-blue-600 sm:w-4 sm:h-4"/> Quick QR Lookup
                         </div>
                         <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                            <div className="bg-slate-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-dashed border-slate-300 text-center">
                               <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white border-2 border-slate-300 rounded-lg mx-auto mb-2 flex items-center justify-center">
                                  <Package size={24} className="text-slate-400 sm:w-8 sm:h-8"/>
                               </div>
                               <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Scan product QR code to retrieve details instantly</p>
                            </div>
                            <div className="space-y-2 text-[10px] sm:text-xs text-slate-600">
                               <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Get product name & specs</div>
                               <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Check real-time stock levels</div>
                               <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> View price & availability</div>
                               <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Add directly to cart</div>
                            </div>
                         </div>
                      </div>

                      {/* Low Stock Alert Card */}
                      <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-lg border-l-4 border-l-orange-500 flex items-start gap-3 sm:gap-4">
                         <div className="bg-orange-50 p-1.5 sm:p-2 rounded-lg text-orange-600 shrink-0"><AlertTriangle size={18} className="sm:w-5 sm:h-5"/></div>
                         <div>
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Low Stock Warning</h4>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1"><strong>Essilor Crizal Prevencia</strong> — Only 8 units remaining</p>
                         </div>
                      </div>

                      {/* Deadstock Card */}
                      <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-lg border-l-4 border-l-slate-600 flex items-start gap-3 sm:gap-4">
                         <div className="bg-slate-100 p-1.5 sm:p-2 rounded-lg text-slate-600 shrink-0"><Clock size={18} className="sm:w-5 sm:h-5"/></div>
                         <div>
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Deadstock Detected</h4>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1"><strong>Kids Flexible Frames</strong> not sold in 85+ days</p>
                         </div>
                      </div>
                   </div>
                 )}

                 {/* --- MOCKUP 3: REPORTS --- */}
                 {activeTab === 'reports' && (
                   <div className="animate-in slide-in-from-right-8 fade-in duration-500 space-y-3 sm:space-y-4 w-full">
                      
                      {/* Total Revenue */}
                      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-lg">
                         <div className="flex justify-between items-center mb-2 sm:mb-3">
                            <div className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5 sm:gap-2"><TrendingUp size={14} className={`${THEME_TEXT} sm:w-4 sm:h-4`}/> Total Revenue</div>
                            <div className="text-xs sm:text-sm text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">This Month</div>
                         </div>
                         <div className="text-2xl sm:text-3xl font-black text-slate-900">₱245,800</div>
                         <p className="text-[10px] sm:text-xs text-slate-500 mt-2">From 124 completed transactions</p>
                      </div>

                      {/* Transaction Filters */}
                      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                         <div className="bg-slate-50 p-2.5 sm:p-3 border-b border-slate-100 font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                           <FileText size={14} className="text-blue-600 sm:w-4 sm:h-4"/> Available Filters
                         </div>
                         <div className="p-3 sm:p-4 space-y-2 text-[10px] sm:text-xs text-slate-600">
                            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Filter by Date Range</div>
                            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Filter by Month</div>
                            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Filter by Status (Completed/Voided)</div>
                            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500 shrink-0"/> Search by Receipt/Patient Name</div>
                         </div>
                      </div>

                      {/* Export Option */}
                      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-lg p-4 sm:p-5 flex items-center justify-between">
                         <div>
                            <h4 className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5 sm:gap-2"><FileText size={14} className="text-emerald-600 sm:w-4 sm:h-4"/> PDF Report</h4>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1">Complete transaction ledger</p>
                         </div>
                         <button className="bg-emerald-50 text-emerald-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border border-emerald-200 shrink-0 whitespace-nowrap hover:bg-emerald-100">
                            Export
                         </button>
                      </div>
                   </div>
                 )}

               </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- 5. STATS STRIP --- */}
      <section className="bg-[#0B3C8A] py-12 sm:py-16 text-white relative overflow-hidden px-4">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center divide-x-0 md:divide-x divide-blue-800/50 relative z-10">
          <div className="p-2">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2">Automatic</h4>
            <p className="text-blue-200 text-[10px] sm:text-xs md:text-sm uppercase tracking-wider font-bold">Low Stock Alerts</p>
          </div>
          <div className="p-2 border-l md:border-none border-blue-800/50">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2">Real-Time</h4>
            <p className="text-blue-200 text-[10px] sm:text-xs md:text-sm uppercase tracking-wider font-bold">Inventory Tracking</p>
          </div>
          <div className="p-2 border-t md:border-t-0 md:border-l border-blue-800/50 pt-6 md:pt-2">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2">Secure</h4>
            <p className="text-blue-200 text-[10px] sm:text-xs md:text-sm uppercase tracking-wider font-bold">Staff & Admin Access</p>
          </div>
          <div className="p-2 border-t border-l md:border-t-0 border-blue-800/50 pt-6 md:pt-2">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2">Instant</h4>
            <p className="text-blue-200 text-[10px] sm:text-xs md:text-sm uppercase tracking-wider font-bold">Transaction Reports</p>
          </div>
        </div>
      </section>

      {/* --- 6. WORKFLOW SECTION --- */}
      <section id="workflow" className="py-16 sm:py-24 bg-white px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16 px-2">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">How It Simplifies Your Work</h2>
            <p className="text-slate-500 text-base sm:text-lg font-medium">A complete workflow designed for clinic staff and managers.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
             <div className="text-center px-4 sm:px-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 text-slate-400 font-black text-xl sm:text-2xl shadow-inner border border-slate-100">1</div>
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Secure Access</h4>
                <p className="text-slate-500 leading-relaxed text-sm font-medium">Staff and admins log in with role-based accounts. Access dashboard and modules based on your assigned permissions.</p>
             </div>
             <div className="text-center px-4 sm:px-6 relative">
                <div className="hidden md:block absolute top-8 sm:top-10 -left-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 text-[#0B3C8A] font-black text-xl sm:text-2xl shadow-sm relative z-10">2</div>
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Process & Track</h4>
                <p className="text-slate-500 leading-relaxed text-sm font-medium">Complete patient sales instantly with our POS system. Inventory updates automatically as items are sold, preventing overselling.</p>
             </div>
             <div className="text-center px-4 sm:px-6 relative">
                <div className="hidden md:block absolute top-8 sm:top-10 -left-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-purple-50 border border-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 text-purple-600 font-black text-xl sm:text-2xl shadow-sm relative z-10">3</div>
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Report & Manage</h4>
                <p className="text-slate-500 leading-relaxed text-sm font-medium">View transaction history, get low stock alerts, identify deadstock items, and export ledgers for accounting and compliance.</p>
             </div>
          </div>
        </div>
      </section>

      {/* --- 7. FOOTER --- */}
      <footer id="about" className="bg-slate-50 border-t border-slate-200 pt-16 sm:pt-20 pb-8 sm:pb-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 sm:gap-12 mb-12 sm:mb-16">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Image src="/logo.png" alt="MT Olaso Logo" width={42} height={42} className="sm:w-[42px] sm:h-[42px]" />
                <span className="font-bold text-base sm:text-lg text-slate-900">OlasoSync</span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                Empowering vision care with easy-to-use technology. Streamlining inventory and sales for better clinic efficiency.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-16 lg:gap-24 text-sm">
              <div>
                <h5 className="font-black text-slate-900 mb-3 sm:mb-4 uppercase tracking-wider text-[10px] sm:text-xs">Address</h5>
                <ul className="space-y-2 sm:space-y-3 text-slate-500 font-medium text-xs sm:text-sm leading-relaxed">
                  <li>M.T. Olaso Optical Clinic</li>
                  <li>43 Magsaysay Dr Olongapo City,</li>
                  <li>Zambales</li>
                </ul>
              </div>
              <div>
                <h5 className="font-black text-slate-900 mb-3 sm:mb-4 uppercase tracking-wider text-[10px] sm:text-xs">Contact</h5>
                <ul className="space-y-2 sm:space-y-3 text-slate-500 font-medium text-xs sm:text-sm leading-relaxed">
                  <li>Phone: 0922 825 4918</li>
                  <li>Hours: Mon-Fri 10AM-6PM</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 text-[10px] sm:text-xs font-bold text-slate-400 text-center md:text-left">
            <p>© 2026 OlasoSync. All rights reserved.</p>
            <div className="flex gap-4 justify-center">
               <span className="hover:text-slate-600 transition-colors cursor-pointer">Data Privacy Compliant (RA 10173)</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 sm:bottom-8 right-6 sm:right-8 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#0B3C8A] text-white shadow-lg hover:bg-[#08306B] transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center z-40 animate-in fade-in slide-in-from-bottom-4 duration-300"
          aria-label="Scroll to top"
        >
          <ChevronUp size={20} className="sm:w-6 sm:h-6" />
        </button>
      )}

    </div>
  );
}