import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Store, Receipt, Eye, Coffee } from "lucide-react";
import { PaymentReceiptDialog } from "@/components/PaymentReceiptDialog";

interface Branch {
  id: string;
  nameAr: string;
  address?: string;
}

interface OrderMetaProps {
  orderId: string;
  deliveryType?: string;
  paymentReceiptUrl?: string;
  deliveryAddress?: {
    addressLine?: string;
    city?: string;
    neighborhood?: string;
  };
  branchId?: string;
  tableNumber?: string;
  arrivalTime?: string;
}

export function OrderMeta({ 
  orderId, 
  deliveryType, 
  paymentReceiptUrl,
  deliveryAddress,
  branchId,
  tableNumber,
  arrivalTime
}: OrderMetaProps) {
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  // Fetch branches to get branch name from ID
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    enabled: !!branchId, // Only fetch if we have a branchId
  });

  const getBranchName = () => {
    if (!branchId || !branches.length) return null;
    const branch = branches.find(b => b.id === branchId);
    return branch?.nameAr;
  };

  const getDeliveryTypeBadge = () => {
    if (!deliveryType) return null;
    
    if (deliveryType === 'delivery') {
      return (
        <div className="flex flex-col gap-2">
          <Badge className="bg-blue-600/80 text-white flex items-center gap-1 w-fit" data-testid={`badge-delivery-type-${orderId}`}>
            <Truck className="w-3 h-3" />
            توصيل
          </Badge>
          {deliveryAddress && (
            <div className="text-sm text-gray-400">
              {deliveryAddress.neighborhood && <p>الحي: {deliveryAddress.neighborhood}</p>}
              {deliveryAddress.addressLine && <p className="text-xs">{deliveryAddress.addressLine}</p>}
            </div>
          )}
        </div>
      );
    }
    
    if (deliveryType === 'dine-in' || deliveryType === 'table') {
      const bName = getBranchName();
      return (
        <div className="flex flex-col gap-2">
          <Badge className="bg-primary/80 text-primary-foreground flex items-center gap-1 w-fit" data-testid={`badge-delivery-type-${orderId}`}>
            <Coffee className="w-3 h-3" />
            جلوس في الكافيه
          </Badge>
          <div className="text-sm text-gray-400">
            {bName && <p>الفرع: {bName}</p>}
            {tableNumber && <p>رقم الطاولة: {tableNumber}</p>}
            {arrivalTime && <p>وقت الوصول: {arrivalTime}</p>}
          </div>
        </div>
      );
    }
    
    const branchName = getBranchName();
    return (
      <div className="flex flex-col gap-2">
        <Badge className="bg-green-600/80 text-white flex items-center gap-1 w-fit" data-testid={`badge-delivery-type-${orderId}`}>
          <Store className="w-3 h-3" />
          استلام من الفرع
        </Badge>
        {branchName && (
          <p className="text-sm text-gray-400">الفرع: {branchName}</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Delivery Type */}
      {deliveryType && (
        <div>
          <p className="text-gray-400 text-xs mb-1">نوع الاستلام</p>
          {getDeliveryTypeBadge()}
        </div>
      )}

      {/* Payment Receipt Button */}
      {paymentReceiptUrl && (
        <div>
          <p className="text-gray-400 text-xs mb-1">إيصال الدفع</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReceiptDialogOpen(true)}
            className="flex items-center gap-2 w-fit"
            data-testid={`button-view-receipt-${orderId}`}
          >
            <Eye className="w-3 h-3" />
            عرض الإيصال
          </Button>
        </div>
      )}

      {/* Payment Receipt Dialog */}
      <PaymentReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        orderId={orderId}
        receiptUrl={paymentReceiptUrl}
      />
    </div>
  );
}
