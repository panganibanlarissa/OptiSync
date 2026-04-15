# OptiSync - M.T. Olaso Optical Clinic Management System

OptiSync is a sophisticated **Inventory Management and Point of Sale (POS) System** tailored for **M.T. Olaso Optical Clinic**. It integrates modern web technologies with machine learning to streamline clinic operations, from stock tracking via QR codes to advanced sales forecasting.

## 🚀 Key Features

### 🔹 **Landing Page & Authentication**
- **Modern UI:** Responsive, animated landing page built with Next.js and Framer Motion.
- **Secure Access:** Role-based authentication (Admin vs. Staff) managed via Firebase.
- **Data Privacy:** Integrated RA 10173 compliance with explicit terms and privacy policy agreements.

### 🔹 **Intelligent Dashboard**
- **Clinic Analytics:** Real-time KPI tracking for Revenue, Gross Profit, and Sales Trends.
- **ML-Powered Forecasting:** Advanced sales and inventory forecasting using Prophet and XGBoost.
- **Automated Alerts:** Low-stock, deadstock (unsold for 30+ days), and item expiry notifications.

### 🔹 **Inventory Management**
- **Live Catalog:** Full CRUD operations for frames, lenses, and clinic supplies.
- **QR Code System:** Built-in QR code generation and mobile-ready scanning for rapid stock lookups.
- **Cloud Integration:** Image management for products powered by Cloudinary.
- **Stock Intelligence:** Color-coded inventory status and automated deadstock identification.

### 🔹 **Point of Sale (POS)**
- **Patient Checkout:** Streamlined cart system supporting multiple payment methods (Cash, GCash).
- **Taxation & Discounts:** Dynamic VAT/Tax calculations and subtotaling.
- **Official Receipts:** Instant generation of professional, printable PDF receipts via `jspdf`.

### 🔹 **Security & Reliability**
- **Data Encryption:** Sensitive information is protected using AES encryption (`crypto-js`).
- **Automated Backups:** Integrated backup services to ensure data persistence and recovery.
- **Secure Persistence:** Encrypted local storage hooks for maintaining session integrity.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/)
- **State/Auth:** Firebase Authentication & Firestore
- **Utilities:** Lucide React (Icons), jsQR (Scanning), Cloudinary (Images)

### **Backend (ML Service)**
- **Language:** Python
- **API Framework:** Flask / FastAPI
- **ML Libraries:** Prophet, XGBoost, Scikit-learn
- **Environment:** Dockerized multi-container setup

---

## 📂 Project Structure

```
OptiSync/
├── frontend/                   # Next.js Application
│   ├── src/
│   │   ├── app/                # App Router (Pages, Layouts, API)
│   │   ├── components/         # Reusable UI Components (Modals, Sidebar)
│   │   ├── context/            # Global State (Auth, Firebase)
│   │   ├── hooks/              # Custom React Hooks (ML, Encryption)
│   │   ├── services/           # External API Clients (ML, Backup, Cloudinary)
│   │   └── lib/                # Core configurations (Firebase)
│   ├── public/                 # Static Assets
│   └── ...config files         # Tailwind, TS, ESLint
├── backend/                    # Python ML Service
│   ├── app.py                  # API Entry Point
│   ├── requirements.txt        # Python Dependencies
│   └── setup.sh                # Environment Setup Script
├── docker-compose.yml          # Container Orchestration
├── README.md                   # Project Documentation
└── TODO.md                     # Development Roadmap
```

---

## ⚙️ Getting Started

### 1. Repository Setup
```bash
git clone https://github.com/panganibanlarissa/mt-olaso-inventory.git
cd OptiSync
```

### 2. Frontend Configuration
```bash
cd frontend
npm install
npm run dev -- -p 3000
```

### 3. Backend (ML Service) Setup
```bash
cd backend
python3.11 -m venv venv
# Windows:
venv\Scripts\activate
# Unix/macOS:
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

---

## 📄 License
This project is developed for **M.T. Olaso Optical Clinic**. All rights reserved.
