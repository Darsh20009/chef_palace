interface Point {
  lat: number;
  lng: number;
}

interface Branch {
  _id?: any;
  id?: string;
  nameAr: string;
  nameEn?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

// Delivery radius in meters (500m)
export const DELIVERY_RADIUS_METERS = 500;

export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

export function getDeliveryZoneForPoint(
  point: Point,
  zones: Array<{ coordinates: Point[]; nameAr: string; deliveryFee: number; _id: string }>
): { zone: string; zoneId: string; deliveryFee: number; isInZone: boolean } | null {
  for (const zone of zones) {
    if (isPointInPolygon(point, zone.coordinates)) {
      return {
        zone: zone.nameAr,
        zoneId: zone._id.toString(),
        deliveryFee: zone.deliveryFee,
        isInZone: true,
      };
    }
  }
  return null;
}

// Calculate distance between two points in kilometers using Haversine formula
export function calculateDistance(point1: Point, point2: Point): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

// Calculate distance in meters
export function calculateDistanceMeters(point1: Point, point2: Point): number {
  return calculateDistance(point1, point2) * 1000;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Check if customer location is within delivery radius (500m) of any branch
export function checkDeliveryAvailability(
  customerLocation: Point,
  branches: Branch[]
): {
  canDeliver: boolean;
  nearestBranch: Branch | null;
  distanceMeters: number;
  message: string;
  messageAr: string;
  allBranchesWithDistance: Array<{
    branch: Branch;
    distanceMeters: number;
    isInRange: boolean;
  }>;
} {
  if (!branches || branches.length === 0) {
    return {
      canDeliver: false,
      nearestBranch: null,
      distanceMeters: 0,
      message: "No branches available",
      messageAr: "لا توجد فروع متاحة",
      allBranchesWithDistance: [],
    };
  }

  const branchesWithDistance = branches
    .filter(b => b.location && b.location.lat && b.location.lng)
    .map(branch => {
      const branchPoint: Point = {
        lat: branch.location!.lat,
        lng: branch.location!.lng,
      };
      const distanceMeters = calculateDistanceMeters(customerLocation, branchPoint);
      return {
        branch,
        distanceMeters,
        isInRange: distanceMeters <= DELIVERY_RADIUS_METERS,
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (branchesWithDistance.length === 0) {
    return {
      canDeliver: false,
      nearestBranch: null,
      distanceMeters: 0,
      message: "No branches with location data available",
      messageAr: "لا توجد فروع بموقع محدد",
      allBranchesWithDistance: [],
    };
  }

  const nearest = branchesWithDistance[0];
  const inRangeBranches = branchesWithDistance.filter(b => b.isInRange);

  if (inRangeBranches.length > 0) {
    return {
      canDeliver: true,
      nearestBranch: inRangeBranches[0].branch,
      distanceMeters: Math.round(inRangeBranches[0].distanceMeters),
      message: `Delivery available from ${inRangeBranches[0].branch.nameEn || inRangeBranches[0].branch.nameAr}`,
      messageAr: `التوصيل متاح من ${inRangeBranches[0].branch.nameAr}`,
      allBranchesWithDistance: branchesWithDistance,
    };
  }

  // Customer is outside all delivery ranges
  return {
    canDeliver: false,
    nearestBranch: nearest.branch,
    distanceMeters: Math.round(nearest.distanceMeters),
    message: `You are ${Math.round(nearest.distanceMeters)}m away from the nearest branch (${nearest.branch.nameEn || nearest.branch.nameAr}). Delivery is only available within ${DELIVERY_RADIUS_METERS}m.`,
    messageAr: `أنت على بعد ${Math.round(nearest.distanceMeters)} متر من أقرب فرع (${nearest.branch.nameAr}). التوصيل متاح فقط ضمن نطاق ${DELIVERY_RADIUS_METERS} متر.`,
    allBranchesWithDistance: branchesWithDistance,
  };
}

// Get the nearest branch that can deliver
export function getNearestDeliveryBranch(
  customerLocation: Point,
  branches: Branch[]
): Branch | null {
  const result = checkDeliveryAvailability(customerLocation, branches);
  return result.canDeliver ? result.nearestBranch : null;
}

export const BADIAH_CENTER: Point = {
  lat: 26.3472,
  lng: 43.9750
};

export const DEFAULT_DELIVERY_FEE = 10;
