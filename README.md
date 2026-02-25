# M.T. Olaso Optical Clinic - AI Inventory & Forecasting System

A comprehensive **Inventory Management, Point of Sale (POS), and AI Demand Forecasting System** designed specifically for the **M.T. Olaso Optical Clinic**. This web application modernizes clinic operations by tracking eyewear and supplies, processing patient sales, and utilizing machine learning to accurately predict future restock needs.

## 🚀 Key Features

### 🔹 **Landing Page & Authentication**
- **Modern UI:** Responsive, animated landing page showcasing system capabilities.
- **Secure Access:** Role-based authentication (Admin vs. Staff).
- **RA 10173 Compliant:** Built-in Data Privacy Act of 2012 agreements, Terms & Conditions, and Privacy Policy modals.

### 🔹 **Main Dashboard**
- **Clinic Analytics:** Real-time KPI cards for Revenue, Gross Profit, and Sales Trends.
- **At-a-glance Alerts:** Immediate warnings for low-stock and deadstock items.
- **AI Visuals:** Interactive charts comparing historical data to predicted future demand.

### 🔹 **Inventory Management**
- **Live Catalog:** Add, Edit, and Delete frames, lenses, and clinic supplies.
- **Smart Triggers:** Color-coded status indicators ("In Stock", "Low Stock").
- **Deadstock Identification:** Automatically flags slow-moving items (unsold for 30+ days) to free up tied capital.


### 🔹 **Point of Sale (POS)**
- **Patient Checkout:** Fast, intuitive cart system for walk-in patients.
- **Dynamic Pricing:** Apply VAT/Tax, calculate subtotals, and process Cash/GCash.
- **Official Receipts:** Instant generation of beautifully formatted, printable PDF receipts.

### 🔹 **AI Analytics & Reports**
- **Smart Predictions:** Utilizes FBProphet / XGBoost logic to identify seasonal trends.
- **Smart Restock Engine:** Calculates exact order dates based on supplier lead times.
- **Transaction Ledger:** Monthly searchable sales records exportable as professional PDF reports for accounting.

### 🔹 **System Settings**
- **Clinic Profile:** Dynamic logo and address management for automated receipt branding.
- **User Management:** Create, edit, and revoke access for clinic staff and administrators.

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
```bash
git clone [https://github.com/panganibanlarissa/mt-olaso-inventory.git](https://github.com/panganibanlarissa/mt-olaso-inventory.git)
cd mt-olaso-inventory
```

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
│   ├── (app)/              # Protected application routes (Requires Login)
│   │   ├── dashboard/      # Main analytics & alerts dashboard
│   │   ├── sales/          # Point of Sale & patient checkout
│   │   ├── inventory/      # Stock management & deadstock tracking
│   │   ├── reports/        # AI Forecasting & PDF Ledger exports
│   │   └── settings/       # User management
│   ├── (auth)/             # Authentication routes
│   │   └── login/          # Secure Login page with RA 10173 policy
│   ├── page.tsx            # Animated Landing page
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
Larissa Panganiban (📧 202311183@gordoncollege.edu.ph)
Rejean Zapanta (📧 202310500@gordoncollege.edu.ph)

Organization:
M.T. Olaso Optical Clinic

Olongapo City, Zambales, Philippines

© 2026 M.T. Olaso Optical Clinic System. All Rights Reserved.