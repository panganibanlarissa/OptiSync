// src/app/(app)/dashboard/StaffDashboard.tsx
"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { useFirebase } from "@/context/FirebaseContext";
import { useMLForecasting } from "@/hooks/useMLForecasting";
import { useNotification } from "@/components/NotificationProvider";
import QRScannerModal from "@/components/QRScannerModal";
import ProductModal, { ProductFormData } from "@/components/ProductModal";
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
  PieChart
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

interface StatData {
  id: string;
  label: string;
  value: string | number;
  trend: string;
  trendType: 'positive' | 'negative' | 'neutral';
}

interface ForecastDisplayData {
  name: string;
  currentStock: number;
  predictedDemand: number;
  trend: 'up' | 'down' | 'stable';
  priority: 'high' | 'medium' | 'low';
}

interface CategoryStockData {
  name: string;
  stock: number;
  percentage: number;
  color: string;
}

interface RecentlyAddedItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  dateAdded: Date;
  status: 'in_stock' | 'low_stock';
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

const MIN_TRANSACTIONS_FOR_ML = 10;

const CATEGORY_COLORS: Record<string, string> = {
  'Frames': '#0B3C8A',      // Deep blue
  'Lenses': '#10B981',       // Emerald green
  'Contact Lenses': '#8B5CF6', // Purple
  'Solutions': '#F59E0B',     // Amber
  'Accessories': '#EF4444',    // Red
  'Unknown': '#6B7280'        // Gray
};

const modalVariants: Variants = { 
  hidden: { opacity: 0, scale: 0.95 }, 
  visible: { opacity: 1, scale: 1 }, 
  exit: { opacity: 0, scale: 0.95 } 
};

export default function StaffDashboard() {
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<'in' | 'out'>('in');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<ProductFormData | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  
  const { products, transactions, addProduct, adjustStock, userRole, userName, userId } = useFirebase();
  const { loading, recommendations, usingML, dataLoaded } = useMLForecasting();
  const { showNotification } = useNotification();

  const handleOpenAddProduct = () => {
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

    setNewProduct({
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
    setIsProductModalOpen(true);
  };

  const handleSaveNewProduct = async (formData: ProductFormData) => {
    try {
      console.log("Saving new product with data:", {
        name: formData.name,
        hasImage: !!formData.image,
        imageUrl: formData.image?.substring(0, 100)
      });
      
      const productToSave = {
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
        expiryDate: formData.expiryDate || null,
        createdAt: new Date().toISOString()
      };
      
      const newProductId = await addProduct(productToSave);
      console.log("Product saved successfully with ID:", newProductId);
      
      showNotification(`New product "${formData.name}" added to catalog`, "success", "Product Added");
      setIsProductModalOpen(false);
      
      if (newProductId) {
        setCreatedProductId(newProductId);
      }
    } catch (error) {
      console.error("Error adding product:", error);
      showNotification("Failed to add new product. Please try again.", "error", "Error");
    }
  };

  const completedTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'completed');
  }, [transactions]);

  const hasEnoughDataForML = useMemo(() => {
    return completedTransactions.length >= MIN_TRANSACTIONS_FOR_ML;
  }, [completedTransactions]);

  const todaySales = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return completedTransactions
      .filter(t => {
        const transDate = new Date(t.date);
        transDate.setHours(0, 0, 0, 0);
        return transDate.getTime() === today.getTime();
      })
      .reduce((sum, t) => sum + t.total, 0);
  }, [completedTransactions]);

  const todayTransactionCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return completedTransactions.filter(t => {
      const transDate = new Date(t.date);
      transDate.setHours(0, 0, 0, 0);
      return transDate.getTime() === today.getTime();
    }).length;
  }, [completedTransactions]);

  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock <= p.reorderPoint && p.stock > 0).length;
  }, [products]);

  const totalInventoryCount = useMemo(() => {
    return products.reduce((sum, p) => sum + p.stock, 0);
  }, [products]);

  const previousPeriodSales = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    return completedTransactions
      .filter(t => {
        const transDate = new Date(t.date);
        transDate.setHours(0, 0, 0, 0);
        return transDate.getTime() === yesterday.getTime();
      })
      .reduce((sum, t) => sum + t.total, 0);
  }, [completedTransactions]);

  const salesTrend = useMemo(() => {
    if (previousPeriodSales === 0 && todaySales === 0) return "0%";
    if (previousPeriodSales === 0) return "+100%";
    const percentChange = ((todaySales - previousPeriodSales) / previousPeriodSales) * 100;
    return `${percentChange >= 0 ? '+' : ''}${Math.round(percentChange)}%`;
  }, [todaySales, previousPeriodSales]);

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

  const FORECAST_DATA: ForecastDisplayData[] = useMemo(() => {
    if (hasEnoughDataForML && recommendations.length > 0) {
      return recommendations.slice(0, 3).map(r => ({
        name: r.productName,
        currentStock: r.currentStock,
        predictedDemand: r.predictedDemand30d,
        trend: r.trend,
        priority: r.confidence
      }));
    }
    return [];
  }, [hasEnoughDataForML, recommendations]);

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

  const STATS_DATA: StatData[] = useMemo(() => {
    return [
      {
        id: "sales_today",
        label: "Today's Sales",
        value: `₱${todaySales.toLocaleString()}`,
        trend: salesTrend,
        trendType: parseFloat(salesTrend) >= 0 ? "positive" : "negative",
      },
      {
        id: "transactions_today",
        label: "Today's Transaction",
        value: todayTransactionCount,
        trend: todayTransactionCount > 0 ? "• Live" : "No sales",
        trendType: todayTransactionCount > 0 ? "positive" : "neutral",
      },
      {
        id: "low_stock",
        label: "Low Stock Items",
        value: lowStockCount,
        trend: lowStockCount > 0 ? "Action Needed" : "All Good",
        trendType: lowStockCount > 0 ? "negative" : "positive",
      },
      {
        id: "total_inventory",
        label: "Total Inventory Count",
        value: totalInventoryCount,
        trend: "Stable",
        trendType: "neutral",
      },
    ];
  }, [todaySales, todayTransactionCount, lowStockCount, totalInventoryCount, salesTrend]);

  const handleProductFound = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      try {
        const newStock = scanMode === 'in' 
          ? product.stock + 1 
          : Math.max(0, product.stock - 1);
        
        const reason = scanMode === 'in' 
          ? 'Stock received via QR Scan' 
          : 'Stock dispatched via QR Scan';
        
        await adjustStock(productId, newStock, reason);
        
        const action = scanMode === 'in' ? '+1' : '-1';
        const message = `${action} unit - ${product.name}`;
        
        showNotification(message, 'success', `Stock ${scanMode === 'in' ? 'In' : 'Out'} ✓`);
        setIsQRScannerOpen(false);
      } catch (error) {
        console.error("Error adjusting stock:", error);
        showNotification(`Failed to adjust stock for "${product.name}"`, 'error', 'Error');
      }
    }
  };

  if (loading && !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  // Pie chart dimensions
  let currentAngle = -Math.PI / 2;
  const pieRadius = 100;
  const pieCenter = 120;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen mt-2 sm:mt-2 p-2 sm:p-4 space-y-3 sm:space-y-4"
    >
      {usingML && hasEnoughDataForML && dataLoaded && (
        <motion.div 
          variants={itemVariants}
          className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700 flex items-center gap-2"
        >
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          AI-Powered Forecasts Active (Time Series Analysis)
        </motion.div>
      )}

      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4"
      >
        {STATS_DATA.map((stat) => (
          <StatCard key={stat.id} data={stat} />
        ))}
      </motion.div>

      {/* SCANNER BUTTONS - Quick Warehouse Operations */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-3 gap-1.5 sm:gap-4"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setScanMode('in');
            setIsQRScannerOpen(true);
          }}
          className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 hover:border-emerald-400 rounded-lg sm:rounded-xl p-2 sm:p-6 flex flex-col items-center justify-center gap-1.5 sm:gap-3 transition-all shadow-sm hover:shadow-md relative"
        >
          <div className="p-1.5 sm:p-4 bg-emerald-100 rounded-full">
            <ArrowUp className="text-emerald-600 w-4 h-4 sm:w-8 sm:h-8" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <p className="font-bold text-[10px] sm:text-lg text-gray-800 leading-tight">Scan In</p>
            <p className="hidden sm:block text-xs text-gray-500 mt-0.5">Receive Stock</p>
          </div>
          <QrCode className="w-3 h-3 sm:w-5 sm:h-5 text-emerald-400 absolute top-1 sm:top-2 right-1 sm:right-2 opacity-60" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setScanMode('out');
            setIsQRScannerOpen(true);
          }}
          className="bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-300 hover:border-red-400 rounded-lg sm:rounded-xl p-2 sm:p-6 flex flex-col items-center justify-center gap-1.5 sm:gap-3 transition-all shadow-sm hover:shadow-md relative"
        >
          <div className="p-1.5 sm:p-4 bg-red-100 rounded-full">
            <ArrowDown className="text-red-600 w-4 h-4 sm:w-8 sm:h-8" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <p className="font-bold text-[10px] sm:text-lg text-gray-800 leading-tight">Scan Out</p>
            <p className="hidden sm:block text-xs text-gray-500 mt-0.5">Dispatch Stock</p>
          </div>
          <QrCode className="w-3 h-3 sm:w-5 sm:h-5 text-red-400 absolute top-1 sm:top-2 right-1 sm:right-2 opacity-60" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOpenAddProduct}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 hover:border-blue-400 rounded-lg sm:rounded-xl p-2 sm:p-6 flex flex-col items-center justify-center gap-1.5 sm:gap-3 transition-all shadow-sm hover:shadow-md relative"
        >
          <div className="p-1.5 sm:p-4 bg-blue-100 rounded-full">
            <Plus className="text-blue-600 w-4 h-4 sm:w-8 sm:h-8" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <p className="font-bold text-[10px] sm:text-lg text-gray-800 leading-tight">New Item</p>
            <p className="hidden sm:block text-xs text-gray-500 mt-0.5">Add to Catalog</p>
          </div>
          <Package className="w-3 h-3 sm:w-5 sm:h-5 text-blue-400 absolute top-1 sm:top-2 right-1 sm:right-2 opacity-60" />
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* PIE CHART SECTION - Enhanced with no hover effects */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 sm:p-2 bg-[#0B3C8A] rounded-lg">
                  <PieChart className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                  Inventory by Category
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 ml-1">
                <Package size={10} className="sm:w-3 sm:h-3" />
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
                  
                  {/* Visual summary bar with extra bottom spacing */}
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
          
          {/* Extra bottom spacing to match the top spacing */}
          <div className="mt-8"></div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6 h-fit lg:h-full"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <Package className="text-[#047857] w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                Recommended to Reorder
              </h2>
              <p className="text-[9px] sm:text-xs font-medium text-blue-600">
                {hasEnoughDataForML && usingML ? 'AI Predictive Forecast' : 'Based on stock levels'}
              </p>
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
            {FORECAST_DATA.length > 0 ? (
              FORECAST_DATA.map((item, i) => (
                <ForecastItem key={i} data={item} />
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">
                  {hasEnoughDataForML 
                    ? "No reorder recommendations at this time."
                    : "Insufficient data for AI recommendations"}
                </p>
                {!hasEnoughDataForML && (
                  <p className="text-[10px] text-gray-400 mt-2">
                    Need {MIN_TRANSACTIONS_FOR_ML - completedTransactions.length} more sales for AI predictions
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          variants={itemVariants}
          className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg">
              <BarChart3 className="text-emerald-700 w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                Performance Heatmap
              </h2>
              <p className="text-[9px] sm:text-xs text-gray-500">
                Profit vs. Volume Analysis
              </p>
            </div>
          </div>

          <p className="text-[10px] sm:text-[11px] text-gray-400 mb-3 sm:mb-5 leading-relaxed">
            Identifies which categories generate the most revenue
            relative to how many units are sold.
          </p>

          <div className="space-y-3 sm:space-y-5">
            {(() => {
              const categoryStats = products.reduce((acc, product) => {
                if (!acc[product.category]) {
                  acc[product.category] = {
                    totalProfit: 0,
                    totalVolume: 0,
                    count: 0
                  };
                }
                const profitPerUnit = product.markupPrice - product.baseCost;
                acc[product.category].totalProfit += profitPerUnit * product.stock;
                acc[product.category].totalVolume += product.stock;
                acc[product.category].count++;
                return acc;
              }, {} as Record<string, { totalProfit: number; totalVolume: number; count: number }>);

              const maxProfit = Math.max(...Object.values(categoryStats).map(c => c.totalProfit), 1);
              const maxVolume = Math.max(...Object.values(categoryStats).map(c => c.totalVolume), 1);

              const heatmapData = Object.entries(categoryStats).map(([category, data]) => ({
                category,
                profit: maxProfit > 0 ? Math.round((data.totalProfit / maxProfit) * 100) : 0,
                volume: maxVolume > 0 ? Math.round((data.totalVolume / maxVolume) * 100) : 0,
                color: CATEGORY_COLORS[category] || CATEGORY_COLORS['Unknown']
              }));

              return heatmapData.length > 0 ? (
                heatmapData.map((item, idx) => (
                  <div key={idx} className="space-y-1 sm:space-y-1.5">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="font-semibold text-gray-700 text-[10px] sm:text-sm">
                        {item.category}
                      </span>
                    </div>
                    <div className="relative h-5 sm:h-6 bg-gray-100 rounded-md overflow-hidden flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.profit}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full flex items-center px-1.5 sm:px-2 text-[8px] sm:text-[10px] font-bold whitespace-nowrap z-10 text-gray-900`}
                        style={{ backgroundColor: item.color }}
                      >
                        Profit {item.profit}%
                      </motion.div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No product data available.
                </p>
              );
            })()}
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-7 h-fit"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                <ShoppingBag className="text-[#0B3C8A] w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                  Recently Added Stock
                </h2>
                <p className="text-[9px] sm:text-xs text-gray-500">
                  Recently added products in inventory
                </p>
              </div>
            </div>
            <Link
              href="/inventory"
              className="text-[9px] sm:text-xs font-semibold text-[#0B3C8A] bg-blue-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full whitespace-nowrap hover:bg-blue-100 transition-colors"
            >
              View All Catalog
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-125 text-left text-xs sm:text-sm text-gray-600">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">SKU</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">Product Name</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">Qty</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">Price</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">Date Added</th>
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
      </div>

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

      {/* Register New Item Modal */}
      <AnimatePresence>
        {isProductModalOpen && newProduct && (
          <ProductModal
            mode="add"
            product={newProduct}
            products={products}
            onClose={() => setIsProductModalOpen(false)}
            onSave={handleSaveNewProduct}
            userRole={userRole}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createdProductId && (
          <QRCodeModal
            productId={createdProductId}
            productName={newProduct?.name || "Product"}
            onClose={() => setCreatedProductId(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function QRCodeModal({ productId, productName, onClose }: {
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const THEME_BG = "bg-[#0B3C8A]";
  const THEME_HOVER = "hover:bg-[#082F6E]";
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

function StatCard({ data }: { data: StatData }) {
  let Icon = Banknote;
  let themeColor = "blue";

  if (data.id === "transactions_today") {
    Icon = ShoppingBag;
    themeColor = "emerald";
  } else if (data.id === "low_stock") {
    Icon = AlertTriangle;
    themeColor = "orange";
  } else if (data.id === "total_inventory") {
    Icon = Package;
    themeColor = "blue";
  }

  const styles: Record<string, { icon: string; bg: string; badge: string }> = {
    blue: {
      icon: "text-[#0B3C8A]",
      bg: "bg-blue-50",
      badge: "bg-blue-100 text-[#0B3C8A]",
    },
    emerald: {
      icon: "text-emerald-700",
      bg: "bg-emerald-50",
      badge: "bg-emerald-100 text-emerald-700",
    },
    orange: {
      icon: "text-orange-600",
      bg: "bg-orange-50",
      badge: "bg-orange-100 text-orange-700",
    },
  };

  const currentStyle = styles[themeColor] || styles.blue;

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white p-3 sm:p-5 rounded-xl shadow-sm border border-gray-100"
    >
      <div className="flex justify-between items-start">
        <div className={`p-2 sm:p-3 rounded-lg ${currentStyle.bg} mb-2 sm:mb-4`}>
          <Icon size={18} className={`${currentStyle.icon} sm:w-6 sm:h-6`} />
        </div>
        <span
          className={`px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${currentStyle.badge}`}
        >
          {data.trend}
        </span>
      </div>
      <h3 className="text-lg sm:text-2xl font-bold text-gray-800">{data.value}</h3>
      <p className="text-xs sm:text-sm text-gray-500 mt-1">{data.label}</p>
    </motion.div>
  );
}

function ForecastItem({ data }: { data: ForecastDisplayData }) {
  const getTrendIcon = () => {
    if (data.trend === 'up') {
      return <TrendingUp size={14} className="text-emerald-500" />;
    } else if (data.trend === 'down') {
      return <TrendingDown size={14} className="text-red-500" />;
    }
    return <Minus size={14} className="text-gray-400" />;
  };

  const getActionText = () => {
    if (data.trend === 'up') {
      const needed = data.predictedDemand - data.currentStock;
      return needed > 0 ? `Order ${needed} Units` : "Stock sufficient";
    } else if (data.trend === 'down') {
      return "Reduce orders";
    }
    return "Monitor stock";
  };

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-100"
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {getTrendIcon()}
          <h3 className="font-semibold text-gray-800 text-xs sm:text-sm break-words">
            {data.name}
          </h3>
        </div>
        <span className={`text-[8px] sm:text-[9px] font-bold px-2 py-0.5 rounded flex-shrink-0 w-fit ${
          data.priority === 'high' ? 'bg-red-100 text-red-700' :
          data.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {data.priority.toUpperCase()}
        </span>
      </div>
      <div className="flex justify-between text-xs sm:text-sm mb-2 sm:mb-3">
        <div>
          <p className="text-gray-500 text-[9px] sm:text-xs">Current</p>
          <p className="font-bold text-gray-900 text-sm sm:text-base">
            {data.currentStock} units
          </p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-[9px] sm:text-xs">Projected Demand</p>
          <p
            className={`font-bold text-sm sm:text-base ${
              data.trend === "up" ? "text-emerald-600" : 
              data.trend === "down" ? "text-red-500" : "text-gray-600"
            }`}
          >
            {data.predictedDemand} units
          </p>
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1 text-[9px] sm:text-xs text-gray-600 font-medium">
          <Package size={12} />
          {getActionText()}
        </div>
      </div>
    </motion.div>
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
      <td className="py-2 sm:py-3 font-medium text-gray-800 text-[9px] sm:text-sm">
        {data.id}
      </td>
      <td className="py-2 sm:py-3 truncate max-w-37.5 text-[9px] sm:text-sm">{data.name}</td>
      <td className="py-2 sm:py-3 font-bold text-gray-900 text-[9px] sm:text-sm">{data.quantity}</td>
      <td className="py-2 sm:py-3 text-[9px] sm:text-sm">₱{data.price.toLocaleString()}</td>
      <td className="py-2 sm:py-3 text-[9px] sm:text-sm text-gray-500 flex items-center gap-1">
        <Clock size={12} className="text-gray-400" />
        {formatDate(data.dateAdded)}
      </td>
    </tr>
  );
}