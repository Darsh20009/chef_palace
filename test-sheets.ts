import { appendOrderToSheet } from './server/google-sheets.ts';

const testOrder = {
  orderNumber: "TEST-" + Date.now(),
  createdAt: new Date(),
  customerName: "اختبار النظام",
  customerPhone: "0500000000",
  totalAmount: 100,
  paymentMethod: "Test Payment",
  status: "completed",
  branchId: "test-branch"
};

console.log("🚀 البدء في اختبار نظام جوجل شيت...");
console.log("📦 بيانات الطلب التجريبي:", testOrder);

appendOrderToSheet(testOrder)
  .then(() => {
    console.log("✅ انتهى الاختبار. يرجى التحقق من ملف جوجل شيت الخاص بك.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ فشل الاختبار:", err);
    process.exit(1);
  });
