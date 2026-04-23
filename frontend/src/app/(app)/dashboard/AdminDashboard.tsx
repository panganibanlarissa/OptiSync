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
  CheckCircle2
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
  priority: 'high' | 'medium' | 'low';
}

interface ChartDataPoint {
  label: string;
  fullLabel: string;
  actual: number;
  forecast: number;
  lower?: number;
  upper?: number;
  date: Date;
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
  mlFactors?: {
    daysFactor: number;
    capitalFactor: number;
    categoryUrgency: number;
    velocityFactor: number;
    finalDiscount: number;
  } | null;
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
const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("monthly");
  const [forecastPeriod, setForecastPeriod] = useState<30 | 60 | 90>(30);
  const [hoveredBar, setHoveredBar] = useState<{ label: string; fullLabel: string; actual: number; forecast: number } | null>(null);
  const [selectedDeadstock, setSelectedDeadstock] = useState<DeadstockItem | null>(null);
  const { products, transactions } = useFirebase();
  const { loading, recommendations, forecastData, usingML, dataLoaded, deadstockSuggestions } = useMLForecasting();

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

  const weeklySalesData = useMemo(() => {
    const today = new Date();
    const result: ChartDataPoint[] = [];
    
    const dayMultipliers: Record<string, number> = {
      'Sun': 0.7, 'Mon': 1.0, 'Tue': 1.0, 'Wed': 1.0, 'Thu': 1.1, 'Fri': 1.3, 'Sat': 1.2,
    };
    
    const hasMLForecastData = usingML && forecastData && forecastData.length > 0;
    const monthlyForecasts = hasMLForecastData ? forecastData.filter((f: ForecastDataPoint) => f.type === 'forecast') : [];
    const useMLForWeekly = hasMLForecastData && monthlyForecasts.length > 0;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      
      const daySales = completedTransactions
        .filter((t: any) => {
          const transDate = new Date(t.date);
          return transDate >= date && transDate < nextDate;
        })
        .reduce((sum: number, t: any) => sum + t.total, 0);
      
      const dayOfWeek = date.getDay();
      const dayName = WEEK_DAYS_SHORT[dayOfWeek];
      const fullDayName = WEEK_DAYS_FULL[dayOfWeek];
      
      let forecastValue = 0;
      
      if (useMLForWeekly) {
        const avgMonthlyForecast = monthlyForecasts.reduce((sum, f) => sum + f.value, 0) / monthlyForecasts.length;
        const avgDailyForecast = avgMonthlyForecast / 30;
        const dayMultiplier = dayMultipliers[dayName] || 1.0;
        forecastValue = Math.round(avgDailyForecast * dayMultiplier);
        const positionVariation = 0.9 + (i * 0.03);
        forecastValue = Math.round(forecastValue * positionVariation);
      }
      
      result.push({
        label: dayName,
        fullLabel: fullDayName,
        actual: daySales,
        forecast: forecastValue,
        date: date
      });
    }
    
    return result;
  }, [completedTransactions, forecastData, usingML]);

  const monthlySalesData = useMemo(() => {
    const year = new Date().getFullYear();
    const result: ChartDataPoint[] = [];
    
    const actualSalesByMonth: number[] = new Array(12).fill(0);
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      
      actualSalesByMonth[month] = completedTransactions
        .filter((t: any) => {
          const transDate = new Date(t.date);
          return transDate >= monthStart && transDate <= monthEnd;
        })
        .reduce((sum: number, t: any) => sum + t.total, 0);
    }
    
    const hasMLForecastData = usingML && forecastData && forecastData.length > 0;
    const monthlyForecasts = hasMLForecastData ? forecastData.filter((f: ForecastDataPoint) => f.type === 'forecast') : [];
    const useMLForMonthly = hasMLForecastData && monthlyForecasts.length > 0;
    
    for (let month = 0; month < 12; month++) {
      const actualSales = actualSalesByMonth[month];
      
      let predictedValue = 0;
      
      let mlForecastValue = null;
      if (useMLForMonthly) {
        const forecastPoint = forecastData.find((f: ForecastDataPoint) => f.month === SHORT_MONTH_NAMES[month]);
        if (forecastPoint && forecastPoint.type === 'forecast') {
          mlForecastValue = forecastPoint.value;
        }
      }
      
      if (mlForecastValue) {
        predictedValue = mlForecastValue;
      }
      
      result.push({
        label: SHORT_MONTH_NAMES[month],
        fullLabel: FULL_MONTH_NAMES[month],
        actual: actualSales,
        forecast: predictedValue,
        lower: Math.round(predictedValue * 0.7),
        upper: Math.round(predictedValue * 1.3),
        date: new Date(year, month, 1)
      });
    }
    
    return result;
  }, [completedTransactions, forecastData, usingML]);

  const chartData = activeTab === "weekly" ? weeklySalesData : monthlySalesData;
  
  const chartMaxValue = useMemo(() => {
    if (!chartData || chartData.length === 0) return 100000;
    const maxActual = Math.max(...chartData.map((d: ChartDataPoint) => d.actual));
    const maxForecast = usingML ? Math.max(...chartData.map((d: ChartDataPoint) => d.forecast)) : 0;
    const max = Math.max(maxActual, maxForecast);
    const roundedMax = Math.ceil(max / 20000) * 20000 || 100000;
    return roundedMax;
  }, [chartData, usingML]);

  const lowStockCount = useMemo(() => {
    return products.filter((p: any) => p.stock <= p.reorderPoint && p.stock > 0).length;
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
      return recommendations.map((r: Recommendation) => {
        const predictedDemand30d = typeof r.predictedDemand30d === 'number' && !isNaN(r.predictedDemand30d) 
          ? r.predictedDemand30d 
          : 0;
        const predictedDemand60d = typeof r.predictedDemand60d === 'number' && !isNaN(r.predictedDemand60d) 
          ? r.predictedDemand60d 
          : 0;
        const predictedDemand90d = typeof r.predictedDemand90d === 'number' && !isNaN(r.predictedDemand90d) 
          ? r.predictedDemand90d 
          : 0;
        
        return {
          name: r.productName,
          currentStock: r.currentStock,
          predictedDemand30d: predictedDemand30d,
          predictedDemand60d: predictedDemand60d,
          predictedDemand90d: predictedDemand90d,
          trend: r.trend,
          priority: r.confidence
        };
      });
    }
    return [];
  }, [usingML, hasEnoughDataForML, recommendations]);

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
          mlFactors: mlSuggestion?.mlFactors || null,
          baseCost: p.baseCost,
          markupPrice: p.markupPrice,
          historicalVelocity: historicalVelocity
        });
      }
    }

    deadstockItems.sort((a, b) => b.lockedCapital - a.lockedCapital);
    return deadstockItems;
  }, [products, completedTransactions, usingML, deadstockSuggestions]);

  if (loading && !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  const getCurrentDisplayDemand = (item: ForecastDisplayData) => {
    switch (forecastPeriod) {
      case 60:
        return item.predictedDemand60d;
      case 90:
        return item.predictedDemand90d;
      default:
        return item.predictedDemand30d;
    }
  };

  const handleBarHover = (label: string, fullLabel: string, actual: number, forecast: number) => {
    setHoveredBar({ label, fullLabel, actual, forecast });
  };

  const handleBarLeave = () => {
    setHoveredBar(null);
  };

  const calculateDetailedAnalysis = (item: DeadstockItem) => {
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
    
    const profitMargin = (profitPerUnit / originalPrice) * 100;
    const maxAllowedDiscount = Math.min(profitMargin * 0.8, 50);
    const recoversCost = profitAfterDiscount > 0;
    
    const daysFactor = item.mlFactors?.daysFactor || Math.min(1, item.daysSinceSale / 120);
    const capitalFactor = item.mlFactors?.capitalFactor || Math.min(1, item.lockedCapital / 200000);
    const categoryUrgency = item.mlFactors?.categoryUrgency || 1.0;
    const velocityFactor = item.mlFactors?.velocityFactor || 0;
    
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
      daysFactor,
      capitalFactor,
      categoryUrgency,
      velocityFactor,
      profitMargin,
      maxAllowedDiscount,
      recoversCost
    };
  };

  return (
    <>
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

        {!usingML && dataLoaded && (
          <motion.div 
            variants={itemVariants}
            className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-600 flex items-center gap-2"
          >
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            Showing actual sales only. AI predictions unavailable.
          </motion.div>
        )}

        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4"
        >
          {STATS_DATA.map((stat: StatData) => (
            <StatCard key={stat.id} data={stat} />
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 sm:p-2 bg-[#0B3C8A] rounded-lg">
                    <Activity className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                    Trend Visualization
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 ml-1">
                  <BarChart3 size={10} className="sm:w-3 sm:h-3" />
                  <span>Actual {usingML ? 'vs. AI Predicted Sales' : 'Sales Only'}</span>
                </div>
              </div>

              <div className="bg-gray-100 p-0.5 sm:p-1 rounded-lg flex text-xs sm:text-sm font-medium">
                <button
                  onClick={() => setActiveTab("weekly")}
                  className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-md transition-all text-[11px] sm:text-sm ${
                    activeTab === "weekly"
                      ? "bg-white text-[#0B3C8A] shadow-sm font-semibold"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Weekly Sales
                </button>
                <button
                  onClick={() => setActiveTab("monthly")}
                  className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-md transition-all text-[11px] sm:text-sm ${
                    activeTab === "monthly"
                      ? "bg-white text-[#0B3C8A] shadow-sm font-semibold"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Monthly Sales
                </button>
              </div>
            </div>

            <div className="relative min-h-57.5">
              {chartData && chartData.length > 0 ? (
                <div>
                  <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-4 custom-scrollbar scroll-smooth">
                    <div className="flex flex-col justify-between h-40 sm:h-64 pb-6 text-[8px] sm:text-xs text-gray-400 font-medium text-right w-8 sm:w-12 border-r border-gray-100 pr-1 sm:pr-2 pt-4 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <span>{(chartMaxValue / 1000).toFixed(0)}k</span>
                      <span>{Math.round(chartMaxValue * 0.75 / 1000)}k</span>
                      <span>{Math.round(chartMaxValue * 0.5 / 1000)}k</span>
                      <span>{Math.round(chartMaxValue * 0.25 / 1000)}k</span>
                      <span>0</span>
                    </div>

                    <div className="flex-1 h-40 sm:h-64 flex items-end justify-between gap-1 sm:gap-2 px-1 sm:px-2 border-b border-dashed border-gray-200 pb-2 min-w-[800px] sm:min-w-0">
                      {chartData.map((data: ChartDataPoint, idx: number) => (
                        <ChartBarGroup
                          key={`${activeTab}-${idx}`}
                          label={data.label}
                          fullLabel={data.fullLabel}
                          actual={data.actual}
                          forecast={data.forecast}
                          lower={data.lower}
                          upper={data.upper}
                          maxVal={chartMaxValue}
                          delay={idx * 0.03}
                          isWide={activeTab === "monthly"}
                          onHover={() => handleBarHover(data.label, data.fullLabel, data.actual, data.forecast)}
                          onLeave={handleBarLeave}
                          usingML={usingML}
                        />
                      ))}
                    </div>
                  </div>

                  {hoveredBar && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded-lg py-2 px-3 shadow-xl z-20 whitespace-nowrap">
                      <div className="font-bold mb-1 text-center">{hoveredBar.fullLabel}</div>
                      <div className="flex gap-4">
                        <div>
                          <span className="text-gray-400">Actual:</span>
                          <span className="ml-1 font-bold">₱{hoveredBar.actual.toLocaleString()}</span>
                        </div>
                        {usingML && hoveredBar.forecast > 0 && (
                          <div>
                            <span className="text-gray-400">AI Predicted:</span>
                            <span className="ml-1 font-bold text-blue-300">₱{hoveredBar.forecast.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col items-center mt-3 sm:mt-6">
                    <div className="flex justify-center items-center gap-3 sm:gap-6 text-xs sm:text-sm bg-gray-50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gray-100">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-[#0B3C8A]"></span>
                        <span className="text-gray-700 font-medium text-[10px] sm:text-sm">
                          Actual Sales
                        </span>
                      </div>
                      {usingML && (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-blue-300"></span>
                          <span className="text-gray-700 font-medium text-[10px] sm:text-sm">
                            AI Predicted
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Database size={48} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium">No transaction data available</p>
                  <p className="text-xs mt-1 text-center max-w-xs">
                    Complete sales transactions to see sales velocity forecasts.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

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
              Identifies which categories generate the most revenue (Solid Color)
              relative to how many physical units are sold (Gray Overlay).
            </p>

            <div className="space-y-3 sm:space-y-5">
              {HEATMAP_DATA.length > 0 ? (
                HEATMAP_DATA.map((item: any, idx: number) => (
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
                        className={`${item.color} h-full flex items-center px-1.5 sm:px-2 text-[8px] sm:text-[10px] font-bold whitespace-nowrap z-10 text-gray-900`}
                      >
                        Profit {item.profit}%
                      </motion.div>
                      <div
                        className="absolute top-0 right-0 h-full border-l-2 border-dashed border-gray-400 bg-gray-200/50 flex items-center justify-end px-1.5 sm:px-2 text-[8px] sm:text-[10px] font-bold text-gray-800"
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
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Demand Forecasting Card */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6 flex flex-col h-fit lg:h-full"
          >
            <div className="flex flex-col gap-3 mb-4 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <Package className="text-[#047857] w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                    Demand Forecasting                  </h2>
                  <p className="text-[9px] sm:text-xs font-medium text-blue-600">
                    {usingML && hasEnoughDataForML ? 'AI Predictive Insight' : 'AI Unavailable'}
                  </p>
                </div>
              </div>
              
              {usingML && hasEnoughDataForML && FORECAST_DATA.length > 0 && (
                <div className="flex items-center bg-gray-50 p-0.5 rounded-lg w-fit">
                  {[30, 60, 90].map((period: number) => (
                    <button
                      key={period}
                      onClick={() => setForecastPeriod(period as 30 | 60 | 90)}
                      className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
                        forecastPeriod === period 
                          ? "bg-white text-[#0B3C8A] shadow-sm" 
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {period}d
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400" style={{ maxHeight: '500px' }}>
              {usingML && hasEnoughDataForML && FORECAST_DATA.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {FORECAST_DATA.map((item: ForecastDisplayData, i: number) => (
                    <ForecastItem 
                      key={i} 
                      data={item} 
                      currentDemand={getCurrentDisplayDemand(item)}
                      forecastPeriod={forecastPeriod}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <Database size={20} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">
                    {!usingML 
                      ? "AI prediction service is currently unavailable" 
                      : !hasEnoughDataForML 
                      ? "Insufficient data for AI recommendations"
                      : "No reorder recommendations at this time"}
                  </p>
                  {!hasEnoughDataForML && usingML && (
                    <p className="text-[10px] text-gray-400 mt-2">
                      Need {MIN_TRANSACTIONS_FOR_ML - completedTransactions.length} more sales for AI predictions
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Deadstock Impact Card - FIXED: Removed Total Value at Risk section */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-red-100 p-3 sm:p-6 h-fit lg:h-full relative overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-400"></div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 sm:p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="text-red-600 w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                  Deadstock Impact
                </h2>
              </div>
            </div>

            {/* Deadstock Cards - No extra spacing above */}
            <div className="space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {DEADSTOCK_DATA.length > 0 ? (
                DEADSTOCK_DATA.map((item: DeadstockItem) => {
                  const hasAISuggestion = usingML && item.aiSuggestion;
                  
                  const suggestion = hasAISuggestion && item.aiSuggestion
                    ? item.aiSuggestion 
                    : `Item unsold for ${item.daysSinceSale} days. Enable AI service for intelligent recommendations.`;
                  
                  const suggestionType = hasAISuggestion ? item.aiSuggestionType : 'info';
                  const discountBadge = hasAISuggestion && item.recommendedDiscount ? `${item.recommendedDiscount}% off` : '';
                  
                  const suggestionBgColor = hasAISuggestion 
                    ? (suggestionType === 'critical' ? 'bg-red-50 border-red-200' : 
                       suggestionType === 'warning' ? 'bg-orange-50 border-orange-200' : 
                       'bg-blue-50 border-blue-200')
                    : 'bg-gray-50 border-gray-200';
                  
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedDeadstock(item)}
                      className="p-3 bg-white border border-gray-200 rounded-lg space-y-2 hover:shadow-md transition-all cursor-pointer hover:border-blue-300"
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 pr-3 flex-1">
                          <h4 className="text-[11px] sm:text-sm font-semibold text-gray-800 truncate">
                            {item.name}
                          </h4>
                          <span className="text-[9px] sm:text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 flex-wrap">
                            <Clock size={10}/> {item.daysSinceSale} Days Unsold • {item.stock} units
                            {item.lastSaleDate && (
                              <span className="text-gray-400 ml-1">(Last sold: {item.lastSaleDate.toLocaleDateString()})</span>
                            )}
                            {!item.lastSaleDate && (
                              <span className="text-gray-400 ml-1">(Never sold)</span>
                            )}
                            {discountBadge && (
                              <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[8px] font-bold">
                                {discountBadge}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="text-[11px] sm:text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded shrink-0 ml-2">
                          ₱{item.lockedCapital.toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-100 pt-2">
                        <p className="text-[8px] sm:text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                          {usingML && hasAISuggestion ? 'AI SUGGESTION (Click for details)' : 'STATUS'}
                        </p>
                        <div className={`${suggestionBgColor} border rounded p-2 min-h-[50px] flex items-center justify-between`}>
                          <p className={`text-[9px] sm:text-xs ${suggestionType === 'critical' ? 'text-red-600' : suggestionType === 'warning' ? 'text-orange-600' : 'text-blue-600'} leading-relaxed flex-1`}>
                            {suggestion.length > 150 ? suggestion.substring(0, 150) + '...' : suggestion}
                          </p>
                          <ChevronRight size={16} className="text-gray-400 ml-2 flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <Package size={24} className="mx-auto mb-2 opacity-20"/>
                  <p className="text-xs">No deadstock items identified</p>
                  <p className="text-[10px] mt-1">Items with no sales in 30+ days will appear here</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>

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
  
  const profitMarginColor = analysis.profitMargin >= 30 ? 'text-green-700' : analysis.profitMargin >= 15 ? 'text-yellow-700' : 'text-red-700';
  
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
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Original/Retail Price</p>
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
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-purple-100 rounded-lg">
                <Calculator size={18} className="text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-800">ML Factor Breakdown</h3>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-700">Days Unsold Factor</span>
                  <span className="text-xs font-bold text-gray-900">{Math.round(analysis.daysFactor * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${analysis.daysFactor * 100}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Higher days unsold = higher discount urgency</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-700">Capital Locked Factor</span>
                  <span className="text-xs font-bold text-gray-900">{Math.round(analysis.capitalFactor * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: `${analysis.capitalFactor * 100}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Higher locked capital increases discount recommendation</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-700">Category Urgency Multiplier</span>
                  <span className="text-xs font-bold text-gray-900">{analysis.categoryUrgency.toFixed(2)}x</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${Math.min(analysis.categoryUrgency * 100, 100)}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Perishable categories (Contacts, Solutions) get higher urgency</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-700">Historical Velocity Factor</span>
                  <span className="text-xs font-bold text-gray-900">{Math.round(analysis.velocityFactor * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${analysis.velocityFactor * 100}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Products that sold well previously get lower discounts</p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Profit Margin</span>
                <span className={`font-bold ${profitMarginColor}`}>{analysis.profitMargin.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-medium text-gray-700">Max Allowed Discount (Cost Recovery)</span>
                <span className="font-bold text-blue-700">{analysis.maxAllowedDiscount.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-medium text-gray-700">Final Recommended Discount</span>
                <span className="font-bold text-red-700">{analysis.discountPercentage}%</span>
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
                  ? "✅ This discount recommendation ensures cost recovery while maintaining profitability." 
                  : "⚠️ This product has low profit margin. Recommended discount is minimal to avoid loss."}
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

function ForecastItem({ data, currentDemand, forecastPeriod }: { data: ForecastDisplayData; currentDemand: number; forecastPeriod: number }) {
  const orderQuantity = Math.max(0, currentDemand - data.currentStock);
  const needsReorder = orderQuantity > 0;

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-100"
    >
      <div className="flex justify-between items-start gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {data.trend === "up" ? (
            <ArrowUpRight size={14} className="text-[#0B3C8A] sm:w-4 sm:h-4 flex-shrink-0" />
          ) : data.trend === "down" ? (
            <ArrowDownRight size={14} className="text-orange-500 sm:w-4 sm:h-4 flex-shrink-0" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-gray-400 flex-shrink-0" />
          )}
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
      
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-gray-500 text-[8px] sm:text-[9px]">Current</p>
          <p className="font-bold text-gray-900 text-sm sm:text-base">
            {data.currentStock} units
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-[8px] sm:text-[9px]">{forecastPeriod}d Demand</p>
          <p className="font-bold text-[#0B3C8A] text-sm sm:text-base">
            {currentDemand} units
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-[8px] sm:text-[9px]">Order</p>
          <p className="font-bold text-emerald-600 text-sm sm:text-base">
            {orderQuantity} units
          </p>
        </div>
      </div>
      
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1 text-[9px] sm:text-xs text-gray-600 font-medium">
          <Package size={12} />
          {needsReorder ? `Order ${orderQuantity} Units` : "Stock Sufficient"}
        </div>
      </div>
    </motion.div>
  );
}

interface ChartBarGroupProps {
  label: string;
  fullLabel: string;
  actual: number;
  forecast: number;
  lower?: number;
  upper?: number;
  maxVal: number;
  delay: number;
  isWide?: boolean;
  onHover: () => void;
  onLeave: () => void;
  usingML: boolean;
}

function ChartBarGroup({
  label,
  fullLabel,
  actual,
  forecast,
  maxVal,
  delay,
  isWide = false,
  onHover,
  onLeave,
  usingML,
}: ChartBarGroupProps) {
  const actualHeight = `${Math.min((actual / maxVal) * 100, 100)}%`;
  const forecastHeight = usingML ? `${Math.min((forecast / maxVal) * 100, 100)}%` : '0%';
  const barWidthClass = isWide ? "w-8 sm:w-16" : "w-4 sm:w-10";

  return (
    <div 
      className="flex flex-col items-center gap-1 sm:gap-2 flex-1 group relative cursor-pointer h-full justify-end min-w-[50px] sm:min-w-[80px]"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="flex items-end gap-0.5 sm:gap-1 w-full justify-center h-full">
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: actualHeight }}
          transition={{ duration: 0.5, delay: delay, ease: "easeOut" }}
          className={`${barWidthClass} bg-[#0B3C8A] rounded-t-sm origin-bottom opacity-90 group-hover:opacity-100 shadow-sm transition-opacity`}
        ></motion.div>
        
        {usingML && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: forecastHeight }}
            transition={{ duration: 0.5, delay: delay + 0.1, ease: "easeOut" }}
            className={`${barWidthClass} bg-blue-300 rounded-t-sm origin-bottom opacity-70 group-hover:opacity-90 shadow-sm transition-opacity`}
          ></motion.div>
        )}
      </div>
      <span className="text-[10px] sm:text-xs font-medium text-gray-400 group-hover:text-gray-700 transition-colors">
        {label}
      </span>
    </div>
  );
}