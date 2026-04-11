// src/components/ExpiryAlert.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/context/FirebaseContext';
import { AlertTriangle, Package, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExpiringProduct {
  id: string;
  name: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  stock: number;
  category: string;
}

export default function ExpiryAlert() {
  const { products } = useFirebase();
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiring = products
      .filter(p => p.expiryDate && p.stock > 0)
      .map(p => {
        const expiryDate = new Date(p.expiryDate!);
        expiryDate.setHours(0, 0, 0, 0);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: p.id,
          name: p.name,
          expiryDate: expiryDate,
          daysUntilExpiry,
          stock: p.stock,
          category: p.category,
        };
      })
      .filter(p => p.daysUntilExpiry <= 30 && p.daysUntilExpiry > 0)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    setExpiringProducts(expiring);
  }, [products]);

  const dismissProduct = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  const getAlertColor = (days: number) => {
    if (days <= 7) return 'bg-red-50 border-red-200 text-red-700';
    if (days <= 14) return 'bg-orange-50 border-orange-200 text-orange-700';
    return 'bg-yellow-50 border-yellow-200 text-yellow-700';
  };

  const visibleProducts = expiringProducts.filter(p => !dismissed.has(p.id));

  if (visibleProducts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {visibleProducts.slice(0, 3).map((product) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className={`p-3 rounded-lg shadow-lg border ${getAlertColor(product.daysUntilExpiry)} max-w-sm`}
          >
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-white/50 rounded-full">
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{product.name}</p>
                <p className="text-xs opacity-90">
                  Expires in {product.daysUntilExpiry} days • {product.stock} units left
                </p>
                <p className="text-xs font-medium mt-1">
                  {product.daysUntilExpiry <= 7 
                    ? 'URGENT: Immediate action required!' 
                    : product.daysUntilExpiry <= 14 
                    ? 'Run a promotion to clear stock'
                    : 'Plan markdown strategy'}
                </p>
              </div>
              <button
                onClick={() => dismissProduct(product.id)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}