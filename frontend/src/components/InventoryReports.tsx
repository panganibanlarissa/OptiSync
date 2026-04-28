"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Filter,
  X,
  Search,
  ChevronDown,
  BarChart3,
  Eye,
  Edit2,
  QrCode,
  ArrowRightLeft,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ProductModal, { ProductFormData } from "./ProductModal";
import QRCodeModal from "./QRCodeModal";
import QRScannerModal from "./QRScannerModal";
import ProductDetailsModal from "./ProductDetailsModal";
import { useFirebase } from "@/context/FirebaseContext";
import { useNotification } from "./NotificationProvider";

// Use the Product type from FirebaseContext to ensure consistency
import type { Product } from "@/context/FirebaseContext";

type InventoryData = Product;

interface ReportFilters {
  category: string;
  stockStatus: string; // "all", "low", "out", "healthy", "deadstock"
  searchQuery: string;
  dateRange: { startDate: string; endDate: string };
}

export default function InventoryReports({
  products,
  onProductDelete,
  onProductAdjust,
  userRole,
  onAddProduct,
  onOpenScanner,
  onProductArchive,
  searchQuery,
  setSearchQuery,
}: {
  products: InventoryData[];
  onProductDelete?: (id: string) => void;
  onProductAdjust?: (id: string, newStock: number, reason: string) => void;
  userRole?: string | null;
  onAddProduct?: (data: ProductFormData) => Promise<any>;
  onOpenScanner?: () => void;
  onProductArchive?: (id: string, archived: boolean) => Promise<void>;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
}) {
  const { updateProduct, transactions, deleteProduct } = useFirebase();
  const { showNotification, showToastOnly } = useNotification();

  const resetFilters = () => {
    setFilters({
      category: "All Categories",
      stockStatus: "all",
      searchQuery: "",
      dateRange: {
        startDate: "",
        endDate: ""
      },
    });
    
    if (setSearchQuery) setSearchQuery("");
  };

  const [filters, setFilters] = useState<ReportFilters>({
    category: "All Categories",
    stockStatus: "all",
    searchQuery: "",
    dateRange: {
      startDate: "",
      endDate: ""
    },
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showArchiveList, setShowArchiveList] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormData | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductFormData | null>(null);
  const [viewingProduct, setViewingProduct] = useState<InventoryData | null>(null);
  const [selectedQRProduct, setSelectedQRProduct] = useState<{ id: string; sku: string; name: string; price: number } | null>(null);
  const [addingProduct, setAddingProduct] = useState<ProductFormData | null>(null);
  const [showLocalScanner, setShowLocalScanner] = useState(false);
  const [localScannerMode, setLocalScannerMode] = useState<"search" | "adjust">("search");
  const [pendingArchive, setPendingArchive] = useState<null | { id: string; archived: boolean; name?: string }>(null);
  
  const effectiveSearchQuery = typeof searchQuery !== "undefined" ? searchQuery : filters.searchQuery;

  // Helper function to calculate days since last sale for a product
  const getDaysSinceLastSale = (product: InventoryData, today: Date): number => {
    // Get completed transactions
    const completedTransactions = (transactions || []).filter(t => t.status === 'completed');
    
    // Find all sales for this product
    const salesForProduct = completedTransactions
      .filter(t => t.items.some((item: any) => item.id === product.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const lastSale = salesForProduct[0];
    
    if (lastSale) {
      const lastSaleDate = new Date(lastSale.date);
      lastSaleDate.setHours(0, 0, 0, 0);
      return Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      // Never sold - use creation date or fallback
      let createdDate: Date | null = null;
      
      if (product.createdAt) {
        try {
          if (typeof (product as any).createdAt.toDate === 'function') {
            createdDate = (product as any).createdAt.toDate();
          } else if (product.createdAt instanceof Date) {
            createdDate = product.createdAt;
          } else if (typeof product.createdAt === 'string') {
            createdDate = new Date(product.createdAt);
          }
        } catch (e) {
          // ignore
        }
      }
      
      if (createdDate) {
        createdDate.setHours(0, 0, 0, 0);
        return Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      return product.lastMovedDaysAgo || 0;
    }
  };

  // Check if a product is deadstock (30+ days without sales)
  const isProductDeadstock = (product: InventoryData, today: Date): boolean => {
    // Archived or deleted products are not considered for deadstock status
    if ((product as any).archived === true) return false;
    
    const daysSinceSale = getDaysSinceLastSale(product, today);
    return daysSinceSale >= 30;
  };

  // Filter products based on selected filters
  const filteredProducts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return products.filter((product) => {
      // Exclude archived products from the main report list
      if ((product as any).archived === true) return false;
      
      // Category filter
      const categoryMatch =
        filters.category === "All Categories" ||
        product.category === filters.category;

      // Search query filter
      const searchMatch =
        product.name.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
        product.id.toLowerCase().includes(effectiveSearchQuery.toLowerCase());

      // Check deadstock status
      const isDeadstock = isProductDeadstock(product, today);
      
      // Stock status filter (updated to include deadstock)
      let stockStatusMatch = true;
      if (filters.stockStatus !== "all") {
        const isLowStock = product.stock <= product.reorderPoint && product.stock > 0 && !isDeadstock;
        const isOutOfStock = product.stock === 0 && !isDeadstock;

        if (filters.stockStatus === "low") {
          stockStatusMatch = isLowStock;
        } else if (filters.stockStatus === "out") {
          stockStatusMatch = isOutOfStock;
        } else if (filters.stockStatus === "healthy") {
          stockStatusMatch = !isLowStock && !isOutOfStock && product.stock > 0 && !isDeadstock;
        } else if (filters.stockStatus === "deadstock") {
          stockStatusMatch = isDeadstock && product.stock > 0;
        }
      }

      // Date range filter
      let dateMatch = true;
      if (filters.dateRange.startDate || filters.dateRange.endDate) {
        let createdDate: string | null = null;
        
        if (product.createdAt) {
          try {
            let date: Date | null = null;
            
            if (product.createdAt && typeof product.createdAt.toDate === 'function') {
              date = product.createdAt.toDate();
            } else if (typeof product.createdAt === 'string') {
              date = new Date(product.createdAt);
            } else if (product.createdAt instanceof Date) {
              date = product.createdAt;
            }
            
            if (date && !isNaN(date.getTime())) {
              createdDate = date.toISOString().split('T')[0];
            }
          } catch (e) {
            createdDate = null;
          }
        }
        
        if (createdDate) {
          if (filters.dateRange.startDate) {
            dateMatch = dateMatch && createdDate >= filters.dateRange.startDate;
          }
          if (filters.dateRange.endDate) {
            dateMatch = dateMatch && createdDate <= filters.dateRange.endDate;
          }
        } else if (filters.dateRange.startDate || filters.dateRange.endDate) {
          dateMatch = false;
        }
      }

      return categoryMatch && searchMatch && stockStatusMatch && dateMatch;
    });
  }, [products, filters, effectiveSearchQuery, transactions]);

  const handleFilterChange = (key: keyof ReportFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleEditProduct = (product: InventoryData) => {
    setEditingProduct({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      specifications: product.specifications || "",
      baseCost: product.baseCost,
      markupPrice: product.markupPrice,
      supplierInfo: product.supplierInfo,
      stock: product.stock,
      lastMovedDaysAgo: product.lastMovedDaysAgo,
      imageColor: product.imageColor,
      image: product.image,
      leadTimeDays: product.leadTimeDays,
      reorderPoint: product.reorderPoint,
      expiryDate: product.expiryDate ?? undefined,
      batchNumber: product.batchNumber,
    });
  };

  const handleAdjustProduct = (product: InventoryData) => {
    setAdjustingProduct({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      specifications: product.specifications || "",
      baseCost: product.baseCost,
      markupPrice: product.markupPrice,
      supplierInfo: product.supplierInfo,
      stock: product.stock,
      lastMovedDaysAgo: product.lastMovedDaysAgo,
      imageColor: product.imageColor,
      image: product.image,
      leadTimeDays: product.leadTimeDays,
      reorderPoint: product.reorderPoint,
      expiryDate: product.expiryDate ?? undefined,
      batchNumber: product.batchNumber,
      adjustmentReason: "Manual Count",
    });
  };

  // Handle permanent product deletion
  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct(id);
      showToastOnly("Product permanently deleted", "success");
    } catch (error) {
      console.error("Error deleting product:", error);
      showNotification("Failed to delete product", "error");
    }
  };

  const handleSaveProduct = async (formData: ProductFormData) => {
    try {
      if (adjustingProduct && onProductAdjust) {
        onProductAdjust(formData.id!, Number(formData.stock), formData.adjustmentReason || "Manual adjustment");
        setAdjustingProduct(null);
        showToastOnly(`Stock updated for ${formData.name}`, "success");
        return;
      }

      if (formData.id) {
        const updates: Partial<Product> = {
          sku: formData.sku,
          name: formData.name,
          category: formData.category,
          specifications: formData.specifications,
          baseCost: formData.baseCost,
          markupPrice: formData.markupPrice,
          supplierInfo: formData.supplierInfo,
          stock: formData.stock,
          lastMovedDaysAgo: formData.lastMovedDaysAgo,
          imageColor: formData.imageColor,
          image: formData.image,
          leadTimeDays: formData.leadTimeDays,
          reorderPoint: formData.reorderPoint,
        };
        
        if (formData.expiryDate) {
          updates.expiryDate = formData.expiryDate;
        }
        
        if (formData.batchNumber) {
          updates.batchNumber = formData.batchNumber;
        }
        
        Object.keys(updates).forEach(key => {
          if (updates[key as keyof Product] === undefined) {
            delete updates[key as keyof Product];
          }
        });
        
        await updateProduct(formData.id, updates);
        
        setEditingProduct(null);
        showToastOnly(`Product "${formData.name}" updated successfully`, "success");
      }
    } catch (error) {
      console.error('Error saving product:', error);
      showNotification('Failed to save product', 'error');
    }
  };

  // Helper function to calculate product status (updated to include Deadstock)
  const getProductStatus = (product: InventoryData) => {
    const statuses: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if product is deadstock (30+ days without sales) - PRIORITY 1
    const isDeadstock = isProductDeadstock(product, today);
    if (isDeadstock && product.stock > 0) {
      statuses.push("Deadstock");
    }
    
    // Check expiry status - if expired/expiring, show expiry status
    if (product.expiryDate) {
      const expiryDate = new Date(product.expiryDate);
      expiryDate.setHours(0, 0, 0, 0);
      
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        if (statuses.length === 0 || statuses[0] !== "Deadstock") {
          statuses.unshift("Expired");
        }
      } else if (daysUntilExpiry <= 30) {
        if (statuses.length === 0 || statuses[0] !== "Deadstock") {
          statuses.unshift("Expiring");
        }
      }
    }
    
    // Check if dead (legacy flag)
    const isDead = (product as any).isDead || (product as any).is_dead;
    if (isDead && !statuses.includes("Deadstock")) {
      statuses.push("Dead");
    }
    
    // Check stock status (only if not deadstock)
    if (!isDeadstock) {
      const isLowStock = product.stock <= product.reorderPoint;
      const isOutOfStock = product.stock === 0;
      
      if (isOutOfStock) {
        statuses.push("Out");
      } else if (isLowStock) {
        statuses.push("Low");
      } else if (statuses.length === 0) {
        statuses.push("OK");
      }
    } else if (statuses.length === 0) {
      statuses.push("Deadstock");
    }
    
    return statuses;
  };

  const getStatusColor = (statuses: string[]) => {
    if (statuses.includes("Deadstock")) {
      return "text-gray-700 bg-gray-200 border border-gray-400";
    }
    if (statuses.includes("Expired")) {
      return "text-red-700 bg-red-100 border border-red-300";
    }
    if (statuses.includes("Dead")) {
      return "text-gray-700 bg-gray-200 border border-gray-400";
    }
    if (statuses.includes("Out")) {
      return "text-red-600 bg-red-50 border border-red-200";
    }
    if (statuses.includes("Expiring")) {
      return "text-amber-700 bg-amber-100 border border-amber-300";
    }
    if (statuses.includes("Low")) {
      return "text-orange-600 bg-orange-50 border border-orange-200";
    }
    return "text-green-600 bg-green-50 border border-green-200";
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const tableData = filteredProducts.map((product) => {
      const marginRaw = product.markupPrice - product.baseCost;
      const marginPercent = product.baseCost > 0 ? ((marginRaw / product.baseCost) * 100).toFixed(1) : "0";
      
      return [
        product.sku,
        product.name,
        product.category,
        product.specifications || "N/A",
        ((product as any).beginningInventory || 0).toString(),
        ((product as any).totalSold || 0).toString(),
        ((product as any).damageExchanged || 0).toString(),
        product.stock.toString(),
        `PHP ${product.baseCost.toLocaleString()}`,
        `PHP ${product.markupPrice.toLocaleString()}`,
        product.expiryDate ? new Date(product.expiryDate).toLocaleDateString("en-US") : "N/A",
        getProductStatus(product).join(" | "),
      ];
    });

    const addHeader = (pageNumber: number) => {
      doc.setPage(pageNumber);
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("M.T. Olaso Optical Clinic", pageWidth / 2, 15, { align: "center" });
      
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text("Inventory Stock Report", pageWidth / 2, 22, { align: "center" });
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, pageWidth / 2, 28, { align: "center" });
      
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 30, pageWidth - 14, 30);
    };

    let filterSummary = [];
    if (filters.category !== "All Categories") {
      filterSummary.push(`Category: ${filters.category}`);
    }
    if (filters.stockStatus !== "all") {
      filterSummary.push(
        `Stock Status: ${filters.stockStatus === 'deadstock' ? 'Deadstock' : filters.stockStatus.charAt(0).toUpperCase() + filters.stockStatus.slice(1)}`
      );
    }
    if (filters.dateRange.startDate || filters.dateRange.endDate) {
      filterSummary.push(
        `Date Range: ${filters.dateRange.startDate} to ${filters.dateRange.endDate}`
      );
    }
    if (effectiveSearchQuery) {
      filterSummary.push(`Search: ${effectiveSearchQuery}`);
    }

    addHeader(1);

    if (filterSummary.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Filters: ${filterSummary.join(" | ")}`, 14, 37);
    }

    autoTable(doc, {
      head: [
        [
          "SKU",
          "Product Name",
          "Category",
          "Specs",
          "Beg. Inv.",
          "Sold",
          "Damage",
          "Stock",
          "Cost",
          "Price",
          "Expiry",
          "Status",
        ],
      ],
      body: tableData,
      startY: filterSummary.length > 0 ? 42 : 37,
      margin: { top: 37, right: 10, bottom: 30, left: 10 },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "middle",
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { halign: "center", cellWidth: 15 },
        5: { halign: "center", cellWidth: 15 },
        6: { halign: "center", cellWidth: 15 },
        7: { halign: "center", cellWidth: 15 },
        8: { halign: "right", cellWidth: 20 },
        9: { halign: "right", cellWidth: 20 },
        10: { halign: "center", cellWidth: 22 },
        11: { cellWidth: 25 },
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
    });

    const totalPages = doc.getNumberOfPages();
    const lineY = pageHeight - 15;
    
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      if (i > 1) {
        addHeader(i);
      }
      
      doc.setDrawColor(200, 200, 200);
      doc.line(14, lineY, pageWidth - 14, lineY);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const footerText = "Inventory Stock Report - M.T. Olaso Optical Clinic";
      doc.text(footerText, 14, lineY + 5);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, lineY + 5, { align: "right" });
    }

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Summary", 14, finalY);
    
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Products: ${filteredProducts.length}`, 14, finalY + 8);
    
    const totalStock = filteredProducts.reduce((sum, p) => sum + p.stock, 0);
    doc.text(`Total Units in Stock: ${totalStock}`, 14, finalY + 14);
    
    const totalValue = filteredProducts.reduce(
      (sum, p) => sum + p.markupPrice * p.stock,
      0
    );
    doc.text(`Total Inventory Value: PHP ${totalValue.toLocaleString()}`, 14, finalY + 20);
    
    const lowStockCount = filteredProducts.filter(
      (p) => p.stock <= p.reorderPoint && p.stock > 0 && !isProductDeadstock(p, new Date())
    ).length;
    doc.text(`Low Stock Items: ${lowStockCount}`, 14, finalY + 26);
    
    const deadstockCount = filteredProducts.filter(p => isProductDeadstock(p, new Date()) && p.stock > 0).length;
    doc.text(`Deadstock Items (30+ days unsold): ${deadstockCount}`, 14, finalY + 32);

    doc.save(
      `Inventory_Report_${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  const categories = ["All Categories", ...new Set(products.map((p) => p.category))];

  const deadstockCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return products.filter(p => !(p as any).archived && isProductDeadstock(p, today) && p.stock > 0).length;
  }, [products, transactions]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 p-3 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-[#0B3C8A] rounded-lg shadow-md">
                <BarChart3 className="text-white" size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-lg font-bold text-gray-800 leading-tight">
                  Inventory
                </h2>
                <p className="text-[9px] sm:text-[11px] text-gray-500">
                  Browse and manage inventory items.
                </p>
              </div>
            </div>

            <div className="flex flex-row flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  if (onOpenScanner) {
                    onOpenScanner();
                    return;
                  }
                  setLocalScannerMode("adjust");
                  setShowLocalScanner(true);
                }}
                className="flex items-center justify-center gap-1.5 sm:gap-2 border border-[#0B3C8A] hover:border-blue-400 bg-blue-50 text-[#0B3C8A] px-3 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors hover:bg-blue-200 whitespace-nowrap"
                title="Scan QR Code to add stock"
              >
                <QrCode size={14} />
                <span className="hidden sm:inline">Scan QR</span>
                <span className="sm:hidden">Scan</span>
              </button>
              
              <button
                onClick={() => setAddingProduct({
                  sku: "",
                  name: "",
                  category: "",
                  specifications: "",
                  baseCost: 0,
                  markupPrice: 0,
                  supplierInfo: "",
                  stock: 0,
                  lastMovedDaysAgo: 0,
                  imageColor: "bg-slate-100",
                  image: null,
                  leadTimeDays: 0,
                  reorderPoint: 0,
                })}
                className="flex items-center justify-center gap-1.5 sm:gap-2 bg-[#0B3C8A] hover:bg-[#082F6E] text-white px-3 py-1 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors hover:shadow-sm whitespace-nowrap"
              >
                <span className="text-lg font-bold mr-1">+</span>
                <span className="hidden sm:inline">Add New Product</span>
                <span className="sm:hidden">Add</span>
              </button>

              {userRole === 'admin' && (
                <>
                  <button
                    onClick={() => setShowArchiveList(true)}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 border border-[#0B3C8A] hover:border-blue-400 bg-blue-50 text-[#0B3C8A] px-3 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors hover:bg-blue-200 whitespace-nowrap"
                  >
                    Archive List
                  </button>

                  <button
                    onClick={exportToPDF}
                    disabled={filteredProducts.length === 0}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 border bg-[#0B3C8A] hover:bg-[#082F6E] text-white px-3 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors hover:shadow-sm whitespace-nowrap"
                  >
                    <FileText size={14} />
                    <span className="hidden sm:inline"> Download PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filters Section */}
        <div className="shrink-0 px-3 sm:px-5 pt-3 sm:pt-4 bg-slate-50 border-b border-gray-100">
          <div className="relative mb-3">
            <div className="flex items-stretch">
              <div className="relative flex-grow">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Search SKU or Item..."
                  value={effectiveSearchQuery}
                  onChange={(e) => {
                    if (setSearchQuery) setSearchQuery(e.target.value);
                    else handleFilterChange("searchQuery", e.target.value);
                  }}
                  className="w-full pl-8 sm:pl-9 pr-20 sm:pr-24 py-1.5 sm:py-2 rounded-l-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] transition-all text-gray-700 placeholder-gray-400"
                />
                {effectiveSearchQuery && (
                  <button
                    onClick={() => {
                      if (setSearchQuery) setSearchQuery("");
                      else handleFilterChange("searchQuery", "");
                    }}
                    className="absolute right-12 sm:right-14 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  onClick={() => {
                    setLocalScannerMode("search");
                    setShowLocalScanner(true);
                  }}
                  className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0B3C8A] transition-colors p-1"
                  title="Scan QR code to search product"
                >
                  <QrCode size={14} />
                </button>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 border border-l-0 border-gray-300 rounded-r-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  showFilters 
                    ? "bg-[#0B3C8A] text-white border-[#0B3C8A]" 
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Filter size={14} />
                <span>Filters</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${showFilters ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          </div>

          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 pb-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="text-[10px] sm:text-[11px] font-semibold text-gray-600 block mb-1.5">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => handleFilterChange("category", e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] transition-all"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] sm:text-[11px] font-semibold text-gray-600 block mb-1.5">
                    Stock Status
                  </label>
                  <select
                    value={filters.stockStatus}
                    onChange={(e) => handleFilterChange("stockStatus", e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] transition-all"
                  >
                    <option value="all">All Status</option>
                    <option value="healthy">Healthy Stock</option>
                    <option value="low">Low Stock</option>
                    <option value="out">Out of Stock</option>
                    <option value="deadstock">Deadstock</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] sm:text-[11px] font-semibold text-gray-600 block mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateRange.startDate}
                    onChange={(e) =>
                      handleFilterChange("dateRange", {
                        ...filters.dateRange,
                        startDate: e.target.value,
                      })
                    }
                    onKeyDown={handleDateKeyDown}
                    className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] sm:text-[11px] font-semibold text-gray-600 block mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateRange.endDate}
                    onChange={(e) =>
                      handleFilterChange("dateRange", {
                        ...filters.dateRange,
                        endDate: e.target.value,
                      })
                    }
                    onKeyDown={handleDateKeyDown}
                    className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] text-gray-900"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={resetFilters}
                    className="w-full px-2.5 py-2 text-[10px] sm:text-[11px] font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Results Summary and Table */}
        <div className="flex-1 overflow-auto p-3 sm:p-5 bg-gray-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-4">
            <div className="bg-white p-2 sm:p-3 rounded-lg border border-gray-200">
              <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium">
                Total Products
              </p>
              <p className="text-lg sm:text-2xl font-bold text-gray-800 mt-1">
                {filteredProducts.length}
              </p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded-lg border border-gray-200">
              <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium">
                Total Units
              </p>
              <p className="text-lg sm:text-2xl font-bold text-gray-800 mt-1">
                {filteredProducts.reduce((sum, p) => sum + p.stock, 0)}
              </p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded-lg border border-gray-200">
              <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium">
                Inventory Value
              </p>
              <p className="text-lg sm:text-2xl font-bold text-gray-800 mt-1">
                ₱
                {(
                  filteredProducts.reduce((sum, p) => sum + p.markupPrice * p.stock, 0) / 1000
                ).toFixed(0)}
                K
              </p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded-lg border border-gray-200">
              <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium">
                Low Stock Items
              </p>
              <p className="text-lg sm:text-2xl font-bold text-orange-600 mt-1">
                {filteredProducts.filter(
                  (p) => p.stock <= p.reorderPoint && p.stock > 0 && !isProductDeadstock(p, new Date())
                ).length}
              </p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded-lg border border-gray-200">
              <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium">
                Deadstock
              </p>
              <p className="text-lg sm:text-2xl font-bold text-gray-600 mt-1">
                {deadstockCount}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {filteredProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] sm:text-xs">
                  <thead className="bg-slate-50 border-b border-gray-200">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold text-gray-700">
                        SKU
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold text-gray-700">
                        Product Name
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold text-gray-700">
                        Category
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700">
                        Sold
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700">
                        Damaged
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700">
                        Total Stock
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.map((product) => {
                      const statuses = getProductStatus(product);
                      const statusColor = getStatusColor(statuses);
                      const statusText = statuses.join(" | ");
                      const isArchived = (product as any).archived === true;
                      const isDimmed = isArchived || product.stock === 0;

                      return (
                        <tr
                          key={product.id}
                          className={`transition-colors ${isDimmed ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono text-gray-600">
                            {product.sku}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-800 max-w-xs truncate">
                            {product.name}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-600">
                            {product.category}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-800">
                            {(product as any).totalSold || 0}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-800">
                            {(product as any).damageExchanged || 0}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-[#0B3C8A]">
                            {product.stock}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-bold">
                            <span className={`inline-block px-2 py-0.5 rounded ${statusColor}`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                title="View Details"
                                onClick={() => setViewingProduct(product)}
                                className="p-1.5 hover:bg-blue-100 rounded transition-colors text-blue-600"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                title="Adjust Stock"
                                onClick={() => handleAdjustProduct(product)}
                                className="p-1.5 hover:bg-purple-100 rounded transition-colors text-purple-600"
                              >
                                <ArrowRightLeft size={14} />
                              </button>
                              <button
                                title="Edit"
                                onClick={() => handleEditProduct(product)}
                                className="p-1.5 hover:bg-orange-100 rounded transition-colors text-orange-600"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                title="QR Code"
                                onClick={() => setSelectedQRProduct({ id: product.id, sku: product.sku, name: product.name, price: product.markupPrice })}
                                className="p-1.5 hover:bg-green-100 rounded transition-colors text-green-600"
                              >
                                <QrCode size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-xs sm:text-sm">
                  No products match your filters.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Archive List Modal */}
        {showArchiveList && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-auto max-h-[80vh]">
              <div className="flex justify-between items-center p-3 border-b">
                <h3 className="font-bold text-gray-800 text-lg">Archive List</h3>
                <button onClick={() => setShowArchiveList(false)} className="text-gray-500 px-2 py-1 hover:text-gray-700 transition-colors">Close</button>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-700 border-b border-gray-200">
                      <th className="py-2 font-semibold">SKU</th>
                      <th className="py-2 font-semibold">Name</th>
                      <th className="py-2 font-semibold">Category</th>
                      <th className="py-2 font-semibold">Status</th>
                      <th className="py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.filter(p => (p as any).archived === true).map((p) => (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-2 font-mono text-gray-800">{p.sku}</td>
                        <td className="py-2 text-gray-800 font-medium">{p.name}</td>
                        <td className="py-2 text-gray-700">{p.category}</td>
                        <td className="py-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                            {(p as any).deleted ? 'Deleted' : 'Archived'}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            {userRole === 'admin' ? (
                              <button 
                                onClick={() => setPendingArchive({ id: p.id, archived: false, name: p.name })} 
                                className="px-3 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium hover:bg-green-100 transition-colors"
                              >
                                Unarchive
                              </button>
                            ) : (
                              <span className="text-sm text-gray-500">N/A</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Archive Confirmation Modal */}
        {pendingArchive && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
              <h3 className="font-bold text-xl text-gray-900 mb-3">
                {pendingArchive.archived ? "Confirm Archive" : "Confirm Unarchive"}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to {pendingArchive.archived ? "archive" : "unarchive"} "<span className="font-semibold text-gray-800">{pendingArchive.name || pendingArchive.id}</span>"?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setPendingArchive(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (onProductArchive) {
                      try {
                        await onProductArchive(pendingArchive.id, pendingArchive.archived);
                      } catch (err) {
                        console.error('Archive action failed', err);
                      }
                    }
                    setPendingArchive(null);
                    setShowArchiveList(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#0B3C8A] text-white font-medium text-sm hover:bg-[#082F6E] transition-colors shadow-sm"
                >
                  {pendingArchive.archived ? "Confirm Archive" : "Confirm Unarchive"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Product Modal - with delete functionality */}
        {editingProduct && (
          <ProductModal
            mode="edit"
            product={editingProduct}
            products={products}
            onClose={() => setEditingProduct(null)}
            onSave={handleSaveProduct}
            onDelete={handleDeleteProduct}
            onArchive={onProductArchive}
            userRole={userRole}
          />
        )}

        {/* Adjust Stock Modal */}
        {adjustingProduct && (
          <ProductModal
            mode="adjust"
            product={adjustingProduct}
            products={products}
            onClose={() => setAdjustingProduct(null)}
            onSave={handleSaveProduct}
            userRole={userRole}
          />
        )}

        {/* Add Product Modal */}
        {addingProduct && (
          <ProductModal
            mode="add"
            product={addingProduct}
            products={products}
            onClose={() => setAddingProduct(null)}
            onSave={async (data: ProductFormData) => {
              try {
                let addedProductId: string | undefined;
                if (onAddProduct) {
                  const result = await onAddProduct(data);
                  if (typeof result === "string") {
                    addedProductId = result;
                  }
                } else {
                  await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                  });
                }

                const fallbackProduct = products.find(
                  (p) => p.sku === data.sku || (p.name === data.name && p.category === data.category)
                );
                const resolvedProductId = addedProductId || fallbackProduct?.id;

                if (resolvedProductId) {
                  setSelectedQRProduct({
                    id: resolvedProductId,
                    sku: data.sku,
                    name: data.name,
                    price: data.markupPrice,
                  });
                }
              } catch (err) {
                console.error('Failed to add product from reports modal', err);
              } finally {
                setAddingProduct(null);
              }
            }}
            userRole={userRole}
          />
        )}

        {/* Local QR Scanner */}
        {showLocalScanner && (
          <QRScannerModal
            onClose={() => setShowLocalScanner(false)}
            products={products.map(p => ({ id: p.id, sku: p.sku, name: p.name, stock: p.stock }))}
            onProductFound={(id: string) => {
              setShowLocalScanner(false);
              const prod = products.find(p => p.id === id);
              if (!prod) return;
              if (localScannerMode === "search") {
                if (setSearchQuery) setSearchQuery(prod.id);
                else handleFilterChange("searchQuery", prod.id);
                return;
              }
              if (onProductAdjust) {
                onProductAdjust(prod.id, prod.stock + 1, "Received via QR Scan");
              }
            }}
            mode={localScannerMode}
          />
        )}

        {/* QR Code Modal */}
        {selectedQRProduct && (
          <QRCodeModal
            productId={selectedQRProduct.id}
            productSku={selectedQRProduct.sku}
            productName={selectedQRProduct.name}
            productPrice={selectedQRProduct.price}
            onClose={() => setSelectedQRProduct(null)}
          />
        )}

        {/* Product Details Modal */}
        {viewingProduct && (
          <ProductDetailsModal
            product={viewingProduct}
            onClose={() => setViewingProduct(null)}
          />
        )}
      </motion.div>
    </>
  );
}