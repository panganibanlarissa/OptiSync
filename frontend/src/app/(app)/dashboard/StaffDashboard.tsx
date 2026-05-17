// src/app/(app)/dashboard/StaffDashboard.tsx

"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { useFirebase } from "@/context/FirebaseContext";
import { useNotification } from "@/components/NotificationProvider";
import QRScannerModal from "@/components/QRScannerModal";
import {
  AlertTriangle,
  Package,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Banknote,
  BarChart3,
  Database,
  ShoppingBag,
  Clock,
  QrCode,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  PieChart,
  History,
  Eye
} from "lucide-react";
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";

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

interface RecentlyAddedItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  dateAdded: Date;
  status: 'in_stock' | 'low_stock';
}

interface TransactionItem {
  id: string;
  date: Date;
  items: number;
  total: number;
  type: 'sale' | 'return';
}

interface LowStockItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  status: 'critical' | 'low';
}

interface CategoryStockData {
  name: string;
  stock: number;
  percentage: number;
  color: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: {
    y: 20,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Frames': '#0B3C8A',
  'Lenses': '#10B981',
  'Contact Lenses': '#8B5CF6',
  'Solutions': '#F59E0B',
  'Accessories': '#EF4444',
  'Unknown': '#6B7280'
};

// Helper function to get batches for a product
const getProductBatches = async (productId: string): Promise<any[]> => {
  try {
    const batchesRef = collection(db, `clinics/${CLINIC_ID}/products/${productId}/batches`);
    const q = query(batchesRef, orderBy("expiryDate", "asc"));
    const snapshot = await getDocs(q);
    
    const batches: any[] = [];
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (data.isActive !== false) {
        batches.push({
          id: docSnapshot.id,
          batchSku: data.batchSku,
          expiryDate: data.expiryDate,
          stock: data.stock,
          totalSold: data.totalSold || 0,
          damageExchanged: data.damageExchanged || 0,
          restockCount: data.restockCount || 0,
          beginningInventory: data.beginningInventory || data.initialStock || 0,
          ...data
        });
      }
    });
    return batches;
  } catch (error) {
    console.error("Error fetching batches:", error);
    return [];
  }
};

// Helper function to update batch stock
const updateBatchStock = async (
  batchId: string,
  newStock: number,
  reason: string,
  staffName: string,
  staffId: string
): Promise<void> => {
  try {
    // Find which product this batch belongs to
    const productsRef = collection(db, `clinics/${CLINIC_ID}/products`);
    const productsSnapshot = await getDocs(productsRef);
    
    let productId: string | null = null;
    let batch: any = null;
    
    for (const productDoc of productsSnapshot.docs) {
      const batchRef = doc(db, `clinics/${CLINIC_ID}/products/${productDoc.id}/batches`, batchId);
      const batchDoc = await getDoc(batchRef);
      
      if (batchDoc.exists()) {
        productId = productDoc.id;
        batch = { id: batchDoc.id, ...batchDoc.data() };
        break;
      }
    }
    
    if (!productId || !batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }
    
    const oldStock = batch.stock;
    const stockDifference = newStock - oldStock;
    const reasonLower = reason.toLowerCase();
    
    const batchUpdateData: any = {
      stock: newStock,
      updatedAt: serverTimestamp()
    };
    
    // Determine if this is a restock or damaged operation
    const isRestock = stockDifference > 0 && (
      reasonLower.includes('restock') ||
      reasonLower.includes('received') ||
      reasonLower.includes('scan in')
    );
    
    const isDamaged = stockDifference < 0 && (
      reasonLower.includes('damaged') ||
      reasonLower.includes('damage') ||
      reasonLower.includes('waste') ||
      reasonLower.includes('scan out')
    );
    
    // Update batch's own counters
    if (isRestock && stockDifference > 0) {
      const unitsAdded = stockDifference;
      batchUpdateData.restockCount = (batch.restockCount || 0) + unitsAdded;
      console.log(`📦 Batch ${batch.batchSku} restockCount updated: +${unitsAdded}`);
    }
    
    if (isDamaged && stockDifference < 0) {
      const unitsRemoved = Math.abs(stockDifference);
      batchUpdateData.damageExchanged = (batch.damageExchanged || 0) + unitsRemoved;
      console.log(`⚠️ Batch ${batch.batchSku} damageExchanged updated: +${unitsRemoved}`);
    }
    
    // Update the batch
    const batchRef = doc(db, `clinics/${CLINIC_ID}/products/${productId}/batches`, batchId);
    await updateDoc(batchRef, batchUpdateData);
    
    // Update parent product's total stock
    const updatedBatches = await getProductBatches(productId);
    const totalStock = updatedBatches.reduce((sum, b) => sum + b.stock, 0);
    
    const productRef = doc(db, `clinics/${CLINIC_ID}/products`, productId);
    await updateDoc(productRef, {
      stock: totalStock,
      updatedAt: serverTimestamp()
    });
    
    // Update parent counters if needed
    const productUpdateData: any = {};
    if (isRestock && stockDifference > 0) {
      const productDoc = await getDoc(productRef);
      const currentRestockCount = productDoc.data()?.restockCount || 0;
      productUpdateData.restockCount = currentRestockCount + Math.abs(stockDifference);
    }
    
    if (isDamaged && stockDifference < 0) {
      const productDoc = await getDoc(productRef);
      const currentDamageCount = productDoc.data()?.damageExchanged || 0;
      productUpdateData.damageExchanged = currentDamageCount + Math.abs(stockDifference);
    }
    
    if (Object.keys(productUpdateData).length > 0) {
      await updateDoc(productRef, productUpdateData);
    }
    
    console.log(`✅ Batch ${batch.batchSku} updated: Stock ${oldStock} → ${newStock}`);
    
  } catch (error) {
    console.error("Error updating batch stock:", error);
    throw error;
  }
};

export default function StaffDashboard() {
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<'in' | 'out'>('in');
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [pendingScanInProduct, setPendingScanInProduct] = useState<{ 
    id: string; 
    name: string; 
    sku: string; 
    stock: number;
    batchId?: string;
    batchSku?: string;
    isBatch?: boolean;
  } | null>(null);
  const [pendingScanOutProduct, setPendingScanOutProduct] = useState<{ 
    id: string; 
    name: string; 
    sku: string; 
    stock: number;
    batchId?: string;
    batchSku?: string;
    isBatch?: boolean;
  } | null>(null);
  const [scanInQuantity, setScanInQuantity] = useState("1");
  const [scanOutQuantity, setScanOutQuantity] = useState("1");
  const [isApplyingScanIn, setIsApplyingScanIn] = useState(false);
  const [isApplyingScanOut, setIsApplyingScanOut] = useState(false);
  
  const { products, transactions, adjustStock, userRole, userName, userId } = useFirebase();
  const { showNotification } = useNotification();

  const completedTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'completed');
  }, [transactions]);

  // Calculate category stock distribution for pie chart
  const categoryStockData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    
    products.forEach(product => {
      if (product.stock > 0) {
        const current = categoryMap.get(product.category) || 0;
        categoryMap.set(product.category, current + product.stock);
      }
    });
    
    const totalStock = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0);
    
    const data: CategoryStockData[] = Array.from(categoryMap.entries())
      .map(([name, stock]) => ({
        name,
        stock,
        percentage: totalStock > 0 ? (stock / totalStock) * 100 : 0,
        color: CATEGORY_COLORS[name] || CATEGORY_COLORS['Unknown']
      }))
      .sort((a, b) => b.stock - a.stock);
    
    return { data, totalStock };
  }, [products]);

  // Generate pie chart SVG path
  const generatePieSlice = (startAngle: number, endAngle: number, radius: number, center: number) => {
    const startX = center + radius * Math.cos(startAngle);
    const startY = center + radius * Math.sin(startAngle);
    const endX = center + radius * Math.cos(endAngle);
    const endY = center + radius * Math.sin(endAngle);
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
    
    return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
  };

  const RECENTLY_ADDED: RecentlyAddedItem[] = useMemo(() => {
    return products
      .sort((a, b) => {
        const aTime = a.createdAt ? (typeof a.createdAt === 'number' ? a.createdAt : a.createdAt.toMillis?.() || 0) : 0;
        const bTime = b.createdAt ? (typeof b.createdAt === 'number' ? b.createdAt : b.createdAt.toMillis?.() || 0) : 0;
        return bTime - aTime;
      })
      .slice(0, 8)
      .map(p => ({
        id: p.sku || p.id.slice(0, 8),
        name: p.name,
        category: p.category,
        quantity: p.stock,
        price: p.markupPrice,
        dateAdded: p.createdAt ? (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt.toMillis?.() || 0)) : new Date(),
        status: p.stock <= 0 ? 'low_stock' : p.stock <= p.reorderPoint ? 'low_stock' : 'in_stock'
      }));
  }, [products]);

  const lowStockItems = useMemo(() => {
    return products
      .filter(p => p.stock <= p.reorderPoint && p.stock >= 0)
      .sort((a, b) => a.stock - b.stock)
      .map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        currentStock: p.stock,
        status: p.stock === 0 ? 'critical' as const : 'low' as const
      }));
  }, [products]);

  const handleProductFound = async (productId: string, batchId?: string, batchSku?: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const isPerishable = product.category === "Solutions" || product.category === "Vitamins";
      
      try {
        if (scanMode === 'in') {
          // For perishable products, we need a batch ID
          if (isPerishable && !batchId) {
            showNotification(`Please scan a batch-specific QR code for "${product.name}"`, 'warning', 'Batch Required');
            return;
          }
          
          let currentStock = product.stock;
          
          // If this is a batch, get the batch's current stock
          if (batchId) {
            const batches = await getProductBatches(product.id);
            const batch = batches.find(b => b.id === batchId);
            if (batch) {
              currentStock = batch.stock;
            }
          }
          
          setPendingScanInProduct({
            id: product.id,
            name: product.name,
            sku: product.sku,
            stock: currentStock,
            batchId: batchId,
            batchSku: batchSku,
            isBatch: !!batchId
          });
          setScanInQuantity("1");
          setIsQRScannerOpen(false);
          return;
        }
        
        // Scan Out mode
        if (isPerishable && !batchId) {
          showNotification(`Please scan a batch-specific QR code for "${product.name}"`, 'warning', 'Batch Required');
          return;
        }
        
        let currentStock = product.stock;
        
        if (batchId) {
          const batches = await getProductBatches(product.id);
          const batch = batches.find(b => b.id === batchId);
          if (batch) {
            currentStock = batch.stock;
          }
        }
        
        setPendingScanOutProduct({
          id: product.id,
          name: product.name,
          sku: product.sku,
          stock: currentStock,
          batchId: batchId,
          batchSku: batchSku,
          isBatch: !!batchId
        });
        setScanOutQuantity("1");
        setIsQRScannerOpen(false);
      } catch (error) {
        console.error("Error handling product found:", error);
        showNotification(`Failed to process "${product.name}"`, 'error', 'Error');
      }
    }
  };

  const confirmScanIn = async () => {
    if (!pendingScanInProduct || isApplyingScanIn) return;

    const quantity = Number(scanInQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      showNotification("Please enter a valid quantity (whole number greater than 0).", 'error', 'Invalid Quantity');
      return;
    }

    const latestProduct = products.find((p) => p.id === pendingScanInProduct.id);
    if (!latestProduct) {
      showNotification("Product not found. Please scan again.", 'error', 'Error');
      setPendingScanInProduct(null);
      return;
    }

    setIsApplyingScanIn(true);
    try {
      if (pendingScanInProduct.isBatch && pendingScanInProduct.batchId) {
        // Update batch stock
        const batches = await getProductBatches(pendingScanInProduct.id);
        const batch = batches.find(b => b.id === pendingScanInProduct.batchId);
        
        if (!batch) {
          throw new Error("Batch not found");
        }
        
        const newBatchStock = batch.stock + quantity;
        await updateBatchStock(
          pendingScanInProduct.batchId,
          newBatchStock,
          `Received via QR Scan In (+${quantity})`,
          userName || 'Staff',
          userId || 'system'
        );
        
        showNotification(`+${quantity} unit${quantity > 1 ? 's' : ''} - ${latestProduct.name} (Batch: ${pendingScanInProduct.batchSku})`, 'success', 'Stock In ✓');
      } else {
        // Update parent product stock (non-perishable)
        const newStock = latestProduct.stock + quantity;
        await adjustStock(latestProduct.id, newStock, `Received via QR Scan (+${quantity})`, userName || 'Staff', userId || 'system');
        showNotification(`+${quantity} unit${quantity > 1 ? 's' : ''} - ${latestProduct.name}`, 'success', 'Stock In ✓');
      }
      
      setPendingScanInProduct(null);
      setScanInQuantity("1");
    } catch (error) {
      console.error("Error adjusting stock:", error);
      showNotification(`Failed to adjust stock for "${latestProduct.name}"`, 'error', 'Error');
    } finally {
      setIsApplyingScanIn(false);
    }
  };

  const confirmScanOut = async () => {
    if (!pendingScanOutProduct || isApplyingScanOut) return;

    const quantity = Number(scanOutQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      showNotification("Please enter a valid quantity (whole number greater than 0).", 'error', 'Invalid Quantity');
      return;
    }

    const latestProduct = products.find((p) => p.id === pendingScanOutProduct.id);
    if (!latestProduct) {
      showNotification("Product not found. Please scan again.", 'error', 'Error');
      setPendingScanOutProduct(null);
      return;
    }

    setIsApplyingScanOut(true);
    try {
      if (pendingScanOutProduct.isBatch && pendingScanOutProduct.batchId) {
        // Update batch stock (damaged)
        const batches = await getProductBatches(pendingScanOutProduct.id);
        const batch = batches.find(b => b.id === pendingScanOutProduct.batchId);
        
        if (!batch) {
          throw new Error("Batch not found");
        }
        
        if (quantity > batch.stock) {
          showNotification(`Cannot scan out ${quantity} units. Only ${batch.stock} unit${batch.stock === 1 ? '' : 's'} in stock.`, 'error', 'Insufficient Stock');
          setIsApplyingScanOut(false);
          return;
        }
        
        const newBatchStock = batch.stock - quantity;
        await updateBatchStock(
          pendingScanOutProduct.batchId,
          newBatchStock,
          `Damaged via QR Scan Out (-${quantity})`,
          userName || 'Staff',
          userId || 'system'
        );
        
        showNotification(`-${quantity} unit${quantity > 1 ? 's' : ''} - ${latestProduct.name} (Batch: ${pendingScanOutProduct.batchSku})`, 'success', 'Stock Out');
      } else {
        // Update parent product stock (non-perishable)
        if (quantity > latestProduct.stock) {
          showNotification(`Cannot scan out ${quantity} units. Only ${latestProduct.stock} unit${latestProduct.stock === 1 ? '' : 's'} in stock.`, 'error', 'Insufficient Stock');
          setIsApplyingScanOut(false);
          return;
        }
        
        const newStock = latestProduct.stock - quantity;
        await adjustStock(
          latestProduct.id,
          newStock,
          `Damaged via QR Scan Out (-${quantity})`,
          userName || 'Staff',
          userId || 'system'
        );
        showNotification(`-${quantity} unit${quantity > 1 ? 's' : ''} - ${latestProduct.name}`, 'success', 'Stock Out');
      }
      
      setPendingScanOutProduct(null);
      setScanOutQuantity("1");
    } catch (error) {
      console.error("Error adjusting stock:", error);
      showNotification(`Failed to adjust stock for "${latestProduct.name}"`, 'error', 'Error');
    } finally {
      setIsApplyingScanOut(false);
    }
  };

  // Pie chart dimensions
  let currentAngle = -Math.PI / 2;
  const pieRadius = 100;
  const pieCenter = 120;

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="min-h-screen p-4 space-y-4"
      >
        {/* SCANNER BUTTONS */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setScanMode('in');
              setIsQRScannerOpen(true);
            }}
            className="bg-blue-200 border-2 border-blue-500 hover:border-blue-600 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all shadow-md hover:shadow-lg relative"
          >
            <div className="p-4 bg-blue-300 rounded-full">
              <ArrowUp className="text-blue-700 w-8 h-8" strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-blue-600 leading-tight">Scan In</p>
              <p className="text-blue-500 text-xs mt-0.5">Receive Stock</p>
            </div>
            <QrCode className="w-5 h-5 text-blue-400 absolute top-2 right-2 opacity-60" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setScanMode('out');
              setIsQRScannerOpen(true);
            }}
            className="bg-red-200 border-2 border-red-500 hover:border-red-600 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all shadow-md hover:shadow-lg relative"
          >
            <div className="p-4 bg-red-300 rounded-full">
              <ArrowDown className="text-red-700 w-8 h-8" strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-red-600 leading-tight">Scan Out</p>
              <p className="text-red-500 text-xs mt-0.5">Dispatch Stock</p>
            </div>
            <QrCode className="w-5 h-5 text-red-400 absolute top-2 right-2 opacity-60" />
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* PIE CHART SECTION */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-2 bg-[#0B3C8A] rounded-lg">
                    <PieChart className="text-white w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">
                    Inventory by Category
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-1">
                  <Package size={12} />
                  <span>Total Stock: {categoryStockData.totalStock.toLocaleString()} units</span>
                </div>
              </div>
            </div>

            <div className="relative">
              {categoryStockData.data.length > 0 ? (
                <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
                  {/* Pie Chart */}
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full blur-md opacity-20 bg-gray-800 transform translate-y-1"></div>
                    
                    <svg width="240" height="240" viewBox="0 0 240 240" className="mx-auto relative z-10">
                      {categoryStockData.data.map((category) => {
                        const angle = (category.percentage / 100) * Math.PI * 2;
                        const startAngle = currentAngle;
                        const endAngle = startAngle + angle;
                        const path = generatePieSlice(startAngle, endAngle, pieRadius, pieCenter);
                        currentAngle = endAngle;
                        
                        return (
                          <path
                            key={category.name}
                            d={path}
                            fill={category.color}
                            stroke="white"
                            strokeWidth="2.5"
                          />
                        );
                      })}
                      {(() => { currentAngle = -Math.PI / 2; return null; })()}
                    </svg>
                    
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="bg-white/90 rounded-full w-28 h-28 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-2xl font-bold text-gray-800">
                          {categoryStockData.totalStock.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-gray-500">Total Units</span>
                      </div>
                    </div>
                  </div>

                  {/* Category Breakdown Legend */}
                  <div className="flex-1 space-y-3 w-full max-w-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 border-b border-gray-100 pb-2">
                      Category Breakdown
                    </h3>
                    <div className="space-y-3">
                      {categoryStockData.data.map((category) => (
                        <div
                          key={category.name}
                          className="flex items-center justify-between p-2 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3.5 h-3.5 rounded-full shadow-sm"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="text-sm font-medium text-gray-700">
                              {category.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-gray-800">
                              {category.stock.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-gray-500 ml-1.5">
                              ({category.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-2">
                        <span>Category Distribution</span>
                        <span>100%</span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden shadow-inner">
                        {categoryStockData.data.map((category) => (
                          <div
                            key={`bar-${category.name}`}
                            className="h-full"
                            style={{ 
                              width: `${category.percentage}%`,
                              backgroundColor: category.color
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 text-gray-400">
                  <Database size={64} className="mb-4 opacity-20" />
                  <p className="text-sm font-medium">No inventory data available</p>
                  <p className="text-xs mt-2 text-center max-w-xs">
                    Add products to see category distribution.
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-8"></div>
          </motion.div>

          {/* LOW STOCK ALERTS */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
          >
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <AlertTriangle className="text-orange-600 w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      Low Stock Alerts
                    </h2>
                    <p className="text-xs font-medium text-orange-600">
                      Items below reorder point
                    </p>
                  </div>
                </div>
                {lowStockItems.length > 4 && (
                  <button
                    onClick={() => setShowLowStockModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                  >
                    <Eye size={14} />
                    View All ({lowStockItems.length})
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-5 pt-0">
              <div className="space-y-3">
                {lowStockItems.slice(0, 4).map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="bg-gray-50 p-3 rounded-lg border border-gray-100"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 text-sm truncate">
                          {item.name}
                        </h3>
                        <p className="text-xs text-gray-500">{item.category}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${
                        item.status === 'critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {item.status === 'critical' ? 'OUT' : 'LOW'}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Current Stock</p>
                      <p className="font-bold text-gray-900">{item.currentStock} units</p>
                    </div>
                  </motion.div>
                ))}
                {lowStockItems.length === 0 && (
                  <div className="text-center py-8">
                    <AlertTriangle className="mx-auto w-10 h-10 text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">All stock levels healthy</p>
                    <p className="text-xs text-gray-400 mt-1">No items below reorder point</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Transaction History */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <History className="text-[#0B3C8A] w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Transaction History
                </h2>
                <p className="text-xs text-gray-500">
                  Latest transactions
                </p>
              </div>
            </div>
            <Link
              href="/sales?tab=history"
              className="text-xs font-semibold text-[#0B3C8A] bg-blue-50 px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-blue-100 transition-colors"
            >
              View All Transactions
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="pb-3 font-semibold text-xs">Date</th>
                  <th className="pb-3 font-semibold text-xs">Items</th>
                  <th className="pb-3 font-semibold text-xs">Total Amount</th>
                  <th className="pb-3 font-semibold text-xs">Payment Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(() => {
                  const latestTransactions = completedTransactions
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 8);

                  return latestTransactions.length > 0 ? (
                    latestTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 text-sm flex items-center gap-1">
                          <Clock size={12} className="text-gray-400" />
                          {new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 font-bold text-gray-900 text-sm">{transaction.items.length}</td>
                        <td className="py-3 text-sm font-bold">₱{transaction.total.toLocaleString()}</td>
                        <td className="py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded-full font-medium text-xs ${
                            transaction.paymentMethod === 'cash' 
                              ? 'bg-green-50 text-green-700'
                              : transaction.paymentMethod === 'online'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-gray-50 text-gray-700'
                          }`}>
                            {transaction.paymentMethod ? transaction.paymentMethod.charAt(0).toUpperCase() + transaction.paymentMethod.slice(1) : 'Unknown'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400">
                        No transactions yet.
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Recently Added Stock */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingBag className="text-[#0B3C8A] w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Recently Added Stock
                </h2>
                <p className="text-xs text-gray-500">
                  Recently added products in inventory
                </p>
              </div>
            </div>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-[#0B3C8A] bg-blue-50 px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-blue-100 transition-colors"
            >
              View All Inventory
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="pb-3 font-semibold text-xs">SKU</th>
                  <th className="pb-3 font-semibold text-xs">Product Name</th>
                  <th className="pb-3 font-semibold text-xs">Qty</th>
                  <th className="pb-3 font-semibold text-xs">Price</th>
                  <th className="pb-3 font-semibold text-xs">Date Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {RECENTLY_ADDED.length > 0 ? (
                  RECENTLY_ADDED.map((item) => (
                    <RecentlyAddedRow key={item.id} data={item} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      No recently added items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>

      {/* Low Stock Modal */}
      <AnimatePresence>
        {showLowStockModal && (
          <Modal
            title="Low Stock Alerts"
            onClose={() => setShowLowStockModal(false)}
          >
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div key={item.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 text-sm truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${
                      item.status === 'critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {item.status === 'critical' ? 'OUT' : 'LOW'}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Current Stock</p>
                    <p className="font-bold text-gray-900">{item.currentStock} units</p>
                  </div>
                </div>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {isQRScannerOpen && (
          <QRScannerModal
            onClose={() => setIsQRScannerOpen(false)}
            products={products}
            onProductFound={handleProductFound}
            mode={scanMode === 'in' ? 'in' : 'out'}
          />
        )}
      </AnimatePresence>

      {/* Scan In Confirmation Modal */}
      <AnimatePresence>
        {pendingScanInProduct && (
          <ScanInConfirmationModal
            product={pendingScanInProduct}
            quantity={scanInQuantity}
            setQuantity={setScanInQuantity}
            isSubmitting={isApplyingScanIn}
            onCancel={() => {
              if (isApplyingScanIn) return;
              setPendingScanInProduct(null);
              setScanInQuantity("1");
            }}
            onConfirm={confirmScanIn}
          />
        )}
      </AnimatePresence>

      {/* Scan Out Confirmation Modal */}
      <AnimatePresence>
        {pendingScanOutProduct && (
          <ScanOutConfirmationModal
            product={pendingScanOutProduct}
            quantity={scanOutQuantity}
            setQuantity={setScanOutQuantity}
            isSubmitting={isApplyingScanOut}
            onCancel={() => {
              if (isApplyingScanOut) return;
              setPendingScanOutProduct(null);
              setScanOutQuantity("1");
            }}
            onConfirm={confirmScanOut}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Modal Component
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-white p-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
        <div className="sticky bottom-0 bg-gray-50 p-4 border-t border-gray-200">
          <button onClick={onClose} className="w-full px-4 py-2.5 bg-[#0B3C8A] text-white rounded-lg font-medium hover:bg-[#082F6E] transition-colors">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function RecentlyAddedRow({ data }: { data: RecentlyAddedItem }) {
  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    const todayOnly = new Date(today);
    todayOnly.setHours(0, 0, 0, 0);
    
    const yesterdayOnly = new Date(yesterday);
    yesterdayOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === todayOnly.getTime()) return 'Today';
    if (dateOnly.getTime() === yesterdayOnly.getTime()) return 'Yesterday';
    
    const daysAgo = Math.floor((todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo < 30) return `${daysAgo} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <tr className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
      <td className="py-3 font-medium text-gray-800 text-sm">
        {data.id}
      </td>
      <td className="py-3 truncate max-w-40 text-sm">{data.name}</td>
      <td className="py-3 font-bold text-gray-900 text-sm">{data.quantity}</td>
      <td className="py-3 text-sm">₱{data.price.toLocaleString()}</td>
      <td className="py-3 text-sm text-gray-500 flex items-center gap-1">
        <Clock size={12} className="text-gray-400" />
        {formatDate(data.dateAdded)}
      </td>
    </tr>
  );
}

function ScanInConfirmationModal({
  product,
  quantity,
  setQuantity,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  product: { id: string; name: string; sku: string; stock: number; batchId?: string; batchSku?: string; isBatch?: boolean };
  quantity: string;
  setQuantity: (value: string) => void;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const qty = Number(quantity);
  const isValidQty = Number.isInteger(qty) && qty > 0;
  const projectedStock = isValidQty ? product.stock + qty : product.stock;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-4 sm:p-6"
      >
        <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Scan In</h3>
        <p className="text-sm text-gray-600 mb-4">
          Add stock for <span className="font-semibold text-gray-800">{product.name}</span> ({product.sku}).
          {product.isBatch && product.batchSku && (
            <span className="block text-xs text-blue-600 mt-1">Batch: {product.batchSku}</span>
          )}
        </p>

        <div className="space-y-2 mb-4">
          <label htmlFor="scanin-qty" className="text-xs font-semibold text-gray-700 uppercase">
            Quantity To Add
          </label>
          <input
            id="scanin-qty"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C8A] text-gray-700"
          />
          <p className="text-xs text-gray-500">
            Current: <span className="font-semibold text-gray-700">{product.stock}</span> | New:{" "}
            <span className="font-semibold text-[#0B3C8A]">{projectedStock}</span>
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isValidQty || isSubmitting}
            className="flex-1 px-4 py-2 rounded-lg bg-[#0B3C8A] text-white font-medium text-sm hover:bg-[#082F6E] transition-colors shadow-md disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Confirm"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ScanOutConfirmationModal({
  product,
  quantity,
  setQuantity,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  product: { id: string; name: string; sku: string; stock: number; batchId?: string; batchSku?: string; isBatch?: boolean };
  quantity: string;
  setQuantity: (value: string) => void;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const qty = Number(quantity);
  const isValidQty = Number.isInteger(qty) && qty > 0 && qty <= product.stock;
  const projectedStock = Number.isInteger(qty) && qty > 0 ? Math.max(0, product.stock - qty) : product.stock;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-4 sm:p-6"
      >
        <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Scan Out</h3>
        <p className="text-sm text-gray-600 mb-4">
          Remove stock for <span className="font-semibold text-gray-800">{product.name}</span> ({product.sku}).
          {product.isBatch && product.batchSku && (
            <span className="block text-xs text-red-600 mt-1">Batch: {product.batchSku}</span>
          )}
        </p>

        <div className="space-y-2 mb-4">
          <label htmlFor="scanout-qty" className="text-xs font-semibold text-gray-700 uppercase">
            Quantity To Remove
          </label>
          <input
            id="scanout-qty"
            type="number"
            min={1}
            max={Math.max(1, product.stock)}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C8A] text-gray-700"
          />
          <p className="text-xs text-gray-500">
            Current: <span className="font-semibold text-gray-700">{product.stock}</span> | New:{" "}
            <span className="font-semibold text-red-600">{projectedStock}</span>
          </p>
          {Number.isInteger(qty) && qty > product.stock && (
            <p className="text-xs text-red-600 font-medium">Quantity cannot exceed available stock.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isValidQty || isSubmitting}
            className="flex-1 px-4 py-2 rounded-lg bg-[#0B3C8A] text-white font-medium text-sm hover:bg-[#082F6E] transition-colors shadow-md disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Confirm"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}