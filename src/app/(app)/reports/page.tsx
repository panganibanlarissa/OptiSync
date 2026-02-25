"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useNotification } from "@/components/NotificationProvider";
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
  Clock
} from "lucide-react";

// --- THEME CONSTANTS ---
const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";
const THEME_RING = "focus:ring-[#0B3C8A]";

// --- ANIMATION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

// --- MOCK DATA: KPI VALUES ONLY ---
const KPI_VALUES = {
  revenue: { value: "₱145,200", trend: "+12.5%", isUp: true },
  profit: { value: "₱82,450", trend: "+8.2%", isUp: true },
  units: { value: "312", trend: "-2.1%", isUp: false },
  avgTransaction: { value: "₱1,850", trend: "+5.4%", isUp: true },
};

// --- MOCK DATA: RESTOCK VALUES ONLY ---
const RESTOCK_VALUES = [
  { item: "Essilor Crizal Prevencia", predictedNeed: 45, leadTime: "3 Days", orderBy: "Feb 24", urgency: "High" },
  { item: "Transition Signature Gen 8", predictedNeed: 20, leadTime: "5 Days", orderBy: "Feb 26", urgency: "Medium" },
  { item: "Opti-Free PureMoist 300ml", predictedNeed: 60, leadTime: "2 Days", orderBy: "Feb 28", urgency: "Low" },
];

// --- MOCK DATA: TOP PERFORMERS VALUES ONLY ---
const TOP_PERFORMERS_VALUES = [
  { item: "Anti-Rad Blue Cut Lenses", category: "Lenses", units: 145, revenue: "₱174,000", width: "80%" },
  { item: "Titanium Rimless Frames", category: "Frames", units: 82, revenue: "₱287,000", width: "60%" },
  { item: "Air Optix Monthly Contacts", category: "Contacts", units: 56, revenue: "₱100,800", width: "40%" },
];

// --- MOCK DATA: DEADSTOCK VALUES ONLY ---
const DEADSTOCK_VALUES = [
  { item: "Kids Flexible Frames (Neon)", daysUnsold: 85, lockedValue: "₱12,000" },
  { item: "Generic Saline Solution 100ml", daysUnsold: 62, lockedValue: "₱3,400" },
];

// --- MOCK DATA: FORECAST CHART VALUES ONLY ---
const FORECAST_VALUES = [
  { month: "Jan", height: "40%", value: "₱40k", isActual: true },
  { month: "Feb", height: "40%", value: "₱40k", isActual: true },
  { month: "Mar", height: "55%", value: "₱55k", isActual: true },
  { month: "Apr", height: "45%", value: "₱45k", isActual: true },
  { month: "May", height: "70%", value: "₱70k", isActual: true },
  { month: "Jun", height: "85%", value: "₱85k", isActual: false },
  { month: "Jul", height: "95%", value: "₱95k", isActual: false },
  { month: "Aug", height: "110%", value: "₱110k", isActual: false },
];

// --- MOCK DATA: TRANSACTIONS (With ISO Dates for Filtering) ---
const MOCK_TRANSACTIONS = [
  { id: "TRX-90214", date: "2026-01-05T10:30:00", patient: "Juan Dela Cruz", items: "1x Titanium Frame, 2x Essilor Lenses", total: 8500, status: "completed" },
  { id: "TRX-90215", date: "2026-01-05T11:15:00", patient: "Maria Santos", items: "2x Air Optix Contacts", total: 3000, status: "completed" },
  { id: "TRX-90216", date: "2026-01-10T13:45:00", patient: "Walk-in Patient", items: "1x PureMoist Solution", total: 450, status: "completed" },
  { id: "TRX-90217", date: "2026-02-10T09:20:00", patient: "Carlos Reyes", items: "1x Ray-Ban Frame", total: 5500, status: "voided" },
  { id: "TRX-90218", date: "2026-02-20T14:10:00", patient: "Elena Gomez", items: "1x Comprehensive Eye Exam", total: 500, status: "completed" },
  { id: "TRX-90219", date: "2026-02-25T10:05:00", patient: "Mark Bautista", items: "1x Transition Gen 8", total: 4000, status: "completed" },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"analytics" | "ledger">("analytics");
  const [ledgerMonth, setLedgerMonth] = useState("2026-02");
  const [searchQuery, setSearchQuery] = useState("");
  const { showNotification } = useNotification();

  // --- FILTER TRANSACTIONS ---
  const filteredTransactions = useMemo(() => {
    return MOCK_TRANSACTIONS.filter(trx => {
      const matchesSearch = trx.id.toLowerCase().includes(searchQuery.toLowerCase()) || trx.patient.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMonth = ledgerMonth === "All" || trx.date.startsWith(ledgerMonth);
      return matchesSearch && matchesMonth;
    });
  }, [ledgerMonth, searchQuery]);

  // --- PDF GENERATION: LEDGER ONLY ---
  const exportLedgerReport = () => {
    if (filteredTransactions.length === 0) {
      showNotification("No transactions found for this period to export.", "error");
      return;
    }

    showNotification("Generating Transaction Ledger PDF...", "success");
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 20;

    // --- CENTERED HEADER TEXT ---
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0); // Black
    doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, currentY, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60); // Dark Gray
    doc.text("Sales Transaction Ledger", pageWidth / 2, currentY + 8, { align: 'center' });
    
    const displayMonth = ledgerMonth === "All" ? "All Time" : new Date(`${ledgerMonth}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100); // Medium Gray
    doc.text(`Period: ${displayMonth} | Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, currentY + 15, { align: 'center' });

    // Calculate Totals
    const validTransactions = filteredTransactions.filter(t => t.status === 'completed');
    const totalRevenue = validTransactions.reduce((sum, trx) => sum + trx.total, 0);
    const voidedCount = filteredTransactions.length - validTransactions.length;

    currentY = 50;

    // --- TABLE ---
    autoTable(doc, {
      startY: currentY,
      head: [['Receipt No', 'Date', 'Patient Name', 'Status', 'Amount (PHP)']],
      body: filteredTransactions.map(t => [
        t.id, 
        new Date(t.date).toLocaleDateString(), 
        t.patient, 
        t.status.toUpperCase(), 
        t.total.toLocaleString()
      ]),
      theme: 'grid',
      headStyles: { 
        fillColor: [220, 220, 220], // Light gray fill
        textColor: [0, 0, 0], // Black text
        fontStyle: 'bold',
        lineColor: [100, 100, 100]
      },
      bodyStyles: {
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200]
      },
      styles: { 
        fontSize: 9,
        cellPadding: 4
      },
      didParseCell: function(data) {
        // Highlight voided transactions with light gray background
        if (Array.isArray(data.row.raw) && data.row.raw[4] === 'VOIDED') {
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.textColor = [100, 100, 100];
        }
      }
    });

    // Safely get Y position after table
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || currentY;
    
    // --- TOTALS SECTION ---
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Completed Sales: ${validTransactions.length}  |  Voided: ${voidedCount}`, 14, finalY + 10);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Valid Revenue: PHP ${totalRevenue.toLocaleString()}`, 14, finalY + 20);

    // --- FOOTER ---
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    
    const totalPages = ((doc as unknown) as { internal: { pages: unknown[] } }).internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      ((doc as unknown) as { setPage: (pageNum: number) => void }).setPage(i);
      
      // Footer line
      doc.setDrawColor(180, 180, 180);
      doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
      
      // Footer text
      doc.text("Confidential - For Record Keeping Only", 14, pageHeight - 8);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 8);
    }

    doc.save(`Sales_Ledger_${displayMonth.replace(" ", "_")}.pdf`);
  };

  return (
    <div className="min-h-screen w-full font-sans sm:mt-2 p-2 sm:p-4 box-border pb-20 space-y-4 sm:space-y-6">
          
          {/* === HEADER & TABS === */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <div>
                   <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                     <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg">
                        <BrainCircuit className={THEME_TEXT} size={24} />
                     </div>
                     Reports & Analytics
                   </h1>
                   <p className="text-xs sm:text-sm text-gray-500 mt-1.5 sm:ml-1">
                     View AI demand predictions and track financial sales performance.
                   </p>
                 </div>
             </div>

             {/* TABS */}
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
                /* TAB 1: AI ANALYTICS & FORECASTING */
                <motion.div 
                   key="analytics"
                   variants={containerVariants} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }}
                   className="space-y-4 sm:space-y-6"
                >
                    {/* === KPI CARDS === */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {/* Total Revenue */}
                      <motion.div variants={itemVariants} className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
                         <div className="flex justify-between items-start mb-3 sm:mb-4">
                            <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50 text-blue-600">
                              <DollarSign size={20} className="sm:w-6 sm:h-6" />
                            </div>
                            <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${KPI_VALUES.revenue.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                              {KPI_VALUES.revenue.isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {KPI_VALUES.revenue.trend}
                            </span>
                         </div>
                         <h3 className="text-xs sm:text-sm text-gray-500 font-medium">Total Revenue</h3>
                         <div className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{KPI_VALUES.revenue.value}</div>
                      </motion.div>

                      {/* Gross Profit */}
                      <motion.div variants={itemVariants} className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
                         <div className="flex justify-between items-start mb-3 sm:mb-4">
                            <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
                              <Activity size={20} className="sm:w-6 sm:h-6" />
                            </div>
                            <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${KPI_VALUES.profit.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                              {KPI_VALUES.profit.isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {KPI_VALUES.profit.trend}
                            </span>
                         </div>
                         <h3 className="text-xs sm:text-sm text-gray-500 font-medium">Gross Profit</h3>
                         <div className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{KPI_VALUES.profit.value}</div>
                      </motion.div>

                      {/* Units Sold */}
                      <motion.div variants={itemVariants} className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
                         <div className="flex justify-between items-start mb-3 sm:mb-4">
                            <div className="p-2 sm:p-2.5 rounded-lg bg-orange-50 text-orange-600">
                              <Package size={20} className="sm:w-6 sm:h-6" />
                            </div>
                            <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${KPI_VALUES.units.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                              {KPI_VALUES.units.isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {KPI_VALUES.units.trend}
                            </span>
                         </div>
                         <h3 className="text-xs sm:text-sm text-gray-500 font-medium">Units Sold</h3>
                         <div className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{KPI_VALUES.units.value}</div>
                      </motion.div>

                      {/* Avg. Transaction */}
                      <motion.div variants={itemVariants} className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
                         <div className="flex justify-between items-start mb-3 sm:mb-4">
                            <div className="p-2 sm:p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                              <TrendingUp size={20} className="sm:w-6 sm:h-6" />
                            </div>
                            <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${KPI_VALUES.avgTransaction.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                              {KPI_VALUES.avgTransaction.isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {KPI_VALUES.avgTransaction.trend}
                            </span>
                         </div>
                         <h3 className="text-xs sm:text-sm text-gray-500 font-medium">Avg. Transaction</h3>
                         <div className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{KPI_VALUES.avgTransaction.value}</div>
                      </motion.div>
                    </div>

                    {/* === MIDDLE ROW: AI CHART & SMART RESTOCK === */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                       
                       {/* LEFT: AI DEMAND FORECAST CHART */}
                       <motion.div variants={itemVariants} className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden p-4 sm:p-6">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                             <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <div className="p-1.5 sm:p-2 bg-[#0B3C8A] rounded-lg"><TrendingUp className="text-white w-4 h-4 sm:w-5 sm:h-5" /></div>
                                  <h2 className="text-sm sm:text-lg font-bold text-gray-800">Projected Demand Forecast</h2>
                               </div>
                               <p className="text-[10px] sm:text-xs text-gray-500 ml-1">FBProphet / XGBoost ML Predictions</p>
                             </div>
                             <div className="flex gap-4 text-[10px] sm:text-xs font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-[#0B3C8A]"></div> Actual</span>
                                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-blue-300"></div> Forecast</span>
                             </div>
                          </div>
                          
                          {/* CSS Mock Chart */}
                          <div className="flex-1 flex flex-col justify-end min-h-50 relative">
                             <div className="absolute inset-0 flex flex-col justify-between z-0 pointer-events-none opacity-40">
                                <div className="w-full border-b border-dashed border-gray-300 h-10 sm:h-14"></div>
                                <div className="w-full border-b border-dashed border-gray-300 h-10 sm:h-14"></div>
                                <div className="w-full border-b border-dashed border-gray-300 h-10 sm:h-14"></div>
                                <div className="w-full border-b border-dashed border-gray-300 h-10 sm:h-14"></div>
                                <div className="w-full border-b border-dashed border-gray-300 h-10 sm:h-14"></div>
                             </div>
                             
                             <div className="relative z-10 w-full h-full flex items-end justify-between px-2 sm:px-10 gap-2 sm:gap-6">
                                {FORECAST_VALUES.map((data, idx) => {
                                  const isActual = data.isActual;
                                  const barColor = isActual ? "bg-[#0B3C8A]" : "bg-blue-300";
                                  const monthTextColor = isActual ? "text-gray-400" : "text-blue-400";
                                  const tooltipBg = isActual ? "bg-gray-800" : "bg-blue-600";

                                  // Insert TODAY divider before Oct
                                  if (idx === 4) {
                                    return (
                                      <div key={`divider-${idx}`}>
                                        <div className="h-full w-px bg-gray-200 mx-2 sm:mx-4 border-r border-dashed border-gray-400 relative">
                                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold whitespace-nowrap">TODAY</span>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                          <motion.div initial={{ height: 0 }} animate={{ height: data.height }} transition={{ duration: 1, delay: idx * 0.1 }} className={`w-6 sm:w-10 ${barColor} rounded-t-sm group-hover:opacity-80 transition-all relative`}>
                                            <span className={`absolute -top-5 sm:-top-6 left-1/2 -translate-x-1/2 ${tooltipBg} text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity`}>{data.value}</span>
                                          </motion.div>
                                          <span className={`text-[10px] sm:text-xs font-medium ${monthTextColor} mt-2`}>{data.month}</span>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                      <motion.div initial={{ height: 0 }} animate={{ height: data.height }} transition={{ duration: 1, delay: idx * 0.1 }} className={`w-6 sm:w-10 ${barColor} rounded-t-sm group-hover:opacity-80 transition-all relative`}>
                                        <span className={`absolute -top-5 sm:-top-6 left-1/2 -translate-x-1/2 ${tooltipBg} text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity`}>{data.value}</span>
                                      </motion.div>
                                      <span className={`text-[10px] sm:text-xs font-medium ${monthTextColor} mt-2`}>{data.month}</span>
                                    </div>
                                  );
                                })}
                             </div>
                          </div>

                          <div className="mt-6 bg-blue-50/50 p-3 sm:p-4 rounded-lg border border-blue-100 text-[10px] sm:text-xs text-[#0B3C8A] flex items-start sm:items-center gap-3">
                             <div className="p-1.5 bg-white rounded-md shadow-sm shrink-0"><BrainCircuit size={16} /></div>
                             <p className="leading-relaxed font-medium"><strong>AI Insight:</strong> Expect a 25% surge in Photochromic Lenses and eyewear sales approaching December. Prepare stock accordingly.</p>
                          </div>
                       </motion.div>

                       {/* RIGHT: SMART RESTOCK RECOMMENDATIONS */}
                       <motion.div variants={itemVariants} className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden p-4 sm:p-6">
                          <div className="flex items-center gap-2 mb-4">
                             <div className="p-1.5 sm:p-2 bg-emerald-50 rounded-lg"><Package className="text-emerald-600 w-4 h-4 sm:w-5 sm:h-5" /></div>
                             <div>
                                <h2 className="text-sm sm:text-lg font-bold text-gray-800">Smart Restock</h2>
                                <p className="text-[9px] sm:text-xs text-gray-500">AI order date planning</p>
                             </div>
                          </div>
                          
                          <div className="flex-1 overflow-x-auto space-y-3 sm:space-y-4">
                             {RESTOCK_VALUES.map((item, idx) => {
                               const badgeColors = [
                                 "bg-red-100 text-red-700",
                                 "bg-orange-100 text-orange-700",
                                 "bg-emerald-100 text-emerald-700"
                               ];
                               return (
                                 <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                       <h4 className="text-xs sm:text-sm font-semibold text-gray-800 truncate pr-2">{item.item}</h4>
                                       <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${badgeColors[idx]}`}>By {item.orderBy}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] sm:text-xs text-gray-500">
                                       <span>Need: <strong className="text-gray-800">{item.predictedNeed} units</strong></span>
                                       <span>Lead Time: <strong className="text-gray-800">{item.leadTime}</strong></span>
                                    </div>
                                 </div>
                               );
                             })}
                          </div>
                       </motion.div>
                    </div>

                    {/* === BOTTOM ROW: INVENTORY HEALTH === */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                       
                       {/* TOP PERFORMERS */}
                       <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                          <div className="flex items-center gap-2 mb-4">
                             <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg"><TrendingUp className="text-[#0B3C8A] w-4 h-4 sm:w-5 sm:h-5" /></div>
                             <div>
                                <h2 className="text-sm sm:text-lg font-bold text-gray-800">Top Moving Items</h2>
                                <p className="text-[9px] sm:text-xs text-gray-500">Highest volume drivers</p>
                             </div>
                          </div>
                          <div className="space-y-4 sm:space-y-5">
                             {TOP_PERFORMERS_VALUES.map((item, idx) => (
                               <div key={idx} className="flex items-center gap-3 sm:gap-4">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#0B3C8A] font-bold text-xs sm:text-sm shrink-0 border border-blue-100">#{idx + 1}</div>
                                  <div className="flex-1 min-w-0">
                                     <div className="flex justify-between items-end mb-1">
                                        <h4 className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{item.item}</h4>
                                        <span className="text-[10px] sm:text-xs font-bold text-[#0B3C8A]">{item.revenue}</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden">
                                           <motion.div initial={{ width: 0 }} animate={{ width: item.width }} transition={{ duration: 1 }} className={`h-full rounded-full ${THEME_BG}`} />
                                        </div>
                                        <span className="text-[9px] sm:text-[10px] font-medium text-gray-500 w-12 text-right shrink-0">{item.units} units</span>
                                     </div>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </motion.div>

                       {/* DEADSTOCK FINANCIAL IMPACT */}
                       <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-red-100 p-4 sm:p-6 relative overflow-hidden">
                          <div className="absolute top-0 left-0 right-0 h-1 bg-red-400"></div>
                          <div className="flex items-center gap-2 mb-4">
                             <div className="p-1.5 sm:p-2 bg-red-50 rounded-lg"><AlertTriangle className="text-red-600 w-4 h-4 sm:w-5 sm:h-5" /></div>
                             <div>
                                <h2 className="text-sm sm:text-lg font-bold text-gray-800">Deadstock Impact</h2>
                                <p className="text-[9px] sm:text-xs text-gray-500">Capital tied in non-moving inventory</p>
                             </div>
                          </div>
                          
                          <div className="mb-4 sm:mb-6 bg-red-50/50 border border-red-100 rounded-lg p-4 text-center">
                             <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">Locked Capital</span>
                             <div className="text-2xl sm:text-3xl font-black text-red-600 mt-1">{DEADSTOCK_VALUES.reduce((sum, item) => sum + parseInt(item.lockedValue.replace(/[^\d]/g, '')), 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 })}</div>
                          </div>

                          <div className="space-y-2 sm:space-y-3">
                             {DEADSTOCK_VALUES.map((item, idx) => (
                               <div key={idx} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg">
                                  <div className="min-w-0 pr-3">
                                     <h4 className="text-[11px] sm:text-sm font-semibold text-gray-800 truncate">{item.item}</h4>
                                     <span className="text-[9px] sm:text-[10px] text-gray-500 flex items-center gap-1 mt-0.5"><Clock size={10}/> {item.daysUnsold} Days Unsold</span>
                                  </div>
                                  <div className="text-[11px] sm:text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded shrink-0">{item.lockedValue}</div>
                               </div>
                             ))}
                          </div>
                       </motion.div>
                    </div>
                </motion.div>

            ) : (

                /* =========================================
                   TAB 2: TRANSACTION LEDGER
                   ========================================= */
                <motion.div 
                   key="ledger"
                   initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                   className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
                >
                   {/* Ledger Header & Filters */}
                   <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                         <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                           <FileText className={THEME_TEXT} size={20}/> Sales Ledger
                         </h2>
                         <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Exportable record of checkout transactions.</p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <div className="relative">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                           <input 
                              type="text" 
                              placeholder="Search..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className={`w-full sm:w-48 pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-1 ${THEME_RING}`}
                           />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <input 
                             type="month"
                             value={ledgerMonth === "All" ? "2026-02" : ledgerMonth}
                             onChange={(e) => setLedgerMonth(e.target.value)}
                             disabled={ledgerMonth === "All"}
                             className={`flex-1 sm:flex-none px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 ${THEME_RING} bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                          />
                          <button 
                             onClick={() => setLedgerMonth("All")}
                             className={`px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${ledgerMonth === "All" ? `${THEME_BG} text-white border-[#0B3C8A]` : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          >
                            All
                          </button>
                        </div>
                        <button 
                           onClick={exportLedgerReport}
                           className={`flex items-center justify-center gap-1.5 ${THEME_BG} ${THEME_HOVER} text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0`}
                        >
                           <Download size={14} /> Export PDF
                        </button>
                      </div>
                   </div>

                   {/* Ledger Table */}
                   <div className="w-full overflow-x-auto">
                      <table className="w-full text-left text-[11px] sm:text-sm whitespace-nowrap min-w-175">
                         <thead className="bg-gray-50/50 text-gray-500 font-semibold text-[10px] sm:text-xs border-b border-gray-100">
                            <tr>
                               <th className="p-4">Receipt No.</th>
                               <th className="p-4">Date & Time</th>
                               <th className="p-4">Patient Name</th>
                               <th className="p-4">Items / Services</th>
                               <th className="p-4 text-right">Amount (₱)</th>
                               <th className="p-4 text-center">Status</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-50">
                            {filteredTransactions.length > 0 ? (
                               filteredTransactions.map((trx, idx) => {
                                  const dateObj = new Date(trx.date);
                                  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                  const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                                  return (
                                     <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4 font-mono font-medium text-gray-500">{trx.id}</td>
                                        <td className="p-4 text-gray-600">{formattedDate} <span className="text-[10px] text-gray-400">{formattedTime}</span></td>
                                        <td className="p-4 font-semibold text-gray-800">{trx.patient}</td>
                                        <td className="p-4 text-gray-600 truncate max-w-50" title={trx.items}>{trx.items}</td>
                                        <td className={`p-4 text-right font-bold ${trx.status === 'voided' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                           {trx.total.toLocaleString()}
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
                                  <td colSpan={7} className="p-8 text-center text-gray-400">
                                     <Receipt size={32} className="mx-auto mb-2 opacity-20"/>
                                     No transactions found for this period.
                                  </td>
                               </tr>
                            )}
                         </tbody>
                      </table>
                   </div>
                </motion.div>
            )}
          </AnimatePresence>

    </div>
  );
}