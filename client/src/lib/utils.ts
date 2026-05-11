import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { CoffeeItem } from "@shared/schema"

export function cn(...inputs: ClassValue[]) {
 return twMerge(clsx(inputs))
}

// Coffee Strength Types and Configuration
export const COFFEE_STRENGTH_CONFIG = {
 classic: {
 labelAr: "العادي/الكلاسيك",
 labelEn: "Classic",
 color: "#8B4513",
 bgColor: "bg-amber-100 dark:bg-amber-900/30",
 textColor: "text-amber-800 dark:text-amber-200",
 borderColor: "border-amber-300 dark:border-amber-700",
 iconName: "star",
 description: "نكهة متوازنة ومعتدلة، مثالية للاستمتاع اليومي"
 },
 mild: {
 labelAr: "خفيف",
 labelEn: "Mild",
 color: "#DEB887",
 bgColor: "bg-green-100 dark:bg-green-900/30", 
 textColor: "text-green-700 dark:text-green-200",
 borderColor: "border-green-300 dark:border-green-700",
 iconName: "leaf",
 description: "قوة خفيفة ونعومة استثنائية، لبداية لطيفة"
 },
 medium: {
 labelAr: "متوسط",
 labelEn: "Medium",
 color: "#CD853F",
 bgColor: "bg-orange-100 dark:bg-orange-900/30",
 textColor: "text-orange-700 dark:text-orange-200", 
 borderColor: "border-orange-300 dark:border-orange-700",
 iconName: "zap",
 description: "توازن مثالي بين النكهة والقوة"
 },
 strong: {
 labelAr: "قوي",
 labelEn: "Strong",
 color: "#654321",
 bgColor: "bg-red-100 dark:bg-red-900/30",
 textColor: "text-red-800 dark:text-red-200",
 borderColor: "border-red-300 dark:border-red-700", 
 iconName: "flame",
 description: "نكهة قوية ومكثفة للباحثين عن الطاقة"
 }
} as const;

export type CoffeeStrengthType = keyof typeof COFFEE_STRENGTH_CONFIG;

/**
 * Get coffee strength configuration by strength type
 */
export function getCoffeeStrengthConfig(strength: string | null) {
 if (!strength || !(strength in COFFEE_STRENGTH_CONFIG)) {
 return COFFEE_STRENGTH_CONFIG.classic;
 }
 return COFFEE_STRENGTH_CONFIG[strength as CoffeeStrengthType];
}

/**
 * Get Arabic label for coffee strength
 */
export function getCoffeeStrengthLabel(strength: string | null): string {
 return getCoffeeStrengthConfig(strength).labelAr;
}

/**
 * Get strength level display text
 */
export function getStrengthLevelDisplay(strengthLevel: number | null): string {
 if (strengthLevel === null) return "";
 return `(${strengthLevel}/12)`;
}

/**
 * Get full coffee strength display
 */
export function getCoffeeStrengthDisplay(
 strength: string | null, 
 strengthLevel: number | null
): string {
 const label = getCoffeeStrengthLabel(strength);
 const level = getStrengthLevelDisplay(strengthLevel);
 return level ? `${label} ${level}` : label;
}

/**
 * Sort coffee items by strength level
 */
export function sortCoffeeByStrength(items: CoffeeItem[], ascending = true): CoffeeItem[] {
 return [...items].sort((a, b) => {
 // Handle null values (classic goes first/last based on direction)
 if (a.strengthLevel === null && b.strengthLevel === null) return 0;
 if (a.strengthLevel === null) return ascending ? -1 : 1;
 if (b.strengthLevel === null) return ascending ? 1 : -1;
 
 return ascending 
 ? (a.strengthLevel ?? 0) - (b.strengthLevel ?? 0)
 : (b.strengthLevel ?? 0) - (a.strengthLevel ?? 0);
 });
}

/**
 * Filter coffee items by strength type
 */
export function filterCoffeeByStrength(
 items: CoffeeItem[], 
 strengthType: CoffeeStrengthType | "all"
): CoffeeItem[] {
 if (strengthType === "all") return items;
 
 return items.filter(item => {
 if (strengthType === "classic") {
 return item.coffeeStrength === "classic" || !item.coffeeStrength;
 }
 return item.coffeeStrength === strengthType;
 });
}

/**
 * Get strength range for a strength type
 */
export function getStrengthRange(strengthType: CoffeeStrengthType): string {
 switch (strengthType) {
 case "classic":
 return "عادي";
 case "mild":
 return "1-4";
 case "medium":
 return "4-8";
 case "strong":
 return "8-12";
 default:
 return "";
 }
}
