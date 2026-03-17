"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  AlertTriangle,
  ShoppingBag,
  Info,
  Circle,
  X
} from "lucide-react";
import { useNotification, Notification } from "./NotificationProvider";
import { useRouter } from "next/navigation";

export default function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotification();
  const router = useRouter();

  // -- HANDLERS --

  const handleOpenViewAll = () => {
    setIsOpen(false);
    setShowAllModal(true);
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.link) {
      router.push(notification.link);
    } else {
      // Default navigation based on type
      switch (notification.type) {
        case 'warning':
          router.push('/inventory');
          break;
        case 'success':
          if (notification.title.includes('Sale')) {
            router.push('/sales');
          } else {
            router.push('/inventory');
          }
          break;
        case 'info':
          router.push('/reports');
          break;
      }
    }
    
    setShowAllModal(false);
    setIsOpen(false);
  };

  // -- UI HELPERS --

  const getIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertTriangle size={18} className="text-orange-600" />;
      case "success":
        return <ShoppingBag size={18} className="text-green-600" />;
      case "error":
        return <AlertTriangle size={18} className="text-red-600" />;
      case "info":
        return <Info size={18} className="text-blue-500" />;
      default:
        return <Info size={18} className="text-blue-500" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case "warning":
        return "bg-orange-100";
      case "success":
        return "bg-green-100";
      case "error":
        return "bg-red-100";
      case "info":
        return "bg-blue-100";
      default:
        return "bg-blue-100";
    }
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  // Shared Render Function
  const renderNotificationList = (maxHeightClass: string) => (
    <ul className={`${maxHeightClass} overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200`}>
      {notifications.length === 0 ? (
        <li className="p-8 text-center text-gray-500 text-sm">
          <Bell size={32} className="mx-auto mb-2 opacity-20" />
          No notifications yet
        </li>
      ) : (
        notifications.map((notif) => (
          <li
            key={notif.id}
            onClick={() => handleNotificationClick(notif)}
            className={`px-4 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group relative ${
              !notif.read ? "bg-blue-50/50" : ""
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`mt-1 p-2.5 rounded-full flex-shrink-0 ${getIconBg(
                  notif.type
                )}`}
              >
                {getIcon(notif.type)}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <p
                    className={`text-sm ${
                      !notif.read
                        ? "font-bold text-gray-800"
                        : "font-semibold text-gray-700"
                    }`}
                  >
                    {notif.title}
                  </p>
                  {!notif.read && (
                    <Circle
                      size={10}
                      className="fill-blue-600 text-blue-600 mt-1"
                    />
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1 leading-snug">
                  {notif.message}
                </p>
                <p className="text-[11px] text-gray-400 mt-2 font-medium">
                  {formatTime(notif.timestamp)}
                </p>
              </div>
            </div>
          </li>
        ))
      )}
    </ul>
  );

  return (
    <div className="relative font-sans">
      {/* --- BELL ICON TRIGGER --- */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
      >
        <Bell size={22} className="text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* --- SMALL DROPDOWN (Quick View) --- */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          ></div>

          <div className="absolute right-[-10px] sm:right-0 top-12 w-80 sm:w-96 bg-white shadow-xl rounded-lg border border-gray-100 z-40 overflow-hidden ring-1 ring-black ring-opacity-5 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex justify-between items-center backdrop-blur-sm">
              <h3 className="font-semibold text-gray-800">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllAsRead();
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                >
                  <Check size={14} /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            {renderNotificationList("max-h-[380px]")}

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
                <button
                  onClick={handleOpenViewAll}
                  className="text-xs text-gray-600 hover:text-gray-900 font-semibold w-full py-1"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* --- BIG "VIEW ALL" MODAL --- */}
      {showAllModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  All Notifications
                </h2>
                <p className="text-sm text-gray-500">
                  You have {unreadCount} unread {unreadCount === 1 ? 'message' : 'messages'}
                </p>
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-white">
              {renderNotificationList("h-full")}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    markAllAsRead();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowAllModal(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}