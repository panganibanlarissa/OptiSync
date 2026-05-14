// src/components/ReplacementRequestModal.tsx
"use client";

import React, { useState } from "react";
import { motion, Variants } from "framer-motion";
import { X, AlertTriangle, FileText, Send, Repeat, Shield, User, Calendar } from "lucide-react";
import { useNotification } from "./NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

interface ReplacementRequestModalProps {
  transactionId: string;
  transactionReceiptNumber: string;
  patientName: string;
  originalTotal: number;
  originalItems: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReplacementRequestModal({
  transactionId,
  transactionReceiptNumber,
  patientName,
  originalTotal,
  originalItems,
  onClose,
  onSuccess,
}: ReplacementRequestModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showNotification, showToastOnly } = useNotification();
  const { createReplacementRequest, userName, userId } = useFirebase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      showToastOnly("Please provide a reason for the replacement request", "error");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await createReplacementRequest(
        transactionId,
        reason.trim(),
        userName || "Staff",
        userId || "system"
      );
      
      showNotification(
        `Replacement request submitted for transaction #${transactionReceiptNumber}. An admin will review it shortly.`,
        "info",
        "Replacement Request Submitted",
        "/sales?tab=history"
      );
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error submitting replacement request:", error);
      const errorMessage = error.message || "Failed to submit replacement request";
      showToastOnly(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const totalValue = originalItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-xl">
              <Repeat className="text-orange-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Request Replacement</h2>
              <p className="text-xs text-gray-500">Submit a replacement request for admin review</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isSubmitting}
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Transaction Info */}
        <div className="p-5 bg-slate-50 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Receipt Number</p>
              <p className="font-mono font-bold text-gray-800 text-sm mt-1">{transactionReceiptNumber}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar size={12} className="text-gray-400" />
                <p className="text-sm text-gray-700">{formatDate()}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Customer</p>
              <div className="flex items-center gap-1.5 mt-1">
                <User size={12} className="text-gray-400" />
                <p className="text-sm font-medium text-gray-800">{patientName}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Original Amount</p>
              <p className="text-sm font-bold text-[#0B3C8A] mt-1">₱{originalTotal.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="p-5 border-b border-gray-100 max-h-48 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <FileText size={14} /> Items to be replaced:
          </p>
          <div className="space-y-2">
            {originalItems.map((item, index) => (
              <div key={`${item.id}-${index}`} className="flex justify-between items-center py-2 border-b border-gray-50">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="text-[10px] text-gray-500">Quantity: {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-gray-700">₱{(item.price * item.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-600">Total Value</span>
            <span className="text-sm font-bold text-gray-800">₱{totalValue.toLocaleString()}</span>
          </div>
        </div>

        {/* Warranty Notice */}
        <div className="p-5 bg-amber-50 border-b border-amber-100">
          <div className="flex items-start gap-3">
            <Shield size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Warranty Notice</p>
              <p className="text-[10px] text-amber-700 mt-0.5">
                This request will be reviewed by an administrator. Replacement is only applicable for items still under warranty.
              </p>
            </div>
          </div>
        </div>

        {/* Reason Form */}
        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Reason for Replacement <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Please provide detailed reason for replacement (e.g., defective item, wrong size, manufacturing defect, etc.)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C8A] text-gray-700 placeholder-gray-400 resize-none"
              required
              disabled={isSubmitting}
            />
            <p className="text-[10px] text-gray-400 mt-1.5">
              This reason will be visible to administrators reviewing your request
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#0B3C8A] text-white text-sm font-medium hover:bg-[#082F6E] transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}