import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, CheckCircle, AlertTriangle, Loader2, RefreshCw, ExternalLink } from 'lucide-react';

interface Branch {
  _id?: string;
  id?: string;
  nameAr: string;
  nameEn?: string;
  address: string;
  phone: string;
  // Server stores as lat/lng — support both formats for robustness
  location?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  };
}

// Normalize branch location to { lat, lng } — handles both formats
function getBranchLatLng(location: Branch['location']): { lat: number; lng: number } | null {
  if (!location) return null;
  const lat = location.lat ?? location.latitude;
  const lng = location.lng ?? location.longitude;
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

interface LocationPreparationCheckProps {
  branch: Branch;
  onPreparationReady?: () => void;
  preparationRadius?: number; // in meters, default 300
}

interface LocationState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'denied';
  latitude?: number;
  longitude?: number;
  error?: string;
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function LocationPreparationCheck({ 
  branch, 
  onPreparationReady,
  preparationRadius = 5 
}: LocationPreparationCheckProps) {
  const [locationState, setLocationState] = useState<LocationState>({ status: 'idle' });
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const handleLocationUpdate = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude } = position.coords;
    setLocationState({
      status: 'success',
      latitude,
      longitude
    });

    const branchCoords = getBranchLatLng(branch.location);
    if (branchCoords) {
      const dist = calculateDistance(latitude, longitude, branchCoords.lat, branchCoords.lng);
      setDistance(Math.round(dist));
      const withinRadius = dist <= preparationRadius;
      setIsWithinRadius(withinRadius);
      
      if (withinRadius && onPreparationReady) {
        onPreparationReady();
      }
    }
  }, [branch.location, preparationRadius, onPreparationReady]);

  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'حدث خطأ في تحديد الموقع';
    let status: 'error' | 'denied' = 'error';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'تم رفض صلاحية الوصول للموقع. الرجاء تفعيل خدمة الموقع من إعدادات الجهاز.';
        status = 'denied';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'معلومات الموقع غير متاحة حالياً';
        break;
      case error.TIMEOUT:
        errorMessage = 'انتهت مهلة تحديد الموقع';
        break;
    }
    
    setLocationState({
      status,
      error: errorMessage
    });
  }, []);

  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState({
        status: 'error',
        error: 'المتصفح لا يدعم خدمة تحديد الموقع'
      });
      return;
    }

    setLocationState({ status: 'loading' });

    // Get initial position — fast first fix using cached/low-accuracy
    navigator.geolocation.getCurrentPosition(
      handleLocationUpdate,
      handleLocationError,
      {
        enableHighAccuracy: false,
        timeout: 4000,
        maximumAge: 30000
      }
    );

    // Watch for position changes — high accuracy refines after first fix
    const id = navigator.geolocation.watchPosition(
      handleLocationUpdate,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 2000
      }
    );
    setWatchId(id);
  }, [handleLocationUpdate, handleLocationError]);

  const stopLocationTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, [stopLocationTracking]);

  const openDirections = () => {
    const branchCoords = getBranchLatLng(branch.location);
    if (branchCoords) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${branchCoords.lat},${branchCoords.lng}&travelmode=driving`;
      window.open(url, '_blank');
    }
  };

  const openBranchLocation = () => {
    const branchCoords = getBranchLatLng(branch.location);
    if (branchCoords) {
      const url = `https://www.google.com/maps?q=${branchCoords.lat},${branchCoords.lng}`;
      window.open(url, '_blank');
    }
  };

  const getDistanceText = () => {
    if (distance === null) return '';
    if (distance < 1000) {
      return `${distance} متر`;
    }
    return `${(distance / 1000).toFixed(1)} كم`;
  };

  const branchCoordsForRender = getBranchLatLng(branch.location);

  if (!branch.location || !branchCoordsForRender) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
        <CardContent className="p-4">
          <div className="flex items-center gap-3" dir="rtl">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              موقع الفرع غير محدد. الرجاء التواصل مع خدمة العملاء.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="card-location-preparation">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2" dir="rtl">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span className="text-lg">التحقق من الموقع للتحضير</span>
          </div>
          {isWithinRadius ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle className="w-3 h-3 ml-1" />
              جاهز للتحضير
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              <AlertTriangle className="w-3 h-3 ml-1" />
              بعيد عن الفرع
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Branch Info */}
        <div className="bg-muted/50 rounded-lg p-4" dir="rtl">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold">{branch.nameAr}</h4>
              <p className="text-sm text-muted-foreground mt-1">{branch.address}</p>
            </div>
          </div>
        </div>

        {/* Location Status */}
        {locationState.status === 'idle' && (
          <div className="text-center py-6" dir="rtl">
            <p className="text-muted-foreground mb-4">
              اضغط على الزر لتحديد موقعك والتحقق من قربك من الفرع (مطلوب لتأكيد الاستلام)
            </p>
            <Button 
              onClick={startLocationTracking}
              className="gap-2"
              data-testid="button-check-location"
            >
              <MapPin className="w-4 h-4" />
              تحديد موقعي
            </Button>
          </div>
        )}

        {locationState.status === 'loading' && (
          <div className="text-center py-6" dir="rtl">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
            <p className="text-muted-foreground">جاري تحديد موقعك...</p>
          </div>
        )}

        {(locationState.status === 'error' || locationState.status === 'denied') && (
          <div className="space-y-4" dir="rtl">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-destructive font-medium">تعذر تحديد الموقع</p>
                  <p className="text-sm text-muted-foreground mt-1">{locationState.error}</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={startLocationTracking}
                variant="outline"
                className="flex-1 gap-2"
                data-testid="button-retry-location"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </Button>
              <Button 
                onClick={openBranchLocation}
                variant="outline"
                className="flex-1 gap-2"
                data-testid="button-view-branch-location"
              >
                <ExternalLink className="w-4 h-4" />
                موقع الفرع
              </Button>
            </div>
          </div>
        )}

        {locationState.status === 'success' && (
          <div className="space-y-4" dir="rtl">
            {/* Distance Info */}
            <div className={`rounded-lg p-4 ${isWithinRadius ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900' : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isWithinRadius ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-600" />
                  )}
                  <span className={`font-semibold ${isWithinRadius ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {isWithinRadius ? 'أنت قريب من الفرع!' : 'أنت بعيد عن الفرع'}
                  </span>
                </div>
                <Badge variant={isWithinRadius ? "default" : "secondary"} className={isWithinRadius ? 'bg-green-600' : ''}>
                  {getDistanceText()}
                </Badge>
              </div>
              
            <p className="text-sm text-muted-foreground">
              {isWithinRadius 
                ? `أنت ضمن نطاق ${preparationRadius} متر من الفرع. يمكننا البدء بتحضير طلبك الآن!`
                : `المسافة الحالية: ${getDistanceText()}. يمكنك البدء بالتحضير عندما تقترب.`
              }
            </p>
            </div>

            {/* Location Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">موقعك الحالي</p>
                <p className="font-mono text-xs">
                  {locationState.latitude?.toFixed(6)}, {locationState.longitude?.toFixed(6)}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">موقع الفرع</p>
                <p className="font-mono text-xs">
                  {(() => { const c = getBranchLatLng(branch.location); return c ? `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}` : '—'; })()}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isWithinRadius && (
                <Button 
                  onClick={openDirections}
                  className="flex-1 gap-2"
                  data-testid="button-get-directions"
                >
                  <Navigation className="w-4 h-4" />
                  الاتجاهات للفرع
                </Button>
              )}
              <Button 
                onClick={startLocationTracking}
                variant={isWithinRadius ? "default" : "outline"}
                className="flex-1 gap-2"
                data-testid="button-refresh-location"
              >
                <RefreshCw className="w-4 h-4" />
                تحديث الموقع
              </Button>
            </div>

            {/* Stop Tracking */}
            {watchId !== null && (
              <Button 
                onClick={stopLocationTracking}
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                data-testid="button-stop-tracking"
              >
                إيقاف التتبع التلقائي
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
