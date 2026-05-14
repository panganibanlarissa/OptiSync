// src/app/(app)/sales/page.tsx

"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useNotification } from "@/components/NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";
import Image from "next/image";
import QRScannerModal from "@/components/QRScannerModal";
import ReplacementRequestModal from "@/components/ReplacementRequestModal";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  User,
  CheckCircle2,
  X,
  AlertTriangle,
  Receipt,
  History,
  Search,
  Wifi,
  WifiOff,
  RefreshCcw,
  Glasses,
  Calendar,
  QrCode,
  Banknote,
  CreditCard,
  Shield,
  Clock,
  Repeat,
  CheckCheck,
  Eye,
  Phone,
  CalendarDays
} from "lucide-react";
import { Timestamp } from "firebase/firestore";

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";
const DEADSTOCK_DAYS_THRESHOLD = 30;

const toValidDate = (value: unknown): Date | null => {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value);
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (value && typeof value === "object" && "toDate" in value && typeof (value as any).toDate === "function") {
    const parsed = (value as any).toDate();
    if (parsed instanceof Date && !isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  imageColor: string;
  image: string | null;
  baseCost: number;
  markupPrice: number;
  supplierInfo: string;
  lastMovedDaysAgo: number;
  leadTimeDays: number;
  reorderPoint: number;
  specifications: string;
  totalSold?: number;
  damageExchanged?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  availableStock?: number;
  archived?: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  imageColor: string;
}

interface Transaction {
  id: string;
  patientName: string;
  contactNumber?: string;
  idType?: string;
  idNumber?: string;
  items: CartItem[];
  subtotal?: number;
  discountType?: "none" | "loyalty" | "pwd";
  discountPercentage?: number;
  discountAmount?: number;
  total: number;
  date: Date;
  status: "completed" | "processing_replacement" | "replaced";
  synced: boolean;
  staffName?: string;
  staffId?: string;
  createdAt?: Timestamp;
  paymentMethod?: "cash" | "online";
  amountReceive?: number;
  change?: number;
  warrantyStartDate?: Date | string;
  warrantyEndDate?: Date | string;
  referenceNumber?: string;
  replacementReason?: string;
  replacedAt?: Date;
  replacedBy?: string;
  processedAt?: Date;
  processedBy?: string;
  // Replacement request fields
  replacementRequestId?: string;
  replacementRequestedAt?: Date;
  replacementRequestedBy?: string;
  replacementApprovedAt?: Date;
  replacementApprovedBy?: string;
  replacementRejectedAt?: Date;
  replacementRejectedBy?: string;
  replacementRejectionReason?: string;
}

const normalizeDiscountPercentage = (raw?: number): number => {
  if (typeof raw !== "number" || Number.isNaN(raw) || raw <= 0) return 0;
  return raw > 1 ? raw / 100 : raw;
};

const shouldShowTransactionDiscount = (trx: Transaction): trx is Transaction & { discountAmount: number } => {
  return typeof trx.discountAmount === "number" && trx.discountAmount > 0;
};

const CATEGORIES = ["All", "Frames", "Solutions", "Accessories", "Vitamins"];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

const isWarrantyValid = (transaction: Transaction): boolean => {
  if (transaction.status === "replaced") return false;
  const { warrantyStartDate, warrantyEndDate } = transaction;
  if (!warrantyStartDate || !warrantyEndDate) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startDate = new Date(warrantyStartDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(warrantyEndDate);
  endDate.setHours(23, 59, 59, 999);
  return today >= startDate && today <= endDate;
};

const getWarrantyStatus = (transaction: Transaction): { active: boolean; text: string; color: string } => {
  if (transaction.status === "replaced") {
    return { active: false, text: "Expired (Replaced)", color: "text-red-600" };
  }
  const { warrantyStartDate, warrantyEndDate } = transaction;
  if (!warrantyStartDate || !warrantyEndDate) {
    return { active: false, text: "No Warranty", color: "text-gray-500" };
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startDate = new Date(warrantyStartDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(warrantyEndDate);
  endDate.setHours(23, 59, 59, 999);
  const isActive = today >= startDate && today <= endDate;
  return {
    active: isActive,
    text: isActive ? "Active" : "Expired",
    color: isActive ? "text-emerald-700" : "text-red-600"
  };
};

const formatWarrantyRange = (startDate?: Date | string, endDate?: Date | string): string => {
  if (!startDate || !endDate) return "No warranty";
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
};

const formatDateTime = (date?: Date | string | null): string => {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function SalesPage() {
  const { showNotification, showToastOnly } = useNotification();
  const {
    products: firebaseProducts,
    transactions: firebaseTransactions,
    addTransaction,
    processReplacement,
    markReplacementAsCompleted,
    updateProduct,
    isOnline,
    userName,
    userRole,
    userId,
    replacementRequests,
    fetchReplacementRequests
  } = useFirebase();

  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [syncing, setSyncing] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientName, setPatientName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [tempReservedStock, setTempReservedStock] = useState<Map<string, number>>(new Map());
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [replacementModalOpen, setReplacementModalOpen] = useState(false);
  const [completeReplacementModalOpen, setCompleteReplacementModalOpen] = useState(false);
  const [viewTransactionModalOpen, setViewTransactionModalOpen] = useState(false);
  const [transactionToReplace, setTransactionToReplace] = useState<Transaction | null>(null);
  const [transactionToComplete, setTransactionToComplete] = useState<Transaction | null>(null);
  const [transactionToView, setTransactionToView] = useState<Transaction | null>(null);
  const [replacementReason, setReplacementReason] = useState<string>("");
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [amountReceive, setAmountReceive] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [viewByMonth, setViewByMonth] = useState<boolean>(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<"all" | "completed" | "processing_replacement" | "replaced">("all");
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [warrantyStartDate, setWarrantyStartDate] = useState<string>("");
  const [warrantyEndDate, setWarrantyEndDate] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [showOnlineConfirm, setShowOnlineConfirm] = useState(false);
  const [discountType, setDiscountType] = useState<"none" | "loyalty" | "pwd">("none");
  const [showReplacementRequestModal, setShowReplacementRequestModal] = useState(false);
  const [transactionForReplacementRequest, setTransactionForReplacementRequest] = useState<Transaction | null>(null);

  const searchParams = useSearchParams();

  // Fetch replacement requests for checking pending status
  useEffect(() => {
    if (userRole === "admin") {
      fetchReplacementRequests(false);
    }
  }, [userRole, fetchReplacementRequests]);

  const activeProducts = useMemo(() => {
    return (firebaseProducts as Product[]).filter(product => !product.archived);
  }, [firebaseProducts]);

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    (firebaseTransactions as Transaction[]).forEach(transaction => {
      let transactionDate: Date;
      if (transaction.date instanceof Date) {
        transactionDate = transaction.date;
      } else if (typeof transaction.date === 'string') {
        transactionDate = new Date(transaction.date);
      } else if (transaction.date && typeof transaction.date === 'object' && 'toDate' in transaction.date) {
        transactionDate = (transaction.date as any).toDate();
      } else {
        return;
      }
      const year = transactionDate.getFullYear();
      const month = transactionDate.getMonth();
      const monthKey = `${year}-${month}`;
      monthsSet.add(monthKey);
    });
    
    const sortedMonths = Array.from(monthsSet).sort((a: string, b: string) => {
      const [yearA, monthA] = a.split('-').map(Number);
      const [yearB, monthB] = b.split('-').map(Number);
      if (yearA !== yearB) return yearB - yearA;
      return monthB - monthA;
    });
    
    return sortedMonths.map((key: string) => {
      const [year, month] = key.split('-').map(Number);
      return { key, display: `${monthNames[month]} ${year}` };
    });
  }, [firebaseTransactions]);

  useEffect(() => {
    if (viewByMonth && availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0].key);
    }
  }, [viewByMonth, availableMonths, selectedMonth]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'history') {
      setActiveTab('history');
    }
  }, [searchParams]);

  const filteredTransactions = useMemo(() => {
    return (firebaseTransactions as Transaction[]).filter(transaction => {
      if (transactionStatusFilter !== "all" && transaction.status !== transactionStatusFilter) {
        return false;
      }
      
      let transactionDate: Date;
      if (transaction.date instanceof Date) {
        transactionDate = transaction.date;
      } else if (typeof transaction.date === 'string') {
        transactionDate = new Date(transaction.date);
      } else if (transaction.date && typeof transaction.date === 'object' && 'toDate' in transaction.date) {
        transactionDate = (transaction.date as any).toDate();
      } else {
        return false;
      }
      
      if (viewByMonth) {
        if (!selectedMonth) return true;
        const [selectedYear, selectedMonthIndex] = selectedMonth.split('-').map(Number);
        const transactionYear = transactionDate.getFullYear();
        const transactionMonth = transactionDate.getMonth();
        return transactionYear === selectedYear && transactionMonth === selectedMonthIndex;
      } else {
        const year = transactionDate.getFullYear();
        const month = String(transactionDate.getMonth() + 1).padStart(2, '0');
        const day = String(transactionDate.getDate()).padStart(2, '0');
        const transactionDateStr = `${year}-${month}-${day}`;
        return transactionDateStr === filterDate;
      }
    });
  }, [firebaseTransactions, filterDate, viewByMonth, transactionStatusFilter, selectedMonth]);

  const productsWithAvailableStock = useMemo(() => {
    return activeProducts.map(product => ({
      ...product,
      availableStock: Math.max(0, product.stock - (tempReservedStock.get(product.id) || 0))
    }));
  }, [activeProducts, tempReservedStock]);

  const filteredProducts = productsWithAvailableStock.filter((product) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = product.name?.toLowerCase().includes(searchLower) || product.sku?.toLowerCase().includes(searchLower);
    const matchesCategory = selectedCategory === "All" || product.category?.trim().toLowerCase() === selectedCategory.trim().toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const deadstockProductIds = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastCompletedSaleByProduct = new Map<string, Date>();
    
    (firebaseTransactions as Transaction[]).forEach((transaction) => {
      if (transaction.status !== "completed") return;
      const transactionDate = toValidDate((transaction as any).date);
      if (!transactionDate) return;
      transactionDate.setHours(0, 0, 0, 0);
      transaction.items?.forEach((item) => {
        const previous = lastCompletedSaleByProduct.get(item.id);
        if (!previous || transactionDate > previous) {
          lastCompletedSaleByProduct.set(item.id, new Date(transactionDate));
        }
      });
    });
    
    const deadstockIds = new Set<string>();
    activeProducts.forEach((product) => {
      if (product.archived || product.stock <= 0) return;
      let referenceDate = lastCompletedSaleByProduct.get(product.id) ?? null;
      if (!referenceDate) {
        referenceDate = toValidDate((product as any).createdAt);
      }
      if (!referenceDate) {
        if ((product.lastMovedDaysAgo || 0) >= DEADSTOCK_DAYS_THRESHOLD) {
          deadstockIds.add(product.id);
        }
        return;
      }
      referenceDate.setHours(0, 0, 0, 0);
      const daysSince = Math.floor((today.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= DEADSTOCK_DAYS_THRESHOLD) {
        deadstockIds.add(product.id);
      }
    });
    return deadstockIds;
  }, [activeProducts, firebaseTransactions]);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const getDiscountPercentage = (): number => {
    switch (discountType) {
      case "loyalty": return 0.30;
      case "pwd": return 0.20;
      default: return 0;
    }
  };

  const discountPercentage = getDiscountPercentage();
  const discountAmount = subtotal * discountPercentage;
  const total = subtotal - discountAmount;

  const handleAddToCartClick = (product: Product) => {
    if (product.archived) {
      showToastOnly(`❌ ${product.name} is archived and cannot be sold`, "error");
      return;
    }
    const currentReserved = tempReservedStock.get(product.id) || 0;
    const actualStock = product.stock;
    const availableForThis = actualStock - currentReserved;
    if (availableForThis <= 0) {
      showToastOnly(`❌ ${product.name} is out of stock`, "error");
      return;
    }
    setPendingProduct(product);
    setShowAddToCartModal(true);
  };

  const confirmAddToCart = () => {
    if (pendingProduct) {
      if (pendingProduct.archived) {
        showToastOnly(`❌ ${pendingProduct.name} is archived and cannot be sold`, "error");
        setShowAddToCartModal(false);
        setPendingProduct(null);
        return;
      }
      
      const currentReserved = tempReservedStock.get(pendingProduct.id) || 0;
      const actualStock = pendingProduct.stock;
      const availableForThis = actualStock - currentReserved;
      
      if (availableForThis <= 0) {
        showToastOnly(`❌ ${pendingProduct.name} is out of stock`, "error");
        setShowAddToCartModal(false);
        setPendingProduct(null);
        return;
      }
      
      setTempReservedStock(prev => {
        const newMap = new Map(prev);
        newMap.set(pendingProduct.id, (prev.get(pendingProduct.id) || 0) + 1);
        return newMap;
      });
      
      setCart(prev => {
        const existing = prev.find(item => item.id === pendingProduct.id);
        if (existing) {
          return prev.map(item =>
            item.id === pendingProduct.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return [...prev, {
          id: pendingProduct.id,
          name: pendingProduct.name,
          price: pendingProduct.markupPrice,
          quantity: 1,
          image: pendingProduct.image,
          imageColor: pendingProduct.imageColor
        }];
      });
      
      showToastOnly(`✓ ${pendingProduct.name} added to cart`, "success");
      setShowAddToCartModal(false);
      setPendingProduct(null);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prevCart => {
      const item = prevCart.find(i => i.id === id);
      if (!item) return prevCart;
      
      const newQty = item.quantity + delta;
      if (newQty < 1) return prevCart;
      
      const product = activeProducts.find(p => p.id === id);
      if (!product) return prevCart;
      
      const currentReservedForOthers = prevCart
        .filter(i => i.id !== id)
        .reduce((sum, i) => sum + i.quantity, 0);
      
      if (delta > 0 && (currentReservedForOthers + newQty) > product.stock) {
        showToastOnly(`Cannot exceed available stock! Only ${product.stock - currentReservedForOthers} left`, "error");
        return prevCart;
      }
      
      setTempReservedStock(prevMap => {
        const newMap = new Map(prevMap);
        if (newQty === 0) {
          newMap.delete(id);
        } else {
          newMap.set(id, newQty);
        }
        return newMap;
      });
      
      return prevCart.map(cartItem =>
        cartItem.id === id ? { ...cartItem, quantity: newQty } : cartItem
      );
    });
  };

  const removeFromCart = (id: string) => {
    setTempReservedStock(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setTempReservedStock(new Map());
    setPatientName("");
    setContactNumber("");
    setIdType("");
    setIdNumber("");
    setPaymentMethod("cash");
    setAmountReceive("");
    setWarrantyStartDate("");
    setWarrantyEndDate("");
    setReferenceNumber("");
    setDiscountType("none");
  };

  const processCheckout = async (paymentMethodToUse: "cash" | "online", amountReceivedForCash?: number) => {
    if (isProcessingCheckout) return;
    setIsProcessingCheckout(true);
    
    try {
      const currentUser = {
        name: userName || "Staff",
        id: userId || "staff-unknown",
        role: userRole || "staff"
      };
      
      const productsBecomingOutOfStock: Array<{ name: string; id: string }> = [];
      
      const newTransactionData: any = {
        patientName: patientName || "Walk-in Patient",
        contactNumber: contactNumber || "",
        items: cart,
        subtotal: subtotal,
        discountType: discountType,
        discountPercentage: discountPercentage,
        discountAmount: discountAmount,
        total: total,
        date: new Date(),
        status: "completed" as const,
        synced: isOnline,
        staffName: currentUser.name,
        staffId: currentUser.id,
        paymentMethod: paymentMethodToUse,
      };
      
      // Only add ID fields if discount type is "pwd" (PWD/Senior)
      if (discountType === "pwd") {
        newTransactionData.idType = idType || "";
        newTransactionData.idNumber = idNumber || "";
      }
      
      if (paymentMethodToUse === "cash" && amountReceivedForCash !== undefined) {
        newTransactionData.amountReceive = amountReceivedForCash;
        newTransactionData.change = amountReceivedForCash - total;
      }
      
      if (paymentMethodToUse === "online" && referenceNumber.trim()) {
        newTransactionData.referenceNumber = referenceNumber;
      }
      
      if (warrantyStartDate && warrantyEndDate) {
        newTransactionData.warrantyStartDate = new Date(warrantyStartDate);
        newTransactionData.warrantyEndDate = new Date(warrantyEndDate);
      }
      
      const transactionId = await addTransaction(newTransactionData);
      if (!transactionId) throw new Error("Failed to create transaction");
      
      for (const cartItem of cart) {
        const product = activeProducts.find(p => p.id === cartItem.id);
        if (product) {
          const newStock = product.stock - cartItem.quantity;
          const currentTotalSold = (product as any).totalSold || 0;
          const newTotalSold = currentTotalSold + cartItem.quantity;
          
          await updateProduct(product.id, {
            stock: newStock,
            totalSold: newTotalSold,
            lastMovedDaysAgo: 0
          });
          
          if (newStock <= 0) {
            productsBecomingOutOfStock.push({ name: product.name, id: product.id });
          }
          
          if (newStock <= product.reorderPoint && newStock > 0) {
            showNotification(
              `⚠️ ${product.name} is now low stock (${newStock} left)`,
              "warning",
              "Low Stock Alert",
              "/inventory",
              { productId: product.id, productName: product.name, newStock, reorderPoint: product.reorderPoint },
              true, true
            );
          }
        }
      }
      
      const newTransaction: Transaction = { id: transactionId, ...newTransactionData };
      const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
      
      showNotification(
        `Order completed: ${itemCount} item${itemCount !== 1 ? 's' : ''} for ₱${total.toLocaleString()}`,
        "success", "Sale Completed", `/sales?transaction=${transactionId}`,
        {
          transactionId,
          receiptNumber: transactionId.slice(-8).toUpperCase(),
          patientName: patientName || "Walk-in Patient",
          contactNumber: contactNumber || "",
          itemCount,
          total,
          items: cart,
          staffName: currentUser.name,
          staffId: currentUser.id
        },
        false, true
      );
      
      if (userRole === 'admin') {
        showNotification(
          `🧑‍💼 ${currentUser.name} completed a sale: ₱${total.toLocaleString()} (${itemCount} items)`,
          "info",
          "Admin Transaction",
          `/sales?transaction=${transactionId}`,
          {
            transactionId,
            receiptNumber: transactionId.slice(-8).toUpperCase(),
            patientName: patientName || "Walk-in Patient",
            contactNumber: contactNumber || "",
            itemCount,
            total,
            staffName: currentUser.name,
            staffId: currentUser.id
          },
          true, false
        );
      }
      
      for (const outOfStockProduct of productsBecomingOutOfStock) {
        showNotification(
          `❌ ${outOfStockProduct.name} is now out of stock`,
          "error", "Out of Stock Alert", "/inventory",
          { productId: outOfStockProduct.id, productName: outOfStockProduct.name, newStock: 0 },
          true, true
        );
      }
      
      setLastTransaction(newTransaction);
      clearCart();
      setShowCheckoutModal(true);
      
    } catch (error) {
      console.error("Checkout error:", error);
      showToastOnly("Failed to complete transaction. Please try again.", "error");
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const [showCashConfirm, setShowCashConfirm] = useState(false);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToastOnly("Cart is empty", "error");
      return;
    }
    
    if (paymentMethod === "cash") {
      if (!amountReceive.trim()) {
        showToastOnly("Please enter the amount receive", "error");
        return;
      }
      
      const parsedAmountReceive = parseFloat(amountReceive);
      if (isNaN(parsedAmountReceive) || parsedAmountReceive < total) {
        showToastOnly("Amount receive must be at least ₱" + total.toLocaleString(), "error");
        return;
      }
      setShowCashConfirm(true);
    } else if (paymentMethod === "online") {
      setShowOnlineConfirm(true);
    }
  };

  const handleConfirmCashPayment = async () => {
    setShowCashConfirm(false);
    const parsedAmountReceive = parseFloat(amountReceive);
    await processCheckout("cash", parsedAmountReceive);
  };

  const handleConfirmOnlinePayment = async () => {
    setShowOnlineConfirm(false);
    await processCheckout("online");
  };

  const toggleNetwork = () => {
    if (!isOnline) {
      setSyncing(true);
      setTimeout(() => {
        setSyncing(false);
        showToastOnly("All offline transactions synced with server.", "success");
      }, 1500);
    } else {
      showToastOnly("You are online. Transactions will sync in real-time.", "success");
    }
  };

  const generateReceipt = (trx: Transaction) => {
    const receiptId = trx.id ? trx.id.slice(-8).toUpperCase() : 'UNKNOWN';
    const itemCount = trx.items.length;
    const estimatedHeight = 80 + (itemCount * 10);
    const doc = new jsPDF('p', 'mm', [80, Math.max(150, estimatedHeight)]);
    const pageWidth = 80;
    let currentY = 5;
    const leftMargin = 3;
    const rightMargin = 3;

    const drawDashedDivider = (y: number) => {
      doc.setDrawColor(150, 150, 150);
      let x = leftMargin;
      const dashWidth = 1.5;
      const gapWidth = 1;
      while (x < pageWidth - rightMargin) {
        doc.line(x, y, x + dashWidth, y);
        x += dashWidth + gapWidth;
      }
    };

    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text("M.T. OLASO OPTICAL", pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;

    doc.setFontSize(6.5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text("Address: 43 Magsaysay Drive", pageWidth / 2, currentY, { align: 'center' });
    currentY += 2.5;
    doc.text("Olongapo, Philippines, 2200", pageWidth / 2, currentY, { align: 'center' });
    currentY += 2.5;
    doc.text("Tel. 0922 825 4918", pageWidth / 2, currentY, { align: 'center' });
    currentY += 3;

    drawDashedDivider(currentY);
    currentY += 3;

    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const paymentType = trx.paymentMethod === 'cash' ? 'CASH RECEIPT' : 'ONLINE RECEIPT';
    doc.text(paymentType, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;

    drawDashedDivider(currentY);
    currentY += 3;

    doc.setFontSize(6);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const receiptDate = new Date(trx.date);
    const dateStr = receiptDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
    const timeStr = receiptDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    doc.text(`Receipt: ${receiptId}  ${dateStr} ${timeStr}`, leftMargin, currentY);
    currentY += 2.5;

    if (trx.staffName) {
      doc.text(`Cashier: ${trx.staffName}`, leftMargin, currentY);
      currentY += 2.5;
    }

    doc.text(`Customer: ${trx.patientName}`, leftMargin, currentY);
    currentY += 2.5;
    
    if (trx.contactNumber) {
      doc.text(`Contact: ${trx.contactNumber}`, leftMargin, currentY);
      currentY += 2.5;
    }
    
    if (trx.discountType === "pwd" && trx.idType && trx.idNumber) {
      doc.text(`${trx.idType} ID: ${trx.idNumber}`, leftMargin, currentY);
      currentY += 2.5;
    }
    
    currentY += 0.5;

    drawDashedDivider(currentY);
    currentY += 2.5;

    doc.setFontSize(6);
    doc.setFont('Helvetica', 'bold');
    doc.text('Description', leftMargin, currentY);
    doc.text('Price', pageWidth - rightMargin - 8, currentY, { align: 'right' });
    currentY += 2;

    doc.setFontSize(6);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    trx.items.forEach(item => {
      const lineAmount = item.quantity * item.price;
      const lineAmountStr = `${lineAmount.toLocaleString()}`;
      const displayName = `${item.name} (x${item.quantity})`;
      doc.text(displayName, leftMargin, currentY);
      doc.text(lineAmountStr, pageWidth - rightMargin - 8, currentY, { align: 'right' });
      currentY += 2.3;
    });

    drawDashedDivider(currentY);
    currentY += 2.5;

    doc.setFontSize(7);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(0, 0, 0);

    const subtotalStr = (trx.subtotal || trx.total).toLocaleString();
    doc.text('Subtotal', leftMargin, currentY);
    doc.text(subtotalStr, pageWidth - rightMargin - 8, currentY, { align: 'right' });
    currentY += 2.3;

    if (shouldShowTransactionDiscount(trx)) {
      doc.setFontSize(6);
      const discountPercentStr = `${Math.round(normalizeDiscountPercentage(trx.discountPercentage) * 100)}%`;
      const discountTypeStr = trx.discountType === 'loyalty' ? 'Loyalty' : trx.discountType === 'pwd' ? 'PWD/Senior' : 'Discount';
      const discountAmountStr = trx.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      doc.text(`${discountTypeStr} (${discountPercentStr})`, leftMargin, currentY);
      doc.text(`-${discountAmountStr}`, pageWidth - rightMargin - 8, currentY, { align: 'right' });
      currentY += 2.3;
    }

    doc.setFontSize(7);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(0, 0, 0);

    const totalStr = trx.total.toLocaleString();
    doc.text('Total', leftMargin, currentY);
    doc.text(totalStr, pageWidth - rightMargin - 8, currentY, { align: 'right' });
    currentY += 2.8;

    doc.setFontSize(6);
    doc.setFont('Helvetica', 'normal');

    if (trx.paymentMethod === 'cash' && trx.amountReceive !== undefined) {
      const amountStr = trx.amountReceive.toLocaleString();
      doc.text('Cash', leftMargin, currentY);
      doc.text(amountStr, pageWidth - rightMargin - 8, currentY, { align: 'right' });
      currentY += 2.3;
      const changeAmount = trx.change || 0;
      if (changeAmount > 0) {
        const changeStr = changeAmount.toLocaleString();
        doc.text('Change', leftMargin, currentY);
        doc.text(changeStr, pageWidth - rightMargin - 8, currentY, { align: 'right' });
      }
    } else if (trx.paymentMethod === 'online') {
      doc.text('Payment Method: Online', leftMargin, currentY);
      currentY += 2.5;
      if (trx.referenceNumber) {
        doc.setFontSize(5);
        doc.text(`Ref: ${trx.referenceNumber}`, leftMargin, currentY);
      }
    }
    currentY += 2;

    if (trx.warrantyStartDate && trx.warrantyEndDate) {
      drawDashedDivider(currentY);
      currentY += 2.5;
      doc.setFontSize(6);
      doc.setFont('Helvetica', 'bold');
      doc.text('WARRANTY', leftMargin, currentY);
      currentY += 2.3;
      doc.setFontSize(5);
      doc.setFont('Helvetica', 'normal');
      const warrantStart = new Date(trx.warrantyStartDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
      const warrantyEnd = new Date(trx.warrantyEndDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
      doc.text(`From: ${warrantStart}`, leftMargin, currentY);
      currentY += 1.8;
      doc.text(`To: ${warrantyEnd}`, leftMargin, currentY);
      currentY += 2;
      if (trx.status === 'processing_replacement') {
        doc.text('Status: REPLACEMENT IN PROGRESS', leftMargin, currentY);
        currentY += 2;
      } else if (trx.status === 'replaced') {
        doc.text('Status: REPLACED', leftMargin, currentY);
        currentY += 2;
      }
    }

    currentY += 1.5;
    drawDashedDivider(currentY);
    currentY += 2.5;

    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text("THANK YOU!", pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;

    doc.setFontSize(5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text("Please retain this receipt", pageWidth / 2, currentY, { align: 'center' });

    doc.save(`Receipt_${receiptId}.pdf`);
  };

  const openReplacementModal = (transaction: Transaction) => {
    if (transaction.status === "replaced") {
      showToastOnly("This transaction has already been replaced and cannot be processed again.", "error");
      return;
    }
    
    const warrantyValid = isWarrantyValid(transaction);
    if (!warrantyValid) {
      showToastOnly("Replacement is only available for transactions with an active warranty.", "error");
      return;
    }
    
    setTransactionToReplace(transaction);
    setReplacementModalOpen(true);
    setReplacementReason("");
  };

  const handleProcessReplacement = async () => {
    if (transactionToReplace) {
      try {
        await processReplacement(
          transactionToReplace.id,
          replacementReason || "Item replacement processed",
          userName || "Staff"
        );
        
        setReplacementModalOpen(false);
        setTransactionToReplace(null);
        setReplacementReason("");
        
        showNotification(
          `Transaction #${transactionToReplace.id.slice(-8).toUpperCase()} is now in "Processing Replacement" status.`,
          "info",
          "Replacement Initiated"
        );
      } catch (error) {
        console.error("Replacement processing error:", error);
        showToastOnly("Failed to process replacement.", "error");
      }
    }
  };

  const openCompleteReplacementModal = (transaction: Transaction) => {
    setTransactionToComplete(transaction);
    setCompleteReplacementModalOpen(true);
  };

  const openViewTransactionModal = (transaction: Transaction) => {
    setTransactionToView(transaction);
    setViewTransactionModalOpen(true);
  };

  const handleMarkReplacementAsCompleted = async () => {
    if (transactionToComplete) {
      try {
        await markReplacementAsCompleted(
          transactionToComplete.id,
          userName || "Staff"
        );
        
        setCompleteReplacementModalOpen(false);
        setTransactionToComplete(null);
        
        showNotification(
          `Transaction #${transactionToComplete.id.slice(-8).toUpperCase()} has been marked as Replaced.`,
          "success",
          "Replacement Completed"
        );
      } catch (error) {
        console.error("Error completing replacement:", error);
        showToastOnly("Failed to mark replacement as completed.", "error");
      }
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'bg-emerald-100 text-emerald-700', text: 'Completed', icon: <CheckCircle2 size={12} /> };
      case 'processing_replacement':
        return { color: 'bg-yellow-100 text-yellow-700', text: 'Processing Replacement', icon: <Repeat size={12} /> };
      case 'replaced':
        return { color: 'bg-purple-100 text-purple-700', text: 'Replaced', icon: <CheckCheck size={12} /> };
      default:
        return { color: 'bg-gray-100 text-gray-700', text: status, icon: null };
    }
  };

  // Check if a transaction has a pending replacement request
  const hasPendingReplacementRequest = (transactionId: string): boolean => {
    return replacementRequests.some(
      r => r.transactionId === transactionId && r.status === "pending"
    );
  };

  // Get replacement request details for a transaction
  const getReplacementRequestForTransaction = (transactionId: string) => {
    return replacementRequests.find(r => r.transactionId === transactionId);
  };

  return (
    <div className="flex flex-col w-full font-sans p-2 sm:p-4 box-border">
      {/* Header Tabs */}
      <div className="shrink-0 flex items-center justify-between mb-2 sm:mb-4 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setActiveTab("pos")}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 font-bold text-[11px] sm:text-sm rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'pos' ? 'border-[#0B3C8A] text-[#0B3C8A]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShoppingCart size={16} /> Point of Sale
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 font-bold text-[11px] sm:text-sm rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'history' ? 'border-[#0B3C8A] text-[#0B3C8A]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History size={16} /> Transaction History
          </button>
        </div>

        <button
          onClick={toggleNetwork}
          className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold transition-all shadow-sm ${
            syncing ? 'bg-blue-100 text-blue-600' : isOnline ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
          }`}
        >
          {syncing ? <RefreshCcw size={12} className="animate-spin" /> : isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="hidden sm:inline">{syncing ? 'SYNCING...' : isOnline ? 'ONLINE' : 'OFFLINE MODE'}</span>
        </button>
      </div>

      {/* POS Tab */}
      {activeTab === "pos" ? (
        <div className="flex flex-col lg:flex-row gap-2 sm:gap-4 lg:min-h-[calc(99vh-180px)]">
          {/* Product Grid Section */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 lg:min-h-0">
            <div className="shrink-0 p-2 sm:p-4 border-b border-gray-100 bg-slate-50 space-y-2 sm:space-y-3">
              <div className="flex gap-2 sm:gap-3">
                <div className="relative group flex-1">
                  <Search className={`absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:${THEME_TEXT}`} size={16} />
                  <input
                    type="text"
                    placeholder="Search catalog items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-1.5 sm:py-2.5 rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400"
                  />
                  {searchQuery.trim() && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setIsQRScannerOpen(true)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg ${THEME_BG} ${THEME_HOVER} text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm hover:shadow-md`}
                >
                  <QrCode size={16} />
                  <span className="hidden sm:inline">Scan QR</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-xs font-bold whitespace-nowrap transition-colors ${
                      selectedCategory === cat ? `${THEME_BG} text-white shadow-md` : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50/50 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400" style={{ maxHeight: 'calc(100vh - 100px)' }}>
              <motion.div
                key={`product-grid-${selectedCategory}-${searchQuery}`}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3"
              >
                <AnimatePresence mode="popLayout">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(product => {
                      const isDeadstock = deadstockProductIds.has(product.id);
                      return (
                        <motion.div
                          key={product.id}
                          variants={itemVariants}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => {
                            if ((product.availableStock ?? 0) > 0 && !product.archived) {
                              handleAddToCartClick(product);
                            } else if (product.archived) {
                              showToastOnly(`❌ ${product.name} is archived and cannot be sold`, "error");
                            } else {
                              showToastOnly(`❌ ${product.name} is out of stock`, "error");
                            }
                          }}
                          className={`bg-white p-2 sm:p-3 rounded-xl border border-gray-200 shadow-sm cursor-pointer transition-all flex flex-col ${
                            product.archived ? 'opacity-50 bg-gray-100 cursor-not-allowed hover:shadow-none hover:border-gray-200' :
                            (product.availableStock ?? 0) === 0 ? 'hover:shadow-none hover:border-gray-200' : 'hover:shadow-md hover:border-blue-300'
                          }`}
                        >
                          <div className="relative aspect-4/3 sm:aspect-square w-full overflow-hidden bg-slate-50 rounded-lg mb-1.5 sm:mb-2">
                            {product.image && !product.image.startsWith('blob:') ? (
                              <div className="relative w-full h-full">
                                <Image
                                  src={product.image}
                                  alt={product.name}
                                  fill
                                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                  className={`object-cover transition-all duration-300 ${
                                    product.archived ? 'opacity-30 grayscale' : (product.availableStock ?? 0) <= 0 ? 'opacity-50 grayscale' : ''
                                  }`}
                                  priority={false}
                                />
                              </div>
                            ) : (
                              <div className={`w-full h-full ${product.imageColor} flex items-center justify-center transition-colors duration-300`}>
                                <Glasses className={`opacity-20 ${product.archived ? 'text-gray-500' : (product.availableStock ?? 0) <= 0 ? 'text-gray-500' : 'text-[#0B3C8A]'} w-1/3 h-1/3`} />
                              </div>
                            )}
                            <div className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur text-gray-600 text-[8px] sm:text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-10">
                              {product.sku}
                            </div>
                            <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 items-end z-10">
                              {product.archived && <span className="bg-gray-500 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">ARCHIVED</span>}
                              {!product.archived && isDeadstock && <span className="text-gray-700 bg-gray-200 border border-gray-400 sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">DEAD</span>}
                              {!product.archived && (product.availableStock ?? 0) <= product.reorderPoint && (product.availableStock ?? 0) > 0 && (
                                <span className="bg-orange-500 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">LOW</span>
                              )}
                              {!product.archived && (product.availableStock ?? 0) <= 0 && (
                                <span className="bg-red-500 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">OUT</span>
                              )}
                            </div>
                          </div>
                          <h3 className="text-[11px] sm:text-xs font-semibold text-gray-800 line-clamp-2 mb-1 sm:mb-1.5 min-h-8 sm:min-h-9 leading-snug" title={product.name}>
                            {product.name}
                          </h3>
                          <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <div>
                              <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-bold">Retail</div>
                              <div className={`${THEME_TEXT} font-bold text-[11px] sm:text-sm leading-tight`}>
                                ₱{product.markupPrice.toLocaleString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-bold">Cost</div>
                              <div className="text-gray-600 font-semibold text-[10px] sm:text-xs leading-tight">
                                ₱{product.baseCost.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="mt-auto pt-1.5 sm:pt-2 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] sm:text-[10px] font-medium text-gray-500">Stock:</span>
                              <span className={`text-[11px] sm:text-xs font-bold ${
                                product.archived ? 'text-gray-500' :
                                (product.availableStock ?? 0) <= product.reorderPoint && (product.availableStock ?? 0) > 0 ? 'text-orange-600' :
                                (product.availableStock ?? 0) <= 0 ? 'text-red-600' : 'text-gray-800'
                              }`}>
                                {product.availableStock}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <motion.div
                      key="no-results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="col-span-full py-10 text-center text-gray-500 text-sm"
                    >
                      No products found matching your search.
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>

          {/* Cart Section */}
          <div className="w-full lg:w-95 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 shrink-0 lg:min-h-0">
            <div className="shrink-0 p-2.5 sm:p-4 border-b border-gray-100 bg-slate-50 flex flex-col gap-2 sm:gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
                  <ShoppingCart size={16} /> Current Order
                </h2>
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-xs text-red-600 hover:text-red-800 font-medium">
                    Clear All
                  </button>
                )}
              </div>
              
              {/* Patient Name */}
              <div className="relative">
                <User className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Patient Name (Optional)"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full pl-8 sm:pl-9 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400"
                />
              </div>
              
              {/* Contact Number - directly below patient name */}
              <div className="relative">
                <Phone className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="tel"
                  placeholder="Contact Number (Optional)"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full pl-8 sm:pl-9 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 sm:space-y-2" style={{ maxHeight: 'calc(100vh - 280px)', overflowX: 'hidden' }}>
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-1 sm:space-y-2">
                  <ShoppingCart size={36} className="sm:w-12 sm:h-12 opacity-20" />
                  <p className="text-xs sm:text-sm font-medium">Cart is empty</p>
                  <p className="text-[10px] sm:text-xs text-center">Click on products to add them to cart</p>
                </div>
              ) : (
                <AnimatePresence>
                  {cart.map(item => {
                    const product = productsWithAvailableStock.find(p => p.id === item.id);
                    const actualStock = product?.stock || 0;
                    const reservedForOthers = cart.filter(i => i.id !== item.id).reduce((sum, i) => sum + i.quantity, 0);
                    const maxPossible = actualStock - reservedForOthers;
                    
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center justify-between bg-white border border-gray-100 p-2 sm:p-2.5 rounded-lg shadow-sm"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md overflow-hidden shrink-0 bg-slate-50 border border-gray-200">
                            {item.image && !item.image.startsWith('blob:') ? (
                              <div className="relative w-full h-full">
                                <Image src={item.image} alt={item.name} fill sizes="40px" className="object-cover" priority={false} />
                              </div>
                            ) : (
                              <div className={`w-full h-full ${item.imageColor} flex items-center justify-center`}>
                                <Glasses className="opacity-20 text-[#0B3C8A] w-1/2 h-1/2" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-2">
                            <h4 className="text-[10px] sm:text-[11px] font-bold text-gray-800 truncate">{item.name}</h4>
                            <div className="text-[9px] sm:text-[10px] text-gray-600 font-mono">₱{item.price.toLocaleString()} each</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <div className="flex items-center border border-gray-200 rounded-md">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="p-0.5 sm:p-1 hover:bg-gray-100 text-gray-600"
                              disabled={item.quantity <= 1}
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-4 sm:w-5 text-center text-[10px] sm:text-[11px] font-bold text-gray-700">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="p-0.5 sm:p-1 hover:bg-gray-100 text-gray-600"
                              disabled={item.quantity >= maxPossible}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            <div className="shrink-0 p-2.5 sm:p-4 border-t border-gray-100 bg-slate-50">
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-5">
                {/* Payment Method */}
                <div className="space-y-2">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase">Payment Method</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold text-xs transition-all border-2 ${
                        paymentMethod === "cash" ? `border-[#0B3C8A] bg-blue-50 text-[#0B3C8A]` : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      <Banknote size={14} /><span>Cash</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod("online")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold text-xs transition-all border-2 ${
                        paymentMethod === "online" ? `border-[#0B3C8A] bg-blue-50 text-[#0B3C8A]` : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      <CreditCard size={14} /><span>Online</span>
                    </button>
                  </div>
                </div>

                {/* Warranty */}
                <div className="space-y-1.5">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase flex items-center gap-1">
                    <Shield size={12} /> Warranty (Optional)
                  </label>
                  <div className="space-y-1">
                    <input
                      type="date"
                      value={warrantyStartDate}
                      onChange={(e) => setWarrantyStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700"
                    />
                    <input
                      type="date"
                      value={warrantyEndDate}
                      onChange={(e) => setWarrantyEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700"
                    />
                  </div>
                </div>

                {/* Reference Number for Online Payment */}
                {paymentMethod === "online" && (
                  <div className="space-y-1.5">
                    <label htmlFor="referenceNumber" className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase flex items-center gap-1">
                      <CreditCard size={12} /> Reference Number
                    </label>
                    <input
                      id="referenceNumber"
                      type="text"
                      placeholder="Enter transaction reference number"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400"
                    />
                  </div>
                )}

                {/* Discount Type */}
                <div className="space-y-2">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase">Discount Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setDiscountType("none")}
                      className={`py-2 px-2 rounded-lg font-semibold text-xs transition-all border-2 ${
                        discountType === "none" ? `border-[#0B3C8A] bg-blue-50 text-[#0B3C8A]` : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      None
                    </button>
                    <button
                      onClick={() => setDiscountType("loyalty")}
                      className={`py-2 px-2 rounded-lg font-semibold text-xs transition-all border-2 ${
                        discountType === "loyalty" ? `border-[#0B3C8A] bg-blue-50 text-[#0B3C8A]` : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      Loyalty (30%)
                    </button>
                    <button
                      onClick={() => setDiscountType("pwd")}
                      className={`py-2 px-2 rounded-lg font-semibold text-xs transition-all border-2 ${
                        discountType === "pwd" ? `border-[#0B3C8A] bg-blue-50 text-[#0B3C8A]` : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      PWD/Senior (20%)
                    </button>
                  </div>
                </div>

                {/* ID Type and ID Number - Only visible when PWD/Senior discount is selected */}
                {discountType === "pwd" && (
                  <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={idType}
                        onChange={(e) => setIdType(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 bg-white"
                      >
                        <option value="">Select ID Type</option>
                        <option value="PWD">PWD ID</option>
                        <option value="Senior Citizen">Senior Citizen ID</option>
                      </select>
                      <input
                        type="text"
                        placeholder="ID Number"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400"
                      />
                    </div>
                  </div>
                )}

                {/* Amount Receive for Cash */}
                {paymentMethod === "cash" && (
                  <div className="space-y-1.5">
                    <label htmlFor="amountReceive" className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase">Amount Receive</label>
                    <div className="relative">
                      <span className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm sm:text-base">₱</span>
                      <input
                        id="amountReceive"
                        type="number"
                        inputMode="decimal"
                        placeholder={`${total.toLocaleString()}`}
                        value={amountReceive}
                        onChange={(e) => setAmountReceive(e.target.value)}
                        className="w-full pl-6 sm:pl-8 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-md border-2 border-gray-300 text-sm sm:text-base font-bold focus:outline-none focus:border-[#0B3C8A] text-gray-800"
                      />
                    </div>
                    {amountReceive && !isNaN(parseFloat(amountReceive)) && parseFloat(amountReceive) >= total && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2 sm:p-2.5">
                        <div className="flex justify-between items-center text-xs sm:text-sm">
                          <span className="font-semibold text-emerald-800">Change:</span>
                          <span className="font-bold text-emerald-600">
                            ₱{(parseFloat(amountReceive) - total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}
                    {amountReceive && !isNaN(parseFloat(amountReceive)) && parseFloat(amountReceive) < total && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-2 sm:p-2.5">
                        <div className="flex justify-between items-center text-xs sm:text-sm">
                          <span className="font-semibold text-red-800">Short by:</span>
                          <span className="font-bold text-red-600">
                            ₱{(total - parseFloat(amountReceive)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-1 sm:space-y-1.5 mb-3 sm:mb-4">
                <div className="flex justify-between text-xs sm:text-sm font-semibold text-gray-700 pt-1.5 sm:pt-2 border-t border-gray-200">
                  <span>Subtotal</span>
                  <span className="text-gray-800">₱{subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded">
                    <span>Discount ({Math.round(discountPercentage * 100)}%)</span>
                    <span>-₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm sm:text-base font-black text-gray-800 pt-1.5 sm:pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className={THEME_TEXT}>₱{total.toLocaleString()}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || isProcessingCheckout}
                className={`w-full py-1.5 sm:py-2.5 rounded-md sm:rounded-lg font-bold text-white shadow-md transition-all text-xs sm:text-sm ${
                  cart.length === 0 || isProcessingCheckout ? 'bg-gray-400 cursor-not-allowed' : `${THEME_BG} ${THEME_HOVER}`
                }`}
              >
                {isProcessingCheckout ? 'Processing...' : `Pay ₱${total.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Transaction History Tab */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col lg:min-h-[calc(99vh-180px)]">
          <div className="shrink-0 p-3 sm:p-4 border-b border-gray-200">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-800">Transactions</h2>
              <p className="text-[10px] sm:text-[11px] text-gray-500">
                View daily sales, generate receipts, and process replacements for items under warranty.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => { setViewByMonth(false); setSelectedMonth(""); }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                    !viewByMonth ? "bg-[#0B3C8A] text-white shadow-md" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  By Day
                </button>
                <button
                  onClick={() => { setViewByMonth(true); if (availableMonths.length > 0 && !selectedMonth) { setSelectedMonth(availableMonths[0].key); } }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                    viewByMonth ? "bg-[#0B3C8A] text-white shadow-md" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  By Month
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 mb-1.5">
                    {viewByMonth ? "Select Month" : "Filter by Date"}
                  </label>
                  {viewByMonth ? (
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white"
                    >
                      {availableMonths.length === 0 ? (
                        <option value="">No transactions available</option>
                      ) : (
                        availableMonths.map((month) => (
                          <option key={month.key} value={month.key}>{month.display}</option>
                        ))
                      )}
                    </select>
                  ) : (
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 mb-1.5">Status</label>
                  <select
                    value={transactionStatusFilter}
                    onChange={(e) => setTransactionStatusFilter(e.target.value as "all" | "completed" | "processing_replacement" | "replaced")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white"
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="processing_replacement">Processing Replacement</option>
                    <option value="replaced">Replaced</option>
                  </select>
                </div>
                <div className="flex-1">
                  <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1.5">Total Transactions</div>
                  <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg font-bold text-sm sm:text-base text-blue-700">
                    {filteredTransactions.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto lg:min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
            {filteredTransactions.length === 0 ? (
              <div className="py-20 text-center text-gray-400 flex flex-col items-center">
                <History size={36} className="sm:w-12 sm:h-12 mb-3 sm:mb-4 opacity-20" />
                <p className="text-xs sm:text-sm">No transactions found for this {viewByMonth ? "month" : "day"}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-[10px] sm:text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2 sm:p-3">Date</th>
                      <th className="p-2 sm:p-3">Patient Name</th>
                      <th className="p-2 sm:p-3">User</th>
                      <th className="p-2 sm:p-3">Items</th>
                      <th className="p-2 sm:p-3 text-right">Amount</th>
                      <th className="p-2 sm:p-3 text-center">Payment</th>
                      <th className="p-2 sm:p-3 text-center">Status</th>
                      <th className="p-2 sm:p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTransactions.map((trx) => {
                      const warrantyStatus = getWarrantyStatus(trx);
                      const hasWarranty = trx.warrantyStartDate && trx.warrantyEndDate;
                      const canProcessReplacement = trx.status === "completed" && warrantyStatus.active;
                      const hasPendingRequest = hasPendingReplacementRequest(trx.id);
                      const statusBadge = getStatusBadge(trx.status);
                      
                      return (
                        <tr key={trx.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-2 sm:p-3 text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar size={12} className="text-gray-400" />
                              {formatDate(trx.date)}
                            </div>
                          </td>
                          <td className="p-2 sm:p-3 font-medium text-gray-800">{trx.patientName}</td>
                          <td className="p-2 sm:p-3 text-gray-600">{trx.staffName || 'User'}</td>
                          <td className="p-2 sm:p-3 text-gray-600 max-w-xs">
                            <div className="truncate" title={trx.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}>
                              {trx.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                            </div>
                          </td>
                          <td className="p-2 sm:p-3 text-right font-bold text-gray-800">₱{trx.total.toLocaleString()}</td>
                          <td className="p-2 sm:p-3 text-center">
                            <span className={`px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold rounded-full uppercase ${
                              trx.paymentMethod === 'cash' ? 'bg-blue-100 text-blue-700' : trx.paymentMethod === 'online' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {trx.paymentMethod || 'N/A'}
                            </span>
                            {trx.referenceNumber && trx.paymentMethod === 'online' && (
                              <div className="text-[8px] text-gray-500 mt-0.5 font-mono">{trx.referenceNumber}</div>
                            )}
                          </td>
                          <td className="p-2 sm:p-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold rounded-full ${statusBadge.color}`}>
                              {statusBadge.icon}
                              {statusBadge.text}
                            </span>
                            {hasPendingRequest && (
                              <div className="text-[8px] text-amber-600 mt-0.5 font-medium">Request Pending</div>
                            )}
                          </td>
                          <td className="p-2 sm:p-3 text-right">
                            <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                              <button
                                onClick={() => openViewTransactionModal(trx)}
                                className="p-1 sm:p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                title="View Transaction"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => generateReceipt(trx)}
                                className="p-1 sm:p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Download Receipt"
                              >
                                <Receipt size={14} />
                              </button>
                              
                              {/* REQUEST REPLACEMENT BUTTON - STAFF ONLY */}
                              {userRole === "staff" && trx.status === "completed" && isWarrantyValid(trx) && !hasPendingRequest && (
                                <button
                                  onClick={() => {
                                    setTransactionForReplacementRequest(trx);
                                    setShowReplacementRequestModal(true);
                                  }}
                                  className="p-1 sm:p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                  title="Request Replacement (Under Warranty)"
                                >
                                  <Repeat size={14} />
                                </button>
                              )}
                              
                              {/* Show pending indicator for staff */}
                              {userRole === "staff" && trx.status === "completed" && hasPendingRequest && (
                                <span className="p-1 sm:p-1.5 text-amber-400" title="Replacement request pending approval">
                                  <Repeat size={14} />
                                </span>
                              )}
                              
                              {/* ADMIN PROCESS REPLACEMENT BUTTON - ADMIN ONLY (Purple/Violet Repeat icon) */}
                              {userRole === "admin" && canProcessReplacement && hasWarranty && (
                                <button
                                  onClick={() => openReplacementModal(trx)}
                                  className="p-1 sm:p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                  title="Process Replacement (Admin)"
                                >
                                  <Repeat size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Add to Cart Modal */}
      <AnimatePresence>
        {showAddToCartModal && pendingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm text-center"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-blue-600">
                <ShoppingCart size={24} />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-2">Add to Cart</h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-4">
                Are you sure you want to add <span className="font-bold text-blue-600">{pendingProduct.name}</span> to your cart?
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-bold text-gray-800">₱{pendingProduct.markupPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Available Stock:</span>
                  <span className={`font-bold ${(pendingProduct.availableStock ?? 0) <= pendingProduct.reorderPoint ? 'text-orange-600' : 'text-gray-800'}`}>
                    {pendingProduct.availableStock}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => { setShowAddToCartModal(false); setPendingProduct(null); }}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAddToCart}
                  className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 ${THEME_BG} text-white rounded-lg text-xs sm:text-sm font-medium ${THEME_HOVER} transition-colors shadow-md`}
                >
                  Add to Cart
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Success Modal */}
      <AnimatePresence>
        {showCheckoutModal && lastTransaction && lastTransaction.id && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm text-center"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-emerald-600">
                <CheckCircle2 size={28} />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-gray-800 mb-1">Payment Successful</h2>
              <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 font-mono">{lastTransaction.id.slice(-8).toUpperCase()}</p>
              <div className="text-2xl sm:text-3xl font-black text-[#0B3C8A] mb-5 sm:mb-6">₱{lastTransaction.total.toLocaleString()}</div>
              
              {shouldShowTransactionDiscount(lastTransaction) && (
                <div className="bg-emerald-50 rounded-lg p-3 sm:p-4 mb-5 sm:mb-6 text-sm space-y-2 border border-emerald-200">
                  <div className="flex justify-between">
                    <span className="text-emerald-600 font-semibold">Subtotal:</span>
                    <span className="text-emerald-700 font-bold">
                      ₱{(lastTransaction.subtotal || lastTransaction.total + lastTransaction.discountAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span className="font-semibold">
                      {lastTransaction.discountType === 'loyalty' ? 'Loyalty' : lastTransaction.discountType === 'pwd' ? 'PWD/Senior' : 'Discount'} ({Math.round(normalizeDiscountPercentage(lastTransaction.discountPercentage) * 100)}%)
                    </span>
                    <span className="font-bold">
                      -₱{lastTransaction.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
              
              {lastTransaction.paymentMethod && (
                <div className="bg-slate-50 rounded-lg p-3 sm:p-4 mb-5 sm:mb-6 text-sm space-y-2 border border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-semibold text-gray-800 uppercase">{lastTransaction.paymentMethod}</span>
                  </div>
                  {lastTransaction.paymentMethod === 'cash' && lastTransaction.amountReceive !== undefined && (
                    <>
                      <div className="border-t border-gray-300 pt-2 flex justify-between">
                        <span className="text-gray-600">Cash:</span>
                        <span className="font-semibold text-gray-800">₱{lastTransaction.amountReceive.toLocaleString()}</span>
                      </div>
                      {lastTransaction.change !== undefined && lastTransaction.change > 0 && (
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>Change:</span>
                          <span>₱{lastTransaction.change.toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {lastTransaction.warrantyStartDate && lastTransaction.warrantyEndDate && (
                <div className="bg-blue-50 rounded-lg p-3 mb-5 sm:mb-6 border border-blue-200">
                  <div className="flex items-center justify-center gap-2 text-blue-700">
                    <Shield size={14} />
                    <span className="text-xs font-semibold">Warranty: {formatWarrantyRange(lastTransaction.warrantyStartDate, lastTransaction.warrantyEndDate)}</span>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => generateReceipt(lastTransaction)}
                  className="w-full py-2 sm:py-2.5 rounded-lg border border-gray-200 text-gray-700 text-xs sm:text-sm font-bold hover:bg-gray-50 flex justify-center items-center gap-2 transition-colors"
                >
                  <Receipt size={14} /> Print / Download Receipt
                </button>
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className={`w-full py-2 sm:py-2.5 rounded-lg ${THEME_BG} text-white text-xs sm:text-sm font-bold ${THEME_HOVER} transition-colors`}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Transaction Details Modal - Updated with replacement request dates */}
      <AnimatePresence>
        {viewTransactionModalOpen && transactionToView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl">
                    <Receipt size={20} className="text-slate-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Transaction Details</h3>
                </div>
                <button
                  onClick={() => { setViewTransactionModalOpen(false); setTransactionToView(null); }}
                  className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-all duration-200 hover:shadow-sm"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-3.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Receipt Number</p>
                  <p className="font-mono font-bold text-slate-800 text-sm mt-1">{transactionToView.id?.slice(-8).toUpperCase() || "N/A"}</p>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-3.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Date & Time</p>
                  <p className="font-semibold text-slate-700 text-sm mt-1">
                    {formatDate(transactionToView.date)} at {new Date(transactionToView.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-3.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Customer</p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                        <User size={12} className="text-blue-600" />
                      </div>
                      <p className="font-semibold text-slate-800 text-sm">{transactionToView.patientName || "Walk-in Patient"}</p>
                    </div>
                    {transactionToView.contactNumber && (
                      <p className="text-[10px] text-slate-500 ml-8">📞 {transactionToView.contactNumber}</p>
                    )}
                    {transactionToView.discountType === "pwd" && transactionToView.idType && transactionToView.idNumber && (
                      <p className="text-[10px] text-slate-500 ml-8">🪪 {transactionToView.idType}: {transactionToView.idNumber}</p>
                    )}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-3.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cashier</p>
                  <p className="font-semibold text-slate-700 text-sm mt-1">{transactionToView.staffName || "User"}</p>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-3.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Payment Method</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      transactionToView.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {transactionToView.paymentMethod === 'cash' ? <Banknote size={10} /> : <CreditCard size={10} />}
                      {(transactionToView.paymentMethod || 'N/A').toUpperCase()}
                    </span>
                    {transactionToView.referenceNumber && transactionToView.paymentMethod === "online" && (
                      <span className="text-[10px] text-slate-500 font-mono">Ref: {transactionToView.referenceNumber}</span>
                    )}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-3.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Status</p>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold rounded-full ${getStatusBadge(transactionToView.status).color}`}>
                      {getStatusBadge(transactionToView.status).icon}
                      {getStatusBadge(transactionToView.status).text}
                    </span>
                  </div>
                </div>

                {/* Replacement Request Dates Section - Only show if there's a replacement request */}
                {(() => {
                  const replacementReq = getReplacementRequestForTransaction(transactionToView.id);
                  if (replacementReq) {
                    return (
                      <>
                        {/* Requested Date */}
                        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl p-3.5">
                          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1">
                            <CalendarDays size={12} /> Replacement Requested
                          </p>
                          <p className="font-semibold text-amber-700 text-sm mt-1">{formatDateTime(replacementReq.requestedAt)}</p>
                          <p className="text-[9px] text-amber-500 mt-0.5">by {replacementReq.requestedBy}</p>
                        </div>

                        {/* Approved Date - Only show if approved */}
                        {replacementReq.status === "approved" && replacementReq.reviewedAt && (
                          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-3.5">
                            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide flex items-center gap-1">
                              <CheckCircle2 size={12} /> Replacement Approved
                            </p>
                            <p className="font-semibold text-emerald-700 text-sm mt-1">{formatDateTime(replacementReq.reviewedAt)}</p>
                            <p className="text-[9px] text-emerald-500 mt-0.5">by {replacementReq.reviewedBy}</p>
                          </div>
                        )}

                        {/* Rejected Date & Reason - Only show if rejected */}
                        {replacementReq.status === "rejected" && replacementReq.reviewedAt && (
                          <div className="bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-xl p-3.5">
                            <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide flex items-center gap-1">
                              <XCircle size={12} /> Replacement Rejected
                            </p>
                            <p className="font-semibold text-red-700 text-sm mt-1">{formatDateTime(replacementReq.reviewedAt)}</p>
                            <p className="text-[9px] text-red-500 mt-0.5">by {replacementReq.reviewedBy}</p>
                            {replacementReq.rejectionReason && (
                              <p className="text-[11px] text-red-600 mt-2 p-2 bg-red-100 rounded-md">
                                <strong>Reason:</strong> {replacementReq.rejectionReason}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    );
                  }
                  return null;
                })()}

                {(transactionToView.status === "processing_replacement" || transactionToView.status === "replaced") && (
                  <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl p-3.5">
                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1">
                      <Repeat size={12} /> Return Date
                    </p>
                    {transactionToView.processedAt ? (
                      <>
                        <p className="font-semibold text-amber-700 text-sm mt-1">{formatDateTime(transactionToView.processedAt)}</p>
                        {transactionToView.processedBy && (
                          <p className="text-[9px] text-amber-500 mt-0.5">by {transactionToView.processedBy}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-amber-500 italic mt-1">Pending</p>
                    )}
                  </div>
                )}

                {(transactionToView.status === "processing_replacement" || transactionToView.status === "replaced") && (
                  <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl p-3.5">
                    <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide flex items-center gap-1">
                      <CheckCheck size={12} /> Replacement Date
                    </p>
                    {transactionToView.replacedAt ? (
                      <>
                        <p className="font-semibold text-purple-700 text-sm mt-1">{formatDateTime(transactionToView.replacedAt)}</p>
                        {transactionToView.replacedBy && (
                          <p className="text-[9px] text-purple-500 mt-0.5">by {transactionToView.replacedBy}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-purple-500 italic mt-1">Pending</p>
                    )}
                  </div>
                )}

                <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-3.5 sm:col-span-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Warranty</p>
                  {transactionToView.warrantyStartDate && transactionToView.warrantyEndDate ? (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Shield size={14} className={getWarrantyStatus(transactionToView).active ? "text-emerald-600" : "text-red-600"} />
                      <span className={`font-semibold text-sm ${getWarrantyStatus(transactionToView).color}`}>
                        {getWarrantyStatus(transactionToView).text}
                      </span>
                      <span className="text-slate-600 text-sm">{formatWarrantyRange(transactionToView.warrantyStartDate, transactionToView.warrantyEndDate)}</span>
                      {transactionToView.status === "replaced" && (
                        <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Already Replaced</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 mt-1">No warranty</p>
                  )}
                </div>

                {transactionToView.replacementReason && (
                  <div className="sm:col-span-2 bg-gradient-to-br from-yellow-50 to-white border border-yellow-200 rounded-xl p-3.5">
                    <p className="text-[10px] font-semibold text-yellow-700 uppercase tracking-wide flex items-center gap-1">
                      <AlertTriangle size={12} /> Replacement Reason
                    </p>
                    <p className="text-sm text-slate-700 mt-1">{transactionToView.replacementReason}</p>
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-4 py-2.5 border-b border-slate-200">
                  <p className="font-semibold text-slate-800 text-sm">Order Items</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {transactionToView.items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-700 font-medium">{item.name}</span>
                        <span className="text-[11px] text-slate-400">Quantity: {item.quantity} × ₱{item.price.toLocaleString()}</span>
                      </div>
                      <span className="font-bold text-slate-800">₱{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-4 mb-5">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-semibold text-slate-700">
                      ₱{(transactionToView.subtotal || transactionToView.total + (transactionToView.discountAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {shouldShowTransactionDiscount(transactionToView) && (
                    <div className="flex justify-between items-center text-sm bg-emerald-50 -mx-2 px-2 py-1.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 font-medium">Discount</span>
                        <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          {transactionToView.discountType === 'loyalty' ? 'Loyalty 30%' : transactionToView.discountType === 'pwd' ? 'PWD/Senior 20%' : `${Math.round(normalizeDiscountPercentage(transactionToView.discountPercentage) * 100)}%`}
                        </span>
                      </div>
                      <span className="font-bold text-emerald-700">
                        -₱{transactionToView.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-bold text-slate-800">Total</span>
                      <span className="text-xl font-black text-[#0B3C8A]">
                        ₱{transactionToView.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  {transactionToView.paymentMethod === 'cash' && transactionToView.amountReceive !== undefined && (
                    <>
                      <div className="flex justify-between text-sm pt-1">
                        <span className="text-slate-500">Amount Received</span>
                        <span className="font-semibold text-slate-700">
                          ₱{transactionToView.amountReceive.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {transactionToView.change !== undefined && transactionToView.change > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Change</span>
                          <span className="font-bold text-emerald-600">
                            ₱{transactionToView.change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <button
                  onClick={() => generateReceipt(transactionToView)}
                  className="flex-1 px-4 py-2.5 bg-[#0B3C8A] text-white rounded-xl text-sm font-semibold hover:bg-[#082F6E] transition-all duration-200 shadow-md flex items-center justify-center gap-2"
                >
                  <Receipt size={16} /> Download Receipt
                </button>
                {transactionToView.status === "processing_replacement" && userRole === "admin" && (
                  <button
                    onClick={() => { setViewTransactionModalOpen(false); setTransactionToView(null); openCompleteReplacementModal(transactionToView); }}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all duration-200 shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCheck size={16} /> Mark as Replaced
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Process Replacement Modal (Admin Approval) */}
      <AnimatePresence>
        {replacementModalOpen && transactionToReplace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl p-5 sm:p-6 w-full max-w-md"
            >
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={20} className="text-blue-600" />
                  <h3 className="text-base font-bold text-gray-900">Warranty Notice</h3>
                </div>
                <p className="text-sm text-gray-700">
                  This transaction receipt has a valid warranty and qualifies for replacement. Once processed, the status will change to "Processing Replacement."
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for Replacement <span className="text-gray-400">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Please provide a reason for this replacement (e.g., defective item, wrong size, etc.)..."
                  value={replacementReason}
                  onChange={(e) => setReplacementReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700 placeholder-gray-400 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setReplacementModalOpen(false); setTransactionToReplace(null); setReplacementReason(""); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessReplacement}
                  className="flex-1 px-4 py-2 bg-[#0B3C8A] text-white rounded-lg text-sm font-medium hover:bg-[#082F6E] transition-colors shadow-md"
                >
                  Process Replacement
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mark as Replaced Modal */}
      <AnimatePresence>
        {completeReplacementModalOpen && transactionToComplete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl p-5 sm:p-6 w-full max-w-md"
            >
              <div className="flex items-center gap-2 mb-3">
                <CheckCheck size={20} className="text-emerald-600" />
                <h3 className="text-base font-bold text-gray-900">Mark Replacement as Completed</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                You are about to mark the replacement for receipt <span className="font-mono font-bold text-gray-700">{transactionToComplete.id.slice(-8).toUpperCase()}</span> as completed.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">⚠️ This will mark the transaction as "Replaced". This action can be tracked in the Activity Logs.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setCompleteReplacementModalOpen(false); setTransactionToComplete(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkReplacementAsCompleted}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-md"
                >
                  Mark as Replaced
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Replacement Request Modal (Staff Submission) */}
      <AnimatePresence>
        {showReplacementRequestModal && transactionForReplacementRequest && (
          <ReplacementRequestModal
            transactionId={transactionForReplacementRequest.id}
            transactionReceiptNumber={transactionForReplacementRequest.id.slice(-8).toUpperCase()}
            patientName={transactionForReplacementRequest.patientName}
            originalTotal={transactionForReplacementRequest.total}
            originalItems={transactionForReplacementRequest.items}
            onClose={() => {
              setShowReplacementRequestModal(false);
              setTransactionForReplacementRequest(null);
            }}
            onSuccess={() => {
              fetchReplacementRequests(true);
              setShowReplacementRequestModal(false);
              setTransactionForReplacementRequest(null);
              showToastOnly("Replacement request submitted successfully", "success");
            }}
          />
        )}
      </AnimatePresence>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {isQRScannerOpen && (
          <QRScannerModal
            mode="cart"
            onClose={() => setIsQRScannerOpen(false)}
            products={activeProducts}
            onProductFound={(productId) => {
              const product = productsWithAvailableStock.find(p => p.id === productId);
              if (product && !product.archived) {
                handleAddToCartClick(product);
                setIsQRScannerOpen(false);
              } else if (product?.archived) {
                showToastOnly(`❌ ${product.name} is archived and cannot be sold`, "error");
                setIsQRScannerOpen(false);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Online Payment Confirmation Modal */}
      <AnimatePresence>
        {showOnlineConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full">
                <CreditCard className="w-6 h-6 text-[#0B3C8A]" />
              </div>
              <div className="space-y-2 text-center">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Confirm Online Payment</h3>
                <p className="text-sm text-gray-600">Are you sure you want to complete this online payment?</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Customer Name:</span>
                  <span className="font-semibold text-gray-900">{patientName || "Walk-in Patient"}</span>
                </div>
                {referenceNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Reference Number:</span>
                    <span className="font-mono font-semibold text-gray-900">{referenceNumber}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm bg-emerald-50 p-2 rounded border border-emerald-200">
                    <span className="text-emerald-700 font-medium">Discount ({discountType === "loyalty" ? "Loyalty 30%" : "PWD/Senior 20%"}):</span>
                    <span className="font-semibold text-emerald-700">-₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2.5">
                  <div className="flex justify-between text-base">
                    <span className="font-semibold text-gray-900">Total Amount:</span>
                    <span className="font-bold text-[#0B3C8A]">₱{total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button onClick={() => setShowOnlineConfirm(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm sm:text-base font-medium hover:bg-gray-300 transition-colors">Cancel</button>
                <button onClick={handleConfirmOnlinePayment} className="flex-1 px-4 py-2 bg-[#0B3C8A] text-white rounded-lg text-sm sm:text-base font-medium hover:bg-[#0a2f6a] transition-colors shadow-md">Confirm Payment</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cash Payment Confirmation Modal */}
      <AnimatePresence>
        {showCashConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full">
                <Banknote className="w-6 h-6 text-[#0B3C8A]" />
              </div>
              <div className="space-y-2 text-center">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Confirm Transaction</h3>
                <p className="text-sm text-gray-600">Are you sure you want to complete this transaction?</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Customer Name:</span>
                  <span className="font-semibold text-gray-900">{patientName || "Walk-in Patient"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-semibold text-gray-900 uppercase">Cash</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold text-gray-900">₱{cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm bg-emerald-50 p-2 rounded border border-emerald-200">
                    <span className="text-emerald-700 font-medium">Discount ({discountType === "loyalty" ? "Loyalty 30%" : "PWD/Senior 20%"}):</span>
                    <span className="font-semibold text-emerald-700">-₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Amount Receive:</span>
                  <span className="font-semibold text-gray-900">₱{parseFloat(amountReceive).toLocaleString()}</span>
                </div>
                <div className="border-t border-gray-200 pt-2.5">
                  <div className="flex justify-between text-base">
                    <span className="font-semibold text-gray-900">Change:</span>
                    <span className="font-bold text-[#0B3C8A]">₱{(parseFloat(amountReceive) - total).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button onClick={() => setShowCashConfirm(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm sm:text-base font-medium hover:bg-gray-300 transition-colors">Cancel</button>
                <button onClick={handleConfirmCashPayment} className="flex-1 px-4 py-2 bg-[#0B3C8A] text-white rounded-lg text-sm sm:text-base font-medium hover:bg-[#0a2f6a] transition-colors shadow-md">Confirm</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper component for XCircle icon used in rejection display
const XCircle = ({ size, className }: { size: number; className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10"/>
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);