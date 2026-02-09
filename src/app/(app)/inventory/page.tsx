"use client";

import { useState, useRef } from "react";
// 1. Import Hook & Animation Libs
import { useNotification } from "@/components/NotificationProvider"; 
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  Search, 
  Plus, 
  LayoutGrid, 
  List as ListIcon, 
  Edit3, 
  Package, 
  AlertTriangle,
  Glasses,
  AlertCircle,
  X,
  UploadCloud,
  Save,
  Trash2
} from "lucide-react";

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";
const THEME_RING = "focus:ring-[#0B3C8A]";
const THEME_BORDER = "border-[#0B3C8A]";

// --- MOCK DATA ---
const INITIAL_PRODUCTS = [
  { id: 1, name: "Titanium Rimless Frames (Silver)", price: 3500, stock: 45, sold: 120, category: "Frames", imageColor: "bg-slate-200", image: null },
  { id: 2, name: "Anti-Rad Blue Cut Lenses (Plano)", price: 1200, stock: 80, sold: 450, category: "Lenses", imageColor: "bg-blue-100", image: null },
  { id: 3, name: "Air Optix Monthly Contact Lenses", price: 1800, stock: 12, sold: 85, category: "Contact Lenses", imageColor: "bg-teal-100", image: null },
  { id: 4, name: "Acetate Full-Rim Frames (Tortoise)", price: 2800, stock: 25, sold: 60, category: "Frames", imageColor: "bg-amber-100", image: null },
  { id: 5, name: "Microfiber Cleaning Cloth", price: 50, stock: 200, sold: 1500, category: "Accessories", imageColor: "bg-gray-100", image: null },
  { id: 6, name: "Multi-Purpose Lens Solution (360ml)", price: 450, stock: 8, sold: 320, category: "Solutions", imageColor: "bg-cyan-100", image: null },
  { id: 7, name: "Photochromic Transition Lenses", price: 2500, stock: 30, sold: 110, category: "Lenses", imageColor: "bg-gray-300", image: null },
  { id: 8, name: "Kids Flexible Frames (Blue)", price: 1500, stock: 15, sold: 45, category: "Frames", imageColor: "bg-blue-200", image: null },
];

const INVENTORY_LEVELS = [
  { label: "Frames", current: 85, max: 150, percent: 56, color: "bg-[#0B3C8A]" },
  { label: "Lenses", current: 110, max: 200, percent: 55, color: "bg-cyan-500" },
  { label: "Contact Lenses", current: 12, max: 50, percent: 24, color: "bg-orange-500" }, // Low
  { label: "Solutions", current: 8, max: 40, percent: 20, color: "bg-red-500" }, // Critical
];

const ALERTS = [
  { name: "Multi-Purpose Lens Solution", units: 8, status: "critical" },
  { name: "Air Optix Monthly Contacts", units: 12, status: "low" },
  { name: "Kids Flexible Frames", units: 15, status: "low" },
];

// --- ANIMATION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: "spring", stiffness: 100 }
  }
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

export default function InventoryPage() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // --- FILTER STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [stockStatus, setStockStatus] = useState("Status: All");

  // --- MODAL STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentProduct, setCurrentProduct] = useState<any>(null);

  // --- DELETE CONFIRMATION STATE ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);

  // 2. Init Hook
  const { showNotification } = useNotification();

  // --- FILTERING LOGIC ---
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All Categories" || product.category === selectedCategory;
    
    let matchesStatus = true;
    if (stockStatus === "In Stock") matchesStatus = product.stock > 10;
    if (stockStatus === "Low Stock") matchesStatus = product.stock > 0 && product.stock <= 10;
    if (stockStatus === "Out of Stock") matchesStatus = product.stock === 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // --- HANDLERS ---
  const openAddModal = () => {
    setModalMode('add');
    setCurrentProduct({
      id: 0, name: "", category: "Frames", price: "", stock: "", sold: 0, imageColor: "bg-blue-50", image: null
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product: any) => {
    setModalMode('edit');
    setCurrentProduct({ ...product });
    setIsModalOpen(true);
  };

  const handleSaveProduct = (formData: any) => {
    if (modalMode === 'add') {
      const newProduct = {
        ...formData,
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        imageColor: ['bg-blue-100', 'bg-slate-100', 'bg-cyan-100', 'bg-gray-100'][Math.floor(Math.random() * 4)]
      };
      setProducts([newProduct, ...products]);
      // 3. Trigger Add Notification
      showNotification("Product added successfully!", "success");
    } else {
      setProducts(products.map(p => p.id === formData.id ? formData : p));
      // 3. Trigger Edit Notification
      showNotification("Product updated successfully!", "success");
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
        // 3. Trigger Delete Notification
        showNotification("Product deleted from inventory.", "error");
    }
  };

  return (
    <div className="min-h-screen mt-4 p-2 font-sans">
      
      <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto px-4 lg:px-0">
        
        {/* === LEFT COLUMN: MAIN PRODUCT AREA === */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit"
        >
            
          {/* 1. HEADER & ACTIONS */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className={`p-2 ${THEME_BG} rounded-lg shadow-lg shadow-blue-900/20`}
              >
                <Glasses className="text-white" size={24} />
              </motion.div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Product Inventory</h1>
                <p className="text-xs text-gray-500">M.T Olaso Optical Clinic</p>
              </div>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openAddModal}
              className={`flex items-center gap-2 ${THEME_BG} ${THEME_HOVER} text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm`}
            >
              <Plus size={16} />
              Add Item
            </motion.button>
          </div>

          {/* 2. FILTERS & SEARCH BAR */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search frames, lenses, accessories..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-slate-50 text-gray-800 focus:outline-none focus:ring-2 ${THEME_RING} transition-all`}
              />
            </div>
            
            <div className="flex gap-2">
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 ${THEME_RING}`}
              >
                <option>All Categories</option>
                <option>Frames</option>
                <option>Lenses</option>
                <option>Contact Lenses</option>
                <option>Solutions</option>
                <option>Accessories</option>
              </select>

              <select 
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
                className={`px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 ${THEME_RING}`}
              >
                <option>Status: All</option>
                <option>In Stock</option>
                <option>Low Stock</option>
                <option>Out of Stock</option>
              </select>

              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? `bg-blue-50 ${THEME_TEXT}` : 'bg-white text-gray-500'}`}
                >
                  <LayoutGrid size={18} />
                </button>
                <div className="w-[1px] bg-gray-200"></div>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? `bg-blue-50 ${THEME_TEXT}` : 'bg-white text-gray-500'}`}
                >
                  <ListIcon size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* 3. PRODUCT GRID */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={viewMode === 'grid' 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
              : "flex flex-col gap-3"
            }
          >
            <AnimatePresence mode="popLayout">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    data={product} 
                    viewMode={viewMode} 
                    onEdit={() => openEditModal(product)} 
                  />
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="col-span-full py-10 text-center text-gray-500"
                >
                  No optical products found matching your filters.
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </motion.div>

        {/* === RIGHT COLUMN: SIDEBAR === */}
        <aside className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
          
          {/* SIDEBAR: INVENTORY LEVELS */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-5 rounded-xl shadow-sm border border-slate-200"
          >
             <div className="flex items-center gap-2 mb-6">
                <div className="p-1.5 bg-blue-50 rounded-md">
                   <Package size={18} className={THEME_TEXT}/>
                </div>
                <h3 className="font-bold text-gray-800">Stock Levels</h3>
             </div>

             <div className="space-y-5">
               {INVENTORY_LEVELS.map((cat, i) => (
                 <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-gray-700">{cat.label}</span>
                      <span className="text-gray-500 text-xs">{cat.current} / {cat.max}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                       <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.percent}%` }}
                        transition={{ duration: 1, delay: 0.3 + (i * 0.1) }}
                        className={`h-full rounded-full ${cat.color}`} 
                       />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{cat.percent}% capacity</p>
                 </div>
               ))}
             </div>
             
             <div className={`mt-6 p-3 bg-blue-50 rounded-lg text-xs ${THEME_TEXT} border border-blue-100`}>
                <span className="font-bold">Summary:</span> Critical low stock on Solutions.
             </div>
          </motion.div>

          {/* SIDEBAR: LOW STOCK ALERTS */}
          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.4 }}
             className="bg-white p-5 rounded-xl shadow-sm border border-slate-200"
          >
             <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-orange-100 rounded-md">
                   <AlertTriangle size={18} className="text-orange-600"/>
                </div>
                <h3 className="font-bold text-gray-800">Restock Alerts</h3>
             </div>
             
             <p className="text-sm text-gray-500 mb-4">{ALERTS.length} items need attention</p>

             <div className="space-y-3">
               {ALERTS.map((item, i) => {
                 const isCritical = item.status === 'critical';
                 return (
                   <motion.div 
                    key={i} 
                    whileHover={{ scale: 1.02 }}
                    className={`p-3 rounded-lg border ${isCritical ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}
                   >
                      <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-semibold text-gray-800 leading-tight">{item.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${isCritical ? 'bg-red-500' : 'bg-orange-500'}`}>
                            {isCritical ? 'CRITICAL' : 'LOW'}
                          </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-3">Only <span className="font-bold">{item.units}</span> units remaining</p>
                      
                      <div className={`w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-bold border transition-colors
                          ${isCritical 
                            ? 'bg-white text-red-600 border-red-200' 
                            : 'bg-white text-orange-600 border-orange-200'}`}>
                          <AlertCircle size={14} aria-hidden="true" />
                          RESTOCK NEEDED
                      </div>
                   </motion.div>
                 );
               })}
             </div>
          </motion.div>

        </aside>
      </div>

      {/* --- ADD/EDIT MODAL --- */}
      <AnimatePresence>
        {isModalOpen && currentProduct && (
          <ProductModal 
            mode={modalMode} 
            product={currentProduct} 
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSaveProduct}
            onDelete={initiateDelete} 
          />
        )}
      </AnimatePresence>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {isDeleteModalOpen && productToDelete && (
          <DeleteConfirmationModal 
              productName={productToDelete.name}
              onCancel={() => {
                  setIsDeleteModalOpen(false);
                  setProductToDelete(null);
              }}
              onConfirm={confirmDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


// --- COMPONENTS ---

// 1. PRODUCT CARD
function ProductCard({ data, viewMode, onEdit }: { data: any, viewMode: 'grid' | 'list', onEdit: () => void }) {
  
  const renderImage = () => {
    if (data.image) {
      return <img src={data.image} alt={data.name} className="w-full h-full object-cover" />;
    }
    return (
      <div className={`w-full h-full ${data.imageColor} flex items-center justify-center`}>
         <Glasses className={`opacity-20 text-[#0B3C8A] w-1/3 h-1/3`} />
      </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <motion.div 
        layout
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="bg-white p-3 rounded-lg border border-gray-200 flex items-center gap-4 hover:shadow-md transition-shadow"
      >
         <div className="w-16 h-16 rounded-md overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center border border-gray-100">
            {data.image ? (
               <img src={data.image} alt={data.name} className="w-full h-full object-cover" />
            ) : (
               <Glasses className="text-gray-300" size={24} />
            )}
         </div>
         <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-800 truncate">{data.name}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
               <span>ID: #{data.id}</span>
               <span>•</span>
               <span className="px-2 py-0.5 bg-slate-100 rounded-full">{data.category}</span>
            </div>
         </div>
         <div className="text-right px-4 border-l border-gray-100">
             <div className={`${THEME_TEXT} font-bold`}>₱{data.price.toLocaleString()}</div>
             <div className="text-xs text-gray-500">Stock: {data.stock}</div>
         </div>
         <button onClick={onEdit} className={`p-2 text-gray-400 hover:${THEME_TEXT} hover:bg-blue-50 rounded-lg transition-colors`}>
            <Edit3 size={18} />
         </button>
      </motion.div>
    );
  }

  // GRID VIEW 
  return (
    <motion.div 
      layout
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }}
      className={`group bg-white rounded-lg border border-gray-200 overflow-hidden transition-all duration-200 flex flex-col`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
         {renderImage()}
         
         {data.stock <= 10 && (
           <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
             {data.stock <= 5 ? 'CRITICAL' : 'LOW STOCK'}
           </div>
         )}
      </div>

      <div className="p-3 flex flex-col flex-1">
         <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-2 min-h-[40px]" title={data.name}>
           {data.name}
         </h3>

         <div className="flex items-center justify-between mb-2">
            <div className={`${THEME_TEXT} font-bold`}>₱{data.price.toLocaleString()}</div>
            <div className="text-[10px] text-gray-500">{data.sold} Sold</div>
         </div>

         <div className="mt-auto">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Stock: {data.stock}</span>
              <span className={THEME_TEXT}>Active</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min(data.stock, 100)}%` }}
                 transition={{ duration: 0.8 }}
                 className={`h-full ${data.stock < 10 ? 'bg-red-500' : THEME_BG}`} 
               />
            </div>

            <button onClick={onEdit} className={`w-full flex items-center justify-center gap-2 py-1.5 rounded border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-blue-50 hover:${THEME_TEXT} hover:border-blue-200 transition-colors`}>
               <Edit3 size={14} />
               Edit
            </button>
         </div>
      </div>
    </motion.div>
  );
}


// 2. PRODUCT MODAL (ADD & EDIT)
function ProductModal({ mode, product, onClose, onSave, onDelete }: any) {
  const [formData, setFormData] = useState(product);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: name === 'price' || name === 'stock' || name === 'sold' ? Number(value) : value
    }));
  };

  const handleImageUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setFormData((prev: any) => ({ ...prev, image: imageUrl }));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div 
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-slate-50">
          <h2 className="text-lg font-bold text-gray-800">
            {mode === 'add' ? 'Add New Item' : 'Edit Item'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable Form Area */}
        <div className="overflow-y-auto p-5">
           <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
             
             {/* Image Upload Section */}
             <div className="flex flex-col items-center justify-center">
               <div 
                 onClick={triggerFileInput}
                 className={`group relative w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 hover:${THEME_BORDER} bg-slate-50 hover:bg-blue-50 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden`}
               >
                  {formData.image ? (
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <UploadCloud className={`text-gray-400 group-hover:${THEME_TEXT} mb-1`} size={24} />
                      <span className={`text-xs text-gray-500 group-hover:${THEME_TEXT} font-medium`}>Upload Photo</span>
                    </>
                  )}
                  
                  {formData.image && (
                     <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit3 className="text-white" size={20} />
                     </div>
                  )}
               </div>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept="image/*"
                 onChange={handleImageUpload} 
               />
               <p className="text-[10px] text-gray-400 mt-2">Product Image (Optional)</p>
             </div>

             {/* Basic Info */}
             <div>
               <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name / Description</label>
               <input 
                 required
                 name="name"
                 value={formData.name}
                 onChange={handleChange}
                 type="text" 
                 className={`w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 ${THEME_RING} focus:outline-none`} 
                 placeholder="e.g., Ray-Ban Aviator Gold"
               />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                   <select 
                     name="category"
                     value={formData.category}
                     onChange={handleChange}
                     className={`w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 ${THEME_RING} focus:outline-none`}
                   >
                      <option>Frames</option>
                      <option>Lenses</option>
                      <option>Contact Lenses</option>
                      <option>Solutions</option>
                      <option>Accessories</option>
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Price (₱)</label>
                   <input 
                     required
                     name="price"
                     value={formData.price}
                     onChange={handleChange}
                     type="number" 
                     min="0"
                     className={`w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 ${THEME_RING} focus:outline-none`} 
                   />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Stock Level</label>
                   <input 
                     required
                     name="stock"
                     value={formData.stock}
                     onChange={handleChange}
                     type="number" 
                     min="0"
                     className={`w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 ${THEME_RING} focus:outline-none`} 
                   />
                </div>
                <div>
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Sold Count</label>
                   <input 
                     name="sold"
                     value={formData.sold}
                     onChange={handleChange}
                     type="number" 
                     min="0"
                     className={`w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 ${THEME_RING} focus:outline-none`} 
                   />
                </div>
             </div>
           </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-slate-50 flex gap-3">
             {mode === 'edit' && (
                <button 
                  type="button" 
                  onClick={() => onDelete(formData.id)}
                  className="p-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete Item"
                >
                  <Trash2 size={18} />
                </button>
             )}
             <button 
                type="button" 
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
             >
                Cancel
             </button>
             <button 
                type="submit" 
                form="product-form"
                className={`flex-1 px-4 py-2 rounded-lg ${THEME_BG} text-white font-medium ${THEME_HOVER} transition-colors flex justify-center items-center gap-2`}
             >
                <Save size={18} />
                {mode === 'add' ? 'Create Item' : 'Save Changes'}
             </button>
        </div>

      </motion.div>
    </div>
  );
}

// 3. DELETE CONFIRMATION MODAL
function DeleteConfirmationModal({ productName, onCancel, onConfirm }: { productName: string, onCancel: () => void, onConfirm: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 text-center"
            >
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="text-red-600" size={24} />
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Product?</h3>
                <p className="text-sm text-gray-500 mb-6">
                    Are you sure you want to delete <span className="font-semibold text-gray-800">"{productName}"</span>? 
                    This action cannot be undone.
                </p>

                <div className="flex gap-3">
                    <button 
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
                    >
                        Yes, Delete
                    </button>
                </div>
            </motion.div>
        </div>
    );
}