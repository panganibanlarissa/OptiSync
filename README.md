# M.T. Olaso Optical Clinic - Inventory & POS Management System

A comprehensive **Inventory Management and Point of Sale (POS) System** designed specifically for the **M.T. Olaso Optical Clinic**. This web application modernizes clinic operations by tracking eyewear and supplies with QR code integration, processing patient sales efficiently, and maintaining real-time inventory records.

## 🚀 Key Features

### 🔹 **Landing Page & Authentication**
- **Modern UI:** Responsive, animated landing page showcasing system capabilities.
- **Secure Access:** Role-based authentication (Admin vs. Staff).
- **RA 10173 Compliant:** Built-in Data Privacy Act of 2012 agreements, Terms & Conditions, and Privacy Policy modals.

### 🔹 **Main Dashboard**
- **Clinic Analytics:** Real-time KPI cards for Revenue, Gross Profit, and Sales Trends.
- **At-a-glance Alerts:** Immediate warnings for low-stock and deadstock items.
- **Sales Insights:** Track daily transactions and performance metrics.

### 🔹 **Inventory Management**
- **Live Catalog:** Add, Edit, and Delete frames, lenses, and clinic supplies.
- **Smart Triggers:** Color-coded status indicators ("In Stock", "Low Stock").
- **QR Code Integration:** Generate unique QR codes for quick product lookup and automatic stock adjustments via camera scanning.
- **Deadstock Identification:** Automatically flags slow-moving items (unsold for 30+ days) to free up tied capital.


### 🔹 **Point of Sale (POS)**
- **Patient Checkout:** Fast, intuitive cart system for walk-in patients.
- **Dynamic Pricing:** Apply VAT/Tax, calculate subtotals, and process Cash/GCash.
- **Official Receipts:** Instant generation of beautifully formatted, printable PDF receipts.

### 🔹 **Transaction Reports**
- **Sales Records:** Monthly searchable transaction history for all clinic sales.
- **PDF Exports:** Generate professional, printable reports for accounting and auditing purposes.
- **Receipt Management:** Access all issued receipts with complete transaction details.

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
- **QR Code Scanning:** [jsQR](https://github.com/cozmo/jsQR) (Product lookup and inventory management)
- **Language:** TypeScript

---

## 📂 Project Structure

```
OptiSync/
├── frontend/                    # Next.js frontend application
│   ├── src/                     # React components and pages
│   ├── public/                  # Static assets
│   ├── package.json             # Frontend dependencies
│   ├── next.config.js           # Next.js configuration
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   ├── tsconfig.json            # TypeScript configuration
│   ├── .env.local               # Local environment variables
│   └── ...other config files
├── ml-service/                  # Python ML forecasting service
│   ├── app.py                   # Flask/FastAPI application
│   ├── models/                  # Prophet and XGBoost models
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile               # Container configuration
│   └── docker-compose.yml       # Multi-container setup
├── README.md                    # This file
└── TODO.md                      # Project roadmap
```

---

## �📦 Getting Started

Follow these steps to set up the project locally.

### 1. Clone the repository
```bash
git clone https://github.com/panganibanlarissa/mt-olaso-inventory.git
cd OptiSync
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

### ⚙️ Detailed Environment Setup

#### Frontend Setup

Navigate to the frontend directory and install dependencies:
```bash
cd frontend
npm install
```

Run development server:
```bash
npm run dev
```

#### ML Service Setup (Optional)

In a separate terminal, set up the Python ML service:

```bash
cd ml-service

# Create Python virtual environment
# On Windows:
python -m venv venv
venv\Scripts\activate

# On macOS/Linux:
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run ML service
python app.py
```

**Access points:**
- Frontend: http://localhost:3000
- ML Service: http://localhost:8000

---

For complete setup guides, see [SETUP.md](SETUP.md)

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