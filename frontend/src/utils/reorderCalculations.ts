/**
 * Smart Reorder Point Calculation Utility
 * Provides consistent calculation logic across the application
 */

export const calculateSmartReorderPoint = (
  staticReorderPoint: number,
  currentStock: number,
  predictedDemand30d: number,
  daysUntilStockout: number,
  leadTime: number,
  trend: 'up' | 'down' | 'stable'
): { smartPoint: number; adjustmentReason: string } => {
  // Base calculation: static reorder point
  let smartPoint = staticReorderPoint;
  let adjustmentFactors: string[] = [];

  // Factor 1: Lead time buffer
  // If lead time is significant, we need more safety stock
  const dailyDemand = predictedDemand30d / 30;
  const leadTimeBuffer = Math.ceil(dailyDemand * leadTime);
  
  // Factor 2: Demand surge protection
  // If trend is upward, increase buffer; if downward, slightly reduce
  let demandMultiplier = 1;
  if (trend === 'up') {
    demandMultiplier = 1.05; // 5% increase for rising demand
    adjustmentFactors.push('Increasing demand trend (+5%)');
  } else if (trend === 'down') {
    demandMultiplier = 0.95; // 5% decrease for declining demand
    adjustmentFactors.push('Declining demand trend');
  } else {
    adjustmentFactors.push('Stable demand trend');
  }

  // Factor 3: Days until stockout analysis
  // If stockout is imminent (less than lead time), increase reorder point urgently
  let urgencyMultiplier = 1;
  if (daysUntilStockout <= leadTime && daysUntilStockout > 0) {
    urgencyMultiplier = 1.25; // 25% increase for urgent restock
    adjustmentFactors.push('will run out very soon');
  } else if (daysUntilStockout <= leadTime * 1.5) {
    urgencyMultiplier = 1.1; // 10% increase for approaching deadline
    adjustmentFactors.push('running low soon');
  }

  // Calculate final smart reorder point
  smartPoint = Math.ceil(
    staticReorderPoint * demandMultiplier * urgencyMultiplier + 
    leadTimeBuffer
  );

  const reason = adjustmentFactors.join(' | ');
  return { smartPoint, adjustmentReason: reason };
};

/**
 * Simplified reorder point calculation for products without ML data
 * Used when ML forecasting data is not available
 */
export const calculateSmartReorderPointSimple = (
  staticReorderPoint: number,
  leadTime: number,
  category: string
): { smartPoint: number; adjustmentReason: string } => {
  let smartPoint = staticReorderPoint;
  let adjustmentFactors: string[] = [];

  // Factor 1: Lead time buffer (assume 2 units per day minimum)
  const estimatedDailyDemand = 2;
  const leadTimeBuffer = Math.ceil(estimatedDailyDemand * leadTime);
  
  // Factor 2: Category-based adjustments
  let categoryMultiplier = 1;
  if (category === 'Contact Lenses' || category === 'Solutions') {
    categoryMultiplier = 1.2; // 20% increase for perishables
    adjustmentFactors.push('expires quickly (needs extra safety stock)');
  } else {
    adjustmentFactors.push('standard item');
  }

  // Calculate final smart reorder point
  smartPoint = Math.ceil(staticReorderPoint * categoryMultiplier + leadTimeBuffer);

  const reason = adjustmentFactors.join(' | ');
  return { smartPoint, adjustmentReason: reason };
};
