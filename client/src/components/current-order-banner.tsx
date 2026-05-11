import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, ArrowLeft, X, Truck } from "lucide-react";
import OrderTracker from "./order-tracker";
import type { Order } from "@shared/schema";
import { useState, useEffect } from "react";
import { useCustomer } from "@/contexts/CustomerContext";

export default function CurrentOrderBanner() {
 const [, setLocation] = useLocation();
 const { customer } = useCustomer();
 const [dismissed, setDismissed] = useState(false);
 const [customerPhone, setCustomerPhone] = useState("");

 useEffect(() => {
   // Get phone from customer context or localStorage (check multiple known keys)
   if (customer?.phone) {
     setCustomerPhone(customer.phone);
   } else {
     // Try multiple storage keys used in the app
     const keysToCheck = ["qahwa-customer-profile", "qahwa-customer", "currentCustomer"];
     for (const key of keysToCheck) {
       const saved = localStorage.getItem(key);
       if (saved) {
         try {
           const profile = JSON.parse(saved);
           if (profile?.phone) {
             setCustomerPhone(profile.phone);
             break;
           }
         } catch (e) { console.warn('[CurrentOrderBanner] Failed to parse customer profile:', e); }
       }
     }
   }
   // Reset dismissed state when phone changes
   setDismissed(false);
 }, [customer]);

 const { data: orders = [] } = useQuery<Order[]>({
   queryKey: ["/api/orders/customer", customerPhone],
   enabled: !!customerPhone && !dismissed,
   refetchInterval: 10000,
   queryFn: async () => {
     if (!customerPhone) return [];
     const res = await fetch(`/api/orders/customer/${encodeURIComponent(customerPhone)}`);
     if (!res.ok) return [];
     return res.json();
   }
 });

 // Get the most recent active order (not completed or cancelled)
 const currentOrder = orders.find(
 (order) => order.status !== "completed" && order.status !== "cancelled"
 );

 if (!currentOrder || dismissed) {
 return null;
 }

 return (
 <AnimatePresence>
 <motion.div
 initial={{ y: -100, opacity: 0 }}
 animate={{ y: 0, opacity: 1 }}
 exit={{ y: -100, opacity: 0 }}
 transition={{ type: "spring", stiffness: 100 }}
 className="fixed top-0 left-0 right-0 z-50 p-4"
 >
 <Card className="max-w-4xl mx-auto bg-card border-2 border-primary/30 shadow-xl relative">
 <button
 onClick={() => setDismissed(true)}
 className="absolute top-2 left-2 p-1 rounded-full hover:bg-amber-100 transition-colors z-10"
 aria-label="إغلاق"
 >
 <X className="w-5 h-5 text-amber-700" />
 </button>

 <div className="p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <Coffee className="w-5 h-5 text-primary" />
 <h3 className="font-bold text-foreground">طلبك الحالي</h3>
 </div>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => setLocation("/my-orders")}
 className="text-primary hover:text-primary/80 hover:bg-primary/10"
 >
 عرض التفاصيل
 <ArrowLeft className="w-4 h-4 mr-2" />
 </Button>
 </div>

 <OrderTracker order={currentOrder} compact />
 </div>
 </Card>
 </motion.div>
 </AnimatePresence>
 );
}
