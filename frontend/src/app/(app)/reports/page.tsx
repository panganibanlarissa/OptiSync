// src/app/(app)/reports/page.tsx

"use client";

import React, { useState, useMemo } from "react";
import { useNotification } from "@/components/NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";
import { useMLForecasting } from "@/hooks/useMLForecasting";
import { jsPDF } from "jspdf";
import "@/lib/fonts/NotoSans-Regular-normal.js";
import autoTable from "jspdf-autotable";
import { 
  Download, 
  Receipt,
  Search,
  CheckCircle2,
  Filter,
  Clock,
  TrendingUp,
  Calendar,
  Repeat,
  CheckCheck
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
  status: "completed" | "processing_replacement" | "replaced";
  paymentMethod?: "cash" | "online";
  replacementReason?: string;
  replacedAt?: Date;
  replacedBy?: string;
  processedAt?: Date;
  processedBy?: string;
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

// Helper function to format date as YYYY-MM-DD in local time
const getLocalDateStamp = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to format date range for display
const formatDateRange = (fromDate: Date | null, toDate: Date | null): string => {
  if (!fromDate && !toDate) return "";
  
  const formatDateShort = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  if (fromDate && toDate) {
    return `${formatDateShort(fromDate)} – ${formatDateShort(toDate)}`;
  } else if (fromDate) {
    return `From ${formatDateShort(fromDate)}`;
  } else if (toDate) {
    return `Until ${formatDateShort(toDate)}`;
  }
  return "";
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

// Calculate days since last sale
const getDaysSinceLastSale = (product: any, transactions: TransactionType[], today: Date): { days: number; lastSaleDate: Date | null; hasSales: boolean; totalSalesCount: number } => {
  const allTransactions = transactions;
  
  const salesForProduct = allTransactions
    .filter(t => t.items.some(item => item.id === product.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const lastSale = salesForProduct[0];
  const totalSalesCount = salesForProduct.length;
  
  if (lastSale) {
    const lastSaleDate = new Date(lastSale.date);
    lastSaleDate.setHours(0, 0, 0, 0);
    const days = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
    return { days, lastSaleDate, hasSales: true, totalSalesCount };
  } else {
    const createdDate = getDateFromTimestamp(product.createdAt);
    
    let days = 0;
    if (createdDate) {
      createdDate.setHours(0, 0, 0, 0);
      days = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      days = product.lastMovedDaysAgo || 0;
    }
    
    return { days, lastSaleDate: null, hasSales: false, totalSalesCount: 0 };
  }
};

// Helper function to get status display
const getStatusDisplay = (status: string) => {
  switch (status) {
    case 'completed':
      return { text: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={10} /> };
    case 'processing_replacement':
      return { text: 'Processing Replacement', color: 'bg-yellow-100 text-yellow-700', icon: <Repeat size={10} /> };
    case 'replaced':
      return { text: 'Replaced', color: 'bg-purple-100 text-purple-700', icon: <CheckCheck size={10} /> };
    default:
      return { text: status, color: 'bg-gray-100 text-gray-700', icon: null };
  }
};

const PESO_SIGN = "\u20B1";

const formatPdfCurrency = (amount: number): string => {
  return `${PESO_SIGN}${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "replaced">("all");
  
  // Date Range State
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  
  // Pagination State
  const [reportCurrentPage, setReportCurrentPage] = useState<number>(1);
  const [reportsPerPage] = useState<number>(10);
  
  const { showNotification } = useNotification();
  const { 
    transactions: firebaseTransactions,
    products: firebaseProducts,
    userRole,
    appUser
  } = useFirebase();

  const { recommendations, usingML } = useMLForecasting();

  // CRITICAL: ALL transactions are counted for revenue - replacements are NOT refunds
  const transactions = useMemo(() => {
    return firebaseTransactions as TransactionType[];
  }, [firebaseTransactions]);

  const products = useMemo(() => {
    return firebaseProducts;
  }, [firebaseProducts]);

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

  const handleFromDateChange = (value: string) => {
    setFromDate(value);
    if (toDate && value && new Date(value) > new Date(toDate)) {
      setToDate("");
    }
    setReportCurrentPage(1);
  };
  
  const handleToDateChange = (value: string) => {
    setToDate(value);
    setReportCurrentPage(1);
  };
  
  const clearDateRange = () => {
    setFromDate("");
    setToDate("");
    setReportCurrentPage(1);
  };

  // Filter transactions for display based on selected date range
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
      
      let matchesStatus = true;
      if (statusFilter === "all") {
        matchesStatus = true;
      } else if (statusFilter === "completed") {
        matchesStatus = trx.status === "completed";
      } else if (statusFilter === "replaced") {
        matchesStatus = trx.status === "replaced";
      }
      
      // Date filtering - ONLY use the selected date range
      let matchesDate = true;
      if (fromDate && toDate) {
        const fromDateObj = new Date(fromDate);
        const toDateObj = new Date(toDate);
        if (fromDateObj <= toDateObj) {
          matchesDate = isDateInRange(transactionDate, fromDateObj, toDateObj);
        } else {
          matchesDate = false;
        }
      } else if (fromDate) {
        const fromDateObj = new Date(fromDate);
        matchesDate = isDateInRange(transactionDate, fromDateObj, null);
      } else if (toDate) {
        const toDateObj = new Date(toDate);
        matchesDate = isDateInRange(transactionDate, null, toDateObj);
      } else {
        const matchesYear = selectedYear === 0 || transactionYear === selectedYear;
        const matchesMonth = selectedMonth === "all" || transactionMonth === selectedMonth;
        const matchesDay = selectedDay === "all" || transactionDay === parseInt(selectedDay);
        matchesDate = matchesYear && matchesMonth && matchesDay;
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [transactions, searchQuery, selectedYear, selectedMonth, selectedDay, statusFilter, fromDate, toDate]);

  // Summary statistics - uses filtered transactions for accurate date range
  const summaryStats = useMemo(() => {
    const completed = filteredTransactions.filter(t => t.status === 'completed');
    const replaced = filteredTransactions.filter(t => t.status === 'replaced');
    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
    
    return {
      total: filteredTransactions.length,
      completed: completed.length,
      replaced: replaced.length,
      totalRevenue
    };
  }, [filteredTransactions]);

  const reportPaginationData = useMemo(() => {
    const totalTransactions = filteredTransactions.length;
    const totalPages = Math.ceil(totalTransactions / reportsPerPage);
    const startIndex = (reportCurrentPage - 1) * reportsPerPage;
    const endIndex = startIndex + reportsPerPage;
    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
    
    return {
      totalTransactions,
      totalPages,
      currentPage: reportCurrentPage,
      paginatedTransactions,
      startIndex,
      endIndex,
      itemsPerPage: reportsPerPage
    };
  }, [filteredTransactions, reportCurrentPage, reportsPerPage]);

  const exportLedgerReport = () => {
    if (filteredTransactions.length === 0) {
      showNotification("No transactions found for this period to export.", "error");
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont("NotoSans-Regular", "normal");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    const periodText = getPeriodText();

    // Use filteredTransactions for ALL calculations - this ensures date filtering works correctly
    const totalSales = filteredTransactions.reduce((sum, trx) => sum + trx.total, 0);
    const replacedTransactions = filteredTransactions.filter(t => t.status === 'replaced');
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text("Sales Transaction Report", pageWidth / 2, 23, { align: 'center' });
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Generated by: ${appUser?.name || 'System'}`, pageWidth / 2, 31, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 38, pageWidth - margin, 38);
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Date Range: ${periodText}`, margin, 45);
    
    let currentPage = 1;
    
    autoTable(doc, {
      startY: 53,
      margin: { top: 53, right: 14, left: 14, bottom: 20 },
      tableWidth: 'auto',
      head: [['Date', 'Patient Name', 'Items', 'Amount']],
      body: filteredTransactions.map((t) => {
        const itemsStr = t.items
          .map((i) => `${i.quantity}x ${i.name}`)
          .join(', ');

        return [
          new Date(t.date).toLocaleDateString(),
          t.patientName,
          itemsStr,
          formatPdfCurrency(t.total)
        ];
      }),
      theme: 'grid',
      headStyles: {
        fillColor: [128, 128, 128],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        fontSize: 9
      },
      styles: {
        font: "NotoSans-Regular",
        fontSize: 8,
        cellPadding: 2.5,
        overflow: 'linebreak',
        valign: 'top',
        textColor: [0, 0, 0],
        lineColor: [220, 220, 220],
        lineWidth: 0.1
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248]
      },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 82 },
        3: { cellWidth: 28, halign: 'right' }
      },
      didDrawPage: (data) => {
        currentPage = data.pageNumber;

        if (data.pageNumber > 1) {
          doc.setFont("NotoSans-Regular", "normal");
          doc.setFontSize(16);
          doc.setTextColor(0, 0, 0);
          doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });

          doc.setFont("NotoSans-Regular", "normal");
          doc.setFontSize(11);
          doc.setTextColor(40, 40, 40);
          doc.text("Sales Transaction Report", pageWidth / 2, 23, { align: 'center' });

          doc.setFont("NotoSans-Regular", "normal");
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          doc.text(
            `Generated: ${new Date().toLocaleDateString()} | Generated by: ${appUser?.name || 'System'}`,
            pageWidth / 2,
            31,
            { align: 'center' }
          );

          doc.setDrawColor(0, 0, 0);
          doc.line(margin, 38, pageWidth - margin, 38);
          
          doc.setFont("NotoSans-Regular", "normal");
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
          doc.text(`Date Range: ${periodText}`, margin, 45);
        }
      }
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 53;
    const footerAreaStart = pageHeight - 30;
    let summaryStartY = Math.max(finalY + 10, 53);
    
    if (summaryStartY + 80 > footerAreaStart) {
      doc.addPage();
      summaryStartY = 45;
      
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
      
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text("Sales Transaction Report", pageWidth / 2, 23, { align: 'center' });
      
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Generated by: ${appUser?.name || 'System'}`, pageWidth / 2, 31, { align: 'center' });
      
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 35, pageWidth - margin, 35);
    }
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Summary Report", margin, summaryStartY);
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Transactions: ${filteredTransactions.length}`, margin, summaryStartY + 8);
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Total count of all transaction records in this period (completed + replaced).", margin, summaryStartY + 11);
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Completed: ${filteredTransactions.filter(t => t.status === 'completed').length}`, margin, summaryStartY + 18);
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Number of transactions successfully processed and recorded.", margin, summaryStartY + 21);
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Replaced: ${filteredTransactions.filter(t => t.status === 'replaced').length}`, margin, summaryStartY + 28);
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Number of transactions that have been replaced.", margin, summaryStartY + 31);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, summaryStartY + 37, pageWidth - margin, summaryStartY + 37);
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Total Sales Revenue: ${formatPdfCurrency(totalSales)}`,
      margin,
      summaryStartY + 44
    );
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Sum of ALL transactions in this selected period.", margin, summaryStartY + 47);

    const totalPages = doc.getNumberOfPages();
    const lineY = pageHeight - 15;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, lineY, pageWidth - margin, lineY);
      
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const footerText = "Confidential - For Record Keeping Only";
      doc.text(footerText, margin, lineY + 5);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, lineY + 5, { align: 'right' });
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

    // Use filtered transactions for the date range
    const rangeFilteredTransactions = filteredTransactions;

    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont("NotoSans-Regular", "normal");

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
        const { days, lastSaleDate, hasSales, totalSalesCount } = getDaysSinceLastSale(p, rangeFilteredTransactions, today);
        return { ...p, daysSinceSale: days, lastSaleDate, hasSales, totalSalesCount };
      })
      .filter(p => p.daysSinceSale >= 30)
      .sort((a, b) => b.daysSinceSale - a.daysSinceSale);

    const periodText = getPeriodText();

    const addHeader = (pageNumber: number) => {
      doc.setPage(pageNumber);
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text("Monthly Inventory Optimization Report", pageWidth / 2, 23, { align: 'center' });
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(9);
      doc.text(
        `Generated: ${today.toLocaleDateString()} | Generated by: ${appUser?.name || 'System'}`,
        pageWidth / 2,
        31,
        { align: 'center' }
      );

      doc.setDrawColor(200, 200, 200);
      doc.line(14, 35, pageWidth - 14, 35);

      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Date Range: ${periodText}`, 14, 42);
    };

    addHeader(1);

    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("1. Predicted Inventory Needs (Next 30 Days)", 14, 50);
    
    if (priorityNeeds.length > 0) {
      autoTable(doc, {
        startY: 54,
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
        styles: { font: "NotoSans-Regular", fontSize: 8, textColor: [0, 0, 0] },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            addHeader(data.pageNumber);
          }
        }
      });
    } else {
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("No items require restocking within the next 30 days.", 14, 60);
    }

    const secondTableY = priorityNeeds.length > 0 ? (doc as any).lastAutoTable.finalY + 15 : 68;
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("2. Space Optimization: Recommended for Liquidation", 14, secondTableY);
    
    if (liquidationItems.length > 0) {
      autoTable(doc, {
        startY: secondTableY + 4,
        margin: { left: 14, right: 14, top: 45, bottom: 20 },
        head: [['Aging Product', 'Category', 'Stock', 'Days Idle', 'Status', 'Value']],
        body: liquidationItems.map(p => [
          p.name,
          p.category,
          p.stock,
          p.daysSinceSale >= 365 ? ">1 Year" : `${p.daysSinceSale} days`,
          p.hasSales ? (p.totalSalesCount > 0 ? `Unsold (${p.daysSinceSale} days)` : 'Never Sold') : 'Never Sold',
          formatPdfCurrency(p.stock * p.markupPrice)
        ]),
        headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255] },
        styles: { font: "NotoSans-Regular", fontSize: 8, textColor: [0, 0, 0] },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            addHeader(data.pageNumber);
          }
        }
      });
    } else {
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("No deadstock items identified in this period.", 14, secondTableY + 10);
    }

    let summaryY = liquidationItems.length > 0 ? (doc as any).lastAutoTable.finalY + 15 : secondTableY + 25;
    
    if (summaryY + 40 > pageHeight - 20) {
      doc.addPage();
      summaryY = 43;
    }
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Executive Summary", 14, summaryY);
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`- Identified ${priorityNeeds.length} items requiring restock within the next 30 days to prevent stockouts.`, 14, summaryY + 7);
    doc.text(`- Identified ${liquidationItems.length} deadstock items (30+ days unsold) consuming warehouse space.`, 14, summaryY + 12);
    doc.text(`- Potential capital recovery from liquidation: ${formatPdfCurrency(liquidationItems.reduce((s, i) => s + (i.stock * i.markupPrice), 0))}`, 14, summaryY + 17);
    doc.text(`- Stock turnover rate: ${stockAccuracyRate.toFixed(1)}% of inventory has moved during the selected period.`, 14, summaryY + 22);
    
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Recommendation: Prioritize restocking critical items while liquidating deadstock to optimize capital efficiency.", 14, summaryY + 30);

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addHeader(i);
        doc.setDrawColor(200, 200, 200);
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
        doc.setFont("NotoSans-Regular", "normal");
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

    // Use filtered transactions for the date range
    const rangeFilteredTransactions = filteredTransactions;

    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont("NotoSans-Regular", "normal");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allProductsData = products
      .filter(p => p.stock > 0 && !(p as any).archived)
      .map(p => {
        const allTransactions = rangeFilteredTransactions;
        
        const salesForProduct = allTransactions
          .filter(t => t.items.some(item => item.id === p.id))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const lastSale = salesForProduct[0];
        let daysSinceLastSale = 0;
        let lastSaleDate: Date | null = null;
        const hasSales = salesForProduct.length > 0;
        
        if (lastSale) {
          lastSaleDate = new Date(lastSale.date);
          lastSaleDate.setHours(0, 0, 0, 0);
          daysSinceLastSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          const createdDate = getDateFromTimestamp(p.createdAt);
          if (createdDate) {
            createdDate.setHours(0, 0, 0, 0);
            daysSinceLastSale = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            daysSinceLastSale = 999;
          }
        }
        
        const deadCapital = p.stock * p.markupPrice;
        
        let daysIdleDisplay = '';
        
        if (!hasSales) {
          daysIdleDisplay = `Never Sold (${daysSinceLastSale} days old)`;
        } else if (daysSinceLastSale >= 365) {
          daysIdleDisplay = `>1 Year (${daysSinceLastSale} days)`;
        } else if (daysSinceLastSale >= 180) {
          daysIdleDisplay = `6-12 months (${daysSinceLastSale} days)`;
        } else if (daysSinceLastSale >= 90) {
          daysIdleDisplay = `3-6 months (${daysSinceLastSale} days)`;
        } else if (daysSinceLastSale >= 30) {
          daysIdleDisplay = `1-3 months (${daysSinceLastSale} days)`;
        } else {
          daysIdleDisplay = `${daysSinceLastSale} days`;
        }
        
        return {
          id: p.id,
          name: p.name,
          category: p.category || 'Uncategorized',
          stock: p.stock,
          unitPrice: p.markupPrice,
          daysSinceLastSale,
          daysIdleDisplay,
          deadCapital,
          lastSaleDate,
          hasSales,
          totalSalesCount: salesForProduct.length
        };
      });
    
    const deadstockData = allProductsData
    .filter(item => item.daysSinceLastSale >= 30)
    .sort((a, b) => b.daysSinceLastSale - a.daysSinceLastSale);

    if (deadstockData.length === 0) {
      showNotification("No deadstock inventory (30+ days unsold or never sold) identified in this period.", "info");
      return;
    }

    const periodText = getPeriodText();

    const addAgingHeader = (pageNumber: number) => {
      doc.setPage(pageNumber);
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: 'center' });
      
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text("Aging Inventory Report - Deadstock Analysis", pageWidth / 2, 23, { align: 'center' });
      
      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(
        `Generated: ${new Date().toLocaleDateString()} | Generated by: ${appUser?.name || 'System'}`,
        pageWidth / 2,
        31,
        { align: 'center' }
      );

      doc.setDrawColor(200, 200, 200);
      doc.line(14, 35, pageWidth - 14, 35);

      doc.setFont("NotoSans-Regular", "normal");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Date Range: ${periodText}`, 14, 42);
    };

    addAgingHeader(1);

    autoTable(doc, {
      startY: 52,
      margin: { top: 52, right: 14, left: 14, bottom: 20 },
      head: [['Product Name', 'Category', 'Stock', 'Days Idle', 'Status', 'Value']],
      body: deadstockData.map(item => [
        item.name,
        item.category,
        item.stock,
        item.daysIdleDisplay,
        item.hasSales ? `Unsold (Last sale: ${item.lastSaleDate?.toLocaleDateString() || 'N/A'})` : 'NEVER SOLD',
        formatPdfCurrency(item.deadCapital)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { font: "NotoSans-Regular", fontSize: 9, textColor: [0, 0, 0] },
      columnStyles: {
        5: { cellWidth: 35, halign: 'right' }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          addAgingHeader(data.pageNumber);
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 45;
    let summaryY = finalY + 12;
    if (summaryY + 38 > pageHeight - 20) {
      doc.addPage();
      summaryY = 45;
      addAgingHeader(doc.getNumberOfPages());
    }

    const totalDeadCapital = deadstockData.reduce((sum, item) => sum + item.deadCapital, 0);

    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Executive Summary", 14, summaryY);

    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`- Deadstock Items: ${deadstockData.length}`, 14, summaryY + 7);
    doc.text(`- Total Dead Capital: ${formatPdfCurrency(totalDeadCapital)}`, 14, summaryY + 12);

    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Recommendation: Prioritize liquidation of highest-value deadstock and review reorder policies for slow-moving categories.", 14, summaryY + 19);

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addAgingHeader(i);
        const lineY = pageHeight - 15;
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, lineY, pageWidth - 14, lineY);
        
        doc.setFont("NotoSans-Regular", "normal");
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
    clearDateRange();
    setReportCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || selectedMonth !== 'all' || selectedYear !== new Date().getFullYear() || selectedDay !== 'all' || fromDate || toDate;

  return (
    <div className="min-h-screen w-full font-sans p-2 sm:p-4 box-border pb-20 space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-[#0B3C8A] rounded-xl shadow-md">
                <Receipt className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Reports</h1>
                <p className="text-xs sm:text-sm text-gray-500">View and export all sales transactions</p>
              </div>
            </div>
            
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
                <Download size={14} /> Export Report
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100 bg-gray-50/30">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setReportCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "all" | "completed" | "replaced");
                setReportCurrentPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="replaced">Replaced</option>
            </select>

            <select
              value={selectedYear}
              onChange={(e) => {
                const yearValue = parseInt(e.target.value);
                setSelectedYear(yearValue);
                setSelectedMonth("all");
                setSelectedDay("all");
                setReportCurrentPage(1);
                if (yearValue !== 0) {
                  clearDateRange();
                }
              }}
              className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700"
            >
              <option value={0}>All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDay("all");
                setReportCurrentPage(1);
                if (e.target.value !== "all") {
                  clearDateRange();
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

            <select
              value={selectedDay}
              onChange={(e) => {
                setSelectedDay(e.target.value);
                setReportCurrentPage(1);
                if (e.target.value !== "all") {
                  clearDateRange();
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

            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => handleFromDateChange(e.target.value)}
                className="pl-7 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 bg-white"
                placeholder="From"
              />
            </div>

            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="date"
                value={toDate}
                onChange={(e) => handleToDateChange(e.target.value)}
                min={fromDate || undefined}
                className="pl-7 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 bg-white"
                placeholder="To"
              />
            </div>

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

        <div className="p-4 border-b border-gray-100 bg-blue-50">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Replaced</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{summaryStats.replaced}</p>
                </div>
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Repeat size={20} className="text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Revenue</p>
                  <p className="text-xl font-bold text-gray-800 mt-1">{PESO_SIGN}{summaryStats.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <TrendingUp size={20} className="text-[#0B3C8A]" />
                </div>
              </div>
            </div>
          </div>
        </div>

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
                reportPaginationData.paginatedTransactions.map((trx, idx) => {
                  const dateObj = new Date(trx.date);
                  const formattedDate = dateObj.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  });
                  const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const statusDisplay = getStatusDisplay(trx.status);

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
                        {PESO_SIGN}{trx.total.toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${statusDisplay.color}`}>
                          {statusDisplay.icon}
                          {statusDisplay.text}
                        </span>
                        {trx.status === 'processing_replacement' && trx.processedBy && (
                          <div className="text-[9px] text-yellow-600 mt-0.5">
                            by {trx.processedBy}
                          </div>
                        )}
                        {trx.status === 'replaced' && trx.replacedBy && (
                          <div className="text-[9px] text-purple-600 mt-0.5">
                            by {trx.replacedBy}
                          </div>
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

        {reportPaginationData.totalTransactions > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-800">{reportPaginationData.startIndex + 1}</span> to <span className="font-semibold text-gray-800">{Math.min(reportPaginationData.endIndex, reportPaginationData.totalTransactions)}</span> of <span className="font-semibold text-gray-800">{reportPaginationData.totalTransactions}</span> transactions
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setReportCurrentPage(1)}
                disabled={reportPaginationData.currentPage === 1}
                className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                title="First Page"
              >
                «
              </button>
              <button
                onClick={() => setReportCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={reportPaginationData.currentPage === 1}
                className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                title="Previous Page"
              >
                ‹
              </button>
              <div className="flex items-center gap-1">
                {(() => {
                  const pages: (number | string)[] = [];
                  const totalPages = reportPaginationData.totalPages;
                  const currentPage = reportPaginationData.currentPage;
                  const pageRange = 2;
                  
                  if (totalPages > 0) pages.push(1);
                  const start = Math.max(2, currentPage - pageRange);
                  const end = Math.min(totalPages - 1, currentPage + pageRange);
                  if (start > 2) pages.push('...');
                  for (let i = start; i <= end; i++) {
                    if (!pages.includes(i)) pages.push(i);
                  }
                  if (end < totalPages - 1) pages.push('...');
                  if (totalPages > 1 && !pages.includes(totalPages)) pages.push(totalPages);
                  
                  return pages.map((pageNum, idx) => (
                    typeof pageNum === 'number' ? (
                      <button
                        key={pageNum}
                        onClick={() => setReportCurrentPage(pageNum)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          currentPage === pageNum
                            ? 'bg-[#0B3C8A] text-white font-semibold'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                        title={`Page ${pageNum}`}
                      >
                        {pageNum}
                      </button>
                    ) : (
                      <span key={`ellipsis-${idx}`} className="text-gray-400 px-1">...</span>
                    )
                  ));
                })()}
              </div>
              <button
                onClick={() => setReportCurrentPage(prev => Math.min(reportPaginationData.totalPages, prev + 1))}
                disabled={reportPaginationData.currentPage === reportPaginationData.totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                title="Next Page"
              >
                ›
              </button>
              <button
                onClick={() => setReportCurrentPage(reportPaginationData.totalPages)}
                disabled={reportPaginationData.currentPage === reportPaginationData.totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                title="Last Page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}