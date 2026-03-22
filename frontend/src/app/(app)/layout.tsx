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

// Inner component to access hooks
function AppContent({ children }: { children: React.ReactNode }) {
  const { products } = useFirebase();
  const { showNotification } = useNotification();
  const notifiedItemsRef = useRef<Set<string>>(new Set());

  // Check for low stock and out of stock items when products change
  useEffect(() => {
    if (products && products.length > 0) {
      const lowStockItems = products.filter(p => p.stock <= p.reorderPoint && p.stock > 0);
      const outOfStockItems = products.filter(p => p.stock <= 0);
      
      // Track items we've already notified to avoid spam
      const currentNotified = new Set<string>();
      
      // Notify for low stock items
      lowStockItems.forEach(item => {
        const key = `low-${item.id}`;
        currentNotified.add(key);
        
        // Only notify if we haven't notified for this item in this session
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
        
        // Only notify if we haven't notified for this item in this session
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
        }
      });
    }
  }, [products, showNotification]);

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