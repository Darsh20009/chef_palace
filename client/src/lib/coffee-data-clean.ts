// Cleaned Menu Data — مكان الشيف البخاري
// Using simple placeholders until proper images are added

export const defaultCoffeeMenu = [
  // Placeholder entries - populated from API
];

export const coffeeCategories = [
  { id: "cat-bukhari" as const, nameAr: "أرز بخاري", nameEn: "Bukhari Rice", menuType: "food" as const },
  { id: "cat-mandi" as const, nameAr: "مندي وزربيان", nameEn: "Mandi", menuType: "food" as const },
  { id: "cat-grills" as const, nameAr: "مشاوي", nameEn: "Grills", menuType: "food" as const },
  { id: "cat-soup" as const, nameAr: "شوربة", nameEn: "Soups", menuType: "food" as const },
  { id: "cat-appetizers" as const, nameAr: "مقبلات", nameEn: "Appetizers", menuType: "food" as const },
  { id: "cat-drinks" as const, nameAr: "مشروبات", nameEn: "Beverages", menuType: "drinks" as const },
  { id: "cat-desserts" as const, nameAr: "حلويات", nameEn: "Desserts", menuType: "food" as const },
];

export const foodCategories = [
  { id: "cat-bukhari" as const, nameAr: "أرز بخاري", nameEn: "Bukhari Rice", menuType: "food" as const },
  { id: "cat-mandi" as const, nameAr: "مندي وزربيان", nameEn: "Mandi", menuType: "food" as const },
  { id: "cat-grills" as const, nameAr: "مشاوي", nameEn: "Grills", menuType: "food" as const },
  { id: "cat-appetizers" as const, nameAr: "مقبلات", nameEn: "Appetizers", menuType: "food" as const },
  { id: "cat-desserts" as const, nameAr: "حلويات", nameEn: "Desserts", menuType: "food" as const },
];

export const allCategories = [...coffeeCategories];

export function getCoffeeImage(coffeeId: string): string {
  return "/logo.png";
}
