"use client";

import React, { useState, useRef } from "react";
import { useNotification } from "@/components/NotificationProvider"; 
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  Search, 
  Plus, 
  LayoutGrid, 
  List as ListIcon, 
  Edit3, 
  AlertTriangle,
  Glasses,
  X,
  UploadCloud,
  Save,
  Trash2,
  Clock,
  ArrowRightLeft,
  Truck,
  CheckCircle2,
  Calendar,
  History,
  Package
} from "lucide-react";

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";
const THEME_RING = "focus:ring-[#0B3C8A]";
const THEME_BORDER = "border-[#0B3C8A]";

// --- TYPESCRIPT INTERFACES ---
interface InventoryData {
  id: number;
  sku: string;
  name: string;
  category: string;
  specifications: string;
  baseCost: number;
  markupPrice: number;
  supplierInfo: string;
  stock: number;
  lastMovedDaysAgo: number;
  imageColor: string;
  image: string | null;
  leadTimeDays: number;
  reorderPoint: number;
}

type ProductFormData = InventoryData & { adjustmentReason?: string };

interface ProductModalProps {
  mode: 'add' | 'edit' | 'adjust';
  product: ProductFormData;
  onClose: () => void;
  onSave: (data: ProductFormData) => void;
  onDelete: (id: number) => void;
}

interface SupplierOrder {
  id: string;
  productId: number;
  vendor: string;
  item: string;
  qty: number;
  orderDate: string;
  expectedLeadTime: number;
  status: "In Transit" | "Delayed" | "Delivered";
  receivedDate?: string;
}

// --- MOCK DATA ---
const INITIAL_PRODUCTS: InventoryData[] = [
  { id: 1, sku: "FRM-001", name: "Titanium Rimless Frames", category: "Frames", specifications: "Dimensions: 50-18-140", baseCost: 1500, markupPrice: 3500, supplierInfo: "Luxottica Inc.", stock: 8, lastMovedDaysAgo: 2, imageColor: "bg-slate-200", image: null, leadTimeDays: 7, reorderPoint: 10 },
  { id: 2, sku: "LNS-022", name: "Anti-Rad Blue Cut Lenses", category: "Lenses", specifications: "Grade: Plano to -4.00", baseCost: 400, markupPrice: 1200, supplierInfo: "Essilor Vision", stock: 80, lastMovedDaysAgo: 1, imageColor: "bg-blue-100", image: null, leadTimeDays: 3, reorderPoint: 20 },
  { id: 3, sku: "CNT-104", name: "Air Optix Monthly Contacts", category: "Contact Lenses", specifications: "PWR -1.00 to -6.00 / BC 8.6", baseCost: 900, markupPrice: 1800, supplierInfo: "Alcon PH", stock: 12, lastMovedDaysAgo: 5, imageColor: "bg-teal-100", image: null, leadTimeDays: 2, reorderPoint: 15 },
  { id: 4, sku: "FRM-009", name: "Acetate Full-Rim (Tortoise)", category: "Frames", specifications: "Dimensions: 52-16-135", baseCost: 1100, markupPrice: 2800, supplierInfo: "Safilo Group", stock: 25, lastMovedDaysAgo: 35, imageColor: "bg-amber-100", image: null, leadTimeDays: 14, reorderPoint: 10 },
  { id: 5, sku: "ACC-005", name: "Microfiber Cleaning Cloth", category: "Accessories", specifications: "Standard", baseCost: 15, markupPrice: 50, supplierInfo: "Generic Supplies Co.", stock: 200, lastMovedDaysAgo: 0, imageColor: "bg-gray-100", image: null, leadTimeDays: 5, reorderPoint: 50 },
  { id: 6, sku: "SOL-003", name: "Multi-Purpose Lens Solution", category: "Solutions", specifications: "Volume: 360ml", baseCost: 200, markupPrice: 450, supplierInfo: "Bausch & Lomb", stock: 5, lastMovedDaysAgo: 1, imageColor: "bg-cyan-100", image: null, leadTimeDays: 4, reorderPoint: 10 },
  { id: 7, sku: "FRM-102", name: "Kids Flexible Frames (Blue)", category: "Frames", specifications: "Dimensions: 45-15-125", baseCost: 600, markupPrice: 1500, supplierInfo: "Miraflex", stock: 12, lastMovedDaysAgo: 42, imageColor: "bg-blue-200", image: null, leadTimeDays: 10, reorderPoint: 5 },
];

const INITIAL_SUPPLIER_ORDERS: SupplierOrder[] = [
  { id: "PO-1042", productId: 2, vendor: "Luxottica Inc.", item: "Titanium Rimless Frames", qty: 20, orderDate: "Oct 12, 2026", expectedLeadTime: 7, status: "In Transit" },
  { id: "PO-1043", productId: 5, vendor: "Generic Supplies Co.", item: "Microfiber Cleaning Cloth", qty: 150, orderDate: "Oct 05, 2026", expectedLeadTime: 14, status: "Delayed" },
  { id: "PO-1044", productId: 2, vendor: "Essilor Vision", item: "Anti-Rad Blue Cut Lenses", qty: 50, orderDate: "Oct 16, 2026", expectedLeadTime: 3, status: "In Transit" },
];

const INITIAL_COMPLETED_ORDERS: SupplierOrder[] = [
  { id: "PO-1039", productId: 6, vendor: "Bausch & Lomb", item: "Multi-Purpose Lens Solution", qty: 30, orderDate: "Sep 20, 2026", expectedLeadTime: 4, status: "Delivered", receivedDate: "Sep 24, 2026" },
  { id: "PO-1040", productId: 3, vendor: "Alcon PH", item: "Air Optix Monthly Contacts", qty: 40, orderDate: "Oct 01, 2026", expectedLeadTime: 2, status: "Delivered", receivedDate: "Oct 04, 2026" },
];

// --- ANIMATION VARIANTS ---
const containerVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } }};
const itemVariants: Variants = { hidden: { y: 15, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }};
const modalVariants: Variants = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }};

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<"catalog" | "suppliers">("catalog");
  const [products, setProducts] = useState<InventoryData[]>(INITIAL_PRODUCTS);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>(INITIAL_SUPPLIER_ORDERS);
  const [completedOrders, setCompletedOrders] = useState<SupplierOrder[]>(INITIAL_COMPLETED_ORDERS);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'adjust'>('add');
  const [currentProduct, setCurrentProduct] = useState<ProductFormData | null>(null);
  
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<InventoryData | null>(null);

  const { showNotification } = useNotification();

  // --- DERIVED METRICS (Sliced to avoid overflowing screen on mobile) ---
  const lowStockAlerts = products.filter(p => p.stock <= p.reorderPoint && p.stock > 0);
  const deadstockAlerts = products.filter(p => p.lastMovedDaysAgo >= 30 && p.stock > 0);
  
  const displayLowStock = lowStockAlerts.slice(0, 3);
  const displayDeadstock = deadstockAlerts.slice(0, 2);

  // --- FILTERING LOGIC ---
  const filteredProducts = products.filter((product) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(searchLower) || product.sku.toLowerCase().includes(searchLower);
    const matchesCategory = selectedCategory === "All Categories" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // --- HANDLERS ---
  const openAddModal = () => {
    setModalMode('add');
    setCurrentProduct({ id: 0, sku: "", name: "", category: "Frames", specifications: "", baseCost: 0, markupPrice: 0, supplierInfo: "", stock: 0, lastMovedDaysAgo: 0, imageColor: "bg-blue-50", image: null, leadTimeDays: 7, reorderPoint: 10 });
    setIsModalOpen(true);
  };

  const openEditModal = (product: InventoryData) => {
    setModalMode('edit');
    setCurrentProduct({ ...product });
    setIsModalOpen(true);
  };

  const openAdjustModal = (product: InventoryData) => {
    setModalMode('adjust');
    setCurrentProduct({ ...product, adjustmentReason: "Manual Count" });
    setIsModalOpen(true);
  };

  const handleSaveProduct = (formData: ProductFormData) => {
    if (modalMode === 'add') {
      const newProduct: InventoryData = {
        ...formData,
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        lastMovedDaysAgo: 0,
        imageColor: ['bg-blue-100', 'bg-slate-100', 'bg-cyan-100', 'bg-gray-100'][Math.floor(Math.random() * 4)],
        leadTimeDays: 7, reorderPoint: 10
      };
      setProducts([newProduct, ...products]);
      showNotification("New product added to catalog successfully!", "success");
    } else if (modalMode === 'edit') {
      setProducts(products.map(p => p.id === formData.id ? { ...p, ...formData } : p));
      showNotification("Product details updated successfully!", "success");
    } else if (modalMode === 'adjust') {
      setProducts(products.map(p => p.id === formData.id ? { ...p, stock: formData.stock } : p));
      showNotification(`Stock adjusted for ${formData.name}.`, "success");
    }
    setIsModalOpen(false);
  };

  const initiateDelete = (id: number) => {
    const product = products.find(p => p.id === id);
    if (product) {
        setProductToDelete(product);
        setIsModalOpen(false);
        setIsDeleteModalOpen(true);
    }
  };

  const confirmDelete = () => {
    if (productToDelete) {
        setProducts(products.filter(p => p.id !== productToDelete.id));
        setProductToDelete(null);
        setIsDeleteModalOpen(false);
        showNotification("Product deleted from inventory.", "error");
    }
  };

  const handleLogSupplierOrder = (newOrder: SupplierOrder) => {
     setSupplierOrders([newOrder, ...supplierOrders]);
     setIsSupplierModalOpen(false);
     showNotification("Supplier order logged successfully!", "success");
  };

  const handleMarkReceived = (orderId: string) => {
     const orderToReceive = supplierOrders.find(o => o.id === orderId);
     if (orderToReceive) {
        setProducts(prev => prev.map(p => p.id === orderToReceive.productId ? { ...p, stock: p.stock + orderToReceive.qty } : p));
        const completedOrder: SupplierOrder = {
          ...orderToReceive,
          status: "Delivered",
          receivedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
        setCompletedOrders([completedOrder, ...completedOrders]);
        setSupplierOrders(prev => prev.filter(o => o.id !== orderId));
        showNotification(`${orderToReceive.qty} units added to inventory.`, "success");
     }
  };

  return (
    <div className="flex flex-col w-full font-sans p-2 sm:p-4 box-border">
      
      {/* HEADER TABS */}
      <div className="shrink-0 flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4 border-b border-gray-200 pb-2">
         <button 
           onClick={() => setActiveTab("catalog")}
           className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 font-bold text-[11px] sm:text-sm rounded-t-lg transition-colors border-b-2 ${activeTab === 'catalog' ? 'border-[#0B3C8A] text-[#0B3C8A]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
         >
           <Package size={14} className="sm:w-4.5 sm:h-4.5"/> Product Catalog
         </button>
         <button 
           onClick={() => setActiveTab("suppliers")}
           className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 font-bold text-[11px] sm:text-sm rounded-t-lg transition-colors border-b-2 ${activeTab === 'suppliers' ? 'border-[#0B3C8A] text-[#0B3C8A]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
         >
           <Truck size={14} className="sm:w-4.5 sm:h-4.5"/> Supplier Tracking
         </button>
      </div>

      {activeTab === "catalog" ? (
        
        /* === CATALOG TAB LAYOUT === */
        <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 lg:gap-4 w-full">
          
          {/* LEFT COLUMN: MAIN PRODUCT AREA */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col order-first lg:order-0">
            
            {/* Header & Filters */}
            <div className="shrink-0 p-3 sm:p-5 border-b border-gray-100 bg-slate-50 flex flex-col gap-3">
              <div className="flex flex-row justify-between items-center gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <motion.div whileHover={{ scale: 1.05 }} className={`hidden sm:flex p-2 ${THEME_BG} rounded-lg shadow-lg shadow-blue-900/20`}><Glasses className="text-white" size={18} /></motion.div>
                  <div>
                    <h1 className="text-sm sm:text-lg font-bold text-gray-800 leading-tight">Inventory Catalog</h1>
                    <p className="text-[9px] sm:text-[11px] text-gray-500 hidden sm:block">Track real-time stock, pricing, and specs.</p>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={openAddModal} className={`flex items-center justify-center gap-1.5 sm:gap-2 ${THEME_BG} ${THEME_HOVER} text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors shadow-sm`}>
                  <Plus size={14} /> <span className="hidden sm:inline">Add Product</span><span className="sm:hidden">Add</span>
                </motion.button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input type="text" placeholder="Search SKU or Name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 ${THEME_RING} transition-all`} />
                </div>
                <div className="flex gap-1.5 sm:gap-2">
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className={`px-2 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 bg-white text-gray-700 text-[10px] sm:text-sm focus:outline-none focus:ring-1 ${THEME_RING} flex-1 sm:flex-none`}>
                    <option>All Categories</option><option>Frames</option><option>Lenses</option><option>Contact Lenses</option><option>Solutions</option><option>Accessories</option>
                  </select>
                  <div className="flex border border-gray-300 rounded-md sm:rounded-lg overflow-hidden shrink-0">
                    <button onClick={() => setViewMode('grid')} className={`px-2 ${viewMode === 'grid' ? `bg-blue-50 ${THEME_TEXT}` : 'bg-white text-gray-500'}`}><LayoutGrid size={14} /></button>
                    <div className="w-px bg-gray-300"></div>
                    <button onClick={() => setViewMode('list')} className={`px-2 ${viewMode === 'list' ? `bg-blue-50 ${THEME_TEXT}` : 'bg-white text-gray-500'}`}><ListIcon size={14} /></button>
                  </div>
                </div>
              </div>
            </div>

            {/* PRODUCT GRID */}
            <div className="p-2 sm:p-5 bg-gray-50/50">
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4" : "flex flex-col gap-2 sm:gap-3"}>
                  <AnimatePresence mode="popLayout">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((product) => (
                        <ProductCard key={product.id} data={product} viewMode={viewMode} onEdit={() => openEditModal(product)} onAdjust={() => openAdjustModal(product)} />
                      ))
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-10 text-center text-gray-500 text-xs sm:text-sm">No products found.</motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: SIDEBAR ALERTS */}
          {/* Mobile: Stacked below, Desktop: Side column */}
          <aside className="w-full lg:w-70 xl:w-75 flex flex-col gap-2 sm:gap-3 lg:gap-4 shrink-0 order-last lg:order-0">
            
            {/* LOW STOCK TRIGGERS */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200">
               <div className="flex items-center gap-2 mb-2">
                 <div className="p-1 sm:p-1.5 bg-red-100 rounded-md"><AlertTriangle size={14} className="text-red-600 sm:w-4 sm:h-4"/></div>
                 <h3 className="font-bold text-gray-800 text-[11px] sm:text-sm">Action Required</h3>
               </div>
               <p className="text-[9px] sm:text-[11px] text-gray-500 mb-3 sm:mb-4 leading-relaxed">AI detects approaching stock-outs.</p>
               
               {displayLowStock.length > 0 ? (
                 <div className="space-y-2 sm:space-y-3">
                   {displayLowStock.map((item, i) => (
                       <div key={i} className="p-2 sm:p-2.5 rounded-lg border bg-white border-red-100 shadow-sm flex flex-col">
                          <div className="flex justify-between items-start mb-1 gap-2">
                             <span className="text-[11px] sm:text-xs font-semibold text-gray-800 leading-tight truncate">{item.name}</span>
                             <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{item.stock} left</span>
                          </div>
                          
                          {/* "Restock Needed" Design Box */}
                          <div className="mt-1 sm:mt-1.5 bg-red-50 border border-red-200 rounded px-2 py-1.5 flex items-center justify-between">
                             <span className="text-[9px] text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={10}/> Restock Needed</span>
                             <span className="text-[10px] font-black text-red-700">{Math.max(10, item.reorderPoint - item.stock + 15)} units</span>
                          </div>
                       </div>
                   ))}
                 </div>
               ) : (
                  <p className="text-[10px] sm:text-xs text-gray-500">All stock levels are healthy.</p>
               )}
            </motion.div>

            {/* DEADSTOCK IDENTIFIER */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200">
               <div className="flex items-center gap-2 mb-2">
                 <div className="p-1 sm:p-1.5 bg-slate-100 rounded-md"><Clock size={14} className="text-slate-600 sm:w-4 sm:h-4"/></div><div><h3 className="font-bold text-gray-800 text-[11px] sm:text-sm leading-none">Deadstock Identifier</h3></div></div>
               <p className="text-[9px] sm:text-[11px] text-gray-500 mb-3 sm:mb-4 leading-relaxed">AI-flagged items with no sales in 30+ days.</p>
               
               {displayDeadstock.length > 0 ? (
                 <div className="space-y-2 sm:space-y-3">
                   {displayDeadstock.map((item, i) => (
                       <div key={i} className="p-2 sm:p-2.5 rounded-lg border bg-white border-slate-200 shadow-sm flex flex-col">
                          <div className="flex justify-between items-start mb-1 gap-2">
                              <span className="text-[11px] sm:text-xs font-semibold text-gray-800 leading-tight pr-2 truncate">{item.name}</span>
                              <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 whitespace-nowrap shrink-0">{item.lastMovedDaysAgo}d</span>
                          </div>
                          <div className="mt-1 sm:mt-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 flex items-center justify-between">
                             <span className="text-[9px] text-slate-600 font-medium flex items-center gap-1"><Clock size={10}/> {item.lastMovedDaysAgo}d Unsold</span>
                             <span className="text-[9px] font-bold text-blue-600 cursor-pointer">Mark Down</span>
                          </div>
                       </div>
                   ))}
                 </div>
               ) : (
                  <p className="text-[10px] sm:text-xs text-gray-500">No deadstock items identified.</p>
               )}
            </motion.div>
          </aside>
        </div>

      ) : (

        /* === SUPPLIER LEAD-TIME TRACKING TAB === */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200">
           
           {/* Header Area */}
           <div className="shrink-0 p-3 sm:p-5 border-b border-gray-100 flex justify-between items-center gap-2 bg-slate-50">
              <div>
                <h2 className="text-sm sm:text-lg font-bold text-gray-800">Supplier Lead-Time Tracking</h2>
                <p className="text-[9px] sm:text-xs text-gray-500 mt-0.5 max-w-xl hidden sm:block">Log orders to allow AI to track delivery speed and dynamically adjust reorder points.</p>
              </div>
              <button 
                onClick={() => setIsSupplierModalOpen(true)}
                className={`flex items-center justify-center gap-1 sm:gap-2 ${THEME_BG} ${THEME_HOVER} text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors shadow-sm whitespace-nowrap`}
              >
                <Plus size={14} /> <span className="hidden sm:inline">Log New Order</span><span className="sm:hidden">Log Order</span>
              </button>
           </div>

           <div className="flex flex-col p-2.5 sm:p-5 bg-gray-50/50">
             
             {/* Vendor Lead Time Summary Cards (App-like compact row on mobile) */}
             <div className="shrink-0 flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-5">
                {products.filter(p => p.supplierInfo).slice(0, 3).map((product, idx) => (
                  <div key={idx} className="bg-white p-2 sm:p-4 rounded-lg sm:rounded-xl border border-gray-200 shadow-sm flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-stretch gap-2">
                     <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 sm:mb-2">
                           <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{product.supplierInfo}</span>
                        </div>
                        <h3 className="text-[11px] sm:text-sm font-semibold text-gray-800 truncate">{product.name}</h3>
                     </div>
                     <div className="flex flex-col items-end sm:items-start sm:mt-auto sm:w-full sm:bg-slate-50 sm:p-3 sm:rounded-lg sm:border sm:border-gray-100">
                        <span className="text-[9px] sm:text-xs text-gray-500 hidden sm:inline">Auto Reorder Point</span>
                        <span className="font-bold text-[10px] sm:text-xs text-orange-500">{product.reorderPoint} units</span>
                        <span className="bg-blue-50 text-blue-700 text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1 mt-1">
                          <Clock size={10} className="hidden sm:block"/> Avg {product.leadTimeDays}d
                        </span>
                     </div>
                  </div>
                ))}
             </div>

             {/* Split Tables Container */}
             <div className="flex flex-col lg:flex-row gap-3 sm:gap-5">
                
                {/* TABLE 1: Active Deliveries */}
                <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm lg:min-h-0 lg:overflow-hidden">
                    <div className="shrink-0 p-2.5 sm:p-4 bg-slate-50 border-b border-gray-200 flex items-center gap-1.5 sm:gap-2">
                        <Truck size={14} className="text-blue-600 sm:w-4 sm:h-4"/>
                        <h3 className="text-[11px] sm:text-sm font-bold text-gray-800">Active Restock</h3>
                        <span className="bg-blue-100 text-blue-800 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full ml-auto">{supplierOrders.length}</span>
                    </div>
                    <div className="flex-1 overflow-auto p-0">
                        {supplierOrders.length === 0 ? (
                            <div className="p-6 sm:p-10 text-center text-gray-400">
                                <Truck size={28} className="mx-auto mb-2 opacity-20 sm:w-10 sm:h-10"/>
                                <p className="text-[10px] sm:text-xs">No active supplier deliveries.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-[9px] sm:text-xs whitespace-nowrap min-w-75">
                              <thead className="bg-slate-50/80 text-gray-500 font-semibold sticky top-0 backdrop-blur-sm border-b border-gray-100">
                                <tr>
                                  <th className="p-2 sm:p-3">Order Details</th>
                                  <th className="p-2 sm:p-3 text-center">Status</th>
                                  <th className="p-2 sm:p-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {supplierOrders.map((order) => (
                                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2 sm:p-3">
                                        <div className="font-semibold text-gray-800">{order.qty}x {order.item}</div>
                                        <div className="text-[8px] sm:text-[10px] text-gray-500 mt-0.5">{order.vendor}</div>
                                    </td>
                                    <td className="p-2 sm:p-3 text-center">
                                      <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-md uppercase ${
                                         order.status === 'In Transit' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                      }`}>
                                        {order.status}
                                      </span>
                                      <div className="text-[8px] sm:text-[9px] text-gray-400 mt-1 font-mono">ETA: {order.expectedLeadTime}d</div>
                                    </td>
                                    <td className="p-2 sm:p-3 text-right">
                                      <button onClick={() => handleMarkReceived(order.id)} className="text-[8px] sm:text-[10px] font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 px-2 py-1 sm:py-1.5 rounded hover:bg-emerald-100 transition-colors flex items-center gap-1 ml-auto shadow-sm">
                                        <CheckCircle2 size={10} className="sm:w-3 sm:h-3"/> <span className="hidden sm:inline">Receive</span><span className="sm:hidden">Receive</span>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* TABLE 2: Completed Orders */}
                <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm lg:min-h-0 lg:overflow-hidden sm:min-h-0 min-h-auto">
                    <div className="shrink-0 p-2.5 sm:p-4 bg-slate-50 border-b border-gray-200 flex items-center gap-1.5 sm:gap-2">
                        <History size={14} className="text-emerald-600 sm:w-4 sm:h-4"/>
                        <h3 className="text-[11px] sm:text-sm font-bold text-gray-800">Order History</h3>
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full ml-auto">{completedOrders.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                        {completedOrders.length === 0 ? (
                            <div className="p-6 text-center text-gray-400">
                                <History size={28} className="mx-auto mb-2 opacity-20 sm:w-10 sm:h-10"/>
                                <p className="text-[10px] sm:text-xs">No completed orders yet.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-[9px] sm:text-xs whitespace-nowrap min-w-75">
                              <thead className="bg-slate-50/80 text-gray-500 font-semibold sticky top-0 backdrop-blur-sm border-b border-gray-100">
                                <tr>
                                  <th className="p-2 sm:p-3">Order Details</th>
                                  <th className="p-2 sm:p-3 text-center">Dates</th>
                                  <th className="p-2 sm:p-3 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {completedOrders.map((order) => (
                                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2 sm:p-3">
                                        <div className="font-semibold text-gray-800">{order.qty}x {order.item}</div>
                                        <div className="text-[8px] sm:text-[10px] text-gray-500 mt-0.5">{order.vendor}</div>
                                    </td>
                                    <td className="p-2 sm:p-3 text-center">
                                        <div className="text-gray-500 text-[8px] sm:text-[9px]">Ord: {order.orderDate}</div>
                                        <div className="text-gray-800 font-medium text-[8px] sm:text-[9px] mt-0.5">Rcv: {order.receivedDate}</div>
                                    </td>
                                    <td className="p-2 sm:p-3 text-right">
                                      <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-md uppercase bg-emerald-100 text-emerald-700">
                                        {order.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                        )}
                    </div>
                </div>

             </div>
           </div>
        </motion.div>
      )}

      {/* --- MODALS --- */}
      <AnimatePresence>
        {isModalOpen && currentProduct && (
          <ProductModal mode={modalMode} product={currentProduct} onClose={() => setIsModalOpen(false)} onSave={handleSaveProduct} onDelete={initiateDelete} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteModalOpen && productToDelete && (
          <DeleteConfirmationModal productName={productToDelete.name} onCancel={() => { setIsDeleteModalOpen(false); setProductToDelete(null); }} onConfirm={confirmDelete} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSupplierModalOpen && (
          <SupplierOrderModal products={products} onClose={() => setIsSupplierModalOpen(false)} onSave={handleLogSupplierOrder} />
        )}
      </AnimatePresence>
    </div>
  );
}


// --- COMPONENTS ---

// 1. PRODUCT CARD
function ProductCard({ data, viewMode, onEdit, onAdjust }: { data: InventoryData, viewMode: 'grid' | 'list', onEdit: () => void, onAdjust: () => void }) {
  const renderImage = () => {
    if (data.image) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={data.image} alt={data.name} className="w-full h-full object-cover" />;
    }
    return <div className={`w-full h-full ${data.imageColor} flex items-center justify-center`}><Glasses className={`opacity-20 text-[#0B3C8A] w-1/3 h-1/3`} /></div>;
  };
  const isDeadstock = data.lastMovedDaysAgo >= 30;

  if (viewMode === 'list') {
    return (
      <motion.div layout variants={itemVariants} initial="hidden" animate="visible" exit="hidden" className="bg-white p-2 sm:p-3 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 hover:shadow-md transition-shadow">
         <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto flex-1">
             <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center border border-gray-100">{renderImage()}</div>
             <div className="flex-1 min-w-0">
                 <h3 className="font-semibold text-gray-800 text-[11px] sm:text-sm truncate">{data.name}</h3>
                 <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] text-gray-500 mt-0.5">
                    <span className="font-mono text-gray-400">{data.sku}</span><span className="hidden sm:inline">•</span><span className="truncate">Specs: {data.specifications}</span>
                 </div>
             </div>
         </div>
         <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2 sm:gap-3 mt-1 sm:mt-0 sm:pl-3 sm:border-l border-gray-100">
             <div className="text-left sm:text-right">
                 <div className={`${THEME_TEXT} font-bold text-xs sm:text-sm`}>₱{data.markupPrice.toLocaleString()}</div>
                 <div className="text-[9px] sm:text-[11px] text-gray-500 font-semibold">Stock: {data.stock}</div>
             </div>
             <div className="flex flex-row sm:flex-col gap-1">
                 <button onClick={onAdjust} className="px-2 py-1 text-[9px] sm:text-[10px] font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded transition-colors flex items-center justify-center gap-1"><ArrowRightLeft size={10}/> Adjust</button>
                 <button onClick={onEdit} className={`px-2 py-1 text-[9px] sm:text-[10px] font-semibold text-gray-600 border border-gray-200 hover:${THEME_TEXT} hover:border-blue-200 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1`}><Edit3 size={10}/> Edit</button>
             </div>
         </div>
      </motion.div>
    );
  }

  // GRID VIEW 
  return (
    <motion.div layout variants={itemVariants} initial="hidden" animate="visible" exit="hidden" whileHover={{ y: -3, boxShadow: "0 10px 25px -10px rgba(0,0,0,0.1)" }} className={`group bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-200 flex flex-col`}>
      <div className="relative aspect-4/3 sm:aspect-square w-full overflow-hidden bg-slate-50">
         {renderImage()}
         <div className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur text-gray-600 text-[8px] sm:text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-10">{data.sku}</div>
         <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 items-end z-10">
             {data.stock <= data.reorderPoint && <span className="bg-orange-500 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">LOW</span>}
             {isDeadstock && <span className="bg-slate-700 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1"><Clock size={8}/> DEAD</span>}
         </div>
      </div>
      <div className="p-2 sm:p-3 flex flex-col flex-1">
         <h3 className="text-[11px] sm:text-xs font-semibold text-gray-800 line-clamp-2 mb-1 sm:mb-1.5 min-h-8 sm:min-h-9 leading-snug" title={data.name}>{data.name}</h3>
         <p className="text-[9px] sm:text-[10px] text-gray-500 mb-2 truncate" title={data.specifications}>{data.specifications}</p>
         <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div><div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-bold">Retail</div><div className={`${THEME_TEXT} font-bold text-[11px] sm:text-sm leading-tight`}>₱{data.markupPrice.toLocaleString()}</div></div>
            <div className="text-right"><div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-bold">Cost</div><div className="text-gray-600 font-semibold text-[10px] sm:text-xs leading-tight">₱{data.baseCost.toLocaleString()}</div></div>
         </div>
         <div className="mt-auto pt-1.5 sm:pt-2 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1.5 sm:mb-2">
              <span className="text-[9px] sm:text-[10px] font-medium text-gray-500">Stock:</span>
              <span className={`text-[11px] sm:text-xs font-bold ${data.stock <= data.reorderPoint ? 'text-orange-600' : 'text-gray-800'}`}>{data.stock}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                <button onClick={onAdjust} className="w-full flex items-center justify-center gap-1 py-1 sm:py-1.5 rounded border border-gray-200 text-gray-600 text-[9px] sm:text-[10px] font-semibold hover:bg-gray-50 transition-colors"><ArrowRightLeft size={10} className="sm:w-3 sm:h-3"/> Adjust</button>
                <button onClick={onEdit} className={`w-full flex items-center justify-center gap-1 py-1 sm:py-1.5 rounded border border-gray-200 text-gray-600 text-[9px] sm:text-[10px] font-semibold hover:bg-blue-50 hover:${THEME_TEXT} hover:border-blue-200 transition-colors`}><Edit3 size={10} className="sm:w-3 sm:h-3"/> Edit</button>
            </div>
         </div>
      </div>
    </motion.div>
  );
}

// 2. PRODUCT MODAL (ADD / EDIT / ADJUST)
function ProductModal({ mode, product, onClose, onSave, onDelete }: ProductModalProps) {
  const [formData, setFormData] = useState<ProductFormData>(product);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'baseCost' || name === 'markupPrice' || name === 'stock' ? Number(value) : value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       const imageUrl = URL.createObjectURL(file);
       setFormData(prev => ({ ...prev, image: imageUrl }));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); onSave(formData); };

  if (mode === 'adjust') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-100 bg-slate-50">
            <h2 className="text-sm sm:text-lg font-bold text-gray-800">Stock Adjustment</h2><button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={16} className="text-gray-500 sm:w-5 sm:h-5" /></button>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-0.5 sm:mb-1">{formData.name}</p><p className="text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3 font-mono">SKU: {formData.sku}</p>
            <p className="text-[9px] sm:text-[11px] text-gray-500 mb-4 sm:mb-5 p-2 bg-blue-50 rounded-md border border-blue-100">Log deliveries, damaged items, or manual audit counts to correct physical stock.</p>
            <form id="stock-form" onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div><label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">New Physical Count</label><input required name="stock" value={formData.stock || ''} onChange={handleChange} type="number" min="0" placeholder="0" className={`w-full px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-sm sm:text-lg font-bold focus:ring-1 ${THEME_RING} focus:outline-none`} /></div>
              <div><label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Reason for Adjustment</label><select name="adjustmentReason" value={formData.adjustmentReason || "Manual Count"} onChange={handleChange} className={`w-full px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none`}><option>Manual Count / Audit</option><option>Damaged Item</option><option>Return / Exchange</option></select></div>
            </form>
          </div>
          <div className="p-3 sm:p-4 border-t border-gray-100 bg-slate-50 flex gap-2 sm:gap-3"><button type="button" onClick={onClose} className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100">Cancel</button><button type="submit" form="stock-form" className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg ${THEME_BG} text-white text-[11px] sm:text-sm font-medium ${THEME_HOVER}`}>Update Stock</button></div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-100 bg-slate-50"><h2 className="text-sm sm:text-lg font-bold text-gray-800">{mode === 'add' ? 'Add New Product' : 'Edit Product Details'}</h2><button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={16} className="text-gray-500 sm:w-5 sm:h-5" /></button></div>
        <div className="overflow-y-auto p-4 sm:p-5">
           <p className="text-[9px] sm:text-[11px] text-gray-500 mb-4 sm:mb-5 text-center px-2 sm:px-4">Register new items with precise specs and pricing for accurate AI tracking.</p>
           <form id="product-form" onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
             <div className="flex flex-col items-center justify-center mb-2 sm:mb-3">
               <div onClick={() => fileInputRef.current?.click()} className={`group relative w-16 h-16 sm:w-24 sm:h-24 rounded-full sm:rounded-lg border-2 border-dashed border-gray-300 hover:${THEME_BORDER} bg-slate-50 hover:bg-blue-50 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden`}>
                  {formData.image ? (
                     // eslint-disable-next-line @next/next/no-img-element
                     <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : <UploadCloud className="text-gray-400 w-5 h-5 sm:w-6 sm:h-6" />}
               </div>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div><label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Item Name</label><input required name="name" value={formData.name} onChange={handleChange} type="text" className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none`} /></div>
                <div><label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Category</label><select required name="category" value={formData.category} onChange={handleChange} className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none`}><option>Frames</option><option>Lenses</option><option>Contact Lenses</option><option>Solutions</option><option>Accessories</option></select></div>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div><label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Optical Specs</label><input required name="specifications" value={formData.specifications} onChange={handleChange} type="text" placeholder="e.g., 50-18-140" className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none`} /></div>
                <div><label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Supplier Info</label><input required name="supplierInfo" value={formData.supplierInfo} onChange={handleChange} type="text" placeholder="Vendor name" className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none`} /></div>
             </div>
             <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div><label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Cost (₱)</label><input required name="baseCost" value={formData.baseCost || ''} onChange={handleChange} type="number" min="0" placeholder="0" className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none`} /></div>
                <div><label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Price (₱)</label><input required name="markupPrice" value={formData.markupPrice || ''} onChange={handleChange} type="number" min="0" placeholder="0" className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none`} /></div>
                <div>
                   <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Initial Stock</label>
                   <input required name="stock" value={formData.stock || ''} onChange={handleChange} type="number" min="0" placeholder="0" disabled={mode === 'edit'} className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none ${mode === 'edit' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`} />
                </div>
             </div>
           </form>
        </div>
        <div className="p-3 sm:p-4 border-t border-gray-100 bg-slate-50 flex gap-2 sm:gap-3">
             {mode === 'edit' && <button type="button" onClick={() => onDelete(formData.id)} className="p-1.5 sm:p-2.5 rounded-md sm:rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors" title="Delete Product"><Trash2 size={16} className="sm:w-4.5 sm:h-4.5"/></button>}
             <button type="button" onClick={onClose} className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100 transition-colors">Cancel</button>
             <button type="submit" form="product-form" className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg ${THEME_BG} text-white text-[11px] sm:text-sm font-medium ${THEME_HOVER} transition-colors flex justify-center items-center gap-1.5 sm:gap-2`}><Save size={14} className="sm:w-4.5 sm:h-4.5"/> {mode === 'add' ? 'Save' : 'Update'}</button>
        </div>
      </motion.div>
    </div>
  );
}

// 3. LOG SUPPLIER ORDER MODAL
function SupplierOrderModal({ products, onClose, onSave }: { products: InventoryData[], onClose: () => void, onSave: (order: SupplierOrder) => void }) {
    const [selectedProductId, setSelectedProductId] = useState<number>(products[0]?.id || 0);
    const [qty, setQty] = useState(10);
    const [expectedLeadTime, setExpectedLeadTime] = useState(products[0]?.leadTimeDays || 7);
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const product = products.find(p => p.id === selectedProductId);
      if (!product) return;
  
      const newOrder: SupplierOrder = {
        id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
        productId: product.id,
        vendor: product.supplierInfo || "Unknown Vendor",
        item: product.name,
        qty: qty,
        orderDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        expectedLeadTime: expectedLeadTime,
        status: "In Transit"
      };
      onSave(newOrder);
    };
  
    const handleProductSelect = (id: number) => {
        setSelectedProductId(id);
        const prod = products.find(p => p.id === id);
        if (prod) setExpectedLeadTime(prod.leadTimeDays || 7);
    };
  
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-100 bg-slate-50">
                    <h2 className="text-sm sm:text-lg font-bold text-gray-800 flex items-center gap-1.5 sm:gap-2"><Truck size={16} className="sm:w-4.5 sm:h-4.5"/> Log Supplier Order</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={16} className="text-gray-500 sm:w-5 sm:h-5" /></button>
                </div>
                <form id="supplier-form" onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                    <p className="text-[9px] sm:text-[11px] text-gray-500 bg-blue-50 p-2 sm:p-2.5 rounded-md border border-blue-100 mb-2 sm:mb-4">
                       This tells the AI an order was placed. Clicking &quot;Mark Received&quot; later will calculate the actual lead time.
                    </p>
                    <div>
                        <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Select Item to Restock</label>
                        <select 
                            required 
                            value={selectedProductId} 
                            onChange={(e) => handleProductSelect(Number(e.target.value))} 
                            className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none`}
                        >
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.supplierInfo})</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div>
                            <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Order Quantity</label>
                            <input required type="number" min="1" value={qty || ''} onChange={e => setQty(Number(e.target.value))} placeholder="0" className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none`} />
                        </div>
                        <div>
                            <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Expected Days</label>
                            <input required type="number" min="1" value={expectedLeadTime || ''} onChange={e => setExpectedLeadTime(Number(e.target.value))} placeholder="0" className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none`} />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-2">
                        <Calendar size={12} className="sm:w-3.5 sm:h-3.5 text-gray-400"/>
                        <span className="text-[9px] sm:text-[11px] text-gray-500 font-medium">Order Date: Today</span>
                    </div>
                </form>
                <div className="p-3 sm:p-4 border-t border-gray-100 bg-slate-50 flex gap-2 sm:gap-3">
                    <button type="button" onClick={onClose} className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100 transition-colors">Cancel</button>
                    <button type="submit" form="supplier-form" className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg ${THEME_BG} text-white text-[11px] sm:text-sm font-medium ${THEME_HOVER} transition-colors`}>Log Order</button>
                </div>
            </motion.div>
        </div>
    );
}

// 4. DELETE CONFIRMATION MODAL
function DeleteConfirmationModal({ productName, onCancel, onConfirm }: { productName: string, onCancel: () => void, onConfirm: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-4 sm:p-6 text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4"><Trash2 className="text-red-600 w-5 h-5 sm:w-6 sm:h-6" /></div>
                <h3 className="text-sm sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">Delete Product?</h3>
                <p className="text-[10px] sm:text-sm text-gray-500 mb-4 sm:mb-6">Are you sure you want to delete <span className="font-semibold text-gray-800">&quot;{productName}&quot;</span>? This action cannot be undone.</p>
                <div className="flex gap-2 sm:gap-3">
                    <button onClick={onCancel} className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-red-600 text-white text-[11px] sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20">Yes, Delete</button>
                </div>
            </motion.div>
        </div>
    );
}