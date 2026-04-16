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
  ShoppingCart,
  FileText,
  Clock,
  Sparkles,
  Barcode,
  ChevronUp
} from "lucide-react";
import { collection, getDocs, query, limit, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- THEME COLORS ---
const THEME_BG = "bg-[#0B3C8A]";
const THEME_TEXT = "text-[#0B3C8A]";

// Fallback products in case Firestore fails to load
const FALLBACK_PRODUCTS = [
  {
    id: "fallback-1",
    name: "Classic Aviator Frames",
    category: "Frames",
    image: "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=500&h=500&fit=crop",
    price: 2500,
  },
  {
    id: "fallback-2",
    name: "Blue Light Blocking Lenses",
    category: "Lenses",
    image: "https://images.unsplash.com/photo-1591076482161-42ce6da69f5a?w=500&h=500&fit=crop",
    price: 1500,
  },
  {
    id: "fallback-3",
    name: "Biotrue Contact Solution",
    category: "Solutions",
    image: "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=500&h=500&fit=crop",
    price: 450,
  },
];

// Clinic ID - same as in FirebaseContext
const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"checkout" | "inventory" | "reports">("checkout");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Handle Scroll Effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch real products from Firestore (public read)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        console.log("Fetching real products from Firestore...");
        
        const productsRef = collection(db, `clinics/${CLINIC_ID}/products`);
        const productsQuery = query(productsRef, orderBy("createdAt", "desc"), limit(12));
        const snapshot = await getDocs(productsQuery);
        
        const fetchedProducts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          price: doc.data().markupPrice || doc.data().price || 0
        }));
        
        console.log(`Loaded ${fetchedProducts.length} real products from Firestore`);
        
        if (fetchedProducts.length > 0) {
          setProducts(fetchedProducts);
        } else {
          console.log("No products in Firestore, using fallback data");
          setProducts(FALLBACK_PRODUCTS);
        }
      } catch (error) {
        console.error("Error fetching products from Firestore:", error);
        console.log("Using fallback products due to error");
        setProducts(FALLBACK_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProducts();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleImageError = (productId: string) => {
    setImageErrors(prev => new Set([...prev, productId]));
  };

  // Display loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A] mx-auto mb-4"></div>
          <p className="text-slate-500">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 selection:bg-blue-100 overflow-x-hidden">
      
      {/* --- 1. NAVBAR --- */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-white/90 backdrop-blur-md shadow-sm py-3" : "bg-transparent py-4 sm:py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image 
               src="/logo.png" 
               alt="MT Olaso Logo" 
               width={42} 
               height={42} 
               style={{ width: 'auto', height: 'auto' }}
               className="drop-shadow-sm w-8 h-8 lg:w-9 lg:h-9" 
               priority
            />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">OlasoSync</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#products" className="hover:text-[#0B3C8A] transition-colors">Products</a>
            <a href="#features" className="hover:text-[#0B3C8A] transition-colors">System Features</a>
            <a href="#workflow" className="hover:text-[#0B3C8A] transition-colors">How it Works</a>
            <a href="#about" className="hover:text-[#0B3C8A] transition-colors">About</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link 
              href="/login" 
              className={`px-6 py-2.5 ${THEME_BG} text-white rounded-xl font-bold text-sm hover:bg-[#08306B] transition-all shadow-lg shadow-blue-900/20 hover:-translate-y-0.5 active:scale-95`}
            >
              Login
            </Link>
          </div>

          <button className="md:hidden text-slate-600 p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={26}/> : <Menu size={26}/>}
          </button>
        </div>

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
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-blue-100/50 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-purple-100/40 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center relative z-10">
          
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

          {/* Abstract Dashboard Mockup */}
          <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] flex items-center justify-center animate-in zoom-in-95 fade-in duration-1000 delay-200 mt-4 sm:mt-0">
            <div className="relative w-full max-w-[280px] sm:max-w-sm lg:max-w-lg aspect-square">
                <div className="absolute inset-0 bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 p-4 sm:p-6 flex flex-col overflow-hidden rotate-[-2deg] hover:rotate-0 transition-all duration-500">
                   <div className="flex items-center justify-between mb-4 sm:mb-6 border-b border-slate-100 pb-3 sm:pb-4">
                      <div className="flex gap-1.5 sm:gap-2">
                         <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-200"></div>
                         <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-200"></div>
                      </div>
                      <div className="w-24 sm:w-32 h-2 bg-blue-50 rounded-full"></div>
                   </div>
                   <div className="flex gap-2 sm:gap-4 items-end h-24 sm:h-32 mb-4 sm:mb-6 px-2 sm:px-4">
                      <div className="w-1/5 h-[40%] bg-blue-100 rounded-t-md sm:rounded-t-lg"></div>
                      <div className="w-1/5 h-[70%] bg-blue-200 rounded-t-md sm:rounded-t-lg"></div>
                      <div className="w-1/5 h-[50%] bg-blue-100 rounded-t-md sm:rounded-t-lg"></div>
                      <div className="w-1/5 h-[90%] bg-gradient-to-t from-[#0B3C8A] to-purple-500 rounded-t-md sm:rounded-t-lg relative shadow-lg">
                         <div className="absolute -top-6 sm:-top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow-lg whitespace-nowrap">AI Forecast</div>
                      </div>
                      <div className="w-1/5 h-[60%] bg-purple-200 rounded-t-md sm:rounded-t-lg"></div>
                   </div>
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

      {/* --- 3. PRODUCTS SHOWCASE - REAL FIRESTORE PRODUCTS --- */}
      <section id="products" className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">Our Products</h2>
            <p className="text-slate-500 text-base sm:text-lg font-medium px-2">
              Quality optical frames, lenses, and contact solutions for your vision needs.
            </p>
            {products.length > 0 && products[0].id && !products[0].id.startsWith('fallback') && (
              <p className="text-xs text-emerald-600 mt-2">✓ Live products from inventory</p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {products.map((product, idx) => {
              const hasImageError = imageErrors.has(product.id);
              const productImage = product.image || product.productImage;
              const isValidImage = !hasImageError && productImage && typeof productImage === 'string' && productImage.startsWith('http');
              
              return (
                <div
                  key={product.id}
                  className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300 hover:-translate-y-1 flex flex-col"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                    {isValidImage ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={productImage}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          onError={() => handleImageError(product.id)}
                          priority={idx < 4}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Package className="w-12 h-12 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 flex flex-col flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 leading-snug">
                      {product.name}
                    </h3>
                    {product.specifications && (
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-1 line-clamp-2">
                        {product.specifications}
                      </p>
                    )}
                    <div className="mt-auto pt-3 flex items-center justify-between">
                      <span className="text-[10px] sm:text-xs font-medium text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">
                        {product.category || "Uncategorized"}
                      </span>
                      <p className="text-sm sm:text-base font-bold text-slate-900">
                        ₱{(product.markupPrice || product.price || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {products.length === 0 && !loading && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No products found in inventory.</p>
            </div>
          )}
        </div>
      </section>

      {/* Rest of the sections remain the same... */}
      
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

              <button 
                onClick={() => setActiveTab("inventory")}
                className={`text-left p-4 sm:p-6 rounded-2xl transition-all duration-300 border-2 ${activeTab === 'inventory' ? 'bg-white border-[#0B3C8A] shadow-md sm:shadow-xl lg:scale-[1.02]' : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-200'}`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-sm ${activeTab === 'inventory' ? 'bg-[#0B3C8A] text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Package size={20} className="sm:w-6 sm:h-6" />
                </div>
                <h3 className={`text-lg sm:text-xl font-black mb-1.5 sm:mb-2 ${activeTab === 'inventory' ? 'text-slate-900' : 'text-slate-600'}`}>Inventory Catalog</h3>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                  Organize all frames and lenses in one place. Get automatic alerts for low stock, deadstock items, and manage restock adjustments.
                </p>
              </button>

              <button 
                onClick={() => setActiveTab("reports")}
                className={`text-left p-4 sm:p-6 rounded-2xl transition-all duration-300 border-2 ${activeTab === 'reports' ? 'bg-white border-[#0B3C8A] shadow-md sm:shadow-xl lg:scale-[1.02]' : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-200'}`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-sm ${activeTab === 'reports' ? 'bg-[#0B3C8A] text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <FileText size={20} className="sm:w-6 sm:h-6" />
                </div>
                <h3 className={`text-lg sm:text-xl font-black mb-1.5 sm:mb-2 ${activeTab === 'reports' ? 'text-slate-900' : 'text-slate-600'}`}>Transaction Reports</h3>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                  View all sales transactions with detailed filtering and export complete transaction ledgers as PDF.
                </p>
              </button>
            </div>

            {/* VISUAL MOCKUPS AREA */}
            <div className="hidden lg:flex lg:w-[60%] bg-slate-200/50 rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-8 items-center justify-center relative overflow-hidden min-h-[350px] sm:min-h-[450px]">
               <div className="relative z-10 w-full max-w-md sm:max-w-xl">
                 {activeTab === 'checkout' && (
                   <div className="animate-in slide-in-from-right-8 fade-in duration-500 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center">
                         <div className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5"><ShoppingCart size={16} className={THEME_TEXT}/> Sales Order</div>
                         <div className="text-[10px] sm:text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">Processing</div>
                      </div>
                      <div className="p-3 sm:p-4 space-y-2 bg-white">
                         <div className="flex justify-between items-center p-2 border border-slate-100 rounded-lg">
                            <div><div className="font-bold text-xs text-slate-800">Air Optix Monthly Contacts</div><div className="text-[10px] text-slate-400">Qty: 2</div></div>
                            <div className="font-black text-sm text-slate-800">₱3,000</div>
                         </div>
                         <div className="flex justify-between items-center p-2 border border-slate-100 rounded-lg">
                            <div><div className="font-bold text-xs text-slate-800">Essilor Anti-Rad Lenses</div><div className="text-[10px] text-slate-400">Qty: 1</div></div>
                            <div className="font-black text-sm text-slate-800">₱3,200</div>
                         </div>
                      </div>
                      <div className="bg-slate-50 p-3 border-t border-slate-200">
                         <div className="flex justify-between text-xs mb-2"><span>Total</span><span className="font-bold">₱6,200</span></div>
                         <div className="w-full bg-[#0B3C8A] text-white text-center py-2 rounded-lg text-sm font-bold">Complete Sale</div>
                      </div>
                   </div>
                 )}
                 {activeTab === 'inventory' && (
                   <div className="animate-in slide-in-from-right-8 fade-in duration-500 space-y-3 w-full">
                      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                         <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 border-b font-bold text-xs text-slate-800 flex items-center gap-2">
                           <Barcode size={14} className="text-blue-600"/> Quick QR Lookup
                         </div>
                         <div className="p-4 space-y-3">
                            <div className="bg-slate-50 rounded-lg p-3 border border-dashed text-center">
                               <div className="w-16 h-16 bg-white border-2 border-slate-300 rounded-lg mx-auto mb-2 flex items-center justify-center">
                                  <Package size={24} className="text-slate-400"/>
                               </div>
                               <p className="text-[10px] text-slate-500">Scan product QR code to retrieve details</p>
                            </div>
                         </div>
                      </div>
                      <div className="bg-white p-3 rounded-xl shadow-lg border-l-4 border-l-orange-500">
                         <div className="flex items-start gap-3">
                            <div className="bg-orange-50 p-1.5 rounded-lg text-orange-600"><AlertTriangle size={16}/></div>
                            <div><h4 className="font-bold text-xs">Low Stock Warning</h4><p className="text-[10px] text-slate-500">Essilor Crizal Prevencia — Only 8 units remaining</p></div>
                         </div>
                      </div>
                   </div>
                 )}
                 {activeTab === 'reports' && (
                   <div className="animate-in slide-in-from-right-8 fade-in duration-500 space-y-3 w-full">
                      <div className="bg-white p-4 rounded-xl shadow-lg border">
                         <div className="flex justify-between items-center mb-2"><div className="font-bold text-xs flex items-center gap-1"><TrendingUp size={14} className={THEME_TEXT}/> Total Revenue</div><div className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">This Month</div></div>
                         <div className="text-2xl font-black text-slate-900">₱245,800</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-lg border flex items-center justify-between">
                         <div><h4 className="font-bold text-xs">PDF Report</h4><p className="text-[10px] text-slate-500">Complete transaction ledger</p></div>
                         <button className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-[10px] font-bold">Export</button>
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
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center relative z-10">
          <div><h4 className="text-2xl sm:text-3xl font-black">Automatic</h4><p className="text-blue-200 text-[10px] sm:text-xs uppercase tracking-wider">Low Stock Alerts</p></div>
          <div><h4 className="text-2xl sm:text-3xl font-black">Real-Time</h4><p className="text-blue-200 text-[10px] sm:text-xs uppercase tracking-wider">Inventory Tracking</p></div>
          <div><h4 className="text-2xl sm:text-3xl font-black">Secure</h4><p className="text-blue-200 text-[10px] sm:text-xs uppercase tracking-wider">Staff & Admin Access</p></div>
          <div><h4 className="text-2xl sm:text-3xl font-black">Instant</h4><p className="text-blue-200 text-[10px] sm:text-xs uppercase tracking-wider">Transaction Reports</p></div>
        </div>
      </section>

      {/* --- 6. WORKFLOW SECTION --- */}
      <section id="workflow" className="py-16 sm:py-24 bg-white px-4 sm:px-6">
        <div className="max-w-7xl mx-auto text-center mb-12 sm:mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">How It Simplifies Your Work</h2>
          <p className="text-slate-500 text-base sm:text-lg">A complete workflow designed for clinic staff and managers.</p>
        </div>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 text-center">
          <div><div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400 font-black text-2xl">1</div><h4 className="text-xl font-bold mb-2">Secure Access</h4><p className="text-slate-500 text-sm">Staff and admins log in with role-based accounts.</p></div>
          <div><div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#0B3C8A] font-black text-2xl">2</div><h4 className="text-xl font-bold mb-2">Process & Track</h4><p className="text-slate-500 text-sm">Complete patient sales instantly with our POS system.</p></div>
          <div><div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-purple-600 font-black text-2xl">3</div><h4 className="text-xl font-bold mb-2">Report & Manage</h4><p className="text-slate-500 text-sm">Export ledgers for accounting and compliance.</p></div>
        </div>
      </section>

      {/* --- 7. FOOTER --- */}
      <footer id="about" className="bg-slate-50 border-t border-slate-200 pt-16 pb-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-12">
            <div className="max-w-xs">
              <div className="flex items-center gap-3 mb-4">
                <Image src="/logo.png" alt="MT Olaso Logo" width={42} height={42} />
                <span className="font-bold text-lg text-slate-900">OlasoSync</span>
              </div>
              <p className="text-slate-500 text-sm">Empowering vision care with easy-to-use technology.</p>
            </div>
            <div className="grid grid-cols-2 gap-16 text-sm">
              <div><h5 className="font-black text-slate-900 mb-4 uppercase text-xs">Address</h5><ul className="space-y-2 text-slate-500 text-xs"><li>M.T. Olaso Optical Clinic</li><li>43 Magsaysay Dr Olongapo City</li><li>Zambales</li></ul></div>
              <div><h5 className="font-black text-slate-900 mb-4 uppercase text-xs">Contact</h5><ul className="space-y-2 text-slate-500 text-xs"><li>Phone: 0922 825 4918</li><li>Hours: Mon-Fri 10AM-6PM</li></ul></div>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-6 text-center text-[10px] text-slate-400">
            <p>© 2026 OlasoSync. All rights reserved. | Data Privacy Compliant (RA 10173)</p>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button onClick={scrollToTop} className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-[#0B3C8A] text-white shadow-lg hover:bg-[#08306B] transition-all hover:-translate-y-1 flex items-center justify-center z-40">
          <ChevronUp size={20} />
        </button>
      )}
    </div>
  );
}