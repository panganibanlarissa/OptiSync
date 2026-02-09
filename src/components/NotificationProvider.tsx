"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

// --- TYPES ---
type NotificationType = 'success' | 'error';

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
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
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
    // Auto-hide after 3 seconds
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      
      {/* GLOBAL TOAST UI */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border border-white/50 backdrop-blur-md ${
              notification.type === 'success' ? 'bg-white text-slate-800' : 'bg-red-50 text-red-800'
            }`}
          >
            <div className={`p-1 rounded-full ${
              notification.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
                {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div className="text-sm font-medium pr-2">{notification.message}</div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}