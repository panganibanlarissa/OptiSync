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
  'Frames': '#0B3C8A',      // Deep blue
  'Lenses': '#10B981',       // Emerald green
  'Contact Lenses': '#8B5CF6', // Purple
  'Solutions': '#F59E0B',     // Amber
  'Accessories': '#EF4444',    // Red
  'Unknown': '#6B7280'        // Gray
};

export default function StaffDashboard() {
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<'in' | 'out'>('in');
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  
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

  const handleProductFound = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      try {
        const newStock = scanMode === 'in' 
          ? product.stock + 1 
          : Math.max(0, product.stock - 1);
        
        if (newStock !== product.stock) {
          const reason = scanMode === 'in' 
            ? 'Received via QR Scan' 
            : 'Dispatched via QR Scan';
          
          await adjustStock(productId, newStock, reason, userName || 'Staff', userId || 'system');
          
          const action = scanMode === 'in' ? '+1' : '-1';
          const message = `${action} unit - ${product.name}`;
          
          showNotification(message, 'success', `Stock ${scanMode === 'in' ? 'In' : 'Out'} ✓`);
        } else {
          showNotification(`No change - ${product.name} already at ${product.stock} units`, 'info', 'Stock Unchanged');
        }
        setIsQRScannerOpen(false);
      } catch (error) {
        console.error("Error adjusting stock:", error);
        showNotification(`Failed to adjust stock for "${product.name}"`, 'error', 'Error');
      }
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
        className="min-h-screen bg-gray-50 p-4 space-y-4"
      >
        {/* SCANNER BUTTONS - Quick Warehouse Operations - Updated Colors */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 gap-4"
        >
          {/* Scan In Button - Changed to Blue theme */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setScanMode('in');
              setIsQRScannerOpen(true);
            }}
            className="bg-gradient-to-r from-[#0B3C8A] to-blue-600 hover:from-[#082F6E] hover:to-blue-700 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all shadow-md hover:shadow-lg relative"
          >
            <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm">
              <ArrowUp className="text-white w-8 h-8" strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-white leading-tight">Scan In</p>
              <p className="text-white/80 text-xs mt-0.5">Receive Stock</p>
            </div>
            <QrCode className="w-5 h-5 text-white/40 absolute top-2 right-2 opacity-60" />
          </motion.button>

          {/* Scan Out Button - Changed to Orange/Amber theme */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setScanMode('out');
              setIsQRScannerOpen(true);
            }}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all shadow-md hover:shadow-lg relative"
          >
            <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm">
              <ArrowDown className="text-white w-8 h-8" strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-white leading-tight">Scan Out</p>
              <p className="text-white/80 text-xs mt-0.5">Dispatch Stock</p>
            </div>
            <QrCode className="w-5 h-5 text-white/40 absolute top-2 right-2 opacity-60" />
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

          {/* LOW STOCK ALERTS - Show first 3 items - Removed reorder point */}
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

      {/* Low Stock Modal - Removed reorder point */}
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
            mode={scanMode}
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