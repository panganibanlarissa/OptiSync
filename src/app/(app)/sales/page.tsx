"use client";

import { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, AnimatePresence, Variants } from "framer-motion"; 
// 1. Import the hook
import { useNotification } from "@/components/NotificationProvider"; 
import { 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight, 
  Download, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  X, 
  Save, 
  Trash2, 
  Edit, 
  AlertCircle, 
  Calendar, 
  Eye, 
  AlertTriangle 
} from "lucide-react";

// --- THEME CONSTANTS ---
const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";
const THEME_RING = "focus:ring-[#0B3C8A]";

// --- MOCK DATA SOURCES ---

const PRODUCT_CATALOG = [
  { id: 1, name: "Ray-Ban Aviator (Frame)", price: 5500 },
  { id: 2, name: "Oakley Holbrook (Frame)", price: 6200 },
  { id: 3, name: "Generic Titanium Frame", price: 2500 },
  { id: 4, name: "Multi-coated Lens (Service)", price: 1500 },
  { id: 5, name: "Photochromic Lens (Service)", price: 2500 },
  { id: 6, name: "Eye Exam (Service)", price: 800 },
  { id: 7, name: "Contact Lens Solution 350ml", price: 450 },
  { id: 8, name: "Air Optix Colors (Contact Lens)", price: 1800 },
];

const SHORT_TERM_FORECAST = [
  { month: "Jan '26", actual: 52000, forecast: 48000, label: "Last Month" },
  { month: "Feb '26", actual: 49000, forecast: 51000, label: "Present" },
  { month: "Mar '26", actual: null, forecast: 58000, label: "Next Month" },
];

const YEARLY_FORECAST = [
  { month: "Jan", revenue: 52000 },
  { month: "Feb", revenue: 49000 },
  { month: "Mar", revenue: 58000 },
  { month: "Apr", revenue: 61000 },
  { month: "May", revenue: 63500 },
  { month: "Jun", revenue: 59000 },
  { month: "Jul", revenue: 65000 },
  { month: "Aug", revenue: 68000 },
  { month: "Sep", revenue: 70000 },
  { month: "Oct", revenue: 72000 },
  { month: "Nov", revenue: 75000 },
  { month: "Dec", revenue: 82000 },
];

const INITIAL_TRANSACTIONS = [
  { 
    id: "TRX-1024", date: "2026-02-15", customer: "Maria Santos", 
    items: "Ray-Ban Aviator (Frame)", amount: 5500, status: "Paid", method: "Cash",
    note: "Customer requested gold frame specifically." 
  },
  { 
    id: "TRX-1023", date: "2026-02-15", customer: "John Cruz", 
    items: "Contact Lens Solution 350ml", amount: 450, status: "Paid", method: "GCash",
    note: "" 
  },
  { 
    id: "TRX-1022", date: "2026-02-14", customer: "Elena Reyes", 
    items: "Eye Exam (Service)", amount: 800, status: "Paid", method: "Cash",
    note: "Follow up check-up in 6 months." 
  },
  { 
    id: "TRX-1021", date: "2026-02-14", customer: "Miguel Olaso", 
    items: "Generic Titanium Frame", amount: 2500, status: "Paid", method: "Cash",
    note: "" 
  },
  { 
    id: "TRX-1020", date: "2026-02-13", customer: "Sarah Lim", 
    items: "Air Optix Colors (Contact Lens)", amount: 1800, status: "Paid", method: "Cash",
    note: "Prescription: -2.00 / -2.25" 
  },
  { 
    id: "TRX-1019", date: "2026-01-28", customer: "Roberto Dy", 
    items: "Multi-coated Lens (Service)", amount: 1500, status: "Paid", method: "GCash",
    note: "" 
  },
  { 
    id: "TRX-1018", date: "2026-01-15", customer: "Anna Lopez", 
    items: "Generic Titanium Frame", amount: 2500, status: "Paid", method: "Cash",
    note: "" 
  },
  { 
    id: "TRX-1017", date: "2025-12-20", customer: "Chris Tiu", 
    items: "Oakley Holbrook (Frame)", amount: 6200, status: "Paid", method: "Cash",
    note: "" 
  },
  { 
    id: "TRX-1016", date: "2025-12-10", customer: "Bea Alonzo", 
    items: "Contact Lens Solution 350ml", amount: 450, status: "Paid", method: "GCash",
    note: "" 
  },
  { 
    id: "TRX-1015", date: "2025-12-05", customer: "Dingdong Dantes", 
    items: "Eye Exam (Service)", amount: 800, status: "Paid", method: "Cash",
    note: "Family package discount applied." 
  },
];

// --- ANIMATION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: "spring", stiffness: 100 }
  }
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

export default function SalesPage() {
  // --- STATE ---
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("All"); 
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [forecastView, setForecastView] = useState<"3month" | "yearly">("3month");
  
  // Modal & Selection States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // 2. Initialize the Notification Hook
  const { showNotification } = useNotification(); 

  // --- STATS LOGIC ---
  const currentMonthStats = useMemo(() => {
    const presentMonthPrefix = "2026-02";
    const currentTransactions = transactions.filter(t => t.date.startsWith(presentMonthPrefix));

    const totalRevenue = currentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const operationalCost = totalRevenue * 0.35; 
    const netProfit = totalRevenue - operationalCost;
    const forecast = totalRevenue * 1.15;

    return { totalRevenue, operationalCost, netProfit, forecast };
  }, [transactions]);

  const formatCurrency = (val: number) => 
    "₱" + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // --- FILTER LOGIC ---
  const tableTransactions = useMemo(() => {
    return transactions.filter(trx => {
      const matchesSearch = 
        trx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trx.customer.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesMonth = monthFilter === "All" || trx.date.startsWith(monthFilter);

      return matchesSearch && matchesMonth;
    });
  }, [searchQuery, monthFilter, transactions]);

  const displayedTransactions = showAllHistory 
    ? tableTransactions 
    : tableTransactions.slice(0, 5);

  // --- HANDLERS ---
  const handleAddNew = (newData: any) => {
    const newId = `TRX-${Math.floor(Math.random() * 9000) + 1000}`;
    const newTrx = { 
      id: newId, 
      date: "2026-02-15", 
      status: "Paid", 
      ...newData 
    };
    setTransactions([newTrx, ...transactions]);
    setIsAddModalOpen(false);
    
    // 3. Trigger Success Notification
    showNotification("Transaction added successfully!", "success");
  };

  const handleEditClick = (trx: any) => { 
    setSelectedTransaction(trx); 
    setIsEditModalOpen(true); 
  };

  const handleDeleteTrigger = () => { 
    setIsEditModalOpen(false); 
    setIsDeleteConfirmOpen(true); 
  };
  
  const confirmDelete = () => {
    if (selectedTransaction) {
      setTransactions(prev => prev.filter(t => t.id !== selectedTransaction.id));
      setIsDeleteConfirmOpen(false);
      setSelectedTransaction(null);
      // 3. Trigger Error/Delete Notification
      showNotification("Transaction deleted.", "error");
    }
  };

  const handleSaveChanges = (updatedData: any) => {
    setTransactions(prev => prev.map(t => 
      t.id === selectedTransaction.id ? { ...t, ...updatedData } : t
    ));
    setIsEditModalOpen(false);
    setSelectedTransaction(null);
    // 3. Trigger Update Notification
    showNotification("Changes saved successfully!", "success");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("M.T. OLASO OPTICAL CLINIC", 14, 20);
    doc.setFontSize(12);
    doc.text("Sales & Revenue Report", 14, 28);
    
    const filterName = monthFilter === 'All' 
        ? 'All History'
        : new Date(monthFilter + "-01").toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 35);
    doc.text(`Period: ${filterName}`, 14, 40);

    const totalRevenue = tableTransactions.reduce((acc, curr) => acc + curr.amount, 0);
    const totalTxn = tableTransactions.length;
    
    doc.setDrawColor(0);
    doc.rect(14, 45, 180, 25); 
    doc.setFontSize(10);
    doc.text("Total Revenue", 20, 55);
    doc.setFontSize(14);
    doc.text(`PHP ${totalRevenue.toLocaleString()}`, 20, 63);
    
    doc.setFontSize(10);
    doc.text("Transactions", 100, 55);
    doc.setFontSize(14);
    doc.text(`${totalTxn}`, 100, 63);

    const tableColumn = ["ID", "Date", "Customer", "Items", "Amount", "Method", "Notes"];
    const tableRows = tableTransactions.map(trx => [
      trx.id, 
      trx.date, 
      trx.customer, 
      trx.items, 
      `P${trx.amount.toLocaleString()}`, 
      trx.method,
      trx.note || "" 
    ]);

    autoTable(doc, {
      startY: 80,
      head: [tableColumn],
      body: tableRows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
      columnStyles: { 6: { cellWidth: 40 } }
    });

    doc.save(`Sales_Report_${monthFilter}.pdf`);
    
    // 3. Trigger Export Notification
    showNotification("PDF Report Downloaded.", "success");
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen mt-4 p-2 lg:p-6 font-sans text-slate-800"
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* 1. HEADER */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
              <TrendingUp className={THEME_TEXT} /> Sales & Revenue
            </h1>
            <p className="text-sm text-slate-500">
              Track financial performance and transaction history.
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExportPDF} 
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              <Download size={16} /> Export PDF
            </button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsAddModalOpen(true)} 
              className={`flex items-center gap-2 ${THEME_BG} text-white px-4 py-2 rounded-lg text-sm font-medium ${THEME_HOVER} transition-colors shadow-sm`}
            >
              <Plus size={16} /> New Sale
            </motion.button>
          </div>
        </motion.div>

        {/* 2. STATS CARDS */}
        <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            title="Revenue (Present Month)" 
            value={formatCurrency(currentMonthStats.totalRevenue)} 
            trend="+12.5%" 
            isPositive={true} 
            icon={<DollarSign size={20} className="text-white" />} 
            color="bg-emerald-500"
          />
          <StatsCard 
            title="Net Profit (Present Month)" 
            value={formatCurrency(currentMonthStats.netProfit)} 
            trend="+8.2%" 
            isPositive={true} 
            icon={<TrendingUp size={20} className="text-white" />} 
            color={THEME_BG} 
          />
          <StatsCard 
            title="Operational Cost" 
            value={formatCurrency(currentMonthStats.operationalCost)} 
            trend="+2.1%" 
            isPositive={false} 
            icon={<CreditCard size={20} className="text-white" />} 
            color="bg-orange-500"
          />
           <StatsCard 
            title="Forecast (Next Month)" 
            value={formatCurrency(currentMonthStats.forecast)} 
            trend="Very High Demand" 
            isPositive={true} 
            icon={<Eye size={20} className="text-white" />} 
            color="bg-purple-500"
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 3. CHART: REVENUE FORECAST */}
          <motion.div variants={itemVariants} className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Revenue Forecast</h3>
                <p className="text-xs text-slate-500">
                    {forecastView === '3month' 
                      ? "Past, Present & Future Comparison" 
                      : "Full Year Trend (2026)"}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                  {/* LEGEND */}
                  <div className="flex gap-3 text-xs bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-sm ${THEME_BG}`}></div>
                        <span className="text-slate-600 font-medium">Actual</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-purple-100 border border-purple-300"></div>
                        <span className="text-slate-600 font-medium">Predicted</span>
                    </div>
                  </div>

                  {/* VIEW TOGGLE */}
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setForecastView('3month')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        forecastView === '3month' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        3-Month
                    </button>
                    <button 
                        onClick={() => setForecastView('yearly')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        forecastView === 'yearly' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Yearly
                    </button>
                  </div>
              </div>
            </div>
            
            {/* 3-MONTH VIEW */}
            {forecastView === '3month' && (
                <div className="h-64 w-full flex items-end justify-around gap-4 px-2 border-b border-slate-100 pb-2">
                {SHORT_TERM_FORECAST.map((data, i) => {
                    const maxVal = 70000;
                    const actualHeight = data.actual ? (data.actual / maxVal) * 100 : 0;
                    const forecastHeight = (data.forecast / maxVal) * 100;
                    return (
                    <div key={i} className="flex flex-col items-center justify-end h-full w-24 sm:w-32 gap-3 group relative cursor-help">
                        <div className="relative w-full max-w-[60px] h-full flex items-end justify-center">
                        {/* Forecast Bar */}
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${forecastHeight}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className="w-full bg-purple-50 border border-dashed border-purple-300 rounded-t-sm absolute bottom-0" 
                        ></motion.div>
                        
                        {/* Actual Bar */}
                        {data.actual !== null && (
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${actualHeight}%` }}
                              transition={{ duration: 0.8, delay: i * 0.1 + 0.2 }}
                              className={`w-full ${THEME_BG} rounded-t-sm z-10 hover:opacity-90 shadow-md`} 
                            ></motion.div>
                        )}
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl whitespace-nowrap z-50 pointer-events-none transition-opacity">
                            <div className="font-bold border-b border-slate-600 pb-1 mb-1">{data.month}</div>
                            <div>Actual: {data.actual ? `₱${data.actual.toLocaleString()}` : 'Pending'}</div>
                            <div className="text-purple-300">Forecast: ₱{data.forecast.toLocaleString()}</div>
                        </div>
                        </div>
                        <div className="text-center">
                            <span className="block text-sm font-bold text-slate-700">{data.month}</span>
                            <span className="block text-[10px] text-slate-400 uppercase tracking-wider">{data.label}</span>
                        </div>
                    </div>
                    );
                })}
                </div>
            )}

            {/* YEARLY VIEW */}
            {forecastView === 'yearly' && (
                <div className="h-64 w-full flex items-end justify-between gap-1 sm:gap-2 px-2 border-b border-slate-100 pb-2">
                    {YEARLY_FORECAST.map((data, i) => {
                        const maxVal = 90000;
                        const height = (data.revenue / maxVal) * 100;
                        const isPastOrPresent = i <= 1; // Jan, Feb
                        return (
                            <div key={i} className="flex flex-col items-center justify-end h-full flex-1 gap-1 group relative cursor-help">
                                <motion.div 
                                    initial={{ height: 0 }}
                                    animate={{ height: `${height}%` }}
                                    transition={{ duration: 0.5, delay: i * 0.05 }}
                                    className={`w-full max-w-[24px] rounded-t-sm ${
                                      isPastOrPresent ? THEME_BG : "bg-purple-200"
                                    }`} 
                                ></motion.div>
                                <span className="text-[10px] font-medium text-slate-500">{data.month}</span>
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl whitespace-nowrap z-50 pointer-events-none">
                                    <div className="font-bold">{data.month} 2026</div>
                                    <div>₱{data.revenue.toLocaleString()}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
          </motion.div>

          {/* 4. SIDEBAR */}
          <motion.div variants={itemVariants} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
             <h3 className="font-bold text-slate-800 text-lg mb-4">Categories Overview</h3>
             <div className="space-y-5 flex-1">
                <CategoryProgress label="Prescription Frames" value={45} amount="₱58,200" color={THEME_BG} />
                <CategoryProgress label="Multicoated Lenses" value={30} amount="₱32,150" color="bg-cyan-600" />
                <CategoryProgress label="Contact Lenses" value={15} amount="₱18,400" color="bg-teal-600" />
             </div>
             <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-100 flex gap-3">
                <AlertCircle className="text-purple-600 shrink-0" size={18} />
                <div>
                   <h4 className="text-sm font-bold text-purple-900 mb-1">Smart Forecast</h4>
                   <p className="text-xs text-purple-800 leading-snug">
                     Demand for <strong>Photochromic Lenses</strong> is trending up in 2026.
                   </p>
                </div>
             </div>
          </motion.div>
        </div>

        {/* 5. TABLE */}
        <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
           <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="font-bold text-slate-800 text-lg">Transaction History</h3>
              <div className="flex gap-2 w-full sm:w-auto">
                 {/* Search */}
                 <div className="relative flex-1 sm:flex-none sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search ID or Name..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 ${THEME_RING} w-full`}
                    />
                 </div>
                 {/* Filter */}
                 <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <select 
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      className="appearance-none pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none cursor-pointer hover:bg-slate-50 font-medium"
                    >
                      <option value="All">All History</option>
                      <option value="2026-02">February 2026 (Present)</option>
                      <option value="2026-01">January 2026</option>
                      <option value="2025-12">December 2025</option>
                    </select>
                    <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                 </div>
              </div>
           </div>
           
           <div className="overflow-x-auto pb-4">
             <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
                   <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Items</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Payment</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Edit</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {displayedTransactions.length > 0 ? (
                     displayedTransactions.map((trx, index) => (
                        <motion.tr 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          key={trx.id} 
                          onClick={() => handleEditClick(trx)} 
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                           <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500">{trx.id}</td>
                           <td className="px-6 py-4">{trx.date}</td>
                           <td className="px-6 py-4 font-medium text-slate-900">{trx.customer}</td>
                           <td className="px-6 py-4 max-w-xs truncate" title={trx.items}>{trx.items}</td>
                           <td className="px-6 py-4 font-bold text-slate-800">₱{trx.amount.toLocaleString()}</td>
                           <td className="px-6 py-4 text-slate-500 text-xs uppercase">{trx.method}</td>
                           <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                <CheckCircle2 size={12}/> Paid
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleEditClick(trx); 
                                }} 
                                className={`p-2 rounded-lg text-slate-400 hover:${THEME_TEXT} hover:bg-slate-100 transition-colors`}
                              >
                                 <Edit size={18} />
                              </button>
                           </td>
                        </motion.tr>
                     ))
                   ) : (
                     <tr>
                       <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                         No transactions found for the selected period.
                       </td>
                     </tr>
                   )}
                </tbody>
             </table>
           </div>
           
           {tableTransactions.length > 5 && (
             <div className="p-4 border-t border-slate-100 text-center bg-slate-50/50">
                <button 
                  onClick={() => setShowAllHistory(!showAllHistory)} 
                  className={`text-sm font-medium ${THEME_TEXT} hover:underline transition-all`}
                >
                  {showAllHistory ? "Show Less" : `View All History (${tableTransactions.length})`}
                </button>
             </div>
           )}
        </motion.div>
      </div>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {isAddModalOpen && (
            <AddSaleModal onClose={() => setIsAddModalOpen(false)} onSave={handleAddNew} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isEditModalOpen && selectedTransaction && (
            <EditSaleModal 
            transaction={selectedTransaction} 
            onClose={() => setIsEditModalOpen(false)} 
            onSave={handleSaveChanges} 
            onDelete={handleDeleteTrigger} 
            />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isDeleteConfirmOpen && (
            <DeleteConfirmationModal 
            onClose={() => setIsDeleteConfirmOpen(false)} 
            onConfirm={confirmDelete} 
            itemName={selectedTransaction?.id} 
            />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- SUB-COMPONENTS ---

function StatsCard({ title, value, trend, isPositive, icon, color }: any) {
  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
      className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between"
    >
       <div>
          <p className="text-xs font-medium text-slate-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">{value}</h3>
          <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
             {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} <span>{trend}</span>
          </div>
       </div>
       <div className={`p-3 rounded-lg shadow-lg shadow-slate-200/50 ${color}`}>{icon}</div>
    </motion.div>
  );
}

function CategoryProgress({ label, value, amount, color }: any) {
   return (
      <div>
         <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-slate-700">{label}</span>
            <span className="font-bold text-slate-900">{amount}</span>
         </div>
         <div className="w-full bg-slate-100 rounded-full h-2">
            <motion.div 
                initial={{ width: 0 }}
                whileInView={{ width: `${value}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-2 rounded-full ${color}`} 
            ></motion.div>
         </div>
      </div>
   );
}

function AddSaleModal({ onClose, onSave }: { onClose: () => void, onSave: (data:any) => void }) {
  const [customer, setCustomer] = useState("");
  const [itemText, setItemText] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");

  const handleProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const product = PRODUCT_CATALOG.find(p => p.name === selectedName);
    setItemText(selectedName);
    if (product) setAmount(product.price.toString());
  };

  const handleSave = () => {
    if(!customer.trim() || !amount) return alert("Please enter customer name and amount.");
    onSave({ 
        customer, 
        items: itemText || "General Service", 
        amount: Number(amount), 
        method, 
        note 
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div 
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
      >
         <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50 rounded-t-xl">
            <h2 className="text-lg font-bold text-slate-800">New Transaction</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
         </div>
         <div className="p-6 space-y-4 overflow-y-auto">
            {/* Form Fields */}
            <div>
               <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Customer Info</label>
               <input 
                 type="text" 
                 placeholder="Customer Name" 
                 value={customer} 
                 onChange={e => setCustomer(e.target.value)} 
                 className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${THEME_RING} mb-2`} 
               />
               <input type="text" placeholder="Phone Number (Optional)" className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${THEME_RING}`} />
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Select Item</label>
               <div className="flex gap-2 mb-2">
                  <select value={itemText} onChange={handleProductSelect} className={`flex-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${THEME_RING}`}>
                     <option value="">-- Choose Product --</option>
                     {PRODUCT_CATALOG.map((prod) => (<option key={prod.id} value={prod.name}>{prod.name}</option>))}
                  </select>
                  <input type="number" placeholder="Qty" className={`w-20 p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${THEME_RING}`} defaultValue={1} />
               </div>
               <button className={`text-xs font-medium ${THEME_TEXT} hover:underline flex items-center gap-1`}><Plus size={12} /> Add another item</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Payment Method</label>
                 <select value={method} onChange={e => setMethod(e.target.value)} className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${THEME_RING}`}>
                   <option value="Cash">Cash</option>
                   <option value="GCash">GCash</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Amount Paid (₱)</label>
                 <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${THEME_RING} font-bold`} />
               </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Notes</label>
              <textarea 
                rows={2} 
                placeholder="Prescription notes or remarks..." 
                value={note}
                onChange={e => setNote(e.target.value)}
                className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${THEME_RING}`}
              ></textarea>
            </div>
         </div>
         <div className="p-5 border-t border-slate-100 bg-slate-50 rounded-b-xl flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-white transition-colors">Cancel</button>
            <button onClick={handleSave} className={`flex-1 px-4 py-2 ${THEME_BG} text-white rounded-lg font-medium ${THEME_HOVER} transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10`}>
              <Save size={18} /> Record Sale
            </button>
         </div>
      </motion.div>
    </div>
  );
}

function EditSaleModal({ transaction, onClose, onSave, onDelete }: { transaction: any, onClose: () => void, onSave: (data:any) => void, onDelete: () => void }) {
  const [customer, setCustomer] = useState(transaction.customer);
  const [itemText, setItemText] = useState(transaction.items);
  const [amount, setAmount] = useState(transaction.amount);
  const [method, setMethod] = useState(transaction.method);
  const [note, setNote] = useState(transaction.note || ""); 

  const handleUpdate = () => { onSave({ customer, items: itemText, amount: Number(amount), method, note }); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div 
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
      >
         <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50 rounded-t-xl">
            <div><h2 className="text-lg font-bold text-slate-800">Edit Transaction</h2><p className="text-xs text-slate-500 font-mono">{transaction.id}</p></div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
         </div>
         <div className="p-6 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Customer Info</label>
              <input type="text" value={customer} onChange={(e) => setCustomer(e.target.value)} className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${THEME_RING}`} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Items</label>
              <input type="text" value={itemText} onChange={(e) => setItemText(e.target.value)} className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${THEME_RING}`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Payment</label>
                 <select value={method} onChange={(e) => setMethod(e.target.value)} className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${THEME_RING}`}>
                   <option value="Cash">Cash</option>
                   <option value="GCash">GCash</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Amount</label>
                 <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${THEME_RING}`} />
               </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Notes</label>
              <textarea 
                rows={2} 
                placeholder="Prescription notes or remarks..." 
                value={note}
                onChange={e => setNote(e.target.value)}
                className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${THEME_RING}`}
              ></textarea>
            </div>
         </div>
         <div className="p-5 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-between items-center gap-3">
            <button onClick={onDelete} className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"><Trash2 size={16} /> Delete</button>
            <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-white transition-colors">Cancel</button>
                <button onClick={handleUpdate} className={`px-4 py-2 ${THEME_BG} text-white rounded-lg text-sm font-medium ${THEME_HOVER} transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10`}>Save Changes</button>
            </div>
         </div>
      </motion.div>
    </div>
  );
}

function DeleteConfirmationModal({ onClose, onConfirm, itemName }: { onClose: () => void, onConfirm: () => void, itemName: string }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <motion.div 
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center"
            >
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={24} /></div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Transaction?</h3>
                <p className="text-sm text-slate-500 mb-6">Are you sure you want to delete <span className="font-mono text-slate-700 font-bold">{itemName}</span>? This action cannot be undone.</p>
                <div className="flex gap-3 justify-center">
                    <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">Confirm Delete</button>
                </div>
            </motion.div>
        </div>
    );
}