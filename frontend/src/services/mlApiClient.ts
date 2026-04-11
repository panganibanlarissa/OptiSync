// src/services/mlApiClient.ts

const ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:8000';

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
}

export interface TransactionData {
  id: string;
  total: number;
  date: string;
  status: string;
  items: Array<{ id: string; name: string; quantity: number; price: number }>;
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
    predictedDemand: number;
    recommendedOrder: number;
    daysUntilOut: number;
    trend: 'up' | 'down' | 'stable';
    confidence: 'high' | 'medium' | 'low';
  }>;
  usingML: boolean;
  dataPoints: number;
  modelUsed: string;        // NEW: Which ML model was used
  confidenceInterval: {     // NEW: Confidence interval for forecasts
    lower: number;
    upper: number;
  };
}

export interface DeadstockResponse {
  productId: string;
  productName: string;
  stock: number;
  daysUnsold: number;
  lockedCapital: number;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
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

  async analyzeDeadstock(
    products: ProductData[],
    transactions: TransactionData[]
  ): Promise<DeadstockResponse[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/deadstock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products, transactions }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML API deadstock error:', error);
      throw error;
    }
  }

  async predictDemand(
    product: ProductData,
    transactions: TransactionData[]
  ): Promise<{
    productId: string;
    productName: string;
    predictedDemand: number;
    confidence: string;
    usingML: boolean;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/demand`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product, transactions }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML API demand error:', error);
      throw error;
    }
  }
}

export const mlApiClient = new MLApiClient();