// src/app/(app)/layout.tsx
"use client";

import { Inter } from "next/font/google";
import "../../app/globals.css";
import NotificationProvider from "@/components/NotificationProvider";
import { FirebaseProvider } from "@/context/FirebaseContext";
import Sidebar from "@/components/Sidebar";
import { useFirebase } from "@/context/FirebaseContext";
import { useNotification } from "@/components/NotificationProvider";
import { useEffect, useRef } from "react";

const inter = Inter({ subsets: ["latin"] });

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

// Inner component to access hooks
function AppContent({ children }: { children: React.ReactNode }) {
  const { products, transactions } = useFirebase();
  const { showNotification } = useNotification();
  const notifiedItemsRef = useRef<Set<string>>(new Set());

  // Check for specialized inventory alerts
  useEffect(() => {
    if (products && products.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Helper function to check if product is recently added (within last 24 hours)
      const isRecentlyAdded = (product: any) => {
        const createdDate = getDateFromTimestamp(product.createdAt);
        if (!createdDate) return false;
        
        const hoursSinceCreation = (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
        return hoursSinceCreation < 24; // Product added within last 24 hours
      };
      
      // 1. LIQUIDATION ALERTS (Aging products - no sales in 30+ days)
      // EXCLUDE recently added products (within 24 hours)
      const liquidationItems = products.filter(p => {
        if (p.stock <= 0) return false;
        
        // Skip recently added products - they shouldn't trigger deadstock alerts
        if (isRecentlyAdded(p)) {
          console.log(`Skipping liquidation alert for recently added product: ${p.name}`);
          return false;
        }
        
        const lastSale = transactions
          .filter(t => t.status === 'completed' && t.items.some((item: any) => item.id === p.id || item.name === p.name))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        let daysSinceSale = 0;
        
        if (lastSale) {
          const lastSaleDate = new Date(lastSale.date);
          lastSaleDate.setHours(0, 0, 0, 0);
          daysSinceSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          // If never sold, use creation date
          const createdDate = getDateFromTimestamp(p.createdAt);
          if (createdDate) {
            createdDate.setHours(0, 0, 0, 0);
            daysSinceSale = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        }
        
        return daysSinceSale >= 30;
      });

      liquidationItems.forEach(item => {
        const key = `liquid-${item.id}`;
        if (!notifiedItemsRef.current.has(key)) {
          showNotification(
            `📦 ${item.name} hasn't moved in 30+ days. Consider discounting to clear warehouse space.`,
            "info",
            "Liquidation Alert",
            "/reports"
          );
          notifiedItemsRef.current.add(key);
        }
      });

      // 2. EXPIRY ALERTS (Simulated for this workspace - using specific categories/tags)
      const expiryItems = products.filter(p => {
        if (p.stock <= 0) return false;
        
        // Skip recently added products
        if (isRecentlyAdded(p)) return false;
        
        const perishableCategories = ['Solutions', 'Contact Lenses'];
        if (!perishableCategories.includes(p.category)) return false;
        
        const createdDate = getDateFromTimestamp(p.createdAt);
        if (!createdDate) return false;
        
        const monthsInStock = (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        
        return monthsInStock >= 6;
      });

      expiryItems.forEach(item => {
        const key = `expiry-${item.id}`;
        if (!notifiedItemsRef.current.has(key)) {
          showNotification(
            `⏰ ${item.name} is nearing simulated shelf-life limits. Check physical expiry date.`,
            "warning",
            "Expiry Alert",
            "/inventory"
          );
          notifiedItemsRef.current.add(key);
        }
      });

      const lowStockItems = products.filter(p => p.stock <= p.reorderPoint && p.stock > 0);
      const outOfStockItems = products.filter(p => p.stock <= 0);
      
      // Track items we've already notified to avoid spam
      const currentNotified = new Set<string>();
      
      // Notify for low stock items
      lowStockItems.forEach(item => {
        const key = `low-${item.id}`;
        currentNotified.add(key);
        
        if (!notifiedItemsRef.current.has(key)) {
          showNotification(
            `⚠️ ${item.name} is low on stock (${item.stock} left)`,
            "warning",
            "Low Stock Alert",
            "/inventory"
          );
          notifiedItemsRef.current.add(key);
        }
      });
      
      // Notify for out of stock items
      outOfStockItems.forEach(item => {
        const key = `out-${item.id}`;
        currentNotified.add(key);
        
        if (!notifiedItemsRef.current.has(key)) {
          showNotification(
            `❌ ${item.name} is out of stock`,
            "error",
            "Out of Stock Alert",
            "/inventory"
          );
          notifiedItemsRef.current.add(key);
        }
      });
      
      // Clean up old notifications for items that are no longer in alert state
      notifiedItemsRef.current.forEach(key => {
        const [type, id] = key.split('-');
        const product = products.find(p => p.id === id);
        
        if (type === 'low' && product && (product.stock > product.reorderPoint || product.stock <= 0)) {
          notifiedItemsRef.current.delete(key);
        } else if (type === 'out' && product && product.stock > 0) {
          notifiedItemsRef.current.delete(key);
        } else if (type === 'liquid' && product) {
          // Remove liquidation alert if product is no longer in liquidation state
          if (product.stock <= 0) {
            notifiedItemsRef.current.delete(key);
          }
        }
      });
    }
  }, [products, transactions, showNotification]);

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