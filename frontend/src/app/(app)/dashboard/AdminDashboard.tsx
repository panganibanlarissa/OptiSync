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
  predictedDemand30d: number;
  predictedDemand60d: number;
  predictedDemand90d: number;
  trend: 'up' | 'down' | 'stable';
}

interface ForecastExplanation {
  productId: string;
  productName: string;
  currentStock: number;
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
  const { loading, recommendations, forecastData, usingML, dataLoaded, deadstockSuggestions } = useMLForecasting();

  const nextThreeMonths = useMemo(() => getNextThreeMonths(), []);

  const completedTransactions = useMemo(() => {
    return transactions.filter((t: any) => t.status === 'completed');
  }, [transactions]);

  const hasEnoughDataForML = useMemo(() => {
    return completedTransactions.length >= MIN_TRANSACTIONS_FOR_ML;
  }, [completedTransactions]);

  const todaySales = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return completedTransactions
      .filter((t: any) => {
        const transDate = new Date(t.date);
        transDate.setHours(0, 0, 0, 0);
        return transDate.getTime() === today.getTime();
      })
      .reduce((sum: number, t: any) => sum + t.total, 0);
  }, [completedTransactions]);

  const lowStockCount = useMemo(() => {
    return products.filter((p: any) => p.stock <= p.reorderPoint && p.stock > 0).length;
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

  const grossProfit = useMemo(() => {
    return completedTransactions.reduce((sum: number, t: any) => {
      const profit = t.items.reduce((itemSum: number, item: any) => {
        const product = products.find((p: any) => p.id === item.id);
        if (product) {
          return itemSum + ((product.markupPrice - product.baseCost) * item.quantity);
        }
        return itemSum;
      }, 0);
      return sum + profit;
    }, 0);
  }, [completedTransactions, products]);

  const totalRevenue = useMemo(() => {
    return completedTransactions.reduce((sum: number, t: any) => sum + t.total, 0);
  }, [completedTransactions]);

  const previousPeriodRevenue = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    return completedTransactions
      .filter((t: any) => {
        const transDate = new Date(t.date);
        return t.status === 'completed' && transDate >= lastMonth && transDate <= lastMonthEnd;
      })
      .reduce((sum: number, t: any) => sum + t.total, 0);
  }, [completedTransactions]);

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
        trend: "+18%",
        trendType: "positive",
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
        trend: "+15%",
        trendType: "positive",
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

  const FORECAST_DATA: ForecastDisplayData[] = useMemo(() => {
    if (usingML && hasEnoughDataForML && recommendations && recommendations.length > 0) {
      return recommendations.map((r: Recommendation) => ({
        name: r.productName,
        currentStock: r.currentStock,
        predictedDemand30d: typeof r.predictedDemand30d === 'number' && !isNaN(r.predictedDemand30d) ? r.predictedDemand30d : 0,
        predictedDemand60d: typeof r.predictedDemand60d === 'number' && !isNaN(r.predictedDemand60d) ? r.predictedDemand60d : 0,
        predictedDemand90d: typeof r.predictedDemand90d === 'number' && !isNaN(r.predictedDemand90d) ? r.predictedDemand90d : 0,
        trend: r.trend
      }));
    }
    return [];
  }, [usingML, hasEnoughDataForML, recommendations]);

  const getCurrentDisplayDemand = (item: ForecastDisplayData) => {
    switch (selectedForecastMonth) {
      case 1:
        return item.predictedDemand60d;
      case 2:
        return item.predictedDemand90d;
      default:
        return item.predictedDemand30d;
    }
  };

  const HEATMAP_DATA = useMemo(() => {
    const categoryStats = products.reduce((acc: any, product: any) => {
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

    return Object.entries(categoryStats).map(([category, data]: [string, any]) => ({
      category,
      profit: maxProfit > 0 ? Math.round((data.totalProfit / maxProfit) * 100) : 0,
      volume: maxVolume > 0 ? Math.round((data.totalVolume / maxVolume) * 100) : 0,
      color: CATEGORY_COLORS[category] || CATEGORY_COLORS['Unknown']
    }));
  }, [products]);

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

  const DEADSTOCK_DATA: DeadstockItem[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadstockItems: DeadstockItem[] = [];

    for (const p of products) {
      if (p.stock <= 0) continue;
      
      const salesForProduct = completedTransactions
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
  }, [products, completedTransactions, usingML, deadstockSuggestions]);

  const generateForecastExplanation = (item: ForecastDisplayData): ForecastExplanation => {
    const monthlyForecasts = [
      { month: nextThreeMonths[0], predictedDemand: item.predictedDemand30d },
      { month: nextThreeMonths[1], predictedDemand: item.predictedDemand60d },
      { month: nextThreeMonths[2], predictedDemand: item.predictedDemand90d }
    ];
    
    return {
      productId: item.name,
      productName: item.name,
      currentStock: item.currentStock,
      monthlyForecasts,
      trend: item.trend
    };
  };

  if (loading && !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
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
        {usingML && hasEnoughDataForML && dataLoaded && (
          <motion.div 
            variants={itemVariants}
            className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2"
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            AI-Powered Forecasts Active
          </motion.div>
        )}

        {!usingML && dataLoaded && (
          <motion.div 
            variants={itemVariants}
            className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 flex items-center gap-2"
          >
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            Showing actual sales only.
          </motion.div>
        )}

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
                          {usingML && hasAISuggestion ? 'SUGGESTION' : 'STATUS'}
                        </p>
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
          {/* Demand Forecasting Card - Updated with clickable product cards */}
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
                      {usingML && hasEnoughDataForML ? 'AI Predictive Insight' : 'Data Analysis'}
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
              
              {usingML && hasEnoughDataForML && FORECAST_DATA.length > 0 && (
                <div className="flex items-center bg-gray-50 p-1 rounded-lg mt-3 w-fit">
                  {nextThreeMonths.map((month, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedForecastMonth(idx)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                        selectedForecastMonth === idx 
                          ? "bg-white text-[#0B3C8A] shadow-sm" 
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {month.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 sm:p-5 pt-0">
              {usingML && hasEnoughDataForML && FORECAST_DATA.length > 0 ? (
                <div className="space-y-3">
                  {FORECAST_DATA.slice(0, 3).map((item: ForecastDisplayData, i: number) => (
                    <ForecastCard 
                      key={i}
                      data={item} 
                      currentDemand={getCurrentDisplayDemand(item)}
                      selectedMonth={nextThreeMonths[selectedForecastMonth]}
                      onClick={() => openForecastExplanation(item)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <Database size={20} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">
                    {!usingML 
                      ? "Prediction service is currently unavailable" 
                      : !hasEnoughDataForML 
                      ? "Insufficient data for predictions"
                      : "No recommendations at this time"}
                  </p>
                  {!hasEnoughDataForML && usingML && (
                    <p className="text-xs text-gray-400 mt-2">
                      Need {MIN_TRANSACTIONS_FOR_ML - completedTransactions.length} more sales for accurate predictions
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Performance Heatmap */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <BarChart3 className="text-emerald-700 w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    Performance Heatmap
                  </h2>
                  <p className="text-xs text-gray-500">
                    Profit vs. Volume Analysis
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Identifies which categories generate the most revenue (Solid Color)
                relative to how many physical units are sold (Gray Overlay).
              </p>

              <div className="space-y-4">
                {HEATMAP_DATA.length > 0 ? (
                  HEATMAP_DATA.map((item: any, idx: number) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-gray-700">
                          {item.category}
                        </span>
                      </div>
                      <div className="relative h-6 bg-gray-100 rounded-md overflow-hidden flex">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.profit}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`${item.color} h-full flex items-center px-2 text-[10px] font-bold whitespace-nowrap z-10 text-gray-900`}
                        >
                          Profit {item.profit}%
                        </motion.div>
                        <div
                          className="absolute top-0 right-0 h-full border-l-2 border-dashed border-gray-400 bg-gray-200/50 flex items-center justify-end px-2 text-[10px] font-bold text-gray-800"
                          style={{ width: `${100 - item.volume}%` }}
                        >
                          Vol {item.volume}%
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No product data available.
                  </p>
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

      {/* Forecast Modal - Using clickable cards */}
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
                  currentDemand={getCurrentDisplayDemand(item)}
                  selectedMonth={nextThreeMonths[selectedForecastMonth]}
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

      {/* Simplified Forecast Explanation Modal */}
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

// Forecast Card Component - Clickable card (similar to Deadstock Impact design)
function ForecastCard({ data, currentDemand, selectedMonth, onClick }: { 
  data: ForecastDisplayData; 
  currentDemand: number; 
  selectedMonth: string;
  onClick: () => void;
}) {
  const orderQuantity = Math.max(0, currentDemand - data.currentStock);
  const needsReorder = orderQuantity > 0;

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
            {currentDemand} units
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
            {needsReorder ? `Order ${orderQuantity} Units for ${selectedMonth}` : "Stock Sufficient"}
          </div>
          <ChevronRight size={14} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
}

// Simplified Forecast Explanation Modal
function SimplifiedForecastExplanationModal({ 
  explanation, 
  onClose 
}: { 
  explanation: ForecastExplanation; 
  onClose: () => void;
}) {
  const recommendedOrder = Math.max(0, explanation.monthlyForecasts[0].predictedDemand - explanation.currentStock);
  
  const getTrendDisplay = () => {
    if (explanation.trend === 'up') {
      return { icon: <TrendingUp size={20} className="text-green-600" />, text: 'Increasing', color: 'text-green-600', bg: 'bg-green-50' };
    } else if (explanation.trend === 'down') {
      return { icon: <TrendingDown size={20} className="text-red-600" />, text: 'Decreasing', color: 'text-red-600', bg: 'bg-red-50' };
    } else {
      return { icon: <Minus size={20} className="text-gray-500" />, text: 'Stable', color: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };
  
  const trendDisplay = getTrendDisplay();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-white p-5 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package size={18} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Forecast Details</h2>
                <p className="text-xs text-gray-500">{explanation.productName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Current Stock Summary */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">Current Stock</span>
              <span className="text-xl font-bold text-gray-800">{explanation.currentStock} units</span>
            </div>
          </div>

          {/* Monthly Forecasts */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Forecast</h3>
            <div className="space-y-3">
              {explanation.monthlyForecasts.map((forecast, idx) => (
                <div key={idx} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800">{forecast.month}</span>
                    <span className="text-xl font-bold text-blue-600">{forecast.predictedDemand} units</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trend Summary */}
          <div className={`${trendDisplay.bg} rounded-xl p-4 border border-gray-200`}>
            <div className="flex items-center gap-2">
              {trendDisplay.icon}
              <span className={`text-sm font-semibold ${trendDisplay.color}`}>
                {trendDisplay.text} Demand
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {explanation.trend === 'up' 
                ? "Based on recent sales patterns, demand for this product is expected to grow."
                : explanation.trend === 'down'
                ? "Based on recent sales patterns, demand for this product is expected to decline."
                : "Based on recent sales patterns, demand for this product is expected to remain steady."}
            </p>
          </div>

          {/* Action Recommendation */}
          <div className="bg-gradient-to-r from-[#0B3C8A] to-blue-700 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Package size={16} />
              <h3 className="text-sm font-bold">Recommended Action</h3>
            </div>
            <p className="text-base font-bold">
              {explanation.trend === 'up' 
                ? `Order ${recommendedOrder} units for ${explanation.monthlyForecasts[0].month}`
                : explanation.trend === 'down'
                ? "Review stock levels - reducing orders recommended"
                : "Maintain current stock levels"}
            </p>
          </div>
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
              <h3 className="font-bold text-gray-800">AI Recommendation Summary</h3>
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