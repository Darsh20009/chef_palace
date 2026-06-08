import { useLocation } from "wouter";
import { usePlan } from "@/hooks/usePlan";
import { getFeatureByKey, PLAN_INFO, PlanName, FeatureKey } from "@/lib/plan-features";
import { tc } from "@/lib/useTranslate";
import { Lock, ArrowUpCircle, Sparkles, Zap, Infinity } from "lucide-react";

interface PlanGateProps {
  feature: FeatureKey | string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PLAN_ICONS: Record<PlanName, React.ElementType> = {
  lite: Zap,
  pro: Sparkles,
  infinity: Infinity,
};

export function PlanGate({ feature, children, fallback }: PlanGateProps) {
  const { hasFeature, plan, planInfo } = usePlan();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const featureDef = getFeatureByKey(feature);
  const requiredPlan = featureDef?.plan || "pro";
  const requiredPlanInfo = PLAN_INFO[requiredPlan];
  const PlanIcon = PLAN_ICONS[requiredPlan];

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center space-y-6">
        <div
          className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-2"
          style={{ backgroundColor: requiredPlanInfo.color + '18', border: `2px solid ${requiredPlanInfo.color}40` }}
        >
          <Lock className="h-10 w-10" style={{ color: requiredPlanInfo.color }} />
        </div>

        <div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-3xl">{featureDef?.icon || "✨"}</span>
            <h2 className="text-2xl font-bold text-foreground">
              {tc(featureDef?.nameAr || "ميزة مقفلة", featureDef?.nameEn || "Locked Feature")}
            </h2>
          </div>
          <p className="text-muted-foreground text-base leading-relaxed">
            {tc(featureDef?.descAr || "هذه الميزة غير متاحة في باقتك الحالية", featureDef?.descEn || "This feature is not available in your current plan")}
          </p>
        </div>

        <div className="bg-muted/50 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm text-muted-foreground">
              {tc("باقتك الحالية:", "Your current plan:")}
            </span>
            <span
              className="text-sm font-bold px-3 py-1 rounded-full"
              style={{ backgroundColor: planInfo.color + '20', color: planInfo.color }}
            >
              {planInfo.icon} {tc(planInfo.nameAr, planInfo.nameEn)}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {tc("مطلوب:", "Required:")}
            </span>
            <span
              className="text-sm font-bold px-3 py-1 rounded-full"
              style={{ backgroundColor: requiredPlanInfo.color + '20', color: requiredPlanInfo.color }}
            >
              {requiredPlanInfo.icon} {tc(requiredPlanInfo.nameAr, requiredPlanInfo.nameEn)}
            </span>
          </div>
        </div>

        <div
          className="rounded-2xl p-6 text-white"
          style={{ background: `linear-gradient(135deg, ${requiredPlanInfo.color}, ${requiredPlanInfo.color}cc)` }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <PlanIcon className="h-5 w-5" />
            <span className="font-bold text-lg">
              {tc(`ترقية إلى ${requiredPlanInfo.nameAr}`, `Upgrade to ${requiredPlanInfo.nameEn}`)}
            </span>
          </div>
          <p className="text-white/80 text-sm mb-4">
            {tc(
              `ابدأ بـ ${requiredPlanInfo.priceAr} وافتح جميع مميزات الباقة`,
              `Start at ${requiredPlanInfo.priceEn} and unlock all plan features`
            )}
          </p>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white/20 hover:bg-white/30 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            {tc("اطلب الترقية", "Request Upgrade")}
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          {tc(
            "للترقية أو الاستفسار، تواصل مع فريق مكان الشيف",
            "To upgrade or inquire, contact the مكان الشيف team"
          )}
        </p>
      </div>
    </div>
  );
}

export function PlanBadge({ plan }: { plan: PlanName }) {
  const info = PLAN_INFO[plan];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border"
      style={{
        backgroundColor: info.color + '15',
        color: info.color,
        borderColor: info.color + '40',
      }}
    >
      {info.icon} {tc(info.nameAr, info.nameEn)}
    </span>
  );
}
