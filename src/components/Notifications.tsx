"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  AlertTriangle,
  ShoppingBag,
  Info,
  Circle,
  X,
  Glasses
} from "lucide-react";

type Notification = {
  id: number;
  title: string;
  message: string;
  time: string;
  type: "alert" | "sale" | "info";
  read: boolean;
};

// --- MOCK DATA ---
const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    title: "Critical Stock Alert",
    message: "Multi-Purpose Lens Solution (360ml) is below 5 units.",
    time: "2 mins ago",
    type: "alert",
    read: false,
  },
  {
    id: 2,
    title: "New Sale Recorded",
    message: "Order #1042 confirmed: Titanium Rimless Frames.",
    time: "15 mins ago",
    type: "sale",
    read: false,
  },
  {
    id: 3,
    title: "Inventory Updated",
    message: "Restocked 50 units of Anti-Rad Blue Cut Lenses.",
    time: "1 hour ago",
    type: "info",
    read: true,
  },
  {
    id: 4,
    title: "Low Stock Warning",
    message: "Microfiber Cleaning Cloths are running low.",
    time: "3 hours ago",
    type: "alert",
    read: true,
  },
  {
    id: 5,
    title: "System Update",
    message: "Price list for '2025 Designer Collection' updated.",
    time: "1 day ago",
    type: "info",
    read: true,
  },
  {
    id: 6,
    title: "New User",
    message: "Staff account 'Dr. Reyes' (Optometrist) created.",
    time: "2 days ago",
    type: "info",
    read: true,
  },
];

export default function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // -- HANDLERS --

  const handleOpenViewAll = () => {
    setIsOpen(false);
    setShowAllModal(true);
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  // -- UI HELPERS --

  const getIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle size={18} className="text-orange-600" />;
      case "sale":
        return <ShoppingBag size={18} className="text-green-600" />;
      default:
        return <Info size={18} className="text-blue-500" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case "alert":
        return "bg-orange-100";
      case "sale":
        return "bg-green-100";
      default:
        return "bg-blue-100";
    }
  };

  // Shared Render Function
  const renderNotificationList = (maxHeightClass: string) => (
    <ul className={`${maxHeightClass} overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200`}>
      {notifications.length === 0 ? (
        <li className="p-8 text-center text-gray-500 text-sm">
          No notifications found.
        </li>
      ) : (
        notifications.map((notif) => (
          <li
            key={notif.id}
            onClick={() => markOneAsRead(notif.id)}
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
                  {notif.time}
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
            {unreadCount}
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
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                >
                  <Check size={14} /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            {renderNotificationList("max-h-[380px]")}

            {/* Footer */}
            <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
              <button
                onClick={handleOpenViewAll}
                className="text-xs text-gray-600 hover:text-gray-900 font-semibold w-full py-1"
              >
                View all notifications
              </button>
            </div>
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
                  You have {unreadCount} unread messages
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
                  onClick={markAllAsRead}
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