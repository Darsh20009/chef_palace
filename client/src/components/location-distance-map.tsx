import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const userIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const branchIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationDistanceMapProps {
  userLocation: { lat: number; lng: number };
  branchLocation: { lat: number; lng: number };
  distance: number;
  mapsUrl?: string;
  onClose?: () => void;
  allBranches?: Array<{ id: string; lat: number; lng: number; nameAr: string }>;
  selectedBranchId?: string;
}

export default function LocationDistanceMap({
  userLocation,
  branchLocation,
  distance,
  mapsUrl,
  onClose,
  allBranches,
  selectedBranchId
}: LocationDistanceMapProps) {
  const getDistanceText = () => {
    if (distance < 1000) {
      return `${distance} متر`;
    }
    return `${(distance / 1000).toFixed(1)} كم`;
  };

  // Calculate center based on whether we're showing all branches or just one
  const center = allBranches && allBranches.length > 0 
    ? {
        lat: allBranches.reduce((sum, b) => sum + b.lat, 0) / allBranches.length,
        lng: allBranches.reduce((sum, b) => sum + b.lng, 0) / allBranches.length,
      }
    : {
        lat: (userLocation.lat + branchLocation.lat) / 2,
        lng: (userLocation.lng + branchLocation.lng) / 2,
      };

  const zoom = allBranches ? 12 : distance > 5000 ? 11 : distance > 1000 ? 13 : 14;

  return (
    <>
      {/* Map Container - Clean and minimal */}
      <div className="h-80 rounded-2xl overflow-hidden shadow-2xl">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={zoom}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution=""
            />
            
            {/* User Location Marker */}
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup><div dir="rtl">موقعك الحالي</div></Popup>
            </Marker>

            {/* All Branches Markers */}
            {allBranches && allBranches.map((branch) => (
              <Marker key={branch.id} position={[branch.lat, branch.lng]} icon={branch.id === selectedBranchId ? branchIcon : branchIcon}>
                <Popup><div dir="rtl">{branch.nameAr}</div></Popup>
              </Marker>
            ))}

            {/* Single Branch Location Marker (if not showing all) */}
            {!allBranches && (
              <Marker position={[branchLocation.lat, branchLocation.lng]} icon={branchIcon}>
                <Popup><div dir="rtl">موقع الفرع</div></Popup>
              </Marker>
            )}

            {/* Line Between Locations - Only for selected branch */}
            {selectedBranchId && (
              <Polyline
                positions={[[userLocation.lat, userLocation.lng], [branchLocation.lat, branchLocation.lng]]}
                color="rgb(217, 119, 6)"
                weight={2}
                opacity={0.7}
                dashArray="5, 5"
              />
            )}

            {/* User Location Circle */}
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={200}
              fillColor="rgb(59, 130, 246)"
              fillOpacity={0.1}
              color="rgb(59, 130, 246)"
              weight={2}
            />
          </MapContainer>
        </div>
    </>
  );
}
