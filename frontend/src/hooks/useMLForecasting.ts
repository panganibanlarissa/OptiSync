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
  mlServiceChecked: boolean;
}

interface CachedMLData {
  timestamp: number;
  usingML: boolean;
  forecastData: ForecastDataPoint[];
  recommendations: Recommendation[];
  deadstockSuggestions: Array<{ productId: string; suggestion: DeadstockAISuggestion }>;
  mlServiceAvailable: boolean;
  version: string;
}

const CACHE_KEY = 'ml_forecast_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache
const CACHE_VERSION = '1.0';

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

// Save ML data to cache
function saveToCache(data: {
  usingML: boolean;
  forecastData: ForecastDataPoint[];
  recommendations: Recommendation[];
  deadstockSuggestions: Map<string, DeadstockAISuggestion>;
  mlServiceAvailable: boolean;
}) {
  try {
    const cacheData: CachedMLData = {
      timestamp: Date.now(),
      usingML: data.usingML,
      forecastData: data.forecastData,
      recommendations: data.recommendations,
      deadstockSuggestions: Array.from(data.deadstockSuggestions.entries()).map(([productId, suggestion]) => ({
        productId,
        suggestion
      })),
      mlServiceAvailable: data.mlServiceAvailable,
      version: CACHE_VERSION
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log('ML data cached successfully');
  } catch (error) {
    console.error('Failed to cache ML data:', error);
  }
}

// Load ML data from cache
function loadFromCache(): CachedMLData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedMLData = JSON.parse(cached);
    
    // Check if cache is expired
    if (Date.now() - data.timestamp > CACHE_DURATION) {
      console.log('ML cache expired');
      return null;
    }
    
    // Check version compatibility
    if (data.version !== CACHE_VERSION) {
      console.log('ML cache version mismatch');
      return null;
    }
    
    console.log('ML cache hit', {
      age: Math.round((Date.now() - data.timestamp) / 1000 / 60),
      minutes: 'minutes ago'
    });
    return data;
  } catch (error) {
    console.error('Failed to load ML cache:', error);
    return null;
  }
}

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
    mlServiceChecked: false,
  });
  
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // Load cached data immediately on mount
  useEffect(() => {
    const cachedData = loadFromCache();
    if (cachedData) {
      console.log('Loading ML data from cache for instant display');
      setState({
        loading: false,
        usingML: cachedData.usingML,
        forecastData: cachedData.forecastData,
        recommendations: cachedData.recommendations,
        deadstockSuggestions: new Map(cachedData.deadstockSuggestions.map(item => [item.productId, item.suggestion])),
        dataLoaded: true,
        mlServiceAvailable: cachedData.mlServiceAvailable,
        mlServiceChecked: true,
      });
      loadedRef.current = true;
      initialLoadDoneRef.current = true;
    }
  }, []);

  const loadForecasts = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current) {
      console.log('Already loading forecasts, skipping');
      return;
    }

    // If we already loaded from cache, still refresh in background
    const shouldRefresh = initialLoadDoneRef.current;
    
    loadingRef.current = true;
    
    // Set a timeout to prevent infinite loading (8 seconds max for background refresh)
    const timeoutId = setTimeout(() => {
      if (loadingRef.current && !loadedRef.current) {
        console.log('ML Forecasting timeout - using fallback');
        const fallbackData = {
          usingML: false,
          forecastData: generateHistoryOnlyData(transactions),
          recommendations: [],
          deadstockSuggestions: new Map(),
          mlServiceAvailable: false,
        };
        
        setState(prev => ({
          ...prev,
          loading: false,
          dataLoaded: true,
          mlServiceChecked: true,
          ...fallbackData,
        }));
        
        if (!initialLoadDoneRef.current) {
          saveToCache(fallbackData);
        }
        
        loadingRef.current = false;
        loadedRef.current = true;
      }
    }, 8000);

    try {
      console.log(shouldRefresh ? 'Refreshing ML data in background...' : 'Loading ML forecasts...');
      
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

      // Quick health check with short timeout
      try {
        const healthCheckPromise = mlApiClient.healthCheck();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 3000)
        );
        
        const healthCheck = await Promise.race([healthCheckPromise, timeoutPromise]) as any;
        
        if (healthCheck && healthCheck.status === 'healthy') {
          mlServiceAvailable = true;
          console.log('✅ ML Service available');
          
          try {
            const result = await mlApiClient.generateForecast(productData, transactionData);
            
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
                  }
                });
              });
            }
          } catch (apiError) {
            console.log('ML API error:', apiError);
            forecastData = generateHistoryOnlyData(transactions);
          }
        } else {
          forecastData = generateHistoryOnlyData(transactions);
        }
      } catch (healthError) {
        console.log('ML Service unavailable');
        forecastData = generateHistoryOnlyData(transactions);
      }

      const newState = {
        usingML,
        forecastData,
        recommendations,
        deadstockSuggestions,
        mlServiceAvailable,
      };

      // Update state
      setState(prev => ({
        ...prev,
        loading: false,
        dataLoaded: true,
        mlServiceChecked: true,
        ...newState,
      }));

      // Save to cache for future fast loads
      saveToCache(newState);
      
      loadedRef.current = true;
      initialLoadDoneRef.current = true;

      console.log('ML data loaded successfully', {
        usingML,
        recommendationsCount: recommendations.length,
        deadstockCount: deadstockSuggestions.size,
      });

    } catch (error) {
      console.error('Error loading forecasts:', error);
      
      const fallbackData = {
        usingML: false,
        forecastData: generateHistoryOnlyData(transactions),
        recommendations: [],
        deadstockSuggestions: new Map(),
        mlServiceAvailable: false,
      };
      
      setState(prev => ({
        ...prev,
        loading: false,
        dataLoaded: true,
        mlServiceChecked: true,
        ...fallbackData,
      }));
      
      if (!initialLoadDoneRef.current) {
        saveToCache(fallbackData);
      }
      
      loadedRef.current = true;
      initialLoadDoneRef.current = true;
    } finally {
      clearTimeout(timeoutId);
      loadingRef.current = false;
    }
  }, [products, transactions]);

  // Load forecasts when products/transactions are available, but only if no cached data
  useEffect(() => {
    if (!initialLoadDoneRef.current && !loadedRef.current && !loadingRef.current) {
      // Small delay to allow cache to load first
      const timer = setTimeout(() => {
        if (!initialLoadDoneRef.current && products.length > 0) {
          loadForecasts();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [products, transactions, loadForecasts]);

  // Refresh forecasts in background periodically (every 30 minutes)
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;
    
    const interval = setInterval(() => {
      if (!loadingRef.current) {
        console.log('Background refresh of ML data...');
        loadForecasts();
      }
    }, CACHE_DURATION);
    
    return () => clearInterval(interval);
  }, [loadForecasts]);

  return state;
}