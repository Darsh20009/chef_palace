import { MapPin, Phone, Navigation, ExternalLink, Map } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Branch } from "@shared/schema";

interface BranchCardProps {
  branch: Branch;
  distance?: number;
  onViewMap?: () => void;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('966')) return `+${digits}`;
  if (digits.startsWith('0')) return `+966${digits.slice(1)}`;
  return `+966${digits}`;
}

function getBranchCoords(branch: Branch): { lat: number; lng: number } | null {
  const loc = branch.location as any;
  if (!loc) return null;
  const lat = loc.lat ?? loc.latitude;
  const lng = loc.lng ?? loc.longitude;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function openDirections(lat: number, lng: number) {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const url = isIOS
    ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function BranchCard({ branch, distance, onViewMap }: BranchCardProps) {
  const coords = getBranchCoords(branch);

  const getDistanceText = () => {
    if (!distance) return null;
    if (distance < 1000) return `${Math.round(distance)} متر`;
    return `${(distance / 1000).toFixed(1)} كم`;
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/30 hover:border-primary/60 transition-all duration-300 hover:shadow-lg" data-testid={`card-branch-${branch.id}`}>
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-amiri text-lg sm:text-xl font-bold text-foreground" data-testid={`text-branch-name-${branch.id}`}>
                {branch.nameAr}
              </h3>
              {distance !== undefined && (
                <Badge variant="secondary" className="mt-2 bg-primary/20 text-primary">
                  {getDistanceText()}
                </Badge>
              )}
            </div>
          </div>

          {/* Address & City */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground" data-testid={`text-branch-address-${branch.id}`}>
                <p>{branch.address}</p>
                <p>{branch.city}</p>
              </div>
            </div>
          </div>

          {/* Phone — clickable */}
          {branch.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary flex-shrink-0" />
              <a
                href={`tel:${normalizePhone(branch.phone)}`}
                className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                data-testid={`link-branch-phone-${branch.id}`}
              >
                {branch.phone}
              </a>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Directions — uses device maps app */}
            {coords && (
              <Button
                onClick={() => openDirections(coords.lat, coords.lng)}
                variant="outline"
                size="sm"
                className="flex-1"
                data-testid={`button-navigate-${branch.id}`}
              >
                <Navigation className="w-4 h-4 ml-2" />
                توجيه
              </Button>
            )}

            {/* View on Maps link (if mapsUrl set) */}
            {(branch as any).mapsUrl && (
              <Button
                onClick={() => window.open((branch as any).mapsUrl, '_blank', 'noopener,noreferrer')}
                variant="outline"
                size="sm"
                className="flex-1"
                data-testid={`button-view-map-${branch.id}`}
              >
                <Map className="w-4 h-4 ml-2" />
                خريطة
              </Button>
            )}

            {/* Fallback: parent-provided onViewMap callback */}
            {onViewMap && !coords && !(branch as any).mapsUrl && (
              <Button
                onClick={onViewMap}
                variant="outline"
                size="sm"
                className="flex-1"
                data-testid={`button-view-map-fallback-${branch.id}`}
              >
                <ExternalLink className="w-4 h-4 ml-2" />
                عرض على الخريطة
              </Button>
            )}

            {/* Call button */}
            {branch.phone && (
              <Button
                onClick={() => window.location.href = `tel:${normalizePhone(branch.phone)}`}
                variant="outline"
                size="sm"
                className="flex-1"
                data-testid={`button-call-${branch.id}`}
              >
                <Phone className="w-4 h-4 ml-2" />
                اتصال
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
