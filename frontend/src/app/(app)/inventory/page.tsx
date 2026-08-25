"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useNotification } from "@/components/NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";
import QRScannerModal from "@/components/QRScannerModal";
import InventoryReports from "@/components/InventoryReports";
import { ProductFormData } from "@/components/ProductModal";
import QRCodeModal from "@/components/QRCodeModal";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  isPerishable?: boolean;
  batches?: any[];
  totalSold?: number;
  damageExchanged?: number;
  restockCount?: number;
  beginningInventory?: number;
  publicViewCount?: number;
}

const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";
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
    updateBatchStock,
    getProductBatches,
    userName,
    userId,
  } = useFirebase();

  const [products, setProducts] = useState<InventoryData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<InventoryData | null>(null);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [qrScanMode, setQRScanMode] = useState<"search" | "adjust">("adjust");
  const [pendingRestockProduct, setPendingRestockProduct] = useState<{ product: InventoryData; batchId?: string; batchSku?: string } | null>(null);
  const [restockQuantity, setRestockQuantity] = useState("1");
  const [isApplyingRestock, setIsApplyingRestock] = useState(false);
  const [newBatchQR, setNewBatchQR] = useState<{ batchId: string; batchSku: string; productId: string; productName: string; productPrice: number; productSku: string } | null>(null);

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

  const handleProductFound = async (productId: string, batchId?: string, batchSku?: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const isPerishable = product.category === "Solutions" || product.category === "Vitamins";
    
    if (isPerishable && !batchId) {
      showToastOnly(`Please scan the batch-specific QR code for "${product.name}"`, "warning");
      setIsQRScannerOpen(false);
      return;
    }
    
    setPendingRestockProduct({ product, batchId, batchSku });
    setRestockQuantity("1");
    setIsQRScannerOpen(false);
  };

  const confirmQRRestock = async () => {
    if (!pendingRestockProduct || isApplyingRestock) return;

    const quantity = Number(restockQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      showNotification("Please enter a valid restock quantity (whole number greater than 0).", "error", "Invalid Quantity");
      return;
    }

    const { product, batchId, batchSku } = pendingRestockProduct;
    const isPerishable = product.category === "Solutions" || product.category === "Vitamins";

    setIsApplyingRestock(true);
    try {
      if (isPerishable && batchId) {
        const batches = await getProductBatches(product.id);
        const batch = batches.find(b => b.id === batchId);
        if (!batch) {
          throw new Error("Batch not found");
        }
        const newBatchStock = batch.stock + quantity;
        await updateBatchStock(
          batchId,
          newBatchStock,
          `Received via QR Scan (+${quantity}) - Batch ${batchSku || batch.batchSku}`,
          userName || 'Staff',
          userId || 'system'
        );
        showNotification(`+${quantity} unit${quantity > 1 ? 's' : ''} added to batch "${batchSku || batch.batchSku}" for "${product.name}"`, "success", "Stock Updated");
        
        const freshBatches = await getProductBatches(product.id);
        const totalStock = freshBatches.reduce((sum, b) => sum + b.stock, 0);
        
        const productRef = doc(db, `clinics/${CLINIC_ID}/products`, product.id);
        const productSnap = await getDoc(productRef);
        const freshProductData = productSnap.exists() ? productSnap.data() : {};
        
        setProducts(prev => prev.map(p => 
          p.id === product.id 
            ? { 
                ...p, 
                batches: freshBatches, 
                stock: totalStock,
                damageExchanged: freshProductData.damageExchanged || p.damageExchanged,
                restockCount: freshProductData.restockCount || p.restockCount,
                publicViewCount: freshProductData.publicViewCount || p.publicViewCount
              }
            : p
        ));
      } else {
        const newStock = product.stock + quantity;
        await adjustStock(product.id, newStock, `Received via QR Scan (+${quantity})`, userName || 'Staff', userId || 'system');
        showNotification(`+${quantity} unit${quantity > 1 ? 's' : ''} added to "${product.name}"`, "success", "Stock Updated");
      }
      setPendingRestockProduct(null);
      setRestockQuantity("1");
    } catch (error) {
      console.error("Error adjusting stock:", error);
      showNotification(`Failed to add stock for "${product.name}"`, "error", "Error");
    } finally {
      setIsApplyingRestock(false);
    }
  };

  const handleAddProduct = async (data: ProductFormData): Promise<string> => {
    try {
      console.log("📦 Adding product:", data.name);
      const newId = await addProduct(data);
      console.log("✅ Product added successfully with ID:", newId);
      showToastOnly(`New product "${data.name}" added to inventory list`, "success");
      
      const isPerishable = data.category === "Solutions" || data.category === "Vitamins";
      if (isPerishable && data.batchNumber && data.expiryDate && data.stock > 0) {
        const batches = await getProductBatches(newId);
        if (batches.length > 0) {
          const firstBatch = batches[0];
          setNewBatchQR({
            batchId: firstBatch.id,
            batchSku: firstBatch.batchSku,
            productId: newId,
            productName: data.name,
            productPrice: data.markupPrice,
            productSku: data.sku
          });
        }
      }
      
      return newId;
    } catch (err) {
      console.error("❌ Failed to add product:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      showNotification(`Failed to add product: ${errorMessage}`, "error", "Error");
      throw err;
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
          onProductAdjust={async (id: string, newStock: number, reason: string, batchId?: string) => {
            const product = products.find((p) => p.id === id);
            if (!product) return;

            console.log("Stock adjustment requested:", { id, newStock, reason, batchId });
            
            const isPerishable = product.category === "Solutions" || product.category === "Vitamins";

            if (batchId && isPerishable) {
              console.log(`Updating batch ${batchId} for product ${product.name}`);
              try {
                await updateBatchStock(batchId, newStock, reason, userName || 'Staff', userId || 'system');
                showNotification(`Stock updated for batch`, "success", "Stock Updated");
                
                const freshBatches = await getProductBatches(id);
                const totalStock = freshBatches.reduce((sum, b) => sum + b.stock, 0);
                
                const productRef = doc(db, `clinics/${CLINIC_ID}/products`, id);
                const productSnap = await getDoc(productRef);
                const freshProductData = productSnap.exists() ? productSnap.data() : {};
                
                setProducts(prev => prev.map(p => 
                  p.id === id 
                    ? { 
                        ...p, 
                        batches: freshBatches, 
                        stock: totalStock,
                        damageExchanged: freshProductData.damageExchanged || p.damageExchanged,
                        restockCount: freshProductData.restockCount || p.restockCount,
                        publicViewCount: freshProductData.publicViewCount || p.publicViewCount
                      }
                    : p
                ));
              } catch (error) {
                console.error("Error adjusting batch stock:", error);
                showNotification("Failed to adjust batch stock.", "error", "Error");
              }
            } else {
              try {
                await adjustStock(id, newStock, reason, userName || 'Staff', userId || 'system');
                showNotification(`Stock adjusted for "${product.name}"`, "success", "Stock Updated");
              } catch (error) {
                console.error("Error adjusting stock:", error);
                showNotification("Failed to adjust stock.", "error", "Error");
              }
            }
          }}
          userRole={userRole}
          onAddProduct={handleAddProduct}
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
        {newBatchQR && (
          <QRCodeModal
            productId={newBatchQR.productId}
            productSku={newBatchQR.productSku}
            productName={newBatchQR.productName}
            productPrice={newBatchQR.productPrice}
            batchId={newBatchQR.batchId}
            batchSku={newBatchQR.batchSku}
            onClose={() => setNewBatchQR(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isQRScannerOpen && (
          <QRScannerModal
            mode={qrScanMode}
            onClose={() => setIsQRScannerOpen(false)}
            products={products}
            onProductFound={(productId: string, batchId?: string, batchSku?: string) => {
              handleProductFound(productId, batchId, batchSku);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingRestockProduct && (
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
                Add stock for <span className="font-semibold text-gray-800">{pendingRestockProduct.product.name}</span>
                {pendingRestockProduct.batchSku && <span className="text-xs text-gray-500 block">Batch: {pendingRestockProduct.batchSku}</span>}
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
                  value={restockQuantity}
                  onChange={(e) => setRestockQuantity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C8A] text-gray-700"
                />
                <div className="text-[10px] sm:text-xs text-gray-500">
                  Current Stock: <span className="font-semibold text-gray-700">{pendingRestockProduct.product.stock}</span> → 
                  New Stock: <span className="font-semibold text-[#0B3C8A]">{pendingRestockProduct.product.stock + Number(restockQuantity)}</span>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setPendingRestockProduct(null);
                    setRestockQuantity("1");
                  }}
                  disabled={isApplyingRestock}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmQRRestock}
                  disabled={isApplyingRestock}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-[#0B3C8A] text-white text-[11px] sm:text-sm font-medium hover:bg-[#082F6E] transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-60"
                >
                  {isApplyingRestock ? "Saving..." : "Confirm"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteModalOpen && productToDelete && (
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
                Are you sure you want to delete <span className="font-semibold text-gray-800">&quot;{productToDelete.name}&quot;</span>? This product will be permanently removed from the Inventory.
              </p>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setProductToDelete(null);
                  }}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-red-600 text-white text-[11px] sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}