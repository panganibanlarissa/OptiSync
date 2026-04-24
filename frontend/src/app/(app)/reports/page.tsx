// src/app/(app)/reports/page.tsx

"use client";

import React, { useState, useMemo } from "react";
import { useNotification } from "@/components/NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";
import { useMLForecasting } from "@/hooks/useMLForecasting";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Download, 
  Receipt,
  Search,
  CheckCircle2,
  XCircle,
  Filter,
  Clock,
  TrendingUp,
  Calendar
} from "lucide-react";

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";

interface TransactionType {
  id: string;
  patientName: string;
  staffName?: string;
  items: Array<{ id: string; name: string; quantity: number; price: number }>;
  total: number;
  date: Date;
  status: "completed" | "voided";
  paymentMethod?: "cash" | "online";
}

// Helper function to safely get date from Firestore Timestamp
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

// Helper function to format date as YYYY-MM-DD in local time (not UTC)
const getLocalDateStamp = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to check if a date is within a range
const isDateInRange = (date: Date, fromDate: Date | null, toDate: Date | null): boolean => {
  if (!fromDate && !toDate) return true;
  
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  
  if (fromDate && toDate) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(0, 0, 0, 0);
    return compareDate >= from && compareDate <= to;
  }
  
  if (fromDate) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    return compareDate >= from;
  }
  
  if (toDate) {
    const to = new Date(toDate);
    to.setHours(0, 0, 0, 0);
    return compareDate <= to;
  }
  
  return true;
};

// Calculate days since last sale using product ID matching
const getDaysSinceLastSale = (product: any, transactions: TransactionType[], today: Date): { days: number; lastSaleDate: Date | null; hasSales: boolean } => {
  const completedTransactions = transactions.filter(t => t.status === 'completed');
  
  const salesForProduct = completedTransactions
    .filter(t => t.items.some(item => item.id === product.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const lastSale = salesForProduct[0];
  
  if (lastSale) {
    const lastSaleDate = new Date(lastSale.date);
    lastSaleDate.setHours(0, 0, 0, 0);
    const days = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
    return { days, lastSaleDate, hasSales: true };
  } else {
    const createdDate = getDateFromTimestamp(product.createdAt);
    
    let days = 0;
    if (createdDate) {
      createdDate.setHours(0, 0, 0, 0);
      days = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      days = product.lastMovedDaysAgo || 0;
    }
    
    return { days, lastSaleDate: null, hasSales: false };
  }
};

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "voided">("all");
  
  // Date Range State
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  
  const { showNotification } = useNotification();
  const { 
    transactions: firebaseTransactions,
    products: firebaseProducts,
    userRole
  } = useFirebase();

  const { recommendations, usingML } = useMLForecasting();

  const transactions = useMemo(() => {
    return firebaseTransactions as TransactionType[];
  }, [firebaseTransactions]);

  const products = useMemo(() => {
    return firebaseProducts;
  }, [firebaseProducts]);

  // Helper functions for filtering
  const getAvailableMonths = (transactions: TransactionType[]) => {
    const months = new Set<string>();
    transactions.forEach(trx => {
      const date = new Date(trx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse();
  };

  const getAvailableYears = (transactions: TransactionType[]) => {
    const years = new Set<number>();
    transactions.forEach(trx => {
      const year = new Date(trx.date).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort().reverse();
  };

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

  const availableMonths = useMemo(() => {
    const months = getAvailableMonths(transactions);
    return months.filter(month => parseInt(month.split('-')[0]) === selectedYear);
  }, [transactions, selectedYear]);

  const availableYears = useMemo(() => {
    return getAvailableYears(transactions);
  }, [transactions]);

  const availableDays = useMemo(() => {
    return getAvailableDays(transactions, selectedYear, selectedMonth);
  }, [transactions, selectedYear, selectedMonth]);

  // Helper to get date range display text
  const getDateRangeText = (): string => {
    if (fromDate && toDate) {
      return `${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`;
    } else if (fromDate) {
      return `From ${new Date(fromDate).toLocaleDateString()}`;
    } else if (toDate) {
      return `Until ${new Date(toDate).toLocaleDateString()}`;
    }
    return "";
  };

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
      
      const matchesStatus = statusFilter === "all" || trx.status === statusFilter;
      
      // Date filtering: date range takes priority over month/day filters
      let matchesDate = true;
      if (fromDate || toDate) {
        // If date range is selected, ONLY use date range filter
        const fromDateObj = fromDate ? new Date(fromDate) : null;
        const toDateObj = toDate ? new Date(toDate) : null;
        matchesDate = isDateInRange(transactionDate, fromDateObj, toDateObj);
      } else {
        // If no date range, use year/month/day filters
        const matchesYear = selectedYear === 0 || transactionYear === selectedYear;
        const matchesMonth = selectedMonth === "all" || transactionMonth === selectedMonth;
        const matchesDay = selectedDay === "all" || transactionDay === parseInt(selectedDay);
        matchesDate = matchesYear && matchesMonth && matchesDay;
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [transactions, searchQuery, selectedYear, selectedMonth, selectedDay, statusFilter, fromDate, toDate]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const completed = filteredTransactions.filter(t => t.status === 'completed');
    const voided = filteredTransactions.filter(t => t.status === 'voided');
    const totalRevenue = completed.reduce((sum, t) => sum + t.total, 0);
    
    return {
      total: filteredTransactions.length,
      completed: completed.length,
      voided: voided.length,
      totalRevenue
    };
  }, [filteredTransactions]);

  // Helper to get filtered transactions for current range (used in aging reports)
  const getFilteredTransactionsForRange = (): TransactionType[] => {
    let filtered = transactions;
    
    if (selectedYear !== 0 || selectedMonth !== "all" || selectedDay !== "all" || fromDate || toDate) {
      filtered = filtered.filter(trx => {
        const transactionDate = new Date(trx.date);
        const transactionYear = transactionDate.getFullYear();
        const transactionMonth = `${transactionYear}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
        const transactionDay = transactionDate.getDate();
        
        // Date filtering: date range takes priority over month/day filters
        if (fromDate || toDate) {
          // If date range is selected, ONLY use date range filter
          const fromDateObj = fromDate ? new Date(fromDate) : null;
          const toDateObj = toDate ? new Date(toDate) : null;
          return isDateInRange(transactionDate, fromDateObj, toDateObj);
        } else {
          // If no date range, use year/month/day filters
          const matchesYear = selectedYear === 0 || transactionYear === selectedYear;
          const matchesMonth = selectedMonth === "all" || transactionMonth === selectedMonth;
          const matchesDay = selectedDay === "all" || transactionDay === parseInt(selectedDay);
          return matchesYear && matchesMonth && matchesDay;
        }
      });
    }
    
    return filtered;
  };

  // Helper to get period text for exports (without duplication)
  const getPeriodText = (): string => {
    if (fromDate && toDate) {
      return `${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`;
    } else if (fromDate) {
      return `From ${new Date(fromDate).toLocaleDateString()}`;
    } else if (toDate) {
      return `Until ${new Date(toDate).toLocaleDateString()}`;
    } else if (selectedYear !== 0) {
      if (selectedMonth !== "all") {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = parseInt(selectedMonth.split('-')[1]) - 1;
        if (selectedDay !== "all") {
          return `${monthNames[monthIndex]} ${selectedDay}, ${selectedYear}`;
        }
        return `${monthNames[monthIndex]} ${selectedYear}`;
      } else {
        return `Year ${selectedYear}`;
      }
    }
    return "All Time";
  };

  const exportLedgerReport = () => {
    if (filteredTransactions.length === 0) {
      showNotification("No transactions found for this period to export.", "error");
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const periodText = getPeriodText();

    const validTransactions = filteredTransactions.filter(t => t.status === 'completed');
    const voidedTransactions = filteredTransactions.filter(t => t.status === 'voided');
    const totalSales = validTransactions.reduce((sum, trx) => sum + trx.total, 0);
    const voidedAmount = voidedTransactions.reduce((sum, trx) => sum + trx.total, 0);

    autoTable(doc, {
      startY: 45, // Increased to avoid header overlap
      margin: { top: 45, right: 14, left: 14, bottom: 20 },
      head: [['Receipt No', 'Date', 'Staff', 'Patient Name', 'Items', 'Payment Method', 'Status', 'Amount (PHP)']],
      body: filteredTransactions.map(t => {
        const itemsStr = t.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
        return [
          t.id.slice(-8).toUpperCase(), 
          new Date(t.date).toLocaleDateString(), 
          t.staffName || 'N/A',
          t.patientName, 
          itemsStr,
          t.paymentMethod ? t.paymentMethod.toUpperCase() : 'N/A',
          t.status.toUpperCase(),
          t.total.toLocaleString()
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      didDrawPage: (data) => {
        // Header - only draw on each page
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text("Sales Transaction Report", pageWidth / 2, 23, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text(`Period: ${periodText} | Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 31, { align: 'center' });
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 35, pageWidth - 14, 35);
      }
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 45;
    const initialPages = doc.getNumberOfPages();
    const footerAreaStart = pageHeight - 30;
    let summaryStartY = Math.max(finalY + 10, 45);
    
    if (summaryStartY + 80 > footerAreaStart) {
      doc.addPage();
      summaryStartY = 45;
    }
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Summary Report", 14, summaryStartY);
    
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Transactions: ${filteredTransactions.length}`, 14, summaryStartY + 8);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Total count of all transaction records in this period (completed + voided).", 14, summaryStartY + 11);
    
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Completed: ${validTransactions.length}`, 14, summaryStartY + 18);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Number of transactions successfully processed and recorded.", 14, summaryStartY + 21);
    
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Voided: ${voidedTransactions.length}`, 14, summaryStartY + 28);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Number of transactions canceled or reversed; not included in revenue.", 14, summaryStartY + 31);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, summaryStartY + 37, pageWidth - 14, summaryStartY + 37);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Sales Revenue: PHP ${totalSales.toLocaleString()}`, 14, summaryStartY + 44);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Sum of all completed transactions in this period.", 14, summaryStartY + 47);
    
    if (voidedTransactions.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Voided Amount: PHP ${voidedAmount.toLocaleString()}`, 14, summaryStartY + 54);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Total value of canceled transactions; deducted from gross sales.", 14, summaryStartY + 57);
    }

    const totalPages = doc.getNumberOfPages();
    const lineY = pageHeight - 15;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      if (i > initialPages) {
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        doc.text("Sales Transaction Report", pageWidth / 2, 23, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Period: ${periodText} | Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 31, { align: 'center' });
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 35, pageWidth - 14, 35);
      }
      
      doc.setDrawColor(200, 200, 200);
      doc.line(14, lineY, pageWidth - 14, lineY);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const footerText = "Confidential - For Record Keeping Only";
      doc.text(footerText, 14, lineY + 5);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, lineY + 5, { align: 'right' });
    }

    let fileNameStamp = "";
    if (fromDate && toDate) {
      fileNameStamp = `${getLocalDateStamp(new Date(fromDate))}_to_${getLocalDateStamp(new Date(toDate))}`;
    } else if (fromDate) {
      fileNameStamp = `from_${getLocalDateStamp(new Date(fromDate))}`;
    } else if (toDate) {
      fileNameStamp = `until_${getLocalDateStamp(new Date(toDate))}`;
    } else if (selectedDay !== "all") {
      fileNameStamp = `${selectedMonth}-${String(selectedDay).padStart(2, '0')}`;
    } else if (selectedMonth !== "all") {
      fileNameStamp = selectedMonth;
    } else if (selectedYear !== 0) {
      fileNameStamp = String(selectedYear);
    } else {
      fileNameStamp = "All_Time";
    }
    doc.save(`Sales_Report_${fileNameStamp}.pdf`);
  };

  const exportInventoryOptimizationReport = () => {
    if (products.length === 0) {
      showNotification("No products found to generate optimization report.", "error");
      return;
    }

    const rangeFilteredTransactions = getFilteredTransactionsForRange();

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const movingItems = products.filter(p => rangeFilteredTransactions.some(t => t.items.some(i => i.id === p.id)));
    const stockAccuracyRate = products.length > 0 ? (movingItems.length / products.length) * 100 : 100;

    const priorityNeeds = recommendations
      .filter((item: any) => item.daysUntilOut <= 30)
      .sort((a: any, b: any) => a.daysUntilOut - b.daysUntilOut)
      .map((item: any) => ({
        productName: item.productName,
        currentStock: item.currentStock,
        predictedDemand: item.predictedDemand30d,
        recommendedOrder: item.recommendedOrder,
        priority: item.confidence
      }));

    const liquidationItems = products
      .filter(p => p.stock > 0)
      .map(p => {
        const { days, lastSaleDate, hasSales } = getDaysSinceLastSale(p, rangeFilteredTransactions, today);
        return { ...p, daysSinceSale: days, lastSaleDate, hasSales };
      })
      .filter(p => p.daysSinceSale >= 30)
      .sort((a, b) => b.daysSinceSale - a.daysSinceSale);

    const periodText = getPeriodText();

    const addHeader = (pageNumber: number) => {
      doc.setPage(pageNumber);
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text("Monthly Inventory Optimization Report", pageWidth / 2, 23, { align: 'center' });
      doc.setFontSize(9);
      doc.text(`Period: ${periodText} | Generated: ${today.toLocaleDateString()}`, pageWidth / 2, 31, { align: 'center' });
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 35, pageWidth - 14, 35);
    };

    addHeader(1);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("1. Predicted Inventory Needs (Next 30 Days)", 14, 43);
    
    if (priorityNeeds.length > 0) {
      autoTable(doc, {
        startY: 47,
        margin: { left: 14, right: 14 },
        head: [['Product', 'Current Stock', 'Predicted Demand', 'Restock Goal', 'Priority']],
        body: priorityNeeds.map(r => [
          r.productName,
          r.currentStock,
          r.predictedDemand,
          r.recommendedOrder,
          r.priority.toUpperCase()
        ]),
        headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255] },
        styles: { fontSize: 8, textColor: [0, 0, 0] },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            addHeader(data.pageNumber);
          }
        }
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("No items require restocking within the next 30 days.", 14, 53);
    }

    const secondTableY = priorityNeeds.length > 0 ? (doc as any).lastAutoTable.finalY + 15 : 60;
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("2. Space Optimization: Recommended for Liquidation", 14, secondTableY);
    
    if (liquidationItems.length > 0) {
      autoTable(doc, {
        startY: secondTableY + 4,
        margin: { left: 14, right: 14, top: 45, bottom: 20 },
        head: [['Aging Product', 'Category', 'Stock', 'Days Idle', 'Status', 'Value (PHP)']],
        body: liquidationItems.map(p => [
          p.name,
          p.category,
          p.stock,
          p.daysSinceSale >= 365 ? ">1 Year" : `${p.daysSinceSale} days`,
          p.hasSales ? 'Unsold' : 'Never Sold',
          (p.stock * p.markupPrice).toLocaleString()
        ]),
        headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255] },
        styles: { fontSize: 8, textColor: [0, 0, 0] },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            addHeader(data.pageNumber);
          }
        }
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("No deadstock items identified in this period.", 14, secondTableY + 10);
    }

    let summaryY = liquidationItems.length > 0 ? (doc as any).lastAutoTable.finalY + 15 : secondTableY + 25;
    
    if (summaryY + 40 > pageHeight - 20) {
      doc.addPage();
      summaryY = 43;
    }
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Executive Summary", 14, summaryY);
    
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`• Identified ${priorityNeeds.length} items requiring restock within the next 30 days to prevent stockouts.`, 14, summaryY + 7);
    doc.text(`• Identified ${liquidationItems.length} deadstock items (30+ days unsold) consuming warehouse space.`, 14, summaryY + 12);
    doc.text(`• Potential capital recovery from liquidation: PHP ${liquidationItems.reduce((s, i) => s + (i.stock * i.markupPrice), 0).toLocaleString()}`, 14, summaryY + 17);
    doc.text(`• Stock turnover rate: ${stockAccuracyRate.toFixed(1)}% of inventory has moved during the selected period.`, 14, summaryY + 22);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Recommendation: Prioritize restocking critical items while liquidating deadstock to optimize capital efficiency.", 14, summaryY + 30);

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        addHeader(i);
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
        doc.setFontSize(8);
        doc.text(`OptiSync AI Optimization Engine - Confidential Audit Report - Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    let fileNameStamp = "";
    if (fromDate && toDate) {
      fileNameStamp = `${getLocalDateStamp(new Date(fromDate))}_to_${getLocalDateStamp(new Date(toDate))}`;
    } else if (fromDate) {
      fileNameStamp = `from_${getLocalDateStamp(new Date(fromDate))}`;
    } else if (toDate) {
      fileNameStamp = `until_${getLocalDateStamp(new Date(toDate))}`;
    } else if (selectedDay !== "all") {
      fileNameStamp = `${selectedMonth}-${String(selectedDay).padStart(2, '0')}`;
    } else if (selectedMonth !== "all") {
      fileNameStamp = selectedMonth;
    } else if (selectedYear !== 0) {
      fileNameStamp = String(selectedYear);
    } else {
      fileNameStamp = getLocalDateStamp(today);
    }
    doc.save(`Inventory_Optimization_${fileNameStamp}.pdf`);
  };

  const exportAgingReport = () => {
    if (products.length === 0) {
      showNotification("No products found to generate aging report.", "error");
      return;
    }

    const rangeFilteredTransactions = getFilteredTransactionsForRange();

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allProductsData = products
      .filter(p => p.stock > 0)
      .map(p => {
        const { days, lastSaleDate, hasSales } = getDaysSinceLastSale(p, rangeFilteredTransactions, today);
        
        const deadCapital = p.stock * p.markupPrice;
        
        let daysIdleDisplay = `${days} days`;
        if (days >= 365) {
          daysIdleDisplay = `>1 Year (${days} days)`;
        } else if (days >= 90) {
          daysIdleDisplay = `${days} days (3+ months)`;
        }
        
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          stock: p.stock,
          unitPrice: p.markupPrice,
          daysSinceSale: days,
          daysIdleDisplay,
          deadCapital,
          lastSaleDate,
          hasSales
        };
      });
    
    const agingData = allProductsData
      .filter(item => {
        if (item.stock <= 0) return false;
        if (item.daysSinceSale < 30) return false;
        
        if (item.hasSales && item.lastSaleDate) {
          const calculatedDays = Math.floor((today.getTime() - item.lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
          if (calculatedDays < 30) return false;
        }
        
        return true;
      })
      .sort((a, b) => b.deadCapital - a.deadCapital);

    if (agingData.length === 0) {
      showNotification("No aging inventory (30+ days unsold) identified in this period.", "info");
      return;
    }

    const periodText = getPeriodText();
    const totalDeadCapital = agingData.reduce((sum, item) => sum + item.deadCapital, 0);
    
    const itemsOver90Days = agingData.filter(i => i.daysSinceSale >= 90).length;
    const itemsOver60Days = agingData.filter(i => i.daysSinceSale >= 60 && i.daysSinceSale < 90).length;
    const itemsOver30Days = agingData.filter(i => i.daysSinceSale >= 30 && i.daysSinceSale < 60).length;

    const addAgingHeader = (pageNumber: number) => {
      doc.setPage(pageNumber);
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text("Aging Inventory Report", pageWidth / 2, 23, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Period: ${periodText} | Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 31, { align: 'center' });
      
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 35, pageWidth - 14, 35);
    };

    addAgingHeader(1);

    autoTable(doc, {
      startY: 45,
      margin: { top: 45, right: 14, left: 14, bottom: 20 },
      head: [['Product Name', 'Category', 'Stock', 'Days Idle', 'Status', 'Value (PHP)']],
      body: agingData.map(item => [
        item.name,
        item.category,
        item.stock,
        item.daysIdleDisplay,
        item.hasSales ? 'Unsold' : 'Never Sold',
        item.deadCapital.toLocaleString()
      ]),
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          addAgingHeader(data.pageNumber);
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 45;
    let summaryStartY = finalY + 15;
    
    if (summaryStartY + 70 > pageHeight - 20) {
      doc.addPage();
      summaryStartY = 45;
    }

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Executive Summary", 14, summaryStartY);
    
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(`Total Aging Items (30+ days unsold): ${agingData.length}`, 14, summaryStartY + 8);
    
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    
    let summaryYOffset = summaryStartY + 16;
    
    if (itemsOver90Days > 0) {
      doc.text(`• ${itemsOver90Days} item(s) have been unsold for 90+ days.`, 14, summaryYOffset);
      summaryYOffset += 5;
    }
    if (itemsOver60Days > 0) {
      doc.text(`• ${itemsOver60Days} item(s) have been unsold for 60-89 days.`, 14, summaryYOffset);
      summaryYOffset += 5;
    }
    if (itemsOver30Days > 0) {
      doc.text(`• ${itemsOver30Days} item(s) have been unsold for 30-59 days.`, 14, summaryYOffset);
      summaryYOffset += 5;
    }
    
    summaryYOffset += 5;
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Dead Inventory: PHP ${totalDeadCapital.toLocaleString()}`, 14, summaryYOffset);
    summaryYOffset += 5;
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("* Dead inventory represents the locked value of inventory that has not moved in 30+ days.", 14, summaryYOffset + 3);
    
    summaryYOffset += 12;
    
    // Recommendation based on aging data
    doc.setFontSize(9);
    if (itemsOver90Days > 0) {
      doc.setTextColor(200, 0, 0);
      doc.text(`⚠️ URGENT: ${itemsOver90Days} item(s) have been unsold for 90+ days.`, 14, summaryYOffset);
      summaryYOffset += 5;
      doc.setTextColor(100, 0, 0);
      doc.text(`   Immediate liquidation recommended to recover capital.`, 14, summaryYOffset);
    } else if (itemsOver60Days > 0) {
      doc.setTextColor(200, 100, 0);
      doc.text(`⚠️ WARNING: ${itemsOver60Days} item(s) have been unsold for 60+ days.`, 14, summaryYOffset);
      summaryYOffset += 5;
      doc.setTextColor(140, 70, 0);
      doc.text(`   Consider markdown strategy or promotional pricing.`, 14, summaryYOffset);
    } else if (itemsOver30Days > 0) {
      doc.setTextColor(100, 100, 100);
      doc.text(`ℹ️ INFO: ${itemsOver30Days} item(s) have been unsold for 30+ days.`, 14, summaryYOffset);
      summaryYOffset += 5;
      doc.setTextColor(80, 80, 80);
      doc.text(`   Consider promotion or bundle deals to move inventory.`, 14, summaryYOffset);
    }

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addAgingHeader(i);
        const lineY = pageHeight - 15;
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, lineY, pageWidth - 14, lineY);
        
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const footerText = "Aging & Dead Capital Analysis - M.T. Olaso Optical Clinic";
        doc.text(footerText, 14, lineY + 5);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, lineY + 5, { align: 'right' });
    }

    let fileNameStamp = "";
    if (fromDate && toDate) {
      fileNameStamp = `${getLocalDateStamp(new Date(fromDate))}_to_${getLocalDateStamp(new Date(toDate))}`;
    } else if (fromDate) {
      fileNameStamp = `from_${getLocalDateStamp(new Date(fromDate))}`;
    } else if (toDate) {
      fileNameStamp = `until_${getLocalDateStamp(new Date(toDate))}`;
    } else if (selectedDay !== "all") {
      fileNameStamp = `${selectedMonth}-${String(selectedDay).padStart(2, '0')}`;
    } else if (selectedMonth !== "all") {
      fileNameStamp = selectedMonth;
    } else if (selectedYear !== 0) {
      fileNameStamp = String(selectedYear);
    } else {
      fileNameStamp = getLocalDateStamp(today);
    }
    doc.save(`Aging_Report_${fileNameStamp}.pdf`);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedMonth("all");
    setSelectedYear(new Date().getFullYear());
    setSelectedDay("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || selectedMonth !== 'all' || selectedYear !== new Date().getFullYear() || selectedDay !== 'all' || fromDate || toDate;

  return (
    <div className="min-h-screen w-full font-sans p-2 sm:p-4 box-border pb-20 space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header with Title and Action Buttons */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg">
                <Receipt className={THEME_TEXT} size={24} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Reports</h1>
                <p className="text-xs sm:text-sm text-gray-500">View and export all sales transactions</p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              {userRole === 'admin' && (
                <button 
                  onClick={exportInventoryOptimizationReport}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                >
                  <TrendingUp size={14} /> Optimization Report
                </button>
              )}
              <button 
                onClick={exportAgingReport}
                className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
              >
                <Clock size={14} /> Aging Report
              </button>
              <button 
                onClick={exportLedgerReport}
                className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 ${THEME_BG} ${THEME_HOVER} text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors`}
              >
                <Download size={14} /> Transactions Report
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters Row */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/30">
          <div className="flex flex-wrap gap-2">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "completed" | "voided")}
              className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </select>

            {/* Year Filter */}
            <select
              value={selectedYear}
              onChange={(e) => {
                const yearValue = parseInt(e.target.value);
                setSelectedYear(yearValue);
                setSelectedMonth("all");
                setSelectedDay("all");
                // Clear date range when year filter is selected
                if (yearValue !== 0) {
                  setFromDate("");
                  setToDate("");
                }
              }}
              className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700"
            >
              <option value={0}>All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            {/* Month Filter */}
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDay("all");
                // Clear date range when month filter is selected
                if (e.target.value !== "all") {
                  setFromDate("");
                  setToDate("");
                }
              }}
              disabled={selectedYear === 0}
              className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700 disabled:bg-gray-100 disabled:cursor-not-allowed"
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

            {/* Day Filter */}
            <select
              value={selectedDay}
              onChange={(e) => {
                setSelectedDay(e.target.value);
                // Clear date range when day filter is selected
                if (e.target.value !== "all") {
                  setFromDate("");
                  setToDate("");
                }
              }}
              disabled={selectedYear === 0 || selectedMonth === "all"}
              className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="all">All Days</option>
              {availableDays.map(day => (
                <option key={day} value={day}>Day {day}</option>
              ))}
            </select>

            {/* From Date */}
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  // Clear month/day/year filters when date range is set
                  if (e.target.value) {
                    setSelectedYear(0);
                    setSelectedMonth("all");
                    setSelectedDay("all");
                  }
                }}
                className="pl-7 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700"
                placeholder="From"
              />
            </div>

            {/* To Date */}
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  // Clear month/day/year filters when date range is set
                  if (e.target.value) {
                    setSelectedYear(0);
                    setSelectedMonth("all");
                    setSelectedDay("all");
                  }
                }}
                className="pl-7 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700"
                placeholder="To"
              />
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
              >
                <Filter size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="p-4 border-b border-gray-100 bg-blue-50">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Transactions Card */}
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Total</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{summaryStats.total}</p>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Receipt size={20} className="text-gray-600" />
                </div>
              </div>
            </div>

            {/* Completed Transactions Card */}
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Completed</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{summaryStats.completed}</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                </div>
              </div>
            </div>

            {/* Voided Transactions Card */}
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Voided</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{summaryStats.voided}</p>
                </div>
                <div className="p-2 bg-red-50 rounded-lg">
                  <XCircle size={20} className="text-red-600" />
                </div>
              </div>
            </div>

            {/* Total Revenue Card */}
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Revenue</p>
                  <p className="text-xl font-bold mt-1">₱{summaryStats.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <TrendingUp size={20} className="text-white" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Active filters indicator */}
          {hasActiveFilters && (fromDate || toDate || selectedMonth !== "all" || selectedYear !== new Date().getFullYear() || selectedDay !== "all") && (
            <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-2 items-center">
              <span className="font-medium">Active Period:</span>
              {fromDate || toDate ? (
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">📅 {getDateRangeText()}</span>
              ) : (
                <span className="text-[#0B3C8A] bg-blue-50 px-2 py-0.5 rounded">📆 {getPeriodText()}</span>
              )}
            </div>
          )}
        </div>

        {/* Transactions Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
              <tr>
                <th className="p-4">Receipt No.</th>
                <th className="p-4">Staff / Time</th>
                <th className="p-4">Patient</th>
                <th className="p-4">Items</th>
                <th className="p-4 text-right">Amount</th>
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
                        {trx.patientName.length > 20 ? trx.patientName.substring(0, 20) + '...' : trx.patientName}
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
                            <CheckCircle2 size={10}/> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-[10px] font-bold">
                            <XCircle size={10}/> VOID
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
      </div>
    </div>
  );
}