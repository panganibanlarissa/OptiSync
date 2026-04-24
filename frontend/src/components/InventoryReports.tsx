"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Download,
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
import Papa from "papaparse";
import ProductModal, { ProductFormData } from "./ProductModal";
import QRCodeModal from "./QRCodeModal";
import QRScannerModal from "./QRScannerModal";
import ProductDetailsModal from "./ProductDetailsModal";

interface InventoryData {
  id: string;
  sku: string;
  name: string;
  category: string;
  specifications: string;
  baseCost: number;
  markupPrice: number;
  supplierInfo: string;
  stock: number;
  lastMovedDaysAgo: number;
  imageColor: string;
  image: string | null;
  leadTimeDays: number;
  reorderPoint: number;
  expiryDate?: string | null;
  batchNumber?: string;
  totalSold?: number;
  beginningInventory?: number;
  damageExchanged?: number;
  isDead?: boolean;
  is_dead?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

interface ReportFilters {
  category: string;
  stockStatus: string; // "all", "low", "out", "healthy"
  priceRange: { min: number; max: number };
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

  const resetFilters = () => {
  setFilters({
    category: "All Categories",
    stockStatus: "all",
    priceRange: { min: 0, max: 999999 },
    searchQuery: "",
    dateRange: {
      startDate: "",  // Reset to empty (no date filter)
      endDate: ""     // Reset to empty (no date filter)
    },
  });
  
  if (setSearchQuery) setSearchQuery("");
  setMinPrice("0");
  setMaxPrice("999999");
};

  const earliestProductDate = useMemo<string>(() => {
    const parsedDates: Date[] = products.map((product) => {
      try {
        if (product.createdAt) {
          if (typeof (product as any).createdAt.toDate === 'function') {
            return (product as any).createdAt.toDate();
          }
          if (typeof product.createdAt === 'string') {
            const d = new Date(product.createdAt);
            if (!isNaN(d.getTime())) return d;
          }
          if (product.createdAt instanceof Date) {
            return product.createdAt;
          }
        }
      } catch (e) {
        // ignore
      }
      return null as any;
    }).filter(Boolean) as Date[];

    if (parsedDates.length === 0) {
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    const min = parsedDates.reduce((a, b) => (a < b ? a : b));
    return min.toISOString().split('T')[0];
  }, [products]);

  const [filters, setFilters] = useState<ReportFilters>({
    category: "All Categories",
    stockStatus: "all",
    priceRange: { min: 0, max: 999999 },
    searchQuery: "",
    dateRange: {
      startDate:  "",
      endDate:  ""
    },
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showArchiveList, setShowArchiveList] = useState(false);
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("999999");
  const [editingProduct, setEditingProduct] = useState<ProductFormData | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductFormData | null>(null);
  const [viewingProduct, setViewingProduct] = useState<InventoryData | null>(null);
  const [selectedQRProduct, setSelectedQRProduct] = useState<{ id: string; sku: string; name: string; price: number } | null>(null);
  const [addingProduct, setAddingProduct] = useState<ProductFormData | null>(null);
  const [showLocalScanner, setShowLocalScanner] = useState(false);
  const [localScannerMode, setLocalScannerMode] = useState<"search" | "adjust">("search");
  const [pendingArchive, setPendingArchive] = useState<null | { id: string; archived: boolean; name?: string }>(null);
  const effectiveSearchQuery = typeof searchQuery !== "undefined" ? searchQuery : filters.searchQuery;

  // Filter products based on selected filters
  const filteredProducts = useMemo(() => {
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

      // Stock status filter
      let stockStatusMatch = true;
      if (filters.stockStatus !== "all") {
        const isLowStock = product.stock <= product.reorderPoint;
        const isOutOfStock = product.stock === 0;

        if (filters.stockStatus === "low") {
          stockStatusMatch = isLowStock && !isOutOfStock;
        } else if (filters.stockStatus === "out") {
          stockStatusMatch = isOutOfStock;
        } else if (filters.stockStatus === "healthy") {
          stockStatusMatch = !isLowStock && !isOutOfStock;
        }
      }

      // Price range filter
      const priceMatch =
        product.markupPrice >= filters.priceRange.min &&
        product.markupPrice <= filters.priceRange.max;

        // Date range filter
        let dateMatch = true;
        if (filters.dateRange.startDate || filters.dateRange.endDate) {
          let createdDate: string | null = null;
          
          if (product.createdAt) {
            try {
              let date: Date | null = null;
              
              // Handle Firestore Timestamp (has toDate method)
              if (product.createdAt && typeof product.createdAt.toDate === 'function') {
                date = product.createdAt.toDate();
              }
              // Handle string dates
              else if (typeof product.createdAt === 'string') {
                date = new Date(product.createdAt);
              }
              // Handle Date objects
              else if (product.createdAt instanceof Date) {
                date = product.createdAt;
              }
              
              if (date && !isNaN(date.getTime())) {
                createdDate = date.toISOString().split('T')[0];
              }
            } catch (e) {
              createdDate = null;
            }
          }
          
          // Only filter if we have a valid date from the product AND date filters are applied
          if (createdDate) {
            if (filters.dateRange.startDate) {
              dateMatch = dateMatch && createdDate >= filters.dateRange.startDate;
            }
            if (filters.dateRange.endDate) {
              dateMatch = dateMatch && createdDate <= filters.dateRange.endDate;
            }
          } else if (filters.dateRange.startDate || filters.dateRange.endDate) {
            // If product has no valid date but date filters are active, exclude it
            dateMatch = false;
          }
      }

      return categoryMatch && searchMatch && stockStatusMatch && priceMatch && dateMatch;
    });
  }, [products, filters, effectiveSearchQuery]);

  const handleFilterChange = (key: keyof ReportFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handlePriceRangeChange = () => {
    const min = parseFloat(minPrice) || 0;
    const max = parseFloat(maxPrice) || 999999;
    setFilters((prev) => ({
      ...prev,
      priceRange: { min, max },
    }));
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePriceRangeChange();
    }
  };

  const handleDateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Filter is already applied on change, just blur to confirm
      e.currentTarget.blur();
    }
  };

  const handleEditProduct = (product: InventoryData) => {
    setEditingProduct({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      specifications: product.specifications,
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
    });
  };

  const handleAdjustProduct = (product: InventoryData) => {
    setAdjustingProduct({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      specifications: product.specifications,
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
      adjustmentReason: "Manual Count",
    });
  };

  const handleSaveProduct = async (formData: ProductFormData) => {
    try {
      // Handle adjust stock mode
      if (adjustingProduct && onProductAdjust) {
        onProductAdjust(formData.id!, Number(formData.stock), formData.adjustmentReason || "Manual adjustment");
        setAdjustingProduct(null);
        return;
      }

      // Handle edit mode
      const response = await fetch(`/api/products/${formData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setEditingProduct(null);
        // Optionally, you can trigger a refresh of the products list here
      } else {
        console.error('Failed to save product');
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDeleteProduct = (id: string) => {
    // Close the viewing product modal if the deleted product is being viewed
    if (viewingProduct?.id === id) {
      setViewingProduct(null);
    }
    // Call the parent delete callback if provided
    if (onProductDelete) {
      onProductDelete(id);
    }
  };

  // Helper function to calculate product status
  const getProductStatus = (product: InventoryData) => {
    const statuses: string[] = [];
    
    // Check expiry status first - if expired/expiring, only show expiry status
    if (product.expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiryDate = new Date(product.expiryDate);
      expiryDate.setHours(0, 0, 0, 0);
      
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        return ["Expired"];
      } else if (daysUntilExpiry <= 30) {
        return ["Expiring"];
      }
    }
    
    // Check if dead
    const isDead = product.isDead || (product as any).is_dead;
    if (isDead) {
      statuses.push("Dead");
    }
    
    // Check stock status
    const isLowStock = product.stock <= product.reorderPoint;
    const isOutOfStock = product.stock === 0;
    
    if (isOutOfStock) {
      statuses.push("Out");
    } else if (isLowStock) {
      statuses.push("Low");
    } else {
      statuses.push("OK");
    }
    
    return statuses;
  };

  const getStatusColor = (statuses: string[]) => {
    // Priority: Expired > Dead > Out > Expiring > Low > OK
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

    // Prepare table data
    const tableData = filteredProducts.map((product) => {
      const marginRaw = product.markupPrice - product.baseCost;
      const marginPercent = product.baseCost > 0 ? ((marginRaw / product.baseCost) * 100).toFixed(1) : "0";
      
      return [
        product.sku,
        product.name,
        product.category,
        product.specifications || "N/A",
        (product.beginningInventory || 0).toString(),
        (product.totalSold || 0).toString(),
        (product.damageExchanged || 0).toString(),
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

    // Add filter summary
    let filterSummary = [];
    if (filters.category !== "All Categories") {
      filterSummary.push(`Category: ${filters.category}`);
    }
    if (filters.stockStatus !== "all") {
      filterSummary.push(
        `Stock Status: ${filters.stockStatus.charAt(0).toUpperCase() + filters.stockStatus.slice(1)}`
      );
    }
    if (filters.priceRange.min > 0 || filters.priceRange.max < 999999) {
      filterSummary.push(
        `Price Range: PHP ${filters.priceRange.min} - PHP ${filters.priceRange.max}`
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

    // Add table using autoTable
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
        fillColor: [0, 0, 0], // Pure black
        textColor: [255, 255, 255], // Pure white
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 20 }, // SKU
        1: { cellWidth: "auto" }, // Name
        2: { cellWidth: 25 }, // Category
        3: { cellWidth: 25 }, // Specs
        4: { halign: "center", cellWidth: 15 }, // Beg
        5: { halign: "center", cellWidth: 15 }, // Sold
        6: { halign: "center", cellWidth: 15 }, // Damage
        7: { halign: "center", cellWidth: 15 }, // Stock
        8: { halign: "right", cellWidth: 20 }, // Cost
        9: { halign: "right", cellWidth: 20 }, // Price
        10: { halign: "center", cellWidth: 22 }, // Expiry
        11: { cellWidth: 25 }, // Status
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200], // light gray borders
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250], // very light gray
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

    // Add summary
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
      (p) => p.stock <= p.reorderPoint && p.stock > 0
    ).length;
    doc.text(`Low Stock Items: ${lowStockCount}`, 14, finalY + 26);

    // Save PDF
    doc.save(
      `Inventory_Report_${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  // Export to CSV
  const exportToCSV = () => {
    const csvData = filteredProducts.map((product) => {
      return {
        SKU: product.sku,
        "Product Name": product.name,
        Category: product.category,
        Specifications: product.specifications || "N/A",
        "Beginning Inventory": product.beginningInventory || 0,
        "Sold": product.totalSold || 0,
        "Damage": product.damageExchanged || 0,
        "Total Stock": product.stock,
        "Base Cost": product.baseCost,
        "Retail Price": product.markupPrice,
        "Batch Number": product.batchNumber || "N/A",
        "Expiry Date": product.expiryDate ? new Date(product.expiryDate).toLocaleDateString("en-US") : "N/A",
        Status: getProductStatus(product).join(" | "),
        "Total Value": product.markupPrice * product.stock,
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Inventory_Report_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categories = ["All Categories", ...new Set(products.map((p) => p.category))];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 p-3 sm:p-5 border-b border-gray-100 bg-slate-50">
        {/* Flex container that stacks on mobile, row on larger screens */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Left side: Icon and Inventory List text */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex p-2 bg-[#0B3C8A] rounded-lg shadow-lg shadow-blue-900/20">
              <BarChart3 className="text-white" size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-gray-800 leading-tight">
                Inventory List
              </h2>
              <p className="text-[9px] sm:text-[11px] text-gray-500 hidden sm:block">
                Browse and manage inventory items.
              </p>
            </div>
          </div>

          {/* Right side: Buttons group - side by side on all screens, wraps on very small */}
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
                category: "Frames",
                specifications: "",
                baseCost: 0,
                markupPrice: 0,
                supplierInfo: "",
                stock: 0,
                lastMovedDaysAgo: 0,
                imageColor: "bg-slate-100",
                image: null,
                leadTimeDays: 7,
                reorderPoint: 10,
              })}
              className="flex items-center justify-center gap-1.5 sm:gap-2 bg-[#0B3C8A] hover:bg-[#082F6E] text-white px-3 py-1 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors hover:shadow-sm whitespace-nowrap"
            >
              <span className="text-lg font-bold mr-1">+</span>
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </button>

            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => setShowArchiveList(true)}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 border border-[#0B3C8A] bg-blue-50 text-[#0B3C8A] px-3 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors hover:bg-gray-50 whitespace-nowrap"
                >
                  Archive List
                </button>

                <button
                  onClick={exportToPDF}
                  disabled={filteredProducts.length === 0}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 border border-blue-300 bg-blue-50 text-[#0B3C8A] px-3 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <FileText size={14} />
                  <span className="hidden sm:inline">PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>

                <button
                  onClick={exportToCSV}
                  disabled={filteredProducts.length === 0}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 bg-[#0B3C8A] hover:bg-[#082F6E] text-white px-3 py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">CSV</span>
                  <span className="sm:hidden">CSV</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters Section */}
      <div className="shrink-0 px-3 sm:px-5 pt-3 sm:pt-4 bg-slate-50 border-b border-gray-100">
        {/* Search input with Filters button integrated */}
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

        {/* Filters Panel - opens below the search bar */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 pb-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Category Filter */}
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

              {/* Stock Status Filter */}
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
                </select>
              </div>

              {/* Price Range Filter */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-semibold text-gray-600 block mb-1.5">
                  Price Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    onBlur={handlePriceRangeChange}
                    onKeyDown={handlePriceKeyDown}
                    className="w-1/2 px-2 py-1.5 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A]"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    onBlur={handlePriceRangeChange}
                    onKeyDown={handlePriceKeyDown}
                    className="w-1/2 px-2 py-1.5 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A]"
                  />
                </div>
              </div>

              {/* Date Range Filter */}
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
                  className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A]"
                />
              </div>

              {/* End Date Filter */}
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
                  className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A]"
                />
              </div>

              {/* Reset Button */}
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
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
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
                (p) => p.stock <= p.reorderPoint && p.stock > 0
              ).length}
            </p>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {filteredProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] sm:text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
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
                      Beginning Inventory
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700">
                      Sold
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700">
                      Damage
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
                <tbody>
                  {filteredProducts.map((product) => {
                    const statuses = getProductStatus(product);
                    const statusColor = getStatusColor(statuses);
                    const statusText = statuses.join(" | ");
                    const isArchived = (product as any).archived === true;
                    const isDimmed = isArchived || product.stock === 0;

                    return (
                      <tr
                        key={product.id}
                        className={`border-b border-gray-100 transition-colors ${isDimmed ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50'}`}
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
                          {product.beginningInventory || 0}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-800">
                          {product.totalSold || 0}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-800">
                          {product.damageExchanged || 0}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-[#0B3C8A]">
                          {product.stock}
                        </td>
                        <td className={`px-2 sm:px-4 py-2 sm:py-3 text-center font-bold ${statusColor} rounded`}>
                          {statusText}
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
              <h3 className="font-bold">Archive List</h3>
              <button onClick={() => setShowArchiveList(false)} className="text-gray-500 px-2 py-1">Close</button>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2">SKU</th>
                    <th className="py-2">Name</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.filter(p => (p as any).archived === true).map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2 font-mono">{p.sku}</td>
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.category}</td>
                      <td className="py-2">{(p as any).deleted ? 'Deleted' : 'Archived'}</td>
                        <td className="py-2">
                        <div className="flex gap-2">
                          {userRole === 'admin' ? (
                            <button onClick={() => setPendingArchive({ id: p.id, archived: false, name: p.name })} className="px-2 py-1 bg-green-50 text-green-700 rounded">Unarchive</button>
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
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-4">
            <h3 className="font-bold text-lg mb-2">{pendingArchive.archived ? 'Confirm Archive' : 'Confirm Unarchive'}</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to {pendingArchive.archived ? 'archive' : 'unarchive'} &quot;{pendingArchive.name || pendingArchive.id}&quot;?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingArchive(null)} className="px-3 py-1 rounded-md border border-gray-300">Cancel</button>
              <button onClick={async () => {
                if (onProductArchive) {
                  try {
                    await onProductArchive(pendingArchive.id, pendingArchive.archived);
                  } catch (err) {
                    console.error('Archive action failed', err);
                  }
                }
                setPendingArchive(null);
                setShowArchiveList(false);
              }} className="px-3 py-1 rounded-md bg-[#0B3C8A] text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <ProductModal
          mode="edit"
          product={editingProduct}
          products={products}
          onClose={() => setEditingProduct(null)}
          onSave={handleSaveProduct}
          onDelete={handleDeleteProduct}
          onArchive={(id: string, archived?: boolean) => {
            if (onProductArchive) onProductArchive(id, !!archived);
          }}
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

      {/* Add Product Modal (from Reports header) */}
      {addingProduct && (
        <ProductModal
          mode="add"
          product={addingProduct}
          products={products}
          onClose={() => setAddingProduct(null)}
          onSave={async (data: ProductFormData) => {
            try {
              if (onAddProduct) {
                await onAddProduct(data);
              } else {
                // Fallback: send to API
                await fetch('/api/products', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data),
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

      {/* Local QR Scanner (only if parent didn't handle scanner) */}
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
  );
}