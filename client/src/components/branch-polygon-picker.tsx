import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents, useMap } from 'react-leaflet';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Trash2, Undo2, CheckCircle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pointIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface PolygonPickerProps {
  initialPoints?: Array<{ lat: number; lng: number }>;
  centerLat?: number;
  centerLng?: number;
  onBoundaryChange: (points: Array<{ lat: number; lng: number }>) => void;
}

function PolygonDrawer({ 
  points, 
  setPoints 
}: { 
  points: Array<{ lat: number; lng: number }>;
  setPoints: (points: Array<{ lat: number; lng: number }>) => void;
}) {
  useMapEvents({
    click(e) {
      const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
      setPoints([...points, newPoint]);
    },
  });

  return (
    <>
      {points.map((point, index) => (
        <Marker 
          key={index} 
          position={[point.lat, point.lng]} 
          icon={pointIcon}
        />
      ))}
      {points.length >= 3 && (
        <Polygon 
          positions={points.map(p => [p.lat, p.lng])}
          pathOptions={{ 
            color: '#2D9B6E',
            fillColor: '#2D9B6E',
            fillOpacity: 0.3,
            weight: 2
          }}
        />
      )}
    </>
  );
}

function MapCenterController({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  
  useEffect(() => {
    if (center.lat && center.lng) {
      map.setView([center.lat, center.lng], map.getZoom());
    }
  }, [center, map]);
  
  return null;
}

export default function BranchPolygonPicker({ 
  initialPoints = [], 
  centerLat,
  centerLng,
  onBoundaryChange 
}: PolygonPickerProps) {
  const DEFAULT_CENTER = { lat: 24.7136, lng: 46.6753 };
  
  const [points, setPoints] = useState<Array<{ lat: number; lng: number }>>(initialPoints);
  const [mapCenter, setMapCenter] = useState({
    lat: centerLat || DEFAULT_CENTER.lat,
    lng: centerLng || DEFAULT_CENTER.lng,
  });

  useEffect(() => {
    if (initialPoints.length > 0) {
      setPoints(initialPoints);
    }
  }, [initialPoints]);

  useEffect(() => {
    if (centerLat && centerLng) {
      setMapCenter({ lat: centerLat, lng: centerLng });
    }
  }, [centerLat, centerLng]);

  useEffect(() => {
    onBoundaryChange(points);
  }, [points, onBoundaryChange]);

  const handlePointsChange = useCallback((newPoints: Array<{ lat: number; lng: number }>) => {
    setPoints(newPoints);
  }, []);

  const handleUndo = () => {
    if (points.length > 0) {
      setPoints(points.slice(0, -1));
    }
  };

  const handleClear = () => {
    setPoints([]);
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('لم نستطع الحصول على موقعك الحالي');
        }
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-foreground">ارسم حدود الفرع (اضغط لإضافة نقاط)</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseCurrentLocation}
          >
            <Navigation className="w-4 h-4 ml-1" />
            موقعي
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={points.length === 0}
          >
            <Undo2 className="w-4 h-4 ml-1" />
            تراجع
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleClear}
            disabled={points.length === 0}
          >
            <Trash2 className="w-4 h-4 ml-1" />
            مسح
          </Button>
        </div>
      </div>

      <div className="h-80 rounded-lg overflow-hidden border border-border bg-muted">
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapCenterController center={mapCenter} />
          <PolygonDrawer points={points} setPoints={handlePointsChange} />
        </MapContainer>
      </div>

      <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
        <div className="flex items-start gap-2">
          <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-foreground font-medium">تعليمات الرسم:</p>
            <ul className="text-muted-foreground text-xs space-y-1 mt-1">
              <li>• اضغط على الخريطة لإضافة نقاط الحدود</li>
              <li>• تحتاج 3 نقاط على الأقل لتكوين شكل</li>
              <li>• النقاط تتصل تلقائياً لتشكيل الحدود</li>
            </ul>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {points.length >= 3 ? (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              {points.length} نقاط
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">
              {points.length}/3 نقاط
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
