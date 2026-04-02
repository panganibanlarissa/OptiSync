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
  const { products, transactions } = useFirebase();
  const { showNotification } = useNotification();
  const notifiedItemsRef = useRef<Set<string>>(new Set());

  // Check for specialized inventory alerts
  useEffect(() => {
    if (products && products.length > 0) {
      const today = new Date();
      
      // 1. LIQUIDATION ALERTS (Aging products - no sales in 30+ days)
      const liquidationItems = products.filter(p => {
        if (p.stock <= 0) return false;
        
        const lastSale = transactions
          .filter(t => t.status === 'completed' && t.items.some(item => item.name === p.name))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        const lastSaleDate = lastSale ? new Date(lastSale.date) : new Date(0);
        const daysSinceSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        
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
      // Note: In a real system, you'd have an 'expiryDate' field.
      // Here we simulate by highlighting Solutions/Contact Lenses that are older than 6 months.
      const expiryItems = products.filter(p => {
        if (p.stock <= 0) return false;
        const perishableCategories = ['Solutions', 'Contact Lenses'];
        if (!perishableCategories.includes(p.category)) return false;
        
        const creationDate = (p.createdAt as any)?.toDate ? (p.createdAt as any).toDate() : new Date(typeof p.createdAt === 'number' ? p.createdAt : 0);
        const monthsInStock = (today.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        
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