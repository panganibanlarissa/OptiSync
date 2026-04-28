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
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadForecasts = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current || loadedRef.current) {
      console.log('Skipping forecast load - already loading or loaded');
      return;
    }

    // Don't load if no products
    if (!products.length) {
      console.log('No products available, setting fallback data');
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        dataLoaded: true,
        mlServiceChecked: true,
        mlServiceAvailable: false,
        usingML: false,
        forecastData: generateHistoryOnlyData(transactions),
      }));
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    loadingRef.current = true;
    
    // Set a timeout to prevent infinite loading (5 seconds max)
    const timeoutId = setTimeout(() => {
      if (loadingRef.current) {
        console.log('ML Forecasting timeout - showing fallback data');
        setState(prev => ({
          ...prev,
          loading: false,
          dataLoaded: true,
          mlServiceChecked: true,
          mlServiceAvailable: false,
          usingML: false,
          forecastData: generateHistoryOnlyData(transactions),
          recommendations: [],
          deadstockSuggestions: new Map(),
        }));
        loadingRef.current = false;
        loadedRef.current = true;
      }
    }, 5000);

    try {
      console.log('Starting ML forecast load...');
      
      // Prepare data for API with properly formatted createdAt
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

      // Quick health check first (with short timeout)
      try {
        console.log('Checking ML service health...');
        const healthCheckPromise = mlApiClient.healthCheck();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 3000)
        );
        
        const healthCheck = await Promise.race([healthCheckPromise, timeoutPromise]) as any;
        
        if (healthCheck && healthCheck.status === 'healthy') {
          mlServiceAvailable = true;
          console.log('✅ Python ML Service is available, using Prophet/Scikit-learn');
          
          try {
            console.log('Requesting forecast from ML service...');
            const result = await mlApiClient.generateForecast(productData, transactionData);
            
            console.log('🔍 ML API Response:', {
              usingML: result.usingML,
              dataPoints: result.dataPoints,
              recommendationsCount: result.recommendations?.length || 0,
              deadstockSuggestionsCount: result.deadstockSuggestions?.length || 0
            });
            
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
              console.log('📝 Processing Prophet-enhanced deadstock suggestions:', result.deadstockSuggestions.length);
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
          } catch (apiError) {
            console.log('❌ ML API forecast error:', apiError);
            mlServiceAvailable = false;
            usingML = false;
            forecastData = generateHistoryOnlyData(transactions);
          }
        } else {
          throw new Error('ML service not available');
        }
      } catch (healthError) {
        console.log('❌ Python ML Service unavailable. AI features disabled.');
        mlServiceAvailable = false;
        usingML = false;
        forecastData = generateHistoryOnlyData(transactions);
        recommendations = [];
        deadstockSuggestions = new Map();
      }

      setState({
        loading: false,
        usingML,
        forecastData,
        recommendations,
        deadstockSuggestions,
        dataLoaded: true,
        mlServiceAvailable,
        mlServiceChecked: true,
      });

      loadedRef.current = true;

      console.group('===== DEMAND FORECASTING AI ANALYSIS =====');
      console.log('ML Service Source:', mlServiceAvailable ? 'Python (Prophet/SK)' : 'UNAVAILABLE - AI Disabled');
      console.log('Using ML:', usingML);
      console.log('Recommendations:', recommendations.length);
      console.log('Deadstock AI Suggestions:', deadstockSuggestions.size);
      console.groupEnd();

    } catch (error) {
      console.error('Error loading forecasts:', error);
      
      setState({
        loading: false,
        usingML: false,
        forecastData: generateHistoryOnlyData(transactions),
        recommendations: [],
        deadstockSuggestions: new Map(),
        dataLoaded: true,
        mlServiceAvailable: false,
        mlServiceChecked: true,
      });
      loadedRef.current = true;
    } finally {
      clearTimeout(timeoutId);
      loadingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [products, transactions]);

  // Reset loaded state when products/transactions change significantly
  useEffect(() => {
    // Reset flags when data changes significantly
    const resetTimer = setTimeout(() => {
      loadedRef.current = false;
      loadingRef.current = false;
    }, 500);
    
    return () => clearTimeout(resetTimer);
  }, [products.length, transactions.length]);

  useEffect(() => {
    // Small delay to allow products/transactions to load first
    const loadTimer = setTimeout(() => {
      if (!loadedRef.current && !loadingRef.current) {
        loadForecasts();
      }
    }, 200);
    
    return () => clearTimeout(loadTimer);
  }, [loadForecasts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return state;
}