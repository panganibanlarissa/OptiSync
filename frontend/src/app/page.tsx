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
  ChevronUp,
  MapPin,
  Phone,
  Eye,
  Heart,
  Star,
  Facebook,
  Glasses
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
    name: "Cat Eye Designer Frames",
    category: "Frames",
    image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&h=500&fit=crop",
    price: 3500,
  },
  {
    id: "fallback-3",
    name: "Round Metal Frames",
    category: "Frames",
    image: "https://images.unsplash.com/photo-1495164469619-ca4171e43f38?w=500&h=500&fit=crop",
    price: 2200,
  },
  {
    id: "fallback-4",
    name: "Wayfarer Style Sunglasses",
    category: "Sunglasses",
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&h=500&fit=crop",
    price: 4000,
  },
  {
    id: "fallback-5",
    name: "Blue Light Blocking Lenses",
    category: "Lenses",
    image: "https://images.unsplash.com/photo-1591076482161-42ce6da69f5a?w=500&h=500&fit=crop",
    price: 1500,
  },
  {
    id: "fallback-6",
    name: "Anti-Glare Lenses",
    category: "Lenses",
    image: "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=500&h=500&fit=crop",
    price: 1800,
  },
];

// Clinic ID - same as in FirebaseContext
const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";

export default function ClinicLandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
        const productsRef = collection(db, `clinics/${CLINIC_ID}/products`);
        const productsQuery = query(productsRef, orderBy("createdAt", "desc"), limit(12));
        const snapshot = await getDocs(productsQuery);
        
        const fetchedProducts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        if (fetchedProducts.length > 0) {
          setProducts(fetchedProducts);
        } else {
          setProducts(FALLBACK_PRODUCTS);
        }
      } catch (error) {
        console.error("Error fetching products from Firestore:", error);
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

  // Get best selling products (from category or marked favorites)
  const bestSellingFrames = products
    .filter(p => p.category === "Frames" || p.category?.includes("Frame"))
    .slice(0, 8);

  // Display loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A] mx-auto mb-4"></div>
          <p className="text-slate-500">Loading our products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 selection:bg-blue-100 overflow-x-hidden">
      
      {/* --- 1. NAVBAR --- */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-white/90 backdrop-blur-md shadow-sm py-3" : "bg-slate-100 py-3"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png?v=1" alt="M.T. Olaso Logo" width={42} height={42} />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-base sm:text-md text-slate-900 tracking-tight">M.T. Olaso Optical Clinic</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#bestselling" className="hover:text-[#0B3C8A] transition-colors">Best Sellers</a>
            <a href="#services" className="hover:text-[#0B3C8A] transition-colors">Services</a>
            <a href="#location" className="hover:text-[#0B3C8A] transition-colors">Map</a>
            <a href="#contact" className="hover:text-[#0B3C8A] transition-colors">Facebook</a>
            <a href="#products" className="hover:text-[#0B3C8A] transition-colors">Products</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <a 
              href="/login"
              className="px-5 py-2 bg-[#0B3C8A] text-white rounded-lg font-bold text-sm hover:bg-[#08306B] transition-all"
            >
              Login
            </a>
          </div>

          <button className="md:hidden text-slate-600 p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={26}/> : <Menu size={26}/>}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-100 p-5 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-top-5">
            <a href="#bestselling" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Best Sellers</a>
            <a href="#services" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Services</a>
            <a href="#location" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Map</a>
            <a href="#contact" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Facebook</a>
            <a href="#products" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Products</a>
            <div className="h-px bg-slate-100 my-1"></div>
            <a href="/login" className={`w-full text-center py-3.5 ${THEME_BG} text-white rounded-xl font-bold text-base`} onClick={() => setMobileMenuOpen(false)}>
              Login
            </a>
          </div>
        )}
      </header>

      {/* --- 2. HERO SECTION WITH BACKGROUND IMAGE --- */}
      <section className="relative h-[500px] sm:h-[600px] md:h-[700px] overflow-hidden pt-24">
        {/* Background Image with Dim Overlay */}
        <div className="absolute inset-0">
          <Image 
            src="/images/clinic-bg.jpg" 
            alt="Clinic Background" 
            fill 
            className="object-cover"
            priority
          />
        </div>
        
        <div className="absolute inset-0 bg-black/50"></div>

        {/* Content */}
        <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-[1.1] mb-4 tracking-tight">
              M.T. Olaso Optical Clinic
            </h1>
            <p className="text-base sm:text-lg text-blue-50 leading-relaxed max-w-xl mx-auto">
              Computerized Eye Examination • Premium Frames • Quality Lenses
            </p>
          </div>
        </div>
      </section>

      {/* --- 3. BEST SELLING PRODUCTS --- */}
      {bestSellingFrames.length > 0 && (
          <section id="bestselling" className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">Best Selling Frames</h2>
              <p className="text-slate-500 text-base sm:text-lg font-medium px-2">
                Our most popular frames, loved by our customers for style, comfort, and durability.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {bestSellingFrames.map((product, idx) => {
                const hasImageError = imageErrors.has(product.id);
                const productImage = product.image || product.productImage;
                const isValidImage = !hasImageError && productImage && typeof productImage === 'string' && productImage.startsWith('http');
                
                return (
                  <div
                    key={product.id}
                    className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-[#0B3C8A] transition-all duration-300 hover:-translate-y-2 flex flex-col relative"
                  >
                    <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-lg text-[10px] font-bold z-10 flex items-center gap-1">
                      <Star size={12} className="fill-current" /> Best Seller
                    </div>
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
                          <Package className="w-16 h-16 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-4 sm:p-5 flex flex-col flex-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 leading-snug">
                        {product.name}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* --- 3.5 SERVICES SECTION --- */}
      <section id="services" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#0B3C8A]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-100 mb-3 sm:mb-4">What We Offer</h2>
            <p className="text-slate-300 text-base sm:text-lg font-medium px-2">
              Complete eye care services designed to help you see better and feel confident
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Service 1: Eye Check */}
            <div className="group relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0B3C8A] flex items-center justify-center mb-4 sm:mb-6 text-white">
                <Eye size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Eye Check</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                We test your eyes using modern equipment to find your exact prescription and check eye health.
              </p>
            </div>

            {/* Service 2: Frame Styles */}
            <div className="group relative bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border border-purple-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-purple-600 flex items-center justify-center mb-4 sm:mb-6 text-white">
                <Sparkles size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Frame Styles</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Choose from a variety of beautiful frames that match your face and personal style.
              </p>
            </div>

            {/* Service 3: Lens Types */}
            <div className="group relative bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-600 flex items-center justify-center mb-4 sm:mb-6 text-white">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Lens Types</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Get lenses that protect your eyes from blue light, reduce glare, and keep you comfortable.
              </p>
            </div>

            {/* Service 4: Perfect Fit */}
            <div className="group relative bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl border border-rose-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-600 flex items-center justify-center mb-4 sm:mb-6 text-white">
                <Heart size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Perfect Fit</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Our experts adjust your frames so they fit perfectly and feel comfortable all day long.
              </p>
            </div>

            {/* Service 5: Made Just For You */}
            <div className="group relative bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl border border-amber-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-600 flex items-center justify-center mb-4 sm:mb-6 text-white">
                <Barcode size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Made Just For You</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Your lenses are crafted with precision to match your exact eye prescription perfectly.
              </p>
            </div>

            {/* Service 6: Expert Advice */}
            <div className="group relative bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl border border-indigo-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-600 flex items-center justify-center mb-4 sm:mb-6 text-white">
                <Clock size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Expert Advice</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Get helpful tips on caring for your glasses and choosing the right frames for you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- 4. FULL-WIDTH MAP SECTION --- */}
      <section id="location" className="py-16 sm:py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto mb-10 sm:mb-16">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">Where to Find Us</h2>
            <p className="text-slate-600 text-base sm:text-lg font-medium px-2">
              Visit us at our clinic location. We're conveniently situated in Olongapo City.
            </p>
          </div>
        </div>
        <div className="h-[500px] sm:h-[600px] md:h-[700px] w-full rounded-2xl overflow-hidden shadow-lg">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3865.2355!2d120.2816!3d14.3691!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397d6e6c6c6c6c6d%3A0x1234567890abcdef!2s43%20Magsaysay%20Drive%2C%20Olongapo%20City!5e0!3m2!1sen!2sph!4v1715000000"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full"
          />
        </div>
      </section>

      {/* --- 5. FULL-WIDTH FACEBOOK SECTION --- */}
      <section id="contact" className="py-12 sm:py-16 bg-[#0B3C8A] px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Connect With Us</h2>
            <p className="text-slate-200 text-base sm:text-lg font-medium">
              Follow our Facebook page for the latest updates, eyewear trends, and clinic news.
            </p>
          </div>

          {/* Facebook Card */}
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
              {/* Cover Photo */}
              <div className="relative h-[200px] sm:h-[240px] bg-gradient-to-br from-[#0B3C8A] via-blue-600 to-blue-700 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <Glasses size={150} className="text-white" />
                </div>
              </div>

              {/* Profile Section */}
              <div className="relative px-6 sm:px-8 pb-8 sm:pb-10">
                {/* Profile Picture */}
                <div className="flex justify-start -mt-16 sm:-mt-24 mb-6">
                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl border-4 border-white shadow-xl bg-gradient-to-br from-blue-100 to-slate-100 flex items-center justify-center flex-shrink-0">
                    <Glasses size={64} className="text-[#0B3C8A]" />
                  </div>
                </div>

                {/* Clinic Info */}
                <div className="mb-6">
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">M.T. Olaso Optical Clinic</h3>
                  <p className="text-slate-500 text-sm sm:text-base font-bold flex items-center gap-2">
                    <Facebook size={16} className="text-[#0B3C8A]" />
                    434 followers
                  </p>
                  <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed max-w-2xl">
                    Your trusted destination for premium eyewear, professional vision care, and expert optical advice. We provide the latest technology and personalized service to help you see your best.
                  </p>
                </div>

                {/* Contact Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8 py-6 border-t border-b border-slate-200">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <MapPin size={20} className="text-[#0B3C8A]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Address</p>
                      <p className="text-sm font-bold text-slate-900">43 Magsaysay Drive</p>
                      <p className="text-xs text-slate-600">Olongapo City, Zambales</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Phone size={20} className="text-[#0B3C8A]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Phone</p>
                      <p className="text-sm font-bold text-slate-900">0922 825 4918</p>
                      <p className="text-xs text-slate-600">For appointments</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Clock size={20} className="text-[#0B3C8A]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Hours</p>
                      <p className="text-sm font-bold text-slate-900">9:30 AM - 6:30 PM</p>
                      <p className="text-xs text-slate-600">Mon - Sat (Closed Sun)</p>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <a 
                  href="https://www.facebook.com/olasoOptical/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center px-8 py-3 sm:py-4 bg-[#0B3C8A] text-white rounded-xl font-bold text-base sm:text-lg hover:bg-[#08306B] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <Facebook size={20} /> 
                  <span>Visit Our Facebook Page</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- 6. PRODUCTS LIST --- */}
      <section id="products" className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">Our Products</h2>
            <p className="text-slate-500 text-base sm:text-lg font-medium px-2">
              Explore our wide selection of premium frames, lenses, and accessories for every style and prescription need.
            </p>
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
                  </div>
                </div>
              );
            })}
          </div>
          
          {products.length === 0 && !loading && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No products found in our inventory.</p>
            </div>
          )}
        </div>
      </section>
      <footer className="bg-[#0B3C8A] text-white pt-16 pb-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-12">
            <div className="max-w-xs">
              <div className="flex items-center gap-3 mb-4">
                <Image src="/logo.png?v=1" alt="M.T. Olaso Logo" width={42} height={42} />
                <div>
                  <span className="font-bold text-lg text-slate-200">M.T. Olaso Optical Clinic</span>
                </div>
              </div>
              <p className="text-slate-200 text-sm">Your trusted destination for premium eyewear and professional vision care in Olongapo City.</p>
            </div>
            <div className="grid grid-cols-2 gap-12 text-sm">
              <div>
                <h5 className="font-black text-white mb-4 uppercase text-xs">Quick Links</h5>
                <ul className="space-y-2 text-slate-200 text-xs">
                  <li><a href="#bestselling" className="hover:text-white transition-colors">Best Sellers</a></li>
                  <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
                  <li><a href="#location" className="hover:text-white transition-colors">Map</a></li>
                  <li><a href="#contact" className="hover:text-white transition-colors">Facebook</a></li>
                  <li><a href="#products" className="hover:text-white transition-colors">Products</a></li>
                </ul>
              </div>
              <div>
                <h5 className="font-black text-white mb-4 uppercase text-xs">Contact</h5>
                <ul className="space-y-2 text-slate-200 text-xs">
                  <li>43 Magsaysay Dr, Olongapo</li>
                  <li>0922 825 4918</li>
                  <li>Mon-Sat: 9:30AM-6:30PM</li>
                  <li><a href="https://www.facebook.com/olasoOptical/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                    <Facebook size={14} /> Facebook
                  </a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-8 text-center text-xs text-slate-200">
            <p>© 2026 M.T. Olaso Optical Clinic. All rights reserved.</p>
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