import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Sparkles, Coffee, ShoppingBag, Truck, PauseCircle } from "lucide-react";
import type { Order } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { PrepCountdown } from "@/components/PrepCountdown";
import { useTranslation } from "react-i18next";

interface OrderTrackerProps {
  order: Order;
  compact?: boolean;
}

const getStepIndex = (status: string) => {
  const statusMap: Record<string, number> = {
    pending: 0,
    confirmed: 0,
    awaiting_payment: 0,
    payment_confirmed: 1,
    in_progress: 2,
    ready: 3,
    delivered: 4,
    received: 5,
    completed: 5,
    suspended: 0,
    cancelled: -1,
    refunded: -1,
  };
  return statusMap[status] ?? 0;
};

export default function OrderTracker({ order, compact = false }: OrderTrackerProps) {
  const { t } = useTranslation();
  const [currentStepIndex, setCurrentStepIndex] = useState(getStepIndex(order.status));

  const orderSteps = [
    {
      id: "pending",
      label: t("order_tracker.placed"),
      icon: Clock,
      color: "text-yellow-400",
      bgColor: "bg-yellow-900/30",
      description: t("order_tracker.placed_desc"),
    },
    {
      id: "payment_confirmed",
      label: t("order_tracker.payment"),
      icon: CheckCircle2,
      color: "text-orange-400",
      bgColor: "bg-orange-900/30",
      description: t("order_tracker.payment_desc"),
    },
    {
      id: "in_progress",
      label: t("order_tracker.preparing"),
      icon: Coffee,
      color: "text-blue-400",
      bgColor: "bg-blue-900/30",
      description: t("order_tracker.preparing_desc"),
    },
    {
      id: "ready",
      label: t("order_tracker.ready"),
      icon: ShoppingBag,
      color: "text-purple-400",
      bgColor: "bg-purple-900/30",
      description: t("order_tracker.ready_desc"),
    },
    {
      id: "delivered",
      label: t("order_tracker.on_the_way"),
      icon: Truck,
      color: "text-teal-400",
      bgColor: "bg-teal-900/30",
      description: t("order_tracker.on_the_way_desc"),
    },
    {
      id: "completed",
      label: t("order_tracker.completed"),
      icon: CheckCircle2,
      color: "text-green-400",
      bgColor: "bg-green-900/30",
      description: t("order_tracker.completed_desc"),
    },
  ];

  const isCancelled = order.status === "cancelled" || order.status === "refunded";
  const isSuspended = order.status === "suspended";

  useEffect(() => {
    const stepIndex = getStepIndex(order.status);
    if (stepIndex !== -1 && stepIndex !== currentStepIndex) {
      setCurrentStepIndex(stepIndex);
    }
  }, [order.status]);

  const currentStep = isSuspended
    ? {
        id: "suspended",
        label: t("order_tracker.suspended"),
        icon: PauseCircle,
        color: "text-orange-400",
        bgColor: "bg-orange-900/30",
        description: t("order_tracker.suspended_desc"),
      }
    : isCancelled
    ? {
        id: "cancelled",
        label: order.status === "refunded" ? t("order_tracker.refunded") : t("order_tracker.cancelled"),
        icon: CheckCircle2,
        color: "text-red-400",
        bgColor: "bg-red-900/30",
        description: t("order_tracker.cancelled_desc"),
      }
    : (orderSteps[currentStepIndex] || orderSteps[0]);

  if (compact) {
    return (
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={order.status}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2"
          >
            <div className={`p-2 rounded-full ${currentStep.bgColor}`}>
              <currentStep.icon className={`w-5 h-5 ${currentStep.color}`} />
            </div>
            <div className="flex-1">
              <p className={`font-semibold ${currentStep.color}`}>{currentStep.label}</p>
              <p className="text-xs text-gray-400">{currentStep.description}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-[#2d1f1a] to-[#1a1410] border-amber-500/20 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-amber-500 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {t("order_tracker.track_title")}
            </h3>
            <p className="text-sm text-gray-400">{t("order_tracker.order_ref")} {order.orderNumber}</p>
          </div>
          <Badge className={`${currentStep.bgColor} ${currentStep.color} border-0 text-sm px-4 py-2`}>
            {currentStep.label}
          </Badge>
        </div>

        {!isCancelled && !isSuspended && (
          <div className="relative mb-8">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-700 -translate-y-1/2" />
            <motion.div
              className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-blue-500 via-amber-500 to-purple-500 -translate-y-1/2"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStepIndex / (orderSteps.length - 1)) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            <div className="relative flex justify-between">
              {orderSteps.map((step, index) => {
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;
                const StepIcon = step.icon;
                return (
                  <motion.div
                    key={step.id}
                    initial={false}
                    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className={`relative p-3 rounded-full border-2 transition-all duration-300
                      ${isActive ? `${step.bgColor} ${step.color} border-current shadow-lg` : ''}
                      ${isCompleted ? 'bg-green-500/20 text-green-500 border-green-500' : ''}
                      ${!isActive && !isCompleted ? 'bg-gray-800 text-gray-500 border-gray-600' : ''}
                    `}>
                      <StepIcon className="w-6 h-6" />
                      {isActive && (
                        <motion.div
                          className="absolute -inset-1 rounded-full border-2 border-current"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1.2, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                        />
                      )}
                    </div>
                    <p className={`text-xs font-medium text-center max-w-[60px] transition-colors
                      ${isActive ? step.color : ''}
                      ${isCompleted ? 'text-green-500' : ''}
                      ${!isActive && !isCompleted ? 'text-gray-500' : ''}
                    `}>
                      {step.label}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className={`p-4 rounded-lg ${currentStep.bgColor} border border-current/30`}
          >
            <div className="flex items-start gap-3">
              <currentStep.icon className={`w-6 h-6 ${currentStep.color} mt-0.5`} />
              <div className="flex-1">
                <h4 className={`font-bold ${currentStep.color} mb-1`}>{currentStep.label}</h4>
                <p className="text-gray-300 text-sm">{currentStep.description}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {(order.status === "pending" || order.status === "payment_confirmed" || order.status === "in_progress") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            {(order as any).estimatedPrepTimeInMinutes ? (
              <PrepCountdown
                estimatedPrepTimeInMinutes={(order as any).estimatedPrepTimeInMinutes}
                prepTimeSetAt={(order as any).prepTimeSetAt}
                status={order.status}
              />
            ) : (
              <p className="text-sm text-gray-400 text-center">
                <Clock className="w-4 h-4 inline ml-1" />
                {order.status === "payment_confirmed"
                  ? t("order_tracker.confirming_payment")
                  : t("order_tracker.still_preparing")}
              </p>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
