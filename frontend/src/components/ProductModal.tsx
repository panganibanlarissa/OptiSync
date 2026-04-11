// src/components/ProductModal.tsx
"use client";

import React, { useState, useRef } from "react";
import { motion, Variants } from "framer-motion";
import { X, UploadCloud, Save, Trash2, Glasses, Calendar, Package as PackageIcon } from "lucide-react";
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
}

interface ProductModalProps {
  mode: 'add' | 'edit' | 'adjust';
  product: ProductFormData;
  onClose: () => void;
  onSave: (data: ProductFormData) => void;
  onDelete?: (id: string) => void;
  userRole?: string | null;
}

const modalVariants: Variants = { 
  hidden: { opacity: 0, scale: 0.95 }, 
  visible: { opacity: 1, scale: 1 }, 
  exit: { opacity: 0, scale: 0.95 } 
};

export default function ProductModal({ mode, product, onClose, onSave, onDelete, userRole }: ProductModalProps) {
  const [formData, setFormData] = useState<ProductFormData>(product);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(product.image || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showNotification } = useNotification();

  const isPerishable = formData.category === "Solutions" || formData.category === "Contact Lenses";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
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
    
    setSelectedFile(file);
    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { 
    e.preventDefault(); 
    
    try {
      setUploading(true);
      let imageUrl = formData.image;
      
      if (selectedFile) {
        try {
          imageUrl = await uploadImage(selectedFile, 'products');
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          showNotification("Image upload failed, product will be saved without image", "warning");
          imageUrl = null;
        }
      }
      
      const dataToSave = {
        ...formData,
        image: imageUrl
      };
      
      await onSave(dataToSave);
      
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      
    } catch (error) {
      console.error('Error:', error);
      showNotification("Failed to save product", "error");
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
            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-0.5 sm:mb-1">{formData.name}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3 font-mono">SKU: {formData.sku}</p>
            {formData.batchNumber && (
              <p className="text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3 flex items-center gap-1">
                <PackageIcon size={10} /> Batch: {formData.batchNumber}
              </p>
            )}
            <form id="stock-form" onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  New Physical Count
                </label>
                <input 
                  required 
                  name="stock" 
                  value={formData.stock || ''} 
                  onChange={handleChange} 
                  type="number" 
                  min="0" 
                  className={`w-full px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-sm sm:text-lg font-bold focus:ring-1 ${THEME_RING} focus:outline-none text-gray-700`} 
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                  Reason for Adjustment
                </label>
                <select 
                  name="adjustmentReason" 
                  value={formData.adjustmentReason || "Manual Count"} 
                  onChange={handleChange} 
                  className={`w-full px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none text-gray-700`}
                >
                  <option>Manual Count / Audit</option>
                  <option>Damaged Item</option>
                  <option>Return / Exchange</option>
                  <option>Restock</option>
                </select>
              </div>
            </form>
          </div>
          <div className="p-3 sm:p-4 border-t border-gray-100 bg-slate-50 flex gap-2 sm:gap-3">
            <button type="button" onClick={handleCancel} className="flex-1 px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" form="stock-form" className={`flex-1 px-3 py-1.5 rounded-md ${THEME_BG} text-white text-[11px] sm:text-sm font-medium ${THEME_HOVER}`}>
              Update Stock
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
                className={`group relative w-16 h-16 sm:w-24 sm:h-24 rounded-full sm:rounded-lg border-2 border-dashed 
                  ${uploading ? 'border-blue-300 bg-blue-50 cursor-wait' : 'border-gray-300 hover:border-[#0B3C8A] bg-slate-50 hover:bg-blue-50 cursor-pointer'} 
                  flex flex-col items-center justify-center transition-all overflow-hidden`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : previewUrl ? (
                  <div className="relative w-full h-full">
                    <Image src={previewUrl} alt="Preview" fill sizes="96px" className="object-cover" />
                  </div>
                ) : (
                  <UploadCloud className="text-gray-400 w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} disabled={uploading} />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Item Name</label>
                <input required name="name" value={formData.name} onChange={handleChange} type="text" className={`w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none text-gray-700`} />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Category</label>
                <select required name="category" value={formData.category} onChange={handleChange} className={`w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-[11px] sm:text-sm focus:ring-1 ${THEME_RING} focus:outline-none text-gray-700`}>
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
                <input name="sku" value={formData.sku} onChange={handleChange} type="text" className={`w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700`} />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Specifications</label>
                <input name="specifications" value={formData.specifications} onChange={handleChange} type="text" className={`w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700`} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Cost (₱)</label>
                <input required name="baseCost" value={formData.baseCost || ''} onChange={handleChange} type="number" min="0" step="0.01" className={`w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700`} />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Price (₱)</label>
                <input required name="markupPrice" value={formData.markupPrice || ''} onChange={handleChange} type="number" min="0" step="0.01" disabled={mode === 'edit' && userRole !== 'admin'} className={`w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700`} />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Stock</label>
                <input required name="stock" value={formData.stock || ''} onChange={handleChange} type="number" min="0" disabled={mode === 'edit'} className={`w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700`} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Reorder Point</label>
                <input name="reorderPoint" value={formData.reorderPoint || 10} onChange={handleChange} type="number" min="1" className={`w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700`} />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Lead Time (Days)</label>
                <input name="leadTimeDays" value={formData.leadTimeDays || 7} onChange={handleChange} type="number" min="1" className={`w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] sm:text-sm focus:ring-2 ${THEME_RING} focus:outline-none text-gray-700`} />
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
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none"
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
                  className={`w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none`} 
                />
                <p className="text-[9px] text-gray-400 mt-1">
                  Products will appear in expiry alerts {isPerishable ? '30 days before expiry' : ''}
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
          <button type="button" onClick={handleCancel} className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button type="submit" form="product-form" disabled={uploading} className={`flex-1 px-3 py-1.5 rounded-lg ${uploading ? 'bg-blue-400' : THEME_BG + ' ' + THEME_HOVER} text-white text-[11px] sm:text-sm font-medium flex justify-center items-center gap-2 transition-colors`}>
            {uploading ? 'Uploading...' : <><Save size={14}/> {mode === 'add' ? 'Save' : 'Update'}</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}