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
  Glasses,
  ScanEye,
  ArrowRight,
  Calendar,
  AlertCircle,
  Banknote,
  Droplets
} from "lucide-react";

// --- ANIMATION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 15 }
  }
};

const fadeIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }
};

// --- 1. OPTICAL CLINIC DATA ---

const CURRENT_PERIOD = "January 2026"; 

const STATS_DATA = [
  { id: "products", label: "Total Frames & Items", value: 856, trend: "+24", trendType: "positive" },
  { id: "low_stock", label: "Critical Stock", value: 8, trend: "+2", trendType: "negative" },
  { id: "revenue", label: "Gross Revenue", value: 142580, trend: "+18%", trendType: "positive" },
  { id: "forecast", label: "Patient Forecast", value: 22, trend: "Next month", trendType: "neutral" },
];

const FORECAST_DATA = [
  { name: "Ray-Ban Aviator (Gold)", currentStock: 12, predictedDemand: 25, trend: "up", priority: "high" },
  { name: "Acuvue Oasys (6-Pack)", currentStock: 45, predictedDemand: 80, trend: "up", priority: "high" },
  { name: "Kids Flex Frames (Blue)", currentStock: 18, predictedDemand: 10, trend: "down", priority: "medium" },
];

const ALERT_DATA = [
  { name: "Contact Lens Solution (360ml)", remaining: 4, severity: "critical" },
  { name: "Anti-Rad Lens (Planar)", remaining: 10, severity: "low" },
  { name: "Microfiber Cloths", remaining: 5, severity: "critical" },
];

const INVENTORY_DATA = [
  { id: "FRM-001", name: "Ray-Ban Wayfarer (Black)", category: "Frames", stock: 15, price: 8500, status: "in_stock" },
  { id: "LNS-022", name: "Photochromic Lens (1.56)", category: "Lenses", stock: 8, price: 3500, status: "low_stock" },
  { id: "CNT-104", name: "Air Optix Colors (Gray)", category: "Contacts", stock: 32, price: 1800, status: "in_stock" },
  { id: "ACC-005", name: "Lens Cleaning Kit", category: "Accessory", stock: 4, price: 250, status: "critical" },
  { id: "FRM-009", name: "Oakley Sport (Matte)", category: "Frames", stock: 11, price: 9200, status: "in_stock" },
  { id: "SOL-003", name: "Multi-Purpose Solution", category: "Solution", stock: 5, price: 450, status: "low_stock" },
  { id: "FRM-102", name: "Gucci Cat Eye (Tortoise)", category: "Frames", stock: 6, price: 15000, status: "in_stock" },
  { id: "LNS-055", name: "Blue Filter Lens (1.61)", category: "Lenses", stock: 24, price: 4200, status: "in_stock" },
];

// Data for the Line Chart (SVG coordinates + Values)
const TREND_POINTS = [
    { x: 0, y: 70, value: "15%", label: "W1 Start" },
    { x: 75, y: 55, value: "32%", label: "W1 End" },
    { x: 150, y: 65, value: "28%", label: "W2 End" },
    { x: 225, y: 35, value: "58%", label: "W3 End" },
    { x: 300, y: 40, value: "55%", label: "W4 End" },
];


// --- 2. PAGE COMPONENT ---

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("forecast");
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  // Helper to generate polyline points string
  const polylinePoints = TREND_POINTS.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen mt-4 p-2 space-y-4"
    >
      
      {/* TOP STATS */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS_DATA.map((stat) => (
          <StatCard key={stat.id} data={stat} />
        ))}
      </motion.div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left: Sales Analytics */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-2 bg-[#0B3C8A] rounded-lg">
                        <Activity className="text-white" size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">Clinic Analytics</h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-1">
                    <Calendar size={12} />
                    <span>Period: {CURRENT_PERIOD}</span>
                </div>
            </div>
            
            <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
              <button 
                onClick={() => setActiveTab("forecast")}
                className={`px-4 py-1.5 rounded-md transition-all ${activeTab === "forecast" ? "bg-white text-[#0B3C8A] shadow-sm font-semibold" : "text-gray-500 hover:text-gray-700"}`}
              >
                Inventory Forecast
              </button>
              <button 
                onClick={() => setActiveTab("trends")}
                className={`px-4 py-1.5 rounded-md transition-all ${activeTab === "trends" ? "bg-white text-[#0B3C8A] shadow-sm font-semibold" : "text-gray-500 hover:text-gray-700"}`}
              >
                Patient Trends
              </button>
            </div>
          </div>

          <div className="relative min-h-[350px]">
            <AnimatePresence mode="wait">
              {activeTab === "forecast" ? (
                <motion.div 
                  key="forecast"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex gap-4">
                      {/* Y-Axis Labels */}
                      <div className="flex flex-col justify-between h-64 pb-6 text-xs text-gray-400 font-medium text-right w-8 border-r border-gray-100 pr-2 pt-4">
                          <span>200</span>
                          <span>150</span>
                          <span>100</span>
                          <span>50</span>
                          <span>0</span>
                      </div>

                      {/* Chart Area with Bar Groups */}
                      <div className="flex-1 h-64 flex items-end justify-between gap-2 sm:gap-4 px-2 border-b border-dashed border-gray-200 pb-2">
                        <ChartGroup label="Week 1" h1="h-16" h2="h-20" val1={52} val2={65} delay={0} />
                        <ChartGroup label="Week 2" h1="h-8" h2="h-12" val1={28} val2={42} delay={0.1} />
                        <ChartGroup label="Week 3" h1="h-32" h2="h-40" val1={98} val2={125} delay={0.2} />
                        <ChartGroup label="Week 4" h1="h-24" h2="h-20" val1={75} val2={60} delay={0.3} />
                      </div>
                  </div>

                  {/* Legend */}
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="flex justify-center items-center gap-6 mt-6 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#0B3C8A]"></span>
                      <span className="text-gray-600">Dispensed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-300"></span>
                      <span className="text-gray-600">Projected Demand</span>
                    </div>
                  </motion.div>
                  <motion.p 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                    className="text-center text-sm text-gray-400 mt-10"
                  >
                    <b>AI predicts high demand for Frames & Lenses next month.</b> <br />
                    (Hover over bars for exact quantities)
                  </motion.p>
                </motion.div>
              ) : (
                <motion.div 
                  key="trends"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                  className="h-full flex flex-col gap-10"
                >
                  <div className="flex gap-4 h-64 relative">
                        {/* Y-Axis Labels */}
                        <div className="flex flex-col justify-between h-full pb-6 text-xs text-gray-400 font-medium text-right w-8 border-r border-gray-100 pr-2 pt-2">
                          <span>100%</span>
                          <span>75%</span>
                          <span>50%</span>
                          <span>25%</span>
                          <span>0%</span>
                        </div>

                        {/* Graph Area */}
                        <div className="w-full h-full relative pt-4 flex-1">
                          {/* Tooltip for Line Chart */}
                          {hoveredPoint && (
                              <motion.div 
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="absolute z-10 bg-gray-800 text-white text-xs rounded py-1 px-2 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 shadow-lg"
                                  style={{ 
                                      left: `${(hoveredPoint.x / 300) * 100}%`, 
                                      top: `${hoveredPoint.y}%`
                                  }}
                              >
                                  <div className="font-bold">{hoveredPoint.value}</div>
                                  <div className="text-[10px] text-gray-300 opacity-80">Growth Rate</div>
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                              </motion.div>
                          )}

                          <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
                              {/* Grid Lines */}
                              <line x1="0" y1="25" x2="300" y2="25" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
                              <line x1="0" y1="50" x2="300" y2="50" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
                              <line x1="0" y1="75" x2="300" y2="75" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
                              
                              {/* Trend Line (Blue) - Animated Draw */}
                              <motion.polyline 
                                  fill="none" 
                                  stroke="#0B3C8A" 
                                  strokeWidth="3" 
                                  points={polylinePoints} 
                                  className="drop-shadow-sm"
                                  initial={{ pathLength: 0 }}
                                  animate={{ pathLength: 1 }}
                                  transition={{ duration: 1.5, ease: "easeInOut" }}
                              />
                              
                              {/* Interactive Data Points */}
                              {TREND_POINTS.map((point, i) => (
                                  <g key={i}>
                                      <motion.circle 
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          transition={{ delay: 1 + (i * 0.1) }}
                                          cx={point.x} 
                                          cy={point.y} 
                                          r="8" 
                                          fill="transparent" 
                                          className="cursor-pointer"
                                          onMouseEnter={() => setHoveredPoint(point)}
                                          onMouseLeave={() => setHoveredPoint(null)}
                                      />
                                      <motion.circle 
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          transition={{ delay: 1 + (i * 0.1) }}
                                          cx={point.x} 
                                          cy={point.y} 
                                          r={hoveredPoint === point ? 5 : 3} 
                                          fill="#0B3C8A" 
                                          stroke="white"
                                          strokeWidth="2"
                                          className="pointer-events-none transition-all duration-200"
                                      />
                                  </g>
                              ))}
                          </svg>
                          
                          {/* X-Axis Labels */}
                          <div className="flex justify-between text-xs text-gray-400 mt-2 px-6">
                              <span>Week 1</span>
                              <span>Week 2</span>
                              <span>Week 3</span>
                              <span>Week 4</span>
                          </div>
                        </div>
                  </div>

                  {/* Legend for Trends */}
                  <div className="flex justify-center items-center gap-6 mt-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 bg-[#0B3C8A] rounded-full"></div>
                      <span className="text-gray-600">Patient Visits</span>
                    </div>
                  </div>

                  <p className="text-center text-sm text-gray-400 mt-2">
                    Monthly trend shows a steady <span className="text-[#0B3C8A] font-bold">upward trajectory</span> in check-ups.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Right: AI Forecast List */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 h-fit"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="text-[#0B3C8A]" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Smart Forecast</h2>
              <p className="text-xs text-gray-500 font-medium text-blue-600">{CURRENT_PERIOD}</p>
            </div>
          </div>
          <div className="space-y-4 mt-6">
            {FORECAST_DATA.map((item, i) => (
                <ForecastItem key={i} data={item} />
            ))}
          </div>
        </motion.div>
      </div>

      {/* BOTTOM SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Inventory Table */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-7 h-fit"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
                <div className="p-2 bg-[#0B3C8A] rounded-lg">
                <Package className="text-white" size={20} />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Inventory Status</h2>
            </div>
            <Link 
                href="/inventory" 
                className="text-xs font-semibold text-[#0B3C8A] hover:text-[#08306B] flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full transition-colors"
            >
                View All <ArrowRight size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm text-gray-600">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="pb-3 font-semibold">SKU ID</th>
                  <th className="pb-3 font-semibold">Item Name</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold text-[#0B3C8A]">Stock</th>
                  <th className="pb-3 font-semibold">Price</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <motion.tbody 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={containerVariants}
                className="divide-y divide-gray-50"
              >
                {INVENTORY_DATA.slice(0, 8).map((item) => (
                    <TableRow key={item.id} data={item} />
                ))}
              </motion.tbody>
            </table>
          </div>
        </motion.div>

        {/* Low Stock Alerts */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 h-fit"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-orange-500 rounded-lg">
              <AlertTriangle className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Stock Alerts</h2>
              <p className="text-xs text-gray-500">Replenishment needed</p>
            </div>
          </div>
          <div className="space-y-4 mt-6">
             {ALERT_DATA.map((alert, i) => (
                <AlertItem key={i} data={alert} />
             ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}


// --- 3. UI COMPONENTS ---

function StatCard({ data }: { data: any }) {
  let Icon = Box;
  let themeColor = "blue"; 
  let displayValue = data.value;

  if (data.id === "low_stock") {
    Icon = AlertTriangle;
    themeColor = "orange";
  } else if (data.id === "revenue") {
    Icon = Banknote;
    themeColor = "blue";
    displayValue = `₱${data.value.toLocaleString()}`;
  } else if (data.id === "forecast") {
    Icon = TrendingUp;
    themeColor = "purple";
    displayValue = `+${data.value}%`;
  }

  const styles: any = {
    blue: { icon: "text-[#0B3C8A]", bg: "bg-blue-50", badge: "bg-blue-100 text-[#0B3C8A]" },
    orange: { icon: "text-orange-600", bg: "bg-orange-50", badge: "bg-orange-100 text-orange-700" },
    purple: { icon: "text-purple-600", bg: "bg-purple-50", badge: "bg-purple-100 text-purple-700" },
  };

  const currentStyle = styles[themeColor];

  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
      className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative transition-all"
    >
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-lg ${currentStyle.bg} mb-4`}>
          <Icon size={24} className={currentStyle.icon} />
        </div>
        <span className={`px-2 py-1 rounded text-xs font-bold ${currentStyle.badge}`}>
          {data.trend}
        </span>
      </div>
      <h3 className="text-2xl font-bold text-gray-800">{displayValue}</h3>
      <p className="text-sm text-gray-500 mt-1">{data.label}</p>
    </motion.div>
  );
}

function ForecastItem({ data }: { data: any }) {
  const actionText = data.trend === 'up' 
    ? `Order ${data.predictedDemand - data.currentStock} Units` 
    : "Hold Orders";

  return (
    <motion.div 
      initial={{ x: -20, opacity: 0 }}
      whileInView={{ x: 0, opacity: 1 }}
      viewport={{ once: true }}
      className="bg-gray-50 p-4 rounded-lg border border-gray-100"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800 text-sm truncate pr-2">{data.name}</h3>
        {data.trend === 'up' 
          ? <ArrowUpRight size={16} className="text-[#0B3C8A]" /> 
          : <ArrowDownRight size={16} className="text-orange-500" />
        }
      </div>
      
      <div className="flex justify-between text-sm mb-3">
        <div>
          <p className="text-gray-500 text-xs">Current</p>
          <p className="font-medium">{data.currentStock}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-xs">Projected</p>
          <p className={`font-bold ${data.trend === 'up' ? 'text-[#0B3C8A]' : 'text-orange-500'}`}>
            {data.predictedDemand}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1 text-xs text-gray-600 font-medium">
          <Package size={14} />
          {actionText}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase 
          ${data.priority === 'high' ? 'bg-blue-100 text-[#0B3C8A]' : 'bg-gray-200 text-gray-600'}`}>
          {data.priority}
        </span>
      </div>
    </motion.div>
  );
}

function TableRow({ data }: { data: any }) {
  const isGlasses = data.category.includes("Frames");
  const isLens = data.category.includes("Lenses") || data.category.includes("Contacts");
  const isSolution = data.category.includes("Solution");
  
  let statusLabel = "In Stock";
  let statusColor = "bg-blue-100 text-[#0B3C8A]";
  let stockColor = "text-[#0B3C8A]";

  if (data.status === "low_stock") {
    statusLabel = "Low Stock";
    statusColor = "bg-orange-100 text-orange-700";
    stockColor = "text-orange-500";
  } else if (data.status === "critical") {
    statusLabel = "Critical";
    statusColor = "bg-red-100 text-red-700";
    stockColor = "text-red-500";
  }

  return (
    <motion.tr variants={itemVariants} className="hover:bg-gray-50/50 transition-colors">
      <td className="py-3 font-medium text-gray-800 text-xs sm:text-sm">{data.id}</td>
      <td className="py-3">
        <div className="flex items-center gap-2">
           {isGlasses && <Glasses size={16} className="text-gray-400"/>}
           {isLens && <ScanEye size={16} className="text-gray-400"/>}
           {isSolution && <Droplets size={16} className="text-gray-400"/>}
           {!isGlasses && !isLens && !isSolution && <Package size={16} className="text-gray-400"/>}
           
           <span className="truncate max-w-[150px] sm:max-w-none">{data.name}</span>
        </div>
      </td>
      <td className="py-3 text-gray-500">{data.category}</td>
      <td className={`py-3 font-bold ${stockColor}`}>{data.stock}</td>
      <td className="py-3">₱{data.price.toLocaleString()}</td>
      <td className="py-3">
        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </td>
    </motion.tr>
  );
}

function AlertItem({ data }: { data: any }) {
  const isCritical = data.severity === "critical";

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      className={`p-4 rounded-lg border ${isCritical ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}
    >
      <div className="flex justify-between items-start mb-1">
        <h4 className="font-semibold text-gray-800 text-sm">{data.name}</h4>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${isCritical ? 'bg-red-500' : 'bg-orange-500'}`}>
          {isCritical ? "Critical" : "Low"}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-3">Only <span className="font-bold">{data.remaining}</span> units remaining</p>
      
      <div className={`w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-bold border
          ${isCritical ? 'bg-white text-red-600 border-red-200' : 'bg-white text-orange-600 border-orange-200'}`}>
          <AlertCircle size={14} />
          RESTOCK NEEDED
      </div>
    </motion.div>
  );
}

// Updated ChartGroup with animation support
function ChartGroup({ label, h1, h2, val1, val2, delay }: any) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1 group relative cursor-pointer">
      
      {/* Tooltip Overlay */}
      <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-32 -ml-16 left-1/2">
        <div className="bg-gray-800 text-white text-xs rounded-lg py-2 px-3 shadow-lg text-center">
            <div className="font-bold mb-1">{label}</div>
            <div className="flex justify-between text-[10px] text-gray-300">
                <span>Sold:</span>
                <span className="font-mono text-white">{val1}</span>
            </div>
            <div className="flex justify-between text-[10px] text-blue-300">
                <span>Forecast:</span>
                <span className="font-mono">{val2}</span>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      </div>

      <div className="flex items-end gap-1 w-full justify-center h-full">
        {/* Animated Bar 1 */}
        <motion.div 
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: delay, ease: "easeOut" }}
            className={`w-3 sm:w-6 bg-[#0B3C8A] rounded-t-sm ${h1} origin-bottom opacity-90 group-hover:opacity-100`}
        ></motion.div>
        
        {/* Animated Bar 2 */}
        <motion.div 
             initial={{ scaleY: 0 }}
             animate={{ scaleY: 1 }}
             transition={{ duration: 0.5, delay: delay + 0.1, ease: "easeOut" }}
            className={`w-3 sm:w-6 bg-blue-300 rounded-t-sm ${h2} origin-bottom opacity-90 group-hover:opacity-100`}
        ></motion.div>
      </div>
      <span className="text-xs text-gray-400 group-hover:text-gray-600">{label}</span>
    </div>
  );
}