// src/hooks/useMLForecasting.ts
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

export interface Recommendation {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand30d: number;
  predictedDemand60d: number;
  predictedDemand90d: number;
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
        
        if (healthCheck && healthCheck.status === 'healthy') {
          mlServiceAvailable = true;
          console.log('Python ML Service is available, using Prophet/Scikit-learn');
          
          const result = await mlApiClient.generateForecast(productData, transactionData);
          forecastData = result.forecastData || [];
          
          // Map the recommendations - ensure numbers are valid
          recommendations = (result.recommendations || []).map((rec: any) => {
            // Log the raw response for debugging
            console.log('Raw recommendation from API:', rec);
            
            return {
              productId: rec.productId || '',
              productName: rec.productName || '',
              currentStock: typeof rec.currentStock === 'number' ? rec.currentStock : 0,
              predictedDemand30d: typeof rec.predictedDemand30d === 'number' ? rec.predictedDemand30d : 0,
              predictedDemand60d: typeof rec.predictedDemand60d === 'number' ? rec.predictedDemand60d : 0,
              predictedDemand90d: typeof rec.predictedDemand90d === 'number' ? rec.predictedDemand90d : 0,
              recommendedOrder: typeof rec.recommendedOrder === 'number' ? rec.recommendedOrder : 0,
              daysUntilOut: typeof rec.daysUntilOut === 'number' ? rec.daysUntilOut : 0,
              trend: rec.trend || 'stable',
              confidence: rec.confidence || 'low'
            };
          });
          
          usingML = result.usingML || false;
          
          console.log('ML API Response:', { 
            usingML: result.usingML, 
            dataPoints: result.dataPoints,
            recommendationsCount: recommendations.length 
          });
          console.log('Mapped recommendations:', recommendations);
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
          const fallbackRecs = await localMLForecasting.generateRecommendations(products, transactions);
          recommendations = fallbackRecs.map((rec: any) => ({
            productId: rec.productId,
            productName: rec.productName,
            currentStock: rec.currentStock,
            predictedDemand30d: rec.predictedDemand || 0,
            predictedDemand60d: Math.round((rec.predictedDemand || 0) * 1.9),
            predictedDemand90d: Math.round((rec.predictedDemand || 0) * 2.7),
            recommendedOrder: rec.recommendedOrder,
            daysUntilOut: rec.daysUntilOut,
            trend: rec.trend,
            confidence: rec.confidence
          }));
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