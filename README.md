# M.T. Olaso Optical Clinic - Inventory & Forecasting System

A comprehensive **Inventory Management and Demand Forecasting System** designed specifically for **M.T. Olaso Optical Clinic**. This web application streamlines clinic operations by tracking frames, lenses, and supplies while using intelligent forecasting to predict future stock demand.

## 🚀 Features

### 🔹 **Landing Page**
- Modern, responsive design showcasing system modules.
- **Interactive Feature Tabs:** Overview of Inventory, Transaction History, and Forecasting.
- **Workflow Guide:** Step-by-step visual guide on using the system.

### 🔹 **Authentication & Security**
- **Secure Login:** Staff authentication interface with animated entry.
- **Password Recovery:** Mock "Forgot Password" flow with email verification UI.
- **Global Notifications:** Real-time toast popups for login success and errors.

### 🔹 **Main Dashboard**
- **Clinic Analytics:** Real-time cards for Revenue, Net Profit, and Operational Costs.
- **Smart Forecast (AI):** Visual charts comparing historical sales vs. predicted demand.
- **Stock Alerts:** Immediate warnings for critical and low-stock items.
- **Dynamic Charts:** Interactive line graphs showing patient visit trends.

### 🔹 **Inventory Management**
- **Product CRUD:** Add, Edit, and Delete inventory items with modal forms.
- **Smart Filtering:** Filter products by Category (Frames, Lenses, etc.) or Stock Status.
- **Visual Status:** Color-coded indicators for "In Stock", "Low Stock", and "Critical".
- **Stock Level Bars:** Visual progress bars showing capacity for each category.

### 🔹 **Sales & Revenue**
- **Transaction Recording:** Log new sales with customer details and payment methods (Cash/GCash).
- **Revenue Forecasting:** Switchable views (3-Month vs. Yearly) to analyze financial trends.
- **PDF Export:** Generate downloadable sales reports automatically using `jspdf`.
- **History Log:** Searchable and filterable list of all past transactions.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/) (Page transitions, micro-interactions)
- **Icons:** [Lucide React](https://lucide.dev/)
- **PDF Generation:** `jspdf` & `jspdf-autotable`
- **Language:** TypeScript

---

## 📦 Getting Started

Follow these steps to set up the project locally.

### 1. Clone the repository
git clone [https://github.com/panganibanlarissa/mt-olaso-inventory.git](https://github.com/panganibanlarissa/mt-olaso-inventory.git)
cd mt-olaso-inventory

### 2. Install Dependencies
```
npm install
 or
yarn install
```

### 3. Run the Development Server
```
npm run dev
 or
yarn dev
```
Open http://localhost:3000 with your browser to see the result.

---

## 📂 Project Structure
```
src/
├── app/
│   ├── (app)/              # Protected application routes
│   │   ├── dashboard/      # Main analytics dashboard
│   │   ├── inventory/      # Inventory management page
│   │   └── sales/          # Sales recording and forecasting
│   ├── (auth)/             # Authentication routes
│   │   └── login/          # Login page
│   ├── page.tsx            # Landing page
│   └── layout.tsx          # Root layout (includes NotificationProvider)
├── components/
│   └── NotificationProvider.tsx  # Global Toast Notification Context
└── public/
    └── logo.png            # Clinic Logo assets
```
---

### 👤 Authors & Contact
```
Developers:
📧 202311183@gordoncollege.edu.ph
📧 202310500@gordoncollege.edu.ph

Organization:
M.T. Olaso Optical Clinic

© 2026 All Rights Reserved.
