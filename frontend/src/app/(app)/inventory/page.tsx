"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNotification } from "@/components/NotificationProvider"; 
import { useFirebase } from "@/context/FirebaseContext";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Image from "next/image";
import {
  Search,
  Plus,
  LayoutGrid,
  List as ListIcon,
  Edit3,
  AlertTriangle,
  Glasses,
  X,
  Clock,
  ArrowRightLeft,
  QrCode,
  Download,
  Trash2,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import QRScannerModal from "@/components/QRScannerModal";
import ProductModal, { ProductFormData } from "@/components/ProductModal";

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";
const THEME_RING = "focus:ring-[#0B3C8A]";

interface InventoryData {
  id: string;
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
  totalSold?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  reorderPoint: number;
  category: string;
  lastMovedDaysAgo: number;
  markupPrice: number;
  baseCost: number;
}

interface DeadstockItem {
  id: string;
  name: string;
  stock: number;
  lastMovedDaysAgo: number;
  daysSinceSale: number;
  category: string;
  markupPrice: number;
  baseCost: number;
  lastSaleDate: Date | null;
  lockedCapital: number;
}

const modalVariants: Variants = { 
  hidden: { opacity: 0, scale: 0.95 }, 
  visible: { opacity: 1, scale: 1 }, 
  exit: { opacity: 0, scale: 0.95 } 
};

const IMAGE_COLORS = [
  'bg-blue-100',
  'bg-slate-100',
  'bg-cyan-100',
  'bg-gray-100',
  'bg-emerald-100',
  'bg-amber-100',
  'bg-indigo-100',
  'bg-purple-100',
  'bg-pink-100',
  'bg-orange-100'
];

export default function InventoryPage() {
  const { 
    products: firebaseProducts, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    adjustStock, 
    loading,
    getLowStockProducts,
    userRole,
    transactions
  } = useFirebase();
  
  const [products, setProducts] = useState<InventoryData[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'adjust'>('add');
  const [currentProduct, setCurrentProduct] = useState<ProductFormData | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<InventoryData | null>(null);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [qrScanMode, setQRScanMode] = useState<'search' | 'adjust'>('search');
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);

  const { showNotification } = useNotification();

  useEffect(() => {
    setProducts(firebaseProducts);
  }, [firebaseProducts]);

  // Get low stock alerts (products below reorder point)
  const lowStockAlerts = (getLowStockProducts?.() ?? []) as LowStockItem[];
  
  // Products that need reordering
  const reorderNeededProducts = useMemo(() => {
    return lowStockAlerts;
  }, [lowStockAlerts]);
  
  // Helper function to safely get date from Firestore Timestamp
  const getDateFromTimestamp = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    if (typeof timestamp === 'object' && timestamp.toDate) {
      return timestamp.toDate();
    }
    
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    
    return null;
  };
  
  // Calculate deadstock using the SAME logic as Admin Dashboard
  const deadstockAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    
    const deadstockItems = products
      .filter(p => p.stock > 0)
      .map(p => {
        const salesForProduct = completedTransactions
          .filter(t => t.items.some(item => item.id === p.id))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const lastSale = salesForProduct[0];
        
        let daysSinceSale = 0;
        let lastSaleDate: Date | null = null;
        
        if (lastSale) {
          lastSaleDate = new Date(lastSale.date);
          lastSaleDate.setHours(0, 0, 0, 0);
          daysSinceSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          // If no sales, use createdAt date
          const createdDate = getDateFromTimestamp((p as any).createdAt);
          
          if (createdDate) {
            createdDate.setHours(0, 0, 0, 0);
            daysSinceSale = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            // If no createdAt, use lastMovedDaysAgo field or default to 0
            daysSinceSale = p.lastMovedDaysAgo || 0;
          }
          lastSaleDate = null;
        }
        
        const lockedCapital = p.markupPrice * p.stock;
        
        return {
          id: p.id,
          name: p.name,
          stock: p.stock,
          lastMovedDaysAgo: p.lastMovedDaysAgo || daysSinceSale,
          daysSinceSale,
          category: p.category,
          markupPrice: p.markupPrice,
          baseCost: p.baseCost,
          lastSaleDate,
          lockedCapital
        };
      })
      .filter(item => item.daysSinceSale >= 30)
      .sort((a, b) => b.lockedCapital - a.lockedCapital);
    
    return deadstockItems as DeadstockItem[];
  }, [products, transactions]);
  
  // Create a Set of deadstock product IDs for quick lookup in ProductCard
  const deadstockProductIds = useMemo(() => {
    return new Set(deadstockAlerts.map(item => item.id));
  }, [deadstockAlerts]);
  
  // Display all items
  const displayActionRequired = reorderNeededProducts;
  const displayDeadstock = deadstockAlerts;

  const filteredProducts = products.filter((product: InventoryData) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = product.name?.toLowerCase().includes(searchLower) || 
                         product.sku?.toLowerCase().includes(searchLower);
    const matchesCategory = selectedCategory === "All Categories" || 
                           product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openAddModal = () => {
    const categoryDefaults: Record<string, string> = {
      "Frames": "FRM",
      "Lenses": "LNS",
      "Contact Lenses": "CTL",
      "Solutions": "SOL",
      "Accessories": "ACC"
    };
    
    const defaultCategory = "Frames";
    const prefix = categoryDefaults[defaultCategory] || "ITM";
    const count = products.filter(p => p.category === defaultCategory).length + 1;
    const generatedSku = `${prefix}-${count.toString().padStart(2, '0')}`;

    setModalMode('add');
    setCurrentProduct({ 
      sku: generatedSku, 
      name: "", 
      category: defaultCategory, 
      specifications: "", 
      baseCost: 0, 
      markupPrice: 0, 
      supplierInfo: "", 
      stock: 0, 
      lastMovedDaysAgo: 0, 
      imageColor: IMAGE_COLORS[Math.floor(Math.random() * IMAGE_COLORS.length)],
      image: null, 
      leadTimeDays: 7, 
      reorderPoint: 10 
    });
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

  const handleSaveProduct = async (formData: ProductFormData) => {
    try {
      if (modalMode === 'add') {
        const newProduct = {
          sku: formData.sku,
          name: formData.name,
          category: formData.category,
          specifications: formData.specifications,
          baseCost: Number(formData.baseCost),
          markupPrice: Number(formData.markupPrice),
          supplierInfo: formData.supplierInfo,
          stock: Number(formData.stock),
          lastMovedDaysAgo: 0,
          imageColor: formData.imageColor || IMAGE_COLORS[Math.floor(Math.random() * IMAGE_COLORS.length)],
          image: formData.image || null,
          leadTimeDays: Number(formData.leadTimeDays) || 7,
          reorderPoint: Number(formData.reorderPoint) || 10,
          expiryDate: formData.expiryDate || null
        };
        const newProductId: string = await addProduct(newProduct);
        showNotification(`New product "${formData.name}" added to catalog`, "success", "Product Added");
        setIsModalOpen(false);
        if (newProductId) {
          setCreatedProductId(newProductId);
        }
      } else if (modalMode === 'edit' && formData.id) {
        await updateProduct(formData.id, {
          sku: formData.sku,
          name: formData.name,
          category: formData.category,
          specifications: formData.specifications,
          baseCost: Number(formData.baseCost),
          markupPrice: Number(formData.markupPrice),
          supplierInfo: formData.supplierInfo,
          stock: Number(formData.stock),
          image: formData.image,
          imageColor: formData.imageColor,
          leadTimeDays: Number(formData.leadTimeDays),
          reorderPoint: Number(formData.reorderPoint),
          expiryDate: formData.expiryDate || null
        });
        showNotification(`Product "${formData.name}" updated successfully`, "success", "Product Updated");
      } else if (modalMode === 'adjust' && formData.id) {
        await adjustStock(formData.id, Number(formData.stock), formData.adjustmentReason || "Manual adjustment");
        showNotification(`Stock adjusted for ${formData.name}`, "success", "Stock Updated");
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving product:", error);
      showNotification("Failed to save product. Please try again.", "error", "Error");
    }
  };

  const initiateDelete = (id: string) => {
    const product = products.find((p: InventoryData) => p.id === id);
    if (product) {
      setProductToDelete(product);
      setIsModalOpen(false);
      setIsDeleteModalOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await deleteProduct(productToDelete.id);
        setProductToDelete(null);
        setIsDeleteModalOpen(false);
        showNotification(`Product "${productToDelete.name}" deleted from inventory`, "info", "Product Deleted");
      } catch (error) {
        console.error("Error deleting product:", error);
        showNotification("Failed to delete product.", "error", "Error");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full font-sans p-2 sm:p-4 box-border">
      <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 lg:gap-4 w-full">
        {/* LEFT COLUMN - PRODUCT CATALOG */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="shrink-0 p-3 sm:p-5 border-b border-gray-100 bg-slate-50 flex flex-col gap-3">
            <div className="flex flex-row justify-between items-center gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <motion.div 
                  whileHover={{ scale: 1.05 }} 
                  className={`hidden sm:flex p-2 ${THEME_BG} rounded-lg shadow-lg shadow-blue-900/20`}
                >
                  <Glasses className="text-white" size={18} />
                </motion.div>
                <div>
                  <h1 className="text-sm sm:text-lg font-bold text-gray-800 leading-tight">
                    Inventory Catalog
                  </h1>
                  <p className="text-[9px] sm:text-[11px] text-gray-500 hidden sm:block">
                    Track real-time stock, pricing, and specs.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <motion.button 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }} 
                    onClick={() => {
                      setQRScanMode('adjust');
                      setIsQRScannerOpen(true);
                    }} 
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 border border-[#0B3C8A] hover:border-blue-400 bg-blue-50 text-[#0B3C8A] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors shadow-sm hover:bg-blue-200`}
                    title="Scan QR Code to add stock"
                  >
                    <QrCode size={14} /> 
                    <span className="hidden sm:inline">Scan QR</span>
                    <span className="sm:hidden">Scan</span>
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }} 
                    onClick={openAddModal} 
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 ${THEME_BG} ${THEME_HOVER} text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors shadow-sm`}
                  >
                    <Plus size={14} /> 
                    <span className="hidden sm:inline">Add Product</span>
                    <span className="sm:hidden">Add</span>
                  </motion.button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search SKU or Item..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full pl-8 sm:pl-9 pr-20 sm:pr-24 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] transition-all text-gray-700 placeholder-gray-400" 
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-12 sm:right-14 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
                <button 
                  onClick={() => {
                    setQRScanMode('search');
                    setIsQRScannerOpen(true);
                  }}
                  className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0B3C8A] transition-colors p-1"
                  title="Scan QR code to search product"
                >
                  <QrCode size={14} />
                </button>
              </div>
              <div className="flex gap-1.5 sm:gap-2">
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)} 
                  className={`px-2 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 bg-white text-gray-700 text-[10px] sm:text-sm focus:outline-none focus:ring-1 ${THEME_RING} flex-1 sm:flex-none`}
                >
                  <option>All Categories</option>
                  <option>Frames</option>
                  <option>Lenses</option>
                  <option>Contact Lenses</option>
                  <option>Solutions</option>
                  <option>Accessories</option>
                </select>
                <div className="flex border border-gray-300 rounded-md sm:rounded-lg overflow-hidden shrink-0">
                  <button 
                    onClick={() => setViewMode('grid')} 
                    className={`px-2 ${viewMode === 'grid' ? `bg-blue-50 ${THEME_TEXT}` : 'bg-white text-gray-500'}`}
                  >
                    <LayoutGrid size={14} />
                  </button>
                  <div className="w-px bg-gray-300"></div>
                  <button 
                    onClick={() => setViewMode('list')} 
                    className={`px-2 ${viewMode === 'list' ? `bg-blue-50 ${THEME_TEXT}` : 'bg-white text-gray-500'}`}
                  >
                    <ListIcon size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PRODUCT GRID */}
          <div 
            className="flex-1 overflow-y-auto p-2 sm:p-5 bg-gray-50/50 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
          >
            <div 
              key={viewMode}
              className={viewMode === 'grid' 
                ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4" 
                : "flex flex-col gap-2 sm:gap-3"
              }
            >
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product: InventoryData) => (
                  <ProductCard 
                    key={product.id} 
                    data={product} 
                    viewMode={viewMode} 
                    onEdit={() => openEditModal(product)} 
                    onAdjust={() => openAdjustModal(product)}
                    onQR={() => {
                      setCreatedProductId(product.id);
                    }}
                    userRole={userRole}
                    isDeadstock={deadstockProductIds.has(product.id)}
                  />
                ))
              ) : (
                <div className="col-span-full py-10 text-center text-gray-500 text-xs sm:text-sm">
                  No products found.
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* RIGHT COLUMN - SIDEBAR ALERTS */}
        <aside className="w-full lg:w-70 xl:w-75 flex flex-col gap-2 sm:gap-3 lg:gap-4 shrink-0">
          
          {/* ACTION REQUIRED SECTION */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.1 }} 
            className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col shrink-0"
          >
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <div className="p-1 sm:p-1.5 bg-red-100 rounded-md">
                <AlertTriangle size={14} className="text-red-600 sm:w-4 sm:h-4"/>
              </div>
              <h3 className="font-bold text-gray-800 text-[11px] sm:text-sm">
                Action Required
              </h3>
              {displayActionRequired.length > 0 && (
                <span className="ml-auto text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {displayActionRequired.length}
                </span>
              )}
            </div>
            <p className="text-[9px] sm:text-[11px] text-gray-500 mb-2 shrink-0">
              Products below reorder point.
            </p>
            
            <div className="space-y-2 sm:space-y-3">
              {displayActionRequired.length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  {displayActionRequired.map((item: LowStockItem) => {
                    const neededToRestock = Math.max(0, item.reorderPoint - item.stock);
                    return (
                      <div key={item.id} className="p-2 sm:p-2.5 rounded-lg border bg-white border-red-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <span className="text-[11px] sm:text-xs font-semibold text-gray-800 leading-tight truncate flex-1">
                            {item.name}
                          </span>
                          <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                            {item.stock} left
                          </span>
                        </div>
                        <div className="mt-1 sm:mt-1.5 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-red-600 font-bold flex items-center gap-1">
                              <AlertTriangle size={10}/> Reorder Point: {item.reorderPoint}
                            </span>
                            <span className="text-[9px] font-semibold text-red-700">
                              {item.stock <= item.reorderPoint ? 'BELOW THRESHOLD' : 'OK'}
                            </span>
                          </div>
                          {neededToRestock > 0 && (
                            <div className="flex items-center justify-between pt-1 border-t border-red-100">
                              <span className="text-[8px] text-gray-500">Needed to restock:</span>
                              <span className="text-[9px] font-bold text-blue-600">
                                {neededToRestock} units
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    All stock levels are healthy.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* DEADSTOCK SECTION */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.2 }} 
            className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col shrink-0"
          >
            <div className="flex items-center gap-2 mb-1 shrink-0">
              <div className="p-1 sm:p-1.5 bg-slate-100 rounded-md">
                <Clock size={14} className="text-slate-600 sm:w-4 sm:h-4"/>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 text-[11px] sm:text-sm leading-none">
                  Deadstock Identifier
                </h3>
              </div>
              {displayDeadstock.length > 0 && (
                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {displayDeadstock.length}
                </span>
              )}
            </div>
            <p className="text-[9px] sm:text-[11px] text-gray-500 mb-3 shrink-0">
              AI-flagged items with no sales in 30+ days.
            </p>
            
            <div className="space-y-2 sm:space-y-3">
              {displayDeadstock.length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  {displayDeadstock.map((item: DeadstockItem) => {
                    const priority = item.daysSinceSale > 90 ? 'high' : item.daysSinceSale > 60 ? 'medium' : 'low';
                    const priorityColor = priority === 'high' ? 'red' : priority === 'medium' ? 'orange' : 'blue';
                    
                    return (
                      <div key={item.id} className="p-2 sm:p-2.5 rounded-lg border bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <span className="text-[11px] sm:text-xs font-semibold text-gray-800 leading-tight pr-2 truncate flex-1">
                            {item.name}
                          </span>
                          <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded bg-${priorityColor}-100 text-${priorityColor}-700 whitespace-nowrap shrink-0`}>
                            {item.daysSinceSale}d
                          </span>
                        </div>
                        <div className="mt-1 sm:mt-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-slate-600 font-medium flex items-center gap-1">
                              <Clock size={10}/> {item.daysSinceSale}d Unsold
                            </span>
                            <span className="text-[9px] font-bold text-gray-700">
                              ₱{item.lockedCapital.toLocaleString()}
                            </span>
                          </div>
                          {item.lastSaleDate && (
                            <div className="text-[8px] text-gray-400 mt-1">
                              Last sold: {item.lastSaleDate.toLocaleDateString()}
                            </div>
                          )}
                          {!item.lastSaleDate && (
                            <div className="text-[8px] text-gray-400 mt-1">
                              Never sold
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    No deadstock items identified.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </aside>
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {isQRScannerOpen && (
          <QRScannerModal
            mode={qrScanMode}
            onClose={() => setIsQRScannerOpen(false)}
            products={products}
            onProductFound={(productId: string) => {
              const product = products.find((p: InventoryData) => p.id === productId);
              if (product) {
                if (qrScanMode === 'search') {
                  setSearchQuery(product.name);
                  setIsQRScannerOpen(false);
                } else if (qrScanMode === 'adjust') {
                  const newStock = product.stock + 1;
                  adjustStock(product.id, newStock, "Received via QR Scan").then(() => {
                    showNotification(`+1 unit added to "${product.name}" via QR scan`, "success", "Stock Updated");
                    setIsQRScannerOpen(false);
                  }).catch((error: Error) => {
                    console.error("Error adjusting stock:", error);
                    showNotification(`Failed to add stock for "${product.name}"`, "error", "Error");
                  });
                }
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createdProductId && (
          <QRCodeModal
            productId={createdProductId}
            productName={currentProduct?.name || "Product"}
            onClose={() => setCreatedProductId(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && currentProduct && (
          <ProductModal 
            mode={modalMode} 
            product={currentProduct} 
            products={products}
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSaveProduct} 
            onDelete={initiateDelete}
            userRole={userRole}
          />
        )}
      </AnimatePresence>

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

function ProductCard({ data, viewMode, onEdit, onAdjust, onQR, userRole, isDeadstock }: { 
  data: InventoryData, 
  viewMode: 'grid' | 'list', 
  onEdit: () => void, 
  onAdjust: () => void,
  onQR: () => void,
  userRole?: string | null,
  isDeadstock?: boolean
}) {
  const renderImage = () => {
    const isOutOfStock = data.stock <= 0;
    
    if (data.image && !data.image.startsWith('blob:')) {
      return (
        <div className="relative w-full h-full">
          <Image 
            src={data.image} 
            alt={data.name} 
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className={`object-cover transition-all duration-300 ${
              isOutOfStock ? 'opacity-50 grayscale' : ''
            }`}
          />
        </div>
      );
    }
    
    return (
      <div className={`w-full h-full ${data.imageColor} flex items-center justify-center transition-colors duration-300`}>
        <Glasses className={`opacity-20 ${isOutOfStock ? 'text-gray-500' : 'text-[#0B3C8A]'} w-1/3 h-1/3`} />
      </div>
    );
  };
  
  const isLowStock = data.stock <= data.reorderPoint && data.stock > 0;
  const isOutOfStock = data.stock <= 0;

  if (viewMode === 'list') {
    return (
      <div className={`bg-white p-2 sm:p-3 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 hover:shadow-md transition-shadow`}>
        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto flex-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center border border-gray-100">
            {renderImage()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 text-[11px] sm:text-sm truncate">
              {data.name}
            </h3>
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] text-gray-500 mt-0.5">
              <span className="font-mono text-gray-400">{data.sku}</span>
              {data.sku && data.specifications && <span className="hidden sm:inline">•</span>}
              {data.specifications && (
                <span className="truncate">Specs: {data.specifications}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2 sm:gap-3 mt-1 sm:mt-0 sm:pl-3 sm:border-l border-gray-100">
          <div className="text-left sm:text-right">
            <div className={`${THEME_TEXT} font-bold text-xs sm:text-sm`}>
              ₱{data.markupPrice.toLocaleString()}
            </div>
            <div className="text-[9px] sm:text-[11px] text-gray-500 font-semibold">
              Stock: {data.stock}
            </div>
          </div>
          <div className="flex flex-row sm:flex-col gap-1">
            <button 
              onClick={onAdjust} 
              className="px-2 py-1 text-[9px] sm:text-[10px] font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded transition-colors flex items-center justify-center gap-1"
            >
              <ArrowRightLeft size={10}/> Adjust
            </button>
            <button 
              onClick={onEdit} 
              className={`px-2 py-1 text-[9px] sm:text-[10px] font-semibold text-gray-600 border border-gray-200 hover:${THEME_TEXT} hover:border-blue-200 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1`}
            >
              <Edit3 size={10}/> Edit
            </button>
            <button 
              onClick={onQR} 
              className="px-2 py-1 text-[9px] sm:text-[10px] font-semibold text-gray-600 border border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 rounded transition-colors flex items-center justify-center gap-1"
            >
              <QrCode size={10}/> QR
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col`}>
      <div className="relative aspect-4/3 sm:aspect-square w-full overflow-hidden bg-slate-50">
        {renderImage()}
        <div className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur text-gray-600 text-[8px] sm:text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-10">
          {data.sku}
        </div>
        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 items-end z-10">
          {isLowStock && (
            <span className="bg-orange-500 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
              LOW
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-red-500 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
              OUT
            </span>
          )}
          {isDeadstock && !isOutOfStock && (
            <span className="bg-slate-700 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
              <Clock size={8}/> DEAD
            </span>
          )}
        </div>
      </div>
      <div className="p-2 sm:p-3 flex flex-col flex-1">
        <h3 className="text-[11px] sm:text-xs font-semibold text-gray-800 line-clamp-2 mb-1 sm:mb-1.5 min-h-8 sm:min-h-9 leading-snug" title={data.name}>
          {data.name}
        </h3>
        {data.specifications && (
          <p className="text-[9px] sm:text-[10px] text-gray-500 mb-2 truncate" title={data.specifications}>
            Specs: {data.specifications}
          </p>
        )}
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div>
            <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-bold">Retail</div>
            <div className={`${THEME_TEXT} font-bold text-[11px] sm:text-sm leading-tight`}>
              ₱{data.markupPrice.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-bold">Cost</div>
            <div className="text-gray-600 font-semibold text-[10px] sm:text-xs leading-tight">
              ₱{data.baseCost.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="mt-auto pt-1.5 sm:pt-2 border-t border-gray-100">
          <div className="flex justify-between items-center mb-1.5 sm:mb-2">
            <span className="text-[9px] sm:text-[10px] font-medium text-gray-500">Stock:</span>
            <span className={`text-[11px] sm:text-xs font-bold ${isLowStock ? 'text-orange-600' : isOutOfStock ? 'text-red-600' : 'text-gray-800'}`}>
              {data.stock}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
            <button 
              onClick={onAdjust} 
              className="w-full flex items-center justify-center gap-1 py-1 sm:py-1.5 rounded border border-gray-200 text-gray-600 text-[9px] sm:text-[10px] font-semibold hover:bg-gray-50 transition-colors"
            >
              <ArrowRightLeft size={10} className="sm:w-3 sm:h-3"/> Adjust
            </button>
            <button 
              onClick={onEdit} 
              className={`w-full flex items-center justify-center gap-1 py-1 sm:py-1.5 rounded border border-gray-200 text-gray-600 text-[9px] sm:text-[10px] font-semibold hover:bg-blue-50 hover:${THEME_TEXT} hover:border-blue-200 transition-colors`}
            >
              <Edit3 size={10} className="sm:w-3 sm:h-3"/> Edit
            </button>
            <button 
              onClick={onQR} 
              className="w-full flex items-center justify-center gap-1 py-1 sm:py-1.5 rounded border border-gray-200 text-gray-600 text-[9px] sm:text-[10px] font-semibold hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
            >
              <QrCode size={10} className="sm:w-3 sm:h-3"/> QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmationModal({ productName, onCancel, onConfirm }: { 
  productName: string, 
  onCancel: () => void, 
  onConfirm: () => void 
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div 
        variants={modalVariants} 
        initial="hidden" 
        animate="visible" 
        exit="exit" 
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-4 sm:p-6 text-center"
      >
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
          <Trash2 className="text-red-600 w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <h3 className="text-sm sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">
          Delete Product?
        </h3>
        <p className="text-[10px] sm:text-sm text-gray-500 mb-4 sm:mb-6">
          Are you sure you want to delete <span className="font-semibold text-gray-800">&quot;{productName}&quot;</span>? 
          This action cannot be undone.
        </p>
        <div className="flex gap-2 sm:gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-red-600 text-white text-[11px] sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
          >
            Yes, Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function QRCodeModal({ productId, productName, onClose }: {
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const qrRef = useRef<HTMLDivElement>(null);

  const qrValue = `${window.location.origin}/inventory?product=${productId}&name=${encodeURIComponent(productName)}`;

  const downloadQRCode = async () => {
    try {
      const qrImage = await fetch(
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrValue)}`
      );
      
      if (!qrImage.ok) throw new Error('Failed to generate QR code');
      
      const blob = await qrImage.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${productName.replace(/\s+/g, '_')}_QR.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-slate-50">
          <h2 className="text-sm sm:text-lg font-bold text-gray-800 truncate pr-2">
            {productName} - QR Code
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0">
            <X size={16} className="text-gray-500 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8 flex flex-col items-center gap-4">
          <div ref={qrRef} className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrValue)}`}
              alt={`QR Code for ${productName}`}
              className="w-64 h-64"
            />
          </div>

          <p className="text-xs sm:text-sm font-semibold text-gray-700 text-center">
            {productName}
          </p>

          <p className="text-[10px] sm:text-xs text-gray-500 text-center px-2">
            Scan this QR code to quickly add stock or edit this product
          </p>

          <div className="text-[9px] sm:text-[10px] text-gray-400 bg-gray-50 p-2 sm:p-3 rounded text-center font-mono break-all w-full">
            ID: {productId}
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-gray-100 bg-slate-50 flex gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={downloadQRCode}
            className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg ${THEME_BG} ${THEME_HOVER} text-white text-[11px] sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 sm:gap-2`}
          >
            <Download size={14} className="sm:w-4 sm:h-4" />
            Download QR
          </button>
        </div>
      </motion.div>
    </div>
  );
}