// src/app/(app)/layout.tsx
"use client";

import { Inter } from "next/font/google";
import "../../app/globals.css";
import NotificationProvider, { useNotification } from "@/components/NotificationProvider";
import { FirebaseProvider, useFirebase } from "@/context/FirebaseContext";
import Sidebar from "@/components/Sidebar";
import { useEffect, useRef, useCallback, useMemo } from "react";

const inter = Inter({ subsets: ["latin"] });

// Helper function to safely get date from Firestore Timestamp
const getDateFromTimestamp = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'object' && timestamp.toDate) return timestamp.toDate();
  if (timestamp?.seconds) return new Date(timestamp.seconds * 1000);
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (typeof timestamp === 'number') return new Date(timestamp);
  return null;
};

// Generate a unique event ID for duplicate prevention
const generateEventId = (type: string, id: string, eventDate: Date): string => {
  const dateStr = eventDate.toISOString().split('T')[0];
  return `${type}-${id}-${dateStr}`;
};

// Helper to get the actual event date when notification was triggered
const getEventDate = (product: any, type: string): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (type) {
    case 'low-stock':
    case 'out-of-stock':
      const updatedDate = getDateFromTimestamp(product.updatedAt);
      if (updatedDate) return updatedDate;
      break;
    case 'expiry':
      if (product.expiryDate) return new Date(product.expiryDate);
      break;
    case 'liquidation':
      const createdDate = getDateFromTimestamp(product.createdAt);
      if (createdDate) {
        const thirtyDaysLater = new Date(createdDate);
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
        return thirtyDaysLater;
      }
      break;
  }
  return new Date();
};

// Check if a product is recently added (within 24 hours)
const isRecentlyAdded = (product: any, today: Date): boolean => {
  const createdDate = getDateFromTimestamp(product.createdAt);
  if (!createdDate) return false;
  const hoursSinceCreation = (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  return hoursSinceCreation < 24;
};

// Calculate days since last sale for a product
const calculateDaysSinceSale = (product: any, transactions: any[], today: Date, creationDate: Date | null): number => {
  const lastSale = transactions
    .filter(t => t.status === 'completed' && t.items.some((item: any) => item.id === product.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  if (lastSale) {
    const lastSaleDate = new Date(lastSale.date);
    lastSaleDate.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
  } else if (creationDate) {
    creationDate.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  return 0;
};

// Inner component to access hooks
function AppContent({ children }: { children: React.ReactNode }) {
  const { products, transactions, userRole } = useFirebase();
  const { showNotification, resolveNotification, setUserRole, notifications } = useNotification();
  
  // Refs to prevent duplicate initialization and track processed events
  const initializedRef = useRef(false);
  const processingRef = useRef(false);
  const processedEventsRef = useRef<Set<string>>(new Set());
  const lastRunTimestampRef = useRef<number>(0);
  
  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cache for computed values to prevent recalculation
  const lowStockCacheRef = useRef<Map<string, boolean>>(new Map());
  const liquidationCacheRef = useRef<Map<string, number>>(new Map());
  const expiryCacheRef = useRef<Map<string, number>>(new Map());

  // Set user role in notification context
  useEffect(() => {
    if (userRole) {
      setUserRole(userRole === 'admin' ? 'admin' : 'staff');
    }
  }, [userRole, setUserRole]);

  // Memoize notification existence check
  const notificationExists = useCallback((productId: string, type: string): boolean => {
    return notifications.some(n => {
      const data = n.data as any;
      return data?.productId === productId && 
             n.title?.toLowerCase().includes(type.toLowerCase()) &&
             !n.isResolved;
    });
  }, [notifications]);

  // Pre-calculate creation dates for all products
  const productCreationDates = useMemo(() => {
    const map = new Map<string, Date | null>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const product of products) {
      const creationDate = getDateFromTimestamp(product.createdAt);
      map.set(product.id, creationDate);
    }
    return map;
  }, [products]);

  // Batch process all notification conditions
  const processNotifications = useCallback(async () => {
    // Prevent concurrent processing
    if (processingRef.current) return;
    
    // Debounce: Don't run more than once every 5 seconds
    const now = Date.now();
    if (now - lastRunTimestampRef.current < 5000) {
      // Schedule a delayed run if needed
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        processNotifications();
      }, 5000);
      return;
    }
    
    processingRef.current = true;
    lastRunTimestampRef.current = now;
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      console.log('🔔 Processing notification conditions (batched)...');
      console.log(`Products: ${products.length}, Transactions: ${transactions.length}, Existing Notifications: ${notifications.length}`);
      
      const notificationsToCreate: Array<{
        product: any;
        type: string;
        message: string;
        typeNotification: 'warning' | 'error' | 'info';
        eventDate: Date;
        eventId: string;
        link: string;
        data: any;
      }> = [];
      
      // Track products that need notifications
      const lowStockProducts: any[] = [];
      const outOfStockProducts: any[] = [];
      const liquidationProducts: any[] = [];
      const expiryProducts: any[] = [];
      
      // Pre-compute today's date for comparisons
      const todayStr = today.toISOString().split('T')[0];
      
      // Single pass through products to collect all conditions
      for (const product of products) {
        if (product.stock <= 0) continue;
        
        const isNew = isRecentlyAdded(product, today);
        if (isNew) continue; // Skip new products
        
        const creationDate = productCreationDates.get(product.id) || null;
        
        // Check low stock
        if (product.stock <= product.reorderPoint && product.stock > 0) {
          const cacheKey = `${product.id}-low-stock`;
          if (!lowStockCacheRef.current.has(cacheKey)) {
            lowStockCacheRef.current.set(cacheKey, true);
            lowStockProducts.push(product);
          }
        } else {
          // Clear cache if condition no longer applies
          lowStockCacheRef.current.delete(`${product.id}-low-stock`);
        }
        
        // Check out of stock
        if (product.stock <= 0) {
          const cacheKey = `${product.id}-out-of-stock`;
          if (!lowStockCacheRef.current.has(cacheKey)) {
            lowStockCacheRef.current.set(cacheKey, true);
            outOfStockProducts.push(product);
          }
        } else {
          lowStockCacheRef.current.delete(`${product.id}-out-of-stock`);
        }
        
        // Check liquidation (30+ days no sales)
        let cachedDays = liquidationCacheRef.current.get(product.id);
        if (cachedDays === undefined) {
          const daysSinceSale = calculateDaysSinceSale(product, transactions, today, creationDate);
          liquidationCacheRef.current.set(product.id, daysSinceSale);
          cachedDays = daysSinceSale;
        }
        
        if (cachedDays >= 30) {
          const cacheKey = `${product.id}-liquidation`;
          if (!lowStockCacheRef.current.has(cacheKey)) {
            lowStockCacheRef.current.set(cacheKey, true);
            liquidationProducts.push(product);
          }
        } else {
          lowStockCacheRef.current.delete(`${product.id}-liquidation`);
        }
        
        // Check expiry (if product has expiry date)
        if (product.expiryDate && product.stock > 0) {
          let cachedExpiry = expiryCacheRef.current.get(product.id);
          if (cachedExpiry === undefined) {
            const expiryDate = new Date(product.expiryDate);
            expiryDate.setHours(0, 0, 0, 0);
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            expiryCacheRef.current.set(product.id, daysUntilExpiry);
            cachedExpiry = daysUntilExpiry;
          }
          
          if (cachedExpiry <= 30 && cachedExpiry > 0) {
            const cacheKey = `${product.id}-expiry`;
            if (!lowStockCacheRef.current.has(cacheKey)) {
              lowStockCacheRef.current.set(cacheKey, true);
              expiryProducts.push(product);
            }
          } else {
            lowStockCacheRef.current.delete(`${product.id}-expiry`);
          }
        } else {
          expiryCacheRef.current.delete(product.id);
        }
      }
      
      // Process low stock notifications
      for (const product of lowStockProducts) {
        const eventDate = getEventDate(product, 'low-stock');
        const eventId = generateEventId('low-stock', product.id, eventDate);
        
        if (!processedEventsRef.current.has(eventId) && !notificationExists(product.id, 'low stock')) {
          processedEventsRef.current.add(eventId);
          notificationsToCreate.push({
            product,
            type: 'low-stock',
            message: `${product.name} is low on stock (${product.stock} left)`,
            typeNotification: 'warning',
            eventDate,
            eventId,
            link: '/inventory',
            data: {
              productId: product.id,
              productName: product.name,
              newStock: product.stock,
              reorderPoint: product.reorderPoint
            }
          });
        }
      }
      
      // Process out of stock notifications
      for (const product of outOfStockProducts) {
        const eventDate = getEventDate(product, 'out-of-stock');
        const eventId = generateEventId('out-of-stock', product.id, eventDate);
        
        if (!processedEventsRef.current.has(eventId) && !notificationExists(product.id, 'out of stock')) {
          processedEventsRef.current.add(eventId);
          notificationsToCreate.push({
            product,
            type: 'out-of-stock',
            message: `${product.name} is out of stock`,
            typeNotification: 'error',
            eventDate,
            eventId,
            link: '/inventory',
            data: {
              productId: product.id,
              productName: product.name,
              newStock: 0
            }
          });
        }
      }
      
      // Process liquidation notifications
      for (const product of liquidationProducts) {
        const eventDate = getEventDate(product, 'liquidation');
        const eventId = generateEventId('liquidation', product.id, eventDate);
        
        if (!processedEventsRef.current.has(eventId) && !notificationExists(product.id, 'liquidation')) {
          processedEventsRef.current.add(eventId);
          notificationsToCreate.push({
            product,
            type: 'liquidation',
            message: `${product.name} hasn't moved in 30+ days. Consider discounting to clear warehouse space.`,
            typeNotification: 'info',
            eventDate,
            eventId,
            link: '/reports',
            data: {
              productId: product.id,
              productName: product.name
            }
          });
        }
      }
      
      // Process expiry notifications
      for (const product of expiryProducts) {
        const expiryDate = new Date(product.expiryDate!);
        const daysUntilExpiry = expiryCacheRef.current.get(product.id) || 0;
        
        let message = '';
        let typeNotification: 'warning' | 'error' | 'info' = 'info';
        
        if (daysUntilExpiry <= 7) {
          message = `${product.name} expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}. URGENT action required!`;
          typeNotification = 'error';
        } else if (daysUntilExpiry <= 14) {
          message = `${product.name} expires in ${daysUntilExpiry} days. Plan clearance strategy.`;
          typeNotification = 'warning';
        } else {
          message = `${product.name} expires in ${daysUntilExpiry} days. Monitor closely.`;
          typeNotification = 'info';
        }
        
        const eventDate = expiryDate;
        const eventId = generateEventId('expiry', product.id, eventDate);
        
        if (!processedEventsRef.current.has(eventId) && !notificationExists(product.id, 'expiry')) {
          processedEventsRef.current.add(eventId);
          notificationsToCreate.push({
            product,
            type: 'expiry',
            message,
            typeNotification,
            eventDate,
            eventId,
            link: '/inventory',
            data: {
              productId: product.id,
              productName: product.name,
              expiryDate: product.expiryDate
            }
          });
        }
      }
      
      // Create all notifications in batch (they're created asynchronously but we don't await each)
      for (const notif of notificationsToCreate) {
        showNotification(
          notif.message,
          notif.typeNotification,
          notif.type === 'low-stock' ? 'Low Stock Alert' :
          notif.type === 'out-of-stock' ? 'Out of Stock Alert' :
          notif.type === 'liquidation' ? 'Liquidation Alert' : 'Expiry Alert',
          notif.link,
          notif.data,
          true,  // forAdmin
          true,  // forStaff
          notif.eventId,
          notif.eventDate,
          false  // DON'T show toast for existing conditions
        );
      }
      
      if (notificationsToCreate.length > 0) {
        console.log(`✅ Created ${notificationsToCreate.length} new notifications`);
      }
      
      // Resolve notifications for products that are no longer in alert state
      const notificationsToResolve: string[] = [];
      
      for (const notification of notifications) {
        if (notification.isResolved) continue;
        
        const data = notification.data as any;
        const productId = data?.productId;
        if (!productId) continue;
        
        const product = products.find(p => p.id === productId);
        
        // If product doesn't exist anymore, resolve the notification
        if (!product) {
          if (notification.triggerEventId) {
            notificationsToResolve.push(notification.triggerEventId);
          }
          continue;
        }
        
        // Check if condition is resolved
        let shouldResolve = false;
        
        if (notification.title.includes('Low Stock') && product.stock > product.reorderPoint) {
          shouldResolve = true;
        } else if (notification.title.includes('Out of Stock') && product.stock > 0) {
          shouldResolve = true;
        } else if (notification.title.includes('Liquidation')) {
          const daysSinceSale = calculateDaysSinceSale(product, transactions, today, productCreationDates.get(product.id) || null);
          if (daysSinceSale < 30) {
            shouldResolve = true;
          }
        } else if (notification.title.includes('Expiry') && product.expiryDate) {
          const expiryDate = new Date(product.expiryDate);
          expiryDate.setHours(0, 0, 0, 0);
          if (expiryDate < today) {
            shouldResolve = true;
          }
        }
        
        if (shouldResolve && notification.triggerEventId) {
          notificationsToResolve.push(notification.triggerEventId);
        }
      }
      
      // Batch resolve notifications
      for (const triggerEventId of notificationsToResolve) {
        resolveNotification(triggerEventId);
        // Also remove from processed events set to allow re-creation if needed
        processedEventsRef.current.delete(triggerEventId);
      }
      
      if (notificationsToResolve.length > 0) {
        console.log(`✅ Resolved ${notificationsToResolve.length} notifications`);
      }
      
      // Clean up old processed events (older than 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      for (const eventId of processedEventsRef.current) {
        const eventDateMatch = eventId.match(/\d{4}-\d{2}-\d{2}$/);
        if (eventDateMatch) {
          const eventDate = new Date(eventDateMatch[0]);
          if (eventDate < sevenDaysAgo) {
            processedEventsRef.current.delete(eventId);
          }
        }
      }
      
    } catch (error) {
      console.error('Error processing notifications:', error);
    } finally {
      processingRef.current = false;
    }
  }, [products, transactions, showNotification, resolveNotification, notifications, notificationExists, productCreationDates]);
  
  // Debounced version of processNotifications
  const debouncedProcessNotifications = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      processNotifications();
    }, 1000); // 1 second debounce
  }, [processNotifications]);
  
  // Initial run and run when data changes (with debounce)
  useEffect(() => {
    // Prevent running multiple times on initial load
    if (!initializedRef.current && (products.length > 0 || transactions.length > 0)) {
      initializedRef.current = true;
      // Small delay to allow everything to settle
      const timer = setTimeout(() => {
        processNotifications();
      }, 2000);
      return () => clearTimeout(timer);
    }
    
    // Debounced run for data changes
    if (initializedRef.current) {
      debouncedProcessNotifications();
    }
    
    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [products, transactions, debouncedProcessNotifications, processNotifications]);
  
  // Clear caches when products or transactions change significantly
  useEffect(() => {
    // Clear caches when data changes
    lowStockCacheRef.current.clear();
    liquidationCacheRef.current.clear();
    expiryCacheRef.current.clear();
  }, [products.length, transactions.length]);
  
  return <>{children}</>;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={inter.className}>
      <NotificationProvider>
        <FirebaseProvider>
          <div className="min-h-screen bg-gray-100">
            <Sidebar>
              <AppContent>{children}</AppContent>
            </Sidebar>
          </div>
        </FirebaseProvider>
      </NotificationProvider>
    </div>
  );
}