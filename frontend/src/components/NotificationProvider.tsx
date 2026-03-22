"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, X, Info } from "lucide-react";

// --- TYPES ---
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// Define a type for transaction data that might be stored in notifications
export interface TransactionData {
  transactionId: string;
  receiptNumber: string;
  patientName: string;
  itemCount: number;
  total: number;
  staffName?: string;
  staffId?: string;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

// Define a type for inventory data that might be stored in notifications
export interface InventoryData {
  productId: string;
  productName: string;
  oldStock?: number;
  newStock: number;
  reorderPoint?: number;
}

// Union type for all possible notification data
export type NotificationData = TransactionData | InventoryData | Record<string, unknown>;

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  read: boolean;
  link?: string;
  data?: NotificationData;
  forAdmin?: boolean;
  forStaff?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (
    message: string, 
    type?: NotificationType, 
    title?: string, 
    link?: string, 
    data?: NotificationData,
    forAdmin?: boolean,
    forStaff?: boolean
  ) => void;
  showToastOnly: (
    message: string, 
    type?: NotificationType, 
    title?: string
  ) => void; // New function for toast-only notifications
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  unreadCount: number;
  userRole?: 'admin' | 'staff';
  setUserRole: (role: 'admin' | 'staff') => void;
}

// --- CONTEXT ---
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// --- HOOK (Use this in your pages) ---
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};

// --- PROVIDER COMPONENT ---
export default function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toast, setToast] = useState<{ message: string; type: NotificationType } | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'staff'>('staff');

  // Helper functions - defined BEFORE they are used
  const getDefaultTitle = (type: NotificationType): string => {
    switch (type) {
      case 'success': return 'Success';
      case 'error': return 'Error';
      case 'warning': return 'Warning';
      case 'info': return 'Information';
      default: return 'Notification';
    }
  };

  const getToastIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} />;
      case 'error':
        return <AlertTriangle size={18} />;
      case 'warning':
        return <AlertTriangle size={18} />;
      case 'info':
        return <Info size={18} />;
      default:
        return <Info size={18} />;
    }
  };

  const getToastStyles = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-white text-slate-800 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'warning':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'info':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      default:
        return 'bg-white text-slate-800 border-gray-200';
    }
  };

  const getToastIconBg = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-600';
      case 'error':
        return 'bg-red-100 text-red-600';
      case 'warning':
        return 'bg-orange-100 text-orange-600';
      case 'info':
        return 'bg-blue-100 text-blue-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // For permanent notifications that go to the Notification Center
  const showNotification = useCallback((
    message: string, 
    type: NotificationType = 'success', 
    title?: string,
    link?: string,
    data?: NotificationData,
    forAdmin: boolean = false,
    forStaff: boolean = true
  ) => {
    // Create a new notification with a timestamp-based ID
    const newNotification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title || getDefaultTitle(type),
      message,
      type,
      timestamp: new Date(),
      read: false,
      link,
      data,
      forAdmin,
      forStaff,
    };

    // Add to notifications list only if it's for the current user role
    if ((forAdmin && userRole === 'admin') || (forStaff && userRole === 'staff')) {
      setNotifications(prev => [newNotification, ...prev].slice(0, 50));
      
      // Also show toast for permanent notifications
      setToast({ message, type });
      
      // Auto-hide toast after 4 seconds
      setTimeout(() => setToast(null), 4000);
    }
  }, [userRole]);

  // For toast-only notifications that don't go to the Notification Center
  const showToastOnly = useCallback((
    message: string, 
    type: NotificationType = 'error'
  ) => {
    // Only show toast, don't add to notifications list
    setToast({ message, type });
    
    // Auto-hide toast after 3 seconds (shorter for error toasts)
    setTimeout(() => setToast(null), 3000);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  // Filter notifications based on user role
  const filteredNotifications = notifications.filter(notif => 
    (notif.forAdmin && userRole === 'admin') || 
    (notif.forStaff && userRole === 'staff') ||
    (!notif.forAdmin && !notif.forStaff)
  );

  const unreadCount = filteredNotifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ 
      notifications: filteredNotifications, 
      showNotification, 
      showToastOnly,
      markAsRead, 
      markAllAsRead, 
      clearNotification,
      unreadCount,
      userRole,
      setUserRole
    }}>
      {children}
      
      {/* GLOBAL TOAST UI */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            key="toast"
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md ${getToastStyles(toast.type)}`}
          >
            <div className={`p-1 rounded-full ${getToastIconBg(toast.type)}`}>
              {getToastIcon(toast.type)}
            </div>
            <div className="text-sm font-medium pr-2 max-w-xs">{toast.message}</div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}