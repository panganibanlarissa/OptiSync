"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import jsQR from "jsqr";

interface QRScannerModalProps {
  onClose: () => void;
  products: Array<{ id: string; sku: string }>;
  onProductFound: (productId: string) => void;
  mode?: 'search' | 'adjust' | 'cart' | 'in' | 'out';
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_RING = "focus:ring-[#0B3C8A]";

export default function QRScannerModal({ onClose, products, onProductFound, mode = 'cart' }: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [foundProduct, setFoundProduct] = useState<string | null>(null);
  const scanningRef = useRef(false);

  // Get context-aware messages based on mode
  const getInstructions = () => {
    switch(mode) {
      case 'search':
        return 'Point your camera at a product QR code to search for it';
      case 'adjust':
        return 'Point your camera at a product QR code to add it to inventory';
      case 'in':
        return 'Point your camera at a product QR code to receive stock';
      case 'out':
        return 'Point your camera at a product QR code to dispatch stock';
      case 'cart':
      default:
        return 'Point your camera at a product QR code to add it to cart';
    }
  };

  const getSuccessMessage = () => {
    switch(mode) {
      case 'search':
        return '✓ Product found! Searching...';
      case 'adjust':
        return '✓ Product found! Adding to inventory...';
      case 'in':
        return '✓ Stock received! Processing...';
      case 'out':
        return '✓ Stock dispatched! Processing...';
      case 'cart':
      default:
        return '✓ Product found! Adding to cart...';
    }
  };

  useEffect(() => {
    if (!isScanning || !videoRef.current) {
      scanningRef.current = false;
      return;
    }

    scanningRef.current = true;
    setError(null);
    let animationFrameId: number;
    let stream: MediaStream | null = null;

    const startScanning = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        videoRef.current!.onloadedmetadata = () => {
          scanFrame();
        };
      } catch (err) {
        setError('Camera access denied or unavailable');
        setIsScanning(false);
        console.error('Error accessing camera:', err);
      }
    };

    const scanFrame = () => {
      if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const url = new URL(code.data, window.location.origin);
          const productId = url.searchParams.get('product');

          if (productId) {
            const product = products.find(p => p.id === productId);
            if (product) {
              scanningRef.current = false;
              setFoundProduct(productId);
              setTimeout(() => {
                onProductFound(productId);
              }, 500);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Error scanning frame:', err);
      }

      animationFrameId = requestAnimationFrame(scanFrame);
    };

    startScanning();

    return () => {
      cancelAnimationFrame(animationFrameId);
      scanningRef.current = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isScanning, products, onProductFound]);

  const handleManualInput = () => {
    if (!manualInput.trim()) return;

    const product = products.find(p => p.id === manualInput || p.sku === manualInput);
    if (product) {
      setFoundProduct(product.id);
      setManualInput("");
      setTimeout(() => {
        onProductFound(product.id);
      }, 300);
    } else {
      setError(`Product with ID/SKU "${manualInput}" not found`);
      setManualInput("");
    }
  };

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
          <h2 className="text-sm sm:text-lg font-bold text-gray-800">Scan Product QR Code</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={16} className="text-gray-500 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-[11px] sm:text-sm text-blue-700">
              {getInstructions()}
            </p>
          </div>

          {isScanning && (
            <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div className="absolute inset-0 border-2 border-blue-400/50 rounded-lg">
                <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border-2 border-blue-400 rounded-lg shadow-lg"></div>
              </div>
            </div>
          )}

          {foundProduct && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-[11px] sm:text-sm text-green-700">{getSuccessMessage()}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-[11px] sm:text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setIsScanning(!isScanning);
                setError(null);
                setFoundProduct(null);
              }}
              className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isScanning
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isScanning ? 'Stop Scanning' : 'Start Scanning'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                Enter Product ID or SKU Manually
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter product ID or SKU..."
                  value={manualInput}
                  onChange={(e) => {
                    setManualInput(e.target.value);
                    setError(null);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleManualInput();
                    }
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-1 ${THEME_RING} focus:outline-none text-gray-700`}
                />
                <button
                  onClick={handleManualInput}
                  className={`px-4 py-2 rounded-lg ${THEME_BG} ${THEME_HOVER} text-white font-medium text-sm transition-colors`}
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 border-t border-gray-100 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
