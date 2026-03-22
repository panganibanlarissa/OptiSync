"use client";

import React, { useState, useRef, useEffect } from "react";
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
  UploadCloud,
  Save,
  Trash2,
  Clock,
  ArrowRightLeft,
  QrCode,
  Download,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { uploadImage } from "@/services/cloudinary";
import jsQR from "jsqr";
import QRScannerModal from "@/components/QRScannerModal";

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

interface ProductFormData {
  id?: string;
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
  adjustmentReason?: string;
}

interface ProductModalProps {
  mode: 'add' | 'edit' | 'adjust';
  product: ProductFormData;
  onClose: () => void;
  onSave: (data: ProductFormData) => void;
  onDelete: (id: string) => void;
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
    getDeadstockProducts
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

  const lowStockAlerts = getLowStockProducts?.() ?? [];
  const deadstockAlerts = getDeadstockProducts?.() ?? [];
  
  const displayLowStock = lowStockAlerts.slice(0, 3);
  const displayDeadstock = deadstockAlerts.slice(0, 2);

  const filteredProducts = products.filter((product) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = product.name?.toLowerCase().includes(searchLower) || 
                         product.sku?.toLowerCase().includes(searchLower);
    const matchesCategory = selectedCategory === "All Categories" || 
                           product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openAddModal = () => {
    setModalMode('add');
    setCurrentProduct({ 
      sku: "", 
      name: "", 
      category: "Frames", 
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
          reorderPoint: Number(formData.reorderPoint) || 10
        };
        const newProductId: string = await addProduct(newProduct);
        showNotification(`New product "${formData.name}" added to catalog`, "success", "Product Added");
        setIsModalOpen(false);
        // Show QR code modal for new product
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
          reorderPoint: Number(formData.reorderPoint)
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
    const product = products.find(p => p.id === id);
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
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col order-first lg:order-0"
        >
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
                  className="w-full pl-8 sm:pl-9 pr-10 sm:pr-11 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] transition-all text-gray-700 placeholder-gray-400" 
                />
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

          <div 
            className="flex-1 overflow-y-auto p-2 sm:p-5 bg-gray-50/50 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
            style={{ maxHeight: 'calc(100vh - 250px)' }}
          >
            <div 
              key={viewMode}
              className={viewMode === 'grid' 
                ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4" 
                : "flex flex-col gap-2 sm:gap-3"
              }
            >
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    data={product} 
                    viewMode={viewMode} 
                    onEdit={() => openEditModal(product)} 
                    onAdjust={() => openAdjustModal(product)}
                    onQR={() => {
                      setCreatedProductId(product.id);
                    }}
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

        <aside className="w-full lg:w-70 xl:w-75 flex flex-col gap-2 sm:gap-3 lg:gap-4 shrink-0 order-last lg:order-0">
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.1 }} 
            className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 lg:flex lg:flex-col lg:flex-1"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1 sm:p-1.5 bg-red-100 rounded-md">
                <AlertTriangle size={14} className="text-red-600 sm:w-4 sm:h-4"/>
              </div>
              <h3 className="font-bold text-gray-800 text-[11px] sm:text-sm">
                Action Required
              </h3>
            </div>
            
            {displayLowStock.length > 0 ? (
              <div className="space-y-2 sm:space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 pr-1">
                {displayLowStock.map((item) => {
                  const predictedDemand = item.reorderPoint * 2;
                  return (
                    <div key={item.id} className="p-2 sm:p-2.5 rounded-lg border bg-white border-red-100 shadow-sm flex flex-col">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <span className="text-[11px] sm:text-xs font-semibold text-gray-800 leading-tight truncate">
                          {item.name}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                          {item.stock} left
                        </span>
                      </div>
                      <div className="mt-1 sm:mt-1.5 bg-red-50 border border-red-200 rounded px-2 py-1.5 flex items-center justify-between">
                        <span className="text-[9px] text-red-600 font-bold flex items-center gap-1">
                          <AlertTriangle size={10}/> Restock Needed
                        </span>
                        <span className="text-[10px] font-black text-red-700">
                          {predictedDemand} units
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] sm:text-xs text-gray-500">
                All stock levels are healthy.
              </p>
            )}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.2 }} 
            className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 lg:flex lg:flex-col lg:flex-1"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1 sm:p-1.5 bg-slate-100 rounded-md">
                <Clock size={14} className="text-slate-600 sm:w-4 sm:h-4"/>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-[11px] sm:text-sm leading-none">
                  Deadstock Identifier
                </h3>
              </div>
            </div>
            <p className="text-[9px] sm:text-[11px] text-gray-500 mb-3 sm:mb-4 leading-relaxed">
              AI-flagged items with no sales in 30+ days.
            </p>
            
            {displayDeadstock.length > 0 ? (
              <div className="space-y-2 sm:space-y-3 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 pr-1">
                {displayDeadstock.map((item) => (
                  <div key={item.id} className="p-2 sm:p-2.5 rounded-lg border bg-white border-slate-200 shadow-sm flex flex-col">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="text-[11px] sm:text-xs font-semibold text-gray-800 leading-tight pr-2 truncate">
                        {item.name}
                      </span>
                      <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 whitespace-nowrap shrink-0">
                        {item.lastMovedDaysAgo}d
                      </span>
                    </div>
                    <div className="mt-1 sm:mt-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 flex items-center justify-between">
                      <span className="text-[9px] text-slate-600 font-medium flex items-center gap-1">
                        <Clock size={10}/> {item.lastMovedDaysAgo}d Unsold
                      </span>
                      <span className="text-[9px] font-bold text-blue-600 cursor-pointer hover:text-blue-800">
                        Mark Down
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] sm:text-xs text-gray-500">
                No deadstock items identified.
              </p>
            )}
          </motion.div>
        </aside>
      </div>

      <AnimatePresence>
        {isQRScannerOpen && (
          <QRScannerModal
            mode={qrScanMode}
            onClose={() => setIsQRScannerOpen(false)}
            products={products}
            onProductFound={(productId) => {
              const product = products.find(p => p.id === productId);
              if (product) {
                if (qrScanMode === 'search') {
                  // In search mode: populate search query with product name
                  setSearchQuery(product.name);
                  setIsQRScannerOpen(false);
                } else if (qrScanMode === 'adjust') {
                  // In adjust mode: add 1 unit to stock via QR scan
                  const newStock = product.stock + 1;
                  adjustStock(product.id, newStock, "Received via QR Scan").then(() => {
                    showNotification(`+1 unit added to "${product.name}" via QR scan`, "success", "Stock Updated");
                    setIsQRScannerOpen(false);
                  }).catch((error) => {
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
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSaveProduct} 
            onDelete={initiateDelete} 
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

function ProductCard({ data, viewMode, onEdit, onAdjust, onQR }: { 
  data: InventoryData, 
  viewMode: 'grid' | 'list', 
  onEdit: () => void, 
  onAdjust: () => void,
  onQR: () => void 
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
  
  const isDeadstock = data.lastMovedDaysAgo >= 30;
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

function ProductModal({ mode, product, onClose, onSave, onDelete }: ProductModalProps) {
  const [formData, setFormData] = useState<ProductFormData>(product);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(product.image || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showNotification } = useNotification();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'baseCost' || name === 'markupPrice' || name === 'stock' || name === 'leadTimeDays' || name === 'reorderPoint' 
        ? Number(value) 
        : value 
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
    console.log('📸 File selected:', file.name);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { 
    e.preventDefault(); 
    
    try {
      let imageUrl = formData.image;
      
      if (selectedFile) {
        setUploading(true);
        console.log('📤 Uploading image to Cloudinary:', selectedFile.name);
        imageUrl = await uploadImage(selectedFile, 'products');
        console.log('✅ Cloudinary upload successful:', imageUrl);
      }
      
      const dataToSave = {
        ...formData,
        image: imageUrl
      };
      
      await onSave(dataToSave);
      
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      if (showNotification) {
        showNotification("Failed to save product", "error");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(product.image || null);
    onClose();
  };

  const clearSelectedFile = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(product.image || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (mode === 'adjust') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <motion.div 
          variants={modalVariants} 
          initial="hidden" 
          animate="visible" 
          exit="exit" 
          className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
        >
          <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-100 bg-slate-50">
            <h2 className="text-sm sm:text-lg font-bold text-gray-800">Stock Adjustment</h2>
            <button onClick={handleCancel} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <X size={16} className="text-gray-500 sm:w-5 sm:h-5" />
            </button>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-0.5 sm:mb-1">{formData.name}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3 font-mono">SKU: {formData.sku}</p>
            <p className="text-[9px] sm:text-[11px] text-gray-500 mb-4 sm:mb-5 p-2 bg-blue-50 rounded-md border border-blue-100">
              Log deliveries, damaged items, or manual audit counts to correct physical stock.
            </p>
            <form id="stock-form" onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  New Physical Count
                </label>
                <input 
                  required 
                  name="stock" 
                  value={formData.stock || ''} 
                  onChange={handleChange} 
                  type="number" 
                  min="0" 
                  placeholder="0" 
                  className={`w-full px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-sm sm:text-lg font-bold focus:ring-1 ${THEME_RING} focus:outline-none text-gray-700`} 
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  Reason for Adjustment
                </label>
                <select 
                  name="adjustmentReason" 
                  value={formData.adjustmentReason || "Manual Count"} 
                  onChange={handleChange} 
                  className={`w-full px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none text-gray-700`}
                >
                  <option className="text-gray-700">Manual Count / Audit</option>
                  <option className="text-gray-700">Damaged Item</option>
                  <option className="text-gray-700">Return / Exchange</option>
                  <option className="text-gray-700">Restock</option>
                </select>
              </div>
            </form>
          </div>
          <div className="p-3 sm:p-4 border-t border-gray-100 bg-slate-50 flex gap-2 sm:gap-3">
            <button 
              type="button" 
              onClick={handleCancel} 
              className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              form="stock-form" 
              className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg ${THEME_BG} text-white text-[11px] sm:text-sm font-medium ${THEME_HOVER}`}
            >
              Update Stock
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div 
        variants={modalVariants} 
        initial="hidden" 
        animate="visible" 
        exit="exit" 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-100 bg-slate-50">
          <h2 className="text-sm sm:text-lg font-bold text-gray-800">
            {mode === 'add' ? 'Add New Product' : 'Edit Product Details'}
          </h2>
          <button onClick={handleCancel} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={16} className="text-gray-500 sm:w-5 sm:h-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto p-4 sm:p-5">
          <p className="text-[9px] sm:text-[11px] text-gray-500 mb-4 sm:mb-5 text-center px-2 sm:px-4">
            Register new items with precise specs and pricing for accurate AI tracking.
          </p>
          
          <form id="product-form" onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="flex flex-col items-center justify-center mb-2 sm:mb-3">
              <div 
                onClick={() => !uploading && fileInputRef.current?.click()} 
                className={`group relative w-16 h-16 sm:w-24 sm:h-24 rounded-full sm:rounded-lg border-2 border-dashed 
                  ${uploading ? 'border-blue-300 bg-blue-50 cursor-wait' : 'border-gray-300 hover:border-[#0B3C8A] bg-slate-50 hover:bg-blue-50 cursor-pointer'} 
                  flex flex-col items-center justify-center transition-all overflow-hidden`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[8px] mt-1 text-blue-600">Uploading...</span>
                  </div>
                ) : previewUrl ? (
                  previewUrl.startsWith('blob:') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="relative w-full h-full">
                      <Image 
                        src={previewUrl} 
                        alt="Preview" 
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </div>
                  )
                ) : (
                  <UploadCloud className="text-gray-400 w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileSelect} 
                disabled={uploading}
              />
              
              {selectedFile && (
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-[8px] text-blue-600">
                    New image selected: {selectedFile.name}
                  </p>
                  <button
                    type="button"
                    onClick={clearSelectedFile}
                    className="text-[8px] text-red-500 hover:text-red-700"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  Item Name
                </label>
                <input 
                  required 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  type="text" 
                  className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none text-gray-700`} 
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  Category
                </label>
                <select 
                  required 
                  name="category" 
                  value={formData.category} 
                  onChange={handleChange} 
                  className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none text-gray-700`}
                >
                  <option className="text-gray-700">Frames</option>
                  <option className="text-gray-700">Lenses</option>
                  <option className="text-gray-700">Contact Lenses</option>
                  <option className="text-gray-700">Solutions</option>
                  <option className="text-gray-700">Accessories</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  SKU
                </label>
                <input 
                  name="sku" 
                  value={formData.sku} 
                  onChange={handleChange} 
                  type="text" 
                  placeholder="e.g., FRM-001" 
                  className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200 hover:border-gray-300 text-[11px] sm:text-sm focus:border-transparent focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700 placeholder-gray-400 bg-white transition-all`} 
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  Specifications
                </label>
                <input 
                  name="specifications" 
                  value={formData.specifications} 
                  onChange={handleChange} 
                  type="text" 
                  placeholder="e.g., Dimensions: 50-18-140" 
                  className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200 hover:border-gray-300 text-[11px] sm:text-sm focus:border-transparent focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700 placeholder-gray-400 bg-white transition-all`} 
                />
              </div>
            </div>



            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  Cost (₱)
                </label>
                <input 
                  required 
                  name="baseCost" 
                  value={formData.baseCost || ''} 
                  onChange={handleChange} 
                  type="number" 
                  min="0" 
                  step="0.01"
                  placeholder="0" 
                  className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200 hover:border-gray-300 text-[11px] sm:text-sm focus:border-transparent focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700 placeholder-gray-400 bg-white transition-all`} 
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  Price (₱)
                </label>
                <input 
                  required 
                  name="markupPrice" 
                  value={formData.markupPrice || ''} 
                  onChange={handleChange} 
                  type="number" 
                  min="0" 
                  step="0.01"
                  placeholder="0" 
                  className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200 hover:border-gray-300 text-[11px] sm:text-sm focus:border-transparent focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700 placeholder-gray-400 bg-white transition-all`} 
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  Stock
                </label>
                <input 
                  required 
                  name="stock" 
                  value={formData.stock || ''} 
                  onChange={handleChange} 
                  type="number" 
                  min="0" 
                  placeholder="0" 
                  disabled={mode === 'edit'} 
                  className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200 hover:border-gray-300 text-[11px] sm:text-sm focus:border-transparent focus:ring-2 ${THEME_RING} focus:outline-none transition-all ${mode === 'edit' ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' : 'text-gray-700 placeholder-gray-400 bg-white'}`} 
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                Reorder Point
              </label>
              <input 
                name="reorderPoint" 
                value={formData.reorderPoint || 10} 
                onChange={handleChange} 
                type="number" 
                min="1" 
                placeholder="10" 
                className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200 hover:border-gray-300 text-[11px] sm:text-sm focus:border-transparent focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700 placeholder-gray-400 bg-white transition-all`} 
              />
              <p className="text-[8px] text-gray-400 mt-1">
                Alert when stock below this
              </p>
            </div>
          </form>
        </div>
        
        <div className="p-3 sm:p-4 border-t border-gray-100 bg-slate-50 flex gap-2 sm:gap-3">
          {mode === 'edit' && formData.id && (
            <button 
              type="button" 
              onClick={() => onDelete(formData.id!)} 
              className="p-1.5 sm:p-2.5 rounded-md sm:rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors" 
              title="Delete Product"
            >
              <Trash2 size={16} className="sm:w-4.5 sm:h-4.5"/>
            </button>
          )}
          <button 
            type="button" 
            onClick={handleCancel} 
            className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="product-form" 
            disabled={uploading}
            className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg ${uploading ? 'bg-blue-400 cursor-wait' : THEME_BG + ' ' + THEME_HOVER} text-white text-[11px] sm:text-sm font-medium transition-colors flex justify-center items-center gap-1.5 sm:gap-2`}
          >
            {uploading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Uploading...
              </>
            ) : (
              <>
                <Save size={14} className="sm:w-4.5 sm:h-4.5"/> 
                {mode === 'add' ? 'Save' : 'Update'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteConfirmationModal({ productName, onCancel, onConfirm }: { 
  productName: string, 
  onCancel: () => void, 
  onConfirm: () => void 
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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

  // Create unique QR code data by including both product ID and name
  const qrValue = `${window.location.origin}/inventory?product=${productId}&name=${encodeURIComponent(productName)}`;

  const downloadQRCode = async () => {
    try {
      // Using a QR code generation API since we can't use canvas directly in this context
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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