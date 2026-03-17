# ml-service/models/xgboost_model.py
import xgboost as xgb
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime, timedelta

from .utils import DataPreprocessor, ForecastValidator

logger = logging.getLogger(__name__)

class XGBoostForecaster:
    """XGBoost-based demand forecasting"""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = None
        self.last_training_date = None
        self.metrics = {}
        
    def train(self,
              transactions_df: pd.DataFrame,
              products_df: Optional[pd.DataFrame] = None,
              target_col: str = 'y',
              test_size: float = 0.2,
              **xgboost_params) -> Dict[str, Any]:
        """
        Train XGBoost model on historical sales data
        """
        try:
            # Validate inputs
            is_valid, message = ForecastValidator.validate_forecast_inputs(transactions_df)
            if not is_valid:
                logger.warning(f"Validation warning: {message}")
            
            # Prepare base time series
            ts_data = DataPreprocessor.prepare_time_series(transactions_df)
            
            # Remove timezone
            ts_data['ds'] = ts_data['ds'].dt.tz_localize(None)
            
            # Create features
            df_features = DataPreprocessor.create_lag_features(ts_data, target_col=target_col)
            
            # Drop rows with NaN (from lag features)
            df_features = df_features.dropna()
            
            if len(df_features) < 3:
                logger.warning(f"Very limited training data: {len(df_features)} rows")
                # Create synthetic features if too little
                df_features = self._create_synthetic_features(ts_data, target_col)
            
            if len(df_features) < 3:
                raise ValueError(f"Insufficient training data after augmentation: {len(df_features)} rows")
            
            logger.info(f"Training data: {len(df_features)} rows")
            
            # Prepare features and target
            feature_cols = [col for col in df_features.columns if col not in ['ds', target_col, 'transaction_count']]
            self.feature_columns = feature_cols
            
            X = df_features[feature_cols].values
            y = df_features[target_col].values
            
            # Scale features
            X_scaled = self.scaler.fit_transform(X)
            
            # Default XGBoost parameters (simplified for small data)
            default_params = {
                'objective': 'reg:squarederror',
                'learning_rate': 0.1,
                'max_depth': 3,
                'n_estimators': 50,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'random_state': 42,
                'eval_metric': 'rmse'
            }
            
            # Update with user parameters
            default_params.update(xgboost_params)
            
            # Train model
            logger.info("Training XGBoost model...")
            self.model = xgb.XGBRegressor(**default_params)
            
            # Train with early stopping if enough data
            if len(df_features) >= 10:
                X_train, X_test, y_train, y_test = train_test_split(
                    X_scaled, y, test_size=test_size, shuffle=False
                )
                
                self.model.fit(
                    X_train, y_train,
                    eval_set=[(X_test, y_test)],
                    verbose=False
                )
                
                # Calculate metrics
                y_pred = self.model.predict(X_test)
                self.metrics = DataPreprocessor.calculate_metrics(y_test, y_pred)
            else:
                # Just train on all data
                self.model.fit(X_scaled, y)
                self.metrics = {'mae': 0, 'rmse': 0, 'mape': 0, 'r2': 0}
            
            self.last_training_date = datetime.now()
            
            # Feature importance
            importance = self.model.feature_importances_
            feature_importance = dict(zip(feature_cols, importance))
            
            logger.info(f"XGBoost model trained successfully with {len(df_features)} rows")
            
            return {
                'status': 'success',
                'metrics': self.metrics,
                'feature_importance': feature_importance,
                'train_samples': len(df_features)
            }
            
        except Exception as e:
            logger.error(f"Error training XGBoost model: {str(e)}")
            raise
    
    def _create_synthetic_features(self, ts_data: pd.DataFrame, target_col: str) -> pd.DataFrame:
        """Create synthetic features when data is limited"""
        if len(ts_data) < 3:
            # Augment time series
            augmented = ts_data.copy()
            for i in range(1, 4):
                temp = ts_data.copy()
                temp['ds'] = temp['ds'] + timedelta(days=i*7)
                temp['y'] = temp['y'] * (0.9 + 0.05 * i)
                augmented = pd.concat([augmented, temp])
            ts_data = augmented.sort_values('ds').reset_index(drop=True)
        
        # Create features
        return DataPreprocessor.create_lag_features(ts_data, target_col=target_col)
    
    def forecast(self, periods: int = 30) -> pd.DataFrame:
        """
        Generate forecast for future periods
        """
        if not self.model:
            raise ValueError("Model not trained. Call train() first.")
        
        try:
            # Create future dataframe with features
            last_date = self.last_training_date or datetime.now()
            future_dates = pd.date_range(start=last_date + timedelta(days=1), periods=periods, freq='D')
            
            # Prepare features for future dates
            future_features = []
            
            for date in future_dates:
                # Create feature vector for this date
                features = {}
                
                # Add time-based features
                features['day_of_week'] = date.dayofweek
                features['month'] = date.month
                features['day_of_month'] = date.day
                features['week_of_year'] = date.isocalendar().week
                features['quarter'] = (date.month - 1) // 3 + 1
                features['is_weekend'] = 1 if date.dayofweek >= 5 else 0
                
                # Add placeholder for lag features (will use 0 for future)
                for lag in [1, 2, 3, 7, 14, 30]:
                    features[f'lag_{lag}'] = 0
                
                for window in [7, 14, 30]:
                    features[f'rolling_mean_{window}'] = 0
                    features[f'rolling_std_{window}'] = 0
                    features[f'rolling_max_{window}'] = 0
                
                future_features.append(features)
            
            # Convert to DataFrame
            future_df = pd.DataFrame(future_features)
            
            # Ensure all required features are present
            for col in self.feature_columns:
                if col not in future_df.columns:
                    future_df[col] = 0
            
            future_df = future_df[self.feature_columns]
            future_scaled = self.scaler.transform(future_df)
            
            # Generate predictions
            predictions = self.model.predict(future_scaled)
            predictions = np.maximum(0, predictions)  # Ensure non-negative
            
            # Create result DataFrame
            result = pd.DataFrame({
                'ds': future_dates,
                'yhat': predictions,
                'model': 'xgboost'
            })
            
            # Add confidence intervals (simplified)
            pred_std = np.std(predictions) * 0.2
            result['yhat_lower'] = np.maximum(0, predictions - 2 * pred_std)
            result['yhat_upper'] = predictions + 2 * pred_std
            
            logger.info(f"Generated XGBoost forecast for {periods} days")
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating XGBoost forecast: {str(e)}")
            raise
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance scores"""
        if not self.model or not self.feature_columns:
            raise ValueError("Model not trained")
        
        importance = self.model.feature_importances_
        return dict(zip(self.feature_columns, importance))
    
    def save_model(self, path: str):
        """Save trained model to disk"""
        if self.model:
            joblib.dump({
                'model': self.model,
                'scaler': self.scaler,
                'feature_columns': self.feature_columns,
                'metrics': self.metrics,
                'last_training_date': self.last_training_date
            }, path)
            logger.info(f"Model saved to {path}")
    
    def load_model(self, path: str):
        """Load trained model from disk"""
        data = joblib.load(path)
        self.model = data['model']
        self.scaler = data['scaler']
        self.feature_columns = data['feature_columns']
        self.metrics = data['metrics']
        self.last_training_date = data['last_training_date']
        logger.info(f"Model loaded from {path}")