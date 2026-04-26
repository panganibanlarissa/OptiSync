"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useNotification } from "@/components/NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";
import QRScannerModal from "@/components/QRScannerModal";
import InventoryReports from "@/components/InventoryReports";
import { ProductFormData } from "@/components/ProductModal";

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
  archived?: boolean;
  deleted?: boolean;
}

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export default function InventoryPage() {
  const {
    products: firebaseProducts,
    addProduct,
    archiveProduct,
    adjustStock,
    loading,
    userRole,
  } = useFirebase();

  const [products, setProducts] = useState<InventoryData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<InventoryData | null>(null);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [qrScanMode, setQRScanMode] = useState<"search" | "adjust">("adjust");
  const [pendingRestockProduct, setPendingRestockProduct] = useState<InventoryData | null>(null);
  const [restockQuantity, setRestockQuantity] = useState("1");
  const [isApplyingRestock, setIsApplyingRestock] = useState(false);

  const { showNotification, showToastOnly } = useNotification();

  useEffect(() => {
    setProducts(firebaseProducts as InventoryData[]);
  }, [firebaseProducts]);

  const initiateDelete = (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      await archiveProduct(productToDelete.id, true, "Deleted via UI", true);
      showNotification(`Product "${productToDelete.name}" deleted from inventory`, "info", "Product Deleted");
      setProductToDelete(null);
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting product:", error);
      showNotification("Failed to delete product.", "error", "Error");
    }
  };

  const confirmQRRestock = async () => {
    if (!pendingRestockProduct || isApplyingRestock) return;

    const quantity = Number(restockQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      showNotification("Please enter a valid restock quantity (whole number greater than 0).", "error", "Invalid Quantity");
      return;
    }

    const latestProduct = products.find((p) => p.id === pendingRestockProduct.id);
    if (!latestProduct) {
      showNotification("Product not found. Please scan again.", "error", "Error");
      setPendingRestockProduct(null);
      return;
    }

    setIsApplyingRestock(true);
    try {
      const newStock = latestProduct.stock + quantity;
      await adjustStock(latestProduct.id, newStock, `Received via QR Scan (+${quantity})`);
      showNotification(`+${quantity} unit${quantity > 1 ? "s" : ""} added to "${latestProduct.name}"`, "success", "Stock Updated");
      setPendingRestockProduct(null);
      setRestockQuantity("1");
    } catch (error) {
      console.error("Error adjusting stock:", error);
      showNotification(`Failed to add stock for "${latestProduct.name}"`, "error", "Error");
    } finally {
      setIsApplyingRestock(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full font-sans p-2 sm:p-4 box-border gap-0">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pt-2 sm:pt-4 gap-2 sm:gap-3 lg:gap-4 w-full"
      >
        <InventoryReports
          products={products}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onProductDelete={initiateDelete}
          onProductAdjust={(id: string, newStock: number, reason: string) => {
            const product = products.find((p) => p.id === id);
            if (!product) return;

            adjustStock(id, newStock, reason)
              .then(() => {
                showNotification(`Stock adjusted for "${product.name}"`, "success", "Stock Updated");
              })
              .catch((error: Error) => {
                console.error("Error adjusting stock:", error);
                showNotification("Failed to adjust stock.", "error", "Error");
              });
          }}
          userRole={userRole}
          onAddProduct={async (data: ProductFormData) => {
            try {
              const newId = await addProduct(data);
              showToastOnly(`New product "${data.name}" added to inventory list`, "success");
              return newId;
            } catch (err) {
              console.error("Failed to add product from inventory list:", err);
              showNotification("Failed to add product.", "error", "Error");
              throw err;
            }
          }}
          onOpenScanner={() => {
            setQRScanMode("adjust");
            setIsQRScannerOpen(true);
          }}
          onProductArchive={async (id: string, archived: boolean) => {
            try {
              await archiveProduct(id, archived, archived ? "Archived from inventory list" : "Unarchived from inventory list");
              showNotification(archived ? "Product archived" : "Product reactivated", "success");
            } catch (err) {
              console.error("Archive toggle failed:", err);
              showNotification("Failed to update archive status", "error");
            }
          }}
        />
      </motion.div>

      <AnimatePresence>
        {isQRScannerOpen && (
          <QRScannerModal
            mode={qrScanMode}
            onClose={() => setIsQRScannerOpen(false)}
            products={products}
            onProductFound={(productId: string) => {
              const product = products.find((p) => p.id === productId);
              if (!product) return;
              if (qrScanMode === "search") {
                setSearchQuery(product.id);
                setIsQRScannerOpen(false);
                return;
              }
              setPendingRestockProduct(product);
              setRestockQuantity("1");
              setIsQRScannerOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingRestockProduct && (
          <QRRestockConfirmationModal
            product={pendingRestockProduct}
            quantity={restockQuantity}
            setQuantity={setRestockQuantity}
            isSubmitting={isApplyingRestock}
            onCancel={() => {
              if (isApplyingRestock) return;
              setPendingRestockProduct(null);
              setRestockQuantity("1");
            }}
            onConfirm={confirmQRRestock}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteModalOpen && productToDelete && (
          <DeleteConfirmationModal
            productName={productToDelete.name}
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setProductToDelete(null);
            }}
            onConfirm={confirmDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function QRRestockConfirmationModal({
  product,
  quantity,
  setQuantity,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  product: InventoryData;
  quantity: string;
  setQuantity: (value: string) => void;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const quantityNumber = Number(quantity);
  const isValidQty = Number.isInteger(quantityNumber) && quantityNumber > 0;
  const projectedStock = isValidQty ? product.stock + quantityNumber : product.stock;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-4 sm:p-6"
      >
        <h3 className="text-sm sm:text-lg font-bold text-gray-900 mb-2">Confirm Restock</h3>
        <p className="text-[10px] sm:text-sm text-gray-600 mb-4">
          Add stock for <span className="font-semibold text-gray-800">{product.name}</span> ({product.sku}).
        </p>

        <div className="space-y-2 mb-4">
          <label htmlFor="restock-qty" className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase">
            Quantity To Add
          </label>
          <input
            id="restock-qty"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C8A] text-gray-700"
          />
          <div className="text-[10px] sm:text-xs text-gray-500">
            Current Stock: <span className="font-semibold text-gray-700">{product.stock}</span> | New Stock:{" "}
            <span className="font-semibold text-[#0B3C8A]">{projectedStock}</span>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isValidQty || isSubmitting}
            className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-[#0B3C8A] text-white text-[11px] sm:text-sm font-medium hover:bg-[#082F6E] transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Confirm"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteConfirmationModal({
  productName,
  onCancel,
  onConfirm,
}: {
  productName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-4 sm:p-6 text-center"
      >
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
          <Trash2 className="text-red-600 w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <h3 className="text-sm sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">Delete Product?</h3>
        <p className="text-[10px] sm:text-sm text-gray-500 mb-4 sm:mb-6">
          Are you sure you want to delete <span className="font-semibold text-gray-800">&quot;{productName}&quot;</span>? This product will move to Archive List and can be unarchived.
        </p>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-red-600 text-white text-[11px] sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
          >
            Yes, Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}
