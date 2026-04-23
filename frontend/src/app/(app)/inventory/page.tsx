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
              const newStock = product.stock + 1;
              adjustStock(product.id, newStock, "Received via QR Scan")
                .then(() => {
                  showNotification(`+1 unit added to "${product.name}" via QR scan`, "success", "Stock Updated");
                  setIsQRScannerOpen(false);
                })
                .catch((error: Error) => {
                  console.error("Error adjusting stock:", error);
                  showNotification(`Failed to add stock for "${product.name}"`, "error", "Error");
                });
            }}
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
