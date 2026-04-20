# OptiSync - M.T. Olaso Optical Clinic Management System

**OptiSync** is an enterprise-grade **Inventory Management and Point of Sale (POS) System** designed for **M.T. Olaso Optical Clinic**. It combines modern web technologies with machine learning capabilities to streamline clinic operations, including QR-based inventory tracking, intelligent sales forecasting, and secure patient transaction management.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Installation Guide](#-installation-guide)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [Sample Accounts](#-sample-accounts)
- [User Role Guides](#-user-role-guides)
- [Project Structure](#-project-structure)
- [Troubleshooting](#-troubleshooting)

---

## Overview

OptiSync addresses the operational challenges faced by optical clinics by providing:
- Real-time inventory visibility with QR code scanning
- AI-powered sales forecasting using Prophet and XGBoost
- Integrated POS system with multiple payment options
- Role-based access control for different staff levels
- Data security with AES encryption and automated backups
- Compliance with data protection regulations (RA 10173)

---

## 🚀 Key Features

### **Landing Page & Authentication**
- Responsive, animated landing page with Framer Motion
- Secure role-based authentication (Admin vs. Staff) via Firebase
- RA 10173 compliance with explicit terms and privacy policy agreements
- Password recovery and account management

### **Intelligent Dashboard**
- Real-time KPI tracking: Revenue, Gross Profit, Sales Trends
- ML-powered forecasting for demand and inventory optimization
- Automated alerts: low-stock, deadstock, and expiry notifications
- Visual analytics with interactive charts and graphs

### **Inventory Management**
- Complete CRUD operations for products (frames, lenses, supplies)
- QR code generation and mobile-ready scanning
- Cloud-based image management via Cloudinary
- Color-coded inventory status and automated deadstock detection
- Product categorization and filtering

### **Point of Sale (POS)**
- Streamlined patient checkout with cart management
- Multiple payment methods (Cash, GCash)
- Dynamic VAT/Tax calculations and discounts
- Official, printable PDF receipts
- Transaction history and reporting

### **Security & Reliability**
- AES encryption for sensitive data (`crypto-js`)
- Automated backup services with recovery options
- Encrypted local storage for session integrity
- Secure API endpoints with role-based access control
- Audit logging for compliance

---

## 🛠️ Tech Stack

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

## 📂 Project Structure

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

## 🔧 Installation Guide

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

## ⚙️ Configuration

### **Firebase Setup**

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Generate a service account key
5. Add Firebase config to your frontend `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### **Cloudinary Setup**

1. Create a Cloudinary account at [Cloudinary](https://cloudinary.com/)
2. Get your API credentials
3. Add to frontend `.env.local`:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
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

## 🚀 Running the Application

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

## � Sample Accounts

For development and testing purposes, use the following pre-configured accounts:

### **Admin Account**

| Field | Value |
|-------|-------|
| **Email** | `admin@clinic.local` |
| **Password** | `admin123` |
| **Role** | Administrator |
| **Access** | Full system access |

**Usage:**
1. Navigate to `http://localhost:3000`
2. Click **Login**
3. Enter email: `admin@clinic.local`
4. Enter password: `admin123`
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
| Admin | `admin@clinic.local` | `admin123` | Full Analytics & Management |
| Staff | `staff.olasosync@gmail.com` | `staff_123` | POS & Inventory Only |

> **⚠️ Important:** These are development accounts only. In production, ensure all default credentials are changed and unique, strong passwords are set for all user accounts.

---

## �👥 User Role Guides

OptiSync implements two primary user roles with distinct permissions and functionalities. This section provides comprehensive guides for each role.

### **📊 Admin User Guide**

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

**2. Review Sales Dashboard**
- Open **Dashboard**
- Review KPIs: Total Revenue, Gross Profit, Sales Count
- Check ML-generated sales forecast for next 7-30 days
- Review inventory trends and deadstock items
- Export reports as needed

**3. Manage Staff Accounts**
- Go to **Settings** → **Staff Management**
- Click **Add Staff Member**
- Enter email, name, and assign role (Staff)
- Set permissions
- Send activation link via email

**4. Generate & Review Backups**
- Access **Settings** → **Backup Management**
- View last backup timestamp and status
- Manually trigger backup: Click **Create Backup**
- Download backup file or restore from previous backup
- Monitor backup schedule

#### **Admin Best Practices**
- Review dashboard analytics daily
- Conduct monthly inventory audits
- Monitor and approve large transactions
- Maintain regular backup schedules
- Update product information promptly
- Keep staff accounts current and secure

---

### **👨‍💼 Staff User Guide**

**Role Description:** Staff members handle day-to-day clinic operations including patient sales, inventory lookups, and customer service.

#### **Key Permissions**
- ✅ Process patient transactions (POS)
- ✅ View inventory (Read-only for searching/scanning)
- ✅ Generate receipts
- ✅ View assigned reports
- ✅ Modify inventory
- ❌ Cannot access system settings
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
- Select payment method (Cash/GCash)
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
- Confirm product information
- Add to cart or view inventory

**4. Generate and Print Receipt**
- After transaction completion, receipt displays automatically
- Click **Print Receipt** to print official document
- Receipt includes:
  - Transaction date/time
  - Products purchased and quantities
  - Subtotal, tax, and total
  - Payment method
  - Customer and seller information

#### **Staff Best Practices**
- Always scan or verify product details before checkout
- Double-check payment amounts before confirming
- Print receipts for all transactions
- Report product discrepancies to admin immediately
- Keep passwords secure and log out after each session
- Use the product search feature to verify availability before promises

---

### **Access Control Matrix**

| Feature | Admin | Staff |
|---------|-------|-------|
| Dashboard & Analytics | ✅ Full Access | ⚠️ Limited (Today's Sales) |
| Inventory Management | ✅ CRUD | ✅ CRUD |
| QR Code Scanning | ✅ Yes | ✅ Yes |
| Process Transactions | ✅ Yes | ✅ Yes |
| Generate Receipts | ✅ Yes | ✅ Yes |
| Staff Management | ✅ Yes | ❌ No |
| System Settings | ✅ Yes | ❌ No |
| Backup Management | ✅ Yes | ❌ No |
| Reports & Exports | ✅ Full | ❌ No |
| ML Forecasting | ✅ Yes | ❌ No |

---

### **Account Creation & Login**

**For New Users:**

1. Admin creates account in **Settings** → **Staff Management**
2. System sends activation email to user
3. User clicks activation link in email
4. User sets password and completes profile
5. User can now log in with email and password

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

## 🐛 Troubleshooting

### **Frontend Issues**

**Port 3000 Already in Use:**
```bash
npm run dev -- -p 3001  # Use different port
```

**Dependencies Not Installed:**
```bash
npm install --legacy-peer-deps
npm cache clean --force
```

**Firebase Configuration Not Working:**
- Verify `.env.local` file exists in frontend directory
- Check Firebase credentials are correct
- Ensure Firestore database is created
- Verify authentication methods are enabled

**QR Scanner Not Working:**
- Ensure camera permission is granted in browser
- Check browser console for errors
- Verify jsQR library is loaded

### **Backend Issues**

**Python Virtual Environment Not Activating:**
```bash
# Windows: Use full path if needed
.\venv\Scripts\activate.bat

# macOS/Linux: Try bash instead of sh
bash -c "source venv/bin/activate"
```

**Missing Dependencies:**
```bash
pip install -r requirements.txt
pip install --upgrade pip
```

**Port 5000 Already in Use:**
```python
# Edit app.py to use different port
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001)
```

**ML Models Not Loading:**
- Verify model files exist in configured path
- Check file permissions
- Ensure sufficient disk space
- Review backend logs for detailed errors

### **Database Issues**

**Firebase Connection Failing:**
- Check internet connection
- Verify Firebase project is active
- Check service account credentials
- Review Firebase console for errors

**Firestore Rules Blocking Access:**
- Check security rules in Firebase Console
- Ensure rules allow read/write for authenticated users
- Review authentication status

### **Docker Issues**

**Container Won't Start:**
```bash
docker-compose logs frontend  # Check frontend logs
docker-compose logs backend   # Check backend logs
docker-compose down           # Stop all containers
docker-compose up --build     # Rebuild and start
```

**Port Conflicts:**
Edit `docker-compose.yml` and change port mappings

### **Performance Issues**

- Clear browser cache and local storage
- Restart development servers
- Check network tab in browser DevTools
- Monitor API response times
- Review backend server logs

---

## 📄 License
This project is developed for **M.T. Olaso Optical Clinic**. All rights reserved.
