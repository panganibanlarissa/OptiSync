"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image"; 
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight, 
  Menu, 
  X, 
  CheckCircle2,
  AlertTriangle,
  Plus,
  FileText,
  PieChart,
  Sparkles
} from "lucide-react";

// --- THEME COLORS ---
const THEME_BG = "bg-[#0B3C8A]";
const THEME_TEXT = "text-[#0B3C8A]";

// --- STATIC FORECAST DATA ---
const FORECAST_DATA = [
  { month: "Jan", value: 35, type: "history" },
  { month: "Feb", value: 42, type: "history" },
  { month: "Mar", value: 38, type: "history" },
  { month: "Apr", value: 55, type: "history" },
  { month: "May", value: 62, type: "history" },
  { month: "Jun", value: 78, type: "forecast" }, // Predicted Spike
  { month: "Jul", value: 85, type: "forecast" }, // Peak Prediction
];

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "inventory" | "sales">("dashboard");

  // Handle Scroll Effect for Navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 selection:bg-blue-100">
      
      {/* --- 1. NAVBAR --- */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-white/90 backdrop-blur-md shadow-sm py-3" : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="MT Olaso Logo" width={42} height={42} />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-lg text-slate-900">M.T Olaso Optical Clinic</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-[#0B3C8A] transition-colors">Features</a>
            <a href="#workflow" className="hover:text-[#0B3C8A] transition-colors">Workflow</a>
            <a href="#system" className="hover:text-[#0B3C8A] transition-colors">About</a>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link 
              href="/login" 
              className={`px-5 py-2.5 ${THEME_BG} text-white rounded-full font-bold text-sm hover:bg-[#08306B] transition-all shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95`}
            >
              Log in
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-100 p-4 shadow-xl flex flex-col gap-4 animate-in slide-in-from-top-5">
            <a href="#features" className="text-slate-600 font-medium" onClick={() => setMobileMenuOpen(false)}>System Modules</a>
            <a href="#workflow" className="text-slate-600 font-medium" onClick={() => setMobileMenuOpen(false)}>Workflow</a>
            <Link href="/login" className={`w-full text-center py-3 ${THEME_BG} text-white rounded-lg font-bold`}>
              Login
            </Link>
          </div>
        )}
      </header>

      {/* --- 2. HERO SECTION --- */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-purple-100 rounded-full blur-3xl opacity-50"></div>

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Text Content */}
          <div className="z-10 animate-in slide-in-from-bottom-10 fade-in duration-700">
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-6 tracking-tight">
              Inventory & <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0B3C8A] to-purple-600">
                Demand Forecasting.
              </span>
            </h1>
            <p className="text-lg text-slate-500 mb-8 leading-relaxed max-w-lg">
              Manage the M.T Olaso Optical Clinic with precision. Track stock levels, analyze revenue, and forecast demand in one secure dashboard.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/login" 
                className={`px-8 py-4 ${THEME_BG} text-white rounded-xl font-bold text-lg hover:bg-[#08306B] transition-all shadow-xl shadow-blue-900/20 hover:-translate-y-1 flex items-center justify-center gap-2`}
              >
                Get Started <ArrowRight size={20} />
              </Link>
              <button className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                <ShieldCheck size={20} /> Login
              </button>
            </div>

            <div className="mt-10 flex items-center gap-4 text-sm text-slate-400 font-medium">
              <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-emerald-500" /> Stock Alerts</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-emerald-500" /> Sales Analytics</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-emerald-500" /> PDF Reports</span>
            </div>
          </div>

          {/* Abstract Dashboard Mockup */}
          <div className="relative z-10 lg:h-[500px] flex items-center justify-center animate-in zoom-in-95 fade-in duration-1000 delay-200">
            <div className="relative w-full max-w-lg aspect-square">
                {/* Main Card */}
                <div className="absolute inset-0 bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 flex flex-col overflow-hidden rotate-[-2deg] hover:rotate-0 transition-all duration-500">
                   {/* Mock Header */}
                   <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                      <div className="flex gap-2">
                         <div className="w-3 h-3 rounded-full bg-red-400"></div>
                         <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                         <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                      </div>
                      <div className="w-24 h-2 bg-slate-100 rounded-full"></div>
                   </div>
                   {/* Mock Chart Area */}
                   <div className="flex gap-4 items-end h-32 mb-6 px-4">
                      <div className="w-1/5 h-[40%] bg-blue-100 rounded-t-lg"></div>
                      <div className="w-1/5 h-[70%] bg-blue-200 rounded-t-lg"></div>
                      <div className="w-1/5 h-[50%] bg-blue-100 rounded-t-lg"></div>
                      <div className="w-1/5 h-[90%] bg-[#0B3C8A] rounded-t-lg relative">
                         <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">Forecast</div>
                      </div>
                      <div className="w-1/5 h-[60%] bg-blue-100 rounded-t-lg"></div>
                   </div>
                   {/* Mock List */}
                   <div className="space-y-3">
                      <div className="h-10 w-full bg-slate-50 rounded-lg flex items-center px-3 gap-3">
                         <div className="w-6 h-6 rounded-full bg-purple-100"></div>
                         <div className="w-1/2 h-2 bg-slate-200 rounded-full"></div>
                      </div>
                      <div className="h-10 w-full bg-slate-50 rounded-lg flex items-center px-3 gap-3">
                         <div className="w-6 h-6 rounded-full bg-emerald-100"></div>
                         <div className="w-1/3 h-2 bg-slate-200 rounded-full"></div>
                      </div>
                   </div>
                </div>

                {/* Floating Card 1 - Analytics */}
                <div className="absolute -right-4 top-20 bg-white p-4 rounded-xl shadow-xl border border-slate-100 animate-bounce duration-[3000ms]">
                   <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg text-purple-600"><TrendingUp size={20} /></div>
                      <div>
                         <p className="text-xs text-slate-400 font-bold uppercase">Analytics</p>
                         <p className="font-bold text-slate-800">Growth +15%</p>
                      </div>
                   </div>
                </div>

                {/* Floating Card 2 - Stock Alert */}
                <div className="absolute -left-4 bottom-32 bg-white p-4 rounded-xl shadow-xl border border-slate-100 animate-bounce duration-[4000ms]">
                   <div className="flex items-center gap-3">
                      <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><AlertTriangle size={20} /></div>
                      <div>
                         <p className="text-xs text-slate-400 font-bold uppercase">Inventory</p>
                         <p className="font-bold text-slate-800">Low Stock Alert</p>
                      </div>
                   </div>
                </div>
            </div>
          </div>

        </div>
      </section>

      {/* --- 3. SYSTEM MODULES TABS (UPDATED) --- */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Complete System Overview</h2>
            <p className="text-slate-500 text-lg">
              Navigate seamlessly between the Dashboard, Inventory, and Sales modules.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-12">
            
            {/* TABS CONTROLLER */}
            <div className="lg:w-1/3 flex flex-col gap-4">
              
              {/* TAB 1: DASHBOARD */}
              <button 
                onClick={() => setActiveTab("dashboard")}
                className={`text-left p-6 rounded-2xl transition-all duration-300 border ${activeTab === 'dashboard' ? 'bg-white border-blue-200 shadow-lg scale-105' : 'bg-transparent border-transparent hover:bg-slate-100'}`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                  <LayoutDashboard size={24} />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${activeTab === 'dashboard' ? 'text-slate-900' : 'text-slate-500'}`}>Main Dashboard</h3>
                <p className="text-slate-500 text-sm leading-relaxed ml-1">
                  View clinic analytics, AI-powered demand forecasts, current inventory status, and real-time stock alerts in one central hub.
                </p>
              </button>

              {/* TAB 2: INVENTORY */}
              <button 
                onClick={() => setActiveTab("inventory")}
                className={`text-left p-6 rounded-2xl transition-all duration-300 border ${activeTab === 'inventory' ? 'bg-white border-blue-200 shadow-lg scale-105' : 'bg-transparent border-transparent hover:bg-slate-100'}`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${activeTab === 'inventory' ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-500'}`}>
                  <Package size={24} />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${activeTab === 'inventory' ? 'text-slate-900' : 'text-slate-500'}`}>Inventory</h3>
                <p className="text-slate-500 text-sm leading-relaxed ml-1">
                  Effortlessly add and manage products, monitor live stock levels, and receive automated restock notifications to prevent shortages.
                </p>
              </button>

              {/* TAB 3: SALES */}
              <button 
                onClick={() => setActiveTab("sales")}
                className={`text-left p-6 rounded-2xl transition-all duration-300 border ${activeTab === 'sales' ? 'bg-white border-blue-200 shadow-lg scale-105' : 'bg-transparent border-transparent hover:bg-slate-100'}`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${activeTab === 'sales' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                  <TrendingUp size={24} />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${activeTab === 'sales' ? 'text-slate-900' : 'text-slate-500'}`}>Sales & Revenue</h3>
                <p className="text-slate-500 text-sm leading-relaxed ml-1">
                  Record new transactions, track sales history, visualize revenue forecasts by category, and export detailed PDF reports for accounting.
                </p>
              </button>
            </div>

            {/* VISUAL MOCKUPS AREA */}
            <div className="lg:w-2/3 bg-white rounded-3xl border border-slate-200 shadow-xl p-8 flex items-center justify-center relative overflow-hidden min-h-[400px]">
               {/* Background Grid */}
               <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50"></div>
               
               <div className="relative z-10 w-full max-w-2xl">
                 
                 {/* --- MOCKUP 1: DASHBOARD --- */}
                 {activeTab === 'dashboard' && (
                   <div className="animate-in fade-in zoom-in-95 duration-500 space-y-4">
                      {/* Analytics Row */}
                      <div className="grid grid-cols-3 gap-3">
                         <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-center">
                            <div className="text-xs text-slate-400">Total Products</div>
                            <div className="font-bold text-slate-800">1,240</div>
                         </div>
                         <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-center">
                            <div className="text-xs text-slate-400">Low Stock</div>
                            <div className="font-bold text-orange-500 flex items-center justify-center gap-1"><AlertTriangle size={12}/> 5</div>
                         </div>
                         <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-center">
                            <div className="text-xs text-slate-400">Forecast</div>
                            <div className="font-bold text-purple-600">+15%</div>
                         </div>
                      </div>
                      
                      {/* UPDATED Forecast Graph Mockup with Static Data */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                         <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 bg-purple-100 rounded-md text-purple-600"><Sparkles size={14} /></span>
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">AI Demand Forecast</span>
                            </div>
                            <div className="flex gap-4 text-[10px] font-medium">
                               <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span> History
                               </div>
                               <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 bg-purple-500 rounded-full"></span> Predicted
                               </div>
                            </div>
                         </div>

                         {/* Chart Container */}
                         <div className="relative h-40 flex items-end justify-between px-2 pt-6 border-b border-slate-100">
                            {/* Horizontal Grid Lines (Decorative) */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                                <div className="border-t border-slate-100 border-dashed w-full h-full"></div>
                                <div className="border-t border-slate-100 border-dashed w-full h-full"></div>
                                <div className="border-t border-slate-100 border-dashed w-full h-full"></div>
                            </div>

                            {/* Data Bars */}
                            {FORECAST_DATA.map((item, i) => (
                               <div key={i} className="group relative w-1/12 flex flex-col justify-end items-center h-full z-10">
                                  {/* Tooltip on Hover */}
                                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap z-20 pointer-events-none">
                                     {item.value} Units
                                     {item.type === 'forecast' && <span className="block text-purple-300">Predicted</span>}
                                  </div>

                                  {/* The Bar */}
                                  <div 
                                    className={`w-full rounded-t-md transition-all duration-500 hover:scale-y-105 origin-bottom ${
                                        item.type === 'history' 
                                            ? 'bg-blue-500/90 hover:bg-blue-600' 
                                            : 'bg-gradient-to-t from-purple-500 to-purple-400'
                                    }`} 
                                    style={{ height: `${item.value}%` }}
                                  >
                                      {/* Highlight Effect for Forecast */}
                                      {item.type === 'forecast' && (
                                          <div className="absolute inset-0 bg-white/20 animate-pulse rounded-t-md"></div>
                                      )}
                                  </div>
                                  
                                  {/* X-Axis Label */}
                                  <div className="absolute -bottom-6 text-[10px] font-semibold text-slate-400">{item.month}</div>
                               </div>
                            ))}
                         </div>
                         <div className="mt-4 text-center">
                            <p className="text-xs text-slate-500">
                                Predicted demand spike in <span className="font-bold text-purple-600">June & July</span>. Suggesting early restocking.
                            </p>
                         </div>
                      </div>

                      {/* Alert Banner */}
                      <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-center gap-3">
                         <AlertTriangle size={20} className="text-orange-500" />
                         <div>
                            <div className="text-sm font-bold text-orange-800">Stock Alert</div>
                            <div className="text-xs text-orange-600">Contact Lens Solution is running low (5 left).</div>
                         </div>
                      </div>
                   </div>
                 )}

                 {/* --- MOCKUP 2: INVENTORY --- */}
                 {activeTab === 'inventory' && (
                   <div className="animate-in fade-in zoom-in-95 duration-500">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                         {/* Header with Add Product */}
                         <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                            <div className="text-sm font-bold text-slate-700">Product List</div>
                            <div className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 cursor-pointer">
                               <Plus size={16} />
                            </div>
                         </div>
                         
                         {/* List */}
                         <div className="divide-y divide-slate-100">
                            <div className="p-3 flex justify-between items-center">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-500"><Package size={16}/></div>
                                  <div>
                                     <div className="text-sm font-bold text-slate-800">Ray-Ban Aviator</div>
                                     <div className="text-xs text-slate-400">Frame</div>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <div className="text-sm font-bold">45</div>
                                  <div className="text-xs text-green-600">In Stock</div>
                               </div>
                            </div>

                            <div className="p-3 flex justify-between items-center bg-red-50/30">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center text-red-500"><AlertTriangle size={16}/></div>
                                  <div>
                                     <div className="text-sm font-bold text-slate-800">Solution 350ml</div>
                                     <div className="text-xs text-slate-400">Supplies</div>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <div className="text-sm font-bold text-red-600">3</div>
                                  <div className="text-xs text-red-500 font-bold">Restock Alert</div>
                               </div>
                            </div>

                            <div className="p-3 flex justify-between items-center">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-500"><Package size={16}/></div>
                                  <div>
                                     <div className="text-sm font-bold text-slate-800">Photochromic Lens</div>
                                     <div className="text-xs text-slate-400">Lens</div>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <div className="text-sm font-bold">120</div>
                                  <div className="text-xs text-green-600">In Stock</div>
                               </div>
                            </div>
                         </div>
                      </div>
                      <div className="mt-4 text-center">
                         <p className="text-lg font-bold text-slate-900">Live Inventory Management</p>
                         <p className="text-sm text-slate-500">Add products and monitor stock levels instantly.</p>
                      </div>
                   </div>
                 )}

                 {/* --- MOCKUP 3: SALES --- */}
                 {activeTab === 'sales' && (
                   <div className="animate-in fade-in zoom-in-95 duration-500 space-y-4">
                      
                      {/* Top Row: Revenue & Categories */}
                      <div className="flex gap-4">
                         <div className="flex-1 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-xs text-slate-400 font-bold uppercase mb-2">Revenue Forecast</div>
                            <div className="flex items-end gap-1 h-12">
                               <div className="w-1/4 h-full bg-emerald-100 rounded-t-sm"></div>
                               <div className="w-1/4 h-[80%] bg-emerald-100 rounded-t-sm"></div>
                               <div className="w-1/4 h-[40%] bg-emerald-100 rounded-t-sm"></div>
                               <div className="w-1/4 h-[90%] bg-emerald-500 rounded-t-sm"></div>
                            </div>
                         </div>
                         <div className="flex-1 bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                            <div className="text-xs text-slate-400 font-bold uppercase mb-1">Categories</div>
                            <PieChart size={32} className="text-blue-500" />
                            <div className="text-[10px] text-slate-500 mt-1">Frames • Lens • Service</div>
                         </div>
                      </div>

                      {/* Transaction History List */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                         <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                            <h4 className="font-bold text-slate-800 text-sm">Transaction History</h4>
                            <div className="flex gap-2">
                               <div className="bg-blue-600 text-white p-1 rounded text-xs px-2 flex items-center gap-1 cursor-pointer">
                                  <Plus size={12}/> Add Sale
                               </div>
                            </div>
                         </div>
                         <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded">
                               <div><span className="font-bold">TRX-101</span> • Ray-Ban Aviator</div>
                               <div className="font-bold">₱5,500</div>
                            </div>
                            <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded">
                               <div><span className="font-bold">TRX-102</span> • Eye Exam</div>
                               <div className="font-bold">₱800</div>
                            </div>
                         </div>
                         <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                            <button className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded flex items-center gap-1 border border-slate-200 hover:bg-slate-200">
                               <FileText size={12}/> Export PDF
                            </button>
                         </div>
                      </div>
                   </div>
                 )}

               </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- 4. STATS STRIP --- */}
      <section className="bg-[#0B3C8A] py-16 text-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-blue-800/50">
          <div>
            <h4 className="text-4xl font-extrabold mb-2">100+</h4>
            <p className="text-blue-200 text-sm uppercase tracking-wider font-medium">Transactions Logged</p>
          </div>
          <div>
            <h4 className="text-4xl font-extrabold mb-2">30</h4>
            <p className="text-blue-200 text-sm uppercase tracking-wider font-medium">Inventory Items</p>
          </div>
          <div>
            <h4 className="text-4xl font-extrabold mb-2">99%</h4>
            <p className="text-blue-200 text-sm uppercase tracking-wider font-medium">Data Accuracy</p>
          </div>
          <div>
            <h4 className="text-4xl font-extrabold mb-2">24/7</h4>
            <p className="text-blue-200 text-sm uppercase tracking-wider font-medium">System Uptime</p>
          </div>
        </div>
      </section>

      {/* --- 5. WORKFLOW SECTION --- */}
      <section id="workflow" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Streamlined Workflow</h2>
            <p className="text-slate-500 text-lg">Managing the clinic inventory has never been this simple.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="text-center p-6">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-900 font-bold text-2xl shadow-sm">1</div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">Log In</h4>
                <p className="text-slate-500 leading-relaxed">Securely access the inventory dashboard.</p>
             </div>
             <div className="text-center p-6 relative">
                <div className="hidden md:block absolute top-10 -left-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#0B3C8A] font-bold text-2xl shadow-sm relative z-10">2</div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">Manage Operations</h4>
                <p className="text-slate-500 leading-relaxed">Add products, manage inventory, and update sales.</p>
             </div>
             <div className="text-center p-6">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-900 font-bold text-2xl shadow-sm">3</div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">Export Reports</h4>
                <p className="text-slate-500 leading-relaxed">Generate PDF summaries for accounting and review.</p>
             </div>
          </div>
        </div>
      </section>

      {/* --- 6. FOOTER --- */}
      <footer id="system" className="bg-slate-50 border-t border-slate-200 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 mb-6">
                <Image src="/logo.png" alt="MT Olaso Logo" width={42} height={42} />
                <span className="font-bold text-lg text-slate-900">M.T Olaso Optical Clinic</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Empowering vision care with advanced technology. Streamlining inventory and demand forecasting for better efficiency.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-24 text-sm">
              <div>
                <h5 className="font-bold text-slate-900 mb-4">Contacts</h5>
                <ul className="space-y-3 text-slate-500">
                  <li>202311183@gordoncollege.edu.ph</li>
                  <li>202310500@gordoncollege.edu.ph</li>
                </ul>
              </div>
              <div>
                <h5 className="font-bold text-slate-900 mb-4">Developers</h5>
                <ul className="space-y-3 text-slate-500">
                  <li>Larissa Panganiban</li>
                  <li>Rejean Zapanta</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
            <p>© 2026 M.T Olaso Optical Clinic. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}