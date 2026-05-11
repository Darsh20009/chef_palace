import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scan, Tag, Percent, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SarIcon from "@/components/sar-icon";

interface QRScannerProps {
 isOpen: boolean;
 onClose: () => void;
 orderAmount: number;
 onDiscountApplied: (discount: { percentage: number; amount: string; finalAmount: string }) => void;
 employeeId?: string;
}

export default function QRScanner({
 isOpen,
 onClose,
 orderAmount,
 onDiscountApplied,
 employeeId
}: QRScannerProps) {
 const [qrToken, setQrToken] = useState("");
 const [isScanning, setIsScanning] = useState(false);
 const { toast } = useToast();

 const handleScan = async () => {
 if (!qrToken.trim()) {
 toast({
 variant: "destructive",
 title: "خطأ",
 description: "الرجاء إدخال رمز QR"
 });
 return;
 }

 setIsScanning(true);

 try {
 const res = await apiRequest(
 "POST",
 "/api/loyalty/scan",
 {
 qrToken: qrToken.trim(),
 orderAmount: orderAmount.toString(),
 employeeId
 }
 );

 const response = await res.json();

 if (response.success) {
 toast({
 title: "تم تطبيق الخصم بنجاح! ",
 description: `خصم ${response.discount.percentage}% - وفّر ${response.discount.amount} ر.س`,
 className: "bg-green-900 border-green-700 text-white"
 });

 onDiscountApplied(response.discount);
 onClose();
 setQrToken("");
 }
 } catch (error: any) {
 toast({
 variant: "destructive",
 title: "فشل في مسح البطاقة",
 description: error.message || "تأكد من صحة رمز QR"
 });
 } finally {
 setIsScanning(false);
 }
 };

 const handlePhoneSearch = async () => {
 // Alternative: search by phone number
 toast({
 title: "قريباً",
 description: "ميزة البحث برقم الهاتف قيد التطوير"
 });
 };

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
 <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 to-slate-800 border-amber-500/30">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-amber-400">
 <Scan className="w-5 h-5" />
 مسح بطاقة الولاء
 </DialogTitle>
 </DialogHeader>

 <div className="space-y-6 py-4">
 {/* Order Amount Display */}
 <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-4">
 <div className="flex items-center justify-between">
 <span className="text-slate-300">المبلغ الأصلي:</span>
 <span className="text-2xl font-bold text-amber-400" data-testid="text-original-amount">
 {orderAmount.toFixed(2)} <SarIcon />
 </span>
 </div>
 </div>

 {/* QR Code Input */}
 <div className="space-y-2">
 <Label htmlFor="qr-token" className="text-slate-300">
 رمز بطاقة الولاء (QR)
 </Label>
 <div className="flex gap-2">
 <Input
 id="qr-token"
 value={qrToken}
 onChange={(e) => setQrToken(e.target.value)}
 placeholder="CUP-XXXXXXXXXXXX"
 className="flex-1 bg-slate-800 border-slate-700 text-white"
 onKeyDown={(e) => e.key === "Enter" && handleScan()}
 data-testid="input-qr-token"
 />
 <Button
 onClick={handleScan}
 disabled={isScanning}
 className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600"
 data-testid="button-scan"
 >
 {isScanning ? (
 <span className="flex items-center gap-2">
 <span className="animate-spin">⏳</span>
 جاري المسح...
 </span>
 ) : (
 <span className="flex items-center gap-2">
 <Scan className="w-4 h-4" />
 مسح
 </span>
 )}
 </Button>
 </div>
 <p className="text-xs text-slate-400">
 أدخل رمز QR من بطاقة العميل أو امسحها باستخدام الكاميرا
 </p>
 </div>

 {/* Discount Info */}
 <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-4">
 <div className="flex items-start gap-3">
 <Percent className="w-5 h-5 text-green-400 mt-0.5" />
 <div className="flex-1 space-y-1">
 <h4 className="font-semibold text-green-400">خصم الولاء التلقائي</h4>
 <p className="text-sm text-slate-300">
 سيتم تطبيق خصم 10% تلقائياً على الطلب عند مسح بطاقة الولاء
 </p>
 </div>
 </div>
 </div>

 {/* Alternative Options */}
 <div className="flex gap-2">
 <Button
 variant="outline"
 onClick={handlePhoneSearch}
 className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
 data-testid="button-search-phone"
 >
 <Tag className="w-4 h-4 ml-2" />
 بحث برقم الهاتف
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
}
