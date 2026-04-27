// src/services/mlApiClient.ts

const ML_API_URL = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://localhost:8000';

export interface ProductData {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  markupPrice: number;
  baseCost: number;
  reorderPoint: number;
  lastMovedDaysAgo: number;
  createdAt: string | null;
}

export interface TransactionData {
  id: string;
  total: number;
  date: string;
  status: string;
  items: Array<{ id: string; name: string; quantity: number; price: number }>;
}

export interface DeadstockSuggestion {
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
  };
}

export interface ForecastResponse {
  forecastData: Array<{
    month: string;
    value: number;
    type: 'history' | 'forecast';
    lower?: number;
    upper?: number;
  }>;
  recommendations: Array<{
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
  }>;
  deadstockSuggestions?: DeadstockSuggestion[];
  usingML: boolean;
  dataPoints: number;
}

class MLApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = ML_API_URL;
    this.timeout = 30000; // 30 seconds
  }

  async healthCheck(): Promise<{ status: string; ml_engine: string; version: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout),
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  async generateForecast(
    products: ProductData[],
    transactions: TransactionData[]
  ): Promise<ForecastResponse> {
    try {
      // Ensure all required fields are present and properly formatted
      const payload = {
        products: products.map(p => ({
          id: p.id,
          sku: p.sku || '',
          name: p.name || '',
          category: p.category || 'Uncategorized',
          stock: typeof p.stock === 'number' ? p.stock : 0,
          markupPrice: typeof p.markupPrice === 'number' ? p.markupPrice : 0,
          baseCost: typeof p.baseCost === 'number' ? p.baseCost : 0,
          reorderPoint: typeof p.reorderPoint === 'number' ? p.reorderPoint : 0,
          lastMovedDaysAgo: typeof p.lastMovedDaysAgo === 'number' ? p.lastMovedDaysAgo : 0,
          createdAt: p.createdAt || null,
        })),
        transactions: transactions.map(t => ({
          id: t.id,
          total: typeof t.total === 'number' ? t.total : 0,
          date: t.date || new Date().toISOString(),
          status: t.status || 'completed',
          items: (t.items || []).map(item => ({
            id: item.id || '',
            name: item.name || '',
            quantity: typeof item.quantity === 'number' ? item.quantity : 1,
            price: typeof item.price === 'number' ? item.price : 0,
          })),
        })),
        period: 'monthly',
      };

      // Validate payload before sending
      console.log('📤 Sending forecast request:', {
        productsCount: payload.products.length,
        transactionsCount: payload.transactions.length,
        sampleProduct: payload.products[0],
        sampleTransaction: payload.transactions[0],
      });

      const response = await fetch(`${this.baseUrl}/api/forecast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = JSON.stringify(errorData);
        } catch {
          errorText = await response.text();
        }
        console.error('❌ ML API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`ML API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ ML API success:', {
        usingML: result.usingML,
        recommendationsCount: result.recommendations?.length,
        forecastDataCount: result.forecastData?.length,
        deadstockSuggestionsCount: result.deadstockSuggestions?.length,
      });
      
      return result;
    } catch (error) {
      console.error('❌ ML API forecast error:', error);
      throw error;
    }
  }
}

export const mlApiClient = new MLApiClient();