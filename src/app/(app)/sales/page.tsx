"use client";

import React, { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, AnimatePresence, Variants } from "framer-motion"; 
import { useNotification } from "@/components/NotificationProvider"; 
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  User, 
  CheckCircle2, 
  X, 
  AlertTriangle,
  Receipt,
  History,
  Search,
  Wifi,
  WifiOff,
  RefreshCcw
} from "lucide-react";

// --- THEME CONSTANTS ---
const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";
const THEME_RING = "focus:ring-[#0B3C8A]";

// --- TYPESCRIPT INTERFACES ---
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number | null; 
  imageColor: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface Transaction {
  id: string;
  patientName: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  date: Date;
  status: "completed" | "voided" | "refunded";
  synced: boolean;
}

// --- MOCK DATA FOR OPTICAL CLINIC ---
const INITIAL_CATALOG: Product[] = [
  { id: "FRM-001", name: "Ray-Ban Wayfarer Frame", category: "Frames", price: 4500, stock: 12, imageColor: "bg-slate-200" },
  { id: "FRM-002", name: "Oakley Crosslink Frame", category: "Frames", price: 5500, stock: 8, imageColor: "bg-gray-200" },
  { id: "LNS-001", name: "Essilor Crizal Prevencia", category: "Lenses", price: 3200, stock: 50, imageColor: "bg-blue-100" },
  { id: "LNS-002", name: "Transition Signature Gen 8", category: "Lenses", price: 4000, stock: 30, imageColor: "bg-indigo-100" },
  { id: "CNT-001", name: "Air Optix Colors (Monthly)", category: "Contacts", price: 1500, stock: 24, imageColor: "bg-teal-100" },
  { id: "CNT-002", name: "Acuvue Oasys (Daily)", category: "Contacts", price: 2100, stock: 45, imageColor: "bg-cyan-100" },
  { id: "SOL-001", name: "Opti-Free PureMoist 300ml", category: "Solutions", price: 450, stock: 15, imageColor: "bg-blue-50" },
  { id: "ACC-001", name: "Microfiber Cleaning Kit", category: "Accessories", price: 150, stock: 100, imageColor: "bg-slate-100" },
];

const CATEGORIES = ["All", "Frames", "Lenses", "Contacts", "Solutions", "Accessories"];

type PaymentMethodType = "Cash" | "GCash" | "Card";

// --- ANIMATION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

export default function SalesPage() {
  const { showNotification } = useNotification();
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  // REAL-TIME INVENTORY STATE
  const [products, setProducts] = useState<Product[]>(INITIAL_CATALOG);
  
  // Network Status
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientName, setPatientName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("Cash");
  const [discount, setDiscount] = useState<number>(0);
  
  // Transaction State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  
  // Void State
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [transactionToVoid, setTransactionToVoid] = useState<string | null>(null);

  // --- FILTERING LOGIC (Aligned exactly with the Inventory Page) ---
  const filteredProducts = products.filter((product) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      product.name.toLowerCase().includes(searchLower) || 
      product.id.toLowerCase().includes(searchLower);
      
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // --- CART CALCULATIONS ---
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = Math.max(0, subtotal - discount);

  // --- HANDLERS ---
  const addToCart = (product: Product) => {
    if (product.stock !== null && product.stock <= 0) {
       showNotification("Item is out of stock!", "error");
       return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (product.stock !== null && existing.quantity >= product.stock) {
           showNotification("Cannot exceed available stock!", "error");
           return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const productData = products.find(p => p.id === id);
        const maxStock = productData?.stock;
        
        let newQty = Math.max(1, item.quantity + delta);
        if (maxStock !== null && maxStock !== undefined && newQty > maxStock) {
           newQty = maxStock;
           showNotification("Maximum stock limit reached.", "error");
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      showNotification("Cart is empty", "error");
      return;
    }

    // 1. DEDUCT INVENTORY IN REAL-TIME
    setProducts(prevProducts => prevProducts.map(p => {
       const cartItem = cart.find(c => c.id === p.id);
       if (cartItem && p.stock !== null) {
          return { ...p, stock: p.stock - cartItem.quantity };
       }
       return p;
    }));

    // 2. LOG TRANSACTION
    const newTransaction: Transaction = {
      id: `TRX-${Math.floor(100000 + Math.random() * 900000)}`,
      patientName: patientName || "Walk-in Patient",
      items: [...cart],
      total: total,
      paymentMethod,
      date: new Date(),
      status: "completed",
      synced: isOnline
    };

    setTransactions([newTransaction, ...transactions]);
    setLastTransaction(newTransaction);
    setShowCheckoutModal(true);
    
    // 3. RESET CART
    setCart([]);
    setPatientName("");
    setDiscount(0);
    
    if (!isOnline) {
      showNotification("Saved locally. Stock updated.", "success");
    } else {
      showNotification("Transaction completed and synced!", "success");
    }
  };

  const toggleNetwork = () => {
    if (!isOnline) {
      setSyncing(true);
      setTimeout(() => {
        setTransactions(prev => prev.map(t => ({ ...t, synced: true })));
        setSyncing(false);
        setIsOnline(true);
        showNotification("All offline transactions synced with server.", "success");
      }, 1500);
    } else {
      setIsOnline(false);
      showNotification("Switched to Offline Mode. PWA will cache sales locally.", "error");
    }
  };

  const generateReceipt = (trx: Transaction) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("M.T. Olaso Optical Clinic", 14, 20);
    doc.setFontSize(10);
    doc.text("Official Receipt", 14, 28);
    doc.text(`Receipt No: ${trx.id}`, 14, 34);
    doc.text(`Date: ${trx.date.toLocaleString()}`, 14, 40);
    doc.text(`Patient: ${trx.patientName}`, 14, 46);
    doc.text(`Payment Method: ${trx.paymentMethod}`, 14, 52);

    const tableData = trx.items.map(item => [
      item.name,
      item.quantity.toString(),
      `PHP ${item.price.toLocaleString()}`,
      `PHP ${(item.quantity * item.price).toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 60,
      head: [["Item Description", "Qty", "Unit Price", "Amount"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [11, 60, 138] }
    });

    // Safely get the final Y position from the table
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 60;
    doc.setFontSize(12);
    doc.text(`Total Amount: PHP ${trx.total.toLocaleString()}`, 14, finalY + 10);
    
    doc.save(`Receipt_${trx.id}.pdf`);
  };

  const handleVoid = () => {
    if (transactionToVoid) {
      const trxToRefund = transactions.find(t => t.id === transactionToVoid);
      
      // RESTOCK ITEMS IN REAL-TIME
      if (trxToRefund) {
        setProducts(prevProducts => prevProducts.map(p => {
           const refundedItem = trxToRefund.items.find(c => c.id === p.id);
           if (refundedItem && p.stock !== null) {
              return { ...p, stock: p.stock + refundedItem.quantity };
           }
           return p;
        }));
      }

      setTransactions(prev => prev.map(t => t.id === transactionToVoid ? { ...t, status: "voided" } : t));
      setVoidModalOpen(false);
      setTransactionToVoid(null);
      showNotification("Transaction voided. Stock returned to inventory instantly.", "success");
    }
  };

  return (
    // FULL PAGE SCROLL: Allows content to scroll naturally
    <div className="flex flex-col w-full font-sans p-2 sm:p-4 box-border">
      
      {/* HEADER & TABS */}
      <div className="shrink-0 flex items-center justify-between mb-2 sm:mb-4 border-b border-gray-200 pb-2">
         <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setActiveTab("pos")}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 font-bold text-[11px] sm:text-sm rounded-t-lg transition-colors border-b-2 ${activeTab === 'pos' ? 'border-[#0B3C8A] text-[#0B3C8A]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <ShoppingCart size={16} className="sm:w-4.5 sm:h-4.5"/> Point of Sale
            </button>
            <button 
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 font-bold text-[11px] sm:text-sm rounded-t-lg transition-colors border-b-2 ${activeTab === 'history' ? 'border-[#0B3C8A] text-[#0B3C8A]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <History size={16} className="sm:w-4.5 sm:h-4.5"/> Transaction History
            </button>
         </div>

         {/* OFFLINE RESILIENCE TOGGLE */}
         <button 
           onClick={toggleNetwork}
           className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold transition-all shadow-sm ${
             syncing ? 'bg-blue-100 text-blue-600' :
             isOnline ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
           }`}
         >
           {syncing ? <RefreshCcw size={12} className="animate-spin" /> : 
            isOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}
           <span className="hidden sm:inline">{syncing ? 'SYNCING...' : isOnline ? 'ONLINE' : 'OFFLINE MODE'}</span>
         </button>
      </div>

      {activeTab === "pos" ? (
        /* === POS TAB === */
        <div className="flex flex-col lg:flex-row gap-2 sm:gap-4 lg:min-h-[calc(98vh-180px)]">
          
          {/* LEFT: PRODUCT SELECTION */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 lg:min-h-0">
             
             <div className="shrink-0 p-2 sm:p-4 border-b border-gray-100 bg-slate-50 space-y-2 sm:space-y-3">
                <div className="relative group">
                  <Search className={`absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:${THEME_TEXT}`} size={16} />
                  <input 
                    type="text" 
                    placeholder="Search catalog items..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-1.5 sm:py-2.5 rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-2 ${THEME_RING}`}
                  />
                  {searchQuery.trim() && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Clear search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                   {CATEGORIES.map(cat => (
                     <button 
                       key={cat}
                       onClick={() => setSelectedCategory(cat)}
                       className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? `${THEME_BG} text-white shadow-md` : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                     >
                       {cat}
                     </button>
                   ))}
                </div>
             </div>

             {/* Inner scroll container for products only */}
              <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50/50 lg:min-h-0">
                <motion.div 
                  key={`product-grid-${selectedCategory}-${searchQuery}`} // Add composite key
                  variants={containerVariants} 
                  initial="hidden" 
                  animate="visible" 
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(product => (
                        <motion.div 
                          key={product.id} 
                          variants={itemVariants} 
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => addToCart(product)}
                          className={`bg-white p-2 sm:p-3 rounded-xl border border-gray-200 shadow-sm cursor-pointer transition-all flex flex-col ${product.stock === 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-md hover:border-blue-300'}`}
                        >
                          <div className={`w-full aspect-4/3 sm:aspect-video ${product.imageColor} rounded-lg mb-1.5 sm:mb-2 flex items-center justify-center`}>
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-black/30">{product.id}</span>
                          </div>
                          <h3 className="text-[11px] sm:text-xs font-semibold text-gray-800 line-clamp-2 leading-tight flex-1">{product.name}</h3>
                          <div className="mt-1.5 sm:mt-2 flex justify-between items-end">
                            <span className={`${THEME_TEXT} font-bold text-xs sm:text-sm`}>₱{product.price.toLocaleString()}</span>
                            {product.stock !== null && (
                              <span className={`text-[8px] sm:text-[9px] font-bold ${product.stock <= 0 ? 'text-red-600' : product.stock < 10 ? 'text-orange-500' : 'text-gray-400'}`}>
                                {product.stock <= 0 ? 'OUT' : `${product.stock} left`}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <motion.div 
                        key="no-results"
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="col-span-full py-10 text-center text-gray-500 text-sm"
                      >
                        No products found matching your search.
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
          </div>

          {/* RIGHT: CART & CHECKOUT */}
          <div className="w-full lg:w-95 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 shrink-0 lg:min-h-0">
             
             <div className="shrink-0 p-2.5 sm:p-4 border-b border-gray-100 bg-slate-50 flex flex-col gap-2 sm:gap-3">
                <div className="flex items-center justify-between">
                   <h2 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-1.5 sm:gap-2"><ShoppingCart size={16} className="sm:w-4.5 sm:h-4.5"/> Current Order</h2>
                   <span className="bg-blue-100 text-[#0B3C8A] text-[10px] sm:text-[11px] font-bold px-2 py-0.5 sm:py-1 rounded-full">{cart.length} Items</span>
                </div>
                <div className="relative">
                  <User className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Patient Name (Optional)" 
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className={`w-full pl-8 sm:pl-9 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 ${THEME_RING}`}
                  />
                </div>
             </div>

             {/* Inner scroll container for Cart Items */}
             <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 sm:space-y-2 lg:min-h-0">
               {cart.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-1 sm:space-y-2">
                    <ShoppingCart size={36} className="sm:w-12 sm:h-12 opacity-20"/>
                    <p className="text-xs sm:text-sm font-medium">Cart is empty</p>
                 </div>
               ) : (
                 <AnimatePresence>
                   {cart.map(item => (
                     <motion.div key={item.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                       className="flex items-center justify-between bg-white border border-gray-100 p-2 sm:p-2.5 rounded-lg shadow-sm"
                     >
                        <div className="flex-1 min-w-0 pr-2">
                           <h4 className="text-[10px] sm:text-[11px] font-bold text-gray-800 truncate">{item.name}</h4>
                           <div className="text-[9px] sm:text-[10px] text-gray-500 font-mono">₱{item.price.toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                           <div className="flex items-center border border-gray-200 rounded-md">
                             <button onClick={() => updateQuantity(item.id, -1)} className="p-0.5 sm:p-1 hover:bg-gray-100 text-gray-600"><Minus size={12}/></button>
                             <span className="w-4 sm:w-5 text-center text-[10px] sm:text-[11px] font-bold">{item.quantity}</span>
                             <button onClick={() => updateQuantity(item.id, 1)} className="p-0.5 sm:p-1 hover:bg-gray-100 text-gray-600"><Plus size={12}/></button>
                           </div>
                           <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                             <Trash2 size={14}/>
                           </button>
                        </div>
                     </motion.div>
                   ))}
                 </AnimatePresence>
               )}
             </div>

             <div className="shrink-0 p-2.5 sm:p-4 border-t border-gray-100 bg-slate-50">
                <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-2 sm:mb-4">
                  {[
                    { id: 'Cash', icon: Banknote },
                    { id: 'GCash', icon: Smartphone },
                    { id: 'Card', icon: CreditCard }
                  ].map(method => (
                    <button 
                      key={method.id} onClick={() => setPaymentMethod(method.id as PaymentMethodType)}
                      className={`flex flex-col items-center justify-center py-1 sm:py-2 rounded-md sm:rounded-lg border text-[9px] sm:text-[10px] font-bold transition-all ${paymentMethod === method.id ? `border-[#0B3C8A] bg-blue-50 ${THEME_TEXT} shadow-sm` : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      <method.icon size={12} className="sm:w-3.5 sm:h-3.5 mb-0.5 sm:mb-1"/> {method.id}
                    </button>
                  ))}
                </div>

                <div className="space-y-1 sm:space-y-1.5 mb-2 sm:mb-4">
                   <div className="flex justify-between text-[10px] sm:text-[11px] text-gray-500">
                     <span>Subtotal</span><span>₱{subtotal.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-gray-500">
                     <span>Discount</span>
                     <input type="number" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value))} placeholder="0" className="w-12 sm:w-16 px-1 py-0.5 text-right border border-gray-200 rounded"/>
                   </div>
                   <div className="flex justify-between text-sm sm:text-base font-black text-gray-800 pt-1.5 sm:pt-2 border-t border-gray-200">
                     <span>Total</span><span className={THEME_TEXT}>₱{total.toLocaleString()}</span>
                   </div>
                </div>

                <button 
                  onClick={handleCheckout} disabled={cart.length === 0}
                  className={`w-full py-1.5 sm:py-2.5 rounded-md sm:rounded-lg font-bold text-white shadow-md transition-all text-xs sm:text-sm ${cart.length === 0 ? 'bg-gray-400 cursor-not-allowed' : `${THEME_BG} ${THEME_HOVER}`}`}
                >
                  Pay ₱{total.toLocaleString()}
                </button>
             </div>
          </div>
        </div>

      ) : (
        /* === TRANSACTION HISTORY TAB === */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col lg:min-h-[calc(98vh-180px)]">
           <div className="shrink-0 p-3 sm:p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-800">Today&apos;s Transactions</h2>
                <p className="text-[10px] sm:text-[11px] text-gray-500">View daily sales, generate receipts, and process refunds.</p>
              </div>
           </div>

           <div className="flex-1 min-h-0 overflow-y-auto lg:min-h-0">
             {transactions.length === 0 ? (
               <div className="py-20 text-center text-gray-400 flex flex-col items-center">
                  <History size={36} className="sm:w-12 sm:h-12 mb-3 sm:mb-4 opacity-20"/>
                  <p className="text-xs sm:text-sm">No transactions recorded today.</p>
               </div>
             ) : (
               <div className="overflow-x-auto w-full">
                 <table className="w-full text-left text-[10px] sm:text-xs whitespace-nowrap">
                   <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
                     <tr>
                       <th className="p-2 sm:p-3">Receipt No.</th>
                       <th className="p-2 sm:p-3">Time</th>
                       <th className="p-2 sm:p-3">Patient Name</th>
                       <th className="p-2 sm:p-3">Method</th>
                       <th className="p-2 sm:p-3 text-right">Amount</th>
                       <th className="p-2 sm:p-3 text-center">Sync</th>
                       <th className="p-2 sm:p-3 text-center">Status</th>
                       <th className="p-2 sm:p-3 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {transactions.map(trx => (
                       <tr key={trx.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="p-2 sm:p-3 font-mono text-gray-500">{trx.id}</td>
                         <td className="p-2 sm:p-3 text-gray-600">{trx.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                         <td className="p-2 sm:p-3 font-medium text-gray-800">{trx.patientName}</td>
                         <td className="p-2 sm:p-3 text-gray-600">{trx.paymentMethod}</td>
                         <td className="p-2 sm:p-3 text-right font-bold text-gray-800">₱{trx.total.toLocaleString()}</td>
                         <td className="p-2 sm:p-3 text-center">
                           {trx.synced ? <CloudCheckIcon /> : <CloudPendingIcon />}
                         </td>
                         <td className="p-2 sm:p-3 text-center">
                           <span className={`px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold rounded-full uppercase ${trx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                             {trx.status}
                           </span>
                         </td>
                         <td className="p-2 sm:p-3 text-right">
                           <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                              <button onClick={() => generateReceipt(trx)} className="p-1 sm:p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Download Receipt">
                                <Receipt size={14}/>
                              </button>
                              {trx.status === 'completed' && (
                                <button onClick={() => { setTransactionToVoid(trx.id); setVoidModalOpen(true); }} className="p-1 sm:p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Void / Refund Transaction">
                                  <X size={14}/>
                                </button>
                              )}
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
           </div>
        </motion.div>
      )}

      {/* --- MODALS --- */}
      
      {/* Checkout Success Modal */}
      <AnimatePresence>
        {showCheckoutModal && lastTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-emerald-600">
                   <CheckCircle2 size={28} className="sm:w-8 sm:h-8" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-gray-800 mb-1">Payment Successful</h2>
                <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 font-mono">{lastTransaction.id}</p>
                <div className="text-2xl sm:text-3xl font-black text-[#0B3C8A] mb-5 sm:mb-6">₱{lastTransaction.total.toLocaleString()}</div>
                
                <div className="flex flex-col gap-2">
                   <button onClick={() => generateReceipt(lastTransaction)} className={`w-full py-2 sm:py-2.5 rounded-lg border border-gray-200 text-gray-700 text-xs sm:text-sm font-bold hover:bg-gray-50 flex justify-center items-center gap-2 transition-colors`}>
                     <Receipt size={14} className="sm:w-4 sm:h-4"/> Print / Download Receipt
                   </button>
                   <button onClick={() => setShowCheckoutModal(false)} className={`w-full py-2 sm:py-2.5 rounded-lg ${THEME_BG} text-white text-xs sm:text-sm font-bold ${THEME_HOVER} transition-colors`}>
                     New Transaction
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Void Confirmation Modal */}
      <AnimatePresence>
        {voidModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-xl shadow-2xl p-5 sm:p-6 w-full max-w-sm text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-red-600">
                   <AlertTriangle size={20} className="sm:w-6 sm:h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">Refund Transaction?</h3>
                <p className="text-[11px] sm:text-xs text-gray-500 mb-5 sm:mb-6">Are you sure you want to void receipt <span className="font-mono font-bold text-gray-700">{transactionToVoid}</span>? This will record the sale as refunded and instantly return the items to stock.</p>
                <div className="flex gap-2 sm:gap-3">
                   <button onClick={() => setVoidModalOpen(false)} className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 text-xs sm:text-sm font-medium hover:bg-gray-50">Cancel</button>
                   <button onClick={handleVoid} className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-md">Void & Refund</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Mini components for table icons
function CloudCheckIcon() {
  return <div className="flex justify-center" title="Synced to Server"><CheckCircle2 size={12} className="sm:w-3.5 sm:h-3.5 text-emerald-500" /></div>;
}
function CloudPendingIcon() {
  return <div className="flex justify-center" title="Pending Sync (Offline)"><WifiOff size={12} className="sm:w-3.5 sm:h-3.5 text-red-400" /></div>;
}