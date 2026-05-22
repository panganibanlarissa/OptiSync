"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
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
  Glasses,
  X as XIcon
} from "lucide-react";
import { collection, getDocs, query, orderBy, doc, updateDoc, increment, getDoc, setDoc } from "firebase/firestore";
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
    description: "Classic aviator style frames with premium metal construction. Lightweight and durable for everyday wear.",
    specifications: "Metal frame, UV protection, Scratch resistant"
  },
  {
    id: "fallback-2",
    name: "Cat Eye Designer Frames",
    category: "Frames",
    image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&h=500&fit=crop",
    price: 3500,
    description: "Elegant cat eye frames that add a touch of vintage glamour to any outfit.",
    specifications: "Acetate frame, Premium hinges, Available in multiple colors"
  },
  {
    id: "fallback-3",
    name: "Round Metal Frames",
    category: "Frames",
    image: "https://images.unsplash.com/photo-1495164469619-ca4171e43f38?w=500&h=500&fit=crop",
    price: 2200,
    description: "Classic round metal frames for a sophisticated, intellectual look.",
    specifications: "Lightweight metal, Adjustable nose pads, Durable construction"
  },
  {
    id: "fallback-4",
    name: "Wayfarer Style Sunglasses",
    category: "Sunglasses",
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&h=500&fit=crop",
    price: 4000,
    description: "Iconic wayfarer sunglasses with UV400 protection. Perfect for sunny days.",
    specifications: "Polarized lenses, UV400 protection, Impact resistant"
  },
  {
    id: "fallback-5",
    name: "Blue Light Blocking Lenses",
    category: "Lenses",
    image: "https://images.unsplash.com/photo-1591076482161-42ce6da69f5a?w=500&h=500&fit=crop",
    price: 1500,
    description: "Protect your eyes from digital eye strain with our premium blue light blocking lenses.",
    specifications: "Blue light filter, Anti-reflective coating, Scratch resistant"
  },
  {
    id: "fallback-6",
    name: "Anti-Glare Lenses",
    category: "Lenses",
    image: "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=500&h=500&fit=crop",
    price: 1800,
    description: "Reduce glare and improve night vision with our premium anti-glare lenses.",
    specifications: "Anti-reflective coating, UV protection, Easy to clean"
  },
];

// Modal animation variants
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

// Product Modal Component - SKU REMOVED
function ProductModal({ product, onClose }: { product: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <h2 className="text-xl font-bold text-gray-800">{product.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XIcon size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Product Image */}
            <div className="bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center p-4 border border-gray-200">
              {product.image && product.image.startsWith('http') ? (
                <div className="relative w-full aspect-square">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              ) : (
                <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <Package className="w-20 h-20 text-gray-300" />
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="space-y-4">
              {/* Availability Status */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Availability</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${(product.stock || 0) > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <p className="text-gray-800 font-medium">{(product.stock || 0) > 0 ? 'In Stock' : 'Out of Stock'}</p>
                </div>
              </div>

              {/* Popularity */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Popularity</p>
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-amber-500 fill-amber-500" />
                  <p className="text-gray-800 font-medium">{product.publicViewCount || 0} customer views</p>
                </div>
              </div>

              {product.specifications && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Specifications</p>
                  <p className="text-gray-700 text-sm">{product.specifications}</p>
                </div>
              )}

              {product.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-gray-700 text-sm leading-relaxed">{product.description}</p>
                </div>
              )}

              {/* Note about price */}
              <div className="bg-blue-50 rounded-lg p-3 mt-4">
                <p className="text-xs text-blue-700 text-center">
                  For pricing information, please visit our clinic or contact us directly.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-[#0B3C8A] text-white rounded-lg font-medium hover:bg-[#082F6E] transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Clinic ID - same as in FirebaseContext
const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";

export default function ClinicLandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [bestSellers, setBestSellers] = useState<any[]>([]);

  // Calculate best sellers based on product data
  const calculateBestSellers = (productsData: any[]) => {
    if (!productsData || productsData.length === 0) return [];
    
    // Sort by public view count (highest first), then by stock (lower stock = more sold)
    const sorted = [...productsData].sort((a, b) => {
      const viewsA = a.publicViewCount || 0;
      const viewsB = b.publicViewCount || 0;
      
      if (viewsA !== viewsB) {
        return viewsB - viewsA; // Higher view count = more popular
      }
      
      // If same views, products with lower stock may indicate higher sales
      return (a.stock || 0) - (b.stock || 0);
    });
    
    // Return top 6 best sellers
    return sorted.slice(0, 6);
  };

  // Handle Scroll Effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track product click and increment view count
  const handleProductClick = async (product: any) => {
    // Only track clicks for real products (not fallback)
    if (!product.id.startsWith('fallback-')) {
      try {
        const productRef = doc(db, `clinics/${CLINIC_ID}/products`, product.id);
        
        // First, check if the document exists
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
          // Document exists, increment the view count
          await updateDoc(productRef, {
            publicViewCount: increment(1)
          });
          console.log(`✅ View count incremented for ${product.name}`);
        } else {
          // Document doesn't exist (shouldn't happen), create it with view count 1
          console.warn(`Product document not found for ${product.id}, creating with view count 1`);
          await setDoc(productRef, {
            publicViewCount: 1
          }, { merge: true });
          console.log(`✅ Created product document with view count 1 for ${product.name}`);
        }
      } catch (error) {
        console.error("Error incrementing view count:", error);
      }
    }
    
    // Show modal
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  // Fetch real products from Firestore (public read)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const productsRef = collection(db, `clinics/${CLINIC_ID}/products`);
        const productsQuery = query(productsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(productsQuery);
        
        const fetchedProducts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        if (fetchedProducts.length > 0) {
          setAllProducts(fetchedProducts);
          // Show first 12 products on landing page
          setProducts(fetchedProducts.slice(0, 12));
          // Calculate and set best sellers
          setBestSellers(calculateBestSellers(fetchedProducts));
        } else {
          setAllProducts(FALLBACK_PRODUCTS);
          setProducts(FALLBACK_PRODUCTS);
          setBestSellers(calculateBestSellers(FALLBACK_PRODUCTS));
        }
      } catch (error) {
        console.error("Error fetching products from Firestore:", error);
        setAllProducts(FALLBACK_PRODUCTS);
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
            <Image src="/images/clinic-logo.jpg" alt="M.T. Olaso Logo" width={42} height={42} />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-base sm:text-md text-[#0B3C8A] tracking-tight">M.T. Olaso Optical Clinic</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#best-sellers" className="hover:text-[#0B3C8A] transition-colors">Best Sellers</a>
            <a href="#services" className="hover:text-[#0B3C8A] transition-colors">Services</a>
            <a href="#location" className="hover:text-[#0B3C8A] transition-colors">Map</a>
            <a href="#contact" className="hover:text-[#0B3C8A] transition-colors">Facebook</a>
            <a href="#products" className="hover:text-[#0B3C8A] transition-colors">Our Products</a>
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
            <a href="#best-sellers" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Best Sellers</a>
            <a href="#services" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Services</a>
            <a href="#location" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Map</a>
            <a href="#contact" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Facebook</a>
            <a href="#products" className="text-slate-700 font-bold text-base" onClick={() => setMobileMenuOpen(false)}>Our Products</a>
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
            <div className="mb-2 sm:mb-3 flex justify-center">
              <div className="bg-white rounded-lg overflow-hidden shadow-2xl inline-block">
                <Image
                  src="/images/clinic-logo.jpg"
                  alt="M.T. Olaso Optical Clinic Logo"
                  width={400}
                  height={120}
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-[1.1] mb-4 tracking-tight">
              M.T. Olaso Optical Clinic
            </h1>
            <p className="text-base sm:text-lg text-blue-50 leading-relaxed max-w-xl mx-auto">
              Advanced Eye Examination • Premium Frames • Quality Lenses
            </p>
          </div>
        </div>
      </section>

      {/* --- 3. BEST SELLERS SECTION --- */}
      <section id="best-sellers" className="py-16 sm:py-24 px-4 sm:px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">Best Sellers</h2>
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
            </div>
            <p className="text-slate-500 text-base sm:text-lg font-medium px-2">
              Customer favorites and most popular products from our collection
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
            {bestSellers.map((product, idx) => {
              const hasImageError = imageErrors.has(product.id);
              const productImage = product.image || product.productImage;
              const isValidImage = !hasImageError && productImage && typeof productImage === 'string' && productImage.startsWith('http');
              
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleProductClick(product)}
                  className="group bg-white rounded-2xl border-2 border-amber-200 overflow-hidden hover:shadow-xl hover:border-amber-400 transition-all duration-300 hover:-translate-y-2 flex flex-col cursor-pointer relative"
                >
                  {/* Best Seller Badge */}
                  <div className="absolute top-2 right-2 z-10 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <Star size={14} className="fill-white" /> Best
                  </div>

                  <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                    {isValidImage ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={productImage}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16.67vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          onError={() => handleImageError(product.id)}
                          priority={idx < 6}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Package className="w-16 h-16 text-slate-300" />
                      </div>
                    )}
                    {/* View Details Overlay */}
                    <div className="absolute inset-0 bg-[#0B3C8A]/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="text-white font-semibold text-xs px-3 py-1.5 border-2 border-white rounded-lg">
                        View Details
                      </span>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 flex flex-col flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                      {product.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">{product.category}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {bestSellers.length === 0 && !loading && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No best sellers available at this time.</p>
            </div>
          )}
        </div>
      </section>

      {/* --- 4. SERVICES SECTION --- */}
      <section id="services" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#0B3C8A]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-100 mb-3 sm:mb-4">What We Offer</h2>
            <p className="text-slate-300 text-base sm:text-lg font-medium px-2">
              Complete eye care services designed to help you see better and feel confident
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Service 1: Comprehensive Eye Exams */}
            <div className="group relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0B3C8A] flex items-center justify-center mb-4 sm:mb-6 text-white">
                <Eye size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Comprehensive Eye Exams</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Advanced eye testing to determine your prescription and detect vision problems early.
              </p>
            </div>

            {/* Service 2: Designer Frames Collection */}
            <div className="group relative bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border border-purple-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-purple-600 flex items-center justify-center mb-4 sm:mb-6 text-white">
                <Sparkles size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Designer Frames</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Curated selection of premium and designer frames from top brands for every style preference.
              </p>
            </div>

            {/* Service 3: Specialized Lens Options */}
            <div className="group relative bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-600 flex items-center justify-center mb-4 sm:mb-6 text-white">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Specialized Lens Options</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Blue light, progressive, and photochromic lenses tailored to your lifestyle needs.
              </p>
            </div>

            {/* Service 4: Frame Fitting & Adjustment */}
            <div className="group relative bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl border border-rose-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-600 flex items-center justify-center mb-4 sm:mb-6 text-white">
                <Heart size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Frame Fitting & Adjustment</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Professional fitting and precise adjustments to ensure comfort and optimal vision correction.
              </p>
            </div>

            {/* Service 5: Contact Lens Services */}
            <div className="group relative bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl border border-amber-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-600 flex items-center justify-center mb-4 sm:mb-6 text-white">
                <Barcode size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Contact Lens Services</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Comprehensive contact lens fitting, care, and maintenance guidance from experienced opticians.
              </p>
            </div>

            {/* Service 6: Eye Health Education */}
            <div className="group relative bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl border border-indigo-200 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-600 flex items-center justify-center mb-4 sm:mb-6 text-white">
                <Clock size={32} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3">Eye Health Education</h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Expert guidance on eye care, UV protection, and preventative measures for long-term vision health.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- 5. FULL-WIDTH MAP SECTION --- */}
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

      {/* --- 6. FULL-WIDTH FACEBOOK SECTION --- */}
      <section id="contact" className="py-12 sm:py-16 bg-[#0B3C8A] px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Connect With Us</h2>
            <p className="text-slate-200 text-base sm:text-lg font-medium">
              Follow our Facebook page for the latest updates and clinic news.
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl">
              <div className="relative h-[200px] sm:h-[240px] overflow-hidden bg-slate-100">
                <Image
                  src="/images/clinic-logo.jpg"
                  alt="Cover Photo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              <div className="relative px-6 sm:px-8 pb-8 sm:pb-10">
                <div className="flex justify-start -mt-16 sm:-mt-24 mb-6">
                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl border-4 border-white shadow-xl bg-gradient-to-br from-blue-100 to-slate-100 flex items-center justify-center flex-shrink-0">
                    <Glasses size={64} className="text-[#0B3C8A]" />
                  </div>
                </div>

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

      {/* --- 3. OUR PRODUCTS SECTION (MOVED) --- */}
      <section id="products" className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 sm:mb-4">Our Products</h2>
            <p className="text-slate-500 text-base sm:text-lg font-medium px-2">
              Explore our wide selection of premium frames, lenses, and accessories for every style and prescription need.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {products.map((product, idx) => {
              const hasImageError = imageErrors.has(product.id);
              const productImage = product.image || product.productImage;
              const isValidImage = !hasImageError && productImage && typeof productImage === 'string' && productImage.startsWith('http');
              
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleProductClick(product)}
                  className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-[#0B3C8A] transition-all duration-300 hover:-translate-y-2 flex flex-col cursor-pointer"
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
                        <Package className="w-16 h-16 text-slate-300" />
                      </div>
                    )}
                    {/* View Details Overlay */}
                    <div className="absolute inset-0 bg-[#0B3C8A]/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="text-white font-semibold text-sm px-4 py-2 border-2 border-white rounded-lg">
                        View Details
                      </span>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5 flex flex-col flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 leading-snug">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{product.category}</p>
                  </div>
                </motion.div>
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

      <footer className="bg-[#093274] text-white pt-16 pb-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-12">
            <div className="max-w-xs">
              <div className="flex items-center gap-3 mb-4">
                <Image src="/images/clinic-logo.jpg" alt="M.T. Olaso Logo" width={42} height={42} />
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
                  <li><a href="#products" className="hover:text-white transition-colors">Our Products</a></li>
                  <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
                  <li><a href="#location" className="hover:text-white transition-colors">Map</a></li>
                  <li><a href="#contact" className="hover:text-white transition-colors">Facebook</a></li>
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

      {/* Product Modal */}
      <AnimatePresence>
        {showProductModal && selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={() => {
              setShowProductModal(false);
              setSelectedProduct(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}