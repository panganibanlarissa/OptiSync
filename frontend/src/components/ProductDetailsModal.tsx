// src/components/ProductDetailsModal.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Calendar, Plus, Edit2, QrCode, AlertTriangle, RefreshCw, Trash2, TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useFirebase, ProductBatch } from '@/context/FirebaseContext';
import { useNotification } from './NotificationProvider';
import QRCodeModal from './QRCodeModal';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";

interface ProductDetailsModalProps {
  product: {
    id: string;
    sku: string;
    name: string;
    category: string;
    specifications: string;
    baseCost: number;
    markupPrice: number;
    image: string | null;
    imageColor: string;
    stock: number;
    reorderPoint: number;
    leadTimeDays: number;
    beginningInventory?: number;
    totalSold?: number;
    damageExchanged?: number;
    restockCount?: number;
    expiryDate?: string | null;
    batchNumber?: string;
    isPerishable?: boolean;
    batches?: ProductBatch[];
    createdAt?: any;
    updatedAt?: any;
  };
  onClose: () => void;
}

interface BatchWithId extends ProductBatch {
  id: string;
}

interface ProductData {
  stock: number;
  totalSold: number;
  damageExchanged: number;
  restockCount: number;
  beginningInventory: number;
}

export default function ProductDetailsModal({ product: initialProduct, onClose }: ProductDetailsModalProps) {
  const { addProductBatch, updateBatchStock, getProductBatches, deleteBatch, userName, userId, adjustStock } = useFirebase();
  const { showNotification, showToastOnly } = useNotification();
  
  const [product, setProduct] = useState(initialProduct);
  const [batches, setBatches] = useState<BatchWithId[]>(initialProduct.batches || []);
  const [loading, setLoading] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState<BatchWithId | null>(null);
  const [showDeleteBatchModal, setShowDeleteBatchModal] = useState<BatchWithId | null>(null);
  const [selectedQRBatch, setSelectedQRBatch] = useState<BatchWithId | null>(null);
  const [adjustingBatch, setAdjustingBatch] = useState<BatchWithId | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(1);
  const [adjustmentType, setAdjustmentType] = useState<'restock' | 'damaged'>('restock');
  
  // Selected batch for inventory information display - default to first batch, no "all" option
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  
  // Parent summary data (only used for batch list, not displayed in Inventory Information)
  const [parentData, setParentData] = useState<ProductData>({
    stock: initialProduct.stock,
    totalSold: initialProduct.totalSold || 0,
    damageExchanged: initialProduct.damageExchanged || 0,
    restockCount: initialProduct.restockCount || 0,
    beginningInventory: initialProduct.beginningInventory || 0,
  });
  
  // New batch form state
  const [newBatchSku, setNewBatchSku] = useState('');
  const [newBatchExpiry, setNewBatchExpiry] = useState('');
  const [newBatchStock, setNewBatchStock] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isPerishable = product.isPerishable || product.category === "Solutions" || product.category === "Vitamins";

  // Get selected batch data
  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  
  // Get display data based on selected batch (only batch data, no summary)
  const displayData = selectedBatch ? {
    beginningInventory: selectedBatch.beginningInventory || 0,
    totalSold: selectedBatch.totalSold || 0,
    damageExchanged: selectedBatch.damageExchanged || 0,
    restockCount: selectedBatch.restockCount || 0,
    stock: selectedBatch.stock,
  } : {
    beginningInventory: 0,
    totalSold: 0,
    damageExchanged: 0,
    restockCount: 0,
    stock: 0,
  };

  // Find batch with nearest expiry date
  const findNearestExpiryBatch = (batchesList: BatchWithId[]): BatchWithId | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeBatches = batchesList.filter(b => b.isActive !== false);
    if (activeBatches.length === 0) return null;
    
    const sortedByExpiry = [...activeBatches].sort((a, b) => {
      const expiryA = new Date(a.expiryDate).getTime();
      const expiryB = new Date(b.expiryDate).getTime();
      return expiryA - expiryB;
    });
    
    return sortedByExpiry[0];
  };

  // Set default selected batch to the one with nearest expiry date
  useEffect(() => {
    if (isPerishable && batches.length > 0 && !selectedBatchId) {
      const nearestBatch = findNearestExpiryBatch(batches);
      if (nearestBatch) {
        setSelectedBatchId(nearestBatch.id);
      }
    }
  }, [isPerishable, batches, selectedBatchId]);

  // Refresh all data - called after any stock adjustment
  const refreshAllData = async () => {
    console.log("🔄 Refreshing all product data...");
    setLoading(true);
    
    try {
      // First, reload batches
      const fetchedBatches = await getProductBatches(product.id);
      setBatches(fetchedBatches);
      
      // Refresh parent product data directly from Firestore
      const productRef = doc(db, `clinics/${CLINIC_ID}/products`, product.id);
      const productSnap = await getDoc(productRef);
      
      if (productSnap.exists()) {
        const freshProduct = productSnap.data();
        console.log("📊 Fresh product data:", {
          stock: freshProduct.stock,
          totalSold: freshProduct.totalSold,
          damageExchanged: freshProduct.damageExchanged,
          restockCount: freshProduct.restockCount,
          beginningInventory: freshProduct.beginningInventory
        });
        
        const newParentData = {
          stock: freshProduct.stock || 0,
          totalSold: freshProduct.totalSold || 0,
          damageExchanged: freshProduct.damageExchanged || 0,
          restockCount: freshProduct.restockCount || 0,
          beginningInventory: freshProduct.beginningInventory || 0,
        };
        setParentData(newParentData);
        
        setProduct(prev => ({
          ...prev,
          stock: freshProduct.stock || 0,
          totalSold: freshProduct.totalSold || 0,
          damageExchanged: freshProduct.damageExchanged || 0,
          restockCount: freshProduct.restockCount || 0,
        }));
      }
      
      // If a specific batch was selected, keep it selected if it still exists
      if (selectedBatchId) {
        const stillExists = fetchedBatches.some(b => b.id === selectedBatchId);
        if (!stillExists && fetchedBatches.length > 0) {
          // If the selected batch no longer exists, select the nearest expiry batch
          const nearestBatch = findNearestExpiryBatch(fetchedBatches);
          if (nearestBatch) {
            setSelectedBatchId(nearestBatch.id);
          }
        }
      } else if (fetchedBatches.length > 0) {
        // No batch selected, select the nearest expiry batch
        const nearestBatch = findNearestExpiryBatch(fetchedBatches);
        if (nearestBatch) {
          setSelectedBatchId(nearestBatch.id);
        }
      }
      
      console.log("✅ Data refresh complete");
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async () => {
    setLoading(true);
    try {
      console.log("Loading batches for product:", product.id);
      const fetchedBatches = await getProductBatches(product.id);
      console.log("Fetched batches:", fetchedBatches);
      setBatches(fetchedBatches);
      
      // Set selected batch to nearest expiry after loading
      if (fetchedBatches.length > 0 && !selectedBatchId) {
        const nearestBatch = findNearestExpiryBatch(fetchedBatches);
        if (nearestBatch) {
          setSelectedBatchId(nearestBatch.id);
        }
      }
      
      await refreshAllData();
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPerishable) {
      loadBatches();
    } else {
      refreshAllData();
    }
  }, [isPerishable, product.id]);

  const handleAddBatch = async () => {
    if (!newBatchSku.trim()) {
      showToastOnly('Please enter a batch SKU', 'error');
      return;
    }
    if (!newBatchExpiry) {
      showToastOnly('Please select an expiry date', 'error');
      return;
    }
    if (newBatchStock <= 0) {
      showToastOnly('Stock must be greater than 0', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addProductBatch(
        product.id,
        newBatchSku.trim(),
        newBatchExpiry,
        newBatchStock,
        userName || 'System',
        userId || 'system'
      );
      
      await refreshAllData();
      
      setNewBatchSku('');
      setNewBatchExpiry('');
      setNewBatchStock(1);
      setShowAddBatchModal(false);
      
      showToastOnly(`Batch ${newBatchSku} added successfully`, 'success');
    } catch (error) {
      console.error('Error adding batch:', error);
      showToastOnly('Failed to add batch', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBatchStock = async () => {
    if (!adjustingBatch) return;
    if (adjustmentQuantity <= 0) {
      showToastOnly('Quantity must be greater than 0', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let newStock: number;
      let reason: string;
      
      if (adjustmentType === 'restock') {
        newStock = adjustingBatch.stock + adjustmentQuantity;
        reason = `Restock: +${adjustmentQuantity} units added to batch ${adjustingBatch.batchSku}`;
        console.log(`📦 Restocking batch ${adjustingBatch.batchSku}: +${adjustmentQuantity} units`);
      } else {
        if (adjustmentQuantity > adjustingBatch.stock) {
          showToastOnly(`Cannot remove ${adjustmentQuantity} units. Only ${adjustingBatch.stock} in stock.`, 'error');
          setIsSubmitting(false);
          return;
        }
        newStock = adjustingBatch.stock - adjustmentQuantity;
        reason = `Damaged: -${adjustmentQuantity} units removed from batch ${adjustingBatch.batchSku}`;
        console.log(`⚠️ Marking damaged in batch ${adjustingBatch.batchSku}: -${adjustmentQuantity} units`);
      }
      
      console.log(`Updating batch ${adjustingBatch.id} from ${adjustingBatch.stock} to ${newStock}`);
      
      await updateBatchStock(
        adjustingBatch.id,
        newStock,
        reason,
        userName || 'System',
        userId || 'system'
      );
      
      // Wait a moment for Firestore to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh all data after update
      await refreshAllData();
      
      setAdjustingBatch(null);
      setAdjustmentQuantity(1);
      setAdjustmentType('restock');
      
      showToastOnly(`Batch ${adjustingBatch.batchSku} updated successfully`, 'success');
    } catch (error) {
      console.error('Error updating batch stock:', error);
      showToastOnly('Failed to update batch', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!showDeleteBatchModal) return;
    
    setIsSubmitting(true);
    try {
      await deleteBatch(showDeleteBatchModal.id, product.id);
      await refreshAllData();
      setShowDeleteBatchModal(null);
      showToastOnly(`Batch ${showDeleteBatchModal.batchSku} deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting batch:', error);
      showToastOnly('Failed to delete batch', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { text: 'Expired', color: 'text-red-600 bg-red-100', icon: <AlertTriangle size={12} /> };
    } else if (daysUntilExpiry <= 30) {
      return { text: `Expires in ${daysUntilExpiry} days`, color: 'text-orange-600 bg-orange-100', icon: <AlertTriangle size={12} /> };
    }
    return { text: `Expires ${expiry.toLocaleDateString()}`, color: 'text-green-600 bg-green-100', icon: <Calendar size={12} /> };
  };

  const margin = product.markupPrice - product.baseCost;
  const marginPercentage = product.baseCost > 0 ? ((margin / product.baseCost) * 100).toFixed(2) : '0';

  const pluralize = (count: number, singular: string, plural: string) => {
    return count === 1 ? singular : plural;
  };

  const getTrendIcon = () => {
    const netChange = parentData.restockCount - parentData.totalSold;
    if (netChange > 0) {
      return <TrendingUp size={14} className="text-green-600" />;
    } else if (netChange < 0) {
      return <TrendingDown size={14} className="text-red-600" />;
    }
    return <Minus size={14} className="text-gray-500" />;
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 bg-slate-50 z-10">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">{product.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">SKU: {product.sku}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 sm:p-6 space-y-6">
            {/* Image and Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="sm:col-span-1 flex justify-center">
                <div className={`w-40 h-40 sm:w-48 sm:h-48 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50 flex items-center justify-center ${!product.image ? product.imageColor : ''}`}>
                  {product.image && !product.image.startsWith('blob:') ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="text-gray-400 text-4xl">📷</div>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2 space-y-4">
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase mb-1">Product Name</p>
                  <p className="text-base sm:text-lg font-bold text-gray-800">{product.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase mb-1">Category</p>
                    <p className="text-sm sm:text-base font-bold text-gray-800">{product.category}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase mb-1">Reorder Point</p>
                    <p className="text-sm sm:text-base font-bold text-gray-800">{product.reorderPoint} units</p>
                  </div>
                </div>

                {product.specifications && (
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase mb-1">Specifications</p>
                    <p className="text-sm sm:text-base text-gray-700">{product.specifications}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-5">
              <h3 className="font-bold text-gray-800 mb-4 text-sm sm:text-base">Pricing Information</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Base Cost</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">₱{product.baseCost.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Retail Price</p>
                  <p className="text-lg sm:text-xl font-bold text-[#0B3C8A]">₱{product.markupPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Margin</p>
                  <p className="text-lg sm:text-xl font-bold text-green-600">
                    ₱{margin.toLocaleString()} ({marginPercentage}%)
                  </p>
                </div>
              </div>
            </div>

            {/* Inventory Information - WITH BATCH SELECTOR (No "All Batches" option) */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 sm:p-5">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h3 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-2">
                  Inventory Information
                </h3>
                
                {/* Batch Selector Dropdown - Only shows individual batches, no "All Batches" */}
                {isPerishable && batches.length > 0 && (
                  <div className="relative">
                    <select
                      value={selectedBatchId}
                      onChange={(e) => setSelectedBatchId(e.target.value)}
                      className="appearance-none bg-white border border-purple-300 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                    >
                      {batches.filter(b => b.isActive !== false).map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.batchSku} {batch.expiryDate ? `(Exp: ${new Date(batch.expiryDate).toLocaleDateString()})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </div>
              
              {/* Selected Batch Info Banner */}
              {selectedBatch && (
                <div className="mb-3 p-2 bg-purple-100 rounded-lg text-xs text-purple-700">
                  Showing data for batch: <span className="font-bold">{selectedBatch.batchSku}</span>
                  {selectedBatch.expiryDate && (
                    <span className="ml-2">
                      Expiry: {new Date(selectedBatch.expiryDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
              
              {/* Inventory Stats Grid - Only shows selected batch data */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Beginning Inventory</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">
                    {displayData.beginningInventory} {pluralize(displayData.beginningInventory, 'unit', 'units')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Total Sold</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600">
                    {displayData.totalSold} {pluralize(displayData.totalSold, 'unit', 'units')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Damaged</p>
                  <p className="text-lg sm:text-xl font-bold text-red-600">
                    {displayData.damageExchanged} {pluralize(displayData.damageExchanged, 'unit', 'units')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Restocked</p>
                  <p className="text-lg sm:text-xl font-bold text-green-600">
                    {displayData.restockCount} {pluralize(displayData.restockCount, 'unit', 'units')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Current Stock</p>
                  <p className={`text-lg sm:text-xl font-bold ${
                    displayData.stock === 0 ? 'text-red-600' : 
                    displayData.stock <= product.reorderPoint ? 'text-orange-600' : 
                    'text-green-600'
                  }`}>
                    {displayData.stock} {pluralize(displayData.stock, 'unit', 'units')}
                  </p>
                </div>
              </div>
            </div>

            {/* Batch List Section - UNCHANGED */}
            {isPerishable && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 sm:p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-800 text-sm sm:text-base">Batch List</h3>
                  <button
                    onClick={() => setShowAddBatchModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0B3C8A] text-white rounded-lg text-xs font-medium hover:bg-[#082F6E] transition-colors"
                  >
                    <Plus size={14} />
                    Add New Batch
                  </button>
                </div>

                {loading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw size={24} className="animate-spin text-gray-400" />
                  </div>
                ) : batches.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No batches found</p>
                    <p className="text-xs mt-1">Click "Add New Batch" to create one</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-100/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Batch SKU</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Expiry Date</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Stock</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {batches.filter(b => b.isActive !== false).map((batch) => {
                          const expiryStatus = getExpiryStatus(batch.expiryDate);
                          return (
                            <tr key={batch.id} className="hover:bg-amber-50/50">
                              <td className="px-3 py-2 font-mono text-xs font-medium text-gray-800">
                                {batch.batchSku}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${expiryStatus.color}`}>
                                  {expiryStatus.icon}
                                  {expiryStatus.text}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`font-bold ${batch.stock === 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                  {batch.stock}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setAdjustingBatch(batch);
                                      setAdjustmentQuantity(1);
                                      setAdjustmentType('restock');
                                    }}
                                    className="p-1.5 hover:bg-green-100 rounded transition-colors text-green-600"
                                    title="Adjust Stock"
                                  >
                                    <RefreshCw size={14} />
                                  </button>
                                  <button
                                    onClick={() => setSelectedQRBatch(batch)}
                                    className="p-1.5 hover:bg-blue-100 rounded transition-colors text-blue-600"
                                    title="Show QR Code"
                                  >
                                    <QrCode size={14} />
                                  </button>
                                  <button
                                    onClick={() => setShowDeleteBatchModal(batch)}
                                    className="p-1.5 hover:bg-red-100 rounded transition-colors text-red-600"
                                    title="Delete Batch"
                                  >
                                    <Trash2 size={14} />
                                  </button>
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
            )}

            {/* Additional Details - for non-perishable products with expiry */}
            {(!isPerishable && product.expiryDate) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 sm:p-5">
                <h3 className="font-bold text-gray-800 mb-4 text-sm sm:text-base">Additional Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {product.batchNumber && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Batch Number</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800 font-mono">{product.batchNumber}</p>
                    </div>
                  )}
                  {product.expiryDate && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Expiry Date</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800">
                        {new Date(product.expiryDate).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 p-4 sm:p-6 border-t border-gray-100 bg-slate-50 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm sm:text-base font-medium hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>

      {/* Add Batch Modal */}
      <AnimatePresence>
        {showAddBatchModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-slate-50">
                <h3 className="text-lg font-bold text-gray-800">Add New Batch</h3>
                <button onClick={() => setShowAddBatchModal(false)} className="p-1 hover:bg-gray-200 rounded-full">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Batch SKU *</label>
                  <input
                    type="text"
                    value={newBatchSku}
                    onChange={(e) => setNewBatchSku(e.target.value)}
                    placeholder="e.g., BATCH-2024-001"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    value={newBatchExpiry}
                    onChange={(e) => setNewBatchExpiry(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Stock *</label>
                  <input
                    type="number"
                    min="1"
                    value={newBatchStock}
                    onChange={(e) => setNewBatchStock(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-slate-50 flex gap-3">
                <button
                  onClick={() => setShowAddBatchModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddBatch}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 rounded-lg bg-[#0B3C8A] text-white font-medium hover:bg-[#082F6E] disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Batch'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Adjust Batch Stock Modal */}
      <AnimatePresence>
        {adjustingBatch && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-slate-50">
                <h3 className="text-lg font-bold text-gray-800">Adjust Batch Stock</h3>
                <button onClick={() => setAdjustingBatch(null)} className="p-1 hover:bg-gray-200 rounded-full">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm font-semibold text-gray-800">{adjustingBatch.batchSku}</p>
                <p className="text-xs text-gray-500">Current Stock: <span className="font-bold">{adjustingBatch.stock} units</span></p>
                <p className="text-xs text-gray-500">Expiry Date: <span className="font-bold">{new Date(adjustingBatch.expiryDate).toLocaleDateString()}</span></p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setAdjustmentType('restock')}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all border-2 ${
                      adjustmentType === 'restock'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 bg-white text-gray-600'
                    }`}
                  >
                    Restock (+)
                  </button>
                  <button
                    onClick={() => setAdjustmentType('damaged')}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all border-2 ${
                      adjustmentType === 'damaged'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-300 bg-white text-gray-600'
                    }`}
                  >
                    Damaged (-)
                  </button>
                </div>
                
                <div>
                  <input
                    type="number"
                    min="1"
                    value={adjustmentQuantity}
                    onChange={(e) => setAdjustmentQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-lg font-bold text-center focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none"
                  />
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  {adjustmentType === 'restock' ? (
                    <p className="text-sm text-gray-900">
                      New Stock: <span className="font-bold text-green-600">{adjustingBatch.stock + adjustmentQuantity}</span>
                      <span className="text-gray-500 ml-2">(+{adjustmentQuantity})</span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-900">
                      New Stock: <span className="font-bold text-red-600">{Math.max(0, adjustingBatch.stock - adjustmentQuantity)}</span>
                      <span className="text-gray-500 ml-2">(-{adjustmentQuantity})</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-slate-50 flex gap-3">
                <button
                  onClick={() => setAdjustingBatch(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateBatchStock}
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 ${
                    adjustmentType === 'restock' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isSubmitting ? 'Updating...' : (adjustmentType === 'restock' ? 'Add Stock' : 'Remove Stock')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Batch Confirmation Modal */}
      <AnimatePresence>
        {showDeleteBatchModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden p-6 text-center"
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600 w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Batch?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete batch "<span className="font-semibold">{showDeleteBatchModal.batchSku}</span>"?
                This will remove {showDeleteBatchModal.stock} units from total stock.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteBatchModal(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteBatch}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal for Batch */}
      <AnimatePresence>
        {selectedQRBatch && (
          <QRCodeModal
            productId={product.id}
            productSku={`${product.sku}-${selectedQRBatch.batchSku}`}
            productName={`${product.name} (Batch: ${selectedQRBatch.batchSku})`}
            productPrice={product.markupPrice}
            batchId={selectedQRBatch.id}
            batchSku={selectedQRBatch.batchSku}
            batchExpiry={selectedQRBatch.expiryDate}
            onClose={() => setSelectedQRBatch(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}