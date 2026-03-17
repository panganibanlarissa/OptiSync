// src/app/(app)/dashboard/page.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { useFirebase } from "@/context/FirebaseContext";
import { useMLForecasting } from "@/hooks/useMLForecasting";
import {
  Box,
  AlertTriangle,
  TrendingUp,
  Package,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Banknote,
  BarChart3,
  Database
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
  predictedDemand: number;
  trend: 'up' | 'down' | 'stable';
  priority: 'high' | 'medium' | 'low';
}

interface InventoryDisplayData {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  status: 'in_stock' | 'low_stock' | 'critical';
}

interface ChartDataPoint {
  label: string;
  actual: number;
  forecast: number;
  lower?: number;
  upper?: number;
  date: Date;
}

interface ChartBarGroupProps {
  label: string;
  actual: number;
  forecast: number;
  lower?: number;
  upper?: number;
  maxVal: number;
  delay: number;
  isWide?: boolean;
}

interface HeatmapData {
  category: string;
  profit: number;
  volume: number;
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

const CURRENT_PERIOD = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// Minimum data threshold for ML features (at least 10 completed transactions)
const MIN_TRANSACTIONS_FOR_ML = 10;

const CATEGORY_COLORS: Record<string, string> = {
  'Frames': 'bg-emerald-500',
  'Lenses': 'bg-blue-500',
  'Contact Lenses': 'bg-indigo-500',
  'Solutions': 'bg-amber-500',
  'Accessories': 'bg-purple-500',
  'Unknown': 'bg-gray-500'
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");
  const { products, transactions } = useFirebase();
  const { loading, forecastData, recommendations, metrics, usingML, dataLoaded } = useMLForecasting();

  // Check if we have enough data for ML features - computed once
  const completedTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'completed');
  }, [transactions]);

  const hasEnoughDataForML = useMemo(() => {
    return completedTransactions.length >= MIN_TRANSACTIONS_FOR_ML;
  }, [completedTransactions]);

  // Calculate today's actual sales from transactions - computed once
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

  // Calculate weekly sales data from actual transactions - computed once
  const weeklySalesData = useMemo(() => {
    const today = new Date();
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const result: ChartDataPoint[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      
      const daySales = completedTransactions
        .filter(t => {
          const transDate = new Date(t.date);
          return transDate >= date && transDate < nextDate;
        })
        .reduce((sum, t) => sum + t.total, 0);
      
      result.push({
        label: weekDays[date.getDay() === 0 ? 6 : date.getDay() - 1],
        actual: daySales,
        forecast: 0,
        date: date
      });
    }
    
    return result;
  }, [completedTransactions]);

  // Calculate weekly volume data - computed once
  const weeklyVolumeData = useMemo(() => {
    const today = new Date();
    const currentWeek = Math.ceil(today.getDate() / 7);
    const result: ChartDataPoint[] = [];
    
    for (let i = 3; i >= 0; i--) {
      const weekNum = currentWeek - i;
      if (weekNum < 1) continue;
      
      const weekStart = new Date(today.getFullYear(), today.getMonth(), (weekNum - 1) * 7 + 1);
      const weekEnd = new Date(today.getFullYear(), today.getMonth(), weekNum * 7);
      
      const weekSales = completedTransactions
        .filter(t => {
          const transDate = new Date(t.date);
          return transDate >= weekStart && transDate <= weekEnd;
        })
        .reduce((sum, t) => sum + t.total, 0);
      
      result.push({
        label: `Week ${weekNum}`,
        actual: weekSales,
        forecast: 0,
        date: weekStart
      });
    }
    
    return result;
  }, [completedTransactions]);

  // Get ML forecast data for chart - computed once
  const mlChartData = useMemo(() => {
    if (!forecastData || forecastData.length === 0) return null;
    
    return forecastData.map(item => ({
      label: item.month,
      actual: item.type === 'history' ? item.value * 1000 : 0,
      forecast: item.type === 'forecast' ? item.value * 1000 : 0,
      lower: item.lower ? item.lower * 1000 : undefined,
      upper: item.upper ? item.upper * 1000 : undefined,
      date: new Date()
    }));
  }, [forecastData]);

  // Determine which data to show - computed once
  const chartData = useMemo(() => {
    if (!hasEnoughDataForML || !mlChartData) {
      return activeTab === "daily" ? weeklySalesData : weeklyVolumeData;
    }
    
    if (activeTab === "daily") {
      const lastWeekActual = weeklySalesData;
      const today = new Date();
      const nextWeekForecast: ChartDataPoint[] = mlChartData.slice(0, 7).map((item, index) => {
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + index + 1);
        
        return {
          label: `Day ${index + 1}`,
          actual: 0,
          forecast: item.forecast,
          lower: item.lower,
          upper: item.upper,
          date: futureDate
        };
      });
      
      return [...lastWeekActual, ...nextWeekForecast];
    }
    
    return mlChartData;
  }, [activeTab, hasEnoughDataForML, mlChartData, weeklySalesData, weeklyVolumeData]);

  // Calculate max value for chart scaling - computed once
  const chartMaxValue = useMemo(() => {
    if (!chartData || chartData.length === 0) return 50000;
    
    const maxActual = Math.max(...chartData.map(d => d.actual || 0));
    const maxForecast = Math.max(...chartData.map(d => d.forecast || 0));
    const maxValue = Math.max(maxActual, maxForecast, 1000);
    
    return Math.ceil(maxValue / 5000) * 5000;
  }, [chartData]);

  // Calculate stock values - computed once
  const totalStockValue = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.baseCost * p.stock), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock <= p.reorderPoint && p.stock > 0).length;
  }, [products]);

  // Stats data - computed once with proper null checks
  const STATS_DATA: StatData[] = useMemo(() => {
    const revenueTrend = metrics?.revenue?.trend ?? 0;
    const revenueForecasted = metrics?.revenue?.forecasted ?? 0;
    
    return [
      {
        id: "stock_value",
        label: "Total Stock Value",
        value: `₱${totalStockValue.toLocaleString()}`,
        trend: revenueTrend > 0 ? `+${revenueTrend.toFixed(1)}%` : 
               revenueTrend < 0 ? `${revenueTrend.toFixed(1)}%` : "Stable",
        trendType: revenueTrend > 0 ? "positive" : 
                   revenueTrend < 0 ? "negative" : "neutral",
      },
      {
        id: "sales_today",
        label: "Today's Sales",
        value: `₱${todaySales.toLocaleString()}`,
        trend: todaySales > 0 ? "Active" : "No sales",
        trendType: todaySales > 0 ? "positive" : "neutral",
      },
      {
        id: "low_stock",
        label: "Low Stock Alerts",
        value: lowStockCount,
        trend: lowStockCount > 0 ? "Action Needed" : "All Good",
        trendType: lowStockCount > 0 ? "negative" : "positive",
      },
      {
        id: "revenue_forecast",
        label: "30-Day Revenue Forecast",
        value: hasEnoughDataForML && metrics ? `₱${revenueForecasted.toLocaleString()}` : "—",
        trend: hasEnoughDataForML && metrics 
          ? (revenueTrend > 0 ? `+${revenueTrend.toFixed(1)}%` : 
             revenueTrend < 0 ? `${revenueTrend.toFixed(1)}%` : "Stable")
          : "Insufficient data",
        trendType: hasEnoughDataForML && metrics 
          ? (revenueTrend > 0 ? "positive" : revenueTrend < 0 ? "negative" : "neutral")
          : "neutral",
      },
    ];
  }, [totalStockValue, todaySales, lowStockCount, hasEnoughDataForML, metrics]);

  // Forecast data - computed once
  const FORECAST_DATA: ForecastDisplayData[] = useMemo(() => {
    if (hasEnoughDataForML && recommendations.length > 0) {
      return recommendations.slice(0, 3).map(r => ({
        name: r.productName,
        currentStock: r.currentStock,
        predictedDemand: r.predictedDemand,
        trend: r.trend,
        priority: r.confidence
      }));
    }
    return [];
  }, [hasEnoughDataForML, recommendations]);

  // Heatmap data - computed once
  const HEATMAP_DATA: HeatmapData[] = useMemo(() => {
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

    return Object.entries(categoryStats).map(([category, data]) => ({
      category,
      profit: maxProfit > 0 ? Math.round((data.totalProfit / maxProfit) * 100) : 0,
      volume: maxVolume > 0 ? Math.round((data.totalVolume / maxVolume) * 100) : 0,
      color: CATEGORY_COLORS[category] || CATEGORY_COLORS['Unknown']
    }));
  }, [products]);

  // Inventory data - computed once
  const INVENTORY_DATA: InventoryDisplayData[] = useMemo(() => {
    return products.slice(0, 6).map(p => ({
      id: p.sku || p.id.slice(0, 8),
      name: p.name,
      category: p.category,
      stock: p.stock,
      price: p.markupPrice,
      status: p.stock <= 0 ? 'critical' : p.stock <= p.reorderPoint ? 'low_stock' : 'in_stock'
    }));
  }, [products]);

  // Show loading spinner only on initial load
  if (loading && !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

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
          AI-Powered Forecasts Active (Prophet/XGBoost)
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
                  Sales Velocity
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 ml-1">
                <Calendar size={10} className="sm:w-3 sm:h-3" />
                <span>Period: {CURRENT_PERIOD}</span>
              </div>
            </div>

            {hasEnoughDataForML ? (
              <div className="bg-gray-100 p-0.5 sm:p-1 rounded-lg flex text-xs sm:text-sm font-medium">
                <button
                  onClick={() => setActiveTab("daily")}
                  className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-md transition-all text-[11px] sm:text-sm ${
                    activeTab === "daily"
                      ? "bg-white text-[#0B3C8A] shadow-sm font-semibold"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Daily Trends
                </button>
                <button
                  onClick={() => setActiveTab("weekly")}
                  className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-md transition-all text-[11px] sm:text-sm ${
                    activeTab === "weekly"
                      ? "bg-white text-[#0B3C8A] shadow-sm font-semibold"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Weekly Volume
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">
                <Database size={14} />
                <span>Need {MIN_TRANSACTIONS_FOR_ML - completedTransactions.length} more transactions for forecasts</span>
              </div>
            )}
          </div>

          <div className="relative min-h-87.5">
            {hasEnoughDataForML && chartData && chartData.length > 0 ? (
              <div>
                <div className="flex gap-2 sm:gap-4">
                  <div className="flex flex-col justify-between h-40 sm:h-64 pb-6 text-[8px] sm:text-xs text-gray-400 font-medium text-right w-8 sm:w-12 border-r border-gray-100 pr-1 sm:pr-2 pt-4">
                    <span>{(chartMaxValue / 1000).toFixed(0)}k</span>
                    <span>{Math.round(chartMaxValue * 0.75 / 1000)}k</span>
                    <span>{Math.round(chartMaxValue * 0.5 / 1000)}k</span>
                    <span>{Math.round(chartMaxValue * 0.25 / 1000)}k</span>
                    <span>0</span>
                  </div>

                  <div className="flex-1 h-40 sm:h-64 flex items-end justify-between gap-1 sm:gap-2 px-1 sm:px-2 border-b border-dashed border-gray-200 pb-2">
                    {chartData.slice(0, activeTab === "daily" ? 7 : 7).map((data, idx) => (
                      <ChartBarGroup
                        key={`${activeTab}-${idx}`}
                        label={data.label}
                        actual={data.actual}
                        forecast={data.forecast}
                        lower={data.lower}
                        upper={data.upper}
                        maxVal={chartMaxValue}
                        delay={idx * 0.1}
                        isWide={activeTab === "weekly"}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center mt-3 sm:mt-6">
                  <div className="flex justify-center items-center gap-3 sm:gap-6 text-xs sm:text-sm bg-gray-50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gray-100">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-[#0B3C8A]"></span>
                      <span className="text-gray-700 font-medium text-[10px] sm:text-sm">
                        Actual Sales
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-blue-300"></span>
                      <span className="text-gray-700 font-medium text-[10px] sm:text-sm">
                        AI Forecast
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Database size={48} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">Not enough transaction data</p>
                <p className="text-xs mt-1 text-center max-w-xs">
                  Complete at least {MIN_TRANSACTIONS_FOR_ML} sales to see sales velocity forecasts.
                  Current: {completedTransactions.length} transaction{completedTransactions.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6 h-fit"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="text-[#0B3C8A] w-4 h-4 sm:w-5 sm:h-5" />
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
                  <p className="text-xs text-gray-400 mt-2">
                    Need {MIN_TRANSACTIONS_FOR_ML - completedTransactions.length} more sales for AI forecasts
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
            Identifies which categories generate the most revenue (Solid Color)
            relative to how many physical units are sold (Gray Overlay).
          </p>

          <div className="space-y-3 sm:space-y-5">
            {HEATMAP_DATA.length > 0 ? (
              HEATMAP_DATA.map((item, idx) => (
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

        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-7 h-fit"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-[#0B3C8A] rounded-lg">
                <Package className="text-white w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                  Inventory Status
                </h2>
                <p className="text-[9px] sm:text-xs text-gray-500">
                  Real-time stock tracking
                </p>
              </div>
            </div>
            <Link
              href="/inventory"
              className="text-[9px] sm:text-xs font-semibold text-[#0B3C8A] bg-blue-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full whitespace-nowrap"
            >
              View All Catalog
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 text-[8px] sm:text-[10px] uppercase font-bold text-gray-500 overflow-x-auto pb-1">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></div> Good Standing
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0"></div> Needs Attention
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div> Restock Immediately
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-125 text-left text-xs sm:text-sm text-gray-600">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">PRODUCT ID</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">Item Name</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[#0B3C8A] text-[10px] sm:text-xs">Stock</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">Price</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {INVENTORY_DATA.length > 0 ? (
                  INVENTORY_DATA.map((item) => (
                    <TableRow key={item.id} data={item} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      No inventory items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatCard({ data }: { data: StatData }) {
  let Icon = Box;
  let themeColor = "blue";

  if (data.id === "low_stock") {
    Icon = AlertTriangle;
    themeColor = "orange";
  } else if (
    data.id === "stock_value" ||
    data.id === "sales_today" ||
    data.id === "revenue_forecast"
  ) {
    Icon = Banknote;
    themeColor = data.id === "sales_today" ? "emerald" : "blue";
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
  const actionText =
    data.trend === "up"
      ? `Order ${data.predictedDemand - data.currentStock} Units`
      : data.trend === "down"
      ? "Reduce orders"
      : "Monitor stock";

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-100"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800 text-xs sm:text-sm truncate pr-2">
          {data.name}
        </h3>
        {data.trend === "up" ? (
          <ArrowUpRight size={14} className="text-[#0B3C8A] sm:w-4 sm:h-4" />
        ) : data.trend === "down" ? (
          <ArrowDownRight size={14} className="text-orange-500 sm:w-4 sm:h-4" />
        ) : (
          <div className="w-4 h-4 rounded-full bg-gray-400" />
        )}
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
              data.trend === "up" ? "text-[#0B3C8A]" : 
              data.trend === "down" ? "text-orange-500" : "text-gray-600"
            }`}
          >
            {data.predictedDemand} units
          </p>
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1 text-[9px] sm:text-xs text-gray-600 font-medium">
          <Package size={12} />
          {actionText}
        </div>
        <span className={`text-[8px] sm:text-[9px] font-bold px-2 py-0.5 rounded ${
          data.priority === 'high' ? 'bg-red-100 text-red-700' :
          data.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {data.priority.toUpperCase()}
        </span>
      </div>
    </motion.div>
  );
}

function TableRow({ data }: { data: InventoryDisplayData }) {
  let statusLabel = "In Stock";
  let statusColor = "bg-blue-100 text-[#0B3C8A]";

  if (data.status === "low_stock") {
    statusLabel = "Low Stock";
    statusColor = "bg-orange-100 text-orange-700";
  } else if (data.status === "critical") {
    statusLabel = "Critical";
    statusColor = "bg-red-100 text-red-700";
  }

  return (
    <tr className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
      <td className="py-2 sm:py-3 font-medium text-gray-800 text-[9px] sm:text-sm">
        {data.id}
      </td>
      <td className="py-2 sm:py-3 truncate max-w-37.5 text-[9px] sm:text-sm">{data.name}</td>
      <td className="py-2 sm:py-3 font-bold text-gray-900 text-[9px] sm:text-sm">{data.stock}</td>
      <td className="py-2 sm:py-3 text-[9px] sm:text-sm">₱{data.price.toLocaleString()}</td>
      <td className="py-2 sm:py-3">
        <span
          className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[8px] sm:text-[10px] font-semibold uppercase ${statusColor}`}
        >
          {statusLabel}
        </span>
      </td>
    </tr>
  );
}

function ChartBarGroup({
  label,
  actual,
  forecast,
  lower,
  upper,
  maxVal,
  delay,
  isWide = false,
}: ChartBarGroupProps) {
  const actualHeight = `${Math.min((actual / maxVal) * 100, 100)}%`;
  const forecastHeight = `${Math.min((forecast / maxVal) * 100, 100)}%`;
  const barWidthClass = isWide ? "w-3 sm:w-10" : "w-2 sm:w-6";

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2 flex-1 group relative cursor-pointer h-full justify-end">
      <div className="absolute bottom-full mb-2 sm:mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-40 sm:w-48 -ml-20 sm:-ml-24 left-1/2">
        <div className="bg-gray-800 text-white text-[9px] sm:text-xs rounded-lg py-2 sm:py-3 px-2 sm:px-3 shadow-xl">
          <div className="font-bold mb-1 sm:mb-2 pb-1 border-b border-gray-600 text-center text-[10px] sm:text-xs">
            {label} Data
          </div>
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-gray-300 mb-1 gap-1 sm:gap-2">
            <span>Actual:</span>
            <span className="font-mono text-white font-bold">
              ₱{actual.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-blue-300 gap-1 sm:gap-2">
            <span>AI Forecast:</span>
            <span className="font-mono font-bold">
              ₱{forecast.toLocaleString()}
            </span>
          </div>
          {lower !== undefined && upper !== undefined && (
            <div className="flex justify-between items-center text-[8px] sm:text-[9px] text-gray-400 mt-1 pt-1 border-t border-gray-700">
              <span>Range: ₱{lower.toLocaleString()} - ₱{upper.toLocaleString()}</span>
            </div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-800"></div>
        </div>
      </div>

      <div className="flex items-end gap-0.5 sm:gap-1 w-full justify-center h-full">
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: actualHeight }}
          transition={{ duration: 0.5, delay: delay, ease: "easeOut" }}
          className={`${barWidthClass} bg-[#0B3C8A] rounded-t-sm origin-bottom opacity-90 group-hover:opacity-100 shadow-sm transition-opacity`}
        ></motion.div>
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: forecastHeight }}
          transition={{ duration: 0.5, delay: delay + 0.1, ease: "easeOut" }}
          className={`${barWidthClass} bg-blue-300 rounded-t-sm origin-bottom opacity-90 group-hover:opacity-100 shadow-sm transition-opacity`}
        ></motion.div>
      </div>
      <span className="text-[10px] sm:text-xs font-medium text-gray-400 group-hover:text-gray-700 transition-colors">
        {label}
      </span>
    </div>
  );
}