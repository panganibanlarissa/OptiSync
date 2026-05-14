// src/components/ReplacementRequestApprovalModal.tsx
"use client";

import React, { useState } from "react";
import { motion, Variants } from "framer-motion";
import { X, CheckCircle2, XCircle, AlertTriangle, User, Calendar, FileText, Repeat, Shield } from "lucide-react";
import { useNotification } from "./NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

interface ReplacementRequestApprovalModalProps {
  request: {
    id: string;
    transactionId: string;
    transactionReceiptNumber: string;
    patientName: string;
    originalTotal: number;
    originalItems: any[];
    reason: string;
    requestedBy: string;
    requestedAt: Date;
    status: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

// Helper Clock component
const ClockIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

export default function ReplacementRequestApprovalModal({
  request,
  onClose,
  onSuccess,
}: ReplacementRequestApprovalModalProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const { showNotification, showToastOnly } = useNotification();
  const { approveReplacementRequest, rejectReplacementRequest, userName, userId } = useFirebase();

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await approveReplacementRequest(
        request.id,
        userName || "Admin",
        userId || "system"
      );
      
      showNotification(
        `Replacement request for transaction #${request.transactionReceiptNumber} has been approved.`,
        "success",
        "Request Approved",
        "/sales?tab=history"
      );
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error approving request:", error);
      showToastOnly(error.message || "Failed to approve request", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      showToastOnly("Please provide a reason for rejection", "error");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await rejectReplacementRequest(
        request.id,
        userName || "Admin",
        userId || "system",
        rejectionReason.trim()
      );
      
      showNotification(
        `Replacement request for transaction #${request.transactionReceiptNumber} has been rejected.`,
        "warning",
        "Request Rejected",
        "/sales?tab=history"
      );
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error rejecting request:", error);
      showToastOnly(error.message || "Failed to reject request", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalValue = request.originalItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Repeat className="text-purple-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Replacement Request Review</h2>
              <p className="text-xs text-gray-500">Review and respond to replacement request</p>
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

        {/* Request Info */}
        <div className="p-5 bg-slate-50 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Receipt Number</p>
              <p className="font-mono font-bold text-gray-800 text-sm mt-1">{request.transactionReceiptNumber}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Requested On</p>
              <p className="text-sm text-gray-700 mt-1">{formatDate(request.requestedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Customer</p>
              <div className="flex items-center gap-1.5 mt-1">
                <User size={12} className="text-gray-400" />
                <p className="text-sm font-medium text-gray-800">{request.patientName}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Requested By</p>
              <p className="text-sm text-gray-700 mt-1">{request.requestedBy}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Original Amount</p>
              <p className="text-sm font-bold text-[#0B3C8A] mt-1">₱{request.originalTotal.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</p>
              <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700">
                <ClockIcon size={10} />
                Pending Review
              </span>
            </div>
          </div>
        </div>

        {/* Items to Replace */}
        <div className="p-5 border-b border-gray-100 max-h-48 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <FileText size={14} /> Items to be Replaced
          </p>
          <div className="space-y-2">
            {request.originalItems.map((item, index) => (
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

        {/* Reason Section */}
        <div className="p-5 bg-amber-50 border-b border-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Replacement Reason</p>
              <p className="text-sm text-amber-700 mt-1">{request.reason}</p>
            </div>
          </div>
        </div>

        {/* Action Section */}
        {!actionType ? (
          <div className="p-5 flex gap-3">
            <button
              onClick={() => setActionType("reject")}
              className="flex-1 px-4 py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              <XCircle size={16} />
              Reject Request
            </button>
            <button
              onClick={() => setActionType("approve")}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              Approve Request
            </button>
          </div>
        ) : (
          <div className="p-5">
            {actionType === "reject" && (
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide reason for rejecting this replacement request..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700 placeholder-gray-400 resize-none"
                  disabled={isSubmitting}
                />
                <p className="text-[10px] text-gray-400 mt-1.5">
                  This reason will be visible to the staff who submitted the request
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setActionType(null)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={actionType === "approve" ? handleApprove : handleReject}
                disabled={isSubmitting || (actionType === "reject" && !rejectionReason.trim())}
                className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 ${
                  actionType === "approve" 
                    ? "bg-emerald-600 hover:bg-emerald-700" 
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {actionType === "approve" ? (
                      <>
                        <CheckCircle2 size={16} />
                        Confirm Approval
                      </>
                    ) : (
                      <>
                        <XCircle size={16} />
                        Confirm Rejection
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}