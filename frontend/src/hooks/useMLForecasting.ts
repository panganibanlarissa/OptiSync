// frontend/src/hooks/useMLForecasting.ts
import { useState, useEffect, useCallback } from 'react';
import { useFirebase } from '@/context/FirebaseContext';
import { mlForecasting as localMLForecasting } from '@/services/mlForecasting';
import { mlApiClient, ProductData, TransactionData } from '@/services/mlApiClient';

interface ForecastDataPoint {
  month: string;
  value: number;
  type: 'history' | 'forecast';
  lower?: number;
  upper?: number;
}

interface Recommendation {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  recommendedOrder: number;
  daysUntilOut: number;
  trend: 'up' | 'down' | 'stable';
  confidence: 'high' | 'medium' | 'low';
}

interface MLForecastingState {
  loading: boolean;
  usingML: boolean;
  forecastData: ForecastDataPoint[];
  recommendations: Recommendation[];
  dataLoaded: boolean;
  mlServiceAvailable: boolean;
}

export function useMLForecasting() {
  const { products, transactions } = useFirebase();
  const [state, setState] = useState<MLForecastingState>({
    loading: true,
    usingML: false,
    forecastData: [],
    recommendations: [],
    dataLoaded: false,
    mlServiceAvailable: false,
  });

  const loadForecasts = useCallback(async () => {
    if (!products.length) {
      setState(prev => ({ ...prev, loading: false, dataLoaded: true }));
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      // Prepare data for API
      const productData: ProductData[] = products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        stock: p.stock,
        markupPrice: p.markupPrice,
        baseCost: p.baseCost,
        reorderPoint: p.reorderPoint,
        lastMovedDaysAgo: p.lastMovedDaysAgo,
      }));

      const transactionData: TransactionData[] = transactions.map(t => ({
        id: t.id,
        total: t.total,
        date: t.date instanceof Date ? t.date.toISOString() : new Date(t.date).toISOString(),
        status: t.status,
        items: t.items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      }));

      // Try to use Python ML API first
      let mlServiceAvailable = false;
      let forecastData: ForecastDataPoint[] = [];
      let recommendations: Recommendation[] = [];
      let usingML = false;

      try {
        // Check if ML service is available
        const healthCheck = await mlApiClient.healthCheck();
        
        if (healthCheck) {
          mlServiceAvailable = true;
          console.log('Python ML Service is available, using Prophet/Scikit-learn');
          
          const result = await mlApiClient.generateForecast(productData, transactionData);
          forecastData = result.forecastData;
          recommendations = result.recommendations;
          usingML = result.usingML;
          
          console.log('ML API Response:', { usingML: result.usingML, dataPoints: result.dataPoints });
        } else {
          throw new Error('ML service not available');
        }
      } catch (apiError) {
        console.log('Python ML Service unavailable, using JavaScript fallback');
        mlServiceAvailable = false;
        
        // Fallback to local JavaScript ML
        const completedTransactions = transactions.filter(t => t.status === 'completed');
        const hasEnoughData = completedTransactions.length >= 10;
        
        forecastData = await localMLForecasting.generateSalesForecast(transactions, 'monthly');
        
        if (hasEnoughData) {
          recommendations = await localMLForecasting.generateRecommendations(products, transactions);
        }
        
        usingML = hasEnoughData;
      }

      setState({
        loading: false,
        usingML,
        forecastData,
        recommendations,
        dataLoaded: true,
        mlServiceAvailable,
      });

      // Log AI status
      console.group('===== DEMAND FORECASTING AI ANALYSIS =====');
      console.log('ML Service Source:', mlServiceAvailable ? 'Python (Prophet/SK)' : 'JavaScript (Fallback)');
      console.log('Using ML:', usingML);
      console.log('Recommendations:', recommendations.length);
      console.log('Forecast Data Points:', forecastData.length);
      console.groupEnd();

    } catch (error) {
      console.error('Error loading forecasts:', error);
      
      // Ultimate fallback - use local service
      try {
        const fallbackForecast = await localMLForecasting.generateSalesForecast(transactions, 'monthly');
        setState({
          loading: false,
          usingML: false,
          forecastData: fallbackForecast,
          recommendations: [],
          dataLoaded: true,
          mlServiceAvailable: false,
        });
      } catch (fallbackError) {
        setState({
          loading: false,
          usingML: false,
          forecastData: [],
          recommendations: [],
          dataLoaded: true,
          mlServiceAvailable: false,
        });
      }
    }
  }, [products, transactions]);

  useEffect(() => {
    loadForecasts();
  }, [loadForecasts]);

  return state;
}