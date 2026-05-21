# backend/app.py - Complete with proper stockout date calculation

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
import warnings
import asyncio
warnings.filterwarnings('ignore')

# Suppress cmdstanpy and prophet warnings
os.environ['CMDSTANPY_DISABLE_CACHE'] = '1'
os.environ['PROPHET_VERBOSE'] = '0'

# Import Prophet with warning suppression
import logging
logging.getLogger('cmdstanpy').setLevel(logging.ERROR)
logging.getLogger('prophet').setLevel(logging.ERROR)

from prophet import Prophet
from prophet.make_holidays import make_holidays_df

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
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://optisync-ivory.vercel.app",
        "https://*.vercel.app"
    ],
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

# ==================== CACHING SYSTEM ====================
class ForecastCache:
    """In-memory cache for forecast results with request deduplication"""
    def __init__(self):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.pending_requests: Dict[str, asyncio.Event] = {}
        self.cache_ttl = 60 * 60  # 1 hour
    
    def get_cache_key(self, products: List[Product], transactions: List[Transaction]) -> str:
        """Generate a cache key based on products and transactions"""
        products_hash = hashlib.md5(
            json.dumps([(p.id, p.stock) for p in products], sort_keys=True).encode()
        ).hexdigest()[:8]
        
        transactions_hash = hashlib.md5(
            json.dumps([t.id for t in transactions], sort_keys=True).encode()
        ).hexdigest()[:8]
        
        return f"forecast_{products_hash}_{transactions_hash}"
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached forecast if still valid"""
        if key in self.cache:
            cached_data = self.cache[key]
            age = (datetime.now(timezone.utc).timestamp() - cached_data['timestamp']) / 60
            
            if age < self.cache_ttl / 60:  # Not expired
                print(f"✅ CACHE HIT: Returning cached forecast (age: {int(age)}m)")
                return cached_data['data']
            else:
                print(f"⏱️ CACHE EXPIRED: Cached data is {int(age)}m old, refreshing...")
                del self.cache[key]
        
        return None
    
    def set(self, key: str, data: Dict[str, Any]) -> None:
        """Store forecast result in cache"""
        self.cache[key] = {
            'timestamp': datetime.now(timezone.utc).timestamp(),
            'data': data
        }
        print(f"💾 CACHE STORED: Forecast cached for next 30 minutes")
    
    def is_pending(self, key: str) -> bool:
        """Check if a forecast request is currently being processed"""
        return key in self.pending_requests
    
    def get_pending_event(self, key: str) -> asyncio.Event:
        """Get or create a pending event for request deduplication"""
        if key not in self.pending_requests:
            self.pending_requests[key] = asyncio.Event()
        return self.pending_requests[key]
    
    def mark_pending(self, key: str) -> None:
        """Mark a request as pending"""
        self.get_pending_event(key).clear()
    
    def mark_complete(self, key: str) -> None:
        """Mark a pending request as complete"""
        if key in self.pending_requests:
            self.pending_requests[key].set()
    
    def clear(self) -> None:
        """Clear all cached data"""
        self.cache.clear()
        self.pending_requests.clear()

forecast_cache = ForecastCache()

# Constants
SEASONAL_MULTIPLIERS = [1.4, 1.1, 1.3, 1.35, 1.2, 1.1, 0.85, 0.8, 0.9, 1.0, 1.2, 1.5]
TOP_SELLING_PRODUCT_LIMIT = 10

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
            trans_date = make_naive(trans_date)
            trans_date = trans_date.replace(hour=0, minute=0, second=0, microsecond=0)
            
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
    
    # Get product creation date
    creation_date = None
    
    if product.createdAt is not None:
        try:
            if isinstance(product.createdAt, datetime):
                creation_date = make_naive(product.createdAt)
            elif isinstance(product.createdAt, dict):
                if '_seconds' in product.createdAt:
                    creation_date = datetime.fromtimestamp(product.createdAt['_seconds'])
                elif 'seconds' in product.createdAt:
                    creation_date = datetime.fromtimestamp(product.createdAt['seconds'])
                if creation_date:
                    creation_date = make_naive(creation_date)
            elif hasattr(product.createdAt, 'to_datetime'):
                creation_date = make_naive(product.createdAt.to_datetime())
            elif hasattr(product.createdAt, 'toDate'):
                creation_date = make_naive(product.createdAt.toDate())
            elif isinstance(product.createdAt, (int, float)):
                creation_date = make_naive(datetime.fromtimestamp(product.createdAt))
            elif isinstance(product.createdAt, str):
                try:
                    dt = datetime.fromisoformat(product.createdAt.replace('Z', '+00:00'))
                    creation_date = make_naive(dt)
                except:
                    pass
        except Exception as e:
            print(f"  ⚠️ Error parsing createdAt for {product.name}: {e}")
    
    if creation_date is None:
        if product_sales:
            earliest_sale = min(sale['date'] for sale in product_sales)
            creation_date = make_naive(earliest_sale)
        else:
            creation_date = today
    
    creation_date = make_naive(creation_date).replace(hour=0, minute=0, second=0, microsecond=0)
    
    if last_sale_date:
        last_sale_date = make_naive(last_sale_date).replace(hour=0, minute=0, second=0, microsecond=0)
        days_since_last_sale = (today - last_sale_date).days
    else:
        days_since_last_sale = (today - creation_date).days if creation_date else 0
    
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

def generate_daily_sales_data(transactions: List[Transaction]) -> pd.DataFrame:
    """Generate daily aggregated sales data for Prophet model using ALL historical data."""
    completed_txns = [t for t in transactions if t.status == 'completed']
    
    if len(completed_txns) < 10:
        return pd.DataFrame()
    
    sales_by_date = {}
    
    for t in completed_txns:
        try:
            trans_date = parse_date(t.date)
            date_key = trans_date.strftime('%Y-%m-%d')
            total_items = sum(item.quantity for item in t.items)
            
            if date_key in sales_by_date:
                sales_by_date[date_key] += total_items
            else:
                sales_by_date[date_key] = total_items
        except:
            continue
    
    if not sales_by_date:
        return pd.DataFrame()
    
    # Find earliest and latest dates
    all_dates = [datetime.strptime(d, '%Y-%m-%d') for d in sales_by_date.keys()]
    earliest_date = min(all_dates)
    latest_date = max(all_dates)
    
    # Create continuous date range (includes ALL history: March + April)
    date_range = pd.date_range(start=earliest_date, end=latest_date, freq='D')
    
    # Build DataFrame with all dates
    df_data = []
    for date in date_range:
        date_key = date.strftime('%Y-%m-%d')
        count = sales_by_date.get(date_key, 0)
        df_data.append({'ds': date, 'y': count})
    
    df = pd.DataFrame(df_data)
    df['ds'] = pd.to_datetime(df['ds'])
    df = df.sort_values('ds')
    
    return df

def generate_product_daily_sales(product: Product, transactions: List[Transaction]) -> pd.DataFrame:
    """Generate daily sales data for a specific product using ALL historical data."""
    completed_txns = [t for t in transactions if t.status == 'completed']
    
    # Collect all sales by date
    sales_by_date = {}
    
    # Find the earliest transaction date for this product
    earliest_date = None
    latest_date = None
    
    for t in completed_txns:
        try:
            trans_date = parse_date(t.date)
            trans_date = trans_date.replace(hour=0, minute=0, second=0, microsecond=0)
            
            for item in t.items:
                if item.id == product.id:
                    date_key = trans_date.strftime('%Y-%m-%d')
                    if date_key in sales_by_date:
                        sales_by_date[date_key] += item.quantity
                    else:
                        sales_by_date[date_key] = item.quantity
                    
                    if earliest_date is None or trans_date < earliest_date:
                        earliest_date = trans_date
                    if latest_date is None or trans_date > latest_date:
                        latest_date = trans_date
        except:
            continue
    
    # If no sales found, return empty DataFrame
    if not sales_by_date:
        return pd.DataFrame()
    
    # Ensure earliest_date and latest_date are set
    if earliest_date is None:
        earliest_date = datetime.now() - timedelta(days=30)
    if latest_date is None:
        latest_date = datetime.now()
    
    # Create continuous date range from earliest sale to latest sale
    earliest_date = earliest_date.replace(hour=0, minute=0, second=0, microsecond=0)
    latest_date = latest_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    date_range = pd.date_range(start=earliest_date, end=latest_date, freq='D')
    
    # Build DataFrame with all dates (including days with zero sales)
    df_data = []
    for date in date_range:
        date_key = date.strftime('%Y-%m-%d')
        quantity = sales_by_date.get(date_key, 0)
        df_data.append({'ds': date, 'y': quantity})
    
    df = pd.DataFrame(df_data)
    df['ds'] = pd.to_datetime(df['ds'])
    df = df.sort_values('ds')
    
    non_zero_days = len([d for d in df_data if d['y'] > 0])
    print(f"     → Product has {len(df)} total days of history (from {earliest_date.strftime('%Y-%m-%d')} to {latest_date.strftime('%Y-%m-%d')})")
    print(f"     → Non-zero sales days: {non_zero_days}")
    
    return df

def generate_forecast_for_product(product: Product, transactions: List[Transaction]) -> Dict:
    """
    Generate demand forecast for a single product using Prophet.
    Uses ALL available historical data with proper stockout date calculation.
    """
    # Get daily sales for this product using ALL history
    df = generate_product_daily_sales(product, transactions)
    
    # Need at least 14 days of history for Prophet
    if df.empty or len(df) < 14:
        print(f"     → Insufficient data: only {len(df)} days of history")
        return {
            'predicted_demand_30d': None,
            'predicted_demand_60d': None,
            'predicted_demand_90d': None,
            'recommended_order': None,
            'days_until_out': None,
            'trend': None,
            'confidence': None,
            'has_enough_data': False,
            'data_points': len(df)
        }
    
    try:
        full_df = df.copy()
        
        non_zero_days = len(full_df[full_df['y'] > 0])
        
        # Lowered thresholds for March + April data (60 days, ~5-15 sales days)
        if non_zero_days < 5:
            print(f"     → Insufficient non-zero days: {non_zero_days} (need 5+)")
            return {
                'predicted_demand_30d': None,
                'predicted_demand_60d': None,
                'predicted_demand_90d': None,
                'recommended_order': None,
                'days_until_out': None,
                'trend': None,
                'confidence': None,
                'has_enough_data': False,
                'data_points': len(full_df),
                'non_zero_days': non_zero_days
            }
        
        # Need at least 30 total days for weekly pattern detection
        if len(full_df) < 30:
            print(f"     → Insufficient total days: {len(full_df)} (need 30+)")
            return {
                'predicted_demand_30d': None,
                'predicted_demand_60d': None,
                'predicted_demand_90d': None,
                'recommended_order': None,
                'days_until_out': None,
                'trend': None,
                'confidence': None,
                'has_enough_data': False,
                'data_points': len(full_df)
            }
        
        # Get Philippine holidays for better seasonality
        ph_holidays = make_holidays_df(
            year_list=list(range(full_df['ds'].min().year, full_df['ds'].max().year + 1)),
            country='PH'
        )
        
        # Initialize Prophet with lower seasonality for sparse data
        model = Prophet(
            yearly_seasonality=False,
            weekly_seasonality=True,
            daily_seasonality=False,
            seasonality_mode='additive',
            changepoint_prior_scale=0.5,
            seasonality_prior_scale=3.0,
            holidays_prior_scale=3.0,
            interval_width=0.8,
            holidays=ph_holidays
        )
        
        # Add monthly seasonality
        model.add_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=3,
            prior_scale=3.0
        )
        
        # Fit the model
        model.fit(full_df)
        
        # Create future dates for 90 days
        future = model.make_future_dataframe(periods=90, include_history=True)
        forecast = model.predict(future)
        
        # Get forecast for future dates only
        last_date = full_df['ds'].max()
        forecast_future = forecast[forecast['ds'] > last_date].copy()
        
        if forecast_future.empty or len(forecast_future) < 30:
            print(f"     → Prophet forecast returned empty")
            return {
                'predicted_demand_30d': None,
                'predicted_demand_60d': None,
                'predicted_demand_90d': None,
                'recommended_order': None,
                'days_until_out': None,
                'trend': None,
                'confidence': None,
                'has_enough_data': False,
                'data_points': len(full_df)
            }
        
        # Get daily forecast values for next 30 days
        daily_forecast = forecast_future['yhat'].values[:30]
        
        # Calculate total forecast demand for 30 days
        forecast_30d = max(1, round(daily_forecast.sum()))
        forecast_60d = max(1, round(forecast_future['yhat'].head(60).sum()))
        forecast_90d = max(1, round(forecast_future['yhat'].head(90).sum()))
        
        # ========== PROPER STOCKOUT DATE CALCULATION ==========
        current_stock = product.stock
        cumulative_demand = 0
        stockout_day = None
        days_until_out = 30
        
        # Print daily forecast for debugging
        print(f"     → Daily forecast values (first 10 days): {[round(d, 1) for d in daily_forecast[:10]]}")
        
        # Calculate when stock will run out based on daily forecast pattern
        for day, demand in enumerate(daily_forecast, start=1):
            cumulative_demand += demand
            if cumulative_demand >= current_stock:
                stockout_day = day
                days_until_out = day
                break
        
        # Calculate recommended order based on stockout date
        if stockout_day and stockout_day < 30:
            # Stock runs out before month end - need to order for remaining days
            remaining_demand = sum(daily_forecast[stockout_day:30])
            recommended_order = max(0, round(remaining_demand))
            
            # Add small safety buffer (10%) for delivery time
            if recommended_order > 0:
                recommended_order = int(recommended_order * 1.1)
            
            print(f"     → Stockout on day {stockout_day} of month")
            print(f"     → Remaining forecast after stockout: {remaining_demand:.1f} units")
            print(f"     → Recommended order: {recommended_order} units")
        else:
            # Stock lasts entire month
            recommended_order = 0
            print(f"     → Stock lasts entire month (no reorder needed)")
        
        # Cap recommended order to reasonable maximum
        max_reasonable_order = forecast_30d
        recommended_order = min(recommended_order, max_reasonable_order)
        recommended_order = max(0, recommended_order)
        
        # Determine trend from forecast slope
        if len(forecast_future) >= 60:
            first_30_avg = forecast_future['yhat'].head(30).mean()
            last_30_avg = forecast_future['yhat'].tail(30).mean()
            if last_30_avg > first_30_avg * 1.2:
                trend = 'up'
            elif last_30_avg < first_30_avg * 0.8:
                trend = 'down'
            else:
                trend = 'stable'
        else:
            trend = 'stable'
        
        confidence = 'high' if non_zero_days >= 15 else 'medium'
        
        print(f"     → Prophet Forecast: {forecast_30d} units (30d) | Trend: {trend} | Non-zero days: {non_zero_days}")
        print(f"     → Days until stockout: {days_until_out} | Order: {recommended_order} units")
        
        return {
            'predicted_demand_30d': forecast_30d,
            'predicted_demand_60d': forecast_60d,
            'predicted_demand_90d': forecast_90d,
            'recommended_order': recommended_order,
            'days_until_out': days_until_out,
            'trend': trend,
            'confidence': confidence,
            'has_enough_data': True,
            'data_points': len(full_df),
            'non_zero_days': non_zero_days
        }
        
    except Exception as e:
        print(f"     → Prophet error: {str(e)[:100]}")
        return {
            'predicted_demand_30d': None,
            'predicted_demand_60d': None,
            'predicted_demand_90d': None,
            'recommended_order': None,
            'days_until_out': None,
            'trend': None,
            'confidence': None,
            'has_enough_data': False,
            'data_points': 0,
            'error': str(e)[:100]
        }

def generate_overall_forecast_data(transactions: List[Transaction], reference_date: datetime) -> List[Dict]:
    """Generate the overall forecast chart data using Prophet with ALL historical data."""
    df = generate_daily_sales_data(transactions)
    
    if df.empty or len(df) < 14:
        print(f"     → Insufficient data for overall forecast: {len(df)} days")
        return []
    
    try:
        full_df = df.copy()
        
        non_zero_days = len(full_df[full_df['y'] > 0])
        
        if non_zero_days < 10:
            print(f"     → Insufficient non-zero days for overall forecast: {non_zero_days}")
            return []
        
        # Get Philippine holidays
        ph_holidays = make_holidays_df(
            year_list=list(range(full_df['ds'].min().year, full_df['ds'].max().year + 1)),
            country='PH'
        )
        
        # Initialize Prophet
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            seasonality_mode='multiplicative',
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10.0,
            holidays_prior_scale=10.0,
            interval_width=0.95,
            holidays=ph_holidays
        )
        
        # Add monthly seasonality
        model.add_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=5,
            prior_scale=5.0
        )
        
        model.fit(full_df)
        
        # Create future dates for 6 months
        future = model.make_future_dataframe(periods=180, include_history=True)
        forecast = model.predict(future)
        
        # Get future forecast only
        last_historical_date = full_df['ds'].max()
        future_forecast = forecast[forecast['ds'] > last_historical_date].copy()
        
        if future_forecast.empty:
            return []
        
        # Prepare forecast data for chart
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        current_month = reference_date.month - 1
        
        forecast_data = []
        
        # Aggregate by month for the next 6 months
        future_forecast['year_month'] = future_forecast['ds'].dt.strftime('%Y-%m')
        monthly_forecast = future_forecast.groupby('year_month').agg({
            'yhat': 'sum',
            'yhat_lower': 'sum',
            'yhat_upper': 'sum'
        }).reset_index()
        
        # Create forecast data points for the next 6 months
        for i in range(min(6, len(monthly_forecast))):
            month_idx = (current_month + i) % 12
            row = monthly_forecast.iloc[i]
            forecast_value = max(0, int(row['yhat']))
            lower = max(0, int(row['yhat_lower']))
            upper = max(0, int(row['yhat_upper']))
            
            forecast_data.append({
                'month': month_names[month_idx],
                'value': forecast_value,
                'type': 'forecast',
                'lower': lower,
                'upper': upper
            })
        
        return forecast_data
        
    except Exception as e:
        print(f"Error generating Prophet forecast: {str(e)}")
        return []

def generate_deadstock_ai_suggestion(product: Product, days_since_sale: int, locked_capital: float, 
                                      historical_velocity: float, category: str, never_sold: bool = False) -> Dict[str, Any]:
    """Generate AI/ML-based suggestion for deadstock products.
    
    Discount calculation based on days since last sale with additional factors:
    Base discount by days:
    - 30 days: 1%
    - 31-59 days: 1% to 5% (progressive)
    - 60 days: 5%
    - 61-89 days: 5% to 12% (progressive)
    - 90 days: 12%
    - 91-119 days: 12% to 18% (progressive)
    - 120 days: 18%
    - 121-149 days: 18% to 23% (progressive)
    - 150 days: 23%
    - 151-179 days: 23% to 27% (progressive)
    - 180 days: 27%
    - 181-209 days: 27% to 31% (progressive)
    - 210 days: 31%
    - 211-239 days: 31% to 34% (progressive)
    - 240 days: 34%
    - 241-269 days: 34% to 37% (progressive)
    - 270 days: 37%
    - 271-299 days: 37% to 39% (progressive)
    - 300 days: 39%
    - 301-329 days: 39% to 41% (progressive)
    - 330 days: 41%
    - 331-359 days: 41% to 42% (progressive)
    - 360+ days: 42% (maximum cap)
    
    Additional factors applied:
    - Capital adjustment: High-value inventory increases urgency
    - Category urgency: Perishable/seasonal items get higher multiplier
    - Velocity reduction: Fast-moving items historically reduce urgency
    - Never-sold boost: Items with no sales get additional discount pressure
    """
    
    # Calculate base discount based on days since sale with extended ranges
    if days_since_sale < 30:
        base_discount = 0
    elif days_since_sale <= 60:
        # 30-60 days: 1% to 5%
        base_discount = 1 + (days_since_sale - 30) * 0.133
    elif days_since_sale <= 90:
        # 61-90 days: 5% to 12%
        base_discount = 5 + (days_since_sale - 60) * 0.233
    elif days_since_sale <= 120:
        # 91-120 days: 12% to 18%
        base_discount = 12 + (days_since_sale - 90) * 0.2
    elif days_since_sale <= 150:
        # 121-150 days: 18% to 23%
        base_discount = 18 + (days_since_sale - 120) * 0.167
    elif days_since_sale <= 180:
        # 151-180 days: 23% to 27%
        base_discount = 23 + (days_since_sale - 150) * 0.133
    elif days_since_sale <= 210:
        # 181-210 days: 27% to 31%
        base_discount = 27 + (days_since_sale - 180) * 0.133
    elif days_since_sale <= 240:
        # 211-240 days: 31% to 34%
        base_discount = 31 + (days_since_sale - 210) * 0.1
    elif days_since_sale <= 270:
        # 241-270 days: 34% to 37%
        base_discount = 34 + (days_since_sale - 240) * 0.1
    elif days_since_sale <= 300:
        # 271-300 days: 37% to 39%
        base_discount = 37 + (days_since_sale - 270) * 0.067
    elif days_since_sale <= 330:
        # 301-330 days: 39% to 41%
        base_discount = 39 + (days_since_sale - 300) * 0.067
    elif days_since_sale <= 360:
        # 331-360 days: 41% to 42%
        base_discount = 41 + (days_since_sale - 330) * 0.033
    else:
        # 360+ days: 42% max (nearly clearance price)
        base_discount = 42
    
    # Apply capital adjustment - high-value inventory increases discount pressure (reduced impact)
    if locked_capital > 150000:
        capital_adjustment = 2
    elif locked_capital > 100000:
        capital_adjustment = 1.5
    elif locked_capital > 50000:
        capital_adjustment = 1
    else:
        capital_adjustment = 0
    
    # Apply category urgency multiplier
    category_urgency = {
        'Frames': 1.0, 'Lenses': 0.9, 'Contact Lenses': 0.7, 'Solutions': 0.6, 'Accessories': 1.0
    }
    urgency_multiplier = category_urgency.get(category, 1.0)
    
    # Apply velocity reduction - fast-moving items historically get less discount pressure
    velocity_reduction = 0
    if historical_velocity > 15:
        velocity_reduction = 1.5
    elif historical_velocity > 8:
        velocity_reduction = 0.75
    elif historical_velocity > 0 and historical_velocity < 2:
        velocity_reduction = 0
    
    # Never-sold boost - items with no sales history get additional pressure (reduced impact)
    never_sold_boost = 1.5 if never_sold else 0
    
    # Apply all factors with reduced multiplier for adjustments
    # Base discount drives the recommendation; adjustments have minimal impact
    total_discount = base_discount + ((capital_adjustment + never_sold_boost) * urgency_multiplier * 0.5)
    total_discount = max(0, total_discount - velocity_reduction)
    final_discount_percent = total_discount
    
    # Safety check: ensure discount doesn't exceed safe margin
    profit_per_unit = product.markupPrice - product.baseCost
    profit_margin = (profit_per_unit / product.markupPrice) * 100 if product.markupPrice > 0 else 0
    SAFETY_BUFFER = 2
    max_safe_discount_percent = max(0, profit_margin - SAFETY_BUFFER)
    
    # Cap discount at safe level
    final_discount_percent = min(final_discount_percent, max_safe_discount_percent)
    final_discount_percent = round(final_discount_percent * 10) / 10
    final_discount_percent = int(round(final_discount_percent))
    
    # Generate contextual suggestion message
    if never_sold:
        if days_since_sale >= 180:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% discount recommended - critical clearance. Item unsold for {days_since_sale} days. Capital locked: ₱{locked_capital:,.0f}"
        elif days_since_sale >= 120:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% discount recommended to attract first-time buyers. Item unsold for {days_since_sale} days."
        elif days_since_sale >= 60:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% discount recommended. Item unsold for {days_since_sale} days."
        elif days_since_sale >= 30:
            suggestion_type = 'warning'
            suggestion = f"{final_discount_percent}% discount recommended to generate first sale."
        else:
            suggestion_type = 'info'
            suggestion = "Item has no sales history. Consider promotional pricing."
    else:
        if days_since_sale >= 270:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% URGENT clearance discount needed. Item deadstocked for {days_since_sale} days. Capital at risk: ₱{locked_capital:,.0f}"
        elif days_since_sale >= 180:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% discount recommended for critical clearance. {days_since_sale} days without sales. Capital locked: ₱{locked_capital:,.0f}"
        elif days_since_sale >= 120:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% discount recommended to recover ₱{locked_capital:,.0f} locked capital."
        elif days_since_sale >= 60:
            suggestion_type = 'critical'
            suggestion = f"{final_discount_percent}% discount recommended. Capital at risk: ₱{locked_capital:,.0f}"
        elif days_since_sale >= 30:
            suggestion_type = 'info'
            suggestion = f"{final_discount_percent}% discount recommended to move stagnant stock."
        else:
            suggestion_type = 'info'
            suggestion = "No discount recommended at this time."
    
    # Add category-specific suggestions
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
            'base_discount': round(base_discount, 1),
            'capital_factor': round(min(1.0, locked_capital / 200000), 2),
            'capital_adjustment': capital_adjustment,
            'category_urgency': round(urgency_multiplier, 2),
            'velocity_reduction': velocity_reduction,
            'never_sold_boost': never_sold_boost,
            'profit_margin': round(profit_margin, 1),
            'max_safe_discount': round(max_safe_discount_percent, 1),
            'final_discount': final_discount_percent,
            'never_sold': never_sold,
            'locked_capital': round(locked_capital, 0),
            'historical_velocity': round(historical_velocity, 2)
        }
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
    Generate sales forecast and product recommendations using Prophet ML model.
    Uses ALL historical data with proper stockout date calculation.
    Implements caching and request deduplication for performance.
    """
    try:
        # Check cache first
        cache_key = forecast_cache.get_cache_key(request.products, request.transactions)
        
        # Try to get from cache
        cached_result = forecast_cache.get(cache_key)
        if cached_result:
            return cached_result
        
        # Check if another request is already calculating this forecast
        if forecast_cache.is_pending(cache_key):
            print(f"⏳ DUPLICATE REQUEST: Waiting for ongoing forecast calculation...")
            pending_event = forecast_cache.get_pending_event(cache_key)
            
            # Wait up to 60 seconds for the pending request to complete
            try:
                await asyncio.wait_for(asyncio.to_thread(pending_event.wait), timeout=60)
                
                # After pending request completes, try cache again
                cached_result = forecast_cache.get(cache_key)
                if cached_result:
                    print(f"✅ Got result from pending request via cache")
                    return cached_result
            except asyncio.TimeoutError:
                print(f"⚠️ Pending request timeout, proceeding with new calculation")
        
        # Mark this request as pending
        forecast_cache.mark_pending(cache_key)
        
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
        print(f"ML FORECASTING API CALL - Prophet Engine")
        print(f"{'='*60}")
        print(f"Products: {len(request.products)}")
        print(f"Completed Transactions: {len(completed_txns)}")
        print(f"Reference Month: {reference_date.strftime('%B %Y')}")
        print(f"{'-'*60}")
        
        # Generate forecast data using Prophet with ALL historical data
        forecast_data = generate_overall_forecast_data(request.transactions, reference_date)
        
        # Generate per-product recommendations using Prophet only
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
            
            product_sales, last_sale_date, total_qty, days_since_last_sale, creation_date = get_product_sales_history(
                product, request.transactions, reference_date
            )
            days_since_creation = (today - creation_date).days if creation_date else 0
            is_deadstock = has_history and days_since_last_sale >= 30
            is_aged_unsold = (not has_history) and (days_since_creation >= 30)
            
            print(f"  🔍 {product.name}: sold_in_{ref_month_name}={ref_month_sales}, transactions={transaction_count}, has_history={has_history}, days_since_creation={days_since_creation}")
            
            # Handle deadstock and aged unsold
            if is_deadstock or is_aged_unsold:
                if is_deadstock:
                    days_since_activity = days_since_last_sale
                    deadstock_count += 1
                    print(f"     → DEADSTOCK: Last sale {days_since_activity} days ago")
                    _, _, total_quantity, _, _ = get_product_sales_history(product, request.transactions, reference_date)
                    historical_velocity = total_quantity / max(1, days_since_activity) * 30 if days_since_activity > 0 else 0
                    locked_capital = product.stock * product.markupPrice
                    
                    ai_suggestion = generate_deadstock_ai_suggestion(
                        product, days_since_activity, locked_capital, historical_velocity, 
                        product.category, never_sold=False
                    )
                else:
                    days_since_activity = days_since_creation
                    aged_unsold_count += 1
                    print(f"     → AGED UNSOLD: Created {days_since_activity} days ago")
                    locked_capital = product.stock * product.markupPrice
                    
                    ai_suggestion = generate_deadstock_ai_suggestion(
                        product, days_since_activity, locked_capital, 0, 
                        product.category, never_sold=True
                    )
                
                deadstock_suggestions_for_response.append({
                    'productId': product.id,
                    'suggestion': ai_suggestion['suggestion'],
                    'suggestionType': ai_suggestion['suggestion_type'],
                    'recommendedDiscount': ai_suggestion['recommended_discount'],
                    'mlFactors': ai_suggestion['ml_factors']
                })
                continue
            
            # Skip new products (created within last 30 days with no sales)
            if not has_history and days_since_creation < 30:
                new_products_count += 1
                print(f"     → NEW PRODUCT: Created {days_since_creation} days ago - excluded")
                continue
            
            # Skip products with only 1 transaction
            if has_history and transaction_count <= 1:
                single_transaction_excluded += 1
                print(f"     → EXCLUDED: Only {transaction_count} transaction(s) - insufficient data")
                continue
            
            # Active product - eligible for forecasting
            if has_history and transaction_count >= 2 and not is_deadstock:
                active_products_list.append({
                    'product': product,
                    'ref_month_sales': ref_month_sales,
                    'transaction_count': transaction_count
                })
                print(f"     → ACTIVE: {ref_month_sales} units in {ref_month_name} ({transaction_count} transactions) - ELIGIBLE")
        
        # Sort and limit active products
        active_products_list.sort(key=lambda x: x['ref_month_sales'], reverse=True)
        top_active_products = active_products_list[:TOP_SELLING_PRODUCT_LIMIT]
        
        if top_active_products:
            print(f"\n✅ TOP {len(top_active_products)} ACTIVE PRODUCTS in Demand Forecasting:")
            for idx, item in enumerate(top_active_products):
                print(f"     {idx+1}. {item['product'].name}: {item['ref_month_sales']} units ({item['transaction_count']} transactions)")
        
        print("\n📊 PER-PRODUCT ML DEMAND ANALYSIS (Prophet):")
        print("-" * 60)
        
        # Generate Prophet forecast for each active product using ALL historical data
        for item in top_active_products:
            product = item['product']
            
            # Use Prophet forecast with proper stockout calculation
            forecast_result = generate_forecast_for_product(product, request.transactions)
            
            if forecast_result.get('has_enough_data', False):
                forecast_30d = forecast_result['predicted_demand_30d']
                forecast_60d = forecast_result['predicted_demand_60d']
                forecast_90d = forecast_result['predicted_demand_90d']
                recommended_order = forecast_result.get('recommended_order', 0)
                days_until_out = forecast_result.get('days_until_out', 30)
                trend = forecast_result['trend']
                confidence = forecast_result['confidence']
                
                print(f"\n  📈 {product.name}")
                print(f"     Current Stock: {product.stock}")
                print(f"     Sales in {ref_month_name}: {item['ref_month_sales']} units")
                print(f"     Data points: {forecast_result.get('data_points', 0)} days, {forecast_result.get('non_zero_days', 0)} sales days")
                print(f"     → Prophet Forecast: {forecast_30d} units (30d)")
                print(f"     → Days until stockout: {days_until_out} days")
                print(f"     → Recommended Order: {recommended_order} units")
                print(f"     → Trend: {trend} | Confidence: {confidence}")
                
                # Always add recommendation to show the forecast (even if order = 0)
                recommendations.append({
                    'productId': product.id,
                    'productName': product.name,
                    'currentStock': product.stock,
                    'predictedDemand30d': forecast_30d,
                    'predictedDemand60d': forecast_60d,
                    'predictedDemand90d': forecast_90d,
                    'recommendedOrder': recommended_order,
                    'daysUntilOut': days_until_out,
                    'trend': trend,
                    'confidence': confidence
                })
            else:
                # Skip product - no forecast available
                print(f"\n  ⚠️ {product.name}: No forecast available")
                print(f"     Reason: Insufficient data for Prophet (need 5+ sales days, 30+ total days)")
                print(f"     Sales in {ref_month_name}: {item['ref_month_sales']} units")
                if forecast_result.get('non_zero_days', 0) > 0:
                    print(f"     Non-zero days in history: {forecast_result.get('non_zero_days', 0)}")
        
        recommendations.sort(key=lambda x: x['daysUntilOut'])
        
        print(f"\n{'='*60}")
        print(f"ML SUMMARY:")
        print(f"  Recommendations: {len(recommendations)}")
        print(f"  Deadstock Suggestions: {len(deadstock_suggestions_for_response)}")
        print(f"  Prophet Model: {'Active' if len(completed_txns) >= 10 else 'Insufficient Data'}")
        print(f"{'='*60}\n")
        
        result = {
            "forecastData": forecast_data,
            "recommendations": recommendations[:10],
            "deadstockSuggestions": deadstock_suggestions_for_response,
            "usingML": len(completed_txns) >= 10,
            "dataPoints": len(completed_txns)
        }
        
        # Store in cache before returning
        forecast_cache.set(cache_key, result)
        forecast_cache.mark_complete(cache_key)
        
        return result
            
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        forecast_cache.mark_complete(cache_key)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)