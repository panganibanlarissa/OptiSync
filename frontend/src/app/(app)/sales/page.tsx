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
  Clock
} from "lucide-react";
import { Timestamp } from "firebase/firestore";

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";

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
  items: CartItem[];
  total: number;
  date: Date;
  status: "completed" | "voided";
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
  voidReason?: string;
  voidedAt?: Date;
  voidedBy?: string;
}

const CATEGORIES = ["All", "Frames", "Lenses", "Contact Lenses", "Solutions", "Accessories"];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

// Helper function to check if warranty is valid (date range based)
const isWarrantyValid = (warrantyStartDate?: Date | string, warrantyEndDate?: Date | string): boolean => {
  if (!warrantyStartDate || !warrantyEndDate) return false;
  
  const now = new Date();
  const startDate = new Date(warrantyStartDate);
  const endDate = new Date(warrantyEndDate);
  
  return now >= startDate && now <= endDate;
};

// Helper function to format warranty date range
const formatWarrantyRange = (startDate?: Date | string, endDate?: Date | string): string => {
  if (!startDate || !endDate) return "No warranty";
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  return `${startStr} - ${endStr}`;
};

export default function SalesPage() {
  const { showNotification, showToastOnly } = useNotification();
  const { 
    products: firebaseProducts, 
    transactions: firebaseTransactions,
    addTransaction,
    voidTransaction,
    updateProduct,
    isOnline,
    userName,
    userRole,
    userId
  } = useFirebase();
  
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [syncing, setSyncing] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientName, setPatientName] = useState("");
  const [tempReservedStock, setTempReservedStock] = useState<Map<string, number>>(new Map());
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [transactionToVoid, setTransactionToVoid] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState<string>("");
  const [warrantyWarning, setWarrantyWarning] = useState<{ show: boolean; message: string; transaction: Transaction | null }>({ show: false, message: "", transaction: null });
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [amountReceive, setAmountReceive] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [viewByMonth, setViewByMonth] = useState<boolean>(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [warrantyStartDate, setWarrantyStartDate] = useState<string>("");
  const [warrantyEndDate, setWarrantyEndDate] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [showOnlineConfirm, setShowOnlineConfirm] = useState(false);

  const searchParams = useSearchParams();

  // Read tab parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'history') {
      setActiveTab('history');
    }
  }, [searchParams]);

  const filteredTransactions = useMemo(() => {
    return (firebaseTransactions as Transaction[]).filter(transaction => {
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
      
      const year = transactionDate.getFullYear();
      const month = String(transactionDate.getMonth() + 1).padStart(2, '0');
      const day = String(transactionDate.getDate()).padStart(2, '0');
      const transactionDateStr = `${year}-${month}-${day}`;
      
      if (viewByMonth) {
        const transactionMonth = transactionDateStr.slice(0, 7);
        const filterMonth = filterDate.slice(0, 7);
        return transactionMonth === filterMonth;
      } else {
        return transactionDateStr === filterDate;
      }
    });
  }, [firebaseTransactions, filterDate, viewByMonth]);

  const productsWithAvailableStock = useMemo(() => {
    return (firebaseProducts as Product[]).map(product => ({
      ...product,
      availableStock: Math.max(0, product.stock - (tempReservedStock.get(product.id) || 0))
    }));
  }, [firebaseProducts, tempReservedStock]);

  const filteredProducts = productsWithAvailableStock.filter((product) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      product.name?.toLowerCase().includes(searchLower) || 
      product.sku?.toLowerCase().includes(searchLower);
    
    const matchesCategory = 
      selectedCategory === "All" || 
      product.category?.trim().toLowerCase() === selectedCategory.trim().toLowerCase();
    
    return matchesSearch && matchesCategory;
  });

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal;

  const handleAddToCartClick = (product: Product) => {
    const currentReserved = tempReservedStock.get(product.id) || 0;
    const actualStock = product.stock;
    const availableForThis = actualStock - currentReserved;
    
    if (availableForThis <= 0) {
      showToastOnly(
        `❌ ${product.name} is out of stock`,
        "error"
      );
      return;
    }
    
    setPendingProduct(product);
    setShowAddToCartModal(true);
  };

  const confirmAddToCart = () => {
    if (pendingProduct) {
      const currentReserved = tempReservedStock.get(pendingProduct.id) || 0;
      const actualStock = pendingProduct.stock;
      const availableForThis = actualStock - currentReserved;
      
      if (availableForThis <= 0) {
        showToastOnly(
          `❌ ${pendingProduct.name} is out of stock`,
          "error"
        );
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
            item.id === pendingProduct.id 
              ? { ...item, quantity: item.quantity + 1 } 
              : item
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
      
      const product = (firebaseProducts as Product[]).find(p => p.id === id);
      if (!product) return prevCart;
      
      const currentReservedForOthers = prevCart
        .filter(i => i.id !== id)
        .reduce((sum, i) => sum + i.quantity, 0);
      
      if (delta > 0 && (currentReservedForOthers + newQty) > product.stock) {
        showToastOnly(
          `Cannot exceed available stock! Only ${product.stock - currentReservedForOthers} left`,
          "error"
        );
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
    setPaymentMethod("cash");
    setAmountReceive("");
    setWarrantyStartDate("");
    setWarrantyEndDate("");
    setReferenceNumber("");
  };

  const processCheckout = async (
    paymentMethodToUse: "cash" | "online",
    amountReceivedForCash?: number
  ) => {
    if (isProcessingCheckout) {
      return;
    }

    setIsProcessingCheckout(true);

    try {
      const currentUser = { 
        name: userName || "Staff",
        id: userId || "staff-unknown",
        role: userRole || "staff"
      };

      const productsBecomingOutOfStock: Array<{ name: string; id: string }> = [];

      // Create the transaction object
      const newTransactionData: any = {
        patientName: patientName || "Walk-in Patient",
        items: cart,
        total: total,
        date: new Date(),
        status: "completed" as const,
        synced: isOnline,
        staffName: currentUser.name,
        staffId: currentUser.id,
        paymentMethod: paymentMethodToUse,
      };

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

      // Add transaction FIRST
      const transactionId = await addTransaction(newTransactionData);

      if (!transactionId) {
        throw new Error("Failed to create transaction - no ID returned");
      }

      // Update product stocks AND totalSold
      for (const cartItem of cart) {
        const product = (firebaseProducts as Product[]).find(p => p.id === cartItem.id);
        if (product) {
          const newStock = product.stock - cartItem.quantity;
          
          // Get current totalSold and calculate new totalSold
          const currentTotalSold = (product as any).totalSold || 0;
          const newTotalSold = currentTotalSold + cartItem.quantity;
          
          await updateProduct(product.id, {
            stock: newStock,
            totalSold: newTotalSold,
            lastMovedDaysAgo: 0
          });
          
          if (newStock <= 0) {
            productsBecomingOutOfStock.push({
              name: product.name,
              id: product.id
            });
          }
          
          if (newStock <= product.reorderPoint && newStock > 0) {
            showNotification(
              `⚠️ ${product.name} is now low stock (${newStock} left)`, 
              "warning", 
              "Low Stock Alert",
              "/inventory",
              {
                productId: product.id,
                productName: product.name,
                newStock,
                reorderPoint: product.reorderPoint
              },
              true,
              true
            );
          }
        }
      }

      const newTransaction: Transaction = {
        id: transactionId,
        ...newTransactionData
      };

      const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
      
      showNotification(
        `Order completed: ${itemCount} item${itemCount !== 1 ? 's' : ''} for ₱${total.toLocaleString()}`, 
        "success", 
        "Sale Completed",
        `/sales?transaction=${transactionId}`,
        {
          transactionId,
          receiptNumber: transactionId.slice(-8).toUpperCase(),
          patientName: patientName || "Walk-in Patient",
          itemCount,
          total,
          items: cart,
          staffName: currentUser.name,
          staffId: currentUser.id
        },
        false,
        true
      );
      
      if (userRole === 'admin') {
        showNotification(
          `🧑‍💼 ${currentUser.name} completed a sale: ₱${total.toLocaleString()} (${itemCount} items)`, 
          "info", 
          "Staff Transaction",
          `/sales?transaction=${transactionId}`,
          {
            transactionId,
            receiptNumber: transactionId.slice(-8).toUpperCase(),
            patientName: patientName || "Walk-in Patient",
            itemCount,
            total,
            staffName: currentUser.name,
            staffId: currentUser.id
          },
          true,
          false
        );
      }

      for (const outOfStockProduct of productsBecomingOutOfStock) {
        showNotification(
          `❌ ${outOfStockProduct.name} is now out of stock`,
          "error",
          "Out of Stock Alert",
          "/inventory",
          {
            productId: outOfStockProduct.id,
            productName: outOfStockProduct.name,
            newStock: 0
          },
          true,
          true
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

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToastOnly("Cart is empty", "error");
      return;
    }

    let parsedAmountReceive: number | undefined = undefined;

    if (paymentMethod === "cash") {
      if (!amountReceive.trim()) {
        showToastOnly("Please enter the amount receive", "error");
        return;
      }

      parsedAmountReceive = parseFloat(amountReceive);
      if (isNaN(parsedAmountReceive) || parsedAmountReceive < total) {
        showToastOnly("Amount receive must be at least ₱" + total.toLocaleString(), "error");
        return;
      }

      await processCheckout("cash", parsedAmountReceive);
    } else if (paymentMethod === "online") {
      setShowOnlineConfirm(true);
    }
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
    currentY += 3;

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

    // Add warranty information if present
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

  const openVoidModal = (transaction: Transaction) => {
    setTransactionToVoid(transaction.id);
    
    // Check if warranty is still valid
    const warrantyValid = isWarrantyValid(transaction.warrantyStartDate, transaction.warrantyEndDate);
    
    if (warrantyValid) {
      const endDate = transaction.warrantyEndDate ? new Date(transaction.warrantyEndDate).toLocaleDateString() : "N/A";
      setWarrantyWarning({
        show: true,
        message: `⚠️ This transaction is still under warranty (expires ${endDate}). Voiding now will void the warranty as well.`,
        transaction: transaction
      });
      setVoidModalOpen(true);
    } else {
      setWarrantyWarning({ show: false, message: "", transaction: null });
      setVoidModalOpen(true);
    }
    
    setVoidReason("");
  };

  const handleVoid = async () => {
    if (transactionToVoid) {
      try {
        // Call voidTransaction with the reason
        await voidTransaction(transactionToVoid, voidReason, userName || "Staff");
        
        setVoidModalOpen(false);
        setTransactionToVoid(null);
        setVoidReason("");
        setWarrantyWarning({ show: false, message: "", transaction: null });
        
        // Show appropriate message based on void reason
        if (voidReason?.toLowerCase().includes('damage') || voidReason?.toLowerCase().includes('damaged')) {
          showNotification(
            `Transaction #${transactionToVoid.slice(-8).toUpperCase()} voided. Items marked as damaged (not returned to stock).`, 
            "warning", 
            "Transaction Voided (Damaged)"
          );
        } else {
          showNotification(
            `Transaction #${transactionToVoid.slice(-8).toUpperCase()} voided successfully. Stock returned.`, 
            "info", 
            "Transaction Voided"
          );
        }
      } catch (error) {
        console.error("Void error:", error);
        showToastOnly("Failed to void transaction.", "error");
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

  return (
    <div className="flex flex-col w-full font-sans p-2 sm:p-4 box-border">
      <div className="shrink-0 flex items-center justify-between mb-2 sm:mb-4 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => setActiveTab("pos")}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 font-bold text-[11px] sm:text-sm rounded-t-lg transition-colors border-b-2 ${activeTab === 'pos' ? 'border-[#0B3C8A] text-[#0B3C8A]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <ShoppingCart size={16} className="sm:w-4.5 sm:h-4.5"/> Point of Sale
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 font-bold text-[11px] sm:text-sm rounded-t-lg transition-colors border-b-2 ${activeTab === 'history' ? 'border-[#0B3C8A] text-[#0B3C8A]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <History size={16} className="sm:w-4.5 sm:h-4.5"/> Transaction History
          </button>
        </div>

        <button 
          onClick={toggleNetwork}
          className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold transition-all shadow-sm ${
            syncing ? 'bg-blue-100 text-blue-600' :
            isOnline ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
          }`}
        >
          {syncing ? <RefreshCcw size={12} className="animate-spin" /> : 
           isOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}
          <span className="hidden sm:inline">{syncing ? 'SYNCING...' : isOnline ? 'ONLINE' : 'OFFLINE MODE'}</span>
        </button>
      </div>

      {activeTab === "pos" ? (
        // POS Content
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
                      title="Clear search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setIsQRScannerOpen(true)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg ${THEME_BG} ${THEME_HOVER} text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm hover:shadow-md`}
                  title="Scan QR Code"
                >
                  <QrCode size={16} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Scan QR</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? `${THEME_BG} text-white shadow-md` : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div 
              className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50/50 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
              style={{ maxHeight: 'calc(100vh - 100px)' }}
            >
              <motion.div 
                key={`product-grid-${selectedCategory}-${searchQuery}`}
                variants={containerVariants} 
                initial="hidden" 
                animate="visible" 
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3"
              >
                <AnimatePresence mode="popLayout">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(product => (
                      <motion.div 
                        key={product.id} 
                        variants={itemVariants} 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => {
                          if ((product.availableStock ?? 0) > 0) {
                            handleAddToCartClick(product);
                          } else {
                            showToastOnly(
                              `❌ ${product.name} is out of stock`,
                              "error"
                            );
                          }
                        }}
                        className={`bg-white p-2 sm:p-3 rounded-xl border border-gray-200 shadow-sm cursor-pointer transition-all flex flex-col ${
                          (product.availableStock ?? 0) === 0 
                            ? 'hover:shadow-none hover:border-gray-200' 
                            : 'hover:shadow-md hover:border-blue-300'
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
                                  (product.availableStock ?? 0) <= 0 ? 'opacity-50 grayscale' : ''
                                }`}
                                priority={false}
                              />
                            </div>
                          ) : (
                            <div className={`w-full h-full ${product.imageColor} flex items-center justify-center transition-colors duration-300`}>
                              <Glasses className={`opacity-20 ${(product.availableStock ?? 0) <= 0 ? 'text-gray-500' : 'text-[#0B3C8A]'} w-1/3 h-1/3`} />
                            </div>
                          )}
                          
                          <div className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur text-gray-600 text-[8px] sm:text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-10">
                            {product.sku}
                          </div>
                          
                          <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 items-end z-10">
                            {(product.availableStock ?? 0) <= product.reorderPoint && (product.availableStock ?? 0) > 0 && (
                              <span className="bg-orange-500 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                LOW
                              </span>
                            )}
                            {(product.availableStock ?? 0) <= 0 && (
                              <span className="bg-red-500 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                OUT
                              </span>
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
                              (product.availableStock ?? 0) <= product.reorderPoint && (product.availableStock ?? 0) > 0 
                                ? 'text-orange-600' 
                                : (product.availableStock ?? 0) <= 0 
                                  ? 'text-red-600' 
                                  : 'text-gray-800'
                            }`}>
                              {product.availableStock}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))
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
                  <ShoppingCart size={16} className="sm:w-4.5 sm:h-4.5"/> Current Order
                </h2>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>
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
            </div>

            <div 
              className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 sm:space-y-2"
              style={{ maxHeight: 'calc(100vh - 280px)', overflowX: 'hidden' }}
            >
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-1 sm:space-y-2">
                  <ShoppingCart size={36} className="sm:w-12 sm:h-12 opacity-20"/>
                  <p className="text-xs sm:text-sm font-medium">Cart is empty</p>
                  <p className="text-[10px] sm:text-xs text-center">Click on products to add them to cart</p>
                </div>
              ) : (
                <AnimatePresence>
                  {cart.map(item => {
                    const product = productsWithAvailableStock.find(p => p.id === item.id);
                    const actualStock = product?.stock || 0;
                    const reservedForOthers = cart
                      .filter(i => i.id !== item.id)
                      .reduce((sum, i) => sum + i.quantity, 0);
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
                                <Image 
                                  src={item.image} 
                                  alt={item.name} 
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                  priority={false}
                                />
                              </div>
                            ) : (
                              <div className={`w-full h-full ${item.imageColor} flex items-center justify-center`}>
                                <Glasses className="opacity-20 text-[#0B3C8A] w-1/2 h-1/2" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-2">
                            <h4 className="text-[10px] sm:text-[11px] font-bold text-gray-800 truncate">{item.name}</h4>
                            <div className="text-[9px] sm:text-[10px] text-gray-600 font-mono">
                              ₱{item.price.toLocaleString()} each
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <div className="flex items-center border border-gray-200 rounded-md">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)} 
                              className="p-0.5 sm:p-1 hover:bg-gray-100 text-gray-600"
                              disabled={item.quantity <= 1}
                            >
                              <Minus size={12}/>
                            </button>
                            <span className="w-4 sm:w-5 text-center text-[10px] sm:text-[11px] font-bold text-gray-700">
                              {item.quantity}
                            </span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)} 
                              className="p-0.5 sm:p-1 hover:bg-gray-100 text-gray-600"
                              disabled={item.quantity >= maxPossible}
                            >
                              <Plus size={12}/>
                            </button>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.id)} 
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 size={14}/>
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
                <div className="space-y-2">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase">Payment Method</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold text-xs transition-all border-2 ${
                        paymentMethod === "cash"
                          ? `border-[#0B3C8A] bg-blue-50 text-[#0B3C8A]`
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      <Banknote size={14} />
                      <span>Cash</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod("online")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold text-xs transition-all border-2 ${
                        paymentMethod === "online"
                          ? `border-[#0B3C8A] bg-blue-50 text-[#0B3C8A]`
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      <CreditCard size={14} />
                      <span>Online</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase flex items-center gap-1">
                    <Shield size={12} />
                    Warranty (Optional)
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

                {paymentMethod === "online" && (
                  <div className="space-y-1.5">
                    <label htmlFor="referenceNumber" className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase flex items-center gap-1">
                      <CreditCard size={12} />
                      Reference Number
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
                            ₱{(parseFloat(amountReceive) - total).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </span>
                        </div>
                      </div>
                    )}

                    {amountReceive && !isNaN(parseFloat(amountReceive)) && parseFloat(amountReceive) < total && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-2 sm:p-2.5">
                        <div className="flex justify-between items-center text-xs sm:text-sm">
                          <span className="font-semibold text-red-800">Short by:</span>
                          <span className="font-bold text-red-600">
                            ₱{(total - parseFloat(amountReceive)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1 sm:space-y-1.5 mb-3 sm:mb-4">
                <div className="flex justify-between text-sm sm:text-base font-black text-gray-800 pt-1.5 sm:pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className={THEME_TEXT}>₱{total.toLocaleString()}</span>
                </div>
              </div>

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
        // Transaction History Section
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col lg:min-h-[calc(99vh-180px)]">
          <div className="shrink-0 p-3 sm:p-4 border-b border-gray-200">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-800">Transactions</h2>
              <p className="text-[10px] sm:text-[11px] text-gray-500">View daily sales, generate receipts, and process refunds.</p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setViewByMonth(false)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                    !viewByMonth
                      ? "bg-[#0B3C8A] text-white shadow-md"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  By Day
                </button>
                <button
                  onClick={() => setViewByMonth(true)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                    viewByMonth
                      ? "bg-[#0B3C8A] text-white shadow-md"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  By Month
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 mb-1.5">
                    {viewByMonth ? "Filter by Month" : "Filter by Date"}
                  </label>
                  {viewByMonth ? (
                    <input 
                      type="month" 
                      value={filterDate.slice(0, 7)}
                      onChange={(e) => setFilterDate(e.target.value + "-01")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    />
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
                <History size={36} className="sm:w-12 sm:h-12 mb-3 sm:mb-4 opacity-20"/>
                <p className="text-xs sm:text-sm">No transactions found for this month.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
  <table className="w-full text-left text-[10px] sm:text-xs whitespace-nowrap">
    <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
      <tr>
        <th className="p-2 sm:p-3">Receipt No.</th>
        <th className="p-2 sm:p-3">Date</th>
        <th className="p-2 sm:p-3">Time</th>
        <th className="p-2 sm:p-3">Patient Name</th>
        <th className="p-2 sm:p-3">User</th>
        <th className="p-2 sm:p-3">Items</th>
        <th className="p-2 sm:p-3 text-right">Amount</th>
        <th className="p-2 sm:p-3 text-center">Payment</th>
        <th className="p-2 sm:p-3 text-center">Warranty</th>
        <th className="p-2 sm:p-3 text-center">Sync</th>
        <th className="p-2 sm:p-3 text-center">Status</th>
        <th className="p-2 sm:p-3 text-right">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {filteredTransactions.length === 0 ? (
        <tr>
          <td colSpan={12} className="py-20 text-center text-gray-400">
            <History size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-xs sm:text-sm">No transactions found for this period.</p>
          </td>
        </tr>
      ) : (
        filteredTransactions.map(trx => {
          const warrantyValid = trx.status === 'completed' && isWarrantyValid(trx.warrantyStartDate, trx.warrantyEndDate);
          return (
            <tr key={trx.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="p-2 sm:p-3 font-mono text-gray-500">{trx.id?.slice(-8).toUpperCase() || 'N/A'}</td>
              <td className="p-2 sm:p-3 text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar size={12} className="text-gray-400" />
                  {formatDate(trx.date)}
                </div>
              </td>
              <td className="p-2 sm:p-3 text-gray-600">{new Date(trx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
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
                  trx.paymentMethod === 'cash' 
                    ? 'bg-blue-100 text-blue-700' 
                    : trx.paymentMethod === 'online'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {trx.paymentMethod || 'N/A'}
                </span>
                {trx.referenceNumber && trx.paymentMethod === 'online' && (
                  <div className="text-[8px] text-gray-500 mt-0.5 font-mono">{trx.referenceNumber}</div>
                )}
              </td>
              <td className="p-2 sm:p-3 text-center">
                {trx.warrantyStartDate && trx.warrantyEndDate ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <Shield size={12} className={warrantyValid ? "text-green-600" : "text-gray-400"} />
                    <span className={`text-[8px] font-bold ${warrantyValid ? "text-green-600" : "text-gray-500"}`}>
                      {warrantyValid ? "Active" : "Expired"}
                    </span>
                    <span className="text-[7px] text-gray-500">{formatWarrantyRange(trx.warrantyStartDate, trx.warrantyEndDate)}</span>
                  </div>
                ) : (
                  <span className="text-gray-400 text-[8px]">None</span>
                )}
              </td>
              <td className="p-2 sm:p-3 text-center">
                {trx.synced ? <CloudCheckIcon /> : <CloudPendingIcon />}
              </td>
              <td className="p-2 sm:p-3 text-center">
                <span className={`px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold rounded-full uppercase ${trx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {trx.status}
                </span>
              </td>
              <td className="p-2 sm:p-3 text-right">
                <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                  <button onClick={() => generateReceipt(trx)} className="p-1 sm:p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Download Receipt">
                    <Receipt size={14}/>
                  </button>
                  {trx.status === 'completed' && (
                    <button onClick={() => openVoidModal(trx)} className="p-1 sm:p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Void / Refund Transaction">
                      <X size={14}/>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })
      )}
    </tbody>
  </table>
</div>
            )}
          </div>
        </motion.div>
      )}

      {/* Add to Cart Confirmation Modal */}
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
                <ShoppingCart size={24} className="sm:w-6 sm:h-6" />
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
                  onClick={() => {
                    setShowAddToCartModal(false);
                    setPendingProduct(null);
                  }} 
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-emerald-600">
                <CheckCircle2 size={28} className="sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-gray-800 mb-1">Payment Successful</h2>
              <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 font-mono">{lastTransaction.id.slice(-8).toUpperCase()}</p>
              <div className="text-2xl sm:text-3xl font-black text-[#0B3C8A] mb-5 sm:mb-6">₱{lastTransaction.total.toLocaleString()}</div>
              
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
                <button onClick={() => generateReceipt(lastTransaction)} className={`w-full py-2 sm:py-2.5 rounded-lg border border-gray-200 text-gray-700 text-xs sm:text-sm font-bold hover:bg-gray-50 flex justify-center items-center gap-2 transition-colors`}>
                  <Receipt size={14} className="sm:w-4 sm:h-4"/> Print / Download Receipt
                </button>
                <button onClick={() => setShowCheckoutModal(false)} className={`w-full py-2 sm:py-2.5 rounded-lg ${THEME_BG} text-white text-xs sm:text-sm font-bold ${THEME_HOVER} transition-colors`}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Void Transaction Confirmation Modal with Reason */}
      <AnimatePresence>
        {voidModalOpen && transactionToVoid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-xl shadow-2xl p-5 sm:p-6 w-full max-w-md">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-red-600">
                <AlertTriangle size={24} className="sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 text-center">Refund Transaction?</h3>
              
              {warrantyWarning.show && warrantyWarning.transaction && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Clock size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-yellow-800">
                      <p className="font-semibold mb-1">Warranty Warning!</p>
                      <p>{warrantyWarning.message}</p>
                      <p className="mt-1 text-yellow-700">Are you sure you want to proceed?</p>
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-[11px] sm:text-xs text-gray-500 mb-4">
                Are you sure you want to void receipt <span className="font-mono font-bold text-gray-700">{transactionToVoid.slice(-8).toUpperCase()}</span>? 
                This will record the sale as refunded.
              </p>
              
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Reason for Void/Refund <span className="text-gray-400">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Please provide a reason for voiding this transaction..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700 placeholder-gray-400 resize-none"
                />
              </div>
              
              <div className="flex gap-2 sm:gap-3">
                <button 
                  onClick={() => {
                    setVoidModalOpen(false);
                    setTransactionToVoid(null);
                    setVoidReason("");
                    setWarrantyWarning({ show: false, message: "", transaction: null });
                  }} 
                  className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleVoid} 
                  className="flex-1 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-md"
                >
                  Confirm Void & Refund
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {isQRScannerOpen && (
          <QRScannerModal
            mode="cart"
            onClose={() => setIsQRScannerOpen(false)}
            products={firebaseProducts as Product[]}
            onProductFound={(productId) => {
              const product = productsWithAvailableStock.find(p => p.id === productId);
              if (product) {
                handleAddToCartClick(product);
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
                <div className="border-t border-gray-200 pt-2.5">
                  <div className="flex justify-between text-base">
                    <span className="font-semibold text-gray-900">Total Amount:</span>
                    <span className="font-bold text-[#0B3C8A]">₱{total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setShowOnlineConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm sm:text-base font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmOnlinePayment}
                  className="flex-1 px-4 py-2 bg-[#0B3C8A] text-white rounded-lg text-sm sm:text-base font-medium hover:bg-[#0a2f6a] transition-colors shadow-md"
                >
                  Confirm Payment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function CloudCheckIcon() {
  return <div className="flex justify-center" title="Synced to Server"><CheckCircle2 size={12} className="sm:w-3.5 sm:h-3.5 text-emerald-500" /></div>;
}

function CloudPendingIcon() {
  return <div className="flex justify-center" title="Pending Sync (Offline)"><WifiOff size={12} className="sm:w-3.5 sm:h-3.5 text-red-400" /></div>;
}