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
  deadstockSuggestions?: DeadstockSuggestion[]; // NEW: AI suggestions for deadstock items
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
      const response = await fetch(`${this.baseUrl}/api/forecast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products,
          transactions,
          period: 'monthly',
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML API forecast error:', error);
      throw error;
    }
  }
}

export const mlApiClient = new MLApiClient();