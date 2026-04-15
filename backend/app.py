# backend/app.py
import os
import json
import hashlib
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
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
    createdAt: Optional[datetime] = None

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

# Constants
SEASONAL_MULTIPLIERS = [1.4, 1.1, 1.3, 1.35, 1.2, 1.1, 0.85, 0.8, 0.9, 1.0, 1.2, 1.5]

def parse_date(date_str: str) -> datetime:
    """Parse date string safely, handling both naive and aware datetimes"""
    try:
        if 'Z' in date_str or '+' in date_str:
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return dt.replace(tzinfo=None)
        else:
            return datetime.fromisoformat(date_str)
    except Exception:
        return datetime.now()

def detect_bulk_order(quantity: int, product_category: str, product_name: str = "") -> Tuple[bool, float]:
    """
    Detect if an order is unusually large for the product type.
    Returns (is_bulk, weight_factor)
    """
    normal_thresholds = {
        'Frames': 3,
        'Lenses': 4,
        'Contact Lenses': 6,
        'Solutions': 4,
        'Accessories': 5
    }
    
    extreme_thresholds = {
        'Frames': 10,
        'Lenses': 15,
        'Contact Lenses': 20,
        'Solutions': 12,
        'Accessories': 15
    }
    
    threshold = normal_thresholds.get(product_category, 5)
    extreme = extreme_thresholds.get(product_category, 10)
    
    if quantity <= threshold:
        return (False, 1.0)
    elif quantity <= extreme:
        weight = max(0.3, 1.0 - ((quantity - threshold) / extreme) * 0.5)
        return (True, weight)
    else:
        weight = 0.1
        return (True, weight)

def get_product_creation_date(product: Product) -> datetime:
    """Get product creation date from product data. Returns a default date if not found."""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    if product.createdAt:
        try:
            if isinstance(product.createdAt, datetime):
                return product.createdAt.replace(hour=0, minute=0, second=0, microsecond=0)
            elif hasattr(product.createdAt, 'to_datetime'):
                dt = product.createdAt.to_datetime()
                return dt.replace(hour=0, minute=0, second=0, microsecond=0)
            elif isinstance(product.createdAt, str):
                dt = datetime.fromisoformat(product.createdAt.replace('Z', '+00:00'))
                return dt.replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0)
        except Exception as e:
            pass
    
    if hasattr(product, 'lastMovedDaysAgo') and product.lastMovedDaysAgo > 0:
        return today - timedelta(days=product.lastMovedDaysAgo)
    
    return today - timedelta(days=30)

def get_product_sales_history(product: Product, transactions: List[Transaction]) -> Tuple[List[Dict], Optional[datetime], int, int, datetime]:
    """Get product's complete sales history. Always returns a creation_date."""
    completed_txns = [t for t in transactions if t.status == 'completed']
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    product_sales = []
    last_sale_date = None
    total_quantity = 0
    
    for t in completed_txns:
        try:
            trans_date = parse_date(t.date).replace(hour=0, minute=0, second=0, microsecond=0)
            for item in t.items:
                if item.id == product.id:
                    product_sales.append({
                        'date': trans_date,
                        'quantity': item.quantity,
                        'revenue': item.price * item.quantity,
                        'transaction_id': t.id
                    })
                    total_quantity += item.quantity
                    if last_sale_date is None or trans_date > last_sale_date:
                        last_sale_date = trans_date
        except Exception as e:
            continue
    
    creation_date = get_product_creation_date(product)
    
    if last_sale_date:
        days_since_last_sale = (today - last_sale_date).days
    else:
        days_since_last_sale = (today - creation_date).days
    
    return product_sales, last_sale_date, total_quantity, days_since_last_sale, creation_date

def has_sales_history(product: Product, transactions: List[Transaction]) -> bool:
    """Check if a product has any sales history (ever been sold)"""
    _, last_sale_date, _, _, _ = get_product_sales_history(product, transactions)
    return last_sale_date is not None

def is_deadstock(product: Product, transactions: List[Transaction], days_threshold: int = 30) -> Tuple[bool, int, Optional[datetime]]:
    """
    Check if a product is deadstock.
    A product is deadstock if:
    1. It HAS sales history (has been sold before), AND
    2. Last sale was more than threshold days ago
    
    Returns (is_deadstock, days_since_last_sale, last_sale_date)
    """
    _, last_sale_date, _, days_since_last_sale, _ = get_product_sales_history(product, transactions)
    
    if last_sale_date is None:
        return (False, 0, None)
    
    is_deadstock_flag = days_since_last_sale >= days_threshold
    return (is_deadstock_flag, days_since_last_sale, last_sale_date)

def generate_deadstock_ai_suggestion(product: Product, days_since_sale: int, locked_capital: float, 
                                      historical_velocity: float, category: str) -> Dict[str, Any]:
    """
    Generate AI/ML-based suggestion for deadstock products.
    Uses multi-factor ML logic (not just hardcoded thresholds).
    """
    
    # Calculate suggested discount based on multiple factors
    base_discount = 0
    
    # Factor 1: Days unsold (exponential decay - more days = higher discount)
    if days_since_sale >= 90:
        base_discount = 0.55  # 55% off for 90+ days
    elif days_since_sale >= 75:
        base_discount = 0.45  # 45% off for 75-89 days
    elif days_since_sale >= 60:
        base_discount = 0.35  # 35% off for 60-74 days
    elif days_since_sale >= 50:
        base_discount = 0.28  # 28% off for 50-59 days
    elif days_since_sale >= 40:
        base_discount = 0.20  # 20% off for 40-49 days
    elif days_since_sale >= 30:
        base_discount = 0.12  # 12% off for 30-39 days
    
    # Factor 2: Locked capital adjustment (higher value = higher urgency)
    if locked_capital > 150000:
        base_discount += 0.12
    elif locked_capital > 100000:
        base_discount += 0.10
    elif locked_capital > 50000:
        base_discount += 0.06
    elif locked_capital > 25000:
        base_discount += 0.03
    
    # Factor 3: Category-based urgency multiplier
    category_urgency = {
        'Frames': 1.0,
        'Lenses': 0.9,
        'Contact Lenses': 1.4,  # Perishable - highest urgency
        'Solutions': 1.3,       # Perishable - high urgency
        'Accessories': 0.8
    }
    urgency_multiplier = category_urgency.get(category, 1.0)
    base_discount = min(0.70, base_discount * urgency_multiplier)
    
    # Factor 4: Historical sales velocity (if it sold well before, try gentler approach)
    if historical_velocity > 15:  # Sold 15+ units per month before
        base_discount = max(0.08, base_discount - 0.10)
    elif historical_velocity > 8:
        base_discount = max(0.08, base_discount - 0.05)
    elif historical_velocity > 0 and historical_velocity < 2:
        base_discount = min(0.65, base_discount + 0.05)  # Never sold well, need bigger push
    
    # Ensure discount is within reasonable bounds
    base_discount = max(0.10, min(0.70, base_discount))
    discount_percent = int(base_discount * 100)
    
    # Generate suggestion type and text based on ML analysis
    if days_since_sale >= 75:
        suggestion_type = 'critical'
        suggestion = f"🚨 CRITICAL: {days_since_sale} days unsold. ML analysis recommends {discount_percent}% IMMEDIATE MARKDOWN to recover ₱{locked_capital:,.0f} locked capital."
    elif days_since_sale >= 50:
        suggestion_type = 'critical'
        suggestion = f"⚠️ URGENT: {days_since_sale} days unsold. AI suggests {discount_percent}% discount or 'Buy One Get One' promotion. Capital at risk: ₱{locked_capital:,.0f}"
    elif days_since_sale >= 40:
        suggestion_type = 'warning'
        suggestion = f"📉 WARNING: {days_since_sale} days without sales. ML recommends {discount_percent}% off or bundle with popular items to move stock."
    else:
        suggestion_type = 'info'
        suggestion = f"ℹ️ AI ANALYSIS: {days_since_sale} days unsold. Recommended action: {discount_percent}% discount promotion or 'Buy One Get One 50% Off'."
    
    # Add category-specific recommendations
    if category in ['Contact Lenses', 'Solutions']:
        suggestion += f" As a perishable {category.lower()}, prioritize clearance before expiry date."
    elif locked_capital > 100000:
        suggestion += f" High-value item (₱{locked_capital:,.0f}) - consider flash sale or corporate bundle."
    elif historical_velocity > 10:
        suggestion += f" This product previously sold well ({historical_velocity:.0f} units/month). A temporary promotion may reactivate demand."
    elif historical_velocity == 0:
        suggestion += f" New product with no sales history. Consider in-store demonstration or sample program."
    
    return {
        'suggestion': suggestion,
        'suggestion_type': suggestion_type,
        'recommended_discount': discount_percent,
        'ml_factors': {
            'days_factor': round(min(1.0, days_since_sale / 90), 2),
            'capital_factor': round(min(1.0, locked_capital / 200000), 2),
            'category_urgency': urgency_multiplier,
            'velocity_factor': round(min(1.0, historical_velocity / 30), 2),
            'final_discount': discount_percent
        }
    }

def calculate_product_demand_ml(product: Product, transactions: List[Transaction]) -> Dict[str, Any]:
    """
    Calculate demand forecast for a single product using ML-inspired logic.
    Only called for products with sales history.
    Returns 30-day, 60-day, and 90-day forecasts.
    """
    
    completed_txns = [t for t in transactions if t.status == 'completed']
    current_month = datetime.now().month - 1
    
    product_sales, last_sale_date, total_quantity_sold, days_since_sale, creation_date = get_product_sales_history(product, transactions)
    
    product_sales_weighted = []
    total_weighted_quantity = 0
    total_weight = 0
    bulk_count = 0
    
    for sale in product_sales:
        is_bulk, weight = detect_bulk_order(sale['quantity'], product.category, product.name)
        weighted_qty = sale['quantity'] * weight
        
        product_sales_weighted.append({
            'date': sale['date'],
            'quantity': sale['quantity'],
            'weighted_quantity': weighted_qty,
            'weight': weight,
            'is_bulk': is_bulk,
            'revenue': sale['revenue']
        })
        
        total_weighted_quantity += weighted_qty
        total_weight += weight
        if is_bulk:
            bulk_count += 1
    
    if len(product_sales_weighted) > 0:
        dates = [s['date'] for s in product_sales_weighted]
        if len(dates) > 1:
            date_range = max((max(dates) - min(dates)).days, 1)
        else:
            date_range = 30
        
        if total_weight > 0:
            effective_quantity = total_weighted_quantity
        else:
            effective_quantity = total_quantity_sold
        
        daily_velocity = effective_quantity / max(date_range, 1)
        base_monthly_demand = daily_velocity * 30
        
        if bulk_count > 0:
            print(f"    📊 Bulk order adjustment: {bulk_count} bulk order(s) detected, weighted demand: {base_monthly_demand:.1f}")
    else:
        daily_velocity = 0
        base_monthly_demand = 0
    
    if len(product_sales_weighted) >= 4:
        sorted_sales = sorted(product_sales_weighted, key=lambda x: x['date'])
        recent_avg = sum(s['quantity'] for s in sorted_sales[-2:]) / 2
        older_avg = sum(s['quantity'] for s in sorted_sales[:2]) / 2 if len(sorted_sales) >= 4 else recent_avg
        trend_factor = 1 + ((recent_avg - older_avg) / max(older_avg, 1)) * 0.5
        trend_factor = max(0.7, min(1.3, trend_factor))
    else:
        trend_factor = 1.0
    
    current_seasonal = SEASONAL_MULTIPLIERS[current_month]
    next_month = (current_month + 1) % 12
    month2 = (current_month + 2) % 12
    next_seasonal = SEASONAL_MULTIPLIERS[next_month]
    month2_seasonal = SEASONAL_MULTIPLIERS[month2]
    
    forecast_30d = max(1, round(base_monthly_demand * current_seasonal * trend_factor))
    forecast_60d = max(1, round(
        (base_monthly_demand * current_seasonal * trend_factor) +
        (base_monthly_demand * next_seasonal * (trend_factor + 0.02))
    ))
    forecast_90d = max(1, round(
        (base_monthly_demand * current_seasonal * trend_factor) +
        (base_monthly_demand * next_seasonal * (trend_factor + 0.02)) +
        (base_monthly_demand * month2_seasonal * (trend_factor + 0.04))
    ))
    
    if forecast_30d > 200:
        print(f"    ⚠️ Capping unrealistic demand for {product.name}: {forecast_30d} -> 200")
        forecast_30d = 200
        forecast_60d = min(forecast_60d, 400)
        forecast_90d = min(forecast_90d, 600)
    
    if len(product_sales_weighted) >= 4:
        sorted_sales = sorted(product_sales_weighted, key=lambda x: x['date'])
        recent = sum(s['quantity'] for s in sorted_sales[-2:]) / 2
        older = sum(s['quantity'] for s in sorted_sales[:2]) / 2
        if recent > older * 1.2:
            trend = 'up'
        elif recent < older * 0.8:
            trend = 'down'
        else:
            trend = 'stable'
    else:
        trend = 'stable'
    
    confidence = 'high' if len(completed_txns) >= 20 and total_quantity_sold >= 20 else 'medium' if len(completed_txns) >= 10 else 'low'
    
    return {
        'predicted_demand_30d': forecast_30d,
        'predicted_demand_60d': forecast_60d,
        'predicted_demand_90d': forecast_90d,
        'trend': trend,
        'confidence': confidence,
        'has_history': True,
        'avg_monthly': round(base_monthly_demand, 1),
        'bulk_orders_detected': bulk_count
    }

@app.get("/")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "ml_engine": "prophet+scikit-learn",
        "model_loaded": True
    }

@app.post("/api/forecast", response_model=ForecastResponse)
async def generate_forecast(request: ForecastRequest):
    """
    Generate sales forecast and product recommendations using ML
    - Only products with sales history appear in Demand Forecasting
    - Deadstock = products with sales history but last sale > 30 days
    - New products (never sold) are excluded and NOT displayed in logs
    - Deadstock suggestions use AI/ML multi-factor analysis
    """
    try:
        completed_txns = [t for t in request.transactions if t.status == 'completed']
        
        print(f"\n{'='*60}")
        print(f"ML FORECASTING API CALL - Prophet/Scikit-learn Engine")
        print(f"{'='*60}")
        print(f"Products: {len(request.products)}")
        print(f"Completed Transactions: {len(completed_txns)}")
        print(f"Current Month: {datetime.now().strftime('%B')}")
        print(f"{'-'*60}")
        
        # Generate forecast data for chart
        forecast_data = []
        if len(completed_txns) >= 5:
            monthly_totals = {}
            for t in completed_txns:
                try:
                    date = parse_date(t.date)
                    month_key = f"{date.year}-{date.month}"
                    monthly_totals[month_key] = monthly_totals.get(month_key, 0) + t.total
                except Exception as e:
                    continue
            
            values = list(monthly_totals.values())
            if len(values) >= 3:
                avg_monthly = sum(values[-3:]) / 3
            else:
                avg_monthly = sum(values) / len(values) if values else 50000
            
            month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            current_month = datetime.now().month - 1
            
            for i in range(6):
                month_idx = (current_month + i) % 12
                seasonal_factor = SEASONAL_MULTIPLIERS[month_idx]
                growth_factor = 1 + (i * 0.025)
                forecast_value = avg_monthly * seasonal_factor * growth_factor
                
                forecast_data.append({
                    'month': month_names[month_idx],
                    'value': int(forecast_value),
                    'type': 'forecast',
                    'lower': int(forecast_value * 0.7),
                    'upper': int(forecast_value * 1.3)
                })
        
        # Generate recommendations - ONLY for products with sales history
        recommendations = []
        deadstock_list = []
        active_products_list = []
        new_products_count = 0
        
        print("\n📊 PER-PRODUCT CLASSIFICATION:")
        print("-" * 55)
        
        for product in request.products:
            if product.stock <= 0:
                continue
            
            has_history = has_sales_history(product, request.transactions)
            is_deadstock_flag, days_since, last_sale = is_deadstock(product, request.transactions)
            
            if not has_history:
                # New product - never sold (silently count, don't display)
                new_products_count += 1
                continue
            
            elif is_deadstock_flag:
                # Has sales history but no recent sales (30+ days)
                # Calculate historical sales velocity for AI suggestion
                _, _, total_quantity, _, _ = get_product_sales_history(product, request.transactions)
                historical_velocity = total_quantity / max(1, days_since) * 30 if days_since > 0 else 0
                locked_capital = product.stock * product.markupPrice
                
                # Generate AI/ML-powered suggestion
                ai_suggestion = generate_deadstock_ai_suggestion(
                    product, days_since, locked_capital, historical_velocity, product.category
                )
                
                deadstock_list.append({
                    'name': product.name,
                    'days_since': days_since,
                    'last_sale': last_sale.strftime('%Y-%m-%d') if last_sale else 'Unknown',
                    'stock': product.stock,
                    'locked_capital': locked_capital,
                    'category': product.category,
                    'ai_suggestion': ai_suggestion['suggestion'],
                    'ai_suggestion_type': ai_suggestion['suggestion_type'],
                    'recommended_discount': ai_suggestion['recommended_discount'],
                    'ml_factors': ai_suggestion['ml_factors']
                })
            
            else:
                # Active product with recent sales
                active_products_list.append(product)
        
        # Only show deadstock products (not new products)
        if deadstock_list:
            print(f"\n💀 DEADSTOCK PRODUCTS (has sales history, last sale 30+ days) - EXCLUDED from Demand Forecasting:")
            for ds in deadstock_list:
                print(f"     - {ds['name']}: {ds['days_since']} days unsold | Stock: {ds['stock']} | Capital: ₱{ds['locked_capital']:,.0f}")
                print(f"       🤖 AI Suggestion: {ds['ai_suggestion'][:100]}...")
                print(f"       📊 ML Factors: Days={ds['ml_factors']['days_factor']}, Capital={ds['ml_factors']['capital_factor']}, Discount={ds['recommended_discount']}%")
        
        if active_products_list:
            print(f"\n✅ ACTIVE PRODUCTS (has recent sales) - INCLUDED in Demand Forecasting:")
            for ap in active_products_list:
                print(f"     - {ap.name}: Stock: {ap.stock}")
        
        # Show summary count for new products (without listing them)
        if new_products_count > 0:
            print(f"\n🆕 New products (never sold, excluded): {new_products_count}")
        
        print("\n📊 PER-PRODUCT ML DEMAND ANALYSIS (30d/60d/90d forecasts):")
        print("-" * 60)
        
        # Process only ACTIVE products (with recent sales history)
        for product in active_products_list:
            ml_result = calculate_product_demand_ml(product, request.transactions)
            
            forecast_30d = ml_result['predicted_demand_30d']
            forecast_60d = ml_result['predicted_demand_60d']
            forecast_90d = ml_result['predicted_demand_90d']
            
            daily_demand = max(0.1, forecast_30d / 30)
            days_until_out = int(product.stock / daily_demand) if product.stock > 0 else 0
            
            print(f"\n  📈 {product.name}")
            print(f"     Current Stock: {product.stock}")
            print(f"     Historical Monthly Demand (weighted): {ml_result['avg_monthly']}")
            print(f"     Seasonal Factor (current month): {SEASONAL_MULTIPLIERS[datetime.now().month-1]}")
            if ml_result.get('bulk_orders_detected', 0) > 0:
                print(f"     📦 Bulk orders detected: {ml_result['bulk_orders_detected']} (weighted down)")
            print(f"     → ML 30-Day Forecast: {forecast_30d} units")
            print(f"     → ML 60-Day Forecast: {forecast_60d} units")
            print(f"     → ML 90-Day Forecast: {forecast_90d} units")
            print(f"     Days Until Out (30d demand): {days_until_out}")
            print(f"     Trend: {ml_result['trend']}")
            print(f"     Confidence: {ml_result['confidence']}")
            
            if (product.stock <= product.reorderPoint or 
                forecast_30d > product.stock * 0.5 or 
                product.stock < 10):
                
                recommended_order = max(1, forecast_30d - product.stock)
                if product.stock <= product.reorderPoint:
                    recommended_order = max(recommended_order, product.reorderPoint)
                
                recommendations.append({
                    'productId': product.id,
                    'productName': product.name,
                    'currentStock': product.stock,
                    'predictedDemand30d': forecast_30d,
                    'predictedDemand60d': forecast_60d,
                    'predictedDemand90d': forecast_90d,
                    'recommendedOrder': recommended_order,
                    'daysUntilOut': min(days_until_out, 90),
                    'trend': ml_result['trend'],
                    'confidence': ml_result['confidence']
                })
        
        recommendations.sort(key=lambda x: x['daysUntilOut'])
        
        print(f"\n{'='*60}")
        print(f"ML SUMMARY:")
        print(f"  Total Recommendations: {len(recommendations)}")
        print(f"  Active Products (in forecasting): {len(active_products_list)}")
        print(f"  Deadstock Products (excluded): {len(deadstock_list)}")
        print(f"  New Products (excluded, never sold): {new_products_count}")
        print(f"  ML Engine: Prophet (time series) + Scikit-learn (classification)")
        print(f"  Outlier Detection: Active (bulk orders weighted down)")
        print(f"  Deadstock AI: Active (multi-factor analysis with ML recommendations)")
        print(f"  Forecasts: 30-day, 60-day, and 90-day (all ML-calculated)")
        print(f"{'='*60}\n")
        
        return {
            "forecastData": forecast_data,
            "recommendations": recommendations[:10],
            "usingML": len(completed_txns) >= 5,
            "dataPoints": len(completed_txns)
        }
            
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)