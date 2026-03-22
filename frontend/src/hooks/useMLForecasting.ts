// src/hooks/useMLForecasting.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFirebase } from '@/context/FirebaseContext';
import { Product, Transaction } from '@/context/FirebaseContext';

// Define types for ML service responses
export interface ForecastDataPoint {
  month: string;
  value: number;
  type: 'history' | 'forecast';
  lower?: number;
  upper?: number;
  model?: string;
}

export interface ReorderRecommendation {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  daysUntilOut: number;
  recommendedOrder: number;
  confidence: 'high' | 'medium' | 'low';
  trend: 'up' | 'down' | 'stable';
  leadTimeDays: number;
}

export interface MetricsData {
  revenue: {
    current: number;
    forecasted: number;
    trend: number;
  };
  topProducts?: Array<{
    id: string;
    name: string;
    predictedDemand: number;
    revenue: number;
  }>;
  seasonalTrends?: Array<{
    month: number;
    averageSales: number;
    seasonalFactor: number;
  }>;
}

interface MLServiceResponse {
  forecastData: ForecastDataPoint[];
  recommendations: ReorderRecommendation[];
  metrics: MetricsData;
  modelUsed: string;
  confidence: number;
  generatedAt: string;
}

const ML_SERVICE_URL = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://localhost:8000';

export function useMLForecasting() {
  const { products, transactions } = useFirebase();
  const [state, setState] = useState({
    loading: true,
    forecastData: [] as ForecastDataPoint[],
    recommendations: [] as ReorderRecommendation[],
    metrics: null as MetricsData | null,
    usingML: false,
    error: null as string | null,
    dataLoaded: false
  });

  const fetchInProgress = useRef(false);
  const initialLoadDone = useRef(false);

  const generateLocalForecast = useCallback(() => {
    console.log('📊 Generating local fallback forecast');
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    
    const forecast: ForecastDataPoint[] = [];
    // Last 6 months of history
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      forecast.push({
        month: months[monthIndex],
        value: 40 + Math.random() * 20,
        type: 'history'
      });
    }
    // Next 3 months forecast
    for (let i = 1; i <= 3; i++) {
      const monthIndex = (currentMonth + i) % 12;
      forecast.push({
        month: months[monthIndex],
        value: 60 + Math.random() * 30,
        type: 'forecast'
      });
    }
    
    // Simple recommendations from low stock products
    const lowStockRecs: ReorderRecommendation[] = products
      .filter((p: Product) => p.stock <= p.reorderPoint)
      .slice(0, 3)
      .map((p: Product) => ({
        productId: p.id,
        productName: p.name,
        currentStock: p.stock,
        predictedDemand: p.reorderPoint * 2,
        daysUntilOut: Math.max(1, Math.floor(p.stock / 0.5)),
        recommendedOrder: Math.max(p.reorderPoint * 2 - p.stock, p.reorderPoint),
        confidence: 'medium',
        trend: 'stable',
        leadTimeDays: p.leadTimeDays
      }));
    
    const completedTransactions = transactions.filter((t: Transaction) => t.status === 'completed');
    const totalRevenue = completedTransactions
      .reduce((sum: number, t: Transaction) => sum + t.total, 0);
    
    setState({
      loading: false,
      forecastData: forecast,
      recommendations: lowStockRecs,
      metrics: {
        revenue: {
          current: totalRevenue,
          forecasted: totalRevenue * 1.1,
          trend: 10
        }
      },
      usingML: false,
      error: null,
      dataLoaded: true
    });
  }, [products, transactions]);

  const fetchMLForecast = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (fetchInProgress.current || state.dataLoaded) {
      console.log('📊 Fetch already in progress or data loaded, skipping...');
      return;
    }

    // Don't fetch if no data
    if (products.length === 0 || transactions.length === 0) {
      console.log('📊 No data available for forecasting');
      generateLocalForecast();
      return;
    }

    fetchInProgress.current = true;

    try {
      console.log('📊 Attempting to connect to ML service at:', ML_SERVICE_URL);
      
      const completedTransactions = transactions.filter((t: Transaction) => t.status === 'completed');
      
      // Only proceed if we have enough data
      if (completedTransactions.length < 3) {
        console.log('📊 Not enough completed transactions for ML, using local forecast');
        generateLocalForecast();
        fetchInProgress.current = false;
        return;
      }
      
      console.log(`📊 Sending ${completedTransactions.length} transactions and ${products.length} products to ML service`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${ML_SERVICE_URL}/api/forecast/demand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: completedTransactions,
          products: products,
          forecastMonths: 3
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ML service returned ${response.status}`);
      }

      const data: MLServiceResponse = await response.json();
      
      console.log('📊 ML Service Response:', {
        modelUsed: data.modelUsed,
        confidence: data.confidence,
        forecastLength: data.forecastData?.length,
        recommendationsCount: data.recommendations?.length
      });

      setState({
        loading: false,
        forecastData: data.forecastData || [],
        recommendations: data.recommendations || [],
        metrics: data.metrics || null,
        usingML: data.modelUsed !== 'fallback',
        error: null,
        dataLoaded: true
      });

    } catch (error) {
      console.error('❌ ML Service Error:', error);
      // Fallback to local calculations
      generateLocalForecast();
    } finally {
      fetchInProgress.current = false;
    }
  }, [products, transactions, generateLocalForecast, state.dataLoaded]);

  // Single initial fetch
  useEffect(() => {
    if (!initialLoadDone.current && (products.length > 0 || transactions.length > 0)) {
      initialLoadDone.current = true;
      fetchMLForecast();
    }
  }, [products.length, transactions.length, fetchMLForecast]);

  return state;
}