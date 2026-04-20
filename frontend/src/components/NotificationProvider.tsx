"use client";

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, X, Info } from "lucide-react";
import { notificationService, StoredNotification } from "@/services/notificationService";
import { notificationMigration } from "@/services/notificationMigration";
import { useFirebase } from "@/context/FirebaseContext";

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

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

export interface InventoryData {
  productId: string;
  productName: string;
  oldStock?: number;
  newStock: number;
  reorderPoint?: number;
  expiryDate?: string;
}

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
  isResolved?: boolean;
  triggerEventId?: string;
  resolvedAt?: Date;
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
    forStaff?: boolean,
    triggerEventId?: string,
    eventTimestamp?: Date,
    showToast?: boolean
  ) => Promise<string | null>;
  showToastOnly: (
    message: string, 
    type?: NotificationType, 
    title?: string
  ) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotification: (id: string) => Promise<void>;
  unreadCount: number;
  userRole?: 'admin' | 'staff';
  setUserRole: (role: 'admin' | 'staff') => void;
  resolveNotification: (triggerEventId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const [storedNotifications, setStoredNotifications] = useState<StoredNotification[]>([]);
  const [toast, setToast] = useState<{ message: string; type: NotificationType } | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'staff'>('staff');
  const [isLoading, setIsLoading] = useState(true);
  const { user, appUser, loading: authLoading } = useFirebase();

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
      case 'success': return <CheckCircle2 size={18} />;
      case 'error': return <AlertTriangle size={18} />;
      case 'warning': return <AlertTriangle size={18} />;
      case 'info': return <Info size={18} />;
      default: return <Info size={18} />;
    }
  };

  const getToastStyles = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'bg-white text-slate-800 border-green-200';
      case 'error': return 'bg-red-50 text-red-800 border-red-200';
      case 'warning': return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'info': return 'bg-blue-50 text-blue-800 border-blue-200';
      default: return 'bg-white text-slate-800 border-gray-200';
    }
  };

  const getToastIconBg = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-600';
      case 'error': return 'bg-red-100 text-red-600';
      case 'warning': return 'bg-orange-100 text-orange-600';
      case 'info': return 'bg-blue-100 text-blue-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const convertToNotification = (stored: StoredNotification): Notification => {
    const timestamp = stored.createdAt?.toDate() || stored.eventTimestamp?.toDate() || new Date();
    
    return {
      id: stored.id,
      title: stored.title,
      message: stored.message,
      type: stored.type,
      timestamp,
      read: stored.read,
      link: stored.link,
      data: stored.data,
      forAdmin: stored.forAdmin,
      forStaff: stored.forStaff,
      isResolved: stored.isResolved,
      triggerEventId: stored.triggerEventId,
      resolvedAt: stored.resolvedAt?.toDate()
    };
  };

  // Logic to filter notifications visible in the bell
  const filteredNotifications = storedNotifications
    .filter(notif => !notif.isResolved)
    .filter(notif => {
      // 1. ALWAYS BLOCK AUTH ERRORS FROM THE BELL
      const msg = notif.message.toLowerCase();
      const blockedKeywords = [
        "login failed",
        "check your credentials",
        "firebase",
        "email-already-in-use",
        "auth/"
      ];
      
      const isAuthError = blockedKeywords.some(keyword => msg.includes(keyword));
      if (isAuthError) return false;

      // 2. ADMIN VIEW
      if (userRole === 'admin') return true;

      // 3. STAFF VIEW (Specific Categories)
      const title = notif.title.toLowerCase();
      const staffKeywords = [
        'low stock', 'deadstock', 'liquidation', 'adjusted stock', 
        'qr', 'product update', 'edit product', 'scan in', 
        'scan out', 'catalog', 'expiring', 'pos', 'sale', 'transaction'
      ];

      const matchesStaffCategory = staffKeywords.some(keyword => title.includes(keyword));
      return notif.forStaff === true || matchesStaffCategory;
    })
    .map(convertToNotification)
    .reduce((unique, notif) => {
      // Deduplicate: keep only the most recent notification per product and type
      const data = notif.data as any;
      const productId = data?.productId;
      const notifType = notif.title.toLowerCase();
      
      // Create a unique key for this notification
      const key = productId && notifType ? `${productId}-${notifType}` : notif.id;
      
      // Find if we already have this notification type for this product
      const existingIndex = unique.findIndex(n => {
        const existingData = n.data as any;
        const existingProductId = existingData?.productId;
        const existingType = n.title.toLowerCase();
        return existingProductId === productId && existingType === notifType;
      });
      
      if (existingIndex === -1) {
        // New notification, add it
        unique.push(notif);
      } else if (notif.timestamp > unique[existingIndex].timestamp) {
        // Existing notification is older, replace it with the newer one
        unique[existingIndex] = notif;
      }
      // Otherwise, keep the existing (newer) one
      
      return unique;
    }, [] as Notification[]);

  const unreadCount = filteredNotifications.filter(n => !n.read).length;

  useEffect(() => {
    if (appUser?.role) {
      const role = appUser.role.toLowerCase();
      if (role === 'admin' || role === 'staff') {
        setUserRole(role as 'admin' | 'staff');
      }
    }
  }, [appUser]);

  useEffect(() => {
    if (authLoading || !user) {
      setStoredNotifications([]);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const initialize = async () => {
      try {
        await notificationMigration.runMigrationIfNeeded();
        
        // Immediately fetch notifications to show them right away
        const initialNotifications = await notificationService.fetchNotifications();
        setStoredNotifications(initialNotifications);
        setIsLoading(false);
        
        // Setup real-time listener for live updates
        unsubscribe = notificationService.subscribe((notifications: StoredNotification[]) => {
          setStoredNotifications(notifications);
        });

        notificationService.cleanupOldNotifications();
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    
    initialize();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, authLoading]);

  const showNotification = useCallback(async (
    message: string, 
    type: NotificationType = 'success', 
    title?: string,
    link?: string,
    data?: NotificationData,
    forAdmin: boolean = true,
    forStaff: boolean = true,
    triggerEventId?: string,
    eventTimestamp?: Date,
    showToast: boolean = true
  ): Promise<string | null> => {
    
    // Check if it's an auth error to prevent saving to DB
    const blockedKeywords = ["login failed", "check your credentials", "firebase", "auth/"];
    const isBlocked = blockedKeywords.some(keyword => message.toLowerCase().includes(keyword));

    if (isBlocked) {
      if (showToast) {
        setToast({ message, type: 'error' });
        setTimeout(() => setToast(null), 4000);
      }
      return null; // Stop here, do not create Firestore document
    }

    const eventId = triggerEventId || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notificationTitle = title || getDefaultTitle(type);

    const existingNotification = storedNotifications.find(n => n.triggerEventId === eventId && !n.isResolved);
    if (existingNotification) return existingNotification.id;

    const notificationId = await notificationService.createNotification(
      notificationTitle,
      message,
      type,
      eventId,
      { link, data, forAdmin, forStaff, eventTimestamp }
    );

    if (showToast && notificationId) {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    }

    return notificationId;
  }, [storedNotifications]);

  const showToastOnly = useCallback((message: string, type: NotificationType = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await notificationService.markAsRead(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    const idsToMark = filteredNotifications.filter(n => !n.read).map(n => n.id);
    for (const id of idsToMark) {
      await notificationService.markAsRead(id);
    }
  }, [filteredNotifications]);

  const clearNotification = useCallback(async (id: string) => {
    await notificationService.deleteNotification(id);
  }, []);

  const resolveNotification = useCallback(async (triggerEventId: string) => {
    await notificationService.resolveNotification(triggerEventId);
  }, []);

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
      setUserRole,
      resolveNotification
    }}>
      {children}

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
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}