// src/components/PendingRequestsBadge.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Repeat } from "lucide-react";
import { useFirebase } from "@/context/FirebaseContext";
import ReplacementRequestApprovalModal from "./ReplacementRequestApprovalModal";

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

export default function PendingRequestsBadge() {
  const { replacementRequests, fetchReplacementRequests, userRole } = useFirebase();
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showRequestsList, setShowRequestsList] = useState(false);

  useEffect(() => {
    if (userRole === "admin") {
      fetchReplacementRequests(false);
    }
  }, [userRole, fetchReplacementRequests]);

  useEffect(() => {
    const pending = replacementRequests.filter(r => r.status === "pending").length;
    setPendingCount(pending);
  }, [replacementRequests]);

  if (userRole !== "admin" || pendingCount === 0) {
    return null;
  }

  const pendingRequests = replacementRequests.filter(r => r.status === "pending");

  const handleRequestClick = (request: any) => {
    setSelectedRequest(request);
    setShowRequestsList(false);
  };

  return (
    <>
      <button
        onClick={() => setShowRequestsList(!showRequestsList)}
        className="relative p-2 rounded-full hover:bg-amber-100 transition-colors"
        title={`${pendingCount} pending replacement request${pendingCount !== 1 ? 's' : ''}`}
      >
        <Repeat size={20} className="text-amber-600" />
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white ring-2 ring-white">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      </button>

      {/* Pending Requests Dropdown */}
      {showRequestsList && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowRequestsList(false)} />
          <div className="absolute right-0 top-12 w-80 bg-white shadow-xl rounded-lg border border-gray-100 z-40 overflow-hidden ring-1 ring-black ring-opacity-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-amber-600" />
                <h3 className="font-semibold text-amber-800">Pending Replacement Requests</h3>
              </div>
              <p className="text-[10px] text-amber-600 mt-0.5">
                {pendingCount} request{pendingCount !== 1 ? 's' : ''} awaiting review
              </p>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {pendingRequests.map((request) => (
                <button
                  key={request.id}
                  onClick={() => handleRequestClick(request)}
                  className="w-full px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        #{request.transactionReceiptNumber}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {request.patientName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-amber-600">
                      <ClockIcon size={10} />
                      Pending
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5 truncate">
                    Reason: {request.reason.substring(0, 50)}...
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Requested by: {request.requestedBy}
                  </p>
                </button>
              ))}
            </div>
            
            <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
              <p className="text-[10px] text-gray-500">
                Click on a request to review
              </p>
            </div>
          </div>
        </>
      )}

      {/* Approval Modal */}
      {selectedRequest && (
        <ReplacementRequestApprovalModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onSuccess={() => {
            setSelectedRequest(null);
            fetchReplacementRequests(true);
          }}
        />
      )}
    </>
  );
}