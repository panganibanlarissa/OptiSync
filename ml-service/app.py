# ml-service/app.py
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
import uvicorn
import os
import pandas as pd
import traceback
from dotenv import load_dotenv

from models.forecast import ForecastEngine

# Load environment variables
load_dotenv()

# Setup logging with more detail
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for more details
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="OptiSync ML Service",
    description="FBProphet and XGBoost forecasting for optical clinic inventory",
    version="1.0.0"
)

# Configure CORS - Allow all origins for debugging
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Temporarily allow all origins for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize forecast engine
forecast_engine = None

def get_forecast_engine():
    global forecast_engine
    if forecast_engine is None:
        logger.info("Initializing ForecastEngine...")
        forecast_engine = ForecastEngine()
    return forecast_engine

# Pydantic models
class TransactionItem(BaseModel):
    id: str
    name: str
    price: float
    quantity: int

class Transaction(BaseModel):
    id: str
    patientName: str
    items: List[TransactionItem]
    total: float
    date: datetime
    status: str

class Product(BaseModel):
    id: str
    sku: str
    name: str
    category: str
    baseCost: float
    markupPrice: float
    stock: int
    leadTimeDays: int
    reorderPoint: int

class ForecastRequest(BaseModel):
    transactions: List[Transaction]
    products: List[Product]
    forecastMonths: int = Field(default=3, ge=1, le=12)

class ForecastResponse(BaseModel):
    forecastData: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    modelUsed: str
    confidence: float
    generatedAt: datetime

class HealthResponse(BaseModel):
    status: str
    version: str
    models: Dict[str, bool]

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("="*50)
    logger.info("Starting OptiSync ML Service...")
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")
    logger.info("="*50)

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        models={
            "prophet": True,
            "xgboost": True,
            "ensemble": True
        }
    )

# Main forecasting endpoint
@app.post("/api/forecast/demand", response_model=ForecastResponse)
async def forecast_demand(request: ForecastRequest, background_tasks: BackgroundTasks):
    """
    Generate demand forecasts using FBProphet and XGBoost
    """
    request_id = datetime.now().strftime("%Y%m%d%H%M%S%f")
    logger.info("="*50)
    logger.info(f"REQUEST [{request_id}] - New forecast request received")
    
    try:
        # Log request summary
        logger.info(f"Total transactions: {len(request.transactions)}")
        logger.info(f"Total products: {len(request.products)}")
        
        # Filter completed transactions only
        completed_transactions = [t for t in request.transactions if t.status == "completed"]
        logger.info(f"Completed transactions: {len(completed_transactions)}")
        
        if len(completed_transactions) == 0:
            logger.warning("No completed transactions found")
            return generate_fallback_response(request, reason="no_completed_transactions")
        
        # Log sample data
        if completed_transactions:
            logger.info(f"First transaction date: {completed_transactions[0].date}")
            logger.info(f"Last transaction date: {completed_transactions[-1].date}")
            
            # Calculate date range
            dates = [t.date for t in completed_transactions]
            min_date = min(dates)
            max_date = max(dates)
            days_span = (max_date - min_date).days
            logger.info(f"Date range: {days_span} days")
        
        # Convert to DataFrames
        logger.info("Converting to DataFrames...")
        try:
            transactions_df = pd.DataFrame([{
                'date': t.date,
                'total': t.total,
                'items': [i.dict() for i in t.items],
                'status': t.status
            } for t in completed_transactions])
            
            products_df = pd.DataFrame([{
                'id': p.id,
                'name': p.name,
                'category': p.category,
                'price': p.markupPrice,
                'stock': p.stock,
                'lead_time_days': p.leadTimeDays,
                'reorder_point': p.reorderPoint
            } for p in request.products])
            
            logger.info(f"DataFrame shapes: transactions={transactions_df.shape}, products={products_df.shape}")
            
        except Exception as e:
            logger.error(f"DataFrame conversion error: {str(e)}")
            logger.error(traceback.format_exc())
            return generate_fallback_response(request, reason="dataframe_error")
        
        # Get forecast engine
        engine = get_forecast_engine()
        
        # Generate forecast
        logger.info("Calling generate_ensemble_forecast...")
        try:
            result = await engine.generate_ensemble_forecast(
                transactions_df=transactions_df,
                products_df=products_df,
                forecast_months=request.forecastMonths
            )
            
            logger.info(f"Forecast generated. Model used: {result.get('modelUsed', 'unknown')}")
            
        except Exception as e:
            logger.error(f"Forecast generation error: {str(e)}")
            logger.error(traceback.format_exc())
            return generate_fallback_response(request, reason="forecast_generation_error")
        
        # Add metadata
        result['generatedAt'] = datetime.now()
        
        logger.info(f"REQUEST [{request_id}] - COMPLETED")
        logger.info("="*50)
        
        return ForecastResponse(**result)
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        logger.error(traceback.format_exc())
        logger.info("="*50)
        return generate_fallback_response(request, reason="unexpected_error")

def generate_fallback_response(request: ForecastRequest, reason: str = "unknown") -> ForecastResponse:
    """Generate fallback response when ML fails"""
    logger.warning(f"Generating fallback response. Reason: {reason}")
    
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    today = datetime.now()
    
    forecast_data = []
    for i in range(9):
        month_idx = (today.month - 6 + i) % 12
        month_name = months[month_idx]
        forecast_data.append({
            'month': month_name,
            'value': 40 + i * 3,
            'type': 'forecast' if i >= 6 else 'history'
        })
    
    # Calculate basic metrics
    current_revenue = 125000
    if request.transactions:
        completed = [t for t in request.transactions if t.status == "completed"]
        if completed:
            current_revenue = sum(t.total for t in completed[-30:])  # Last 30 transactions
    
    return ForecastResponse(
        forecastData=forecast_data,
        recommendations=[],
        metrics={
            'revenue': {
                'current': float(current_revenue),
                'forecasted': float(current_revenue * 1.1),
                'trend': 10.0
            }
        },
        modelUsed='fallback',
        confidence=50.0,
        generatedAt=datetime.now()
    )

# Debug endpoint
@app.post("/api/debug/echo")
async def debug_echo(request: ForecastRequest):
    """Echo back the request for debugging"""
    return {
        "transaction_count": len(request.transactions),
        "product_count": len(request.products),
        "completed_count": len([t for t in request.transactions if t.status == "completed"]),
        "first_transaction": request.transactions[0].dict() if request.transactions else None
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="debug"
    )