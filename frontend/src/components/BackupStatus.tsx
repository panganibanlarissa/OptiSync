// src/components/BackupStatus.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { backupService } from '@/services/backupService';

export default function BackupStatus() {
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const loadBackupStatus = async () => {
    setChecking(true);
    try {
      const currentStatus = await backupService.verifyBackup();
      setStatus(currentStatus);
      setHistory(backupService.getBackupHistory());
    } catch (error) {
      console.error('Error checking backup:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    loadBackupStatus();
    const interval = setInterval(loadBackupStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (!status) return 'bg-gray-100 text-gray-600 border-gray-200';
    switch (status.backupStatus) {
      case 'success': return 'bg-green-50 text-green-700 border-green-200';
      case 'failed': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
  };

  const getStatusIcon = () => {
    if (!status) return <Database size={14} />;
    switch (status.backupStatus) {
      case 'success': return <CheckCircle size={14} />;
      case 'failed': return <AlertCircle size={14} />;
      default: return <Clock size={14} />;
    }
  };

  if (!status) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-all ${getStatusColor()}`}
        title="Backup Status"
      >
        {getStatusIcon()}
        {checking && <RefreshCw size={10} className="animate-spin" />}
      </button>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-gray-100 bg-slate-50">
              <h3 className="font-semibold text-gray-800 text-sm">Cloud Backup Status</h3>
            </div>
            
            <div className="p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Last Backup:</span>
                <span className="font-medium text-gray-800">
                  {status.lastBackupTime ? new Date(status.lastBackupTime).toLocaleString() : 'Never'}
                </span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Records:</span>
                <span className="font-medium text-gray-800">{status.recordCount} products</span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Status:</span>
                <span className={`font-medium ${
                  status.backupStatus === 'success' ? 'text-green-600' :
                  status.backupStatus === 'failed' ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {status.backupStatus === 'success' ? 'Healthy' :
                   status.backupStatus === 'failed' ? 'Failed' : 'Pending'}
                </span>
              </div>

              {status.errorMessage && (
                <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
                  Error: {status.errorMessage}
                </div>
              )}

              <button
                onClick={loadBackupStatus}
                disabled={checking}
                className="w-full mt-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
                Verify Now
              </button>
            </div>

            {history.length > 1 && (
              <div className="border-t border-gray-100 p-2 bg-slate-50">
                <p className="text-[10px] text-gray-400 text-center">
                  Last 24 hours: {history.filter(h => h.backupStatus === 'success').length} successful checks
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}