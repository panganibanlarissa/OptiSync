"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileText,
  Filter,
  X,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";

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
  totalSold?: number;
  createdAt?: any;
  updatedAt?: any;
}

interface ReportFilters {
  category: string;
  stockStatus: string; // "all", "low", "out", "healthy"
  priceRange: { min: number; max: number };
  searchQuery: string;
}

export default function InventoryReports({
  products,
}: {
  products: InventoryData[];
}) {
  const [filters, setFilters] = useState<ReportFilters>({
    category: "All Categories",
    stockStatus: "all",
    priceRange: { min: 0, max: 999999 },
    searchQuery: "",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("999999");

  // Filter products based on selected filters
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Category filter
      const categoryMatch =
        filters.category === "All Categories" ||
        product.category === filters.category;

      // Search query filter
      const searchMatch =
        product.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(filters.searchQuery.toLowerCase());

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

      return categoryMatch && searchMatch && stockStatusMatch && priceMatch;
    });
  }, [products, filters]);

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
    const tableData = filteredProducts.map((product) => [
      product.sku,
      product.name,
      product.category,
      product.stock.toString(),
      product.reorderPoint.toString(),
      product.stock <= product.reorderPoint ? "LOW" : "OK",
      `PHP ${product.baseCost.toLocaleString()}`,
      `PHP ${product.markupPrice.toLocaleString()}`,
      product.supplierInfo || "N/A",
    ]);

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
    if (filters.searchQuery) {
      filterSummary.push(`Search: ${filters.searchQuery}`);
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
          "Current Stock",
          "Reorder Point",
          "Status",
          "Base Cost",
          "Retail Price",
          "Supplier Info",
        ],
      ],
      body: tableData,
      startY: filterSummary.length > 0 ? 42 : 37,
      margin: { top: 37, right: 14, bottom: 30, left: 14 },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 3,
        overflow: "linebreak",
        valign: "middle",
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [100, 100, 100],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
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
    const csvData = filteredProducts.map((product) => ({
      SKU: product.sku,
      "Product Name": product.name,
      Category: product.category,
      Specifications: product.specifications,
      "Current Stock": product.stock,
      "Reorder Point": product.reorderPoint,
      Status: product.stock <= product.reorderPoint ? "LOW" : "OK",
      "Base Cost": `PHP ${product.baseCost.toLocaleString()}`,
      "Retail Price": `PHP ${product.markupPrice.toLocaleString()}`,
      Margin: `${(((product.markupPrice - product.baseCost) / product.baseCost) * 100).toFixed(2)}%`,
      "Lead Time (Days)": product.leadTimeDays,
      "Supplier Info": product.supplierInfo || "N/A",
      "Total Value": `PHP ${(product.markupPrice * product.stock).toLocaleString()}`,
    }));

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex p-2 bg-[#0B3C8A] rounded-lg shadow-lg shadow-blue-900/20">
              <BarChart3 className="text-white" size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-gray-800 leading-tight">
                Inventory Reports
              </h2>
              <p className="text-[9px] sm:text-[11px] text-gray-500 hidden sm:block">
                Filter, analyze, and export inventory data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 border border-gray-300 bg-white text-gray-700 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors hover:bg-gray-50 flex-1 sm:flex-none"
            >
              <Filter size={14} />
              <span>Filters</span>
              <ChevronDown
                size={12}
                className={`transition-transform ${showFilters ? "rotate-180" : ""}`}
              />
            </button>

            <button
              onClick={exportToPDF}
              disabled={filteredProducts.length === 0}
              className="flex items-center justify-center gap-1.5 sm:gap-2 border border-blue-300 bg-blue-50 text-[#0B3C8A] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
            >
              <FileText size={14} />
              <span className="hidden sm:inline">PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button
              onClick={exportToCSV}
              disabled={filteredProducts.length === 0}
              className="flex items-center justify-center gap-1.5 sm:gap-2 bg-[#0B3C8A] hover:bg-[#082F6E] text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
            >
              <Download size={14} />
              <span className="hidden sm:inline">CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {/* Search */}
            <div>
              <label className="text-[10px] sm:text-[11px] font-semibold text-gray-600 block mb-1.5">
                Search
              </label>
              <input
                type="text"
                placeholder="SKU or Product name"
                value={filters.searchQuery}
                onChange={(e) =>
                  handleFilterChange("searchQuery", e.target.value)
                }
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#0B3C8A] transition-all"
              />
            </div>

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
                onChange={(e) =>
                  handleFilterChange("stockStatus", e.target.value)
                }
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

            {/* Reset Button */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({
                    category: "All Categories",
                    stockStatus: "all",
                    priceRange: { min: 0, max: 999999 },
                    searchQuery: "",
                  });
                  setMinPrice("0");
                  setMaxPrice("999999");
                }}
                className="w-full px-2.5 py-1.5 text-[10px] sm:text-[11px] font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Reset Filters
              </button>
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
                      Stock
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700">
                      Reorder Point
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-700">
                      Cost
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-700">
                      Price
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-700">
                      Total Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const status =
                      product.stock === 0
                        ? "OUT"
                        : product.stock <= product.reorderPoint
                          ? "LOW"
                          : "OK";
                    const statusColor =
                      status === "OUT"
                        ? "text-red-600 bg-red-50"
                        : status === "LOW"
                          ? "text-orange-600 bg-orange-50"
                          : "text-green-600 bg-green-50";

                    return (
                      <tr
                        key={product.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
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
                          {product.stock}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-600">
                          {product.reorderPoint}
                        </td>
                        <td className={`px-2 sm:px-4 py-2 sm:py-3 text-center font-bold ${statusColor} rounded`}>
                          {status}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-600">
                          ₱{product.baseCost.toLocaleString()}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-[#0B3C8A]">
                          ₱{product.markupPrice.toLocaleString()}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-800">
                          ₱{(product.markupPrice * product.stock).toLocaleString()}
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
    </motion.div>
  );
}
