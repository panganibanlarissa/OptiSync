# OptiSync - M.T. Olaso Optical Clinic Management System

**OptiSync** is an enterprise-grade **Inventory Management and Point of Sale (POS) System** designed for **M.T. Olaso Optical Clinic**. It combines modern web technologies with machine learning capabilities to streamline clinic operations, including QR-based inventory tracking, intelligent sales forecasting, and secure patient transaction management.

---

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation Guide](#installation-guide)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Sample Accounts](#sample-accounts)
- [User Role Guides](#user-role-guides)
- [License](#license)

---

## Overview

OptiSync addresses the operational challenges faced by optical clinics by providing:
- Real-time inventory visibility with QR code generation and scanning
- AI-powered sales forecasting using Prophet and XGBoost
- Integrated POS system with cart, discounts, online/cash payment handling, and warranty replacement support
- Role-based access control for different staff levels
- Activity logging for product, stock, scan, and transaction actions
- Compliance with data protection regulations (RA 10173)

---

## Key Features
### **Authentication & Access Control**
- Role-based authentication using Firebase (Admin & Staff)
- Login page, password recovery, and session management

### **Dashboards & Analytics**
- Admin and Staff dashboards with KPIs and quick actions (`AdminDashboard.tsx`, `StaffDashboard.tsx`)
- Visual charts and activity logs for products, scans, and transactions

### **Inventory Management**
- Full product CRUD with categories (frames, solutions, accessories, vitamins)
- QR code generation and scanning flows (scan-in / scan-out) via QR components
- Cloudinary image upload and storage integration
- Expiry alerts, low-stock/deadstock detection, and PDF export of reports

### **Point of Sale (POS)**
- Patient checkout with cart management and transaction history
- Multiple payment flows (cash and reference/online), discount handling, and printable receipts
- Warranty replacement workflows and replacement request approval UI

### **Machine Learning & Forecasting**
- ML forecasting integration for demand and reorder recommendations (`useMLForecasting.ts`, `mlApiClient.ts`)

### **Security & Data Protection**
- AES-based encryption for sensitive data and encrypted local storage (`encryption.ts`, `useEncryptedStorage.ts`)
- Role-based API protections and audit logging

### **Platform & Integrations**
- Frontend: Next.js (App Router) + Tailwind CSS; Backend: Flask ML service
- Integrations: Firebase (Auth & Firestore), Cloudinary (images), Docker Compose for local orchestration

---

## Tech Stack
### **Frontend**
- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/)
- **Authentication & Database:** Firebase (Auth & Firestore)
- **Image Management:** Cloudinary
- **Additional Libraries:** 
  - Lucide React (Icons)
  - jsQR (Barcode Scanning)
  - jsPDF (Receipt Generation)
  - crypto-js (Encryption)

### **Backend (ML Service)**
- **Language:** Python 3.11+
- **API Framework:** Flask / FastAPI
- **Machine Learning:** Prophet, XGBoost, Scikit-learn
- **Data Processing:** Pandas, NumPy
- **Deployment:** Docker & Docker Compose

### **Database & Services**
- **Primary Database:** Firebase Firestore
- **Cloud Storage:** Cloudinary
- **Authentication Provider:** Firebase Auth

---

## Project Structure
```
OptiSync/
├── frontend/                   # Next.js Web Application
│   ├── src/
│   │   ├── app/                # App Router (Pages, Layouts, API Routes)
│   │   │   ├── (auth)/         # Authentication pages (login)
│   │   │   ├── (app)/          # Protected routes (dashboard, inventory, sales, reports)
│   │   │   ├── api/            # API endpoints
│   │   │   └── globals.css     # Global styles
│   │   ├── components/         # Reusable UI Components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── AuthWrapper.tsx
│   │   │   ├── QRScannerModal.tsx
│   │   │   └── ...more
│   │   ├── context/            # Global State Management
│   │   │   ├── AuthContext.tsx
│   │   │   └── FirebaseContext.tsx
│   │   ├── hooks/              # Custom React Hooks
│   │   │   ├── useEncryptedStorage.ts
│   │   │   └── useMLForecasting.ts
│   │   ├── services/           # External API Clients & Utilities
│   │   │   ├── mlApiClient.ts
│   │   │   ├── backupService.ts
│   │   │   └── encryption.ts
│   │   ├── lib/                # Core Configurations
│   │   │   └── firebase.ts
│   │   └── config/             # Service Configurations
│   │       └── cloudinary.ts
│   ├── public/                 # Static Assets
│   ├── package.json            # Frontend Dependencies
│   └── ...config files         # Tailwind, TypeScript, ESLint configs
│
├── backend/                    # Python ML Service
│   ├── app.py                  # Flask/FastAPI Entry Point
│   ├── requirements.txt        # Python Dependencies
│   └── setup.sh                # Environment Setup Script
│
├── docker-compose.yml          # Multi-container Orchestration
├── README.md                   # Project Documentation
└── package.json                # Root-level Dependencies

```

---

## Installation Guide
### **Prerequisites**

Before installing OptiSync, ensure you have the following installed:

- **Git** - Version control ([Download](https://git-scm.com/))
- **Node.js & npm** - Version 18.x or higher ([Download](https://nodejs.org/))
- **Python** - Version 3.11 or higher ([Download](https://www.python.org/))
- **Docker** (optional) - For containerized deployment ([Download](https://www.docker.com/))
- **Git Account** - Access to the OptiSync repository

### **Step 1: Clone the Repository**

```bash
git clone https://github.com/panganibanlarissa/mt-olaso-inventory.git
cd OptiSync
```

### **Step 2: Frontend Setup**

Navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

**Troubleshooting npm:**
- If you encounter permission errors, try: `npm install --legacy-peer-deps`
- Clear cache: `npm cache clean --force`

### **Step 3: Backend Setup**

Navigate to the backend directory and create a Python virtual environment:

```bash
cd ../backend

# Create virtual environment
python3.11 -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### **Step 4: Docker Setup (Optional)**

If using Docker for containerized deployment:

```bash
# From the root directory
docker-compose up --build

# To run in background:
docker-compose up -d
```

---

## Configuration
### **Firebase Setup**

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Generate a service account key
5. Add Firebase config to your frontend `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
```

### **Cloudinary Setup**

1. Create a Cloudinary account at [Cloudinary](https://cloudinary.com/)
2. Get your API credentials
3. Add to frontend `.env.local`:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=YOUR_CLOUDINARY_CLOUD_NAME
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=YOUR_CLOUDINARY_UPLOAD_PRESET
CLOUDINARY_API_KEY=YOUR_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=YOUR_CLOUDINARY_API_SECRET
```

### **Other Frontend Environment Variables**

Add these to your frontend `.env.local` as well:

```env
# ML Service URL (used by the frontend to call the ML forecasting service)
NEXT_PUBLIC_ML_SERVICE_URL=http://localhost:8000

# AES-256 encryption key used by the frontend utilities
NEXT_PUBLIC_ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY
```

### **Backend ML Service Configuration**

Create a `.env` file in the backend directory:

```env
FLASK_ENV=development
FLASK_APP=app.py
ML_MODEL_PATH=./models
DATABASE_URL=your_firebase_connection
```

---

## Running the Application
### **Development Mode**

**Terminal 1 - Frontend:**
```bash
cd frontend
npm run dev -- -p 3000
```
Access the application at: `http://localhost:3000`

**Terminal 2 - Backend:**
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python app.py
```
Backend API available at: `http://localhost:5000`

### **Production Mode**

**Build Frontend:**
```bash
cd frontend
npm run build
npm start
```

**Deploy Backend:**
```bash
cd backend
# Set environment to production
export FLASK_ENV=production
python app.py
```

### **Using Docker Compose**

```bash
docker-compose up -d
```

This will start both frontend (port 3000) and backend (port 5000) in containers.

---

## Sample Accounts
For development and testing purposes, use the following pre-configured accounts:

### **Admin Account**

| Field | Value |
|-------|-------|
| **Email** | `olasosync@gmail.com` |
| **Password** | `MTolaso_opticalclinic2026` |
| **Role** | Administrator |
| **Access** | Full system access |

**Usage:**
1. Navigate to `http://localhost:3000`
2. Click **Login**
3. Enter email: `olasosync@gmail.com`
4. Enter password: `MTolaso_opticalclinic2026`
5. Click **Login**

You will be directed to the Admin Dashboard with access to all features.

### **Staff Account**

| Field | Value |
|-------|-------|
| **Email** | `staff.olasosync@gmail.com` |
| **Password** | `staff_123` |
| **Role** | Staff Member |
| **Access** | POS and Inventory |

**Usage:**
1. Navigate to `http://localhost:3000`
2. Click **Login**
3. Enter email: `staff.olasosync@gmail.com`
4. Enter password: `staff_123`
5. Click **Login**

You will be directed to the Staff Dashboard with access to sales and product search features.

### **Testing Credentials**

| Role | Email | Password | Dashboard |
|------|-------|----------|-----------|
| Admin | `olasosync@gmail.com` | `MTolaso_opticalclinic2026` | Full Analytics & Management |
| Staff | `staff.olasosync@gmail.com` | `staff_123` | POS & Inventory Only |

> **Important:** These are development accounts only. In production, ensure all default credentials are changed and unique, strong passwords are set for all user accounts.

---

## User Role Guides
OptiSync implements two primary user roles with distinct permissions and functionalities. This section provides comprehensive guides for each role.

### **Admin User Guide**
**Role Description:** Administrators have full system access and are responsible for managing inventory, staff, and clinic operations.

#### **Key Permissions**
- ✅ Full inventory management (Create, Read, Update, Delete products)
- ✅ User account management (Create, edit, delete staff accounts)
- ✅ Dashboard analytics and reporting
- ✅ System settings and configuration
- ✅ Backup and data recovery management
- ✅ Access to all reports and forecasts
- ✅ Approval of high-value transactions

#### **Admin Dashboard**
The admin dashboard provides:
- **Real-time Analytics:** Revenue, profit margins, sales trends
- **Inventory Overview:** Stock levels, low-stock alerts, deadstock items
- **ML Forecasts:** Sales predictions and inventory recommendations
- **Staff Management Panel:** Add, edit, deactivate user accounts
- **System Alerts:** Critical notifications requiring immediate attention

#### **Typical Admin Workflows**

**1. Add New Product to Inventory**
- Navigate to **Inventory** → **Add Product**
- Enter product details (name, SKU, category)
- Upload product image via Cloudinary
- Set stock quantity and pricing
- Click **Save**
- Product QR code is shown immediately for printing/labeling

**2. Review Sales Dashboard**
- Open **Dashboard**
- Review KPIs: Total Revenue, Gross Profit, Sales Count
- Check ML-generated sales forecast for next 7-30 days
- Review inventory trends and deadstock items
- Download inventory reports as PDF when needed

**3. Manage Staff Accounts**
- Go to **Staff Management**
- Click **Add Staff Member**
- Enter email, name, and assign role (Staff)
- Set permissions
- Send activation link via email

---

### **Staff User Guide**
**Role Description:** Staff members handle day-to-day clinic operations including patient sales, inventory lookups, and customer service.

#### **Key Permissions**
- ✅ Process patient transactions (POS)
- ✅ View and update inventory stock via scan-in/scan-out and stock adjustments
- ✅ Generate receipts
- ✅ View assigned reports
- ✅ Use QR product search and stock movement tools
- ❌ Cannot access system activity logs
- ❌ Cannot manage user accounts
- ❌ Cannot view financial analytics

#### **Staff Dashboard**
The staff dashboard provides:
- **Quick Sale Entry:** Cart interface for patient checkout
- **Product Search:** QR scanner and text search
- **Inventory Lookup:** Real-time stock availability
- **Today's Sales:** Personal sales summary
- **Receipt Printing:** Generate and print official receipts

#### **Typical Staff Workflows**

**1. Process a Patient Purchase**
- Click **New Sale** on dashboard
- Search product by name or scan QR code
- Select product and enter quantity
- Item appears in cart
- Review subtotal and tax calculation
- Select payment method (Cash/Online)
- Click **Complete Transaction**
- Print receipt

**2. Search for Product Availability**
- Use **Product Search** feature
- Enter product name or scan barcode
- View real-time stock information
- Check product details (price, description)
- Provide information to customer

**3. Handle QR Code Scanning**
- Click **QR Scanner** button
- Point device camera at product barcode
- System automatically retrieves product details
- Confirm product information and quantity
- For Scan In/Out, confirm quantity before applying stock movement
- Scan Out is recorded as damage/exchange to keep unit accounting accurate

**4. Generate and Print Receipt**
- After transaction completion, receipt displays automatically
- Click **Print Receipt** to print official document
- Receipt includes:
  - Transaction date/time
  - Products purchased and quantities
  - Subtotal, tax, and total
  - Payment method
  - Customer and seller information

---

### **Account Creation & Login**

**For New Users:**

1. Admin creates account in **Staff Management**
2. System sends activation email to user
3. User clicks activation link in email
4. User can now log in with email and password

**Login Process:**

1. Navigate to `http://localhost:3000`
2. Enter email address
3. Enter password
4. Click **Login**
5. After authentication, user is directed to their respective dashboard

**Password Recovery:**

1. On login page, click **Forgot Password?**
2. Enter registered email address
3. Check email for recovery link
4. Click link and create new password
5. Log in with new password

---

## License
This project is developed for **M.T. Olaso Optical Clinic**. All rights reserved.

