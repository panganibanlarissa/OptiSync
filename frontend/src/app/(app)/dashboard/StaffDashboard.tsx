// src/app/(app)/dashboard/StaffDashboard.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
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
  ShoppingBag,
  Clock
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

export default function StaffDashboard() {
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const { products, transactions } = useFirebase();
  const { loading, recommendations, usingML, dataLoaded } = useMLForecasting();

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

  const monthlySalesData = useMemo(() => {
    const year = new Date().getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result: ChartDataPoint[] = [];
    
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      
      const monthlySales = completedTransactions
        .filter(t => {
          const transDate = new Date(t.date);
          return transDate >= monthStart && transDate <= monthEnd;
        })
        .reduce((sum, t) => sum + t.total, 0);
      
      result.push({
        label: monthNames[month],
        actual: monthlySales,
        forecast: 0,
        date: monthStart
      });
    }
    
    return result;
  }, [completedTransactions]);

  const chartData = activeTab === "weekly" ? weeklySalesData : monthlySalesData;
  const chartMaxValue = useMemo(() => {
    if (!chartData || chartData.length === 0) return 10000;
    const max = Math.max(...chartData.map(d => Math.max(d.actual, d.forecast)));
    return Math.ceil(max / 10000) * 10000 || 10000;
  }, [chartData]);

  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock <= p.reorderPoint).length;
  }, [products]);

  const totalInventoryCount = useMemo(() => {
    return products.reduce((sum, p) => sum + p.stock, 0);
  }, [products]);

  const STATS_DATA: StatData[] = useMemo(() => {
    return [
      {
        id: "sales_today",
        label: "Today's Sales",
        value: `₱${todaySales.toLocaleString()}`,
        trend: "+15%",
        trendType: "positive",
      },
      {
        id: "transactions_today",
        label: "Today's Transaction",
        value: todayTransactionCount,
        trend: "• Live",
        trendType: "positive",
      },
      {
        id: "low_stock",
        label: "Low Stock Items",
        value: lowStockCount,
        trend: "Action Needed",
        trendType: "negative",
      },
      {
        id: "total_inventory",
        label: "Total Inventory Count",
        value: totalInventoryCount,
        trend: "Stable",
        trendType: "neutral",
      },
    ];
  }, [todaySales, todayTransactionCount, lowStockCount, totalInventoryCount]);

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

  // Get recently added stock (products sorted by most recent)
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
                    {chartData.slice(0, activeTab === "weekly" ? 7 : 12).map((data, idx) => (
                      <ChartBarGroup
                        key={`${activeTab}-${idx}`}
                        label={data.label}
                        actual={data.actual}
                        forecast={data.forecast}
                        lower={data.lower}
                        upper={data.upper}
                        maxVal={chartMaxValue}
                        delay={idx * 0.1}
                        isWide={activeTab === "monthly"}
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
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Database size={48} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">Not enough transaction data</p>
                <p className="text-xs mt-1 text-center max-w-xs">
                  Complete at least {MIN_TRANSACTIONS_FOR_ML} sales to see sales velocity.
                  Current: {completedTransactions.length} transaction{completedTransactions.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
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
    </motion.div>
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
  const barWidthClass = isWide ? "w-3 sm:w-10" : "w-2 sm:w-6";

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2 flex-1 group relative cursor-pointer h-full justify-end">
      <div className="flex items-end gap-0.5 sm:gap-1 w-full justify-center h-full">
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: actualHeight }}
          transition={{ duration: 0.5, delay: delay, ease: "easeOut" }}
          className={`${barWidthClass} bg-[#0B3C8A] rounded-t-sm origin-bottom opacity-90 group-hover:opacity-100 shadow-sm transition-opacity`}
        ></motion.div>
      </div>
      <span className="text-[10px] sm:text-xs font-medium text-gray-400 group-hover:text-gray-700 transition-colors">
        {label}
      </span>
    </div>
  );
}
