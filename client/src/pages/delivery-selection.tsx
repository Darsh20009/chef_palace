import { useState, useEffect } from 'react';
import { tc } from '@/lib/useTranslate';
import SarIcon from "@/components/sar-icon";
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/lib/cart-store';
import { useToast } from '@/hooks/use-toast';
import { Store, MapPin, ArrowRight, Phone, Map, Coffee, AlertCircle, Loader2, Navigation, Clock, Check, Car, Bookmark, ShoppingBag, ChevronLeft, Utensils, Truck, Star } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';

interface Branch {
  id: string;
  nameAr: string;
  nameEn?: string;
  address: string;
  phone: string;
  city: string;
  location?: {
    lat: number;
    lng: number;
    latitude?: number;
    longitude?: number;
  };
  isActive: number;
  mapsUrl?: string;
}

function getBranchCoords(branch: Branch): { lat: number; lng: number } | null {
  const loc = branch.location;
  if (!loc) return null;
  const lat = loc.lat ?? loc.latitude;
  const lng = loc.lng ?? loc.longitude;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('966')) return `+${digits}`;
  if (digits.startsWith('0')) return `+966${digits.slice(1)}`;
  return `+966${digits}`;
}

function openDirections(lat: number, lng: number) {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const url = isIOS
    ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

interface Table {
  id: string;
  tableNumber: string;
  capacity: number;
  branchId: string;
  isActive: number;
  isAvailable?: boolean;
  isOccupied?: boolean | number;
}

const CAR_COLORS = [
  { name: 'أبيض', hex: '#F8F8F8', border: true },
  { name: 'أسود', hex: '#1a1a1a', border: false },
  { name: 'فضي', hex: '#C0C0C0', border: true },
  { name: 'رمادي', hex: '#6B7280', border: false },
  { name: 'أحمر', hex: '#DC2626', border: false },
  { name: 'أزرق', hex: '#2563EB', border: false },
  { name: 'بني', hex: '#92400E', border: false },
  { name: 'ذهبي', hex: '#D4A017', border: false },
  { name: 'أخضر', hex: '#16A34A', border: false },
  { name: 'بيج', hex: '#D2B48C', border: true },
];

const CAR_BRANDS = ['تويوتا', 'هيونداي', 'نيسان', 'كيا', 'شيفروليه', 'فورد', 'هوندا', 'مرسيدس', 'لكزس', 'BMW'];

function CarSVG({ color, className = '' }: { color: string; className?: string }) {
  const bodyColor = color || '#6B7280';
  const darkWindow = '#1a2a3a';
  const lightWindow = '#b8d4e8';

  return (
    <svg viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <filter id="carShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.25)" />
        </filter>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bodyColor} stopOpacity="1" />
          <stop offset="100%" stopColor={bodyColor} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bodyColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={bodyColor} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="groundGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="30%" stopColor="rgba(0,0,0,0.1)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.1)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="120" cy="108" rx="90" ry="6" fill="url(#groundGrad)" />

      {/* Body */}
      <rect x="20" y="55" width="200" height="40" rx="8" fill="url(#bodyGrad)" filter="url(#carShadow)" />

      {/* Roof cabin */}
      <path d="M65 55 Q72 30 100 28 L148 28 Q168 28 178 55 Z" fill="url(#roofGrad)" />

      {/* Windshield */}
      <path d="M72 53 Q78 34 100 32 L148 32 Q162 33 168 53 Z" fill={lightWindow} fillOpacity="0.85" />

      {/* Rear window */}
      <path d="M72 53 Q74 38 82 34 L95 32 Q80 32 77 53 Z" fill={darkWindow} fillOpacity="0.4" />

      {/* Front window */}
      <path d="M158 53 Q161 38 155 34 L148 32 Q162 32 164 53 Z" fill={darkWindow} fillOpacity="0.4" />

      {/* Side window left */}
      <rect x="72" y="38" width="32" height="17" rx="3" fill={lightWindow} fillOpacity="0.7" />

      {/* Side window right */}
      <rect x="138" y="38" width="32" height="17" rx="3" fill={lightWindow} fillOpacity="0.7" />

      {/* Door line */}
      <line x1="120" y1="55" x2="120" y2="95" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />

      {/* Front bumper */}
      <rect x="210" y="72" width="10" height="14" rx="3" fill={bodyColor} />

      {/* Rear bumper */}
      <rect x="20" y="72" width="10" height="14" rx="3" fill={bodyColor} />

      {/* Front headlight */}
      <ellipse cx="217" cy="70" rx="6" ry="4" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1" />
      <ellipse cx="217" cy="70" rx="4" ry="2.5" fill="#FBBF24" />

      {/* Rear light */}
      <ellipse cx="23" cy="70" rx="6" ry="4" fill="#FEE2E2" stroke="#DC2626" strokeWidth="1" />
      <ellipse cx="23" cy="70" rx="4" ry="2.5" fill="#EF4444" />

      {/* Wheels */}
      <circle cx="65" cy="96" r="14" fill="#1f2937" />
      <circle cx="65" cy="96" r="9" fill="#374151" />
      <circle cx="65" cy="96" r="4" fill="#9CA3AF" />
      <circle cx="175" cy="96" r="14" fill="#1f2937" />
      <circle cx="175" cy="96" r="9" fill="#374151" />
      <circle cx="175" cy="96" r="4" fill="#9CA3AF" />

      {/* Wheel arches */}
      <path d="M47 88 Q65 80 83 88" stroke={bodyColor} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M157 88 Q175 80 193 88" stroke={bodyColor} strokeWidth="6" fill="none" strokeLinecap="round" />

      {/* Door handle */}
      <rect x="90" y="68" width="12" height="4" rx="2" fill="rgba(0,0,0,0.2)" />
      <rect x="140" y="68" width="12" height="4" rx="2" fill="rgba(0,0,0,0.2)" />
    </svg>
  );
}

type OrderMethod = 'takeaway' | 'car-pickup' | 'dine-in' | 'delivery';

const DELIVERY_COUNTRIES: { value: string; label: string; governorates: string[] }[] = [
  {
    value: 'SA',
    label: 'المملكة العربية السعودية',
    governorates: [
      'منطقة الرياض',
      'منطقة مكة المكرمة',
      'منطقة المدينة المنورة',
      'منطقة القصيم',
      'المنطقة الشرقية',
      'منطقة عسير',
      'منطقة تبوك',
      'منطقة حائل',
      'منطقة الحدود الشمالية',
      'منطقة جازان',
      'منطقة نجران',
      'منطقة الباحة',
      'منطقة الجوف',
    ],
  },
  {
    value: 'EG',
    label: 'جمهورية مصر العربية',
    governorates: [
      'القاهرة',
      'الجيزة',
      'الإسكندرية',
      'الدقهلية',
      'البحيرة',
      'الشرقية',
      'الغربية',
      'المنوفية',
      'القليوبية',
      'كفر الشيخ',
      'دمياط',
      'بورسعيد',
      'الإسماعيلية',
      'السويس',
      'الفيوم',
      'بني سويف',
      'المنيا',
      'أسيوط',
      'سوهاج',
      'قنا',
      'الأقصر',
      'أسوان',
      'البحر الأحمر',
      'مطروح',
      'شمال سيناء',
      'جنوب سيناء',
      'الوادي الجديد',
    ],
  },
];

export default function DeliverySelectionPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { setDeliveryInfo, cartItems } = useCartStore();
  const { toast } = useToast();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const isCarPickupMode = (() => {
    try { return sessionStorage.getItem("qirox_car_pickup_mode") === "1"; } catch { return false; }
  })();

  const [selectedMethod, setSelectedMethod] = useState<OrderMethod>(isCarPickupMode ? 'car-pickup' : 'takeaway');

  const isReservationCart = cartItems.some(ci => (ci.coffeeItem as any)?.isReservation);

  const getTomorrowString = () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };
  const getMaxDateString = () => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };
  const [reservationDate, setReservationDate] = useState<string>('');
  const [reservationFromTime, setReservationFromTime] = useState<string>('');
  const [reservationToTime, setReservationToTime] = useState<string>('');

  useEffect(() => {
    document.title = `${t("nav.branch_selection")} - مكان الشيف البخاري`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', t("delivery.subtitle"));
  }, [t]);

  const [saveCarInfo, setSaveCarInfo] = useState<boolean>(false);
  const [carInfo, setCarInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('qirox_saved_car');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { model: parsed.model || '', color: parsed.color || '', colorHex: parsed.colorHex || '#6B7280', plateNumber: parsed.plateNumber || '', parkingSlot: parsed.parkingSlot || '' };
      }
    } catch {}
    return { model: '', color: '', colorHex: '#6B7280', plateNumber: '', parkingSlot: '' };
  });
  const [hasSavedCar] = useState(() => {
    try { return !!localStorage.getItem('qirox_saved_car'); } catch { return false; }
  });
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{withinRange: boolean; distance: number; message: string} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [availableTables, setAvailableTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [arrivalTime, setArrivalTime] = useState<string>('');
  const [loadingTables, setLoadingTables] = useState(false);
  const [bookedTable, setBookedTable] = useState<{ tableNumber: string; bookingId: string } | null>(null);
  const [deliveryAddressText, setDeliveryAddressText] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>('');
  const [detailedAddress, setDetailedAddress] = useState<string>('');

  useEffect(() => {
    if (navigator.geolocation) {
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          setLocationError('');
          setIsGettingLocation(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError(t("delivery.location_error"));
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError(t("delivery.browser_error"));
    }
  }, []);

  useEffect(() => {
    if (selectedBranchId && userLocation) {
      checkLocationProximity();
    } else {
      setLocationStatus(null);
    }
  }, [selectedBranchId, userLocation]);

  useEffect(() => {
    if (selectedMethod === 'dine-in' && selectedBranchId) {
      fetchAvailableTables();
    } else {
      setAvailableTables([]);
      setSelectedTableId('');
      setBookedTable(null);
    }
  }, [selectedMethod, selectedBranchId]);

  useEffect(() => {
    if (selectedTableId && arrivalTime && selectedMethod === 'dine-in' && !bookedTable) {
      bookTable();
    }
  }, [selectedTableId, arrivalTime, selectedMethod, bookedTable]);

  const fetchAvailableTables = async () => {
    setLoadingTables(true);
    try {
      const response = await fetch(`/api/tables/status?branchId=${selectedBranchId}`);
      const data = await response.json();
      const tables = Array.isArray(data) ? data : [];
      const processedTables = tables
        .filter((t: any) => t && (t.isActive === 1 || t.isActive === true || t.isActive === undefined))
        .map((t: any) => {
          const actualData = t._doc || t;
          const id = actualData.id;
          return {
            ...actualData,
            id,
            isAvailable: actualData.isAvailable !== undefined ? actualData.isAvailable : (actualData.isOccupied === 0),
            isOccupied: actualData.isOccupied !== undefined ? actualData.isOccupied : 0
          };
        })
        .filter((t: any) => t.id);
      setAvailableTables(processedTables);
    } catch (error) {
      toast({ title: t("product.error"), description: "خطأ في تحميل الطاولات", variant: 'destructive' });
    } finally {
      setLoadingTables(false);
    }
  };

  const bookTable = async () => {
    try {
      const response = await fetch('/api/tables/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: selectedTableId, arrivalTime, branchId: selectedBranchId })
      });
      const data = await response.json();
      if (!response.ok) {
        toast({ title: t("product.error"), description: data.error || 'فشل في حجز الطاولة', variant: 'destructive' });
        return;
      }
      setBookedTable({ tableNumber: data.tableNumber, bookingId: data.bookingId });
      toast({ title: t("product.saved"), description: data.message || 'تم حجز الطاولة بنجاح' });
    } catch (error) {
      console.error('Table booking error:', error);
    }
  };

  const checkLocationProximity = async () => {
    if (!selectedBranchId || !userLocation) return;
    setIsCheckingLocation(true);
    try {
      const response = await fetch(`/api/branches/${selectedBranchId}/check-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: userLocation.latitude, longitude: userLocation.longitude })
      });
      const data = await response.json();
      setLocationStatus(data);
    } catch (error) {
      setLocationStatus(null);
    } finally {
      setIsCheckingLocation(false);
    }
  };

  const refreshLocation = () => {
    if (navigator.geolocation) {
      setIsGettingLocation(true);
      setLocationError('');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          setLocationError('');
          setIsGettingLocation(false);
        },
        (error) => {
          setLocationError(t("delivery.location_error"));
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };


  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
  });

  const orderMethods = businessConfig?.orderMethodsConfig || {};
  const enableDineIn = orderMethods.enableDineIn !== false;
  const enableCarPickup = orderMethods.enableCarPickup !== false;
  const enableTakeaway = orderMethods.enableTakeaway !== false;
  const enableDelivery = orderMethods.enableDelivery !== false;
  const deliveryFeeAmount: number = orderMethods.deliveryFeeAmount ?? 15;

  const handleContinue = () => {
    if (!cartItems || cartItems.length === 0) {
      toast({ title: t("cart.empty_title"), description: t("cart.empty_desc"), variant: 'destructive' });
      setLocation('/menu');
      return;
    }
    if (!selectedBranchId) {
      toast({ title: t("product.error"), description: 'يرجى اختيار الفرع', variant: 'destructive' });
      return;
    }
    const branch = branches.find(b => b.id === selectedBranchId);
    if (!branch) return;

    if (selectedMethod === 'car-pickup') {
      if (!carInfo.model || !carInfo.color || !carInfo.plateNumber) {
        toast({ title: t("product.error"), description: "يرجى إدخال جميع بيانات السيارة", variant: 'destructive' });
        return;
      }
      if (saveCarInfo) {
        try { localStorage.setItem('qirox_saved_car', JSON.stringify(carInfo)); } catch {}
      } else {
        try { localStorage.removeItem('qirox_saved_car'); } catch {}
      }
    }

    if (selectedMethod === 'dine-in') {
      if (!selectedTableId && !bookedTable) {
        toast({ title: t("product.error"), description: 'يرجى اختيار طاولة', variant: 'destructive' });
        return;
      }
      if (!arrivalTime) {
        toast({ title: t("product.error"), description: 'يرجى تحديد وقت الوصول', variant: 'destructive' });
        return;
      }
    }

    if (isReservationCart) {
      if (!reservationDate) {
        toast({ title: 'تنبيه', description: 'يرجى اختيار تاريخ الحجز', variant: 'destructive' });
        return;
      }
      if (!reservationFromTime) {
        toast({ title: 'تنبيه', description: 'يرجى تحديد وقت بداية الحجز', variant: 'destructive' });
        return;
      }
      if (!reservationToTime) {
        toast({ title: 'تنبيه', description: 'يرجى تحديد وقت نهاية الحجز', variant: 'destructive' });
        return;
      }
      if (reservationFromTime >= reservationToTime) {
        toast({ title: 'تنبيه', description: 'وقت البداية يجب أن يكون قبل وقت النهاية', variant: 'destructive' });
        return;
      }
    }

    if (selectedMethod === 'delivery') {
      if (!selectedCountry) {
        toast({ title: t("product.error"), description: "يرجى اختيار الدولة", variant: 'destructive' });
        return;
      }
      if (!selectedGovernorate) {
        toast({ title: t("product.error"), description: "يرجى اختيار المحافظة / المنطقة", variant: 'destructive' });
        return;
      }
      if (!detailedAddress.trim()) {
        toast({ title: t("product.error"), description: "يرجى إدخال تفاصيل العنوان (الحي، الشارع، المبنى)", variant: 'destructive' });
        return;
      }
    }

    setDeliveryInfo({
      type: selectedMethod === 'car-pickup' ? 'car-pickup'
          : selectedMethod === 'dine-in' ? 'dine-in'
          : selectedMethod === 'delivery' ? 'delivery'
          : 'pickup',
      branchId: branch.id,
      branchName: branch.nameAr,
      branchAddress: branch.address,
      dineIn: selectedMethod === 'dine-in',
      carPickup: selectedMethod === 'car-pickup',
      carInfo: selectedMethod === 'car-pickup' ? {
        carType: carInfo.model,
        carColor: carInfo.color,
        plateNumber: carInfo.plateNumber,
        parkingSlot: carInfo.parkingSlot
      } : undefined,
      tableId: selectedTableId || undefined,
      tableNumber: bookedTable?.tableNumber || undefined,
      arrivalTime: arrivalTime || undefined,
      deliveryAddress: selectedMethod === 'delivery'
        ? [DELIVERY_COUNTRIES.find(c => c.value === selectedCountry)?.label, selectedGovernorate, detailedAddress.trim()].filter(Boolean).join(' - ')
        : undefined,
      deliveryFee: selectedMethod === 'delivery' ? deliveryFeeAmount : 0,
      productReservationDate: isReservationCart ? reservationDate : undefined,
      productReservationFromTime: isReservationCart ? reservationFromTime : undefined,
      productReservationToTime: isReservationCart ? reservationToTime : undefined,
    });

    setLocation('/checkout');
  };

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const selectedCarColor = CAR_COLORS.find(c => c.name === carInfo.color);
  const carHex = selectedCarColor?.hex || '#6B7280';

  const methodCards = isReservationCart ? [
    {
      id: 'takeaway' as OrderMethod,
      icon: Store,
      label: 'استلام / حضور في الفرع',
      desc: 'منتجات الحجز تستلزم الحضور للفرع',
      color: 'from-amber-500 to-amber-600',
      ring: 'ring-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      badge: '🗓️ حجز',
    },
  ] : isCarPickupMode ? [
    {
      id: 'car-pickup' as OrderMethod,
      icon: Car,
      label: 'استلام من السيارة',
      desc: 'لا تنزل من سيارتك - سنوصل الطلب إليك',
      color: 'from-purple-500 to-purple-600',
      ring: 'ring-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950/20',
      badge: '🚗 منيو السيارات',
    },
  ] : [
    enableTakeaway && {
      id: 'takeaway' as OrderMethod,
      icon: Store,
      label: 'استلام من الفرع',
      desc: 'استلم طلبك مباشرة',
      color: 'from-blue-500 to-blue-600',
      ring: 'ring-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
    },
    enableCarPickup && {
      id: 'car-pickup' as OrderMethod,
      icon: Car,
      label: 'استلام من السيارة',
      desc: 'لا تنزل من سيارتك',
      color: 'from-purple-500 to-purple-600',
      ring: 'ring-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950/20',
      badge: 'VIP',
    },
    enableDineIn && {
      id: 'dine-in' as OrderMethod,
      icon: Utensils,
      label: 'داخل المطعم',
      desc: 'اجلس واطلب من طاولتك',
      color: 'from-orange-500 to-orange-600',
      ring: 'ring-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950/20',
    },
    enableDelivery && {
      id: 'delivery' as OrderMethod,
      icon: Truck,
      label: 'توصيل للمنزل',
      desc: 'نوصل لباب بيتك',
      color: 'from-green-500 to-green-600',
      ring: 'ring-green-500',
      bg: 'bg-green-50 dark:bg-green-950/20',
    },
  ].filter(Boolean) as Array<{
    id: OrderMethod;
    icon: any;
    label: string;
    desc: string;
    color: string;
    ring: string;
    bg: string;
    badge?: string;
  }>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/menu')} data-testid="button-back">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold" data-testid="text-delivery-page-title">
              {isCarPickupMode ? 'منيو السيارات 🚗' : (t("delivery.title") || "اختر طريقة الاستلام")}
            </h1>
            <p className="text-xs text-muted-foreground">{cartItems.length} منتج في السلة</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Branch Selection */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <Label htmlFor="branch-select" className="text-base font-bold mb-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</div>
              اختر الفرع
            </Label>

            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">جاري تحميل الفروع...</span>
              </div>
            ) : branches.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا توجد فروع متاحة</p>
            ) : (
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="w-full h-12" data-testid="select-branch">
                  <SelectValue placeholder="اختر الفرع الأقرب إليك" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      <div className="flex flex-col items-start gap-0.5 py-1">
                        <span className="font-semibold">{branch.nameAr}</span>
                        <span className="text-xs text-muted-foreground">{branch.city} — {branch.address}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Selected branch info */}
            {selectedBranch && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(() => {
                    const coords = getBranchCoords(selectedBranch);
                    if (!coords) return null;
                    return (
                      <Button variant="outline" size="sm" onClick={() => openDirections(coords.lat, coords.lng)} data-testid="button-navigate-to-branch">
                        <Navigation className="w-3.5 h-3.5 ml-1" />
                        الاتجاهات
                      </Button>
                    );
                  })()}
                  {selectedBranch.phone && (
                    <Button variant="outline" size="sm" onClick={() => window.location.href = normalizePhone(selectedBranch.phone).replace('+', 'tel:+')} data-testid="button-call-branch">
                      <Phone className="w-3.5 h-3.5 ml-1" />
                      اتصال
                    </Button>
                  )}
                </div>

                {/* Location status */}
                {(isCheckingLocation || isGettingLocation) && (
                  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                      {t("delivery.check_location")}
                    </AlertDescription>
                  </Alert>
                )}
                {!isCheckingLocation && !isGettingLocation && locationError && (
                  <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 py-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-sm flex items-center justify-between gap-2">
                      <span>{locationError}</span>
                      <Button variant="outline" size="sm" onClick={refreshLocation}>تحديث</Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Method Selection — shown once branch is selected */}
        {isReservationCart && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl mt-0.5">🗓️</span>
              <div>
                <p className="font-bold text-amber-800 dark:text-amber-200 text-sm">سلة الحجز المسبق</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">لديك منتج يتطلب حجزاً مسبقاً. الاستلام يكون في الفرع فقط مع تأكيد عبر واتساب.</p>
              </div>
            </div>

            {selectedBranchId && (
              <div className="bg-card border border-amber-200 dark:border-amber-700 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">2</div>
                  <span className="text-base font-bold">حدد موعد الحجز</span>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-foreground">📅 تاريخ الحجز</Label>
                  <p className="text-xs text-muted-foreground">من الغد حتى 7 أيام قادمة</p>
                  <Input
                    type="date"
                    value={reservationDate}
                    min={getTomorrowString()}
                    max={getMaxDateString()}
                    onChange={(e) => setReservationDate(e.target.value)}
                    className="text-base h-11 border-amber-200 focus:border-amber-400"
                    data-testid="input-reservation-date"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">⏰ من الساعة</Label>
                    <Input
                      type="time"
                      value={reservationFromTime}
                      onChange={(e) => setReservationFromTime(e.target.value)}
                      className="text-base h-11 border-amber-200 focus:border-amber-400"
                      data-testid="input-reservation-from-time"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">⏰ إلى الساعة</Label>
                    <Input
                      type="time"
                      value={reservationToTime}
                      onChange={(e) => setReservationToTime(e.target.value)}
                      className="text-base h-11 border-amber-200 focus:border-amber-400"
                      data-testid="input-reservation-to-time"
                    />
                  </div>
                </div>

                {reservationDate && reservationFromTime && reservationToTime && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl p-3 text-center">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                      📋 موعد الحجز: {new Date(reservationDate).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      من {reservationFromTime} إلى {reservationToTime}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selectedBranchId && methodCards.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</div>
              <span className="text-base font-bold">اختر طريقة الاستلام</span>
            </div>

            <div className={`grid gap-3 ${methodCards.length === 2 ? 'grid-cols-2' : methodCards.length >= 3 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {methodCards.map((method) => {
                const isSelected = selectedMethod === method.id;
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    data-testid={`btn-method-${method.id}`}
                    className={`relative text-right p-4 rounded-2xl border-2 transition-all duration-200 ${
                      isSelected
                        ? `border-transparent ring-2 ${method.ring} ${method.bg} shadow-lg scale-[1.02]`
                        : 'border-border hover:border-primary/30 hover:shadow-md bg-card'
                    }`}
                  >
                    {method.badge && (
                      <span className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white bg-gradient-to-r ${method.color}`}>
                        {method.badge}
                      </span>
                    )}
                    {isSelected && (
                      <div className={`absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-br ${method.color} flex items-center justify-center`}>
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="mb-2 flex items-center justify-center">
                      <method.icon className="w-8 h-8" />
                    </div>
                    <p className={`text-sm font-bold ${isSelected ? '' : 'text-foreground'}`}>{method.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{method.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Car Pickup Details */}
            {selectedMethod === 'car-pickup' && (
              <Card className="border border-border shadow-sm">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{tc("بيانات السيارة", "Car Details")}</p>
                    <p className="text-xs text-muted-foreground">{tc("سنُحضر طلبك إليك مباشرة", "We'll bring your order to you")}</p>
                  </div>
                </div>

                {/* Car Preview */}
                <div className="flex justify-center items-center py-4 bg-muted/10 border-b">
                  <div className="flex flex-col items-center gap-2">
                    <CarSVG color={carHex} className="w-40 h-auto" />
                    {carInfo.model && carInfo.color && (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border">
                        <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: carHex }} />
                        <span className="text-xs font-semibold text-foreground">{carInfo.model}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{carInfo.color}</span>
                      </div>
                    )}
                  </div>
                </div>

                <CardContent className="p-4 space-y-5">

                  {/* Car Brand */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-primary" />
                      {tc("نوع السيارة", "Car Brand")}
                    </Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {CAR_BRANDS.map((brand) => {
                        const isSel = carInfo.model === brand;
                        return (
                          <button
                            key={brand}
                            type="button"
                            onClick={() => setCarInfo({ ...carInfo, model: brand })}
                            data-testid={`btn-car-brand-${brand}`}
                            className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-all duration-150 ${
                              isSel
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5'
                            }`}
                          >
                            {brand}
                          </button>
                        );
                      })}
                    </div>
                    <Input
                      value={carInfo.model}
                      onChange={(e) => setCarInfo({ ...carInfo, model: e.target.value })}
                      placeholder={tc("أو اكتب نوع السيارة...", "Or type your car brand...")}
                      data-testid="input-car-model"
                      className="text-sm"
                    />
                  </div>

                  {/* Car Color */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      {tc("لون السيارة", "Car Color")}
                    </Label>
                    <div className="grid grid-cols-5 gap-2">
                      {CAR_COLORS.map((color) => {
                        const isSel = carInfo.color === color.name;
                        return (
                          <button
                            key={color.name}
                            type="button"
                            onClick={() => setCarInfo({ ...carInfo, color: color.name, colorHex: color.hex })}
                            data-testid={`btn-car-color-${color.name}`}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-150 ${
                              isSel ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/40'
                            }`}
                          >
                            <span
                              className={`w-7 h-7 rounded-full ${color.border ? 'border border-border' : ''}`}
                              style={{ backgroundColor: color.hex }}
                            />
                            <span className={`text-[10px] font-medium ${isSel ? 'text-primary' : 'text-muted-foreground'}`}>{color.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Plate Number — Saudi style */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      {tc("رقم اللوحة", "Plate Number")}
                    </Label>
                    <div className="relative rounded-xl overflow-hidden border-2 border-border">
                      <div className="absolute inset-y-0 right-0 w-2 bg-green-700" />
                      <Input
                        id="car-plate"
                        placeholder={tc("مثال: أ ب ج 1234", "e.g. A B C 1234")}
                        value={carInfo.plateNumber}
                        onChange={(e) => setCarInfo({ ...carInfo, plateNumber: e.target.value })}
                        data-testid="input-car-plate"
                        className="text-center font-mono text-2xl font-black tracking-[0.35em] border-0 h-16 pr-5 focus-visible:ring-0 bg-amber-50 dark:bg-amber-950/20"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{tc("أدخل الحروف والأرقام كما تظهر على اللوحة", "Enter letters and numbers as they appear on the plate")}</p>
                  </div>

                  {/* Arrival Time */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-primary" />
                      {tc("وقت الوصول المتوقع", "Expected Arrival Time")}
                    </Label>
                    <Input
                      id="arrival-time-car"
                      type="time"
                      value={arrivalTime}
                      onChange={(e) => setArrivalTime(e.target.value)}
                      data-testid="input-arrival-time-car"
                      className="h-12"
                    />
                  </div>

                  {/* Save car toggle */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <Checkbox
                      id="save-car-info"
                      checked={saveCarInfo}
                      onCheckedChange={(checked) => setSaveCarInfo(checked as boolean)}
                      data-testid="checkbox-save-car"
                    />
                    <Label htmlFor="save-car-info" className="text-sm cursor-pointer flex items-center gap-1.5 flex-1 text-foreground">
                      <Bookmark className="w-3.5 h-3.5 text-primary" />
                      {tc("حفظ بيانات السيارة للطلبات القادمة", "Save car info for future orders")}
                    </Label>
                  </div>

                  {/* Parking Slot Selector */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <span>🅿️</span>
                      {tc("موقف سيارتك", "Your Parking Spot")}
                      {carInfo.parkingSlot && (
                        <Badge variant="outline" className="mr-auto text-primary border-primary">
                          {tc("موقف", "Slot")} {carInfo.parkingSlot}
                        </Badge>
                      )}
                    </Label>
                    <p className="text-xs text-muted-foreground">{tc("اختياري — يساعد الموظف على إيجادك بسرعة", "Optional — helps staff find you faster")}</p>

                    <div className="grid grid-cols-6 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((slot) => {
                        const isSelected = carInfo.parkingSlot === String(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setCarInfo({ ...carInfo, parkingSlot: isSelected ? '' : String(slot) })}
                            data-testid={`btn-parking-slot-${slot}`}
                            className={`flex items-center justify-center rounded-lg h-10 text-sm font-bold border transition-all duration-150 ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-foreground border-border hover:border-primary/40 hover:bg-primary/5'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Car Summary */}
                  {carInfo.model && carInfo.color && carInfo.plateNumber && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                      <div className="w-10 h-10 rounded-full flex-shrink-0 border-2 border-green-300 dark:border-green-700" style={{ backgroundColor: carHex }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-green-900 dark:text-green-200">{carInfo.model} · {carInfo.color}</p>
                        <p className="text-base font-black font-mono tracking-widest text-green-700 dark:text-green-400 mt-0.5" dir="ltr">{carInfo.plateNumber}</p>
                        {carInfo.parkingSlot && (
                          <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">🅿️ {tc("موقف", "Slot")} {carInfo.parkingSlot}</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Dine-In Details */}
            {selectedMethod === 'dine-in' && (
              <Card className="border-orange-200 dark:border-orange-800">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4">
                  <p className="text-white font-bold text-sm mb-1">حجز طاولة</p>
                  <p className="text-orange-100 text-xs">اختر طاولتك المفضلة وسيكون طلبك جاهزاً عند وصولك</p>
                </div>
                <CardContent className="p-4 space-y-4">
                  {loadingTables ? (
                    <div className="flex items-center gap-2 py-4 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">جاري تحميل الطاولات...</span>
                    </div>
                  ) : availableTables.length === 0 ? (
                    <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                        لا توجد طاولات متاحة حالياً
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div>
                        <Label className="text-sm font-bold mb-2 block">اختر الطاولة</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {availableTables.map((table) => {
                            const tableId = table.id;
                            if (!tableId) return null;
                            const isAvailable = !!table.isAvailable;
                            const isChosen = selectedTableId === tableId;
                            return (
                              <button
                                key={tableId}
                                onClick={() => isAvailable && setSelectedTableId(tableId)}
                                disabled={!isAvailable}
                                data-testid={`table-option-${table.tableNumber}`}
                                className={`p-3 rounded-xl border-2 text-center transition-all ${
                                  isChosen
                                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                                    : isAvailable
                                    ? 'border-border hover:border-orange-300 bg-card cursor-pointer'
                                    : 'border-border bg-muted opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <div className="text-2xl mb-1">{isAvailable ? '🪑' : '🚫'}</div>
                                <p className="text-xs font-bold">طاولة {table.tableNumber}</p>
                                <p className="text-[10px] text-muted-foreground">{isAvailable ? 'متاحة' : 'مشغولة'}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="arrival-time" className="text-sm font-bold mb-2 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-orange-500" />
                          وقت وصولك
                        </Label>
                        <Input
                          id="arrival-time"
                          type="time"
                          value={arrivalTime}
                          onChange={(e) => setArrivalTime(e.target.value)}
                          data-testid="input-arrival-time"
                          className="h-12"
                        />
                      </div>

                      {bookedTable && (
                        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                          <Check className="w-4 h-4 text-green-600" />
                          <AlertDescription className="text-green-800 dark:text-green-200">
                            تم حجز الطاولة رقم {bookedTable.tableNumber} بنجاح!
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Delivery Address Form */}
            {selectedMethod === 'delivery' && (
              <Card className="border-green-200 dark:border-green-800">
                <div className="bg-gradient-to-r from-green-500 to-green-600 p-4">
                  <p className="text-white font-bold text-sm mb-1">توصيل للمنزل</p>
                  <p className="text-green-100 text-xs">أدخل عنوانك وسنوصل طلبك إليك</p>
                </div>
                <CardContent className="p-4 space-y-3">
                  {/* Country */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">الدولة</Label>
                    <Select
                      value={selectedCountry}
                      onValueChange={(v) => { setSelectedCountry(v); setSelectedGovernorate(''); }}
                      data-testid="select-country"
                    >
                      <SelectTrigger className="text-sm" data-testid="trigger-country">
                        <SelectValue placeholder="اختر الدولة" />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_COUNTRIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Governorate / Region */}
                  {selectedCountry && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        {selectedCountry === 'SA' ? 'المنطقة الإدارية' : 'المحافظة'}
                      </Label>
                      <Select
                        value={selectedGovernorate}
                        onValueChange={setSelectedGovernorate}
                        data-testid="select-governorate"
                      >
                        <SelectTrigger className="text-sm" data-testid="trigger-governorate">
                          <SelectValue placeholder={selectedCountry === 'SA' ? 'اختر المنطقة' : 'اختر المحافظة'} />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERY_COUNTRIES.find(c => c.value === selectedCountry)?.governorates.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Detailed address */}
                  {selectedGovernorate && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">تفاصيل العنوان</Label>
                      <Input
                        placeholder="الحي، الشارع، رقم المبنى / الشقة..."
                        value={detailedAddress}
                        onChange={(e) => setDetailedAddress(e.target.value)}
                        className="text-sm"
                        data-testid="input-delivery-address"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <p className="text-xs text-green-700 dark:text-green-400">رسوم التوصيل</p>
                    </div>
                    <p className="text-sm font-bold text-green-700 dark:text-green-400">
                      {deliveryFeeAmount > 0 ? <>{deliveryFeeAmount} <SarIcon size={11} /></> : 'مجاني'}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      سيتواصل معك موظفونا لتأكيد العنوان وتفاصيل التوصيل
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Takeaway info */}
            {selectedMethod === 'takeaway' && selectedBranch && (
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Store className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selectedBranch.nameAr}</p>
                    <p className="text-xs text-muted-foreground">{selectedBranch.address}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Continue Button */}
        <Button
          onClick={handleContinue}
          className="w-full h-14 text-base font-bold rounded-2xl"
          size="lg"
          disabled={!selectedBranchId || isLoading || isCheckingLocation}
          data-testid="button-continue"
        >
          {isCheckingLocation ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {t("delivery.check_location")}
            </>
          ) : (
            <>
              متابعة للدفع
              <ArrowRight className="w-5 h-5 mr-2" />
            </>
          )}
        </Button>

      </div>
    </div>
  );
}
