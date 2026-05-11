import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Receipt, Download, CheckCircle } from "lucide-react";

interface PaymentReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  receiptUrl?: string;
  showConfirm?: boolean;
  onConfirm?: () => void;
}

export function PaymentReceiptDialog({ 
  open, 
  onOpenChange, 
  orderId, 
  receiptUrl,
  showConfirm,
  onConfirm,
}: PaymentReceiptDialogProps) {
  if (!receiptUrl) {
    return null;
  }

  const handleDownload = () => {
    window.open(receiptUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[#1a1410] border-amber-900/20">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              إيصال التحويل - طلب #{orderId.slice(0, 8)}
            </DialogTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownload}
              className="flex items-center gap-2"
              data-testid="button-download-receipt"
            >
              <Download className="w-4 h-4" />
              تحميل
            </Button>
          </div>
        </DialogHeader>
        
        <div className="mt-4">
          <div className="bg-[#2d1f1a] rounded-lg p-4 flex items-center justify-center min-h-[400px]">
            <img 
              src={receiptUrl} 
              alt="إيصال التحويل"
              className="max-w-full max-h-[600px] object-contain rounded-md"
              data-testid="img-payment-receipt"
            />
          </div>
        </div>

        {showConfirm && onConfirm && (
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              إغلاق
            </Button>
            <Button onClick={onConfirm} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="w-4 h-4 ml-2" />
              تأكيد استلام التحويل
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
