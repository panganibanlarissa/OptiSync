# OptiSync - Project Setup Guide

This guide will help you set up and run the OptiSync application on your local machine.

## 📁 Project Structure

```
OptiSync/
├── frontend/          # Next.js frontend application
│   ├── src/          # React components and pages
│   ├── public/       # Static assets  
│   ├── package.json  # NPM dependencies
│   └── ...config files
├── ml-service/       # Python ML forecasting service
│   ├── app.py        # Flask/FastAPI application
│   ├── models/       # ML models (Prophet, XGBoost)
│   └── requirements.txt
├── README.md         # Project documentation
└── SETUP.md          # This file
```

---

## ✅ Prerequisites

Before you begin, make sure you have installed:

- **Node.js** 18 or higher ([Download](https://nodejs.org/))
- **npm** (usually comes with Node.js)
- **Python** 3.9 or higher ([Download](https://www.python.org/)) - Optional, only if using ML features
- **Git** for version control

---

## 🚀 Quick Start - Frontend Only

If you just want to run the frontend application:

### Step 1: Navigate to frontend folder
```bash
cd frontend
```

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Set up environment variables
The `.env.local` file is already in the frontend folder with your Firebase and Cloudinary credentials.

### Step 4: Run development server
```bash
npm run dev
```

Open your browser and go to: **http://localhost:3000**

---

## 🤖 Full Setup - Frontend + ML Service

### Frontend Setup (Steps 1-4 from above)

### ML Service Setup

In a **separate terminal** window:

#### Step 1: Navigate to ml-service folder
```bash
cd ml-service
```

#### Step 2: Create Python virtual environment
```bash
# On Windows:
python -m venv venv
venv\Scripts\activate

# On macOS/Linux:
python3 -m venv venv
source venv/bin/activate
```

#### Step 3: Install Python dependencies
```bash
pip install -r requirements.txt
```

#### Step 4: Run the ML service
```bash
python app.py
```

The ML service will run on: **http://localhost:8000**

---

## 📋 NPM Scripts (Frontend)

From the `frontend/` directory:

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Run production build
npm run lint     # Run ESLint
```

---

## 🐳 Docker Setup (ML Service)

If you prefer using Docker for the ML service:

```bash
cd ml-service
docker-compose up
```

---

## 📝 Environment Variables

The environment configuration is stored in `frontend/.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_ML_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

---

## 🆘 Troubleshooting

### Port already in use
- **Frontend (3000)**: Kill the process on port 3000 or use `npm run dev -- -p 3001`
- **ML Service (8000)**: Change port in `ml-service/app.py`

### Module not found
- Run `npm install` in frontend folder
- Run `pip install -r requirements.txt` in ml-service folder

### Python version issues
- Make sure Python 3.9+ is installed: `python --version`
- Use `python3` instead of `python` on macOS/Linux

---

## 📖 More Information

- See `README.md` for detailed feature documentation
- Check `TODO.md` for upcoming features and roadmap

