import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Circle, useMapEvents, useMap } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Trash2, Undo2, CheckCircle, Pentagon, LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const polygonPointIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -28],
  shadowSize: [33, 33]
});

const centerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

type MapMode = 'location' | 'polygon';

interface BranchMapPickerProps {
  initialLat?: number;
  initialLng?: number;
  initialPoints?: Array<{ lat: number; lng: number }>;
  geofenceRadius?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  onBoundaryChange: (points: Array<{ lat: number; lng: number }>) => void;
}

function MapClickHandler({
  mode,
  onLocationClick,
  onPolygonClick,
}: {
  mode: MapMode;
  onLocationClick: (lat: number, lng: number) => void;
  onPolygonClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (mode === 'location') {
        onLocationClick(e.latlng.lat, e.latlng.lng);
      } else {
        onPolygonClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function BranchMapPicker({
  initialLat,
  initialLng,
  initialPoints = [],
  geofenceRadius,
  onLocationSelect,
  onBoundaryChange,
}: BranchMapPickerProps) {
  const DEFAULT = { lat: 24.7136, lng: 46.6753 };

  const [mode, setMode] = useState<MapMode>('location');
  const [center, setCenter] = useState({
    lat: initialLat || DEFAULT.lat,
    lng: initialLng || DEFAULT.lng,
  });
  const [polygonPoints, setPolygonPoints] = useState<Array<{ lat: number; lng: number }>>(initialPoints);
  const [mapCenter, setMapCenter] = useState<[number, number]>([center.lat, center.lng]);

  useEffect(() => {
    if (initialLat && initialLng) setCenter({ lat: initialLat, lng: initialLng });
  }, [initialLat, initialLng]);

  useEffect(() => {
    if (initialPoints.length > 0) setPolygonPoints(initialPoints);
  }, [initialPoints]);

  const handleLocationClick = useCallback((lat: number, lng: number) => {
    setCenter({ lat, lng });
    setMapCenter([lat, lng]);
    onLocationSelect(lat, lng);
  }, [onLocationSelect]);

  const handlePolygonClick = useCallback((lat: number, lng: number) => {
    const newPoints = [...polygonPoints, { lat, lng }];
    setPolygonPoints(newPoints);
    onBoundaryChange(newPoints);
  }, [polygonPoints, onBoundaryChange]);

  const handleUndo = () => {
    const newPoints = polygonPoints.slice(0, -1);
    setPolygonPoints(newPoints);
    onBoundaryChange(newPoints);
  };

  const handleClearPolygon = () => {
    setPolygonPoints([]);
    onBoundaryChange([]);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('متصفحك لا يدعم خدمات تحديد الموقع');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCenter({ lat, lng });
        setMapCenter([lat, lng]);
        onLocationSelect(lat, lng);
      },
      () => alert('لم نستطع الحصول على موقعك الحالي')
    );
  };

  const handleManualInput = (field: 'lat' | 'lng', val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const newCenter = field === 'lat'
        ? { lat: num, lng: center.lng }
        : { lat: center.lat, lng: num };
      setCenter(newCenter);
      setMapCenter([newCenter.lat, newCenter.lng]);
      onLocationSelect(newCenter.lat, newCenter.lng);
    }
  };

  return (
    <div className="space-y-3">
      {/* Mode Switcher + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
          <button
            type="button"
            onClick={() => setMode('location')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === 'location'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="button-mode-location"
          >
            <MapPin className="w-3.5 h-3.5" />
            تحديد موقع الفرع
          </button>
          <button
            type="button"
            onClick={() => setMode('polygon')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === 'polygon'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="button-mode-polygon"
          >
            <Pentagon className="w-3.5 h-3.5" />
            رسم حدود الجيوفينس
          </button>
        </div>

        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={handleUseCurrentLocation} data-testid="button-use-location">
            <Navigation className="w-3.5 h-3.5 ml-1" />
            موقعي
          </Button>
          {mode === 'polygon' && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={polygonPoints.length === 0} data-testid="button-undo">
                <Undo2 className="w-3.5 h-3.5 ml-1" />
                تراجع
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleClearPolygon} disabled={polygonPoints.length === 0} data-testid="button-clear-polygon">
                <Trash2 className="w-3.5 h-3.5 ml-1" />
                مسح
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Instruction banner */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
        mode === 'location'
          ? 'bg-green-500/10 border-green-500/20 text-green-400'
          : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
      }`}>
        {mode === 'location' ? (
          <>
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>اضغط على الخريطة لتحديد موقع مركز الفرع (العلامة الخضراء)</span>
          </>
        ) : (
          <>
            <Pentagon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>اضغط لإضافة نقاط الحدود — تحتاج 3 نقاط على الأقل لتكوين المنطقة</span>
          </>
        )}
      </div>

      {/* Unified Map */}
      <div className="h-[52vh] min-h-64 rounded-lg overflow-hidden border border-border">
        <MapContainer
          center={mapCenter}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
          key={`map-${center.lat.toFixed(4)}-${center.lng.toFixed(4)}`}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapCenterController center={mapCenter} />
          <MapClickHandler
            mode={mode}
            onLocationClick={handleLocationClick}
            onPolygonClick={handlePolygonClick}
          />

          {/* Center location marker (green) */}
          {center.lat !== DEFAULT.lat && (
            <Marker position={[center.lat, center.lng]} icon={centerIcon} />
          )}

          {/* Geofence radius circle (if no polygon) */}
          {geofenceRadius && polygonPoints.length < 3 && center.lat !== DEFAULT.lat && (
            <Circle
              center={[center.lat, center.lng]}
              radius={geofenceRadius}
              pathOptions={{ color: '#2D9B6E', fillColor: '#2D9B6E', fillOpacity: 0.15, weight: 2 }}
            />
          )}

          {/* Polygon points (red) */}
          {polygonPoints.map((point, index) => (
            <Marker key={index} position={[point.lat, point.lng]} icon={polygonPointIcon} />
          ))}

          {/* Polygon shape */}
          {polygonPoints.length >= 3 && (
            <Polygon
              positions={polygonPoints.map(p => [p.lat, p.lng])}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }}
            />
          )}
        </MapContainer>
      </div>

      {/* Coordinates input */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">خط العرض (Latitude)</Label>
          <Input
            type="number"
            step="0.000001"
            value={center.lat}
            onChange={(e) => handleManualInput('lat', e.target.value)}
            className="text-sm font-mono"
            dir="ltr"
            data-testid="input-latitude"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">خط الطول (Longitude)</Label>
          <Input
            type="number"
            step="0.000001"
            value={center.lng}
            onChange={(e) => handleManualInput('lng', e.target.value)}
            className="text-sm font-mono"
            dir="ltr"
            data-testid="input-longitude"
          />
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          موقع الفرع: {center.lat !== DEFAULT.lat ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` : 'لم يُحدد بعد'}
        </span>
        <span className="flex items-center gap-1">
          {polygonPoints.length >= 3 ? (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-400">حدود: {polygonPoints.length} نقاط</span>
            </>
          ) : (
            <span>حدود: {polygonPoints.length}/3 نقاط</span>
          )}
        </span>
      </div>
    </div>
  );
}
