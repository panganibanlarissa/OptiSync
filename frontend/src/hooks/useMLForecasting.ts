// src/hooks/useMLForecasting.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFirebase } from '@/context/FirebaseContext';
import { mlApiClient, ProductData, TransactionData, DeadstockSuggestion } from '@/services/mlApiClient';

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

export interface DeadstockAISuggestion {
  productId: string;
  suggestion: string;
  suggestionType: 'critical' | 'warning' | 'info';
  recommendedDiscount: number;
  mlFactors: {
    daysFactor: number;
    capitalFactor: number;
    categoryUrgency: number;
    velocityFactor: number;
    finalDiscount: number;
    ml_adjustment?: number;
    prophet_confidence?: string;
    predicted_sale_probability?: number;
    expected_sales_next_30d?: number;
    trend_description?: string;
  };
}

interface MLForecastingState {
  loading: boolean;
  usingML: boolean;
  forecastData: ForecastDataPoint[];
  recommendations: Recommendation[];
  deadstockSuggestions: Map<string, DeadstockAISuggestion>;
  dataLoaded: boolean;
  mlServiceAvailable: boolean;
  error: string | null;
}

// Helper to safely convert Firestore timestamp to ISO string
const formatCreatedAt = (createdAt: any): string | null => {
  if (!createdAt) return null;
  
  try {
    if (createdAt instanceof Date) {
      return createdAt.toISOString();
    }
    
    if (typeof createdAt === 'object' && createdAt.toDate) {
      return createdAt.toDate().toISOString();
    }
    
    if (createdAt.seconds) {
      return new Date(createdAt.seconds * 1000).toISOString();
    }
    
    if (typeof createdAt === 'string') {
      return createdAt;
    }
  } catch (e) {
    console.error('Error formatting createdAt:', e);
  }
  
  return null;
};

// Cache key for localStorage
const CACHE_KEY = 'ml_forecasting_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

interface CachedData {
  timestamp: number;
  usingML: boolean;
  forecastData: ForecastDataPoint[];
  recommendations: Recommendation[];
  deadstockSuggestions: Array<[string, DeadstockAISuggestion]>;
  mlServiceAvailable: boolean;
  dataPoints: number;
}

// Generate history-only data (no forecasts) for when ML is unavailable
function generateHistoryOnlyData(transactions: any[]): ForecastDataPoint[] {
  const result: ForecastDataPoint[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const salesByMonth = new Map<string, number>();
  const completedTransactions = transactions.filter(t => t.status === 'completed');
  
  completedTransactions.forEach(t => {
    const date = new Date(t.date);
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    salesByMonth.set(monthKey, (salesByMonth.get(monthKey) || 0) + t.total);
  });
  
  for (let i = 5; i >= 0; i--) {
    const monthIndex = (currentMonth - i + 12) % 12;
    const year = currentYear - (currentMonth - i < 0 ? 1 : 0);
    const monthKey = `${year}-${monthIndex + 1}`;
    const sales = salesByMonth.get(monthKey) || 0;
    
    result.push({
      month: monthNames[monthIndex],
      value: sales,
      type: 'history'
    });
  }
  
  return result;
}

// Save to localStorage cache
const saveToCache = (data: CachedData) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    console.log('💾 ML Forecast data cached');
  } catch (e) {
    console.warn('Failed to cache ML forecast data:', e);
  }
};

// Load from localStorage cache
const loadFromCache = (): CachedData | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as CachedData;
    const isExpired = Date.now() - data.timestamp > CACHE_DURATION;
    
    if (isExpired) {
      console.log('🗑️ ML Forecast cache expired');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    console.log('📦 ML Forecast cache hit');
    return data;
  } catch (e) {
    console.warn('Failed to load cached ML forecast:', e);
    return null;
  }
};

export function useMLForecasting() {
  const { products, transactions } = useFirebase();
  const [state, setState] = useState<MLForecastingState>({
    loading: true,
    usingML: false,
    forecastData: [],
    recommendations: [],
    deadstockSuggestions: new Map(),
    dataLoaded: false,
    mlServiceAvailable: false,
    error: null,
  });
  
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingPromiseRef = useRef<Promise<void> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadForecasts = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingPromiseRef.current) {
      return loadingPromiseRef.current;
    }

    const loadPromise = (async () => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create new abort controller
      abortControllerRef.current = new AbortController();
      
      // First, try to load from cache for immediate display
      const cachedData = loadFromCache();
      
      if (cachedData && isMountedRef.current) {
        console.log('📦 Using cached ML forecast data for immediate display');
        setState(prev => ({
          ...prev,
          usingML: cachedData.usingML,
          forecastData: cachedData.forecastData,
          recommendations: cachedData.recommendations,
          deadstockSuggestions: new Map(cachedData.deadstockSuggestions),
          mlServiceAvailable: cachedData.mlServiceAvailable,
          dataLoaded: true,
          loading: true, // Still loading for fresh data
          error: null,
        }));
      }

      // Wait for products to be available
      if (!products.length) {
        if (isMountedRef.current) {
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            dataLoaded: true,
            error: null,
          }));
        }
        return;
      }

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
          createdAt: formatCreatedAt((p as any).createdAt),
        }));

        const transactionData: TransactionData[] = transactions.map(t => ({
          id: t.id,
          total: t.total,
          date: t.date instanceof Date ? t.date.toISOString() : new Date(t.date).toISOString(),
          status: t.status,
          items: t.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
        }));

        let mlServiceAvailable = false;
        let forecastData: ForecastDataPoint[] = [];
        let recommendations: Recommendation[] = [];
        let deadstockSuggestions = new Map<string, DeadstockAISuggestion>();
        let usingML = false;

        // Try to fetch from ML service with timeout
        try {
          const healthCheckPromise = mlApiClient.healthCheck();
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 3000);
          });
          
          const healthCheck = await Promise.race([healthCheckPromise, timeoutPromise]);
          
          if (healthCheck && healthCheck.status === 'healthy' && isMountedRef.current) {
            mlServiceAvailable = true;
            console.log('✅ Python ML Service is available');
            
            const forecastPromise = mlApiClient.generateForecast(productData, transactionData);
            const forecastTimeoutPromise = new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), 30000);
            });
            
            const result = await Promise.race([forecastPromise, forecastTimeoutPromise]);
            
            if (result && !(result === null) && isMountedRef.current) {
              usingML = result.usingML || false;
              
              if (usingML) {
                forecastData = result.forecastData || [];
              } else {
                forecastData = generateHistoryOnlyData(transactions);
              }
              
              recommendations = (result.recommendations || []).map((rec: any) => ({
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
              }));
              
              if (result.deadstockSuggestions && Array.isArray(result.deadstockSuggestions)) {
                result.deadstockSuggestions.forEach((suggestion: any) => {
                  deadstockSuggestions.set(suggestion.productId, {
                    productId: suggestion.productId,
                    suggestion: suggestion.suggestion,
                    suggestionType: suggestion.suggestionType || 'info',
                    recommendedDiscount: suggestion.recommendedDiscount || 0,
                    mlFactors: suggestion.mlFactors || {
                      daysFactor: 0,
                      capitalFactor: 0,
                      categoryUrgency: 1.0,
                      velocityFactor: 0,
                      finalDiscount: 0,
                      ml_adjustment: 0,
                      prophet_confidence: 'low',
                      predicted_sale_probability: 0,
                      expected_sales_next_30d: 0,
                      trend_description: 'No ML data'
                    }
                  });
                });
              }
              
              saveToCache({
                timestamp: Date.now(),
                usingML,
                forecastData,
                recommendations,
                deadstockSuggestions: Array.from(deadstockSuggestions.entries()),
                mlServiceAvailable,
                dataPoints: result.dataPoints || 0
              });
            } else if (isMountedRef.current) {
              usingML = false;
              forecastData = generateHistoryOnlyData(transactions);
            }
          } else if (isMountedRef.current) {
            usingML = false;
            forecastData = generateHistoryOnlyData(transactions);
          }
        } catch (apiError) {
          console.log('❌ Python ML Service unavailable or timeout');
          if (isMountedRef.current) {
            usingML = false;
            forecastData = generateHistoryOnlyData(transactions);
          }
        }

        if (isMountedRef.current) {
          setState({
            loading: false,
            usingML,
            forecastData,
            recommendations,
            deadstockSuggestions,
            dataLoaded: true,
            mlServiceAvailable,
            error: null,
          });
        }

        console.group('===== DEMAND FORECASTING AI ANALYSIS =====');
        console.log('ML Service Source:', mlServiceAvailable ? 'Python (Prophet/SK)' : 'UNAVAILABLE - Using History Data');
        console.log('Using ML:', usingML);
        console.log('Recommendations:', recommendations.length);
        console.log('Deadstock Suggestions:', deadstockSuggestions.size);
        console.groupEnd();

      } catch (error) {
        console.error('Error loading forecasts:', error);
        
        if (isMountedRef.current) {
          setState({
            loading: false,
            usingML: false,
            forecastData: generateHistoryOnlyData(transactions),
            recommendations: [],
            deadstockSuggestions: new Map(),
            dataLoaded: true,
            mlServiceAvailable: false,
            error: error instanceof Error ? error.message : 'Failed to load forecasts',
          });
        }
      }
    })();

    loadingPromiseRef.current = loadPromise;
    await loadPromise;
    loadingPromiseRef.current = null;
  }, [products, transactions]);

  // Initial load
  useEffect(() => {
    loadForecasts();
  }, [loadForecasts]);

  // Refetch when products or transactions change significantly
  useEffect(() => {
    if (products.length > 0 || transactions.length > 0) {
      const timer = setTimeout(() => {
        loadForecasts();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [products.length, transactions.length, loadForecasts]);

  return state;
}

// Also export as default for backward compatibility
export default useMLForecasting;