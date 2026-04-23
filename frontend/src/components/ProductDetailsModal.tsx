'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import Image from 'next/image';

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

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
    expiryDate?: string | null;
    batchNumber?: string;
  };
  onClose: () => void;
}

export default function ProductDetailsModal({ product, onClose }: ProductDetailsModalProps) {
  const margin = product.markupPrice - product.baseCost;
  const marginPercentage = product.baseCost > 0 ? ((margin / product.baseCost) * 100).toFixed(2) : '0';

  // Helper function to pluralize units and days
  const pluralize = (count: number, singular: string, plural: string) => {
    return count <= 1 ? singular : plural;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 bg-slate-50 z-10">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Product Details</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-6 space-y-6">
          {/* Image and Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {/* Product Image */}
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

            {/* Basic Product Info */}
            <div className="sm:col-span-2 space-y-4">
              <div>
                <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase mb-1">Product Name</p>
                <p className="text-base sm:text-lg font-bold text-gray-800">{product.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase mb-1">SKU</p>
                  <p className="text-sm sm:text-base font-mono font-bold text-gray-800">{product.sku}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase mb-1">Category</p>
                  <p className="text-sm sm:text-base font-bold text-gray-800">{product.category}</p>
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

          {/* Inventory Information */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 sm:p-5">
            <h3 className="font-bold text-gray-800 mb-4 text-sm sm:text-base">Inventory Information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Beginning Inventory</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800">{product.beginningInventory || 0} {pluralize(product.beginningInventory || 0, 'unit', 'units')}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Sold</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800">{product.totalSold || 0} {pluralize(product.totalSold || 0, 'unit', 'units')}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Damage Item</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800">{product.damageExchanged || 0} {pluralize(product.damageExchanged || 0, 'unit', 'units')}</p>
              </div>
              <div className="sm:col-span-1">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Current Stock</p>
                <p className={`text-lg sm:text-xl font-bold ${
                  product.stock === 0 ? 'text-red-600' : 
                  product.stock <= product.reorderPoint ? 'text-orange-600' : 
                  'text-green-600'
                }`}>
                  {product.stock} {pluralize(product.stock, 'unit', 'units')}
                </p>
              </div>
              <div className="sm:col-span-1">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Reorder Point</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800">{product.reorderPoint} {pluralize(product.reorderPoint, 'unit', 'units')}</p>
              </div>
              <div className="sm:col-span-1">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Lead Time</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800">{product.leadTimeDays} {pluralize(product.leadTimeDays, 'day', 'days')}</p>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          {product.expiryDate && (
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
  );
}
