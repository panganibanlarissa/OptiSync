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
  History,
  Sparkles,
  Target,
  Award,
  Rocket,
  Star,
  TrendingUp as TrendingUpIcon
} from "lucide-react";
import { calculateSmartReorderPoint, calculateSmartReorderPointSimple } from "@/utils/reorderCalculations";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from "recharts";

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
  status: 'critical' | 'low' | 'sufficient';
  staticReorderPoint: number;
  smartReorderPoint: number;
  isSmartAdjusted: boolean;
  adjustmentReason?: string;
  predictedDemand30d?: number;
  daysUntilStockout?: number;
  recommendedLeadTime?: number;
}

interface PredictiveProduct {
  id: string;
  name: string;
  category: string;
  currentSales: number;
  predictedSales30d: number;
  predictedSales60d: number;
  predictedSales90d: number;
  growthRate: number;
  trend: 'up' | 'down' | 'stable';
  confidence: 'high' | 'medium' | 'low';
  rank: number;
  isCurrentTopSeller: boolean;
  isPredictedTopSeller: boolean;
}

interface AIGeneratedRecommendation {
  id: string;
  type: 'promotion' | 'restock' | 'phase_out' | 'bundle' | 'markdown';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  reasoning: string;
  targetProducts: string[];
  estimatedROI?: number;
  actionDeadline?: string;
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

// Helper function to get default lead time based on category
const getDefaultLeadTime = (category: string): number => {
  const leadTimes: Record<string, number> = {
    'Contact Lenses': 5,
    'Solutions': 5,
    'Frames': 7,
    'Lenses': 7,
    'Accessories': 5,
    'Vitamins': 3,
  };
  return leadTimes[category] || 5; // Default 5 days
};

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
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [showDeadstockModal, setShowDeadstockModal] = useState(false);
  const [showForecastModal, setShowForecastModal] = useState(false);
  const [selectedSmartReorderItem, setSelectedSmartReorderItem] = useState<LowStockItem | null>(null);
  const [showSmartReorderModal, setShowSmartReorderModal] = useState(false);
  
  // New state for Predictive Analytics tab
  const [activeDashboardTab, setActiveDashboardTab] = useState<'overview' | 'predictive'>('overview');
  const [selectedProductForInsight, setSelectedProductForInsight] = useState<PredictiveProduct | null>(null);
  const [showProductInsightModal, setShowProductInsightModal] = useState(false);
  
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

  // Low stock count - using smart reorder points (only in-demand items)
  const lowStockCount = useMemo(() => {
    return activeProducts.filter(p => {
      const leadTime = (p as any).leadTime || getDefaultLeadTime(p.category);
      const recommendation = recommendations?.find(r => r.productName === p.name || r.productId === p.id);
      const predictedDemand30d = recommendation?.predictedDemand30d || 0;
      const daysUntilStockout = recommendation?.daysUntilOut || 999;
      const trend = recommendation?.trend || 'stable';
      
      const { smartPoint } = calculateSmartReorderPoint(
        p.reorderPoint,
        p.stock,
        predictedDemand30d,
        daysUntilStockout,
        leadTime,
        trend
      );
      
      // Count ALL items below smart point (regardless of demand)
      return p.stock <= smartPoint && p.stock > 0;
    }).length;
  }, [activeProducts, recommendations, usingML, mlDataLoaded]);

  // ALL Low stock items - from active products below reorder point (no demand filter)
  // Low Stock Alerts displays these items
  const allLowStockItems = useMemo((): LowStockItem[] => {
    return activeProducts
      .map(p => {
        const leadTime = (p as any).leadTime || getDefaultLeadTime(p.category);
        const recommendation = recommendations?.find(r => r.productName === p.name || r.productId === p.id);
        
        const predictedDemand30d = recommendation?.predictedDemand30d || 0;
        const daysUntilStockout = recommendation?.daysUntilOut || 999;
        const trend = recommendation?.trend || 'stable';

        // Calculate smart reorder point
        const { smartPoint, adjustmentReason } = calculateSmartReorderPoint(
          p.reorderPoint,
          p.stock,
          predictedDemand30d,
          daysUntilStockout,
          leadTime,
          trend
        );

        const status: 'critical' | 'low' | 'sufficient' = p.stock <= smartPoint 
          ? (p.stock === 0 ? 'critical' : 'low') 
          : 'sufficient';

        return {
          id: p.id,
          name: p.name,
          category: p.category,
          currentStock: p.stock,
          staticReorderPoint: p.reorderPoint,
          smartReorderPoint: smartPoint,
          isSmartAdjusted: smartPoint !== p.reorderPoint,
          adjustmentReason: smartPoint !== p.reorderPoint ? adjustmentReason : undefined,
          status,
          predictedDemand30d,
          daysUntilStockout,
          recommendedLeadTime: leadTime,
        } as LowStockItem;
      })
      .filter(item => item.currentStock <= item.smartReorderPoint && item.currentStock >= 0)
      .sort((a, b) => a.currentStock - b.currentStock);
  }, [activeProducts, recommendations, usingML, mlDataLoaded]);

  // Low stock items - IN-DEMAND products below reorder point
  // Smart Reorder Points container displays these items
  // In-demand criteria: predictedDemand30d >= 5 OR daysUntilStockout <= 7
  const lowStockItems = useMemo((): LowStockItem[] => {
    return allLowStockItems.filter(item => {
      // Must be in high demand (predicted demand >= 5 OR will stockout soon)
      const isInDemand = (item.predictedDemand30d !== undefined && item.predictedDemand30d >= 5) || 
                        (item.daysUntilStockout !== undefined && item.daysUntilStockout <= 7);
      return isInDemand;
    });
  }, [allLowStockItems]);

  // Upcoming reorder recommendations - high-demand items approaching low stock threshold
  const upcomingReorderItems = useMemo((): LowStockItem[] => {
    return activeProducts
      .map(p => {
        const leadTime = (p as any).leadTime || getDefaultLeadTime(p.category);
        const recommendation = recommendations?.find(r => r.productName === p.name || r.productId === p.id);
        
        const predictedDemand30d = recommendation?.predictedDemand30d || 0;
        const daysUntilStockout = recommendation?.daysUntilOut || 999;
        const trend = recommendation?.trend || 'stable';

        const { smartPoint, adjustmentReason } = calculateSmartReorderPoint(
          p.reorderPoint,
          p.stock,
          predictedDemand30d,
          daysUntilStockout,
          leadTime,
          trend
        );

        return {
          id: p.id,
          name: p.name,
          category: p.category,
          currentStock: p.stock,
          staticReorderPoint: p.reorderPoint,
          smartReorderPoint: smartPoint,
          isSmartAdjusted: smartPoint !== p.reorderPoint,
          adjustmentReason: smartPoint !== p.reorderPoint ? adjustmentReason : undefined,
          status: 'sufficient' as const,
          predictedDemand30d,
          daysUntilStockout,
          recommendedLeadTime: leadTime,
        } as LowStockItem;
      })
      // Filter: HIGH DEMAND items approaching low stock
      // Must have: upward trend OR high predicted demand (>= 5 units/month)
      // AND: above smart point but will approach within 14 days OR within 30% buffer
      .filter(item => {
        const isAboveSmartPoint = item.currentStock > item.smartReorderPoint;
        const willBecomeLowSoon = item.daysUntilStockout !== undefined && item.daysUntilStockout <= 14;
        const withinBuffer = item.currentStock <= item.smartReorderPoint * 1.3;
        const isHighDemand = (item.predictedDemand30d !== undefined && item.predictedDemand30d >= 5) || (item.daysUntilStockout !== undefined && item.daysUntilStockout <= 7); // High demand or will stockout soon
        
        return isAboveSmartPoint && isHighDemand && (willBecomeLowSoon || withinBuffer);
      })
      .sort((a, b) => a.daysUntilStockout !== undefined && b.daysUntilStockout !== undefined 
        ? a.daysUntilStockout - b.daysUntilStockout 
        : a.currentStock - b.currentStock);
  }, [activeProducts, recommendations, usingML, mlDataLoaded]);

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

  // ================= PREDICTIVE ANALYTICS DATA =================
  
  const currentSalesByProduct = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const salesMap = new Map<string, number>();
    
    allTransactions.forEach((t: any) => {
      const transDate = new Date(t.date);
      if (transDate >= thirtyDaysAgo && t.status === 'completed') {
        t.items.forEach((item: any) => {
          const current = salesMap.get(item.id) || 0;
          salesMap.set(item.id, current + (item.quantity || 1));
        });
      }
    });
    
    return salesMap;
  }, [allTransactions]);
  
  const predictiveProducts = useMemo((): PredictiveProduct[] => {
    if (!usingML || !recommendations || recommendations.length === 0) {
      return [];
    }
    
    const productsList: PredictiveProduct[] = [];
    
    recommendations.forEach((rec, index) => {
      const product = activeProducts.find(p => p.id === rec.productId || p.name === rec.productName);
      if (!product) return;
      
      const currentSales = currentSalesByProduct.get(product.id) || 0;
      const predictedSales30d = rec.predictedDemand30d || 0;
      const predictedSales60d = rec.predictedDemand60d || 0;
      const predictedSales90d = rec.predictedDemand90d || 0;
      
      let growthRate = 0;
      if (currentSales > 0) {
        growthRate = ((predictedSales30d - currentSales) / currentSales) * 100;
      } else if (predictedSales30d > 0) {
        growthRate = 100;
      }
      
      productsList.push({
        id: product.id,
        name: product.name,
        category: product.category,
        currentSales,
        predictedSales30d,
        predictedSales60d,
        predictedSales90d,
        growthRate,
        trend: rec.trend,
        confidence: rec.confidence,
        rank: index + 1,
        isCurrentTopSeller: false,
        isPredictedTopSeller: false,
      });
    });
    
    const sortedByCurrent = [...productsList].sort((a, b) => b.currentSales - a.currentSales);
    sortedByCurrent.slice(0, 10).forEach((p) => {
      const product = productsList.find(pl => pl.id === p.id);
      if (product) product.isCurrentTopSeller = true;
    });
    
    const sortedByPredicted = [...productsList].sort((a, b) => b.predictedSales30d - a.predictedSales30d);
    sortedByPredicted.slice(0, 10).forEach((p) => {
      const product = productsList.find(pl => pl.id === p.id);
      if (product) product.isPredictedTopSeller = true;
    });
    
    return productsList.sort((a, b) => b.predictedSales30d - a.predictedSales30d);
  }, [recommendations, activeProducts, currentSalesByProduct, usingML]);
  
  const topCurrentSellers = useMemo(() => {
    return [...predictiveProducts]
      .sort((a, b) => b.currentSales - a.currentSales)
      .slice(0, 5);
  }, [predictiveProducts]);
  
  const topPredictedSellers = useMemo(() => {
    return [...predictiveProducts]
      .sort((a, b) => b.predictedSales30d - a.predictedSales30d)
      .slice(0, 5);
  }, [predictiveProducts]);
  
  // Chart data for top sellers comparison
  const topSellersChartData = useMemo(() => {
    const allTopSellers = new Map<string, { current: number; predicted: number; category: string; fullName: string }>();
    
    topCurrentSellers.forEach(product => {
      allTopSellers.set(product.name, {
        current: product.currentSales,
        predicted: product.predictedSales30d,
        category: product.category,
        fullName: product.name
      });
    });
    
    topPredictedSellers.forEach(product => {
      const existing = allTopSellers.get(product.name);
      if (existing) {
        existing.predicted = product.predictedSales30d;
      } else {
        allTopSellers.set(product.name, {
          current: product.currentSales,
          predicted: product.predictedSales30d,
          category: product.category,
          fullName: product.name
        });
      }
    });
    
    return Array.from(allTopSellers.entries())
      .map(([name, data]) => ({
        name: name.length > 20 ? name.substring(0, 18) + '...' : name,
        fullName: data.fullName,
        currentSales: data.current,
        predictedSales: data.predicted,
        category: data.category,
        growth: data.current > 0 ? ((data.predicted - data.current) / data.current) * 100 : 100
      }))
      .sort((a, b) => b.predictedSales - a.predictedSales)
      .slice(0, 8);
  }, [topCurrentSellers, topPredictedSellers]);
  
  const aiRecommendations = useMemo((): AIGeneratedRecommendation[] => {
    if (!usingML || recommendations.length === 0) {
      return [];
    }
    
    const recs: AIGeneratedRecommendation[] = [];
    
    const risingStars = predictiveProducts
      .filter(p => p.growthRate > 30 && p.predictedSales30d > p.currentSales)
      .sort((a, b) => b.growthRate - a.growthRate)
      .slice(0, 3);
    
    if (risingStars.length > 0) {
      recs.push({
        id: 'rising-stars',
        type: 'restock',
        title: 'Rising Products - Increase Stock',
        description: `${risingStars.length} product(s) showing strong upward momentum. Increase inventory to meet projected demand.`,
        impact: 'high',
        reasoning: `Products like ${risingStars.slice(0, 2).map(p => p.name).join(', ')} are showing ${Math.round(risingStars[0]?.growthRate || 0)}% growth. Prophet ML predicts continued upward trend.`,
        targetProducts: risingStars.map(p => p.name),
        estimatedROI: 35,
        actionDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    }
    
    const decliningProducts = predictiveProducts
      .filter(p => p.growthRate < -20 && p.currentSales > 5)
      .sort((a, b) => a.growthRate - b.growthRate)
      .slice(0, 3);
    
    if (decliningProducts.length > 0) {
      recs.push({
        id: 'declining',
        type: 'phase_out',
        title: 'Declining Demand - Review Inventory',
        description: `${decliningProducts.length} product(s) showing consistent decline. Consider reducing stock levels or running clearance promotions.`,
        impact: 'medium',
        reasoning: `Sales trend is downward with ${Math.abs(Math.round(decliningProducts[0]?.growthRate || 0))}% decrease. ML confidence is ${decliningProducts[0]?.confidence || 'medium'}.`,
        targetProducts: decliningProducts.map(p => p.name),
        estimatedROI: 15,
        actionDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    }
    
    const categoryDemand = new Map<string, PredictiveProduct[]>();
    predictiveProducts.forEach(p => {
      if (!categoryDemand.has(p.category)) {
        categoryDemand.set(p.category, []);
      }
      categoryDemand.get(p.category)!.push(p);
    });
    
    for (const [category, productsInCat] of categoryDemand) {
      const topInCategory = productsInCat
        .sort((a, b) => b.predictedSales30d - a.predictedSales30d)
        .slice(0, 2);
      
      if (topInCategory.length >= 2 && topInCategory[0].predictedSales30d > 10 && topInCategory[1].predictedSales30d > 5) {
        recs.push({
          id: `bundle-${category}`,
          type: 'bundle',
          title: `${category} Bundle Opportunity`,
          description: `Create a bundle with ${topInCategory[0].name} and ${topInCategory[1].name}. Both show strong projected demand in the ${category} category.`,
          impact: 'medium',
          reasoning: `Combining these high-demand products could increase average order value by 25-40%. Prophet ML shows both with ${topInCategory[0].trend} demand trends.`,
          targetProducts: topInCategory.map(p => p.name),
          estimatedROI: 25,
        });
        break;
      }
    }
    
    const seasonalProducts = predictiveProducts
      .filter(p => p.growthRate > 50 && p.predictedSales30d > p.currentSales * 1.5)
      .slice(0, 2);
    
    if (seasonalProducts.length > 0) {
      recs.push({
        id: 'seasonal',
        type: 'promotion',
        title: 'Seasonal Demand Surge Detected',
        description: `${seasonalProducts.length} product(s) showing potential seasonal spike. Prepare marketing campaigns and ensure adequate stock.`,
        impact: 'high',
        reasoning: `Prophet ML detected pattern indicating upcoming demand surge for ${seasonalProducts.map(p => p.name).join(', ')}.`,
        targetProducts: seasonalProducts.map(p => p.name),
        estimatedROI: 45,
        actionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    }
    
    const uncertainHighDemand = predictiveProducts
      .filter(p => p.predictedSales30d > 20 && p.confidence === 'low' && p.currentSales < p.predictedSales30d * 0.5)
      .slice(0, 2);
    
    if (uncertainHighDemand.length > 0) {
      recs.push({
        id: 'markdown',
        type: 'markdown',
        title: 'Test Market with Promotional Pricing',
        description: `${uncertainHighDemand.length} product(s) show high predicted demand but low ML confidence. Run a small promotion to validate demand.`,
        impact: 'low',
        reasoning: `Prophet ML predicts ${uncertainHighDemand[0]?.predictedSales30d} units for ${uncertainHighDemand[0]?.name} but confidence is low. A 10-15% discount can validate the forecast.`,
        targetProducts: uncertainHighDemand.map(p => p.name),
        estimatedROI: 20,
      });
    }
    
    return recs;
  }, [predictiveProducts, usingML]);

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

  // Render Predictive Analytics Tab Content
  const renderPredictiveAnalytics = () => (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-4"
    >
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Brain className="text-purple-600 w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-purple-800">AI Predictive Analytics Engine</h3>
            <p className="text-xs text-purple-600">
              Prophet ML model analyzing {predictiveProducts.length} products • {recommendations.length} active predictions
            </p>
          </div>
        </div>
      </div>

      {/* Top Sellers Comparison Chart */}
      <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <TrendingUpIcon className="text-blue-600 w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Top Sellers: Current vs AI Forecast</h2>
            <p className="text-xs text-gray-500">Compare current sales with Prophet ML predictions for the next 30 days</p>
          </div>
        </div>

        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSellersChartData} margin={{ top: 20, right: 30, left: 60, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 11 }} 
                angle={-45} 
                textAnchor="end" 
                height={80}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${value}`} />
              <Tooltip />
              <Legend />
              <Bar dataKey="currentSales" name="Current Sales (30d)" fill="#0B3C8A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="predictedSales" name="AI Forecast (30d)" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <Info size={14} className="inline mr-1" />
          Blue bars show actual sales from the last 30 days. Purple bars show Prophet ML predictions for the next 30 days.
          Products with significantly higher purple bars are expected to see increased demand.
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Award className="text-emerald-600 w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Current Top Sellers</h2>
                <p className="text-xs text-gray-500">Last 30 days sales performance</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {topCurrentSellers.length > 0 ? (
              topCurrentSellers.map((product, idx) => (
                <div
                  key={product.id}
                  onClick={() => {
                    setSelectedProductForInsight(product);
                    setShowProductInsightModal(true);
                  }}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-gray-100 text-gray-600' :
                      idx === 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{product.currentSales} units</p>
                    <p className="text-xs text-gray-400">sold</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400">
                <Package size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No sales data available yet</p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="text-purple-600 w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Predicted Future Top Sellers</h2>
                <p className="text-xs text-gray-500">AI forecast for next 30 days</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {topPredictedSellers.length > 0 ? (
              topPredictedSellers.map((product, idx) => {
                const isAlsoCurrentTop = product.isCurrentTopSeller;
                const growthIcon = product.growthRate > 0 ? 
                  <TrendingUp size={12} className="text-green-500" /> : 
                  product.growthRate < 0 ? 
                  <TrendingDown size={12} className="text-red-500" /> : 
                  <Minus size={12} className="text-gray-400" />;
                
                return (
                  <div
                    key={product.id}
                    onClick={() => {
                      setSelectedProductForInsight(product);
                      setShowProductInsightModal(true);
                    }}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                        idx === 1 ? 'bg-gray-100 text-gray-600' :
                        idx === 2 ? 'bg-amber-100 text-amber-700' :
                        'bg-purple-50 text-purple-600'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">{product.name}</p>
                          {isAlsoCurrentTop && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Current</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{product.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {growthIcon}
                        <p className="font-bold text-purple-600">{product.predictedSales30d} units</p>
                      </div>
                      <p className="text-xs text-gray-400">
                        {product.growthRate > 0 ? `+${Math.round(product.growthRate)}%` : `${Math.round(product.growthRate)}%`} growth
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-gray-400">
                <Database size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Insufficient data for predictions</p>
                <p className="text-xs mt-1">Need {MIN_TRANSACTIONS_FOR_ML - allTransactions.length} more transactions</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Sparkles className="text-amber-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">AI-Generated Recommendations</h2>
              <p className="text-xs text-gray-500">Actionable insights from Prophet ML analysis</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {aiRecommendations.length > 0 ? (
            aiRecommendations.map((rec) => {
              const getImpactColor = () => {
                switch (rec.impact) {
                  case 'high': return 'border-l-4 border-red-500';
                  case 'medium': return 'border-l-4 border-yellow-500';
                  default: return 'border-l-4 border-blue-500';
                }
              };
              
              const getTypeIcon = () => {
                switch (rec.type) {
                  case 'restock': return <Package size={16} className="text-green-600" />;
                  case 'promotion': return <Rocket size={16} className="text-orange-600" />;
                  case 'phase_out': return <AlertTriangle size={16} className="text-red-600" />;
                  case 'bundle': return <Star size={16} className="text-purple-600" />;
                  default: return <Sparkles size={16} className="text-amber-600" />;
                }
              };
              
              return (
                <div key={rec.id} className={`p-4 ${getImpactColor()} hover:bg-gray-50 transition-colors`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-gray-100">
                        {getTypeIcon()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-800">{rec.title}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            rec.impact === 'high' ? 'bg-red-100 text-red-700' :
                            rec.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {rec.impact.toUpperCase()} IMPACT
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {rec.targetProducts.map((product, idx) => (
                            <span key={idx} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {product}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <Info size={10} /> {rec.reasoning}
                        </p>
                      </div>
                    </div>
                    {rec.estimatedROI && (
                      <div className="text-right">
                        <div className="bg-green-50 rounded-lg px-2 py-1">
                          <p className="text-[10px] text-green-600 font-semibold">Est. ROI</p>
                          <p className="text-sm font-bold text-green-700">+{rec.estimatedROI}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-gray-400">
              <Brain size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No AI recommendations available</p>
              <p className="text-xs mt-1">Enable ML service and ensure sufficient transaction data</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <>
      {/* Dashboard Tab Navigation */}
      <div className="mb-4 border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveDashboardTab('overview')}
            className={`px-4 py-2 font-semibold text-sm rounded-t-lg transition-colors ${
              activeDashboardTab === 'overview'
                ? 'bg-[#0B3C8A] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveDashboardTab('predictive')}
            className={`px-4 py-2 font-semibold text-sm rounded-t-lg transition-colors flex items-center gap-2 ${
              activeDashboardTab === 'predictive'
                ? 'bg-[#0B3C8A] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Brain size={14} />
            Predictive Analytics
            {usingML && mlServiceAvailable && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {activeDashboardTab === 'overview' ? (
        // ORIGINAL OVERVIEW DASHBOARD - COMPLETELY UNCHANGED
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
                  {allLowStockItems.length > 3 && (
                    <button
                      onClick={() => setShowLowStockModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Eye size={14} />
                      View All ({allLowStockItems.length})
                    </button>
                  )}
                </div>
              </div>
              
              <div className="p-4 sm:p-5 pt-0">
                <div className="space-y-3">
                  {allLowStockItems.slice(0, 3).map((item) => (
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
                  {allLowStockItems.length === 0 && (
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

            {/* Smart Reorder Points - Upcoming Recommendations */}
            <motion.div
              variants={itemVariants}
              className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Clock className="text-blue-600 w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">
                        Smart Reorder Points
                      </h2>
                      <p className="text-xs font-medium text-blue-600">
                        AI-adjusted reorder point recommendations
                      </p>
                    </div>
                  </div>
                  {lowStockItems.length > 3 && (
                    <button
                      onClick={() => setShowUpcomingModal(true)}
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
                      onClick={() => {
                        setSelectedSmartReorderItem(item);
                        setShowSmartReorderModal(true);
                      }}
                      className="bg-blue-50 p-3 rounded-lg border border-blue-200 cursor-pointer hover:shadow-md hover:border-blue-400 transition-all"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-800 text-sm truncate">
                              {item.name}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500">{item.category}</p>
                        </div>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-200 rounded text-[10px] font-bold text-blue-800 whitespace-nowrap">
                          <Zap size={10} /> Smart
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div>
                          <p className="text-gray-500 text-xs">Static Reorder Point</p>
                          <p className="font-bold text-gray-900">{item.staticReorderPoint}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Smart Reorder Point</p>
                          <p className="font-bold text-blue-600">{item.smartReorderPoint}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Lead Time</p>
                          <p className="font-bold text-gray-900">{item.recommendedLeadTime}d</p>
                        </div>
                      </div>
                      {item.isSmartAdjusted && (() => {
                        const pct = item.staticReorderPoint > 0 
                          ? Math.round(((item.smartReorderPoint - item.staticReorderPoint) / item.staticReorderPoint) * 100)
                          : 0;
                        return (
                          <div className="text-xs bg-white text-blue-700 p-2 rounded border border-blue-200">
                            <p className="font-semibold">{pct > 0 ? '+' : ''}{pct}% extra safety stock added to keep you safe from running out</p>
                          </div>
                        );
                      })()}
                    </motion.div>
                  ))}  
                  {lowStockItems.length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle2 className="mx-auto w-10 h-10 text-gray-300 mb-3" />
                      <p className="text-sm text-gray-500">No reorder needed</p>
                      <p className="text-xs text-gray-400 mt-1">All items are above smart reorder points</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

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
        </motion.div>
      ) : (
        renderPredictiveAnalytics()
      )}

      {/* Smart Reorder Points Modal */}
      <AnimatePresence>
        {showUpcomingModal && (
          <Modal
            title="Smart Reorder Points - All Items"
            onClose={() => setShowUpcomingModal(false)}
          >
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => {
                    setShowUpcomingModal(false);
                    setSelectedSmartReorderItem(item);
                    setShowSmartReorderModal(true);
                  }}
                  className="bg-blue-50 p-3 rounded-lg border border-blue-200 cursor-pointer hover:shadow-md hover:border-blue-400 transition-all"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800 text-sm truncate">
                          {item.name}
                        </h3>
                        {item.isSmartAdjusted && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-200 rounded text-[10px] font-bold text-blue-800 whitespace-nowrap">
                            <Zap size={10} /> Smart
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 bg-blue-100 text-blue-700">
                      REORDER
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <p className="text-gray-500 text-xs">Static Reorder Point</p>
                      <p className="font-bold text-gray-900">{item.staticReorderPoint}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Smart Reorder</p>
                      <p className="font-bold text-blue-600">{item.smartReorderPoint}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Lead Time</p>
                      <p className="font-bold text-gray-900">{item.recommendedLeadTime}d</p>
                    </div>
                  </div>
                  {item.isSmartAdjusted && (() => {
                    const pct = item.staticReorderPoint > 0 
                      ? Math.round(((item.smartReorderPoint - item.staticReorderPoint) / item.staticReorderPoint) * 100)
                      : 0;
                    return (
                      <div className="text-xs bg-white text-blue-700 p-2 rounded border border-blue-200">
                        <p className="font-semibold mb-1">{pct > 0 ? '+' : ''}{pct}% extra safety stock added to keep you safe from running out</p>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Low Stock Modal */}
      <AnimatePresence>
        {showLowStockModal && (
          <Modal
            title="Low Stock Alerts"
            onClose={() => setShowLowStockModal(false)}
          >
            <div className="space-y-3">
              {allLowStockItems.map((item) => (
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

      {/* Smart Reorder Point Explanation Modal */}
      <AnimatePresence>
        {showSmartReorderModal && selectedSmartReorderItem && (
          <SmartReorderExplanationModal
            item={selectedSmartReorderItem}
            onClose={() => {
              setShowSmartReorderModal(false);
              setSelectedSmartReorderItem(null);
            }}
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

      {/* Predictive Analytics Product Insight Modal */}
      <AnimatePresence>
        {showProductInsightModal && selectedProductForInsight && (
          <PredictiveProductInsightModal
            product={selectedProductForInsight}
            onClose={() => {
              setShowProductInsightModal(false);
              setSelectedProductForInsight(null);
            }}
            recommendations={recommendations}
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
            className="w-full px-4 py-2.5 text-sm font-medium bg-[#0B3C8A] text-white rounded-xl hover:bg-[#082F6E] transition-colors"
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

// Smart Reorder Point Explanation Modal
function SmartReorderExplanationModal({ 
  item, 
  onClose
}: { 
  item: LowStockItem; 
  onClose: () => void;
}) {
  const adjustmentPercentage = item.staticReorderPoint > 0 
    ? Math.round(((item.smartReorderPoint - item.staticReorderPoint) / item.staticReorderPoint) * 100)
    : 0;

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
              <p className="text-sm text-gray-500 mt-1">{item.category} • Smart Reorder Point Analysis</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Main Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Current Stock</p>
              <p className="text-3xl font-bold text-gray-900">{item.currentStock}</p>
              <p className="text-xs text-gray-400 mt-1">units</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Smart Reorder Point</p>
              <p className="text-3xl font-bold text-blue-700">{item.smartReorderPoint}</p>
              <p className="text-xs text-blue-600 mt-1">units</p>
            </div>
          </div>

          {/* Static vs Smart Comparison */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <BarChart3 size={18} className="text-emerald-600" />
              Reorder Point Comparison
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Static Reorder Point</span>
                <span className="font-bold text-gray-900">{item.staticReorderPoint} units</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gray-400 h-2 rounded-full" 
                  style={{ width: `${(item.staticReorderPoint / Math.max(item.staticReorderPoint, item.smartReorderPoint)) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Smart Reorder Point</span>
                <span className="font-bold text-blue-700">{item.smartReorderPoint} units</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: '100%' }}
                ></div>
              </div>
            </div>
            {item.isSmartAdjusted && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-3">
                <p className="text-xs text-blue-700">
                  <span className="font-bold">{adjustmentPercentage > 0 ? '+' : ''}{adjustmentPercentage}%</span> extra safety stock added to keep you safe from running out
                </p>
              </div>
            )}
          </div>

          {/* Adjustment Factors */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Zap size={18} className="text-orange-600" />
              What's Affecting This Number?
            </h3>
            <div className="space-y-2">
              {/* Delivery Wait Time */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-blue-600" />
                  <span className="font-semibold text-gray-800 text-sm">Delivery Wait Time</span>
                </div>
                <p className="text-xs text-gray-600 ml-6">
                  It takes <span className="font-bold text-gray-900">{item.recommendedLeadTime} days</span> to receive new stock, so we keep extra on hand
                </p>
              </div>

              {/* Expected Sales */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-green-600" />
                  <span className="font-semibold text-gray-800 text-sm">Expected Sales (Next 30 Days)</span>
                </div>
                <p className="text-xs text-gray-600 ml-6">
                  We expect to sell: <span className="font-bold text-gray-900">{item.predictedDemand30d || 'N/A'} units</span>
                </p>
              </div>

              {/* Days Until We Run Out */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-red-600" />
                  <span className="font-semibold text-gray-800 text-sm">Days Until We Run Out</span>
                </div>
                <p className="text-xs text-gray-600 ml-6">
                  Current stock will last: <span className="font-bold text-gray-900">{item.daysUntilStockout === 999 ? 'Very long time' : item.daysUntilStockout + ' days'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Why This Amount */}
          {item.isSmartAdjusted && item.adjustmentReason && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
              <h3 className="font-bold text-gray-800 mb-2 text-sm">Why We Recommend This Amount</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                {item.adjustmentReason}
              </p>
            </div>
          )}

          {/* What You Should Do */}
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-900 mb-1">What to Do</p>
                <p className="text-sm text-emerald-800">
                  {item.currentStock <= item.smartReorderPoint 
                    ? `Update your reorder point to ${item.smartReorderPoint} units and place an order now! You currently have ${item.currentStock} units.`
                    : `✓ Stock is good. No reorder point update needed right now.`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* How This Works */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">How We Calculate This Number</h3>
            <ul className="space-y-3 text-xs text-gray-600">
              <li className="flex gap-3">
                <span className="font-bold text-gray-800 flex-shrink-0 w-5">1.</span>
                <span><span className="font-semibold">Delivery Time Buffer:</span> We add extra stock for the {item.recommendedLeadTime} days it takes to receive new orders</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-gray-800 flex-shrink-0 w-5">2.</span>
                <span><span className="font-semibold">Sales Trend:</span> If sales are going up, we keep more stock. If going down, we keep less.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-gray-800 flex-shrink-0 w-5">3.</span>
                <span><span className="font-semibold">Urgency:</span> If you're about to run out, we push the number higher to prevent stockouts</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-gray-800 flex-shrink-0 w-5">4.</span>
                <span><span className="font-semibold">Final Recommendation:</span> All these factors combine to give you the safest stock level</span>
              </li>
            </ul>
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

// Predictive Product Insight Modal Component
function PredictiveProductInsightModal({
  product,
  onClose,
  recommendations
}: {
  product: PredictiveProduct;
  onClose: () => void;
  recommendations: any[];
}) {
  const productRecommendation = recommendations.find(
    (rec: any) => rec.productId === product.id || rec.productName === product.name
  );
  
  const getTrendColor = () => {
    switch (product.trend) {
      case 'up': return 'text-green-600 bg-green-100';
      case 'down': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };
  
  const getTrendIcon = () => {
    switch (product.trend) {
      case 'up': return <TrendingUp size={16} className="text-green-600" />;
      case 'down': return <TrendingDown size={16} className="text-red-600" />;
      default: return <Minus size={16} className="text-gray-600" />;
    }
  };
  
  const getConfidenceText = () => {
    switch (product.confidence) {
      case 'high': return 'High confidence - Prophet ML strongly indicates this trend';
      case 'medium': return 'Medium confidence - Additional data would improve accuracy';
      default: return 'Low confidence - Based on limited historical data';
    }
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
        <div className="sticky top-0 bg-gradient-to-r from-purple-50 to-white p-5 border-b border-gray-200 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target size={20} className="text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">{product.name}</h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getTrendColor()}`}>
                  {getTrendIcon()}
                  {product.trend === 'up' ? 'Upward' : product.trend === 'down' ? 'Declining' : 'Stable'} Trend
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{product.category}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Prediction Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Current', sales: product.currentSales },
                { name: '30d Forecast', sales: product.predictedSales30d },
                { name: '60d Forecast', sales: product.predictedSales60d },
                { name: '90d Forecast', sales: product.predictedSales90d }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sales" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                  <Cell fill="#0B3C8A" />
                  <Cell fill="#8B5CF6" />
                  <Cell fill="#A855F7" />
                  <Cell fill="#C084FC" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Growth Rate</p>
              <p className={`text-2xl font-bold ${product.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {product.growthRate >= 0 ? '+' : ''}{Math.round(product.growthRate)}%
              </p>
              <p className="text-[10px] text-gray-400 mt-1">30-day projection</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider">ML Confidence</p>
              <p className={`text-2xl font-bold ${
                product.confidence === 'high' ? 'text-green-600' :
                product.confidence === 'medium' ? 'text-yellow-600' :
                'text-orange-600'
              }`}>
                {product.confidence === 'high' ? 'High' : product.confidence === 'medium' ? 'Medium' : 'Low'}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">{getConfidenceText()}</p>
            </div>
          </div>

          {/* Current vs Predicted Performance */}
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-800 mb-3">Performance Comparison</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Current Sales (30 days)</span>
                  <span className="font-bold text-gray-800">{product.currentSales} units</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(100, (product.currentSales / Math.max(product.predictedSales30d, product.currentSales)) * 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Predicted Sales (30 days)</span>
                  <span className="font-bold text-purple-600">{product.predictedSales30d} units</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${Math.min(100, (product.predictedSales30d / Math.max(product.predictedSales30d, product.currentSales)) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={18} className="text-purple-600" />
              <h3 className="font-bold text-purple-800">AI-Generated Insights</h3>
            </div>
            <ul className="space-y-2 text-sm text-purple-700">
              {product.trend === 'up' && (
                <li className="flex items-start gap-2">
                  <TrendingUpIcon size={14} className="mt-0.5 flex-shrink-0" />
                  <span>This product is trending upward. Consider increasing stock levels to meet projected demand.</span>
                </li>
              )}
              {product.trend === 'down' && (
                <li className="flex items-start gap-2">
                  <TrendingDown size={14} className="mt-0.5 flex-shrink-0" />
                  <span>Declining sales pattern detected. Review pricing or consider promotional activities.</span>
                </li>
              )}
              {product.predictedSales30d > product.currentSales * 1.5 && (
                <li className="flex items-start gap-2">
                  <Rocket size={14} className="mt-0.5 flex-shrink-0" />
                  <span>Demand is expected to surge by {Math.round(((product.predictedSales30d - product.currentSales) / product.currentSales) * 100)}%. Prepare inventory accordingly.</span>
                </li>
              )}
              {product.currentSales > 0 && product.predictedSales30d < product.currentSales * 0.5 && (
                <li className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>Demand may drop significantly. Consider reducing stock levels or running promotions.</span>
                </li>
              )}
              {productRecommendation && productRecommendation.recommendedOrder > 0 && (
                <li className="flex items-start gap-2">
                  <Package size={14} className="mt-0.5 flex-shrink-0" />
                  <span>Recommended to order {productRecommendation.recommendedOrder} units to cover demand through stockout.</span>
                </li>
              )}
            </ul>
          </div>

          {/* Recommended Actions */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={18} className="text-amber-600" />
              <h3 className="font-bold text-amber-800">Recommended Actions</h3>
            </div>
            <ul className="space-y-2 text-sm text-amber-700">
              {product.trend === 'up' && (
                <li>• Increase stock levels by {Math.ceil(product.predictedSales30d - product.currentSales)}+ units</li>
              )}
              {product.trend === 'down' && (
                <li>• Consider {product.currentSales > 0 ? '10-15%' : '20-25%'} discount promotion</li>
              )}
              {product.predictedSales30d > product.currentSales && product.currentSales > 0 && (
                <li>• Prepare marketing campaign for upcoming demand surge</li>
              )}
              <li>• Monitor stock levels closely over the next 30 days</li>
              <li>• Review category performance for bundle opportunities</li>
            </ul>
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