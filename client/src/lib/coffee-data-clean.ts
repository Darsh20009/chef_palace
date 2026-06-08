// Cleaned Coffee Data - All old references removed
// Using simple placeholders until proper images are added

export const defaultCoffeeMenu = [
  // Placeholder entries - to be populated from API
];

export const coffeeCategories = [
  { id: "basic" as const, nameAr: "قهوة أساسية", nameEn: "Basic Coffee", menuType: "drinks" as const },
  { id: "hot" as const, nameAr: "قهوة ساخنة", nameEn: "Hot Coffee", menuType: "drinks" as const },
  { id: "cold" as const, nameAr: "قهوة باردة", nameEn: "Cold Coffee", menuType: "drinks" as const },
  { id: "specialty" as const, nameAr: "المشروبات الإضافية", nameEn: "Specialty Drinks", menuType: "drinks" as const },
  { id: "desserts" as const, nameAr: "الحلويات", nameEn: "Desserts", menuType: "drinks" as const },
];

export const foodCategories = [
  { id: "appetizers" as const, nameAr: "المقبلات", nameEn: "Appetizers", menuType: "food" as const },
  { id: "main_courses" as const, nameAr: "الأطباق الرئيسية", nameEn: "Main Courses", menuType: "food" as const },
  { id: "sandwiches" as const, nameAr: "السندويشات", nameEn: "Sandwiches", menuType: "food" as const },
  { id: "salads" as const, nameAr: "السلطات", nameEn: "Salads", menuType: "food" as const },
  { id: "breakfast" as const, nameAr: "الإفطار", nameEn: "Breakfast", menuType: "food" as const },
  { id: "pastries" as const, nameAr: "المعجنات", nameEn: "Pastries", menuType: "food" as const },
];

export const allCategories = [...coffeeCategories, ...foodCategories];

export function getCoffeeImage(coffeeId: string): string {
  // Return مكان الشيف logo as placeholder for all images
  return "/logo.png";
}
