import { useQuery } from "@tanstack/react-query";
import {
  PlanName,
  FeatureKey,
  isFeatureInPlan,
  ALL_FEATURES,
  getFeatureByKey,
  PLAN_INFO,
} from "@/lib/plan-features";

interface Subscription {
  plan: PlanName;
  isActive: boolean;
  maxBranches: number;
  maxEmployees: number;
  maxProducts: number;
  inventoryManagement: boolean;
  recipeManagement: boolean;
  accountingModule: boolean;
  erpIntegration: boolean;
  deliveryManagement: boolean;
  loyaltyProgram: boolean;
  giftCards: boolean;
  tableManagement: boolean;
  kitchenDisplay: boolean;
  posSystem: boolean;
  payrollManagement: boolean;
  supplierManagement: boolean;
  warehouseManagement: boolean;
  zatcaCompliance: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  customBranding: boolean;
}

interface BusinessConfig {
  subscription?: Subscription;
}

export function usePlan() {
  const { data: config } = useQuery<BusinessConfig>({
    queryKey: ["/api/business-config"],
  });

  const subscription = config?.subscription;
  const plan: PlanName = subscription?.plan || "infinity";
  const isActive = subscription?.isActive ?? true;

  function hasFeature(featureKey: FeatureKey | string): boolean {
    if (!isActive) return false;

    const featureDef = getFeatureByKey(featureKey);
    if (!featureDef) return true;

    const directKey = featureKey as keyof Subscription;
    if (subscription && directKey in subscription && typeof (subscription as any)[directKey] === 'boolean') {
      return (subscription as any)[directKey] as boolean;
    }

    return isFeatureInPlan(featureDef.plan, plan);
  }

  function getLimit(limitKey: 'maxBranches' | 'maxEmployees' | 'maxProducts'): number {
    if (!subscription) {
      const defaults = { maxBranches: 1, maxEmployees: 5, maxProducts: 50 };
      return defaults[limitKey];
    }
    return subscription[limitKey] || 0;
  }

  const planInfo = PLAN_INFO[plan];

  return {
    plan,
    planInfo,
    isActive,
    subscription,
    hasFeature,
    getLimit,
    isLite: plan === 'lite',
    isPro: plan === 'pro',
    isInfinity: plan === 'infinity',
  };
}
