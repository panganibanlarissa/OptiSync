// src/services/mlService.ts
import { Product, Transaction } from '@/context/FirebaseContext';

export interface MLForecastRequest {
  transactions: Transaction[];
  products: Product[];
  forecastMonths?: number;
}

export interface MLForecastResponse {
  forecastData: Array<{
    month: string;
    value: number;
    type: 'history' | 'forecast';
    lower?: number;
    upper?: number;
    model?: string;
  }>;
  recommendations: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    predictedDemand: number;
    daysUntilOut: number;
    recommendedOrder: number;
    confidence: 'high' | 'medium' | 'low';
    trend: 'up' | 'down' | 'stable';
    leadTimeDays: number;
  }>;
  metrics: {
    revenue: {
      current: number;
      forecasted: number;
      trend: number;
    };
  };
  modelUsed: string;
  confidence: number;
  generatedAt: string;
}

const ML_SERVICE_URL = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://localhost:8000';

export async function getDemandForecast({ 
  transactions, 
  products, 
  forecastMonths = 3 
}: MLForecastRequest): Promise<MLForecastResponse | null> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/api/forecast/demand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactions,
        products,
        forecastMonths
      })
    });

    if (!response.ok) {
      throw new Error('Forecast failed');
    }

    return await response.json();
  } catch (error) {
    console.error('ML Service error:', error);
    return null;
  }
}