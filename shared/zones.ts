export interface DeliveryZone {
  id: string;
  nameAr: string;
  nameEn: string;
  deliveryFee: number;
  coordinates: Array<{ lat: number; lng: number }>;
  color: string;
}

export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: "al-badia",
    nameAr: "البديعة",
    nameEn: "Al-Badia",
    deliveryFee: 10,
    color: "#10b981",
    coordinates: [
      { lat: 24.7136, lng: 46.6753 },
      { lat: 24.7200, lng: 46.6753 },
      { lat: 24.7200, lng: 46.6850 },
      { lat: 24.7136, lng: 46.6850 },
    ],
  },
  {
    id: "dhahrat-al-badia",
    nameAr: "ظهرة البديعة",
    nameEn: "Dhahrat Al-Badia",
    deliveryFee: 10,
    color: "#3b82f6",
    coordinates: [
      { lat: 24.7050, lng: 46.6753 },
      { lat: 24.7136, lng: 46.6753 },
      { lat: 24.7136, lng: 46.6850 },
      { lat: 24.7050, lng: 46.6850 },
    ],
  },
];

export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

export function getZoneForLocation(location: {
  lat: number;
  lng: number;
}): DeliveryZone | null {
  for (const zone of DELIVERY_ZONES) {
    if (isPointInPolygon(location, zone.coordinates)) {
      return zone;
    }
  }
  return null;
}

export function isLocationInDeliveryZone(location: {
  lat: number;
  lng: number;
}): boolean {
  return getZoneForLocation(location) !== null;
}
