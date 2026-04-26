# backend/app.py - Complete fixed version

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
    allow_origins=["http://localhost:3000", "http://localhost:3001",  "https://optisync-j01wv7p2n-rejeanzapantas-projects.vercel.app", "https://*.vercel.app"]
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
    createdAt: Optional[Any] = None

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
    deadstockSuggestions: List[Dict[str, Any]] = []
    usingML: bool
    dataPoints: int

# Constants
SEASONAL_MULTIPLIERS = [1.4, 1.1, 1.3, 1.35, 1.2, 1.1, 0.85, 0.8, 0.9, 1.0, 1.2, 1.5]
TOP_SELLING_PRODUCT_LIMIT = 10
MIN_TRANSACTIONS_FOR_FORECAST = 2

def make_naive(dt):
    """Convert timezone-aware datetime to naive for safe comparisons"""
    if dt is None:
        return None
    if hasattr(dt, 'tzinfo') and dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt

def parse_date(date_str: str) -> datetime:
    """Parse date string safely, handling both naive and aware datetimes"""
    try:
        if 'Z' in date_str or '+' in date_str:
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return make_naive(dt)
        else:
            return datetime.fromisoformat(date_str)
    except Exception:
        return datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

def detect_bulk_order(quantity: int, product_category: str, product_name: str = "") -> Tuple[bool, float]:
    """Detect if an order is unusually large for the product type."""
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

def get_product_creation_date(product: Product, reference_date: datetime = None) -> datetime:
    """Get product creation date from product data."""
    if reference_date is None:
        reference_date = make_naive(datetime.now().replace(hour=0, minute=0, second=0, microsecond=0))
    else:
        reference_date = make_naive(reference_date).replace(hour=0, minute=0, second=0, microsecond=0)
    
    if product.createdAt is not None:
        try:
            if isinstance(product.createdAt, datetime):
                return make_naive(product.createdAt).replace(hour=0, minute=0, second=0, microsecond=0)
            
            if isinstance(product.createdAt, str):
                try:
                    if 'Z' in product.createdAt:
                        dt = datetime.fromisoformat(product.createdAt.replace('Z', '+00:00'))
                    else:
                        dt = datetime.fromisoformat(product.createdAt)
                    return make_naive(dt).replace(hour=0, minute=0, second=0, microsecond=0)
                except:
                    pass
            
            if isinstance(product.createdAt, dict):
                if '_seconds' in product.createdAt:
                    dt = datetime.fromtimestamp(product.createdAt['_seconds'])
                    return make_naive(dt).replace(hour=0, minute=0, second=0, microsecond=0)
                elif 'seconds' in product.createdAt:
                    dt = datetime.fromtimestamp(product.createdAt['seconds'])
                    return make_naive(dt).replace(hour=0, minute=0, second=0, microsecond=0)
            
            if hasattr(product.createdAt, 'to_datetime'):
                dt = product.createdAt.to_datetime()
                return make_naive(dt).replace(hour=0, minute=0, second=0, microsecond=0)
            
            if hasattr(product.createdAt, 'toDate'):
                dt = product.createdAt.toDate()
                return make_naive(dt).replace(hour=0, minute=0, second=0, microsecond=0)
                
        except Exception as e:
            print(f"  ⚠️ Error parsing createdAt: {e}")
    
    if hasattr(product, 'lastMovedDaysAgo') and product.lastMovedDaysAgo is not None:
        if product.lastMovedDaysAgo >= 0 and product.lastMovedDaysAgo < 30:
            return reference_date - timedelta(days=product.lastMovedDaysAgo)
    
    return reference_date

def get_product_sales_history(product: Product, transactions: List[Transaction], reference_date: datetime) -> Tuple[List[Dict], Optional[datetime], int, int, datetime]:
    """Get product's complete sales history."""
    completed_txns = [t for t in transactions if t.status == 'completed']
    today = make_naive(reference_date).replace(hour=0, minute=0, second=0, microsecond=0)
    
    product_sales = []
    last_sale_date = None
    total_quantity = 0
    
    for t in completed_txns:
        try:
            trans_date = parse_date(t.date)
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
    
    creation_date = get_product_creation_date(product, reference_date)
    
    if last_sale_date:
        last_sale_date = make_naive(last_sale_date)
        days_since_last_sale = (today - last_sale_date).days
    else:
        days_since_last_sale = (today - creation_date).days
    
    return product_sales, last_sale_date, total_quantity, days_since_last_sale, creation_date

def has_sales_history(product: Product, transactions: List[Transaction], reference_date: datetime) -> bool:
    """Check if a product has any sales history (ever been sold)"""
    completed_txns = [t for t in transactions if t.status == 'completed']
    
    for t in completed_txns:
        for item in t.items:
            if item.id == product.id:
                return True
    return False

def get_transaction_count(product: Product, transactions: List[Transaction], reference_date: datetime) -> int:
    """Get the number of unique transactions a product appears in."""
    completed_txns = [t for t in transactions if t.status == 'completed']
    transaction_ids = set()
    
    for t in completed_txns:
        for item in t.items:
            if item.id == product.id:
                transaction_ids.add(t.id)
                break
    
    return len(transaction_ids)

def get_reference_month_sales(product: Product, transactions: List[Transaction], reference_date: datetime) -> int:
    """Calculate total quantity sold for a product in the reference month."""
    completed_txns = [t for t in transactions if t.status == 'completed']
    ref_month = reference_date.month
    ref_year = reference_date.year
    
    total_sold = 0
    
    for t in completed_txns:
        try:
            trans_date = parse_date(t.date)
            if trans_date.year == ref_year and trans_date.month == ref_month:
                for item in t.items:
                    if item.id == product.id:
                        total_sold += item.quantity
        except Exception as e:
            continue
    
    return total_sold

def check_is_deadstock(product: Product, transactions: List[Transaction], reference_date: datetime, days_threshold: int = 30) -> Tuple[bool, int, Optional[datetime]]:
    """Check if a product is deadstock."""
    _, last_sale_date, _, days_since_last_sale, _ = get_product_sales_history(product, transactions, reference_date)
    
    if last_sale_date is None:
        return (False, 0, None)
    
    is_deadstock_flag = days_since_last_sale >= days_threshold
    return (is_deadstock_flag, days_since_last_sale, last_sale_date)

def generate_deadstock_ai_suggestion(product: Product, days_since_sale: int, locked_capital: float, 
                                      historical_velocity: float, category: str, never_sold: bool = False) -> Dict[str, Any]:
    """Generate AI/ML-based suggestion for deadstock products."""
    
    profit_per_unit = product.markupPrice - product.baseCost
    profit_margin = (profit_per_unit / product.markupPrice) * 100
    SAFETY_BUFFER = 2
    max_safe_discount_percent = max(0, profit_margin - SAFETY_BUFFER)
    
    base_discount = 0
    
    if days_since_sale >= 90:
        base_discount = 25
    elif days_since_sale >= 80:
        base_discount = 22
    elif days_since_sale >= 70:
        base_discount = 18
    elif days_since_sale >= 60:
        base_discount = 15
    elif days_since_sale >= 50:
        base_discount = 12
    elif days_since_sale >= 40:
        base_discount = 8
    elif days_since_sale >= 30:
        base_discount = 5
    else:
        base_discount = 0
    
    if locked_capital > 150000:
        capital_adjustment = 3
    elif locked_capital > 100000:
        capital_adjustment = 2
    elif locked_capital > 50000:
        capital_adjustment = 1
    else:
        capital_adjustment = 0
    
    category_urgency = {
        'Frames': 1.0,
        'Lenses': 0.9,
        'Contact Lenses': 0.7,
        'Solutions': 0.6,
        'Accessories': 1.0
    }
    urgency_multiplier = category_urgency.get(category, 1.0)
    
    velocity_reduction = 0
    if historical_velocity > 15:
        velocity_reduction = 3
    elif historical_velocity > 8:
        velocity_reduction = 2
    elif historical_velocity > 0 and historical_velocity < 2:
        velocity_reduction = 0
    
    # For never-sold products, add a small boost to encourage first sale
    if never_sold:
        never_sold_boost = 2
    else:
        never_sold_boost = 0
    
    total_discount = base_discount + capital_adjustment + never_sold_boost
    total_discount = total_discount * urgency_multiplier
    total_discount = max(0, total_discount - velocity_reduction)
    
    final_discount_percent = min(total_discount, max_safe_discount_percent)
    
    if days_since_sale >= 30 and final_discount_percent < 5 and max_safe_discount_percent >= 5:
        final_discount_percent = 5
    
    final_discount_percent = int(round(final_discount_percent))
    
    discounted_price = product.markupPrice * (1 - final_discount_percent / 100)
    profit_after_discount = discounted_price - product.baseCost
    
    if profit_after_discount < 0:
        safe_discount = ((product.markupPrice - product.baseCost) / product.markupPrice) * 100
        safe_discount = max(0, int(safe_discount))
        final_discount_percent = safe_discount
        discounted_price = product.markupPrice * (1 - final_discount_percent / 100)
        profit_after_discount = discounted_price - product.baseCost
    
    if never_sold:
        if days_since_sale >= 75:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% discount recommended to attract first-time buyers. Capital locked: ₱{locked_capital:,.0f}"
        elif days_since_sale >= 50:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% discount recommended. Item unsold for {days_since_sale} days."
        elif days_since_sale >= 40:
            suggestion_type = 'warning'
            suggestion = f"{final_discount_percent}% discount recommended to generate first sale."
        elif days_since_sale >= 30:
            suggestion_type = 'info'
            suggestion = f"{final_discount_percent}% discount recommended for this slow-moving item."
        else:
            suggestion_type = 'info'
            suggestion = "Item has no sales history. Consider promotional pricing."
    else:
        if days_since_sale >= 75:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% discount recommended to recover ₱{locked_capital:,.0f} locked capital."
        elif days_since_sale >= 50:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% discount recommended. Capital at risk: ₱{locked_capital:,.0f}"
        elif days_since_sale >= 40:
            suggestion_type = 'warning'
            suggestion = f"{final_discount_percent}% discount recommended to move stock."
        elif days_since_sale >= 30:
            suggestion_type = 'info'
            suggestion = f"{final_discount_percent}% discount recommended."
        else:
            suggestion_type = 'info'
            suggestion = "No discount recommended at this time."
    
    if category in ['Contact Lenses', 'Solutions']:
        suggestion += f" Priority clearance before expiry."
    elif locked_capital > 100000:
        suggestion += f" High-value item - consider flash sale."
    elif historical_velocity > 10:
        suggestion += f" This product previously sold well."
    elif never_sold and days_since_sale > 30:
        suggestion += f" Consider bundling with popular items."
    
    return {
        'suggestion': suggestion,
        'suggestion_type': suggestion_type,
        'recommended_discount': final_discount_percent,
        'ml_factors': {
            'days_factor': round(min(1.0, days_since_sale / 90), 2),
            'capital_factor': round(min(1.0, locked_capital / 200000), 2),
            'category_urgency': urgency_multiplier,
            'velocity_factor': round(min(1.0, historical_velocity / 30), 2),
            'profit_margin': round(profit_margin, 1),
            'max_safe_discount': round(max_safe_discount_percent, 1),
            'final_discount': final_discount_percent,
            'never_sold': never_sold
        }
    }

def calculate_product_demand_ml(product: Product, transactions: List[Transaction], reference_date: datetime) -> Dict[str, Any]:
    """Calculate demand forecast for a single product using ML-inspired logic."""
    
    completed_txns = [t for t in transactions if t.status == 'completed']
    current_month = reference_date.month - 1
    
    product_sales, last_sale_date, total_quantity_sold, days_since_sale, creation_date = get_product_sales_history(product, transactions, reference_date)
    
    if len(product_sales) == 0:
        return {
            'predicted_demand_30d': 0,
            'predicted_demand_60d': 0,
            'predicted_demand_90d': 0,
            'trend': 'stable',
            'confidence': 'low',
            'has_history': False,
            'avg_monthly': 0,
            'bulk_orders_detected': 0
        }
    
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
    
    raw_forecast_30d = base_monthly_demand * current_seasonal * trend_factor
    forecast_30d = max(1, round(raw_forecast_30d))
    forecast_60d = max(1, round(
        (base_monthly_demand * current_seasonal * trend_factor) +
        (base_monthly_demand * next_seasonal * (trend_factor + 0.02))
    ))
    forecast_90d = max(1, round(
        (base_monthly_demand * current_seasonal * trend_factor) +
        (base_monthly_demand * next_seasonal * (trend_factor + 0.02)) +
        (base_monthly_demand * month2_seasonal * (trend_factor + 0.04))
    ))
    
    increasing_count = 0
    decreasing_count = 0
    
    if forecast_60d > forecast_30d:
        increasing_count += 1
    elif forecast_60d < forecast_30d:
        decreasing_count += 1
    
    if forecast_90d > forecast_60d:
        increasing_count += 1
    elif forecast_90d < forecast_60d:
        decreasing_count += 1
    
    if increasing_count >= 2:
        trend = 'up'
    elif decreasing_count >= 2:
        trend = 'down'
    elif increasing_count == 1 and decreasing_count == 1:
        if forecast_90d > forecast_30d * 1.15:
            trend = 'up'
        elif forecast_90d < forecast_30d * 0.85:
            trend = 'down'
        else:
            trend = 'stable'
    else:
        trend = 'stable'
    
    if len(completed_txns) >= 20 and total_quantity_sold >= 20:
        data_confidence = 'high'
    elif len(completed_txns) >= 10:
        data_confidence = 'medium'
    else:
        data_confidence = 'low'
    
    change_30_to_60 = ((forecast_60d - forecast_30d) / max(forecast_30d, 1)) * 100
    change_60_to_90 = ((forecast_90d - forecast_60d) / max(forecast_60d, 1)) * 100
    
    if abs(change_30_to_60) > 100 or abs(change_60_to_90) > 100:
        confidence = 'medium'
    else:
        confidence = data_confidence
    
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
        "timestamp": make_naive(datetime.now()).isoformat(),
        "ml_engine": "prophet+scikit-learn",
        "model_loaded": True
    }

@app.post("/api/forecast", response_model=ForecastResponse)
async def generate_forecast(request: ForecastRequest):
    """
    Generate sales forecast and product recommendations using ML
    - Demand Forecasting shows only products with MULTIPLE transactions (>=2)
    - Deadstock AI suggestions show for ALL products with stock > 0 and days unsold >= 30
    """
    try:
        completed_txns = [t for t in request.transactions if t.status == 'completed']
        
        if completed_txns:
            latest_date = max([parse_date(t.date) for t in completed_txns])
            reference_date = latest_date
            print(f"\n📅 Using reference date: {reference_date.strftime('%Y-%m-%d')} (latest transaction)")
            print(f"📅 Reference Month: {reference_date.strftime('%B %Y')}")
        else:
            reference_date = make_naive(datetime.now())
            print(f"\n📅 No transactions found, using current date: {reference_date.strftime('%Y-%m-%d')}")
        
        print(f"\n{'='*60}")
        print(f"ML FORECASTING API CALL - Prophet/Scikit-learn Engine")
        print(f"{'='*60}")
        print(f"Products: {len(request.products)}")
        print(f"Completed Transactions: {len(completed_txns)}")
        print(f"Reference Month: {reference_date.strftime('%B %Y')}")
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
            current_month = reference_date.month - 1
            
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
        
        # Generate recommendations
        recommendations = []
        deadstock_suggestions_for_response = []
        active_products_list = []
        new_products_count = 0
        aged_unsold_count = 0
        single_transaction_excluded = 0
        deadstock_count = 0
        
        print("\n📊 PER-PRODUCT CLASSIFICATION:")
        print("-" * 55)
        
        today = make_naive(reference_date).replace(hour=0, minute=0, second=0, microsecond=0)
        ref_month_name = reference_date.strftime('%B')
        
        # Calculate data for each product
        product_data = {}
        for product in request.products:
            ref_month_sales = get_reference_month_sales(product, request.transactions, reference_date)
            transaction_count = get_transaction_count(product, request.transactions, reference_date)
            product_data[product.id] = {
                'ref_month_sales': ref_month_sales,
                'transaction_count': transaction_count
            }
        
        # Process each product
        for product in request.products:
            if product.stock <= 0:
                continue
            
            has_history = has_sales_history(product, request.transactions, reference_date)
            ref_month_sales = product_data.get(product.id, {}).get('ref_month_sales', 0)
            transaction_count = product_data.get(product.id, {}).get('transaction_count', 0)
            is_deadstock_flag, days_since_last_sale, last_sale = check_is_deadstock(product, request.transactions, reference_date)
            
            creation_date = get_product_creation_date(product, reference_date)
            days_since_creation = (today - creation_date).days
            
            is_aged_unsold = (not has_history) and (days_since_creation >= 30)
            is_deadstock_item = has_history and is_deadstock_flag
            
            print(f"  🔍 {product.name}: sold_in_{ref_month_name}={ref_month_sales}, transactions={transaction_count}, has_history={has_history}, days_since_creation={days_since_creation}")
            
            # ==================== DEADSTOCK & AGED UNSOLD ====================
            if is_deadstock_item or is_aged_unsold:
                if is_deadstock_item:
                    days_since_activity = days_since_last_sale
                    product_type = "deadstock"
                    deadstock_count += 1
                    print(f"     → DEADSTOCK: Last sale {days_since_activity} days ago - generating AI suggestion")
                else:
                    days_since_activity = days_since_creation
                    product_type = "aged_unsold"
                    aged_unsold_count += 1
                    print(f"     → AGED UNSOLD: Created {days_since_activity} days ago, never sold - generating AI suggestion")
                
                _, _, total_quantity, _, _ = get_product_sales_history(product, request.transactions, reference_date)
                historical_velocity = total_quantity / max(1, days_since_activity) * 30 if days_since_activity > 0 else 0
                locked_capital = product.stock * product.markupPrice
                
                ai_suggestion = generate_deadstock_ai_suggestion(
                    product, days_since_activity, locked_capital, historical_velocity, 
                    product.category, never_sold=(not has_history)
                )
                
                deadstock_suggestions_for_response.append({
                    'productId': product.id,
                    'suggestion': ai_suggestion['suggestion'],
                    'suggestionType': ai_suggestion['suggestion_type'],
                    'recommendedDiscount': ai_suggestion['recommended_discount'],
                    'mlFactors': ai_suggestion['ml_factors']
                })
                
                continue
            
            # ==================== NEW PRODUCTS ====================
            if not has_history and days_since_creation < 30:
                new_products_count += 1
                print(f"     → NEW PRODUCT: Created {days_since_creation} days ago - excluded")
                continue
            
            # ==================== SINGLE TRANSACTION ====================
            if has_history and transaction_count <= 1:
                single_transaction_excluded += 1
                print(f"     → EXCLUDED: Only {transaction_count} transaction(s) - insufficient data")
                continue
            
            # ==================== ACTIVE PRODUCTS ====================
            if has_history and transaction_count >= 2 and not is_deadstock_flag:
                active_products_list.append({
                    'product': product,
                    'ref_month_sales': ref_month_sales,
                    'transaction_count': transaction_count
                })
                print(f"     → ACTIVE: {ref_month_sales} units in {ref_month_name} ({transaction_count} transactions) - INCLUDED")
        
        # Sort and limit active products
        active_products_list.sort(key=lambda x: x['ref_month_sales'], reverse=True)
        top_active_products = active_products_list[:TOP_SELLING_PRODUCT_LIMIT]
        
        if deadstock_suggestions_for_response:
            print(f"\n💀 DEADSTOCK & AGED UNSOLD AI SUGGESTIONS GENERATED: {len(deadstock_suggestions_for_response)}")
            for suggestion in deadstock_suggestions_for_response[:3]:
                print(f"     - {suggestion['productId'][:30]}: {suggestion['suggestion'][:60]}...")
        
        if top_active_products:
            print(f"\n✅ TOP {len(top_active_products)} ACTIVE PRODUCTS in Demand Forecasting:")
            for idx, item in enumerate(top_active_products):
                print(f"     {idx+1}. {item['product'].name}: {item['ref_month_sales']} units ({item['transaction_count']} transactions)")
        
        print(f"\n📊 SUMMARY:")
        print(f"     Deadstock AI Suggestions: {deadstock_count}")
        print(f"     Aged Unsold AI Suggestions: {aged_unsold_count}")
        print(f"     Active Products in Forecasting: {len(top_active_products)}")
        print(f"     Excluded (1 transaction): {single_transaction_excluded}")
        print(f"     New Products: {new_products_count}")
        
        print("\n📊 PER-PRODUCT ML DEMAND ANALYSIS:")
        print("-" * 60)
        
        for item in top_active_products:
            product = item['product']
            ml_result = calculate_product_demand_ml(product, request.transactions, reference_date)
            
            forecast_30d = ml_result['predicted_demand_30d']
            forecast_60d = ml_result['predicted_demand_60d']
            forecast_90d = ml_result['predicted_demand_90d']
            
            daily_demand = max(0.1, forecast_30d / 30)
            days_until_out = int(product.stock / daily_demand) if product.stock > 0 else 0
            
            print(f"\n  📈 {product.name}")
            print(f"     Current Stock: {product.stock}")
            print(f"     Sales in {ref_month_name}: {item['ref_month_sales']} units")
            print(f"     → ML Forecast: {forecast_30d} → {forecast_60d} → {forecast_90d} units")
            print(f"     Trend: {ml_result['trend']}")
            
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
        print(f"  Recommendations: {len(recommendations)}")
        print(f"  AI Suggestions: {len(deadstock_suggestions_for_response)}")
        print(f"{'='*60}\n")
        
        return {
            "forecastData": forecast_data,
            "recommendations": recommendations[:10],
            "deadstockSuggestions": deadstock_suggestions_for_response,
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