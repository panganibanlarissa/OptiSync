"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  Box,
  AlertTriangle,
  TrendingUp,
  Package,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Banknote,
  BarChart3,
} from "lucide-react";

// --- TYPESCRIPT INTERFACES ---
interface StatData {
  id: string;
  label: string;
  value: number;
  trend: string;
  trendType: string;
}

interface ForecastData {
  name: string;
  currentStock: number;
  predictedDemand: number;
  trend: string;
  priority: string;
}

interface InventoryData {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  status: string;
}

interface ChartBarGroupProps {
  label: string;
  actual: number;
  forecast: number;
  maxVal: number;
  delay: number;
  isWide?: boolean;
}

// --- ANIMATION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: {
    y: 20,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

// --- MOCK DATA ---
const CURRENT_PERIOD = "January 2026";

// 1. Vitals Bar Data
const STATS_DATA: StatData[] = [
  {
    id: "stock_value",
    label: "Total Stock Value",
    value: 450200,
    trend: "Stable",
    trendType: "neutral",
  },
  {
    id: "sales_today",
    label: "Today's Sales",
    value: 12500,
    trend: "+15%",
    trendType: "positive",
  },
  {
    id: "low_stock",
    label: "Low Stock Alerts",
    value: 8,
    trend: "Action Needed",
    trendType: "negative",
  },
  {
    id: "revenue_forecast",
    label: "30-Day Revenue Forecast",
    value: 142580,
    trend: "+18%",
    trendType: "positive",
  },
];

// 2. Forecasting Card Data (Recommended to Reorder)
const FORECAST_DATA: ForecastData[] = [
  {
    name: "Ray-Ban Aviator (Gold)",
    currentStock: 12,
    predictedDemand: 25,
    trend: "up",
    priority: "high",
  },
  {
    name: "Acuvue Oasys (6-Pack)",
    currentStock: 45,
    predictedDemand: 80,
    trend: "up",
    priority: "high",
  },
  {
    name: "Kids Flex Frames (Blue)",
    currentStock: 18,
    predictedDemand: 10,
    trend: "down",
    priority: "medium",
  },
];

// 3. Product Performance Heatmap Data (Profit vs Volume)
const HEATMAP_DATA = [
  {
    category: "Designer Frames",
    profit: 85,
    volume: 45,
    color: "bg-emerald-500",
  },
  {
    category: "Standard Lenses",
    profit: 50,
    volume: 95,
    color: "bg-blue-500",
  },
  {
    category: "Contact Lenses",
    profit: 65,
    volume: 70,
    color: "bg-indigo-500",
  },
  {
    category: "Solutions & Acc.",
    profit: 20,
    volume: 85,
    color: "bg-amber-500",
  },
];

// 4. Inventory Preview (Added more items to test the slice limit)
const INVENTORY_DATA: InventoryData[] = [
  {
    id: "FRM-001",
    name: "Ray-Ban Wayfarer (Black)",
    category: "Frames",
    stock: 15,
    price: 8500,
    status: "in_stock",
  },
  {
    id: "LNS-022",
    name: "Photochromic Lens (1.56)",
    category: "Lenses",
    stock: 8,
    price: 3500,
    status: "low_stock",
  },
  {
    id: "CNT-104",
    name: "Air Optix Colors (Gray)",
    category: "Contacts",
    stock: 32,
    price: 1800,
    status: "in_stock",
  },
  {
    id: "CNT-105",
    name: "Acuvue Daily Disposables",
    category: "Contacts",
    stock: 45,
    price: 2100,
    status: "in_stock",
  },
  {
    id: "ACC-006",
    name: "Lens Cleaning Kit",
    category: "Accessory",
    stock: 4,
    price: 250,
    status: "critical",
  },
  {
    id: "FRM-007",
    name: "Oakley Sport Frames",
    category: "Frames",
    stock: 6,
    price: 9200,
    status: "low_stock",
  },
  {
    id: "LNS-008",
    name: "Anti-Rad Planar Lens",
    category: "Lenses",
    stock: 18,
    price: 1500,
    status: "in_stock",
  },
];

// 5. Daily & Weekly Chart Data
const DAILY_DATA = [
  { label: "Mon", actual: 12500, forecast: 14000 },
  { label: "Tue", actual: 18200, forecast: 17500 },
  { label: "Wed", actual: 15000, forecast: 16000 },
  { label: "Thu", actual: 24500, forecast: 22000 },
  { label: "Fri", actual: 22000, forecast: 25000 },
  { label: "Sat", actual: 32000, forecast: 30000 },
  { label: "Sun", actual: 28000, forecast: 29000 },
];
const DAILY_MAX = 40000;

const WEEKLY_DATA = [
  { label: "Week 1", actual: 115000, forecast: 120000 },
  { label: "Week 2", actual: 132000, forecast: 125000 },
  { label: "Week 3", actual: 145000, forecast: 150000 },
  { label: "Week 4", actual: 128000, forecast: 130000 },
];
const WEEKLY_MAX = 160000;

// --- MAIN PAGE COMPONENT ---
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("daily");

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen mt-2 sm:mt-4 p-2 sm:p-4 space-y-3 sm:space-y-4"
    >
      {/* 1. VITALS BAR */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4"
      >
        {STATS_DATA.map((stat) => (
          <StatCard key={stat.id} data={stat} />
        ))}
      </motion.div>

      {/* 2. CHARTS & FORECASTING SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Sales Velocity Graph */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 sm:p-2 bg-[#0B3C8A] rounded-lg">
                  <Activity className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                  Sales Velocity
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 ml-1">
                <Calendar size={10} className="sm:w-3 sm:h-3" />
                <span>Period: {CURRENT_PERIOD}</span>
              </div>
            </div>

            <div className="bg-gray-100 p-0.5 sm:p-1 rounded-lg flex text-xs sm:text-sm font-medium">
              <button
                onClick={() => setActiveTab("daily")}
                className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-md transition-all text-[11px] sm:text-sm ${
                  activeTab === "daily"
                    ? "bg-white text-[#0B3C8A] shadow-sm font-semibold"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Daily Trends
              </button>
              <button
                onClick={() => setActiveTab("weekly")}
                className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-md transition-all text-[11px] sm:text-sm ${
                  activeTab === "weekly"
                    ? "bg-white text-[#0B3C8A] shadow-sm font-semibold"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Weekly Volume
              </button>
            </div>
          </div>

          <div className="relative min-h-87.5">
            <AnimatePresence mode="wait">
              {/* DAILY TAB */}
              {activeTab === "daily" && (
                <motion.div
                  key="daily"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex gap-2 sm:gap-4">
                    {/* Y-Axis Labels */}
                    <div className="flex flex-col justify-between h-40 sm:h-64 pb-6 text-[8px] sm:text-xs text-gray-400 font-medium text-right w-8 sm:w-12 border-r border-gray-100 pr-1 sm:pr-2 pt-4">
                      <span>40k</span>
                      <span>30k</span>
                      <span>20k</span>
                      <span>10k</span>
                      <span>0</span>
                    </div>

                    {/* Chart Area with Bar Groups */}
                    <div className="flex-1 h-40 sm:h-64 flex items-end justify-between gap-1 sm:gap-2 px-1 sm:px-2 border-b border-dashed border-gray-200 pb-2">
                      {DAILY_DATA.map((data, idx) => (
                        <ChartBarGroup
                          key={idx}
                          label={data.label}
                          actual={data.actual}
                          forecast={data.forecast}
                          maxVal={DAILY_MAX}
                          delay={idx * 0.1}
                        />
                      ))}
                    </div>
                  </div>

                  <motion.div className="flex flex-col items-center mt-3 sm:mt-6">
                    <div className="flex justify-center items-center gap-3 sm:gap-6 text-xs sm:text-sm bg-gray-50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gray-100">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-[#0B3C8A]"></span>
                        <span className="text-gray-700 font-medium text-[10px] sm:text-sm">
                          Actual Sales
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-blue-300"></span>
                        <span className="text-gray-700 font-medium text-[10px] sm:text-sm">
                          Predicted Demand
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] sm:text-xs text-gray-400 mt-2 sm:mt-3 text-center max-w-md leading-relaxed">
                      This bar graph tracks your daily sales velocity over the
                      week, highlighting peak transaction days against AI
                      projections.
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {/* WEEKLY TAB */}
              {activeTab === "weekly" && (
                <motion.div
                  key="weekly"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex gap-2 sm:gap-4">
                    {/* Y-Axis Labels */}
                    <div className="flex flex-col justify-between h-40 sm:h-64 pb-6 text-[8px] sm:text-xs text-gray-400 font-medium text-right w-8 sm:w-12 border-r border-gray-100 pr-1 sm:pr-2 pt-4">
                      <span>150k</span>
                      <span>100k</span>
                      <span>50k</span>
                      <span>25k</span>
                      <span>0</span>
                    </div>

                    {/* Chart Area with Bar Groups */}
                    <div className="flex-1 h-40 sm:h-64 flex items-end justify-around gap-1 sm:gap-2 px-1 sm:px-4 border-b border-dashed border-gray-200 pb-2">
                      {WEEKLY_DATA.map((data, idx) => (
                        <ChartBarGroup
                          key={idx}
                          label={data.label}
                          actual={data.actual}
                          forecast={data.forecast}
                          maxVal={WEEKLY_MAX}
                          delay={idx * 0.1}
                          isWide={true}
                        />
                      ))}
                    </div>
                  </div>

                  <motion.div className="flex flex-col items-center mt-3 sm:mt-6">
                    <div className="flex justify-center items-center gap-3 sm:gap-6 text-xs sm:text-sm bg-gray-50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gray-100">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-[#0B3C8A]"></span>
                        <span className="text-gray-700 font-medium text-[10px] sm:text-sm">
                          Actual Sales
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-blue-300"></span>
                        <span className="text-gray-700 font-medium text-[10px] sm:text-sm">
                          Predicted Demand
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] sm:text-xs text-gray-400 mt-2 sm:mt-3 text-center max-w-md leading-relaxed">
                      This graph compares your actual weekly sales volume
                      against the AI-generated forecasted demand to help you
                      adjust your future stock levels.
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Right: AI Forecast List (Recommended to Reorder) */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6 h-fit"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="text-[#0B3C8A] w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                Recommended to Reorder
              </h2>
              <p className="text-[9px] sm:text-xs font-medium text-blue-600">
                AI Predictive Forecast
              </p>
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
            {FORECAST_DATA.map((item, i) => (
              <ForecastItem key={i} data={item} />
            ))}
          </div>
        </motion.div>
      </div>

      {/* 3. PRODUCT PERFORMANCE & INVENTORY SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Product Performance Heatmap */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg">
              <BarChart3 className="text-emerald-700 w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                Performance Heatmap
              </h2>
              <p className="text-[9px] sm:text-xs text-gray-500">
                Profit vs. Volume Analysis
              </p>
            </div>
          </div>

          <p className="text-[10px] sm:text-[11px] text-gray-400 mb-3 sm:mb-5 leading-relaxed">
            Identifies which categories generate the most revenue (Solid Color)
            relative to how many physical units are sold (Gray Overlay).
          </p>

          <div className="space-y-3 sm:space-y-5">
            {HEATMAP_DATA.map((item, idx) => (
              <div key={idx} className="space-y-1 sm:space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-gray-700 text-[10px] sm:text-sm">
                    {item.category}
                  </span>
                </div>
                {/* Visual Bar representation */}
                <div className="relative h-5 sm:h-6 bg-gray-100 rounded-md overflow-hidden flex">
                  {/* Profit Bar */}
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${item.profit}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`${item.color} h-full flex items-center px-1.5 sm:px-2 text-[8px] sm:text-[10px] text-white font-bold whitespace-nowrap z-10`}
                  >
                    Profit {item.profit}%
                  </motion.div>
                  {/* Volume Marker/Overlay (Simulating heatmap volume overlap) */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className="absolute top-0 right-0 h-full border-l-2 border-dashed border-gray-400 bg-gray-200/50 flex items-center justify-end px-1.5 sm:px-2 text-[8px] sm:text-[10px] text-gray-600 font-bold"
                    style={{ width: `${100 - item.volume}%` }}
                  >
                    Vol {item.volume}%
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Center/Right: Inventory Table */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-7 h-fit"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-[#0B3C8A] rounded-lg">
                <Package className="text-white w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-lg font-bold text-gray-800">
                  Inventory Status
                </h2>
                <p className="text-[9px] sm:text-xs text-gray-500">
                  Real-time stock tracking
                </p>
              </div>
            </div>
            <Link
              href="/inventory"
              className="text-[9px] sm:text-xs font-semibold text-[#0B3C8A] bg-blue-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full whitespace-nowrap"
            >
              View All Catalog
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 text-[8px] sm:text-[10px] uppercase font-bold text-gray-500 overflow-x-auto pb-1">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></div> Good
              Standing
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0"></div> Needs
              Attention
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div> Restock
              Immediately
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-125 text-left text-xs sm:text-sm text-gray-600">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">PRODUCT ID</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">Item Name</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[#0B3C8A] text-[10px] sm:text-xs">Stock</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">Price</th>
                  <th className="pb-2 sm:pb-3 font-semibold text-[10px] sm:text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* THIS IS THE CHANGE: .slice(0, 6) added below */}
                {INVENTORY_DATA.slice(0, 6).map((item) => (
                  <TableRow key={item.id} data={item} />
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// --- COMPONENTS ---

function StatCard({ data }: { data: StatData }) {
  let Icon = Box;
  let themeColor = "blue";
  let displayValue: string | number = data.value;

  if (data.id === "low_stock") {
    Icon = AlertTriangle;
    themeColor = "orange";
  } else if (
    data.id === "stock_value" ||
    data.id === "sales_today" ||
    data.id === "revenue_forecast"
  ) {
    Icon = Banknote;
    themeColor = data.id === "sales_today" ? "emerald" : "blue";
    displayValue = `₱${data.value.toLocaleString()}`;
  }

  const styles: Record<string, { icon: string; bg: string; badge: string }> = {
    blue: {
      icon: "text-[#0B3C8A]",
      bg: "bg-blue-50",
      badge: "bg-blue-100 text-[#0B3C8A]",
    },
    emerald: {
      icon: "text-emerald-700",
      bg: "bg-emerald-50",
      badge: "bg-emerald-100 text-emerald-700",
    },
    orange: {
      icon: "text-orange-600",
      bg: "bg-orange-50",
      badge: "bg-orange-100 text-orange-700",
    },
  };

  const currentStyle = styles[themeColor] || styles.blue;

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white p-3 sm:p-5 rounded-xl shadow-sm border border-gray-100"
    >
      <div className="flex justify-between items-start">
        <div className={`p-2 sm:p-3 rounded-lg ${currentStyle.bg} mb-2 sm:mb-4`}>
          <Icon size={18} className={`${currentStyle.icon} sm:w-6 sm:h-6`} />
        </div>
        <span
          className={`px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${currentStyle.badge}`}
        >
          {data.trend}
        </span>
      </div>
      <h3 className="text-lg sm:text-2xl font-bold text-gray-800">{displayValue}</h3>
      <p className="text-xs sm:text-sm text-gray-500 mt-1">{data.label}</p>
    </motion.div>
  );
}

function ForecastItem({ data }: { data: ForecastData }) {
  const actionText =
    data.trend === "up"
      ? `Order ${data.predictedDemand - data.currentStock} Units`
      : "Hold Orders";

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      whileInView={{ x: 0, opacity: 1 }}
      viewport={{ once: true }}
      className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-100"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800 text-xs sm:text-sm truncate pr-2">
          {data.name}
        </h3>
        {data.trend === "up" ? (
          <ArrowUpRight size={14} className="text-[#0B3C8A] sm:w-4 sm:h-4" />
        ) : (
          <ArrowDownRight size={14} className="text-orange-500 sm:w-4 sm:h-4" />
        )}
      </div>
      <div className="flex justify-between text-xs sm:text-sm mb-2 sm:mb-3">
        <div>
          <p className="text-gray-500 text-[9px] sm:text-xs">Current</p>
          <p className="font-medium text-sm sm:text-base">{data.currentStock}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-[9px] sm:text-xs">Projected Demand</p>
          <p
            className={`font-bold text-sm sm:text-base ${
              data.trend === "up" ? "text-[#0B3C8A]" : "text-orange-500"
            }`}
          >
            {data.predictedDemand}
          </p>
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1 text-[9px] sm:text-xs text-gray-600 font-medium">
          <Package size={12} />
          {actionText}
        </div>
      </div>
    </motion.div>
  );
}

function TableRow({ data }: { data: InventoryData }) {
  let statusLabel = "In Stock";
  let statusColor = "bg-blue-100 text-[#0B3C8A]";

  if (data.status === "low_stock") {
    statusLabel = "Low Stock";
    statusColor = "bg-orange-100 text-orange-700";
  } else if (data.status === "critical") {
    statusLabel = "Critical";
    statusColor = "bg-red-100 text-red-700";
  }

  return (
    <tr className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
      <td className="py-2 sm:py-3 font-medium text-gray-800 text-[9px] sm:text-sm">
        {data.id}
      </td>
      <td className="py-2 sm:py-3 truncate max-w-37.5 text-[9px] sm:text-sm">{data.name}</td>
      <td className="py-2 sm:py-3 font-bold text-gray-800 text-[9px] sm:text-sm">{data.stock}</td>
      <td className="py-2 sm:py-3 text-[9px] sm:text-sm">₱{data.price.toLocaleString()}</td>
      <td className="py-2 sm:py-3">
        <span
          className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[8px] sm:text-[10px] font-semibold uppercase ${statusColor}`}
        >
          {statusLabel}
        </span>
      </td>
    </tr>
  );
}

// Generic Bar Chart component that dynamically calculates heights
function ChartBarGroup({
  label,
  actual,
  forecast,
  maxVal,
  delay,
  isWide = false,
}: ChartBarGroupProps) {
  // Calculate heights as a percentage of the Maximum Value
  const actualHeight = `${Math.min((actual / maxVal) * 100, 100)}%`;
  const forecastHeight = `${Math.min((forecast / maxVal) * 100, 100)}%`;

  const barWidthClass = isWide ? "w-3 sm:w-10" : "w-2 sm:w-6";

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2 flex-1 group relative cursor-pointer h-full justify-end">
      {/* Interactive Tooltip Overlay */}
      <div className="absolute bottom-full mb-2 sm:mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-36 sm:w-40 -ml-18 sm:-ml-20 left-1/2">
        <div className="bg-gray-800 text-white text-[9px] sm:text-xs rounded-lg py-2 sm:py-3 px-2 sm:px-3 shadow-xl">
          <div className="font-bold mb-1 sm:mb-2 pb-1 border-b border-gray-600 text-center text-[10px] sm:text-xs">
            {label} Data
          </div>
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-gray-300 mb-1 gap-1 sm:gap-2">
            <span>Actual:</span>
            <span className="font-mono text-white font-bold">
              ₱{actual.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-blue-300 gap-1 sm:gap-2">
            <span>AI Forecast:</span>
            <span className="font-mono font-bold">
              ₱{forecast.toLocaleString()}
            </span>
          </div>
          {/* Tooltip Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-800"></div>
        </div>
      </div>

      <div className="flex items-end gap-0.5 sm:gap-1 w-full justify-center h-full">
        {/* Actual Bar */}
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: actualHeight }}
          transition={{ duration: 0.5, delay: delay, ease: "easeOut" }}
          className={`${barWidthClass} bg-[#0B3C8A] rounded-t-sm origin-bottom opacity-90 group-hover:opacity-100 shadow-sm transition-opacity`}
        ></motion.div>

        {/* Forecast Bar */}
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: forecastHeight }}
          transition={{ duration: 0.5, delay: delay + 0.1, ease: "easeOut" }}
          className={`${barWidthClass} bg-blue-300 rounded-t-sm origin-bottom opacity-90 group-hover:opacity-100 shadow-sm transition-opacity`}
        ></motion.div>
      </div>
      <span className="text-[10px] sm:text-xs font-medium text-gray-400 group-hover:text-gray-700 transition-colors">
        {label}
      </span>
    </div>
  );
}