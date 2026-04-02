// src/app/(app)/reports/page.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useNotification } from "@/components/NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Download, 
  Receipt,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  Filter,
  Clock,
  TrendingUp,
  AlertOctagon,
  BarChart3
} from "lucide-react";
import { useMLForecasting } from "@/hooks/useMLForecasting";

interface TransactionType {
  id: string;
  patientName: string;
  staffName?: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  date: Date;
  status: "completed" | "voided";
}

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";

// Generate available months for filtering
const getAvailableMonths = (transactions: TransactionType[]) => {
  const months = new Set<string>();
  transactions.forEach(trx => {
    const date = new Date(trx.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.add(monthKey);
  });
  return Array.from(months).sort().reverse();
};

// Generate available years for filtering
const getAvailableYears = (transactions: TransactionType[]) => {
  const years = new Set<number>();
  transactions.forEach(trx => {
    const year = new Date(trx.date).getFullYear();
    years.add(year);
  });
  return Array.from(years).sort().reverse();
};

// Generate available days for filtering
const getAvailableDays = (transactions: TransactionType[], year: number, month: string) => {
  const days = new Set<number>();
  transactions.forEach(trx => {
    const date = new Date(trx.date);
    const transactionYear = date.getFullYear();
    const transactionMonth = `${transactionYear}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if ((year === 0 || transactionYear === year) && (month === "all" || transactionMonth === month)) {
      days.add(date.getDate());
    }
  });
  return Array.from(days).sort((a, b) => a - b);
};

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "voided">("all");
  
  const { showNotification } = useNotification();
  const { 
    transactions: firebaseTransactions,
    products: firebaseProducts,
    userRole
  } = useFirebase();

  const { recommendations, forecastData, usingML } = useMLForecasting();

  const transactions = useMemo(() => {
    return firebaseTransactions as TransactionType[];
  }, [firebaseTransactions]);

  const products = useMemo(() => {
    return firebaseProducts;
  }, [firebaseProducts]);

  // Get available months based on selected year
  const availableMonths = useMemo(() => {
    const months = getAvailableMonths(transactions);
    return months.filter(month => parseInt(month.split('-')[0]) === selectedYear);
  }, [transactions, selectedYear]);

  // Get available years
  const availableYears = useMemo(() => {
    return getAvailableYears(transactions);
  }, [transactions]);

  // Get available days based on selected month and year
  const availableDays = useMemo(() => {
    return getAvailableDays(transactions, selectedYear, selectedMonth);
  }, [transactions, selectedYear, selectedMonth]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(trx => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" || 
        trx.id.toLowerCase().includes(searchLower) ||
        trx.patientName.toLowerCase().includes(searchLower) ||
        trx.items.some(item => item.name.toLowerCase().includes(searchLower));
      
      const transactionDate = new Date(trx.date);
      const transactionYear = transactionDate.getFullYear();
      const transactionMonth = `${transactionYear}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
      const transactionDay = transactionDate.getDate();
      
      const matchesYear = selectedYear === 0 || transactionYear === selectedYear;
      const matchesMonth = selectedMonth === "all" || transactionMonth === selectedMonth;
      const matchesDay = selectedDay === "all" || transactionDay === parseInt(selectedDay);
      const matchesStatus = statusFilter === "all" || trx.status === statusFilter;
      
      return matchesSearch && matchesYear && matchesMonth && matchesDay && matchesStatus;
    });
  }, [transactions, searchQuery, selectedYear, selectedMonth, selectedDay, statusFilter]);

  const exportLedgerReport = () => {
    if (filteredTransactions.length === 0) {
      showNotification("No transactions found for this period to export.", "error");
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let periodText = "";
    if (selectedYear !== 0) {
      if (selectedMonth !== "all") {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = parseInt(selectedMonth.split('-')[1]) - 1;
        periodText = `${monthNames[monthIndex]} ${selectedYear}`;
      } else {
        periodText = `Year ${selectedYear}`;
      }
    } else {
      periodText = "All Time";
    }

    const validTransactions = filteredTransactions.filter(t => t.status === 'completed');
    const voidedTransactions = filteredTransactions.filter(t => t.status === 'voided');
    const totalRevenue = validTransactions.reduce((sum, trx) => sum + trx.total, 0);
    const totalSales = filteredTransactions.reduce((sum, trx) => sum + trx.total, 0);
    const voidedAmount = voidedTransactions.reduce((sum, trx) => sum + trx.total, 0);

    // Generate table with footer callback
    autoTable(doc, {
      startY: 40,
      margin: { top: 40, right: 14, left: 14, bottom: 20 },
      head: [['Receipt No', 'Date', 'Staff', 'Patient Name', 'Items', 'Status', 'Amount (PHP)']],
      body: filteredTransactions.map(t => {
        const itemsStr = t.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
        return [
          t.id.slice(-8).toUpperCase(), 
          new Date(t.date).toLocaleDateString(), 
          t.staffName || 'N/A',
          t.patientName, 
          itemsStr,
          t.status.toUpperCase(),
          t.total.toLocaleString()
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      didDrawPage: (data) => {
        // Add header to every page
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text("Sales Transaction Ledger", pageWidth / 2, 23, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text(`Period: ${periodText} | Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' });
        
        // Add horizontal line under header
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 32, pageWidth - 14, 32);
        
        // Footer (temporary - will be updated in second pass)
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        
        const footerText = "Confidential - For Record Keeping Only";
        const lineY = pageHeight - 15;
        doc.setDrawColor(200, 200, 200);
        doc.line(14, lineY, pageWidth - 14, lineY);
        doc.text(footerText, 14, lineY + 5);
        // Page number will be filled in after
        doc.text("", pageWidth - 14, lineY + 5, { align: 'right' });
      }
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 40;
    
    // Get initial page count (before adding summary page if needed)
    const initialPages = doc.getNumberOfPages();
    
    // Calculate safe area (top of footer area starts around pageHeight - 30)
    const footerAreaStart = pageHeight - 30;
    let summaryStartY = Math.max(finalY + 10, 40); // Ensure minimum spacing from table
    
    // If summary would overlap with footer, add a new page
    if (summaryStartY + 60 > footerAreaStart) {
      doc.addPage();
      summaryStartY = 40;
    }
    
    // Summary section
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Transactions: ${filteredTransactions.length}`, 14, summaryStartY);
    doc.text(`Completed: ${validTransactions.length}`, 14, summaryStartY + 7);
    doc.text(`Voided: ${voidedTransactions.length}`, 14, summaryStartY + 14);
    
    // Sales breakdown
    doc.setDrawColor(200, 200, 200);
    doc.line(14, summaryStartY + 20, pageWidth - 14, summaryStartY + 20);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Sales: PHP ${totalSales.toLocaleString()}`, 14, summaryStartY + 27);
    
    if (validTransactions.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20); // Black
      doc.text(`Completed Revenue: PHP ${totalRevenue.toLocaleString()}`, 14, summaryStartY + 34);
    }
    
    if (voidedTransactions.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80); // Dark Gray
      doc.text(`Voided Amount: PHP ${voidedAmount.toLocaleString()}`, 14, summaryStartY + 41);
    }

    // Update page numbers on all pages with correct total
    const totalPages = doc.getNumberOfPages();
    const lineY = pageHeight - 15;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Add header/footer only to new pages (beyond initial count)
      if (i > initialPages) {
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        doc.text("Sales Transaction Ledger", pageWidth / 2, 23, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Period: ${periodText} | Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' });
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 32, pageWidth - 14, 32);
      }
      
      // Add footer to all pages
      doc.setDrawColor(200, 200, 200);
      doc.line(14, lineY, pageWidth - 14, lineY);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const footerText = "Confidential - For Record Keeping Only";
      doc.text(footerText, 14, lineY + 5);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, lineY + 5, { align: 'right' });
    }

    const fileName = periodText.replace(/ /g, '_');
    doc.save(`Sales_Ledger_${fileName}.pdf`);
  };

  const exportInventoryOptimizationReport = () => {
    if (products.length === 0) {
      showNotification("No products found to generate optimization report.", "error");
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const today = new Date();

    // 1. Stock Accuracy Logic (Comparing registered stock vs actual movements)
    // For this prototype, we'll measure 'accuracy' as the ratio of items with recent movements vs static items
    const movingItems = products.filter(p => transactions.some(t => t.items.some(i => i.name === p.name)));
    const stockAccuracyRate = products.length > 0 ? (movingItems.length / products.length) * 100 : 100;

    // 2. Predicted Needs (Using ML recommendations)
    const priorityNeeds = recommendations
      .filter(r => r.confidence === 'high' || r.daysUntilOut <= 7)
      .sort((a, b) => a.daysUntilOut - b.daysUntilOut);

    // 3. Liquidation List (Aging items > 30 days)
    const liquidationItems = products
      .filter(p => p.stock > 0)
      .map(p => {
        const lastSale = transactions
          .filter(t => t.status === 'completed' && t.items.some(item => item.name === p.name))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const lastSaleDate = lastSale ? new Date(lastSale.date) : new Date(0);
        const daysSinceSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        return { ...p, daysSinceSale };
      })
      .filter(p => p.daysSinceSale >= 30)
      .sort((a, b) => b.daysSinceSale - a.daysSinceSale);

    // Generate Header Function
    const addHeader = (pageNumber: number) => {
      doc.setPage(pageNumber);
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0); // Black
      doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40); // Dark Gray
      doc.text("Monthly Inventory Optimization Report", pageWidth / 2, 22, { align: 'center' });
      doc.setFontSize(9);
      doc.text(`Generated: ${today.toLocaleDateString()} | Accuracy Rating: ${stockAccuracyRate.toFixed(1)}%`, pageWidth / 2, 28, { align: 'center' });
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 30, pageWidth - 14, 30);
    };

    addHeader(1);

    // Section 1: Predicted Needs Table
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("1. Predicted Inventory Needs (Next 30 Days)", 14, 38);
    
    autoTable(doc, {
      startY: 42,
      margin: { left: 14, right: 14 },
      head: [['Product', 'Current Stock', 'Predicted Demand', 'Restock Goal', 'Priority']],
      body: priorityNeeds.map(r => [
        r.productName,
        r.currentStock,
        r.predictedDemand,
        r.recommendedOrder,
        r.confidence.toUpperCase()
      ]),
      headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255] },
      styles: { fontSize: 8, textColor: [0, 0, 0] }
    });

    const secondTableY = (doc as any).lastAutoTable.finalY + 15;
    
    // Section 2: Space Optimization (Liquidation List)
    doc.setFontSize(11);
    doc.text("2. Space Optimization: Recommended for Liquidation", 14, secondTableY);
    
    autoTable(doc, {
      startY: secondTableY + 4,
      margin: { left: 14, right: 14 },
      head: [['Aging Product', 'Category', 'Stock', 'Days Idle', 'Value (PHP)']],
      body: liquidationItems.map(p => [
        p.name,
        p.category,
        p.stock,
        p.daysSinceSale >= 365 ? ">1 Year" : `${p.daysSinceSale} days`,
        (p.stock * p.markupPrice).toLocaleString()
      ]),
      headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255] }, // Gray
      styles: { fontSize: 8, textColor: [0, 0, 0] }
    });

    // Executive Summary at the bottom
    const summaryY = (doc as any).lastAutoTable.finalY + 15;
    if (summaryY < pageHeight - 40) {
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text("Executive Summary:", 14, summaryY);
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(`• Identified ${priorityNeeds.length} items requiring urgent restock to prevent stockouts.`, 14, summaryY + 7);
      doc.text(`• Identified ${liquidationItems.length} stagnant items consuming warehouse space.`, 14, summaryY + 12);
      doc.text(`• Potential capital recovery from liquidation: PHP ${liquidationItems.reduce((s, i) => s + (i.stock * i.markupPrice), 0).toLocaleString()}`, 14, summaryY + 17);
    }

    // Add Footer to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        addHeader(i);
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
        doc.setFontSize(8);
        doc.text(`OptiSync AI Optimization Engine - Confidential Audit Report - Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save(`Inventory_Optimization_${today.toISOString().split('T')[0]}.pdf`);
  };

  const exportAgingReport = () => {
    if (products.length === 0) {
      showNotification("No products found to generate aging report.", "error");
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const today = new Date();

    // Identify deadstock: not sold in 30+ days
    const agingData = products
      .filter(p => p.stock > 0)
      .map(p => {
        const lastSale = transactions
          .filter(t => t.status === 'completed' && t.items.some(item => item.name === p.name))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        const lastSaleDate = lastSale ? new Date(lastSale.date) : new Date(0);
        const daysSinceSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        const deadCapital = p.stock * p.markupPrice;

        return {
          name: p.name,
          category: p.category,
          stock: p.stock,
          unitPrice: p.markupPrice,
          daysSinceSale,
          deadCapital
        };
      })
      .filter(item => item.daysSinceSale >= 30)
      .sort((a, b) => b.deadCapital - a.deadCapital);

    if (agingData.length === 0) {
      showNotification("No aging inventory (30+ days unsold) identified.", "success");
      return;
    }

    const totalDeadCapital = agingData.reduce((sum, item) => sum + item.deadCapital, 0);

    autoTable(doc, {
      startY: 40,
      margin: { top: 40, right: 14, left: 14, bottom: 20 },
      head: [['Product Name', 'Category', 'Stock', 'Days Idle', 'Value (PHP)']],
      body: agingData.map(item => [
        item.name,
        item.category,
        item.stock,
        item.daysSinceSale >= 365 ? ">1 Year" : `${item.daysSinceSale} Days`,
        item.deadCapital.toLocaleString()
      ]),
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      didDrawPage: (data) => {
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40); // Dark Gray
        doc.text("Aging Inventory & Dead Capital Report", pageWidth / 2, 23, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60); // Gray
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' });
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 32, pageWidth - 14, 32);
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 40;
    let summaryStartY = finalY + 15;
    
    if (summaryStartY + 40 > pageHeight - 20) {
      doc.addPage();
      summaryStartY = 40;
    }

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0); // Black
    doc.text("Executive Summary", 14, summaryStartY);
    
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40); // Dark Gray
    doc.text(`Total Aging Items: ${agingData.length}`, 14, summaryStartY + 8);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0); // Black
    doc.text(`Total Dead Capital: PHP ${totalDeadCapital.toLocaleString()}`, 14, summaryStartY + 18);
    
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60); // Gray
    doc.text("* Dead capital represents the locked value of inventory that has not moved in 30+ days.", 14, summaryStartY + 28);

    // Add footer to all pages with page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const lineY = pageHeight - 15;
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, lineY, pageWidth - 14, lineY);
        
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const footerText = "Aging & Dead Capital Analysis - M.T. Olaso Optical Clinic";
        doc.text(footerText, 14, lineY + 5);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, lineY + 5, { align: 'right' });
    }

    doc.save(`Aging_Report_${today.toISOString().split('T')[0]}.pdf`);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedMonth("all");
    setSelectedYear(new Date().getFullYear());
    setSelectedDay("all");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || selectedMonth !== 'all' || selectedYear !== new Date().getFullYear() || selectedDay !== 'all';

  return (
    <div className="min-h-screen w-full font-sans sm:mt-2 p-2 sm:p-4 box-border pb-20 space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg">
                  <Receipt className={THEME_TEXT} size={24} />
                </div>
                Transaction Ledger
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                View and export all sales transactions
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {userRole === 'admin' && (
                <button 
                  onClick={exportInventoryOptimizationReport}
                  className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0"
                >
                  <TrendingUp size={14} /> Optimization Report
                </button>
              )}
              <button 
                onClick={exportAgingReport}
                className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0"
              >
                <Clock size={14} /> Aging Report
              </button>
              <button 
                onClick={exportLedgerReport}
                className={`flex items-center justify-center gap-1.5 ${THEME_BG} ${THEME_HOVER} text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0`}
              >
                <Download size={14} /> Export Report
              </button>
            </div>
          </div>
        </div>

        {/* Filters - All in one line on desktop */}
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/30">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="text" 
                placeholder="Search by receipt, patient, or item..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400"
              />
            </div>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "completed" | "voided")}
              className="px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700 w-full lg:w-32"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </select>

            {/* Year */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(parseInt(e.target.value));
                setSelectedMonth("all");
              }}
              className="px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700 w-full lg:w-32"
            >
              <option value={0}>All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            {/* Month */}
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDay("all");
              }}
              disabled={selectedYear === 0}
              className="px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700 disabled:bg-gray-100 disabled:cursor-not-allowed w-full lg:w-36"
            >
              <option value="all">All Months</option>
              {availableMonths.map(month => {
                const [year, monthNum] = month.split('-');
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return (
                  <option key={month} value={month}>
                    {monthNames[parseInt(monthNum) - 1]} {year}
                  </option>
                );
              })}
            </select>

            {/* Day */}
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              disabled={selectedYear === 0 || selectedMonth === "all"}
              className="px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700 disabled:bg-gray-100 disabled:cursor-not-allowed w-full lg:w-28"
            >
              <option value="all">All Days</option>
              {availableDays.map(day => (
                <option key={day} value={day}>
                  Day {day}
                </option>
              ))}
            </select>

            {/* Clear Button */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-xs sm:text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-1 w-full lg:w-auto lg:px-4"
              >
                <Filter size={14} /> Clear
              </button>
            )}
          </div>

          {/* Results count */}
          <div className="text-xs text-gray-500 mt-3">
            Showing {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-[11px] sm:text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 font-semibold text-[10px] sm:text-xs border-b border-gray-200">
              <tr>
                <th className="p-4">Receipt No.</th>
                <th className="p-4">Staff / Time</th>
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
                      <td className="p-4">
                        <div className="text-gray-900 font-medium">{trx.staffName || 'System'}</div>
                        <div className="text-gray-500 text-[10px]">{formattedDate} {formattedTime}</div>
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
                    {hasActiveFilters && (
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

        {/* Summary Footer */}
        {filteredTransactions.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total:</span>
                  <span className="ml-2 font-bold text-gray-800">{filteredTransactions.length}</span>
                </div>
                <div>
                  <span className="text-gray-500">Completed:</span>
                  <span className="ml-2 font-bold text-emerald-600">
                    {filteredTransactions.filter(t => t.status === 'completed').length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Voided:</span>
                  <span className="ml-2 font-bold text-red-600">
                    {filteredTransactions.filter(t => t.status === 'voided').length}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-gray-500">Total Revenue:</span>
                <span className="ml-2 font-bold text-[#0B3C8A] text-lg">
                  ₱{filteredTransactions
                    .filter(t => t.status === 'completed')
                    .reduce((sum, t) => sum + t.total, 0)
                    .toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}