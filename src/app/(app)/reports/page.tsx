// src/app/(app)/reports/page.tsx
"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useNotification } from "@/components/NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";
import { useMLForecasting } from "@/hooks/useMLForecasting";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  TrendingUp, 
  DollarSign, 
  Download, 
  TrendingDown, 
  BrainCircuit, 
  AlertTriangle, 
  Package, 
  Activity,
  Receipt,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Calendar,
  Database
} from "lucide-react";

interface TransactionType {
  id: string;
  patientName: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  date: Date;
  status: "completed" | "voided";
}

interface DeadstockItem {
  item: string;
  daysUnsold: number;
  lockedValue: string;
  category: string;
  stock: number;
}

interface RestockItem {
  item: string;
  predictedNeed: number;
  leadTime: string;
  orderBy: string;
  urgency: string;
  currentStock: number;
  confidence: 'high' | 'medium' | 'low';
}

interface TopPerformer {
  item: string;
  category: string;
  units: number;
  revenue: string;
  revenueValue: number;
  width: string;
}

interface ChartData {
  month: string;
  value: number;
  type: 'history' | 'forecast';
  lower?: number;
  upper?: number;
  model?: string;
}

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

const calculateOrderDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDateToLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Minimum data threshold for ML features
const MIN_TRANSACTIONS_FOR_ML = 10;
const MIN_DAYS_SPREAD = 14;

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"analytics" | "ledger">("analytics");
  const [ledgerMonth, setLedgerMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "voided">("all");
  const [dateFilter, setDateFilter] = useState("");
  
  const { showNotification } = useNotification();
  const { 
    products, 
    transactions: firebaseTransactions,
    getTopSellingProducts,
    getLowStockProducts,
    getDeadstockProducts,
    getThisMonthSales
  } = useFirebase();
  
  const { loading, forecastData, recommendations, metrics, usingML } = useMLForecasting();

  const transactions = useMemo(() => {
    return firebaseTransactions as TransactionType[];
  }, [firebaseTransactions]);

  // Check if we have enough data for ML features
  const completedTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'completed');
  }, [transactions]);

  const hasEnoughDataForML = useMemo(() => {
    if (completedTransactions.length < MIN_TRANSACTIONS_FOR_ML) return false;
    
    // Check date spread
    if (completedTransactions.length === 0) return false;
    const dates = completedTransactions.map(t => new Date(t.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const daysSpread = (maxDate - minDate) / (1000 * 60 * 60 * 24);
    
    return daysSpread >= MIN_DAYS_SPREAD;
  }, [completedTransactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(trx => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" || 
        trx.id.toLowerCase().includes(searchLower) ||
        trx.patientName.toLowerCase().includes(searchLower) ||
        trx.items.some(item => item.name.toLowerCase().includes(searchLower)) ||
        new Date(trx.date).toLocaleDateString().toLowerCase().includes(searchLower);
      
      const transactionMonth = new Date(trx.date).toISOString().slice(0, 7);
      const matchesMonth = ledgerMonth === "All" || transactionMonth === ledgerMonth;
      const matchesStatus = statusFilter === "all" || trx.status === statusFilter;
      
      let matchesDate = true;
      if (dateFilter) {
        const trxDate = new Date(trx.date);
        const trxLocalDate = formatDateToLocal(trxDate);
        matchesDate = trxLocalDate === dateFilter;
      }
      
      return matchesSearch && matchesMonth && matchesStatus && matchesDate;
    });
  }, [transactions, searchQuery, ledgerMonth, statusFilter, dateFilter]);

  const deadstockValues: DeadstockItem[] = useMemo(() => {
    const deadstockFunc = getDeadstockProducts;
    if (deadstockFunc) {
      return deadstockFunc()
        .slice(0, 2)
        .map(p => ({
          item: p.name,
          daysUnsold: p.lastMovedDaysAgo,
          lockedValue: `₱${(p.baseCost * p.stock).toLocaleString()}`,
          category: p.category,
          stock: p.stock
        }));
    }
    return [];
  }, [getDeadstockProducts]);

  const topSellers = useMemo(() => {
    const topSellingFunc = getTopSellingProducts;
    return topSellingFunc ? topSellingFunc(5) : [];
  }, [getTopSellingProducts]);

  const topPerformers: TopPerformer[] = useMemo(() => {
    if (topSellers.length > 0) {
      const maxRevenue = Math.max(...topSellers.map(s => s.revenue));
      
      return topSellers.map((seller) => ({
        item: seller.product.name,
        category: seller.product.category,
        units: seller.quantity,
        revenue: `₱${seller.revenue.toLocaleString()}`,
        revenueValue: seller.revenue,
        width: maxRevenue > 0 ? `${(seller.revenue / maxRevenue) * 100}%` : '0%'
      }));
    }
    return [];
  }, [topSellers]);

  const thisMonthSales = useMemo(() => {
    const monthSalesFunc = getThisMonthSales;
    return monthSalesFunc ? monthSalesFunc() : 0;
  }, [getThisMonthSales]);

  const kpiValues = {
    revenue: { 
      value: `₱${thisMonthSales.toLocaleString()}`, 
      trend: metrics ? `${metrics.revenue.trend > 0 ? '+' : ''}${metrics.revenue.trend.toFixed(1)}%` : "+0%", 
      isUp: metrics ? metrics.revenue.trend > 0 : true 
    },
    profit: { 
      value: `₱${Math.round(thisMonthSales * 0.4).toLocaleString()}`, 
      trend: metrics ? `${(metrics.revenue.trend * 0.4).toFixed(1)}%` : "+0%", 
      isUp: metrics ? metrics.revenue.trend > 0 : true 
    },
    units: { 
      value: products?.reduce((sum, p) => sum + p.stock, 0).toString() || "0", 
      trend: products?.length ? "Active" : "No items",
      isUp: true 
    },
    avgTransaction: { 
      value: transactions.length > 0 
        ? `₱${Math.round(transactions.reduce((sum, t) => sum + t.total, 0) / transactions.length).toLocaleString()}`
        : "₱0", 
      trend: "+0%", 
      isUp: true 
    },
  };

  // Only use real forecast data, never mock data
  const chartData: ChartData[] = useMemo(() => {
    if (hasEnoughDataForML && forecastData && forecastData.length > 0) {
      return forecastData as ChartData[];
    }
    return [];
  }, [hasEnoughDataForML, forecastData]);

  const restockItems: RestockItem[] = useMemo(() => {
    if (hasEnoughDataForML && recommendations.length > 0) {
      return recommendations.slice(0, 3).map(r => ({
        item: r.productName,
        predictedNeed: r.predictedDemand,
        leadTime: `${r.leadTimeDays} Days`,
        orderBy: calculateOrderDate(r.daysUntilOut),
        urgency: r.confidence === 'high' ? 'High' : r.confidence === 'medium' ? 'Medium' : 'Low',
        currentStock: r.currentStock,
        confidence: r.confidence
      }));
    } else {
      const lowStockFunc = getLowStockProducts;
      const lowStock = lowStockFunc ? lowStockFunc().slice(0, 3) : [];
      return lowStock.map(p => ({
        item: p.name,
        predictedNeed: p.reorderPoint * 2,
        leadTime: `${p.leadTimeDays} Days`,
        orderBy: calculateOrderDate(p.leadTimeDays),
        urgency: p.stock <= 0 ? 'High' : 'Medium',
        currentStock: p.stock,
        confidence: 'medium' as const
      }));
    }
  }, [hasEnoughDataForML, recommendations, getLowStockProducts]);

  const exportLedgerReport = () => {
    if (filteredTransactions.length === 0) {
      showNotification("No transactions found for this period to export.", "error");
      return;
    }

    showNotification("Generating Transaction Ledger PDF...", "success");
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, currentY, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text("Sales Transaction Ledger", pageWidth / 2, currentY + 8, { align: 'center' });
    
    const displayMonth = ledgerMonth === "All" ? "All Time" : new Date(`${ledgerMonth}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${displayMonth} | Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, currentY + 15, { align: 'center' });

    const validTransactions = filteredTransactions.filter(t => t.status === 'completed');
    const totalRevenue = validTransactions.reduce((sum, trx) => sum + trx.total, 0);

    currentY = 50;

    autoTable(doc, {
      startY: currentY,
      head: [['Receipt No', 'Date', 'Patient Name', 'Items', 'Status', 'Amount (PHP)']],
      body: filteredTransactions.map(t => {
        const itemsStr = t.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
        return [
          t.id.slice(-8).toUpperCase(), 
          new Date(t.date).toLocaleDateString(), 
          t.patientName, 
          itemsStr.length > 30 ? itemsStr.slice(0, 30) + '...' : itemsStr,
          t.status.toUpperCase(),
          t.total.toLocaleString()
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || currentY;
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Transactions: ${validTransactions.length}`, 14, finalY + 10);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Revenue: PHP ${totalRevenue.toLocaleString()}`, 14, finalY + 20);

    doc.save(`Sales_Ledger_${displayMonth.replace(" ", "_")}.pdf`);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setLedgerMonth(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    setStatusFilter("all");
    setDateFilter("");
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full font-sans sm:mt-2 p-2 sm:p-4 box-border pb-20 space-y-4 sm:space-y-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full font-sans sm:mt-2 p-2 sm:p-4 box-border pb-20 space-y-4 sm:space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg">
                <BrainCircuit className={THEME_TEXT} size={24} />
              </div>
              Reports & Analytics
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-6 mt-6 border-b border-gray-100 pb-1">
          <button 
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-2 sm:px-4 py-2 font-bold text-xs sm:text-sm rounded-t-lg transition-all border-b-2 ${activeTab === 'analytics' ? 'border-[#0B3C8A] text-[#0B3C8A]' : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <TrendingUp size={16} /> AI Analytics & Forecast
          </button>
          <button 
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 px-2 sm:px-4 py-2 font-bold text-xs sm:text-sm rounded-t-lg transition-all border-b-2 ${activeTab === 'ledger' ? 'border-[#0B3C8A] text-[#0B3C8A]' : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <Receipt size={16} /> Transaction Ledger
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "analytics" ? (
          <motion.div 
            key="analytics"
            variants={containerVariants} 
            initial="hidden" 
            animate="visible" 
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 sm:space-y-6"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <motion.div variants={itemVariants} className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50 text-blue-600">
                    <DollarSign size={20} />
                  </div>
                  <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${kpiValues.revenue.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {kpiValues.revenue.isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {kpiValues.revenue.trend}
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm text-gray-500 font-medium">Monthly Revenue</h3>
                <div className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{kpiValues.revenue.value}</div>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
                    <Activity size={20} />
                  </div>
                  <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${kpiValues.profit.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {kpiValues.profit.isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {kpiValues.profit.trend}
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm text-gray-500 font-medium">Gross Profit</h3>
                <div className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{kpiValues.profit.value}</div>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div className="p-2 sm:p-2.5 rounded-lg bg-orange-50 text-orange-600">
                    <Package size={20} />
                  </div>
                  <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded ${kpiValues.units.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {kpiValues.units.trend}
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm text-gray-500 font-medium">Total Units in Stock</h3>
                <div className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{kpiValues.units.value}</div>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div className="p-2 sm:p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <TrendingUp size={20} />
                  </div>
                  <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${kpiValues.avgTransaction.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {kpiValues.avgTransaction.isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {kpiValues.avgTransaction.trend}
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm text-gray-500 font-medium">Avg. Transaction</h3>
                <div className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{kpiValues.avgTransaction.value}</div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <motion.div variants={itemVariants} className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="p-1.5 sm:p-2 bg-[#0B3C8A] rounded-lg">
                        <TrendingUp className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                        Projected Demand Forecast
                      </h2>
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-500 ml-1">
                      {usingML && hasEnoughDataForML ? "FBProphet / XGBoost ML Predictions" : "Insufficient data for forecasts"}
                    </p>
                  </div>
                  {hasEnoughDataForML && usingML && (
                    <div className="flex gap-4 text-[10px] sm:text-xs font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                      <span className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded bg-[#0B3C8A]"></div> Actual
                      </span>
                      <span className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded bg-blue-300"></div> Forecast
                      </span>
                    </div>
                  )}
                </div>
                
                {hasEnoughDataForML && chartData.length > 0 ? (
                  <div className="flex-1 flex flex-col justify-end min-h-50 relative">
                    <div className="relative z-10 w-full h-full flex items-end justify-between px-2 sm:px-10 gap-2 sm:gap-6">
                      {chartData.map((data) => {
                        const isActual = data.type === 'history';
                        const barColor = isActual ? "bg-[#0B3C8A]" : "bg-blue-300";
                        const height = `${Math.min(100, data.value)}%`;
                        const monthTextColor = isActual ? "text-gray-600" : "text-blue-600";

                        return (
                          <div key={`chart-${data.month}`} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                            <div 
                              className={`w-6 sm:w-10 ${barColor} rounded-t-sm transition-all relative`}
                              style={{ height }}
                            >
                              <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                ₱{data.value}k
                              </span>
                            </div>
                            <span className={`text-[10px] sm:text-xs font-medium ${monthTextColor} mt-2`}>
                              {data.month}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 bg-blue-50/50 p-3 sm:p-4 rounded-lg border border-blue-100 text-[10px] sm:text-xs text-[#0B3C8A] flex items-start sm:items-center gap-3">
                      <div className="p-1.5 bg-white rounded-md shadow-sm shrink-0">
                        <BrainCircuit size={16} />
                      </div>
                      <p className="leading-relaxed font-medium">
                        <strong>AI Insight:</strong> {metrics ? 
                          `Expected ${metrics.revenue.trend > 0 ? 'growth' : 'decline'} of ${Math.abs(metrics.revenue.trend).toFixed(1)}% in next 30 days.` : 
                          `Analyzing transactions to generate insights...`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-gray-50 rounded-lg">
                    <Database size={48} className="mb-3 opacity-20" />
                    <p className="text-sm font-medium">Not enough transaction data</p>
                    <p className="text-xs mt-1 text-center max-w-sm px-4">
                      Need at least {MIN_TRANSACTIONS_FOR_ML} completed transactions spread across {MIN_DAYS_SPREAD} days.
                      <br />
                      Current: {completedTransactions.length} transactions over {completedTransactions.length > 0 
                        ? Math.round((Math.max(...completedTransactions.map(t => new Date(t.date).getTime())) - 
                           Math.min(...completedTransactions.map(t => new Date(t.date).getTime()))) / (1000 * 60 * 60 * 24)) 
                        : 0} days
                    </p>
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 sm:p-2 bg-emerald-50 rounded-lg">
                    <Package className="text-emerald-600 w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-lg font-bold text-gray-800">Smart Restock</h2>
                    <p className="text-[9px] sm:text-xs text-gray-500">
                      {hasEnoughDataForML && usingML ? 'AI order date planning' : 'Based on stock levels'}
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 overflow-x-auto space-y-3 sm:space-y-4">
                  {restockItems.length > 0 ? (
                    restockItems.map((item, idx) => {
                      const badgeColors = [
                        "bg-red-100 text-red-700",
                        "bg-orange-100 text-orange-700",
                        "bg-emerald-100 text-emerald-700"
                      ];
                      return (
                        <div key={`restock-${idx}`} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-800 truncate pr-2">
                              {item.item}
                            </h4>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${badgeColors[idx % 3]}`}>
                              {item.urgency}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] sm:text-xs text-gray-500">
                            <span>Current: <strong className="text-gray-800">{item.currentStock} units</strong></span>
                            <span>Need: <strong className="text-gray-800">{item.predictedNeed} units</strong></span>
                          </div>
                          <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 mt-1">
                            <span>Order by: <strong className="text-blue-600">{item.orderBy}</strong></span>
                            <span>Lead: {item.leadTime}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[10px] sm:text-xs text-gray-500 text-center py-4">
                      No restock recommendations at this time.
                    </p>
                  )}
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg">
                    <TrendingUp className="text-[#0B3C8A] w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-lg font-bold text-gray-800">Top Moving Items</h2>
                    <p className="text-[9px] sm:text-xs text-gray-500">
                      {topPerformers.length > 0 ? 'Highest volume drivers' : 'No sales data available yet'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 sm:space-y-5">
                  {topPerformers.length > 0 ? (
                    topPerformers.map((item, idx) => (
                      <div key={`performer-${idx}`} className="flex items-center gap-3 sm:gap-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#0B3C8A] font-bold text-xs sm:text-sm shrink-0 border border-blue-100">
                          #{idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-end mb-1">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-800 truncate">
                              {item.item}
                            </h4>
                            <span className="text-[10px] sm:text-xs font-bold text-[#0B3C8A]">
                              {item.revenue}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${THEME_BG}`} 
                                style={{ width: item.width }} 
                              />
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-medium text-gray-500 w-12 text-right shrink-0">
                              {item.units} units
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Package size={32} className="mx-auto mb-2 opacity-20"/>
                      <p className="text-xs">No sales recorded yet</p>
                      <p className="text-[10px] mt-1">Complete transactions in Sales page to see top performers</p>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-red-100 p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-400"></div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 sm:p-2 bg-red-50 rounded-lg">
                    <AlertTriangle className="text-red-600 w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-lg font-bold text-gray-800">Deadstock Impact</h2>
                    <p className="text-[9px] sm:text-xs text-gray-500">Capital tied in non-moving inventory</p>
                  </div>
                </div>
                
                <div className="mb-4 sm:mb-6 bg-red-50/50 border border-red-100 rounded-lg p-4 text-center">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">Locked Capital</span>
                  <div className="text-2xl sm:text-3xl font-black text-red-600 mt-1">
                    ₱{deadstockValues.reduce((sum, item) => 
                      sum + parseInt(item.lockedValue.replace(/[^\d]/g, '')), 0
                    ).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {deadstockValues.length > 0 ? (
                    deadstockValues.map((item, idx) => (
                      <div key={`deadstock-${idx}`} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg">
                        <div className="min-w-0 pr-3">
                          <h4 className="text-[11px] sm:text-sm font-semibold text-gray-800 truncate">
                            {item.item}
                          </h4>
                          <span className="text-[9px] sm:text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <Clock size={10}/> {item.daysUnsold} Days Unsold • {item.stock} units
                          </span>
                        </div>
                        <div className="text-[11px] sm:text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded shrink-0">
                          {item.lockedValue}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-400">
                      <Package size={24} className="mx-auto mb-2 opacity-20"/>
                      <p className="text-xs">No deadstock items identified</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>

        ) : (
          <motion.div 
            key="ledger"
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
          >
            {/* ... Transaction Ledger section remains the same ... */}
            <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FileText className={THEME_TEXT} size={20}/> Sales Ledger
                </h2>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                  {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search by receipt, patient, item..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400"
                  />
                </div>

                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input 
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full sm:w-40 pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "completed" | "voided")}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700"
                >
                  <option value="all" className="text-gray-700">All Status</option>
                  <option value="completed" className="text-gray-700">Completed</option>
                  <option value="voided" className="text-gray-700">Voided</option>
                </select>

                {(searchQuery || dateFilter || statusFilter !== 'all') && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 text-xs sm:text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                )}

                <button 
                  onClick={exportLedgerReport}
                  className={`flex items-center justify-center gap-1.5 ${THEME_BG} ${THEME_HOVER} text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0`}
                >
                  <Download size={14} /> Export
                </button>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-[11px] sm:text-sm whitespace-nowrap min-w-175">
                <thead className="bg-gray-50/50 text-gray-500 font-semibold text-[10px] sm:text-xs border-b border-gray-100">
                  <tr>
                    <th className="p-4">Receipt No.</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Patient Name</th>
                    <th className="p-4">Items</th>
                    <th className="p-4 text-right">Amount (₱)</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((trx, idx) => {
                      const dateObj = new Date(trx.date);
                      const formattedDate = dateObj.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      });
                      const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <tr key={`ledger-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 font-mono font-medium text-gray-500">
                            {trx.id.slice(-8).toUpperCase()}
                          </td>
                          <td className="p-4 text-gray-600">
                            {formattedDate} {formattedTime}
                          </td>
                          <td className="p-4 font-semibold text-gray-800">
                            {trx.patientName}
                          </td>
                          <td className="p-4 text-gray-600 max-w-xs">
                            <div className="truncate" title={trx.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}>
                              {trx.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                            </div>
                          </td>
                          <td className="p-4 text-right font-bold text-gray-800">
                            ₱{trx.total.toLocaleString()}
                          </td>
                          <td className="p-4 text-center">
                            {trx.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold">
                                <CheckCircle2 size={12}/> COMPLETED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-[10px] font-bold">
                                <XCircle size={12}/> VOIDED
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">
                        <Receipt size={32} className="mx-auto mb-2 opacity-20"/>
                        No transactions found.
                        {(searchQuery || dateFilter || statusFilter !== 'all') && (
                          <button
                            onClick={clearFilters}
                            className="block mx-auto mt-2 text-xs text-[#0B3C8A] hover:underline"
                          >
                            Clear filters
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredTransactions.length > 0 && (
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <div className="flex justify-end gap-8 text-sm">
                  <div>
                    <span className="text-gray-500">Total Transactions:</span>
                    <span className="ml-2 font-bold text-gray-800">{filteredTransactions.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Revenue:</span>
                    <span className="ml-2 font-bold text-[#0B3C8A]">
                      ₱{filteredTransactions
                        .filter(t => t.status === 'completed')
                        .reduce((sum, t) => sum + t.total, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}