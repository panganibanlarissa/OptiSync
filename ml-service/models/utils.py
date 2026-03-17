# ml-service/models/utils.py
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataPreprocessor:
    """Preprocess transaction data for forecasting models"""
    
    @staticmethod
    def prepare_time_series(transactions_df: pd.DataFrame) -> pd.DataFrame:
        """
        Convert transaction data to time series format
        Expected columns: date, total, items (optional)
        """
        try:
            # Ensure date is datetime and remove timezone
            transactions_df['date'] = pd.to_datetime(transactions_df['date'])
            transactions_df['date'] = transactions_df['date'].dt.tz_localize(None)
            
            # Aggregate by day
            daily_sales = transactions_df.groupby(
                pd.Grouper(key='date', freq='D')
            ).agg({
                'total': 'sum',
                'date': 'count'
            }).rename(columns={'date': 'transaction_count'})
            
            daily_sales = daily_sales.reset_index()
            daily_sales.columns = ['ds', 'y', 'transaction_count']
            
            # Fill missing days with 0
            if not daily_sales.empty:
                date_range = pd.date_range(
                    start=daily_sales['ds'].min(),
                    end=daily_sales['ds'].max(),
                    freq='D'
                )
                daily_sales = daily_sales.set_index('ds').reindex(date_range).fillna(0)
                daily_sales = daily_sales.reset_index().rename(columns={'index': 'ds'})
            
            logger.info(f"Prepared time series with {len(daily_sales)} days of data")
            return daily_sales
            
        except Exception as e:
            logger.error(f"Error preparing time series: {str(e)}")
            raise
    
    @staticmethod
    def prepare_product_features(products_df: pd.DataFrame) -> pd.DataFrame:
        """Prepare product features for XGBoost"""
        features = products_df.copy()
        
        # Create categorical features
        if 'category' in features.columns:
            features['category_encoded'] = pd.Categorical(features['category']).codes
        
        # Price segments
        if 'price' in features.columns:
            features['price_segment'] = pd.cut(
                features['price'],
                bins=[0, 1000, 5000, 10000, float('inf')],
                labels=[0, 1, 2, 3]
            )
        
        # Stock level indicators
        if 'stock' in features.columns and 'reorder_point' in features.columns:
            features['stock_ratio'] = features['stock'] / (features['reorder_point'] + 1)
            features['low_stock_flag'] = (features['stock'] <= features['reorder_point']).astype(int)
        
        return features
    
    @staticmethod
    def create_lag_features(df: pd.DataFrame, target_col: str = 'y', lags: List[int] = [1, 2, 3]) -> pd.DataFrame:
        """Create lag features for time series (simplified for small data)"""
        df = df.copy()
        
        # Use fewer lags for small datasets
        for lag in lags:
            if len(df) > lag:
                df[f'lag_{lag}'] = df[target_col].shift(lag)
        
        # Rolling statistics (only if enough data)
        for window in [3, 7]:
            if len(df) > window:
                df[f'rolling_mean_{window}'] = df[target_col].rolling(window=window, min_periods=1).mean()
                df[f'rolling_std_{window}'] = df[target_col].rolling(window=window, min_periods=1).std().fillna(0)
        
        # Day of week, month, etc.
        if 'ds' in df.columns:
            df['day_of_week'] = pd.to_datetime(df['ds']).dt.dayofweek
            df['month'] = pd.to_datetime(df['ds']).dt.month
            df['day_of_month'] = pd.to_datetime(df['ds']).dt.day
            df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
        
        return df
    
    @staticmethod
    def calculate_metrics(actual: np.ndarray, predicted: np.ndarray) -> Dict[str, float]:
        """Calculate forecast accuracy metrics"""
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
        
        mae = mean_absolute_error(actual, predicted)
        rmse = np.sqrt(mean_squared_error(actual, predicted))
        
        # Mean Absolute Percentage Error
        mask = actual != 0
        if mask.any():
            mape = np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100
        else:
            mape = 0
        
        # R-squared
        r2 = r2_score(actual, predicted)
        
        return {
            'mae': float(mae),
            'rmse': float(rmse),
            'mape': float(mape),
            'r2': float(r2)
        }

class ForecastValidator:
    """Validate forecast results"""
    
    @staticmethod
    def validate_forecast_inputs(transactions_df: pd.DataFrame, min_days: int = 30) -> Tuple[bool, str]:
        """Check if we have enough data for forecasting"""
        if transactions_df.empty:
            return False, "No transaction data provided"
        
        if 'date' not in transactions_df.columns:
            return False, "Missing 'date' column"
        
        # Check date range
        transactions_df['date'] = pd.to_datetime(transactions_df['date'])
        date_range = (transactions_df['date'].max() - transactions_df['date'].min()).days
        
        if date_range < min_days:
            logger.warning(f"Limited data: only {date_range} days (recommended {min_days}+)")
            # Return True but with warning - we'll try to work with what we have
        
        # Check for completed transactions
        if 'status' in transactions_df.columns:
            completed = transactions_df[transactions_df['status'] == 'completed']
            if len(completed) < 10:
                logger.warning(f"Limited completed transactions: {len(completed)} (recommended 10+)")
        
        return True, "Valid"