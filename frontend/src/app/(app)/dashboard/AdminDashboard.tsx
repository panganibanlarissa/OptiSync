// src/app/(app)/dashboard/AdminDashboard.tsx

"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { useFirebase } from "@/context/FirebaseContext";
import { useMLForecasting } from "@/hooks/useMLForecasting";
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
  Clock,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  PieChart,
  ChevronRight,
  Calculator,
  DollarSign,
  Percent,
  ShoppingBag,
  AlertCircle,
  CheckCircle2,
  Eye,
  Maximize2,
  Brain,
  Info,
  Zap,
  History
} from "lucide-react";

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
  recommendedOrder: number;
  stockoutDay: number;
  predictedDemand30d: number;
  predictedDemand60d: number;
  predictedDemand90d: number;
  trend: 'up' | 'down' | 'stable';
}

interface ForecastExplanation {
  productId: string;
  productName: string;
  currentStock: number;
  recommendedOrder: number;
  stockoutDay: number;
  monthlyForecasts: Array<{
    month: string;
    predictedDemand: number;
  }>;
  trend: 'up' | 'down' | 'stable';
}

interface DeadstockItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  daysSinceSale: number;
  lockedCapital: number;
  priority: 'high' | 'medium' | 'low';
  lastSaleDate: Date | null;
  aiSuggestion?: string | null;
  aiSuggestionType?: 'critical' | 'warning' | 'info' | null;
  recommendedDiscount?: number | null;
  baseCost?: number;
  markupPrice?: number;
  historicalVelocity?: number;
}

interface Recommendation {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand30d: number;
  predictedDemand60d: number;
  predictedDemand90d: number;
  recommendedOrder: number;
  daysUntilOut: number;
  trend: 'up' | 'down' | 'stable';
  confidence: 'high' | 'medium' | 'low';
}

interface ForecastDataPoint {
  month: string;
  value: number;
  type: 'history' | 'forecast';
  lower?: number;
  upper?: number;
}

interface LowStockItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  status: 'critical' | 'low';
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

const CURRENT_PERIOD = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const MIN_TRANSACTIONS_FOR_ML = 10;

const CATEGORY_COLORS: Record<string, string> = {
  'Frames': 'bg-emerald-500',
  'Lenses': 'bg-blue-500',
  'Contact Lenses': 'bg-indigo-500',
  'Solutions': 'bg-amber-500',
  'Accessories': 'bg-purple-500',
  'Vitamins': 'bg-rose-500',
  'Unknown': 'bg-gray-500'
};

const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Helper to get next three months starting from current month
const getNextThreeMonths = (currentDate: Date = new Date()): string[] => {
  const months: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(currentDate.getMonth() + i);
    months.push(FULL_MONTH_NAMES[nextMonth.getMonth()]);
  }
  return months;
};

export default function AdminDashboard() {
  const [selectedForecastMonth, setSelectedForecastMonth] = useState<number>(0);
  const [selectedForecastProduct, setSelectedForecastProduct] = useState<ForecastDisplayData | null>(null);
  const [showForecastExplanationModal, setShowForecastExplanationModal] = useState(false);
  const [selectedDeadstock, setSelectedDeadstock] = useState<DeadstockItem | null>(null);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showDeadstockModal, setShowDeadstockModal] = useState(false);
  const [showForecastModal, setShowForecastModal] = useState(false);
  
  const { products, transactions } = useFirebase();
  const { 
    loading: mlLoading, 
    recommendations, 
    forecastData, 
    usingML, 
    dataLoaded: mlDataLoaded, 
    deadstockSuggestions,
    mlServiceAvailable,
    mlServiceChecked
  } = useMLForecasting();

  const nextThreeMonths = useMemo(() => getNextThreeMonths(), []);

  // Filter out archived products from displays (but NOT from gross profit calculation)
  const activeProducts = useMemo(() => {
    return products.filter((p: any) => (p as any).archived !== true);
  }, [products]);

  // CRITICAL FIX: Count ALL transactions for revenue and sales
  // Replacements are NOT refunds - the patient paid and the clinic keeps the money
  // The transaction status (completed, processing_replacement, replaced) should NOT affect revenue
  // A replacement is just an exchange of product, not a financial reversal
  const allTransactions = useMemo(() => {
    // Include ALL transactions regardless of status
    // This ensures sales revenue is never deducted
    return transactions;
  }, [transactions]);

  const hasEnoughDataForML = useMemo(() => {
    return allTransactions.length >= MIN_TRANSACTIONS_FOR_ML;
  }, [allTransactions]);

  // Today's sales - ALL transactions (replacements don't affect revenue)
  const todaySales = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allTransactions
      .filter((t: any) => {
        const transDate = new Date(t.date);
        transDate.setHours(0, 0, 0, 0);
        return transDate.getTime() === today.getTime();
      })
      .reduce((sum: number, t: any) => sum + t.total, 0);
  }, [allTransactions]);

  // Low stock count - only from active (non-archived) products
  const lowStockCount = useMemo(() => {
    return activeProducts.filter((p: any) => p.stock <= p.reorderPoint && p.stock > 0).length;
  }, [activeProducts]);

  // Low stock items - only from active (non-archived) products
  const lowStockItems = useMemo(() => {
    return activeProducts
      .filter(p => p.stock <= p.reorderPoint && p.stock >= 0)
      .sort((a, b) => a.stock - b.stock)
      .map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        currentStock: p.stock,
        status: p.stock === 0 ? 'critical' as const : 'low' as const
      }));
  }, [activeProducts]);

  // Gross profit - ALL transactions (replacements don't affect profit)
  const grossProfit = useMemo(() => {
    return allTransactions.reduce((sum: number, t: any) => {
      const profit = t.items.reduce((itemSum: number, item: any) => {
        const product = products.find((p: any) => p.id === item.id);
        if (product) {
          return itemSum + ((product.markupPrice - product.baseCost) * item.quantity);
        }
        return itemSum;
      }, 0);
      return sum + profit;
    }, 0);
  }, [allTransactions, products]);

  // Total revenue - ALL transactions (replacements are NOT refunds)
  const totalRevenue = useMemo(() => {
    return allTransactions.reduce((sum: number, t: any) => sum + t.total, 0);
  }, [allTransactions]);

  // Previous period revenue for trend calculation - ALL transactions
  const previousPeriodRevenue = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    return allTransactions
      .filter((t: any) => {
        const transDate = new Date(t.date);
        return transDate >= lastMonth && transDate <= lastMonthEnd;
      })
      .reduce((sum: number, t: any) => sum + t.total, 0);
  }, [allTransactions]);

  const revenueTrend = useMemo(() => {
    if (previousPeriodRevenue === 0) return "+100%";
    const percentChange = ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100;
    return `${percentChange >= 0 ? '+' : ''}${Math.round(percentChange)}%`;
  }, [totalRevenue, previousPeriodRevenue]);

  const STATS_DATA: StatData[] = useMemo(() => {
    return [
      {
        id: "sales_today",
        label: "Today's Sale",
        value: `₱${todaySales.toLocaleString()}`,
        trend: todaySales > 0 ? "+Today" : "No Sales",
        trendType: todaySales > 0 ? "positive" : "neutral",
      },
      {
        id: "low_stock",
        label: "Low-Stock Items",
        value: lowStockCount,
        trend: lowStockCount > 0 ? "Action Needed" : "All Good",
        trendType: lowStockCount > 0 ? "negative" : "positive",
      },
      {
        id: "gross_profit",
        label: "Gross Profit",
        value: `₱${grossProfit.toLocaleString()}`,
        trend: grossProfit > 0 ? "+Total" : "No Profit",
        trendType: grossProfit > 0 ? "positive" : "neutral",
      },
      {
        id: "total_revenue",
        label: "Total Revenue",
        value: `₱${totalRevenue.toLocaleString()}`,
        trend: revenueTrend,
        trendType: parseFloat(revenueTrend) >= 0 ? "positive" : "negative",
      },
    ];
  }, [todaySales, grossProfit, totalRevenue, lowStockCount, revenueTrend]);

  // Forecast data - only from active (non-archived) products
  const FORECAST_DATA: ForecastDisplayData[] = useMemo(() => {
    if (usingML && hasEnoughDataForML && recommendations && recommendations.length > 0) {
      return recommendations
        .filter((r: Recommendation) => {
          // Check if the product is active (not archived)
          const product = activeProducts.find(p => p.name === r.productName || p.id === r.productId);
          return product !== undefined;
        })
        .map((r: Recommendation) => ({
          name: r.productName,
          currentStock: r.currentStock,
          recommendedOrder: r.recommendedOrder,
          stockoutDay: r.daysUntilOut,
          predictedDemand30d: typeof r.predictedDemand30d === 'number' && !isNaN(r.predictedDemand30d) ? r.predictedDemand30d : 0,
          predictedDemand60d: typeof r.predictedDemand60d === 'number' && !isNaN(r.predictedDemand60d) ? r.predictedDemand60d : 0,
          predictedDemand90d: typeof r.predictedDemand90d === 'number' && !isNaN(r.predictedDemand90d) ? r.predictedDemand90d : 0,
          trend: r.trend
        }));
    }
    return [];
  }, [usingML, hasEnoughDataForML, recommendations, activeProducts]);

  const getCurrentDisplayDemand = (item: ForecastDisplayData) => {
    return item.predictedDemand30d;
  };

  // HEATMAP_DATA - only from active (non-archived) products
  const HEATMAP_DATA = useMemo(() => {
    const categoryStats = activeProducts.reduce((acc: any, product: any) => {
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

    const maxProfit = Math.max(...Object.values(categoryStats).map((c: any) => c.totalProfit), 1);
    const maxVolume = Math.max(...Object.values(categoryStats).map((c: any) => c.totalVolume), 1);

    // Sort categories by profit (highest first)
    const sortedCategories = Object.entries(categoryStats)
      .map(([category, data]: [string, any]) => ({
        category,
        profit: maxProfit > 0 ? Math.round((data.totalProfit / maxProfit) * 100) : 0,
        volume: maxVolume > 0 ? Math.round((data.totalVolume / maxVolume) * 100) : 0,
        color: CATEGORY_COLORS[category] || CATEGORY_COLORS['Unknown']
      }))
      .sort((a, b) => b.profit - a.profit);

    return sortedCategories;
  }, [activeProducts]);

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

  // DEADSTOCK_DATA - only from active (non-archived) products
  // For deadstock calculation, we only care about completed sales
  // Replacement transactions do not count as new sales for deadstock purposes
  const completedTransactionsForDeadstock = useMemo(() => {
    return transactions.filter((t: any) => t.status === 'completed');
  }, [transactions]);

  const DEADSTOCK_DATA: DeadstockItem[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadstockItems: DeadstockItem[] = [];

    for (const p of activeProducts) {
      if (p.stock <= 0) continue;
      
      // Only use COMPLETED transactions for deadstock calculation
      // Replacement transactions do not count as sales for deadstock purposes
      const salesForProduct = completedTransactionsForDeadstock
        .filter((t: any) => t.items.some((item: any) => item.id === p.id))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const lastSale = salesForProduct[0];
      
      let daysSinceSale = 0;
      let lastSaleDate: Date | null = null;
      let neverSold = false;
      
      if (lastSale) {
        lastSaleDate = new Date(lastSale.date);
        lastSaleDate.setHours(0, 0, 0, 0);
        daysSinceSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        neverSold = true;
        const createdDate = getDateFromTimestamp((p as any).createdAt);
        
        if (createdDate) {
          createdDate.setHours(0, 0, 0, 0);
          daysSinceSale = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          daysSinceSale = p.lastMovedDaysAgo || 0;
        }
        lastSaleDate = null;
      }
      
      if (daysSinceSale >= 30) {
        const lockedCapital = p.stock * p.markupPrice;
        const mlSuggestion = deadstockSuggestions.get(p.id);
        
        const totalQuantitySold = salesForProduct.reduce((sum, sale) => 
          sum + (sale.items.find((item: any) => item.id === p.id)?.quantity || 0), 0);
        const historicalVelocity = totalQuantitySold / Math.max(1, daysSinceSale) * 30;
        
        deadstockItems.push({
          id: p.sku || p.id.slice(0, 8),
          name: p.name,
          category: p.category,
          stock: p.stock,
          daysSinceSale: daysSinceSale,
          lockedCapital: lockedCapital,
          priority: (daysSinceSale > 90 ? 'high' : daysSinceSale > 60 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
          lastSaleDate: lastSaleDate,
          aiSuggestion: mlSuggestion?.suggestion || null,
          aiSuggestionType: mlSuggestion?.suggestionType || null,
          recommendedDiscount: mlSuggestion?.recommendedDiscount || null,
          baseCost: p.baseCost,
          markupPrice: p.markupPrice,
          historicalVelocity: historicalVelocity
        });
      }
    }

    deadstockItems.sort((a, b) => b.lockedCapital - a.lockedCapital);
    return deadstockItems;
  }, [activeProducts, completedTransactionsForDeadstock, usingML, deadstockSuggestions]);

  // Generate forecast explanation with recommended order and stockout date
  const generateForecastExplanation = (item: ForecastDisplayData): ForecastExplanation => {
    const monthlyForecasts = [
      { month: nextThreeMonths[0], predictedDemand: item.predictedDemand30d }
    ];
    
    return {
      productId: item.name,
      productName: item.name,
      currentStock: item.currentStock,
      recommendedOrder: item.recommendedOrder,
      stockoutDay: item.stockoutDay,
      monthlyForecasts,
      trend: item.trend
    };
  };

  // Show loading only on first load when no data is available
  const isLoading = (!mlDataLoaded && mlLoading) || (products.length === 0 && !mlDataLoaded);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A] mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Loading dashboard data...</p>
          <p className="text-slate-400 text-xs mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  const openForecastExplanation = (item: ForecastDisplayData) => {
    setSelectedForecastProduct(item);
    setShowForecastExplanationModal(true);
  };

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="min-h-screen p-4 space-y-4"
      >
        {/* ML Status Message - Only show when data is loaded */}
        {mlDataLoaded && (
          <>
            {mlLoading && (
              <motion.div 
                variants={itemVariants}
                className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Refreshing AI insights in background...
              </motion.div>
            )}

            {!mlLoading && usingML && hasEnoughDataForML && mlServiceAvailable && (
              <motion.div 
                variants={itemVariants}
                className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                AI-Powered Forecasts Active - Demand predictions and Deadstock Suggestion using Prophet ML model
              </motion.div>
            )}

            {!mlLoading && (!usingML || !mlServiceAvailable) && mlServiceChecked && (
              <motion.div 
                variants={itemVariants}
                className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700 flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                Prophet Unavailable - AI features disabled.
              </motion.div>
            )}

            {!mlLoading && !usingML && mlServiceAvailable && mlServiceChecked && hasEnoughDataForML && (
              <motion.div 
                variants={itemVariants}
                className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700 flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                ML Service available but insufficient data for predictions. Need more sales transactions.
              </motion.div>
            )}
          </>
        )}

        {/* Stats Cards */}
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {STATS_DATA.map((stat: StatData) => (
            <StatCard key={stat.id} data={stat} />
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Low Stock Alerts */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
          >
            <div className="p-4 sm:p-5 border-b border-gray-100">
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
                {lowStockItems.length > 3 && (
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
            
            <div className="p-4 sm:p-5 pt-0">
              <div className="space-y-3">
                {lowStockItems.slice(0, 3).map((item) => (
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

          {/* Deadstock Impact Card */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden flex flex-col relative"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-400"></div>
            <div className="p-4 sm:p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <AlertTriangle className="text-red-600 w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      Deadstock Items
                    </h2>
                    <p className="text-xs font-medium text-red-600">
                      Items without sales (30+ days)
                    </p>
                  </div>
                </div>
                {DEADSTOCK_DATA.length > 3 && (
                  <button
                    onClick={() => setShowDeadstockModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                  >
                    <Eye size={14} />
                    View All ({DEADSTOCK_DATA.length})
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                Monitors slow-moving inventory that ties up capital. AI analyzes each item to recommend optimal discounts.
              </p>

              <div className="space-y-3">
                {DEADSTOCK_DATA.slice(0, 2).map((item: DeadstockItem) => {
                  const hasAISuggestion = usingML && item.aiSuggestion;
                  const suggestionType = hasAISuggestion ? item.aiSuggestionType : 'info';
                  const daysToShow = item.daysSinceSale;
                  const isAILoading = mlLoading && hasEnoughDataForML;
                  
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedDeadstock(item)}
                      className="p-3 bg-white border border-gray-200 rounded-lg space-y-2 hover:shadow-md transition-all cursor-pointer hover:border-blue-300"
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 pr-3 flex-1">
                          <h4 className="text-sm font-semibold text-gray-800 truncate">
                            {item.name}
                          </h4>
                          <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 flex-wrap">
                            <Clock size={12}/> {daysToShow} Days Unsold • {item.stock} units
                          </span>
                        </div>
                        <div className="text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded shrink-0 ml-2">
                          ₱{item.lockedCapital.toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-100 pt-2">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                          {usingML && hasAISuggestion ? 'AI SUGGESTION' : isAILoading ? 'AI SUGGESTION (LOADING)' : 'STATUS'}
                        </p>
                        <div className={`bg-gray-50 border rounded p-2 flex items-center justify-between ${
                          suggestionType === 'critical' ? 'border-red-200' : 
                          suggestionType === 'warning' ? 'border-orange-200' : 
                          'border-blue-200'
                        }`}>
                          {isAILoading && !item.aiSuggestion ? (
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                              <p className="text-xs text-gray-500">Analyzing item...</p>
                            </div>
                          ) : (
                            <p className={`text-xs ${
                              suggestionType === 'critical' ? 'text-red-600' : 
                              suggestionType === 'warning' ? 'text-orange-600' : 
                              'text-blue-600'
                            } leading-relaxed flex-1`}>
                              {item.aiSuggestion || `Item unsold for ${daysToShow} days`}
                            </p>
                          )}
                          <ChevronRight size={16} className="text-gray-400 ml-2 flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {DEADSTOCK_DATA.length === 0 && (
                  <div className="text-center py-8">
                    <Package size={32} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm text-gray-500">No deadstock items identified</p>
                    <p className="text-xs text-gray-400 mt-1">Items with no sales in 30+ days will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Demand Forecasting Card */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
          >
            <div className="p-4 sm:p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Package className="text-[#047857] w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      Demand Forecasting
                    </h2>
                    <p className="text-xs font-medium text-blue-600">
                      {usingML && hasEnoughDataForML && mlServiceAvailable ? 'AI Predictive Insight' : 'Data Analysis'}
                    </p>
                  </div>
                </div>
                {FORECAST_DATA.length > 3 && (
                  <button
                    onClick={() => setShowForecastModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                  >
                    <Eye size={14} />
                    View All ({FORECAST_DATA.length})
                  </button>
                )}
              </div>
              
              {usingML && hasEnoughDataForML && FORECAST_DATA.length > 0 && mlServiceAvailable && (
                <div className="flex items-center bg-gray-50 p-1 rounded-lg mt-3 w-fit">
                  <div className="px-3 py-1.5 text-xs font-bold bg-white text-[#0B3C8A] shadow-sm rounded-md">
                    {nextThreeMonths[0]} Forecast
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 sm:p-5 pt-0">
              {mlLoading && hasEnoughDataForML && (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                  </div>
                  <p className="text-sm text-gray-600">Loading AI forecasts...</p>
                  <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
                </div>
              )}
              {!mlLoading && usingML && hasEnoughDataForML && FORECAST_DATA.length > 0 && mlServiceAvailable ? (
                <div className="space-y-3">
                  {FORECAST_DATA.slice(0, 3).map((item: ForecastDisplayData, i: number) => (
                    <ForecastCard 
                      key={i}
                      data={item}
                      selectedMonth={nextThreeMonths[0]}
                      onClick={() => openForecastExplanation(item)}
                    />
                  ))}
                </div>
              ) : !mlLoading ? (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <Database size={20} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">
                    {!mlServiceAvailable 
                      ? "Prophet ML service is currently unavailable" 
                      : !hasEnoughDataForML 
                      ? "Insufficient data for ML predictions"
                      : "No recommendations at this time"}
                  </p>
                  {!hasEnoughDataForML && mlServiceAvailable && (
                    <p className="text-xs text-gray-400 mt-2">
                      Need {MIN_TRANSACTIONS_FOR_ML - allTransactions.length} more sales for accurate predictions
                    </p>
                  )}
                  {!mlServiceAvailable && (
                    <p className="text-xs text-gray-400 mt-2">
                      ML service is not responding. Showing historical data only.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>

          {/* Performance Heatmap */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full"
          >
            <div className="p-4 sm:p-5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <BarChart3 className="text-emerald-700 w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Performance Heatmap</h2>
                  <p className="text-xs text-gray-500">Profit vs. Volume Analysis</p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-0 flex-1">
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Identifies which categories generate the most revenue (Solid Color)
                relative to how many physical units are sold (Gray Overlay).
              </p>

              <div className="space-y-4">
                {HEATMAP_DATA.length > 0 ? (
                  HEATMAP_DATA.map((item, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-gray-700">{item.category}</span>
                      </div>
                      <div className="relative h-6 bg-gray-100 rounded-md overflow-hidden flex">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.profit}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`${item.color} h-full flex items-center px-2 text-[10px] font-bold whitespace-nowrap z-10 text-white`}
                        >
                          Profit {item.profit}%
                        </motion.div>
                        <div
                          className="absolute top-0 right-0 h-full border-l-2 border-dashed border-gray-400 bg-gray-200/50 flex items-center justify-end px-2 text-[10px] font-bold text-gray-700"
                          style={{ width: `${100 - item.volume}%` }}
                        >
                          Vol {item.volume}%
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No product data available.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
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

      {/* Deadstock Modal */}
      <AnimatePresence>
        {showDeadstockModal && (
          <Modal
            title="Deadstock Impact Analysis"
            onClose={() => setShowDeadstockModal(false)}
          >
            <div className="space-y-3">
              {DEADSTOCK_DATA.map((item) => {
                const hasAISuggestion = usingML && item.aiSuggestion;
                const suggestionType = hasAISuggestion ? item.aiSuggestionType : 'info';
                const daysToShow = item.daysSinceSale;
                
                return (
                  <div 
                    key={item.id} 
                    onClick={() => {
                      setShowDeadstockModal(false);
                      setSelectedDeadstock(item);
                    }}
                    className="p-3 bg-white border border-gray-200 rounded-lg space-y-2 hover:shadow-md transition-all cursor-pointer hover:border-blue-300"
                  >
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 pr-3 flex-1">
                        <h4 className="text-sm font-semibold text-gray-800 truncate">
                          {item.name}
                        </h4>
                        <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 flex-wrap">
                          <Clock size={12}/> {daysToShow} Days Unsold • {item.stock} units
                        </span>
                      </div>
                      <div className="text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded shrink-0 ml-2">
                        ₱{item.lockedCapital.toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-100 pt-2">
                      <div className={`bg-gray-50 border rounded p-2 flex items-center justify-between ${
                        suggestionType === 'critical' ? 'border-red-200' : 
                        suggestionType === 'warning' ? 'border-orange-200' : 
                        'border-blue-200'
                      }`}>
                        <p className={`text-xs ${
                          suggestionType === 'critical' ? 'text-red-600' : 
                          suggestionType === 'warning' ? 'text-orange-600' : 
                          'text-blue-600'
                        } leading-relaxed flex-1`}>
                          {item.aiSuggestion || `Item unsold for ${daysToShow} days`}
                        </p>
                        <ChevronRight size={16} className="text-gray-400 ml-2 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Forecast Modal */}
      <AnimatePresence>
        {showForecastModal && (
          <Modal
            title="Demand Forecasting - All Products"
            onClose={() => setShowForecastModal(false)}
          >
            <div className="space-y-3">
              {FORECAST_DATA.map((item, i) => (
                <ForecastCard 
                  key={i}
                  data={item}
                  selectedMonth={nextThreeMonths[0]}
                  onClick={() => {
                    setShowForecastModal(false);
                    openForecastExplanation(item);
                  }}
                />
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Forecast Explanation Modal with Stockout Date */}
      <AnimatePresence>
        {showForecastExplanationModal && selectedForecastProduct && (
          <SimplifiedForecastExplanationModal
            explanation={generateForecastExplanation(selectedForecastProduct)}
            onClose={() => setShowForecastExplanationModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Deadstock Analysis Modal */}
      <AnimatePresence>
        {selectedDeadstock && (
          <DeadstockAnalysisModal
            item={selectedDeadstock}
            onClose={() => setSelectedDeadstock(null)}
            analysis={calculateDetailedAnalysis(selectedDeadstock)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Helper function for deadstock analysis
function calculateDetailedAnalysis(item: DeadstockItem) {
  if (!item) return null;
  
  const originalPrice = item.markupPrice || 0;
  const baseCost = item.baseCost || 0;
  const discountPercent = item.recommendedDiscount || 0;
  const discountedPrice = originalPrice * (1 - discountPercent / 100);
  const profitPerUnit = originalPrice - baseCost;
  const profitAfterDiscount = discountedPrice - baseCost;
  const totalProfitOriginal = profitPerUnit * item.stock;
  const totalProfitAfterDiscount = profitAfterDiscount * item.stock;
  const totalRecovered = discountedPrice * item.stock;
  const totalBaseCost = baseCost * item.stock;
  
  const recoversCost = profitAfterDiscount > 0;
  
  return {
    originalPrice,
    baseCost,
    discountedPrice,
    profitPerUnit,
    profitAfterDiscount,
    totalProfitOriginal,
    totalProfitAfterDiscount,
    totalRecovered,
    totalBaseCost,
    discountPercentage: discountPercent,
    recoversCost
  };
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

// Forecast Card Component
function ForecastCard({ data, selectedMonth, onClick }: { 
  data: ForecastDisplayData; 
  selectedMonth: string;
  onClick: () => void;
}) {
  const orderQuantity = data.recommendedOrder;
  const needsReorder = orderQuantity > 0;
  
  const getStockoutDate = (stockoutDay: number, forecastMonth: string): string => {
    if (stockoutDay >= 30) return "End of month";
    return `${forecastMonth} ${stockoutDay}`;
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 hover:shadow-md transition-all cursor-pointer hover:border-blue-300"
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 pr-3 flex-1">
          <h4 className="text-sm font-semibold text-gray-800 truncate">
            {data.name}
          </h4>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div>
          <p className="text-gray-500 text-[10px] font-medium">Current Stock</p>
          <p className="font-bold text-gray-900 text-sm">
            {data.currentStock} units
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px] font-medium">{selectedMonth} Forecast</p>
          <p className="font-bold text-[#0B3C8A] text-sm">
            {data.predictedDemand30d} units
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px] font-medium">Order</p>
          <p className="font-bold text-emerald-600 text-sm">
            {orderQuantity} units
          </p>
        </div>
      </div>
      
      <div className="border-t border-gray-100 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Package size={12} />
            {needsReorder 
              ? `Stockout: ${getStockoutDate(data.stockoutDay, selectedMonth)} • Order ${orderQuantity} units`
              : "Stock Sufficient"}
          </div>
          <ChevronRight size={14} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
}

// Forecast Explanation Modal
function SimplifiedForecastExplanationModal({ 
  explanation, 
  onClose 
}: { 
  explanation: ForecastExplanation; 
  onClose: () => void;
}) {
  const recommendedOrder = explanation.recommendedOrder;
  const currentStock = explanation.currentStock;
  const totalForecast = explanation.monthlyForecasts[0]?.predictedDemand || 0;
  const forecastMonth = explanation.monthlyForecasts[0]?.month || "May";
  const stockoutDay = explanation.stockoutDay;
  
  const getStockoutDate = (): string => {
    if (stockoutDay >= 30) return "end of month";
    return `${forecastMonth} ${stockoutDay}`;
  };
  
  const getOrderByDate = (): string => {
    if (stockoutDay >= 30) return `${forecastMonth} ${Math.max(1, 30 - 5)}`;
    const orderDay = Math.max(1, stockoutDay - 5);
    return `${forecastMonth} ${orderDay}`;
  };
  
  const needsReorder = recommendedOrder > 0;
  const stockoutDate = getStockoutDate();
  const orderByDate = getOrderByDate();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <h2 className="text-xl font-bold text-gray-800">{explanation.productName}</h2>
          <p className="text-sm text-gray-500 mt-1">{forecastMonth} Forecast</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-5xl font-bold text-[#0B3C8A]">{totalForecast}</p>
            <p className="text-sm text-gray-500 mt-2">units forecasted</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Current Stock</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{currentStock} <span className="text-sm font-normal">units</span></p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Recommended Order</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{recommendedOrder} <span className="text-sm font-normal">units</span></p>
            </div>
          </div>

          {needsReorder && (
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
              <p className="text-sm text-orange-800">
                <span className="font-semibold">Stockout Date:</span> {stockoutDate}
              </p>
              <p className="text-sm text-orange-800 mt-1">
                Covers demand from <span className="font-semibold">{stockoutDate}</span> through end of month
              </p>
            </div>
          )}

          {!needsReorder && (
            <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
              <p className="text-sm text-emerald-700 font-medium">✓ Stock Sufficient</p>
              <p className="text-xs text-emerald-600 mt-1">No reorder needed at this time</p>
            </div>
          )}

          {needsReorder && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-sm text-blue-800">
                Order <span className="font-bold">{recommendedOrder} units</span> by <span className="font-bold">{orderByDate}</span>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Order now to ensure delivery before stockout on {stockoutDate}
              </p>
            </div>
          )}

          <div className={`rounded-xl p-4 border ${
            explanation.trend === 'up' ? 'bg-emerald-50 border-emerald-100' : 
            explanation.trend === 'down' ? 'bg-red-50 border-red-100' : 
            'bg-gray-50 border-gray-100'
          }`}>
            <div className="flex items-center gap-3">
              {explanation.trend === 'up' && <TrendingUp size={20} className="text-emerald-600" />}
              {explanation.trend === 'down' && <TrendingDown size={20} className="text-red-600" />}
              {explanation.trend === 'stable' && <Minus size={20} className="text-gray-500" />}
              <div>
                <p className={`text-sm font-semibold ${
                  explanation.trend === 'up' ? 'text-emerald-700' : 
                  explanation.trend === 'down' ? 'text-red-700' : 
                  'text-gray-700'
                }`}>
                  {explanation.trend === 'up' ? 'Increasing Demand' : 
                   explanation.trend === 'down' ? 'Decreasing Demand' : 
                   'Stable Demand'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {explanation.trend === 'up' 
                    ? "Based on recent sales patterns, demand is expected to grow"
                    : explanation.trend === 'down'
                    ? "Based on recent sales patterns, demand is expected to decline"
                    : "Based on recent sales patterns, demand is expected to remain steady"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button 
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ data }: { data: StatData }) {
  let Icon = Banknote;
  let themeColor = "blue";

  if (data.id === "low_stock") {
    Icon = AlertTriangle;
    themeColor = "orange";
  } else if (data.id === "gross_profit") {
    Icon = Banknote;
    themeColor = "emerald";
  } else if (data.id === "total_revenue") {
    Icon = Banknote;
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
      className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100"
    >
      <div className="flex justify-between items-start">
        <div className={`p-2 sm:p-3 rounded-lg ${currentStyle.bg} mb-3`}>
          <Icon size={18} className={`${currentStyle.icon} sm:w-5 sm:h-5`} />
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-bold ${currentStyle.badge}`}
        >
          {data.trend}
        </span>
      </div>
      <h3 className="text-xl sm:text-2xl font-bold text-gray-800">{data.value}</h3>
      <p className="text-xs sm:text-sm text-gray-500 mt-1">{data.label}</p>
    </motion.div>
  );
}

// Deadstock Analysis Modal Component
function DeadstockAnalysisModal({ 
  item, 
  onClose, 
  analysis 
}: { 
  item: DeadstockItem; 
  onClose: () => void; 
  analysis: any;
}) {
  if (!analysis) return null;
  
  const getDiscountProgression = () => {
    const days = item.daysSinceSale;
    if (days >= 90) return "Maximum discount range (22-25%)";
    if (days >= 70) return "Accelerated discount range (18-20%)";
    if (days >= 50) return "Moderate discount range (12-15%)";
    if (days >= 30) return "Initial discount range (5-8%)";
    return "No discount recommended";
  };
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-white p-5 border-b border-gray-200 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-800">{item.name}</h2>
              <p className="text-sm text-gray-500 mt-1">SKU: {item.id} • {item.category}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <AlertCircle size={18} className="text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-800">AI Recommendation</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{item.aiSuggestion || 'No AI suggestion available'}</p>
            {item.recommendedDiscount && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-full">
                <Percent size={14} className="text-red-600" />
                <span className="text-sm font-bold text-red-700">{item.recommendedDiscount}% Recommended Discount</span>
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-emerald-100 rounded-lg">
                <DollarSign size={18} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-800">Financial Impact Analysis</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Base Cost</p>
                <p className="text-lg font-bold text-gray-900">₱{analysis.baseCost.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Retail Price</p>
                <p className="text-lg font-bold text-gray-900">₱{analysis.originalPrice.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">After Discount</p>
                <p className="text-lg font-bold text-blue-700">₱{analysis.discountedPrice.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Profit per unit (original)</span>
                <span className="font-semibold text-gray-900">₱{analysis.profitPerUnit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Profit per unit (after discount)</span>
                <span className={`font-semibold ${analysis.profitAfterDiscount > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  ₱{analysis.profitAfterDiscount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Total base cost</span>
                <span className="font-semibold text-gray-900">₱{analysis.totalBaseCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Total recovered amount</span>
                <span className="font-semibold text-green-700">₱{analysis.totalRecovered.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-700">Total profit after discount</span>
                <span className={`font-bold ${analysis.totalProfitAfterDiscount > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  ₱{analysis.totalProfitAfterDiscount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-800">Days Unsold</span>
                  <span className="text-lg font-bold text-orange-600">{item.daysSinceSale} days</span>
                </div>
                <p className="text-xs text-gray-600">
                  {item.daysSinceSale >= 90 
                    ? "Product has been unsold for over 3 months - maximum discount urgency" 
                    : item.daysSinceSale >= 60 
                    ? "Product has been unsold for 2-3 months - high discount urgency"
                    : item.daysSinceSale >= 30 
                    ? "Product has been unsold for 1-2 months - moderate discount urgency"
                    : "Product recently sold - minimal discount needed"}
                </p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (item.daysSinceSale / 90) * 100)}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">{getDiscountProgression()}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-800">Capital Locked</span>
                  <span className="text-lg font-bold text-red-600">₱{item.lockedCapital.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {item.lockedCapital > 100000 
                    ? "High capital exposure - faster recovery recommended" 
                    : item.lockedCapital > 50000 
                    ? "Moderate capital exposure - recovery encouraged"
                    : "Lower capital exposure - flexible timeline"}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  Locked capital = {item.stock} units × ₱{item.markupPrice?.toLocaleString()}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-800">Product Category</span>
                  <span className="text-lg font-bold text-yellow-600">{item.category}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {item.category === 'Contact Lenses' || item.category === 'Solutions' 
                    ? "Perishable category - urgency factor applied to prevent expiry losses" 
                    : "Standard category - normal discount progression"}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-800">Historical Sales Velocity</span>
                  <span className="text-lg font-bold text-green-600">{item.historicalVelocity?.toFixed(0) || 0} units/month</span>
                </div>
                <p className="text-xs text-gray-600">
                  {item.historicalVelocity && item.historicalVelocity > 10 
                    ? "Strong historical sales - conservative discount approach" 
                    : item.historicalVelocity && item.historicalVelocity > 5
                    ? "Average historical sales - standard discount approach"
                    : "Limited historical sales - standard discount approach"}
                </p>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-gray-700 leading-relaxed">
                  The AI evaluates days unsold, capital exposure and historical sales performance to recommend 
                  an optimal discount that balances inventory clearance with business profitability.
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl p-4 ${analysis.recoversCost ? 'bg-green-100 border border-green-300' : 'bg-yellow-100 border border-yellow-300'}`}>
            <div className="flex items-center gap-2">
              {analysis.recoversCost ? (
                <CheckCircle2 size={18} className="text-green-700" />
              ) : (
                <AlertTriangle size={18} className="text-yellow-700" />
              )}
              <p className="text-sm font-semibold text-gray-800">
                {analysis.recoversCost 
                  ? "This discount recommendation ensures cost recovery while maintaining profitability." 
                  : "This product has low profit margin. Recommended discount is minimal to avoid loss."}
              </p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 p-4 border-t border-gray-200 rounded-b-2xl">
          <button onClick={onClose} className="w-full px-4 py-2.5 bg-[#0B3C8A] text-white rounded-lg font-medium hover:bg-[#082F6E] transition-colors">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}