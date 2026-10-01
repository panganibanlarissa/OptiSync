// src/components/QRCodeModal.tsx
'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Printer } from 'lucide-react';
import QRCode from 'qrcode';

const PESO_SIGN = '\u20B1';

const THEME_BG = 'bg-[#0B3C8A]';
const THEME_HOVER = 'hover:bg-[#082F6E]';

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

interface QRCodeModalProps {
  productId: string;
  productSku: string;
  productName: string;
  onClose: () => void;
  productPrice?: number;
  batchId?: string;
  batchSku?: string;
  batchExpiry?: string;
}

export default function QRCodeModal({ 
  productId, 
  productSku, 
  productName, 
  onClose, 
  productPrice,
  batchId,
  batchSku,
  batchExpiry
}: QRCodeModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  // Build QR value - include batch info if present
  let qrValue = `${window.location.origin}/inventory?product=${productId}&name=${encodeURIComponent(productName)}`;
  if (batchId && batchSku) {
    qrValue += `&batch=${batchId}&batchSku=${encodeURIComponent(batchSku)}`;
    if (batchExpiry) {
      qrValue += `&expiry=${batchExpiry}`;
    }
  }

  const printQRCode = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrImageUrl = await QRCode.toDataURL(qrValue, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }[character] || character));
    const formattedExpiry = batchExpiry ? new Date(batchExpiry).toLocaleDateString() : '';
    const batchMarkup = batchSku ? `<div class="detail">Batch: ${escapeHtml(batchSku)}</div>` : '';
    const expiryMarkup = formattedExpiry ? `<div class="detail">Expiry: ${escapeHtml(formattedExpiry)}</div>` : '';
    const priceMarkup = productPrice !== undefined ? `${PESO_SIGN}${productPrice.toFixed(2)}` : 'N/A';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Product QR Tag - ${displayName}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            padding: 10mm;
            background: white;
          }
          @media print {
            body {
              padding: 0;
              background: white;
            }
            .tag {
              page-break-after: avoid;
              break-inside: avoid;
              margin: 0;
            }
          }
          .tag {
            width: 68mm;
            height: 22mm;
            background: white;
            padding: 2mm;
            display: flex;
            align-items: stretch;
            gap: 2mm;
            border: 0.25mm solid #000;
            overflow: hidden;
          }
          .qr-code-container {
            flex: 0 0 12.7mm;
            width: 12.7mm;
            height: 12.7mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-code-container img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .info-section {
            flex: 1;
            min-width: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .product-name {
            font-size: 7pt;
            font-weight: 700;
            line-height: 1.1;
            overflow-wrap: anywhere;
          }
          .detail {
            font-size: 5.5pt;
            line-height: 1.2;
            overflow-wrap: anywhere;
          }
          .price {
            font-size: 6pt;
            font-weight: 700;
            margin-top: 1mm;
          }
        </style>
      </head>
      <body>
        <div class="tag">
          <div class="qr-code-container">
            <img src="${qrImageUrl}" alt="QR Code for ${escapeHtml(productName)}" />
          </div>
          <div class="info-section">
            <div class="product-name">${escapeHtml(productName)}</div>
            <div class="detail">SKU: ${escapeHtml(productSku)}</div>
            ${batchMarkup}
            ${expiryMarkup}
            <div class="price">Retail: ${priceMarkup}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const displayName = batchSku ? `${productName} (Batch: ${batchSku})` : productName;
  const displaySku = batchSku ? `${productSku} (Batch: ${batchSku})` : productSku;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-slate-50">
          <h2 className="text-sm sm:text-lg font-bold text-gray-800 truncate pr-2">
            {displayName} - QR Code
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0">
            <X size={16} className="text-gray-500 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8 flex flex-col items-center gap-4">
          <div ref={qrRef} className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrValue)}`}
              alt={`QR Code for ${displayName}`}
              className="w-64 h-64"
            />
          </div>

          <p className="text-xs sm:text-sm font-semibold text-gray-700 text-center">
            {displayName}
          </p>

          {batchExpiry && (
            <p className="text-[10px] sm:text-xs text-orange-600 text-center">
              Expiry: {new Date(batchExpiry).toLocaleDateString()}
            </p>
          )}

          <p className="text-[10px] sm:text-xs text-gray-500 text-center px-2">
            Scan this QR code to quickly adjust stock for this batch
          </p>

          <div className="text-[9px] sm:text-[10px] text-gray-400 bg-gray-50 p-2 sm:p-3 rounded text-center font-mono break-all w-full">
            ID: {batchId || productId}
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-gray-100 bg-slate-50 flex gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-gray-300 text-gray-700 text-[11px] sm:text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={printQRCode}
            className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg ${THEME_BG} ${THEME_HOVER} text-white text-[11px] sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 sm:gap-2`}
          >
            <Printer size={14} className="sm:w-4 sm:h-4" />
            Print QR
          </button>
        </div>
      </motion.div>
    </div>
  );
}