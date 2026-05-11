import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from 'react-leaflet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCartStore } from '@/lib/cart-store';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation, Check } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useTranslate } from '@/lib/useTranslate';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const FREE_DELIVERY_ZONES = [
  {
    name: 'السويدي',
    nameEn: 'Al-Suwaidi',
    coordinates: [
      { lat: 24.6800, lng: 46.7000 },
      { lat: 24.6900, lng: 46.7100 },
      { lat: 24.6950, lng: 46.7050 },
      { lat: 24.6850, lng: 46.6950 },
    ],
  },
  {
    name: 'البديعة',
    nameEn: 'Al-Badia',
    coordinates: [
      { lat: 24.6600, lng: 46.7200 },
      { lat: 24.6700, lng: 46.7300 },
      { lat: 24.6800, lng: 46.7250 },
      { lat: 24.6700, lng: 46.7150 },
    ],
  },
  {
    name: 'ظهرة البديعة',
    nameEn: 'Dahrat Al-Badia',
    coordinates: [
      { lat: 24.6500, lng: 46.7300 },
      { lat: 24.6600, lng: 46.7400 },
      { lat: 24.6700, lng: 46.7350 },
      { lat: 24.6600, lng: 46.7250 },
    ],
  },
];

const RIYADH_CENTER = { lat: 24.7136, lng: 46.6753 };

interface LocationMarkerProps {
  position: { lat: number; lng: number };
  setPosition: (pos: { lat: number; lng: number }) => void;
}

function LocationMarker({ position, setPosition }: LocationMarkerProps) {
  useMapEvents({
    click(e) {
      setPosition({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    },
  });
  return position ? <Marker position={[position.lat, position.lng]} /> : null;
}

function isPointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > point.lng) !== (yj > point.lng))
      && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function DeliveryMapPage() {
  const [, setLocation] = useLocation();
  const { setDeliveryInfo, cartItems } = useCartStore();
  const { toast } = useToast();
  const tc = useTranslate();

  const [position, setPosition] = useState<{ lat: number; lng: number }>(RIYADH_CENTER);
  const [fullAddress, setFullAddress] = useState('');
  const [isInFreeZone, setIsInFreeZone] = useState(false);
  const [zoneName, setZoneName] = useState('');

  if (!cartItems || cartItems.length === 0) {
    toast({
      title: tc('السلة فارغة', 'Cart is Empty'),
      description: tc('الرجاء إضافة منتجات إلى السلة أولاً', 'Please add products to your cart first'),
      variant: 'destructive',
    });
    setLocation('/menu');
  }

  useEffect(() => {
    for (const zone of FREE_DELIVERY_ZONES) {
      if (isPointInPolygon(position, zone.coordinates)) {
        setIsInFreeZone(true);
        setZoneName(zone.name);
        return;
      }
    }
    setIsInFreeZone(false);
    setZoneName('');
  }, [position]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          toast({
            title: tc('خطأ في تحديد الموقع', 'Location Error'),
            description: tc('لم نتمكن من الوصول إلى موقعك الحالي', 'Could not access your current location'),
            variant: 'destructive',
          });
        }
      );
    }
  };

  const handleConfirm = () => {
    if (!fullAddress.trim()) {
      toast({
        title: tc('تنبيه', 'Notice'),
        description: tc('الرجاء إدخال عنوان التوصيل', 'Please enter a delivery address'),
        variant: 'destructive',
      });
      return;
    }

    const deliveryFee = isInFreeZone ? 0 : 10;

    setDeliveryInfo({
      type: 'delivery',
      address: {
        fullAddress,
        lat: position.lat,
        lng: position.lng,
        zone: zoneName || tc('الرياض', 'Riyadh'),
      },
      deliveryFee,
    });

    setLocation('/checkout');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2" dir="rtl">{tc("حدد موقع التوصيل", "Set Delivery Location")}</h1>
          <p className="text-muted-foreground" dir="rtl">
            {tc("اضغط على الخريطة لتحديد موقعك", "Tap on the map to set your location")}
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="h-[400px] sm:h-[500px] rounded-md overflow-hidden">
              <MapContainer
                center={[RIYADH_CENTER.lat, RIYADH_CENTER.lng]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {FREE_DELIVERY_ZONES.map((zone, idx) => (
                  <Polygon
                    key={idx}
                    positions={zone.coordinates.map(c => [c.lat, c.lng])}
                    pathOptions={{
                      color: '#22c55e',
                      fillColor: '#22c55e',
                      fillOpacity: 0.2,
                    }}
                  />
                ))}

                <LocationMarker position={position} setPosition={setPosition} />
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={getCurrentLocation}
          variant="outline"
          className="w-full mb-6"
          data-testid="button-current-location"
        >
          <Navigation className="w-4 h-4 ml-2" />
          <span dir="rtl">{tc("استخدم موقعي الحالي", "Use My Current Location")}</span>
        </Button>

        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="space-y-5">
              <div>
                <Label htmlFor="address" className="mb-3 block text-base font-semibold" dir="rtl">
                  {tc("عنوان التوصيل", "Delivery Address")}
                </Label>
                <Input
                  id="address"
                  placeholder={tc("مثال: شارع الأمير محمد بن عبدالعزيز، البديعة", "e.g. Prince Mohammed bin Abdulaziz Street, Al-Badia")}
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  dir="rtl"
                  className="text-base"
                  data-testid="input-address"
                />
              </div>

              <div className={`p-4 rounded-md ${isInFreeZone ? 'bg-green-50 dark:bg-green-950' : 'bg-yellow-50 dark:bg-yellow-950'}`}>
                <div className="flex items-start gap-3" dir="rtl">
                  <MapPin className={`w-6 h-6 mt-0.5 flex-shrink-0 ${isInFreeZone ? 'text-green-600' : 'text-yellow-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold mb-1 ${isInFreeZone ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                      {isInFreeZone ? tc('منطقة توصيل مجاني', 'Free Delivery Zone') : tc('رسوم التوصيل: 10 ريال', 'Delivery Fee: 10 SAR')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isInFreeZone ? `${tc('الحي:', 'District:')} ${zoneName}` : tc('خارج مناطق التوصيل المجاني', 'Outside free delivery zones')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleConfirm}
          className="w-full"
          size="lg"
          data-testid="button-confirm"
        >
          <span dir="rtl">{tc("تأكيد الموقع والمتابعة للدفع", "Confirm Location & Continue to Payment")}</span>
          <Check className="w-5 h-5 mr-2" />
        </Button>
      </div>
    </div>
  );
}
