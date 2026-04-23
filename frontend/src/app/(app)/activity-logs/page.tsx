// src/app/(app)/activity-logs/page.tsx

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  History,
  Filter,
  Calendar,
  ChevronDown,
  LogIn,
  LogOut,
  ArrowUp,
  ArrowDown,
  Sliders,
  ShoppingCart,
  Package,
  Users,
  X,
  RefreshCw,
  Shield
} from "lucide-react";
import { useFirebase } from "@/context/FirebaseContext";
import { useNotification } from "@/components/NotificationProvider";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";

const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";

// List of system usernames to filter out
const SYSTEM_USERS = ["System", "system", "Unknown User", "unknown", "Staff", "staff"];

interface ActivityLogEntry {
  id: string;
  type: 'login' | 'logout' | 'stock_adjustment' | 'scan_in' | 'scan_out' | 'transaction' | 'product_add' | 'product_edit' | 'product_delete' | 'staff_create' | 'staff_edit' | 'staff_deactivate' | 'staff_reactivate';
  action: string;
  description: string;
  staffName: string;
  staffId: string;
  timestamp: Date;
  details?: Record<string, any>;
}

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'login':
      return <LogIn size={14} className="text-green-600" />;
    case 'logout':
      return <LogOut size={14} className="text-red-600" />;
    case 'scan_in':
      return <ArrowUp size={14} className="text-emerald-600" />;
    case 'scan_out':
      return <ArrowDown size={14} className="text-orange-600" />;
    case 'stock_adjustment':
      return <Sliders size={14} className="text-blue-600" />;
    case 'transaction':
      return <ShoppingCart size={14} className="text-purple-600" />;
    case 'product_add':
    case 'product_edit':
      return <Package size={14} className="text-indigo-600" />;
    case 'staff_create':
    case 'staff_edit':
    case 'staff_deactivate':
    case 'staff_reactivate':
      return <Users size={14} className="text-amber-600" />;
    default:
      return <History size={14} className="text-gray-600" />;
  }
};

const getActivityBadgeColor = (type: string) => {
  switch (type) {
    case 'login':
      return 'bg-green-100 text-green-700';
    case 'logout':
      return 'bg-red-100 text-red-700';
    case 'scan_in':
      return 'bg-emerald-100 text-emerald-700';
    case 'scan_out':
      return 'bg-orange-100 text-orange-700';
    case 'stock_adjustment':
      return 'bg-blue-100 text-blue-700';
    case 'transaction':
      return 'bg-purple-100 text-purple-700';
    case 'product_add':
    case 'product_edit':
      return 'bg-indigo-100 text-indigo-700';
    case 'staff_create':
    case 'staff_edit':
    case 'staff_deactivate':
    case 'staff_reactivate':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

export default function ActivityLogsPage() {
  const { userRole, products } = useFirebase();
  const { showNotification, showToastOnly } = useNotification();
  
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [activityMonthFilter, setActivityMonthFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<string>("");
  const [tempEndDate, setTempEndDate] = useState<string>("");
  const [activitySearch, setActivitySearch] = useState("");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const loadProductNames = async () => {
      const names = new Map<string, string>();
      for (const product of products) {
        names.set(product.id, product.name);
      }
      setProductNames(names);
    };
    loadProductNames();
  }, [products]);

  const loadActivityLogs = async () => {
    setLoading(true);
    try {
      const logs: ActivityLogEntry[] = [];
      const monthsSet = new Set<string>();

      const addMonth = (date: Date) => {
        const monthStr = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        monthsSet.add(monthStr);
      };

      // 1. Load stock adjustments (includes scan in/out)
      const stockAdjustmentsRef = collection(db, `clinics/${CLINIC_ID}/stockAdjustments`);
      const stockQuery = query(stockAdjustmentsRef, orderBy("timestamp", "desc"), limit(1000));
      const stockSnapshot = await getDocs(stockQuery);
      
      stockSnapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate() || new Date();
        addMonth(timestamp);
        const reason = data.reason || 'Manual adjustment';
        const isScanIn = reason.toLowerCase().includes('received via qr scan') || reason.toLowerCase().includes('stock in');
        const isScanOut = reason.toLowerCase().includes('dispatched via qr scan') || reason.toLowerCase().includes('stock out');
        
        let type: ActivityLogEntry['type'] = 'stock_adjustment';
        let action = 'Stock Adjustment';
        
        if (isScanIn) {
          type = 'scan_in';
          action = 'Scan In (Receive Stock)';
        } else if (isScanOut) {
          type = 'scan_out';
          action = 'Scan Out (Dispatch Stock)';
        }
        
        const productId = data.productId;
        const productName = data.productName || productNames.get(productId) || 'Unknown Product';
        
        // Only add if staffName is not a system user
        const staffName = data.staffName || 'System';
        if (!SYSTEM_USERS.includes(staffName)) {
          logs.push({
            id: `stock-${doc.id}`,
            type,
            action,
            description: `${staffName} ${isScanIn ? 'scanned in' : isScanOut ? 'scanned out' : 'adjusted'} "${productName}"${data.oldStock !== undefined ? ` from ${data.oldStock} to ${data.newStock}` : ` to ${data.newStock}`}. Reason: ${reason}`,
            staffName: staffName,
            staffId: data.staffId || 'system',
            timestamp,
            details: {
              productId,
              productName,
              oldStock: data.oldStock,
              newStock: data.newStock,
              reason
            }
          });
        }
      });

      // 2. Load transactions (sales)
      const transactionsRef = collection(db, `clinics/${CLINIC_ID}/transactions`);
      const transactionsQuery = query(transactionsRef, orderBy("date", "desc"), limit(1000));
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      transactionsSnapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.date?.toDate() || data.createdAt?.toDate() || new Date();
        addMonth(timestamp);
        const itemsCount = data.items?.length || 0;
        
        const staffName = data.staffName || 'System';
        // Only add if staffName is not a system user
        if (!SYSTEM_USERS.includes(staffName)) {
          logs.push({
            id: `transaction-${doc.id}`,
            type: 'transaction',
            action: data.status === 'completed' ? 'Sale Completed' : 'Transaction Voided',
            description: `${staffName} processed ${data.status === 'completed' ? 'sale' : 'voided transaction'} for ${data.patientName || 'Walk-in Patient'}. ${itemsCount} item${itemsCount !== 1 ? 's' : ''}, total: ₱${data.total?.toLocaleString() || 0}`,
            staffName: staffName,
            staffId: data.staffId || 'system',
            timestamp,
            details: {
              transactionId: doc.id,
              patientName: data.patientName,
              total: data.total,
              items: data.items,
              status: data.status,
              paymentMethod: data.paymentMethod
            }
          });
        }
      });

      // 3. Load product additions/edits - filtered out (system only)
      // Product additions/edits are typically system-generated, skip them

      // 4. Load user/staff activities (logins) - only real users
      const usersRef = collection(db, "users");
      const usersQuery = query(usersRef, orderBy("lastLoginAt", "desc"), limit(500));
      const usersSnapshot = await getDocs(usersQuery);
      
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        
        const lastLoginAt = data.lastLoginAt?.toDate();
        if (lastLoginAt) {
          addMonth(lastLoginAt);
          const staffName = data.name || data.email?.split('@')[0] || 'User';
          logs.push({
            id: `login-${doc.id}-${lastLoginAt.getTime()}`,
            type: 'login',
            action: 'User Login',
            description: `${staffName} logged into the system`,
            staffName: staffName,
            staffId: doc.id,
            timestamp: lastLoginAt,
            details: {
              email: data.email
            }
          });
        }
        
        const createdAt = data.createdAt?.toDate();
        if (createdAt) {
          addMonth(createdAt);
          const staffName = data.name || data.email?.split('@')[0] || 'User';
          logs.push({
            id: `staff-create-${doc.id}`,
            type: 'staff_create',
            action: 'Staff Account Created',
            description: `Staff account created for ${staffName} with role: ${data.role || 'staff'}`,
            staffName: staffName,
            staffId: doc.id,
            timestamp: createdAt,
            details: {
              email: data.email,
              role: data.role,
              status: data.status
            }
          });
        }
        
        const updatedAt = data.updatedAt?.toDate();
        if (data.status === 'Inactive' && updatedAt) {
          addMonth(updatedAt);
          const staffName = data.name || data.email?.split('@')[0] || 'User';
          logs.push({
            id: `staff-deactivate-${doc.id}-${updatedAt.getTime()}`,
            type: 'staff_deactivate',
            action: 'Staff Account Deactivated',
            description: `Staff account for ${staffName} was deactivated`,
            staffName: staffName,
            staffId: doc.id,
            timestamp: updatedAt,
            details: {
              email: data.email,
              status: data.status
            }
          });
        }
      });

      // 5. Load logout events from logout_logs collection
      try {
        const logoutLogsRef = collection(db, `clinics/${CLINIC_ID}/logout_logs`);
        const logoutQuery = query(logoutLogsRef, orderBy("timestamp", "desc"), limit(1000));
        const logoutSnapshot = await getDocs(logoutQuery);
        
        logoutSnapshot.forEach(doc => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate() || new Date();
          addMonth(timestamp);
          
          const staffName = data.staffName || data.email?.split('@')[0] || 'User';
          
          const durationText = data.sessionDurationSeconds && data.sessionDurationSeconds > 0
            ? ` (Session: ${Math.floor(data.sessionDurationSeconds / 60)} min ${data.sessionDurationSeconds % 60} sec)`
            : '';
          
          logs.push({
            id: `logout-${doc.id}`,
            type: 'logout',
            action: 'User Logout',
            description: `${staffName} logged out of the system${durationText}`,
            staffName: staffName,
            staffId: data.staffId || 'unknown',
            timestamp,
            details: {
              email: data.email,
              sessionDuration: data.sessionDurationSeconds,
              logoutDate: data.logoutDate
            }
          });
        });
      } catch (error) {
        console.log('No logout_logs collection found yet');
      }

      // Sort all logs by timestamp (newest first) for initial load
      logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      const sortedMonths = Array.from(monthsSet).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateB.getTime() - dateA.getTime();
      });
      setAvailableMonths(sortedMonths);
      
      setActivityLogs(logs);
      console.log(`✅ Total real user logs loaded: ${logs.length}`);
    } catch (error) {
      console.error("Error loading activity logs:", error);
      showNotification("Failed to load activity logs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'admin') {
      loadActivityLogs();
    }
  }, [userRole]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivityLogs();
    setRefreshing(false);
    showToastOnly("Activity logs refreshed", "success");
  };

  const applyDateRange = () => {
    if (tempStartDate && tempEndDate) {
      const start = new Date(tempStartDate);
      const end = new Date(tempEndDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      if (start > end) {
        showToastOnly("End date must be after start date", "error");
        return;
      }
      
      setDateRange({ startDate: start, endDate: end });
      setActivityMonthFilter("all");
      setShowDatePicker(false);
      showToastOnly(`Showing logs from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`, "success");
    } else {
      showToastOnly("Please select both start and end dates", "error");
    }
  };

  const clearDateRange = () => {
    setDateRange({ startDate: null, endDate: null });
    setTempStartDate("");
    setTempEndDate("");
    if (dateRange.startDate || dateRange.endDate) {
      showToastOnly("Date range filter cleared", "info");
    }
  };

  const filteredActivityLogs = useMemo(() => {
    let filtered = [...activityLogs];
    
    if (activityFilter !== "all") {
      filtered = filtered.filter(log => log.type === activityFilter);
    }
    
    if (dateRange.startDate && dateRange.endDate) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= dateRange.startDate! && logDate <= dateRange.endDate!;
      });
      filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } else if (activityMonthFilter !== "all") {
      filtered = filtered.filter(log => {
        const monthStr = log.timestamp.toLocaleString('default', { month: 'long', year: 'numeric' });
        return monthStr === activityMonthFilter;
      });
      filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } else {
      filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    
    if (activitySearch.trim()) {
      const searchLower = activitySearch.toLowerCase();
      filtered = filtered.filter(log => 
        log.description.toLowerCase().includes(searchLower) ||
        log.staffName.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [activityLogs, activityFilter, activityMonthFilter, dateRange, activitySearch]);

  const formatDateRangeDisplay = () => {
    if (dateRange.startDate && dateRange.endDate) {
      return `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`;
    }
    return null;
  };

  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen w-full font-sans p-4 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600">
            You need administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full font-sans p-2 sm:p-4 box-border pb-20">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        {/* Header inside card */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#0B3C8A] rounded-xl shadow-md">
                  <History className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-gray-800">Activity Logs</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Complete record of all user actions across the system.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-[#0B3C8A] hover:border-[#0B3C8A] transition-all ${refreshing ? 'animate-spin' : ''}`}
              title="Refresh logs"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="p-6 border-b border-gray-100 bg-slate-50/30">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Activity Type</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none z-10">
                    <Filter size={14} className="text-gray-400" />
                  </div>
                  <select
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value)}
                    className="w-full pl-8 pr-2 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700 appearance-none"
                  >
                    <option value="all">All Activities</option>
                    <option value="login">User Logins</option>
                    <option value="logout">User Logouts</option>
                    <option value="scan_in">Scan In (Receive Stock)</option>
                    <option value="scan_out">Scan Out (Dispatch Stock)</option>
                    <option value="stock_adjustment">Stock Adjustments</option>
                    <option value="transaction">Sales Transactions</option>
                    <option value="staff_create">Staff Creation</option>
                    <option value="staff_deactivate">Staff Deactivation</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                    <ChevronDown size={14} className="text-gray-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none z-10">
                    <Calendar size={14} className="text-gray-400" />
                  </div>
                  <select
                    value={activityMonthFilter}
                    onChange={(e) => setActivityMonthFilter(e.target.value)}
                    className="w-full pl-8 pr-2 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] bg-white text-gray-700 appearance-none"
                  >
                    <option value="all">All Months</option>
                    {availableMonths.map((month) => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                    <ChevronDown size={14} className="text-gray-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Custom Date Range</label>
                <div className="relative">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm text-left flex items-center justify-between ${
                      dateRange.startDate && dateRange.endDate
                        ? 'border-[#0B3C8A] bg-blue-50 text-[#0B3C8A]'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className={dateRange.startDate && dateRange.endDate ? THEME_TEXT : "text-gray-400"} />
                      <span className="text-sm text-gray-700">
                        {dateRange.startDate && dateRange.endDate
                          ? `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`
                          : "Select Date Range"}
                      </span>
                    </div>
                    <ChevronDown size={14} className={`transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>

            {showDatePicker && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Select Date Range</h3>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X size={20} className="text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={tempStartDate}
                        onChange={(e) => setTempStartDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700"
                      />
                      <p className="text-xs text-gray-400 mt-1">Includes all activities from this day</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={tempEndDate}
                        onChange={(e) => setTempEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700"
                      />
                      <p className="text-xs text-gray-400 mt-1">Includes all activities up to this day</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowDatePicker(false);
                        clearDateRange();
                      }}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                    >
                      Clear
                    </button>
                    <button
                      onClick={applyDateRange}
                      className="flex-1 px-4 py-2 rounded-lg bg-[#0B3C8A] text-white text-sm font-medium hover:bg-[#082F6E]"
                    >
                      Apply Range
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(activityFilter !== "all" || activityMonthFilter !== "all" || dateRange.startDate || activitySearch) && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-xs text-gray-500">Active filters:</span>
                
                {activityFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                    Type: {activityFilter.replace('_', ' ')}
                    <button onClick={() => setActivityFilter("all")} className="hover:text-blue-900">
                      <X size={12} />
                    </button>
                  </span>
                )}
                
                {activityMonthFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                    Month: {activityMonthFilter}
                    <button onClick={() => setActivityMonthFilter("all")} className="hover:text-green-900">
                      <X size={12} />
                    </button>
                  </span>
                )}
                
                {dateRange.startDate && dateRange.endDate && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                    Range: {formatDateRangeDisplay()}
                    <button onClick={clearDateRange} className="hover:text-purple-900">
                      <X size={12} />
                    </button>
                  </span>
                )}
                
                {activitySearch && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                    Search: {activitySearch}
                    <button onClick={() => setActivitySearch("")} className="hover:text-gray-900">
                      <X size={12} />
                    </button>
                  </span>
                )}
                
                <button
                  onClick={() => {
                    setActivityFilter("all");
                    setActivityMonthFilter("all");
                    clearDateRange();
                    setActivitySearch("");
                  }}
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="px-6 pt-4 pb-2 text-xs text-gray-500 border-b border-gray-100">
          Showing {filteredActivityLogs.length} of {activityLogs.length} activities
          {dateRange.startDate && dateRange.endDate && (
            <span className="ml-2 text-blue-600">
              ({dateRange.startDate.toLocaleDateString()} → {dateRange.endDate.toLocaleDateString()})
            </span>
          )}
        </div>

        {/* Activity Log Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B3C8A]"></div>
              <span className="ml-3 text-gray-500">Loading activity logs...</span>
            </div>
          ) : filteredActivityLogs.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <History size={48} className="mx-auto mb-3 opacity-20" />
              <p>No activity logs found</p>
              {dateRange.startDate && dateRange.endDate && (
                <p className="text-xs mt-1">
                  No activities found between {dateRange.startDate.toLocaleDateString()} and {dateRange.endDate.toLocaleDateString()}
                </p>
              )}
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="w-full">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap w-[180px]">Timestamp</th>
                    <th className="px-4 py-3 whitespace-nowrap w-[100px]">User</th>
                    <th className="px-4 py-3 whitespace-nowrap w-[130px]">Activity</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredActivityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 align-top whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-700">{log.timestamp.toLocaleDateString()}</span>
                          <span className="text-[11px] text-gray-400">{log.timestamp.toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                            {log.staffName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-700 text-xs" title={log.staffName}>
                            {log.staffName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded shrink-0 ${getActivityBadgeColor(log.type)}`}>
                            {getActivityIcon(log.type)}
                          </div>
                          <span className="font-medium text-gray-800 text-xs">
                            {log.action}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 align-top">
                        <div 
                          className="whitespace-normal break-words text-xs leading-relaxed"
                          title={log.description}
                        >
                          {log.description}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer with summary */}
        {!loading && filteredActivityLogs.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex flex-wrap justify-between gap-2">
              <span>Total activities: {filteredActivityLogs.length}</span>
              {filteredActivityLogs.length > 0 && (
                <>
                  <span>Earliest: {filteredActivityLogs[0]?.timestamp.toLocaleDateString()}</span>
                  <span>Latest: {filteredActivityLogs[filteredActivityLogs.length - 1]?.timestamp.toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}