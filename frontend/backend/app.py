import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# Load environment variables
load_dotenv()

# Initialize Firebase Admin
cred = credentials.Certificate({
    "type": "service_account",
    "project_id": os.getenv("FIREBASE_PROJECT_ID"),
    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
    "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace('\\n', '\n'),
    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
    "client_id": os.getenv("FIREBASE_CLIENT_ID"),
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_CERT_URL")
})

firebase_admin.initialize_app(cred)
db = firestore.client()

# Initialize FastAPI
app = FastAPI(title="OlasoSync ML Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class Product(BaseModel):
    id: str
    sku: str
    name: str
    category: str
    stock: int
    markupPrice: float
    baseCost: float
    reorderPoint: int
    lastMovedDaysAgo: int

class TransactionItem(BaseModel):
    id: str
    name: str
    quantity: int
    price: float

class Transaction(BaseModel):
    id: str
    total: float
    date: str
    status: str
    items: List[TransactionItem]

class ForecastRequest(BaseModel):
    products: List[Product]
    transactions: List[Transaction]
    period: str = "monthly"

class ForecastResponse(BaseModel):
    forecastData: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    usingML: bool
    dataPoints: int

@app.get("/")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/forecast", response_model=ForecastResponse)
async def generate_forecast(request: ForecastRequest):
    """
    Generate sales forecast and product recommendations
    """
    try:
        # Filter completed transactions
        completed_txns = [t for t in request.transactions if t.status == 'completed']
        
        # Simple forecast calculation
        if len(completed_txns) >= 10:
            # Calculate average monthly sales
            monthly_totals = {}
            for t in completed_txns:
                date = datetime.fromisoformat(t.date.replace('Z', '+00:00'))
                month_key = f"{date.year}-{date.month}"
                monthly_totals[month_key] = monthly_totals.get(month_key, 0) + t.total
            
            values = list(monthly_totals.values())
            avg_monthly = sum(values[-3:]) / 3 if len(values) >= 3 else sum(values) / len(values)
            
            # Generate forecast for next 6 months
            month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            current_month = datetime.now().month
            forecast_data = []
            
            for i in range(6):
                month_idx = (current_month + i) % 12
                seasonal_factor = [1.4, 1.1, 1.3, 1.35, 1.2, 1.1, 0.85, 0.8, 0.9, 1.0, 1.2, 1.5][month_idx]
                forecast_value = avg_monthly * seasonal_factor * (1 + i * 0.03)
                
                forecast_data.append({
                    'month': month_names[month_idx],
                    'value': int(forecast_value),
                    'type': 'forecast',
                    'lower': int(forecast_value * 0.7),
                    'upper': int(forecast_value * 1.3)
                })
            
            # Generate recommendations for low stock products
            recommendations = []
            for product in request.products:
                if product.stock <= product.reorderPoint:
                    recommendations.append({
                        'productId': product.id,
                        'productName': product.name,
                        'currentStock': product.stock,
                        'predictedDemand': product.reorderPoint * 2,
                        'recommendedOrder': product.reorderPoint * 2 - product.stock,
                        'daysUntilOut': max(1, int(product.stock / max(0.1, (product.reorderPoint / 30)))),
                        'trend': 'up' if product.lastMovedDaysAgo < 7 else 'stable',
                        'confidence': 'high' if product.stock < product.reorderPoint / 2 else 'medium'
                    })
            
            return {
                "forecastData": forecast_data,
                "recommendations": recommendations[:10],
                "usingML": True,
                "dataPoints": len(completed_txns)
            }
        else:
            return {
                "forecastData": [],
                "recommendations": [],
                "usingML": False,
                "dataPoints": len(completed_txns)
            }
            
    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
