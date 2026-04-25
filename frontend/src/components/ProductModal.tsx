"use client";

import React, { useState, useRef } from "react";
import { motion, Variants } from "framer-motion";
import { X, UploadCloud, Save, Trash2, Calendar, Package as PackageIcon } from "lucide-react";
import { Archive } from "lucide-react";
import Image from "next/image";
import { uploadImage } from "@/services/cloudinary";
import { useNotification } from "@/components/NotificationProvider";

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_RING = "focus:ring-[#0B3C8A]";

export interface ProductFormData {
  id?: string;
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
  expiryDate?: string;
  batchNumber?: string;
  adjustmentReason?: string;
  archived?: boolean;
}

export interface ProductModalProps {
  mode: 'add' | 'edit' | 'adjust';
  product: ProductFormData;
  products?: any[];
  onClose: () => void;
  onSave: (data: ProductFormData) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string, archived: boolean) => void;
  userRole?: string | null;
}

const modalVariants: Variants = { 
  hidden: { opacity: 0, scale: 0.95 }, 
  visible: { opacity: 1, scale: 1 }, 
  exit: { opacity: 0, scale: 0.95 } 
};

export default function ProductModal({ 
  mode, 
  product, 
  products = [], 
  onClose, 
  onSave, 
  onDelete, 
  onArchive,
  userRole 
}: ProductModalProps) {
  const [formData, setFormData] = useState<ProductFormData>(product);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(product.image || null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showArchiveConfirmation, setShowArchiveConfirmation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showNotification, showToastOnly } = useNotification();

  // Stock adjustment specific state
  const [adjustmentType, setAdjustmentType] = useState<"restock" | "damaged">("restock");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(1);

  const isPerishable = formData.category === "Solutions" || formData.category === "Contact Lenses";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Auto-generate SKU when category changes (Works for both add and edit modes)
    if (name === 'category') {
      const categoryDefaults: Record<string, string> = {
        "Frames": "FRM",
        "Lenses": "LNS",
        "Contact Lenses": "CTL",
        "Solutions": "SOL",
        "Accessories": "ACC"
      };
      const prefix = categoryDefaults[value] || "ITM";
      // Filter existing products of the same category to determine the count
      const count = products.filter((p: any) => p.category === value).length + 1;
      const generatedSku = `${prefix}-${count.toString().padStart(2, '0')}`;
      
      setFormData(prev => ({ 
        ...prev, 
        category: value,
        sku: generatedSku
      }));
      return;
    }

    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'baseCost' || name === 'markupPrice' || name === 'stock' || name === 'leadTimeDays' || name === 'reorderPoint' 
        ? Number(value) 
        : value 
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      showNotification('Please select an image file', 'error');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be less than 5MB');
      showNotification('Image must be less than 5MB', 'error');
      return;
    }
    
    setUploadError(null);
    setSelectedFile(file);
    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { 
    e.preventDefault(); 
    
    try {
      setUploading(true);
      setUploadError(null);
      let imageUrl = formData.image;
      
      if (selectedFile) {
        try {
          console.log('Starting image upload for:', selectedFile.name);
          showToastOnly('Uploading image...', 'info');
          
          imageUrl = await uploadImage(selectedFile, 'products');
          
          console.log('Image upload successful:', imageUrl);
          showToastOnly('Image uploaded successfully', 'success');
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr);
          const uploadErrorMessage = uploadErr instanceof Error ? uploadErr.message : 'Image upload failed';
          setUploadError(uploadErrorMessage);
          showNotification(uploadErrorMessage, 'error');
          setUploading(false);
          return; // Stop here if image upload fails
        }
      }
      
      const dataToSave = {
        ...formData,
        image: imageUrl
      };
      
      console.log('Saving product with image URL:', imageUrl);
      await onSave(dataToSave);
      
      // Clean up preview URL
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      
    } catch (error) {
      console.error('Error saving product:', error);
      showNotification('Failed to save product', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    onClose();
  };

  const handleArchiveConfirm = () => {
    if (!formData.id || !onArchive) return;
    const nextArchivedState = !(formData.archived === true);
    onArchive(formData.id, nextArchivedState);
    setFormData((prev) => ({ ...prev, archived: nextArchivedState }));
    setShowArchiveConfirmation(false);
    onClose();
  };

  const handleAdjustStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adjustmentQuantity <= 0) {
      showToastOnly("Quantity must be greater than 0", "error");
      return;
    }
    
    let newStock: number;
    let reason: string;
    
    if (adjustmentType === "restock") {
      // Restock: Add quantity to current stock
      newStock = product.stock + adjustmentQuantity;
      reason = `Restock: +${adjustmentQuantity} units added to inventory`;
    } else {
      // Damaged: Subtract quantity from current stock
      if (adjustmentQuantity > product.stock) {
        showToastOnly(`Cannot mark ${adjustmentQuantity} units as damaged. Only ${product.stock} units in stock.`, "error");
        return;
      }
      newStock = product.stock - adjustmentQuantity;
      reason = `Damaged Item: -${adjustmentQuantity} units marked as damaged and removed from inventory`;
    }
    
    // Call onSave with the new stock value and reason
    const dataToSave = {
      ...product,
      stock: newStock,
      adjustmentReason: reason
    };
    
    onSave(dataToSave);
  };

  if (mode === 'adjust') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <motion.div 
          variants={modalVariants} 
          initial="hidden" 
          animate="visible" 
          exit="exit" 
          className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
        >
          <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-100 bg-slate-50">
            <h2 className="text-sm sm:text-lg font-bold text-gray-800">Stock Adjustment</h2>
            <button onClick={handleCancel} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <X size={16} className="text-gray-500 sm:w-5 sm:h-5" />
            </button>
          </div>
          
          <div className="p-4 sm:p-5">
            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-0.5 sm:mb-1">{product.name}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3 font-mono">SKU: {product.sku}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4">
              Current Stock: <span className="font-bold text-gray-800">{product.stock} units</span>
            </p>
            
            {product.batchNumber && (
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 flex items-center gap-1">
                <PackageIcon size={10} /> Batch: {product.batchNumber}
              </p>
            )}
            
            <form id="stock-adjustment-form" onSubmit={handleAdjustStockSubmit} className="space-y-4">
              {/* Adjustment Type Options */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustmentType("restock")}
                  className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs sm:text-sm transition-all border-2 ${
                    adjustmentType === "restock"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                  }`}
                >
                  Restock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType("damaged")}
                  className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs sm:text-sm transition-all border-2 ${
                    adjustmentType === "damaged"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                  }`}
                >
                  Damaged Item
                </button>
              </div>
              
              {/* Quantity Input */}
              <div>
                <input 
                  required 
                  type="number" 
                  min="1"
                  value={adjustmentQuantity}
                  onChange={(e) => setAdjustmentQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-md sm:rounded-lg border border-gray-300 text-sm sm:text-lg font-bold focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none text-gray-700"
                  placeholder={adjustmentType === "restock" ? "Quantity to add" : "Quantity to remove"}
                />
              </div>
              
              {/* Summary Preview */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {adjustmentType === "restock" ? (
                  <p className="text-xs sm:text-sm text-gray-900">
                    Current: <span className="font-bold text-gray-900">{product.stock}</span> → 
                    New Stock: <span className="font-bold text-green-600">{product.stock + adjustmentQuantity}</span>
                    <span className="text-gray-500 ml-2">(+{adjustmentQuantity})</span>
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-900">
                    Current: <span className="font-bold text-gray-900">{product.stock}</span> → 
                    New Stock: <span className="font-bold text-red-600">{Math.max(0, product.stock - adjustmentQuantity)}</span>
                    <span className="text-gray-500 ml-2">(-{adjustmentQuantity})</span>
                  </p>
                )}
              </div>
            </form>
          </div>
          
          <div className="p-3 sm:p-4 border-t border-gray-100 bg-slate-50 flex gap-2 sm:gap-3">
            <button 
              type="button" 
              onClick={handleCancel} 
              className="flex-1 px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              form="stock-adjustment-form" 
              className={`flex-1 px-3 py-1.5 rounded-md ${
                adjustmentType === "restock" 
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-red-600 hover:bg-red-700"
              } text-white text-[11px] sm:text-sm font-medium transition-colors shadow-sm`}
            >
              {adjustmentType === "restock" ? "Confirm Restock" : "Confirm Damaged"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div 
        variants={modalVariants} 
        initial="hidden" 
        animate="visible" 
        exit="exit" 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-100 bg-slate-50">
          <h2 className="text-sm sm:text-lg font-bold text-gray-800">
            {mode === 'add' ? 'Add New Product' : 'Edit Product Details'}
          </h2>
          <button onClick={handleCancel} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={16} className="text-gray-500 sm:w-5 sm:h-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto p-4 sm:p-5">
          <form id="product-form" onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="flex flex-col items-center justify-center mb-2 sm:mb-3">
              <div 
                onClick={() => !uploading && fileInputRef.current?.click()} 
                className={`group relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg border-2 border-dashed 
                  ${uploading ? 'border-blue-300 bg-blue-50 cursor-wait' : 'border-gray-300 hover:border-[#0B3C8A] bg-slate-50 hover:bg-blue-50 cursor-pointer'} 
                  flex flex-col items-center justify-center transition-all overflow-hidden`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[8px] text-blue-600 mt-1">Uploading...</span>
                  </div>
                ) : previewUrl ? (
                  <div className="relative w-full h-full">
                    <Image 
                      src={previewUrl} 
                      alt="Preview" 
                      fill 
                      sizes="96px" 
                      className="object-cover" 
                      unoptimized={previewUrl.startsWith('blob:')}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <UploadCloud className="text-gray-400 w-6 h-6 sm:w-8 sm:h-8" />
                    <span className="text-[8px] text-gray-400 mt-1">Click to upload</span>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/jpeg,image/png,image/gif,image/webp" 
                onChange={handleFileSelect} 
                disabled={uploading} 
              />
              {uploadError && (
                <p className="text-[9px] text-red-500 mt-1 text-center">{uploadError}</p>
              )}
              <p className="text-[8px] text-gray-400 mt-1">
                Supported formats: JPEG, PNG, GIF, WebP (Max 5MB)
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Item Name</label>
                <input required name="name" value={formData.name} onChange={handleChange} type="text" className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-[11px] sm:text-sm focus:ring-1 focus:ring-[#0B3C8A] focus:outline-none text-gray-700" />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Category</label>
                <select required name="category" value={formData.category} onChange={handleChange} className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-[11px] sm:text-sm focus:ring-1 focus:ring-[#0B3C8A] focus:outline-none text-gray-700">
                  <option>Frames</option>
                  <option>Lenses</option>
                  <option>Contact Lenses</option>
                  <option>Solutions</option>
                  <option>Accessories</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">SKU</label>
                <input name="sku" value={formData.sku} onChange={handleChange} type="text" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 font-mono text-[11px] sm:text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none text-gray-700" readOnly={mode === 'add'} />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Specifications</label>
                <input name="specifications" value={formData.specifications} onChange={handleChange} type="text" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none text-gray-700" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Cost (₱)</label>
                <input required name="baseCost" value={formData.baseCost || ''} onChange={handleChange} type="number" min="0" step="0.01" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none text-gray-700" />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Price (₱)</label>
                <input required name="markupPrice" value={formData.markupPrice || ''} onChange={handleChange} type="number" min="0" step="0.01" disabled={mode === 'edit' && userRole !== 'admin'} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none text-gray-700" />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Stock</label>
                <input required name="stock" value={formData.stock || ''} onChange={handleChange} type="number" min="0" disabled={mode === 'edit'} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none text-gray-700" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Reorder Point</label>
                <input name="reorderPoint" value={formData.reorderPoint || 10} onChange={handleChange} type="number" min="1" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none text-gray-700" />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Lead Time (Days)</label>
                <input name="leadTimeDays" value={formData.leadTimeDays || 7} onChange={handleChange} type="number" min="1" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none text-gray-700" />
              </div>
            </div>

            {/* Batch Number Field */}
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                <PackageIcon size={12} className="inline mr-1" /> Batch Number
              </label>
              <input 
                name="batchNumber" 
                value={formData.batchNumber || ''} 
                onChange={handleChange} 
                type="text" 
                placeholder="e.g., BATCH-2024-001"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none text-gray-900 placeholder-gray-400 bg-white"
              />
            </div>

            {/* Expiry Date - Only for perishable items */}
            {isPerishable && (
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  <Calendar size={12} className="inline mr-1" /> Expiry Date <span className="text-red-500">*</span>
                </label>
                <input 
                  required 
                  name="expiryDate" 
                  value={formData.expiryDate || ""} 
                  onChange={handleChange} 
                  type="date" 
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none text-gray-900 bg-white" 
                />
                <p className="text-[9px] text-gray-400 mt-1">
                  Products will appear in expiry alerts 30 days before expiry
                </p>
              </div>
            )}
          </form>
        </div>
        
        <div className="p-3 sm:p-4 border-t border-gray-100 bg-slate-50 flex gap-2 sm:gap-3">
          {mode === 'edit' && formData.id && userRole === 'admin' && onDelete && (
            <button type="button" onClick={() => onDelete(formData.id!)} className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 size={16}/>
            </button>
          )}
          {mode === 'edit' && formData.id && userRole === 'admin' && onArchive && (
            <button type="button" onClick={() => setShowArchiveConfirmation(true)} className="p-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
              <Archive size={16} />
            </button>
          )}
          <button type="button" onClick={handleCancel} className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button 
            type="submit" 
            form="product-form" 
            disabled={uploading} 
            className={`flex-1 px-3 py-1.5 rounded-lg ${uploading ? 'bg-blue-400 cursor-wait' : 'bg-[#0B3C8A] hover:bg-[#082F6E]'} text-white text-[11px] sm:text-sm font-medium flex justify-center items-center gap-2 transition-colors`}
          >
            {uploading ? (
              <>Uploading...</>
            ) : (
              <><Save size={14}/> {mode === 'add' ? 'Save' : 'Update'}</>
            )}
          </button>
        </div>
      </motion.div>

      {/* Archive Confirmation Modal - Updated button colors */}
      {showArchiveConfirmation && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-xl text-gray-900 mb-3">
              {formData.archived ? "Confirm Unarchive" : "Confirm Archive"}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to {formData.archived ? "unarchive" : "archive"} &quot;<span className="font-semibold text-gray-800">{formData.name}</span>&quot;?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowArchiveConfirmation(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveConfirm}
                className="px-4 py-2 rounded-lg bg-[#0B3C8A] text-white font-medium text-sm hover:bg-[#082F6E] transition-colors shadow-sm"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}