# ml-service/models/forecast.py
import asyncio
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import logging
from concurrent.futures import ThreadPoolExecutor

from .prophet_model import ProphetForecaster
from .xgboost_model import XGBoostForecaster
from .utils import DataPreprocessor

logger = logging.getLogger(__name__)

class ForecastEngine:
    """Ensemble forecasting engine combining Prophet and XGBoost"""
    
    def __init__(self):
        self.prophet_model = ProphetForecaster()
        self.xgboost_model = XGBoostForecaster()
        self.executor = ThreadPoolExecutor(max_workers=2)
        self.training_history = []
        
    async def generate_ensemble_forecast(self,
                                        transactions_df: pd.DataFrame,
                                        products_df: pd.DataFrame,
                                        forecast_months: int = 3) -> Dict[str, Any]:
        """
        Generate ensemble forecast using both models
        """
        logger.info("="*50)
        logger.info("ENTERING generate_ensemble_forecast")
        logger.info(f"transactions_df shape: {transactions_df.shape}")
        logger.info(f"products_df shape: {products_df.shape}")
        logger.info(f"forecast_months: {forecast_months}")
        
        # Log sample of data
        if not transactions_df.empty:
            logger.info(f"Transaction date range: {transactions_df['date'].min()} to {transactions_df['date'].max()}")
            logger.info(f"Total sales: {transactions_df['total'].sum()}")
            logger.info(f"Number of unique dates: {transactions_df['date'].nunique()}")
        
        try:
            forecast_days = forecast_months * 30
            
            # Run both models in parallel
            logger.info("Starting Prophet task...")
            prophet_task = asyncio.create_task(
                self._run_prophet_forecast(transactions_df, forecast_days)
            )
            
            logger.info("Starting XGBoost task...")
            xgboost_task = asyncio.create_task(
                self._run_xgboost_forecast(transactions_df, products_df, forecast_days)
            )
            
            # Wait for both to complete
            logger.info("Waiting for model tasks to complete...")
            prophet_result, xgboost_result = await asyncio.gather(
                prophet_task, xgboost_task, return_exceptions=True
            )
            
            # Handle errors
            if isinstance(prophet_result, Exception):
                logger.error(f"Prophet failed: {prophet_result}")
                logger.exception("Prophet error details:")
                prophet_result = None
            
            if isinstance(xgboost_result, Exception):
                logger.error(f"XGBoost failed: {xgboost_result}")
                logger.exception("XGBoost error details:")
                xgboost_result = None
            
            logger.info(f"Prophet success: {prophet_result is not None}")
            logger.info(f"XGBoost success: {xgboost_result is not None}")
            
            # Generate ensemble forecast
            logger.info("Creating ensemble forecast...")
            forecast_data = self._create_ensemble_forecast(
                prophet_result, xgboost_result, forecast_days
            )
            
            # Generate recommendations
            logger.info("Generating recommendations...")
            recommendations = self._generate_recommendations(
                transactions_df, products_df, forecast_data
            )
            
            # Calculate metrics
            logger.info("Calculating metrics...")
            metrics = self._calculate_ensemble_metrics(
                transactions_df, forecast_data
            )
            
            # Determine model used - fixed DataFrame truth check
            if prophet_result is not None and xgboost_result is not None:
                model_used = 'ensemble'
            elif prophet_result is not None:
                model_used = 'prophet'
            elif xgboost_result is not None:
                model_used = 'xgboost'
            else:
                model_used = 'none'
            
            logger.info(f"Model used: {model_used}")
            
            # Calculate confidence
            if prophet_result is not None and xgboost_result is not None:
                confidence = 90.0
            elif prophet_result is not None:
                confidence = 75.0
            elif xgboost_result is not None:
                confidence = 70.0
            else:
                confidence = 0.0
            
            logger.info(f"Confidence: {confidence}")
            logger.info("="*50)
            
            return {
                'forecastData': forecast_data,
                'recommendations': recommendations,
                'metrics': metrics,
                'modelUsed': model_used,
                'confidence': confidence
            }
            
        except Exception as e:
            logger.error(f"Error in generate_ensemble_forecast: {str(e)}")
            logger.exception("Full exception:")
            raise
    
    async def _run_prophet_forecast(self, transactions_df: pd.DataFrame, periods: int):
        """Run Prophet forecast in thread pool"""
        loop = asyncio.get_event_loop()
        
        def train_and_forecast():
            logger.info("Prophet: Starting training...")
            try:
                # Train model
                self.prophet_model.train(transactions_df)
                logger.info("Prophet: Training complete")
                
                # Generate forecast
                forecast = self.prophet_model.forecast(periods=periods)
                logger.info(f"Prophet: Forecast generated with shape {forecast.shape}")
                return forecast
            except Exception as e:
                logger.error(f"Prophet: Error in train_and_forecast: {str(e)}")
                logger.exception("Prophet: Full exception:")
                raise
        
        return await loop.run_in_executor(self.executor, train_and_forecast)
    
    async def _run_xgboost_forecast(self, 
                                   transactions_df: pd.DataFrame,
                                   products_df: pd.DataFrame,
                                   periods: int):
        """Run XGBoost forecast in thread pool"""
        loop = asyncio.get_event_loop()
        
        def train_and_forecast():
            logger.info("XGBoost: Starting training...")
            try:
                # Train model
                self.xgboost_model.train(transactions_df, products_df)
                logger.info("XGBoost: Training complete")
                
                # Generate forecast
                forecast = self.xgboost_model.forecast(periods=periods)
                logger.info(f"XGBoost: Forecast generated with shape {forecast.shape}")
                return forecast
            except Exception as e:
                logger.error(f"XGBoost: Error in train_and_forecast: {str(e)}")
                logger.exception("XGBoost: Full exception:")
                raise
        
        return await loop.run_in_executor(self.executor, train_and_forecast)
    
    def _create_ensemble_forecast(self,
                                  prophet_forecast: Optional[pd.DataFrame],
                                  xgboost_forecast: Optional[pd.DataFrame],
                                  periods: int) -> List[Dict[str, Any]]:
        """Combine forecasts from both models"""
        logger.info("Creating ensemble forecast...")
        
        if prophet_forecast is None and xgboost_forecast is None:
            # Fallback to simple forecast
            logger.warning("Both models failed, using fallback forecast")
            return self._generate_fallback_forecast(periods)
        
        if prophet_forecast is None:
            logger.info("Using only XGBoost forecast")
            return self._format_forecast(xgboost_forecast, 'xgboost')
        
        if xgboost_forecast is None:
            logger.info("Using only Prophet forecast")
            return self._format_forecast(prophet_forecast, 'prophet')
        
        # Ensemble weighting
        prophet_weight = 0.6
        xgboost_weight = 0.4
        
        # Merge forecasts
        merged = prophet_forecast.merge(
            xgboost_forecast,
            on='ds',
            suffixes=('_prophet', '_xgboost'),
            how='outer'
        )
        
        # Fill missing values - fixed deprecated method
        merged = merged.ffill()
        
        # Calculate ensemble prediction
        merged['yhat'] = (prophet_weight * merged['yhat_prophet'] + 
                          xgboost_weight * merged['yhat_xgboost'])
        
        merged['yhat_lower'] = (prophet_weight * merged.get('yhat_lower_prophet', merged['yhat']) +
                                xgboost_weight * merged.get('yhat_lower_xgboost', merged['yhat']))
        
        merged['yhat_upper'] = (prophet_weight * merged.get('yhat_upper_prophet', merged['yhat']) +
                                xgboost_weight * merged.get('yhat_upper_xgboost', merged['yhat']))
        
        # Add metadata
        merged['model'] = 'ensemble'
        merged['prophet_contribution'] = prophet_weight
        merged['xgboost_contribution'] = xgboost_weight
        
        logger.info(f"Ensemble forecast created with {len(merged)} rows")
        return self._format_forecast(merged, 'ensemble')
    
    def _generate_recommendations(self,
                                 transactions_df: pd.DataFrame,
                                 products_df: pd.DataFrame,
                                 forecast_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate product-specific recommendations based on forecast"""
        
        recommendations = []
        
        # Calculate product-level demand
        for _, product in products_df.iterrows():
            # Get historical sales for this product
            product_sales = []
            for _, trans in transactions_df.iterrows():
                if 'items' in trans and isinstance(trans['items'], list):
                    for item in trans['items']:
                        if item.get('id') == product['id']:
                            product_sales.append({
                                'date': trans['date'],
                                'quantity': item.get('quantity', 0)
                            })
            
            if len(product_sales) < 3:  # Reduced threshold for testing
                continue  # Skip products with insufficient data
            
            # Calculate average daily sales
            sales_df = pd.DataFrame(product_sales)
            sales_df['date'] = pd.to_datetime(sales_df['date'])
            sales_df = sales_df.set_index('date').resample('D').sum().fillna(0)
            
            avg_daily_sales = sales_df['quantity'].mean()
            
            if avg_daily_sales == 0:
                continue
            
            # Predict demand for next 30 days
            predicted_demand = int(avg_daily_sales * 30 * 1.1)
            
            # Calculate days until out of stock
            days_until_out = int(product['stock'] / avg_daily_sales) if avg_daily_sales > 0 else 999
            
            # Determine if reorder is needed
            reorder_needed = (
                product['stock'] <= product['reorder_point'] or
                days_until_out <= product['lead_time_days']
            )
            
            if reorder_needed:
                # Calculate confidence based on data volume
                confidence = 'high' if len(product_sales) >= 20 else \
                            'medium' if len(product_sales) >= 10 else 'low'
                
                # Determine trend
                if len(sales_df) >= 7:
                    recent_sales = sales_df.tail(7)['quantity'].mean()
                    older_sales = sales_df.tail(14).head(7)['quantity'].mean() if len(sales_df) >= 14 else recent_sales
                    
                    trend = 'up' if recent_sales > older_sales * 1.2 else \
                            'down' if recent_sales < older_sales * 0.8 else 'stable'
                else:
                    trend = 'stable'
                
                recommendations.append({
                    'productId': product['id'],
                    'productName': product['name'],
                    'currentStock': int(product['stock']),
                    'predictedDemand': predicted_demand,
                    'daysUntilOut': days_until_out,
                    'recommendedOrder': max(predicted_demand - product['stock'], 
                                           product['reorder_point'] * 2),
                    'confidence': confidence,
                    'trend': trend,
                    'leadTimeDays': int(product['lead_time_days'])
                })
        
        # Sort by urgency
        recommendations.sort(key=lambda x: x['daysUntilOut'])
        
        logger.info(f"Generated {len(recommendations)} recommendations")
        return recommendations
    
    def _calculate_ensemble_metrics(self,
                                   transactions_df: pd.DataFrame,
                                   forecast_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate overall forecast metrics"""
        
        # Make dates timezone-aware for comparison
        now = datetime.now().astimezone()
        thirty_days_ago = now - timedelta(days=30)
        
        # Ensure dates are timezone-aware
        df_copy = transactions_df.copy()
        if df_copy['date'].dt.tz is None:
            df_copy['date'] = df_copy['date'].dt.tz_localize('UTC')
        
        # Get last 30 days of actual sales
        last_30_days = df_copy[
            pd.to_datetime(df_copy['date']) >= thirty_days_ago
        ]
        
        actual_revenue = last_30_days['total'].sum() if not last_30_days.empty else 0
        
        # Get forecast for next 30 days
        forecast_sum = 0
        count = 0
        for f in forecast_data:
            if f.get('type') == 'forecast' and count < 30:
                forecast_sum += f['value'] * 1000
                count += 1
        next_30_days_forecast = forecast_sum
        
        # Calculate trend
        sixty_days_ago = now - timedelta(days=60)
        previous_30_days = df_copy[
            (pd.to_datetime(df_copy['date']) >= sixty_days_ago) &
            (pd.to_datetime(df_copy['date']) < thirty_days_ago)
        ]
        previous_revenue = previous_30_days['total'].sum() if not previous_30_days.empty else 0
        
        trend = ((actual_revenue - previous_revenue) / previous_revenue * 100) if previous_revenue > 0 else 0
        
        return {
            'revenue': {
                'current': float(actual_revenue),
                'forecasted': float(next_30_days_forecast),
                'trend': float(trend)
            }
        }
    
    def _format_forecast(self, 
                        forecast_df: pd.DataFrame, 
                        model_name: str) -> List[Dict[str, Any]]:
        """Format forecast DataFrame to match frontend expectations"""
        
        result = []
        today = datetime.now()
        
        # Historical data (last 6 months)
        for i in range(6, 0, -1):
            date = today - timedelta(days=30 * i)
            month_name = date.strftime('%b')
            
            # Find matching forecast
            mask = (forecast_df['ds'].dt.year == date.year) & \
                   (forecast_df['ds'].dt.month == date.month)
            
            if mask.any():
                value = forecast_df.loc[mask, 'yhat'].iloc[0] / 1000
            else:
                value = 40 + (i * 5)
            
            result.append({
                'month': month_name,
                'value': round(value, 1),
                'type': 'history'
            })
        
        # Forecast data (next 3 months)
        for i in range(1, 4):
            date = today + timedelta(days=30 * i)
            month_name = date.strftime('%b')
            
            mask = (forecast_df['ds'].dt.year == date.year) & \
                   (forecast_df['ds'].dt.month == date.month)
            
            if mask.any():
                value = forecast_df.loc[mask, 'yhat'].iloc[0] / 1000
                lower = forecast_df.loc[mask, 'yhat_lower'].iloc[0] / 1000 if 'yhat_lower' in forecast_df.columns else value * 0.9
                upper = forecast_df.loc[mask, 'yhat_upper'].iloc[0] / 1000 if 'yhat_upper' in forecast_df.columns else value * 1.1
            else:
                last_value = result[-1]['value'] if result else 50
                value = last_value * (1 + 0.05 * i)
                lower = value * 0.9
                upper = value * 1.1
            
            result.append({
                'month': month_name,
                'value': round(value, 1),
                'lower': round(lower, 1),
                'upper': round(upper, 1),
                'type': 'forecast',
                'model': model_name
            })
        
        logger.info(f"Formatted forecast with {len(result)} data points")
        return result
    
    def _generate_fallback_forecast(self, periods: int) -> List[Dict[str, Any]]:
        """Generate simple fallback forecast when ML fails"""
        logger.warning("Generating fallback forecast")
        result = []
        today = datetime.now()
        
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        base_values = [40, 42, 45, 48, 52, 58, 65, 70, 68, 62, 55, 50]
        
        for i in range(9):
            month_idx = (today.month - 6 + i) % 12
            month_name = months[month_idx]
            
            is_forecast = i >= 6
            
            if is_forecast:
                growth = 1 + (i - 5) * 0.05
                value = base_values[month_idx] * growth
            else:
                value = base_values[month_idx]
            
            result.append({
                'month': month_name,
                'value': round(value, 1),
                'type': 'forecast' if is_forecast else 'history',
                'model': 'fallback'
            })
        
        return result