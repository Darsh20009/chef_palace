import { useTranslate } from "@/lib/useTranslate";
import { useState, useEffect } from "react";
import SarIcon from "@/components/sar-icon";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Coffee, ArrowRight, ArrowLeft, CheckCircle, XCircle, Plus, Edit2, Trash2, Sparkles, Upload, ImageIcon, X, FlaskConical, AlertTriangle, Library, ChevronUp, ChevronDown, ListOrdered } from "lucide-react";
import { AddonGroupsEditor, type AddonGroup } from "@/components/addon-groups-editor";
import { ImageLibraryModal } from "@/components/ImageLibraryModal";
import { AIMenuAssistant } from "@/components/AIMenuAssistant";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getCoffeeImage } from "@/lib/coffee-data-clean";
import { nanoid } from "nanoid";
import { Checkbox } from "@/components/ui/checkbox";
import type { CoffeeItem, Employee, Ingredient, RawItem, RecipeItem, Branch } from "@shared/schema";
import { MobileBottomNav } from "@/components/MobileBottomNav";

interface RecipeIngredient {
  rawItemId: string;
  rawItem?: RawItem;
  quantity: number;
  unit: string;
}

interface BranchAvailability {
  branchId: string;
  isAvailable: number;
}

const UNIFIED_CATEGORIES = [
  { id: 'hot',        nameAr: 'مشروبات ساخنة' },
  { id: 'cold',       nameAr: 'مشروبات باردة' },
  { id: 'desserts',   nameAr: 'حلا والكيك'    },
  { id: 'bakery',     nameAr: 'المخبوزات'      },
  { id: 'sandwiches', nameAr: 'الساندوتشات'   },
];
const UNIFIED_CATEGORY_IDS = UNIFIED_CATEGORIES.map(c => c.id);
const LEGACY_FOOD_CATEGORIES = ['food', 'bakery', 'desserts', 'cake', 'croissant', 'sandwiches'];
const LEGACY_DRINK_CATEGORIES = ['hot', 'cold', 'specialty', 'drinks', 'basic', 'additional_drinks'];

interface MenuCategory {
  id: string;
  nameAr: string;
  nameEn?: string;
  icon?: string;
  department: 'drinks' | 'food';
  orderIndex: number;
}

export default function EmployeeMenuManagement() {
 const [, setLocation] = useLocation();
 const search = useSearch();
 const [employee, setEmployee] = useState<Employee | null>(null);
 const managementType = new URLSearchParams(search).get('type') === 'food' ? 'food' : 'drinks';
 const isFood = managementType === 'food';
 const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
 const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
 const [editingItem, setEditingItem] = useState<CoffeeItem | null>(null);
 const [editableSizes, setEditableSizes] = useState<Array<{nameAr: string; price: number}>>([]);
 const [editableAddons, setEditableAddons] = useState<Array<{nameAr: string; nameEn?: string; price: number; imageUrl?: string; category?: string; section?: string; selectionType?: 'single' | 'multiple'}>>([]);
 const [addEditableAddons, setAddEditableAddons] = useState<Array<{nameAr: string; nameEn?: string; price: number; imageUrl?: string; category?: string; section?: string; selectionType?: 'single' | 'multiple'}>>([]);
const [addEditableSizes, setAddEditableSizes] = useState<Array<{nameAr: string; price: number}>>([]);

type BundledSection = {
  sectionTitle: string;
  selectionType: 'single' | 'multiple';
  minSelectable: number;
  maxSelectable: number;
  items: Array<{ productId: string; nameAr: string; nameEn?: string; imageUrl?: string; originalPrice: number; customPrice: number; }>;
};
const [addBundledItems, setAddBundledItems] = useState<BundledSection[]>([]);
const [editBundledItems, setEditBundledItems] = useState<BundledSection[]>([]);
const [addAddonGroups, setAddAddonGroups] = useState<AddonGroup[]>([]);
const [editAddonGroups, setEditAddonGroups] = useState<AddonGroup[]>([]);

type ReservationPackage = { packageName: string; description?: string; price: number; duration?: string; maxGuests?: number; };
const [addIsReservation, setAddIsReservation] = useState(false);
const [addReservationPackages, setAddReservationPackages] = useState<ReservationPackage[]>([]);
const [editIsReservation, setEditIsReservation] = useState(false);
const [editReservationPackages, setEditReservationPackages] = useState<ReservationPackage[]>([]);
 const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
 const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);
 const [imageLibraryContext, setImageLibraryContext] = useState<'add' | 'edit' | 'add-addon' | 'edit-addon'>('add');
  const [editingAddonImageIdx, setEditingAddonImageIdx] = useState<number>(-1);
 const [addImageUrls, setAddImageUrls] = useState<string[]>([]);
 const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
 const { toast } = useToast();
  const tc = useTranslate();
 const queryClient = useQueryClient();
 const canManageMenu = !employee || ["manager", "branch_manager", "admin", "owner"].includes(employee.role);
 const [selectedIngredients, setSelectedIngredients] = useState<Array<{ingredientId: string, name: string, quantity: number, unit: string}>>([]);
 const [recipeItems, setRecipeItems] = useState<RecipeIngredient[]>([]);
 const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
 const [editingRecipeItem, setEditingRecipeItem] = useState<CoffeeItem | null>(null);
 const [addStep, setAddStep] = useState<1 | 2>(1);
 const [selectedCategory, setSelectedCategory] = useState<string>('hot');
 const [selectedCoffeeStrength, setSelectedCoffeeStrength] = useState<string>("classic");
 const [selectedBranches, setSelectedBranches] = useState<BranchAvailability[]>([]);
 const [skipRecipeConfirmOpen, setSkipRecipeConfirmOpen] = useState(false);
 const [isCategoryReorderOpen, setIsCategoryReorderOpen] = useState(false);
 const [localCategories, setLocalCategories] = useState<MenuCategory[]>([]);
 const [isAiGeneratingAddImage, setIsAiGeneratingAddImage] = useState(false);
 const [isAiGeneratingEditImage, setIsAiGeneratingEditImage] = useState(false);
 const [step1Data, setStep1Data] = useState<{
   nameAr: string;
   nameEn: string;
   description: string;
   category: string;
   price: string;
   oldPrice: string;
   coffeeStrength: string;
   imageUrl?: string;
   imageUrls?: string[];
   branchAvailability?: BranchAvailability[];
   isGiftable?: boolean;
   availableSizes?: any[];
   addons?: any[];
   bundledItems?: any[];
   isReservation?: boolean;
   reservationPackages?: any[];
 } | null>(null);
 
 const [sizeImages, setSizeImages] = useState<{[key: string]: string}>({});
 const [sizeFileInputs, setSizeFileInputs] = useState<{[key: string]: HTMLInputElement | null}>({});
 const [addonImages, setAddonImages] = useState<{[key: string]: string}>({});
 const [addonFileInputs, setAddonFileInputs] = useState<{[key: string]: HTMLInputElement | null}>({});
 const [addonFreeStatus, setAddonFreeStatus] = useState<{[key: string]: boolean}>({});

// AI Assistant controlled state for add form
const [aiAddNameAr, setAiAddNameAr] = useState("");
const [aiAddNameEn, setAiAddNameEn] = useState("");
const [aiAddDescription, setAiAddDescription] = useState("");
// AI Assistant controlled state for edit form
const [aiEditNameEn, setAiEditNameEn] = useState("");
const [aiEditDescription, setAiEditDescription] = useState("");

 useEffect(() => {
 const storedEmployee = localStorage.getItem("currentEmployee");
 if (storedEmployee) {
   setEmployee(JSON.parse(storedEmployee));
 }
 // Managers accessing from manager dashboard don't need localStorage check
 // AuthGuard already validates the session
 }, [setLocation]);

  const { data: coffeeItems = [], isLoading, refetch } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: menuCategories = [] } = useQuery<MenuCategory[]>({
    queryKey: ["/api/menu-categories"],
  });

  useEffect(() => {
    const deptCategories = menuCategories.filter(c => c.department === (isFood ? 'food' : 'drinks'));
    if (deptCategories.length > 0) {
      setSelectedCategory(deptCategories[0].id);
    } else {
      setSelectedCategory(isFood ? 'desserts' : 'hot');
    }
  }, [menuCategories, isFood]);

 const { data: ingredients = [] } = useQuery<Ingredient[]>({
 queryKey: ["/api/ingredients"],
 });

 const { data: rawItems = [] } = useQuery<RawItem[]>({
   queryKey: ["/api/inventory/raw-items"],
   enabled: canManageMenu,
 });

 const { data: allRecipes = [] } = useQuery<RecipeItem[]>({
   queryKey: ["/api/inventory/all-recipes"],
   enabled: canManageMenu,
 });

 const { data: branches = [] } = useQuery<Branch[]>({
   queryKey: ["/api/branches"],
   enabled: canManageMenu,
 });

 const calculateRecipeCost = (items: RecipeIngredient[]) => {
   if (items.length === 0) return { totalCost: 0, breakdown: [] };
   
   const breakdown: Array<{name: string, quantity: number, unit: string, unitCost: number, cost: number}> = [];
   let totalCost = 0;
   
   for (const item of items) {
     const rawItem = rawItems.find(r => r.id === item.rawItemId);
     if (rawItem) {
       const ingUnit = item.unit.toLowerCase();
       const rawUnit = rawItem.unit.toLowerCase();
       
       let convertedQuantity = item.quantity;
       
       if (rawUnit === 'kg' && ingUnit === 'g') {
         convertedQuantity = item.quantity / 1000;
       } else if (rawUnit === 'g' && ingUnit === 'kg') {
         convertedQuantity = item.quantity * 1000;
       } else if ((rawUnit === 'liter' || rawUnit === 'l') && ingUnit === 'ml') {
         convertedQuantity = item.quantity / 1000;
       } else if ((rawUnit === 'ml') && (ingUnit === 'liter' || ingUnit === 'l')) {
         convertedQuantity = item.quantity * 1000;
       }
       
       const itemCost = convertedQuantity * rawItem.unitCost;
       totalCost += itemCost;
       breakdown.push({
         name: rawItem.nameAr,
         quantity: item.quantity,
         unit: item.unit,
         unitCost: rawItem.unitCost,
         cost: itemCost
       });
     }
   }
   
   return { totalCost, breakdown };
 };

 const getProductRecipeCount = (coffeeItemId: string) => {
   return allRecipes.filter(r => r.coffeeItemId === coffeeItemId).length;
 };

 const getProductCOGS = (coffeeItemId: string) => {
   const productRecipes = allRecipes.filter(r => r.coffeeItemId === coffeeItemId);
   let totalCost = 0;
   for (const recipe of productRecipes) {
     const rawItem = rawItems.find(r => r.id === recipe.rawItemId);
     if (rawItem) {
       totalCost += recipe.quantity * rawItem.unitCost;
     }
   }
   return totalCost;
 };

 const calculatePreviewCost = () => {
   if (selectedIngredients.length === 0) return { totalCost: 0, breakdown: [], unmatched: [] };
   
   const breakdown: Array<{name: string, quantity: number, unit: string, unitCost: number, cost: number, rawUnit: string}> = [];
   const unmatched: string[] = [];
   let totalCost = 0;
   
   for (const ing of selectedIngredients) {
     const matchedRawItem = rawItems.find(ri => 
       ri.nameAr === ing.name || 
       ri.nameEn?.toLowerCase() === ing.name.toLowerCase()
     );
     
     if (matchedRawItem) {
       const ingUnit = ing.unit.toLowerCase();
       const rawUnit = matchedRawItem.unit.toLowerCase();
       
       let convertedQuantity = ing.quantity;
       
       if (rawUnit === 'kg' && ingUnit === 'g') {
         convertedQuantity = ing.quantity / 1000;
       } else if (rawUnit === 'g' && ingUnit === 'kg') {
         convertedQuantity = ing.quantity * 1000;
       } else if ((rawUnit === 'liter' || rawUnit === 'l') && ingUnit === 'ml') {
         convertedQuantity = ing.quantity / 1000;
       } else if ((rawUnit === 'ml') && (ingUnit === 'liter' || ingUnit === 'l')) {
         convertedQuantity = ing.quantity * 1000;
       }
       
       const itemCost = convertedQuantity * matchedRawItem.unitCost;
       totalCost += itemCost;
       breakdown.push({
         name: ing.name,
         quantity: ing.quantity,
         unit: ing.unit,
         unitCost: matchedRawItem.unitCost,
         rawUnit: matchedRawItem.unit,
         cost: itemCost
       });
     } else {
       unmatched.push(ing.name);
     }
   }
   
   return { totalCost, breakdown, unmatched };
 };

 const createItemMutation = useMutation({
 mutationFn: async (payload: { 
   itemData: any; 
   ingredientsList: Array<{ingredientId: string, quantity: number, unit: string}>;
   recipeList?: RecipeIngredient[];
 }) => {
   const { itemData, ingredientsList, recipeList } = payload;
   const res = await apiRequest("POST", "/api/coffee-items", itemData);
   const createdItem = await res.json();
   
   const newItemId = createdItem.id;
   
   // Create recipe items (new system using RawItems)
   if (newItemId && recipeList && recipeList.length > 0) {
     await apiRequest("POST", "/api/inventory/recipes/bulk", {
       coffeeItemId: newItemId,
       items: recipeList.map(r => ({
         rawItemId: r.rawItemId,
         quantity: r.quantity,
         unit: r.unit
       })),
       clearExisting: true
     });
   }
   
   // Legacy: Also create old-style ingredients if provided
   if (newItemId && ingredientsList.length > 0) {
     for (const ing of ingredientsList) {
       await apiRequest("POST", `/api/coffee-items/${newItemId}/ingredients`, {
         ingredientId: ing.ingredientId,
         quantity: ing.quantity,
         unit: ing.unit
       });
     }
   }
   
   return createdItem;
 },
 onSuccess: async () => {
   // Force a fresh refetch of all relevant data
   await Promise.all([
     queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] }),
     queryClient.invalidateQueries({ queryKey: ["/api/inventory/all-recipes"] }),
     refetch()
   ]);
   
   setIsAddDialogOpen(false);
   setSelectedIngredients([]);
   setRecipeItems([]);
   setSelectedBranches([]);
   setAddImageUrls([]);
   setAddStep(1);
   setStep1Data(null);
   setSelectedCategory(defaultCategory);
   setSelectedCoffeeStrength("classic");
   toast({
     title: tc("تم إضافة المشروب", "Item Added"),
     description: tc("تم إضافة المشروب بنجاح إلى القائمة", "Item was added successfully to the menu"),
   });
 },
 onError: (error: any) => {
   toast({
     variant: "destructive",
     title: tc("فشل إضافة المشروب", "Failed to Add Item"),
     description: error.message || tc("حدث خطأ أثناء إضافة المشروب", "An error occurred while adding the item"),
   });
 },
 });

 const bulkRecipeMutation = useMutation({
   mutationFn: async (payload: { coffeeItemId: string; items: RecipeIngredient[]; clearExisting?: boolean }) => {
     const res = await apiRequest("POST", "/api/inventory/recipes/bulk", {
       coffeeItemId: payload.coffeeItemId,
       items: payload.items.map(r => ({
         rawItemId: r.rawItemId,
         quantity: r.quantity,
         unit: r.unit
       })),
       clearExisting: payload.clearExisting ?? true
     });
     return await res.json();
   },
   onSuccess: () => {
     queryClient.invalidateQueries({ queryKey: ["/api/inventory/all-recipes"] });
     setIsRecipeDialogOpen(false);
     setEditingRecipeItem(null);
     setRecipeItems([]);
     toast({
       title: tc("تم حفظ الوصفة", "Recipe Saved"),
       description: tc("تم حفظ مكونات الوصفة بنجاح", "Recipe ingredients saved successfully"),
     });
   },
   onError: (error: any) => {
     toast({
       variant: "destructive",
       title: tc("فشل حفظ الوصفة", "Failed to Save Recipe"),
       description: error.message || tc("حدث خطأ أثناء حفظ الوصفة", "An error occurred while saving the recipe"),
     });
   },
 });

 const updateAvailabilityMutation = useMutation({
 mutationFn: async ({ id, isAvailable, availabilityStatus }: { id: string; isAvailable?: number; availabilityStatus?: string }) => {
   // Get branchId from employee if available
   const branchId = employee?.branchId;
   
   const response = await fetch(`/api/coffee-items/${id}/availability`, {
     method: "PATCH",
     headers: {
       "Content-Type": "application/json",
     },
     credentials: 'include',
     body: JSON.stringify({ isAvailable, availabilityStatus, branchId }),
   });
 
 if (!response.ok) {
 throw new Error("Failed to update availability");
 }
 
 return response.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
 toast({
 title: tc("تم التحديث بنجاح", "Updated Successfully"),
 description: tc("تم تحديث حالة توفر المشروب", "Item availability updated"),
 });
 },
 onError: () => {
 toast({
 title: tc("خطأ", "Error"),
 description: tc("فشل تحديث حالة توفر المشروب", "Failed to update item availability"),
 variant: "destructive",
 });
 },
 });

 const updateItemMutation = useMutation({
 mutationFn: async (data: { id: string; updates: any }) => {
 const res = await apiRequest("PUT", `/api/coffee-items/${data.id}`, data.updates);
 return await res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
 queryClient.invalidateQueries({ queryKey: ["/api/coffee-items/with-addons"] });
 queryClient.invalidateQueries({ queryKey: ["/api/coffee-items/addons-preview"] });
 queryClient.invalidateQueries({ queryKey: ["/api/product-addons"] });
 setIsEditDialogOpen(false);
 setEditingItem(null);
 toast({
 title: tc("تم التحديث", "Updated"),
 description: tc("تم تحديث المشروب بنجاح", "Item updated successfully"),
 });
 },
 onError: (error: any) => {
 toast({
 variant: "destructive",
 title: tc("فشل التحديث", "Update Failed"),
 description: error.message || tc("حدث خطأ أثناء تحديث المشروب", "An error occurred while updating the item"),
 });
 },
 });

 const deleteItemMutation = useMutation({
 mutationFn: async (id: string) => {
   const res = await apiRequest("DELETE", `/api/coffee-items/${id}`);
   if (!res.ok) {
     const errorData = await res.json();
     throw new Error(errorData.error || tc("فشل في حذف المشروب", "Failed to delete item"));
   }
   return await res.json();
 },
 onSuccess: async () => {
   await queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
   if (typeof refetch === 'function') {
     await refetch();
   }
   setDeletingItemId(null);
   toast({
     title: tc("تم الحذف", "Deleted"),
     description: tc("تم حذف المشروب بنجاح", "Item deleted successfully"),
   });
 },
 onError: (error: any) => {
   setDeletingItemId(null);
   toast({
     variant: "destructive",
     title: tc("فشل الحذف", "Delete Failed"),
     description: error.message || tc("حدث خطأ أثناء حذف المشروب. قد يكون المشروب مرتبطاً بطلبات حالية.", "Error deleting item. Item may be linked to current orders."),
   });
 },
 });

 const toggleNewProductMutation = useMutation({
 mutationFn: async ({ id, isNewProduct }: { id: string; isNewProduct: number }) => {
 const res = await apiRequest("PUT", `/api/coffee-items/${id}`, { isNewProduct });
 return await res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
 toast({
 title: tc("تم التحديث", "Updated"),
 description: tc("تم تحديث حالة المنتج الجديد", "New product status updated"),
 });
 },
 onError: (error: any) => {
 toast({
 variant: "destructive",
 title: tc("فشل التحديث", "Update Failed"),
 description: error.message || tc("حدث خطأ أثناء التحديث", "Error during update"),
 });
 },
 });

 const reorderCategoriesMutation = useMutation({
   mutationFn: async (orders: Array<{ id: string; orderIndex: number }>) => {
     const res = await apiRequest("POST", "/api/menu-categories/reorder", { orders });
     return await res.json();
   },
   onSuccess: () => {
     queryClient.invalidateQueries({ queryKey: ["/api/menu-categories"] });
     toast({ title: tc("تم الحفظ", "Saved"), description: tc("تم حفظ ترتيب الأقسام", "Category order saved") });
     setIsCategoryReorderOpen(false);
   },
   onError: () => {
     toast({ variant: "destructive", title: tc("خطأ", "Error"), description: tc("فشل حفظ الترتيب", "Failed to save order") });
   },
 });

 const openCategoryReorder = () => {
   const deptCats = menuCategories.filter(c => c.department === (isFood ? 'food' : 'drinks'));
   const sorted = [...deptCats].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
   setLocalCategories(sorted);
   setIsCategoryReorderOpen(true);
 };

 const moveCategoryUp = (idx: number) => {
   if (idx === 0) return;
   const arr = [...localCategories];
   [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
   setLocalCategories(arr);
 };

 const moveCategoryDown = (idx: number) => {
   if (idx === localCategories.length - 1) return;
   const arr = [...localCategories];
   [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
   setLocalCategories(arr);
 };

 const saveCategoryOrder = () => {
   const orders = localCategories.map((c, i) => ({ id: c.id, orderIndex: i }));
   reorderCategoriesMutation.mutate(orders);
 };

 const handleToggleAvailability = (item: CoffeeItem) => {
 const newAvailability = item.isAvailable === 1 ? 0 : 1;
 updateAvailabilityMutation.mutate({ id: item.id, isAvailable: newAvailability });
 };

 const handleStatusChange = (id: string, status: string) => {
 updateAvailabilityMutation.mutate({ 
 id, 
 availabilityStatus: status 
 });
 };

 const handleStep1Submit = async (e: React.FormEvent<HTMLFormElement>) => {
   e.preventDefault();
   const formData = new FormData(e.currentTarget);
   
   const nameAr = formData.get("nameAr") as string;
   const price = formData.get("price") as string;
   
   if (!nameAr || !selectedCategory || !price) {
     toast({
       title: tc("خطأ", "Error"),
       description: tc("يرجى ملء جميع الحقول المطلوبة", "Please fill all required fields"),
       variant: "destructive"
     });
     return;
   }
   
   setStep1Data({
     nameAr,
     nameEn: formData.get("nameEn") as string || "",
     description: formData.get("description") as string || "",
     category: selectedCategory,
     price,
     oldPrice: formData.get("oldPrice") as string || "",
     coffeeStrength: selectedCoffeeStrength,
     imageUrl: addImageUrls[0] || step1Data?.imageUrl,
    imageUrls: addImageUrls.length > 0 ? addImageUrls : (step1Data?.imageUrls || []),
     branchAvailability: selectedBranches.length > 0 ? selectedBranches : undefined,
     isGiftable: false, // Default value, will be updated by UI if needed
     availableSizes: addEditableSizes.filter(s => s.nameAr.trim()),
     addons: addEditableAddons.filter(a => a.nameAr.trim()),
     bundledItems: addBundledItems,
     addonGroups: addAddonGroups,
     isReservation: addIsReservation,
     reservationPackages: addReservationPackages.filter(p => p.packageName.trim()),
   });
   setAddStep(2);
 };

 const handleToggleBranch = (branchId: string, checked: boolean) => {
   if (checked) {
     setSelectedBranches([...selectedBranches, { branchId, isAvailable: 1 }]);
   } else {
     setSelectedBranches(selectedBranches.filter(b => b.branchId !== branchId));
   }
 };

 const handleConfirmSkipRecipe = () => {
   setSkipRecipeConfirmOpen(false);
   handleSkipIngredientsActual();
 };

 const handleSkipIngredientsActual = () => {
   if (!step1Data) return;
   
   const itemId = nanoid(10);
   const itemData = {
     id: itemId,
     nameAr: step1Data.nameAr,
     nameEn: step1Data.nameEn || undefined,
     description: step1Data.description,
     price: parseFloat(step1Data.price),
     oldPrice: step1Data.oldPrice ? parseFloat(step1Data.oldPrice) : undefined,
     category: step1Data.category,
     coffeeStrength: step1Data.coffeeStrength || "classic",
     imageUrl: step1Data.imageUrl,
     isAvailable: 1,
     availabilityStatus: "available",
     isNewProduct: 0,
     isGiftable: step1Data.isGiftable || false,
     availableSizes: step1Data.availableSizes || [],
     addons: (step1Data as any).addons || [],
     bundledItems: (step1Data as any).bundledItems || [],
     addonGroups: addAddonGroups,
     isReservation: (step1Data as any).isReservation || false,
     reservationPackages: (step1Data as any).reservationPackages || [],
     branchAvailability: step1Data.branchAvailability,
     hasRecipe: 0,
     requiresRecipe: 0,
   };

   createItemMutation.mutate({
     itemData,
     ingredientsList: [],
     recipeList: []
   });
 };

 const handleStep2Submit = () => {
   if (!step1Data) return;
   
   const itemId = nanoid(10);
   const hasRecipeItems = recipeItems.length > 0 || selectedIngredients.length > 0;
   
   const itemData = {
     id: itemId,
     nameAr: step1Data.nameAr,
     nameEn: step1Data.nameEn || undefined,
     description: step1Data.description,
     price: parseFloat(step1Data.price),
     oldPrice: step1Data.oldPrice ? parseFloat(step1Data.oldPrice) : undefined,
     category: step1Data.category,
     coffeeStrength: step1Data.coffeeStrength || "classic",
     imageUrl: step1Data.imageUrl,
     isAvailable: 1,
     availabilityStatus: "available",
     isNewProduct: 0,
     isGiftable: step1Data.isGiftable || false,
     availableSizes: step1Data.availableSizes || [],
     addons: (step1Data as any).addons || [],
     bundledItems: (step1Data as any).bundledItems || [],
     addonGroups: addAddonGroups,
     isReservation: (step1Data as any).isReservation || false,
     reservationPackages: (step1Data as any).reservationPackages || [],
     branchAvailability: step1Data.branchAvailability,
     hasRecipe: hasRecipeItems ? 1 : 0,
     requiresRecipe: 1,
   };

   createItemMutation.mutate({
     itemData,
     ingredientsList: selectedIngredients.map(ing => ({
       ingredientId: ing.ingredientId,
       quantity: ing.quantity,
       unit: ing.unit
     })),
     recipeList: recipeItems
   });
 };

 const handleSkipIngredients = () => {
   if (!step1Data) return;
   
   // Show confirmation dialog for admin override
   if (canManageMenu) {
     setSkipRecipeConfirmOpen(true);
     return;
   }
   
   // Non-managers can skip directly
   handleSkipIngredientsActual();
 };

  const handleOpenRecipeEditor = (item: CoffeeItem) => {
   setEditingRecipeItem(item);
   // Load existing recipes for this item with rawItem reference
   const existingRecipes = allRecipes.filter(r => r.coffeeItemId === item.id);
   setRecipeItems(existingRecipes.map(r => {
     const raw = rawItems.find(ri => ri.id === r.rawItemId);
     return {
       rawItemId: r.rawItemId,
       rawItem: raw,
       quantity: r.quantity,
       unit: r.unit || raw?.unit || 'g' // Use stored unit or fallback to rawItem's unit
     };
   }));
   setIsRecipeDialogOpen(true);
 };

 const handleSaveRecipe = () => {
   if (!editingRecipeItem) return;
   
   if (recipeItems.length === 0) {
     toast({
       title: tc("خطأ", "Error"),
       description: tc("يجب إضافة مكون واحد على الأقل للوصفة", "At least one ingredient must be added to the recipe"),
       variant: "destructive"
     });
     return;
   }
   
   bulkRecipeMutation.mutate({
     coffeeItemId: editingRecipeItem.id,
     items: recipeItems,
     clearExisting: true
   });
 };

 const handleSubmitEditItem = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 if (!editingItem) return;
 
 const formData = new FormData(e.currentTarget);
 

   const updates = {
     nameAr: formData.get("nameAr") as string,
     nameEn: formData.get("nameEn") as string || undefined,
     description: formData.get("description") as string,
     price: parseFloat(formData.get("price") as string),
     oldPrice: formData.get("oldPrice") ? parseFloat(formData.get("oldPrice") as string) : undefined,
     category: formData.get("category") as string,
     costOfGoods: formData.get("costOfGoods") ? parseFloat(formData.get("costOfGoods") as string) : (editingItem.costOfGoods || 0),
     imageUrl: editImageUrls.length > 0 ? editImageUrls[0] : editingItem.imageUrl,
    imageUrls: editImageUrls.length > 0 ? editImageUrls : ((editingItem as any).imageUrls || []),
    addons: editableAddons,
    bundledItems: editBundledItems,
    addonGroups: editAddonGroups,
    isReservation: editIsReservation,
    reservationPackages: editReservationPackages.filter(p => p.packageName.trim()),
     availableSizes: editableSizes,
   };

   updateItemMutation.mutate({ id: editingItem.id, updates });
 };

 const handleEdit = (item: CoffeeItem) => {
 setEditingItem(item);
 setEditableSizes(item.availableSizes || []);
 setEditableAddons(item.addons || []);
 setEditBundledItems((item as any).bundledItems || []);
 setEditAddonGroups((item as any).addonGroups || []);
 setEditIsReservation((item as any).isReservation || false);
 setEditReservationPackages((item as any).reservationPackages || []);
setEditImageUrls((item as any).imageUrls || (item.imageUrl ? [item.imageUrl] : []));
 setAiEditNameEn(item.nameEn || "");
 setAiEditDescription(item.description || "");
 setIsEditDialogOpen(true);
 };

 const handleDelete = (id: string) => {
 setDeletingItemId(id);
 };

 const confirmDelete = () => {
 if (deletingItemId) {
 deleteItemMutation.mutate(deletingItemId);
 }
 };

 const handleToggleNewProduct = (item: CoffeeItem) => {
 const newValue = item.isNewProduct === 1 ? 0 : 1;
 toggleNewProductMutation.mutate({ id: item.id, isNewProduct: newValue });
 };

 const legacyCategoryNames: Record<string, string> = {
 basic: tc("قهوة أساسية", "Basic Coffee"),
 hot: tc("قهوة ساخنة", "Hot Coffee"),
 cold: tc("قهوة باردة", "Cold Coffee"),
 specialty: tc("مشروبات إضافية", "Specialty Drinks"),
 drinks: tc("المشروبات", "Drinks"),
 desserts: tc("الحلويات", "Desserts"),
 food: tc("المأكولات", "Food"),
 bakery: tc("المخبوزات", "Bakery"),
 };

 const dynamicCategoryIds = menuCategories.map(c => c.id);
 const dynamicCategoryNames: Record<string, string> = Object.fromEntries(
   menuCategories.map(c => [c.id, c.nameAr])
 );
 const unifiedCategoryNames: Record<string, string> = Object.fromEntries(
   UNIFIED_CATEGORIES.map(c => [c.id, c.nameAr])
 );
 const categoryNames: Record<string, string> = { ...legacyCategoryNames, ...unifiedCategoryNames, ...dynamicCategoryNames };

 const DRINK_UNIFIED_IDS = ['hot', 'cold'];
 const FOOD_UNIFIED_IDS  = ['desserts', 'bakery', 'sandwiches'];

 // Only show UNIFIED categories when the user has NO custom dynamic categories.
 // This prevents ghost/duplicate categories when the user has their own category system.
 const deptDynamicCategories = menuCategories.filter(c => c.department === (isFood ? 'food' : 'drinks'));
 const availableForDropdown = deptDynamicCategories.length > 0
   ? deptDynamicCategories
   : UNIFIED_CATEGORIES.filter(c => isFood ? FOOD_UNIFIED_IDS.includes(c.id) : DRINK_UNIFIED_IDS.includes(c.id));

 const defaultCategory = isFood ? 'desserts' : 'hot';

 // For item display: include ALL possible category IDs for this department (dynamic + legacy/unified)
 // so items saved with old category IDs still show up even after switching to custom categories.
 const deptLegacyIds = isFood
   ? [...LEGACY_FOOD_CATEGORIES, ...FOOD_UNIFIED_IDS]
   : [...LEGACY_DRINK_CATEGORIES, ...DRINK_UNIFIED_IDS];
 const availableCatIds = new Set([
   ...availableForDropdown.map(c => c.id),
   ...deptLegacyIds,
   ...deptDynamicCategories.map(c => c.id),
 ]);
 const filteredItems = coffeeItems.filter(item => availableCatIds.has(item.category));

 const categorizedItems = filteredItems.reduce((acc, item) => {
 if (!acc[item.category]) {
 acc[item.category] = [];
 }
 acc[item.category].push(item);
 return acc;
 }, {} as Record<string, CoffeeItem[]>);

 return (
 <div className="min-h-screen bg-gray-50 p-4 pb-20 sm:pb-4">

         {/* Quick Add Cards */}
         <div className="max-w-7xl mx-auto mb-6">
           <div className="grid grid-cols-2 gap-4 mb-6">
             <button
               onClick={() => {
                 setLocation('/employee/menu-management?type=drinks');
                 setTimeout(() => setIsAddDialogOpen(true), 50);
               }}
               className="flex flex-col items-center justify-center gap-3 p-6 bg-white border-2 border-primary/20 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all shadow-sm group"
               data-testid="button-quick-add-drink"
             >
               <div className="w-14 h-14 bg-primary/10 group-hover:bg-primary/20 rounded-full flex items-center justify-center transition-colors">
                 <Coffee className="w-7 h-7 text-primary" />
               </div>
               <div className="text-center">
                 <p className="text-lg font-bold text-gray-800">إضافة مشروب</p>
                 <p className="text-xs text-gray-400">قهوة، عصائر، مشروبات</p>
               </div>
               <div className="flex items-center gap-1 text-primary text-sm font-medium">
                 <Plus className="w-4 h-4" />
                 <span>إضافة جديد</span>
               </div>
             </button>

             <button
               onClick={() => {
                 setLocation('/employee/menu-management?type=food');
                 setTimeout(() => setIsAddDialogOpen(true), 50);
               }}
               className="flex flex-col items-center justify-center gap-3 p-6 bg-white border-2 border-orange-200 rounded-2xl hover:border-orange-400 hover:bg-orange-50 transition-all shadow-sm group"
               data-testid="button-quick-add-food"
             >
               <div className="w-14 h-14 bg-orange-100 group-hover:bg-orange-200 rounded-full flex items-center justify-center transition-colors">
                 <span className="text-2xl">🍽️</span>
               </div>
               <div className="text-center">
                 <p className="text-lg font-bold text-gray-800">إضافة أكلة</p>
                 <p className="text-xs text-gray-400">حلويات، مخبوزات، وجبات</p>
               </div>
               <div className="flex items-center gap-1 text-orange-500 text-sm font-medium">
                 <Plus className="w-4 h-4" />
                 <span>إضافة جديد</span>
               </div>
             </button>
           </div>
         </div>

 {/* Header */}
         <div className="max-w-7xl mx-auto mb-6">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-3">
         <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
         <Coffee className="w-6 h-6 text-white" />
         </div>
         <div>
         <h1 className="text-2xl font-bold text-primary">{tc("إدارة القائمة", "Menu Management")}</h1>
         <p className="text-gray-400 text-sm">{tc("تحديث حالة توفر المنتجات", "Update product availability")}</p>
         </div>
         </div>
         <div className="flex flex-wrap gap-2">
{canManageMenu && (
 <Button
   variant="outline"
   onClick={openCategoryReorder}
   className="border-primary/40 text-primary hover:bg-primary/10"
   data-testid="button-reorder-categories"
 >
   <ListOrdered className="w-4 h-4 ml-2" />
   {tc("ترتيب الأقسام", "Reorder Categories")}
 </Button>
 )}
{canManageMenu && (
 <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
  setIsAddDialogOpen(open);
  if (open) {
    // Initialize step1Data when opening the dialog
    const initCategory = isFood ? 'desserts' : 'hot';
    setSelectedCategory(initCategory);
    setStep1Data({
      nameAr: '',
      nameEn: '',
      description: '',
      category: initCategory,
      price: '0',
      oldPrice: '0',
      coffeeStrength: 'classic',
      availableSizes: [],
      addons: [],
      isGiftable: false
    });
    setAddStep(1);
  } else {
    setAddStep(1);
    setStep1Data(null);
    setSelectedIngredients([]);
    setAddImageUrls([]);
    setAddEditableAddons([]);
    setAddEditableSizes([]);
    setAddBundledItems([]);
    setAddAddonGroups([]);
    setAddIsReservation(false);
    setAddReservationPackages([]);
    setSelectedCategory(defaultCategory);
    setSelectedCoffeeStrength("classic");
  }
}}>
 <DialogTrigger asChild>
 <Button
 className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
 data-testid="button-add-item"
 >
 <Plus className="w-4 h-4 ml-2" />
 {isFood ? tc('إضافة صنف جديد', 'Add New Item') : tc('إضافة مشروب جديد', 'Add New Drink')}
 </Button>
 </DialogTrigger>
 <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="text-accent">
   <div className="flex flex-col gap-3">
     <span>{tc("إضافة مشروب جديد", "Add New Item")}</span>
     <div className="flex items-center gap-2 text-sm font-normal">
       <span className={`px-3 py-1 rounded-full ${addStep === 1 ? 'bg-primary text-white' : 'bg-gray-600 text-gray-300'}`}>
         1. المعلومات الأساسية
       </span>
       <ArrowLeft className="w-4 h-4 text-gray-400" />
       <span className={`px-3 py-1 rounded-full ${addStep === 2 ? 'bg-primary text-white' : 'bg-gray-600 text-gray-300'}`}>
         2. المكونات والوصفة
       </span>
     </div>
   </div>
 </DialogTitle>
 </DialogHeader>

 {addStep === 1 ? (
 <form onSubmit={handleStep1Submit} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="nameAr" className="text-gray-300">{tc("الاسم بالعربية *", "Arabic Name *")}</Label>
 <Input
 id="nameAr"
 name="nameAr"
 required
 defaultValue={step1Data?.nameAr || ""}
 onChange={(e) => setAiAddNameAr(e.target.value)}
 className="bg-gray-50 border-gray-300 text-gray-900"
 data-testid="input-name-ar"
 />
 </div>
 <div>
 <Label htmlFor="nameEn" className="text-gray-300">
   <span className="flex items-center justify-between">
     <span>{tc("الاسم بالإنجليزية", "English Name")}</span>
     <AIMenuAssistant
       nameAr={aiAddNameAr || step1Data?.nameAr || ""}
       nameEn={aiAddNameEn}
       category={selectedCategory}
       existingDescription={aiAddDescription}
       onInsertNameEn={(name) => setAiAddNameEn(name)}
       onInsertDescription={(desc) => setAiAddDescription(desc)}
       onInsertAddons={(addons) => setAddEditableAddons(prev => [...prev, ...addons.map(a => ({ ...a, imageUrl: '', category: 'other', section: '' }))])}
       compact
     />
   </span>
 </Label>
 <Input
 id="nameEn"
 name="nameEn"
 value={aiAddNameEn}
 onChange={(e) => setAiAddNameEn(e.target.value)}
 className="bg-gray-50 border-gray-300 text-gray-900"
 data-testid="input-name-en"
 />
 </div>
 </div>

 <div>
 <Label htmlFor="description" className="text-gray-300">
   <span className="flex items-center justify-between mb-1">
     <span>{tc("الوصف *", "Description *")}</span>
     <AIMenuAssistant
       nameAr={aiAddNameAr || step1Data?.nameAr || ""}
       nameEn={aiAddNameEn}
       category={selectedCategory}
       existingDescription={aiAddDescription}
       onInsertDescription={(desc) => setAiAddDescription(desc)}
       onInsertNameEn={(name) => setAiAddNameEn(name)}
       onInsertAddons={(addons) => setAddEditableAddons(prev => [...prev, ...addons.map(a => ({ ...a, imageUrl: '', category: 'other', section: '' }))])}
       compact
     />
   </span>
 </Label>
 <Textarea
 id="description"
 name="description"
 required
 value={aiAddDescription}
 onChange={(e) => setAiAddDescription(e.target.value)}
 className="bg-gray-50 border-gray-300 text-gray-900 min-h-[80px]"
 data-testid="input-description"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <Label htmlFor="category" className="text-gray-300">{tc("القسم *", "Category *")}</Label>
                       <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                         <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900" data-testid="select-category">
                           <SelectValue placeholder={tc("اختر القسم", "Select category")} />
                         </SelectTrigger>
                         <SelectContent className="bg-white border-gray-200 text-gray-900">
                           {availableForDropdown.map(cat => (
                             <SelectItem key={cat.id} value={cat.id}>{cat.nameAr}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="flex items-center space-x-2 space-x-reverse pt-8">
                       <Switch 
                         id="isGiftable" 
                         checked={step1Data?.isGiftable || false}
                         onCheckedChange={(checked) => setStep1Data(prev => prev ? ({ ...prev, isGiftable: checked }) : null)}
                       />
                       <Label htmlFor="isGiftable" className="text-gray-300">{tc("قابل للإهداء", "Giftable")}</Label>
                     </div>
                   </div>

                   <div>
                   <Label htmlFor="price" className="text-gray-300">{tc("السعر (ريال) *", "Price (SAR) *")}</Label>
 <Input
 id="price"
 name="price"
 type="number"
 step="0.01"
 min="0"
 required
 defaultValue={step1Data?.price || ""}
 className="bg-gray-50 border-gray-300 text-gray-900"
 data-testid="input-price"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="oldPrice" className="text-gray-300">{tc("السعر القديم (ريال)", "Old Price (SAR)")}</Label>
 <Input
 id="oldPrice"
 name="oldPrice"
 type="number"
 step="0.01"
 min="0"
 defaultValue={step1Data?.oldPrice || ""}
 className="bg-gray-50 border-gray-300 text-gray-900"
 data-testid="input-old-price"
 />
 </div>
<div>
 <Label className="text-gray-300">{tc("صور المنتج (حتى 5 صور)", "Item Photos (up to 5)")}</Label>
 <div className="mt-2 space-y-2">
   <div className="flex flex-wrap gap-2">
     {addImageUrls.map((url, idx) => (
       <div key={idx} className="relative w-20 h-20">
         <img src={url.startsWith('/') ? url : (url.startsWith('http') ? url : "/" + url)} alt={"صورة " + (idx+1)} className="w-full h-full object-cover rounded-lg border border-gray-300" />
         <button type="button" onClick={() => setAddImageUrls(addImageUrls.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-600 rounded-full w-5 h-5 flex items-center justify-center">
           <X className="w-3 h-3 text-white" />
         </button>
         {idx === 0 && <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-primary/80 text-white rounded-b-lg">{tc("رئيسية", "Main")}</span>}
       </div>
     ))}
     {addImageUrls.length < 5 && (
       <button type="button" onClick={() => { setImageLibraryContext("add"); setIsImageLibraryOpen(true); }} className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-primary/60 hover:text-accent hover:border-accent/50 transition-colors">
         <Plus className="w-5 h-5" />
         <span className="text-[10px] mt-1">{tc("إضافة", "Add")}</span>
       </button>
     )}
   </div>
   {addImageUrls.length === 0 && <p className="text-gray-500 text-xs">اختر صوراً من المكتبة. الصورة الأولى ستكون الرئيسية</p>}
   <button
     type="button"
     disabled={isAiGeneratingAddImage}
     onClick={async () => {
       const name = step1Data?.nameAr || aiAddNameAr;
       if (!name) { toast({ title: "اكتب اسم المنتج أولاً", variant: "destructive" }); return; }
       setIsAiGeneratingAddImage(true);
       try {
         const res = await fetch("/api/ai/generate-product-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productName: name, description: step1Data?.description || aiAddDescription }) });
         const data = await res.json();
         if (data.imageUrl) { setAddImageUrls(prev => [...prev, data.imageUrl]); toast({ title: "✨ تم توليد الصورة بالذكاء الاصطناعي" }); }
       } catch { toast({ title: "فشل توليد الصورة", variant: "destructive" }); }
       finally { setIsAiGeneratingAddImage(false); }
     }}
     className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-60"
     data-testid="button-ai-generate-add-image"
   >
     <Sparkles className="w-4 h-4" />
     {isAiGeneratingAddImage ? "جاري التوليد..." : "توليد صورة بالذكاء الاصطناعي ✨"}
   </button>
 </div>
</div>
 </div>

 <div>
 <Label htmlFor="coffeeStrength" className="text-gray-300">مستوى التحضير</Label>
 <Select value={selectedCoffeeStrength} onValueChange={setSelectedCoffeeStrength}>
 <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900" data-testid="select-coffee-strength">
 <SelectValue placeholder="اختر مستوى التحضير" />
 </SelectTrigger>
 <SelectContent className="bg-white border-gray-200 text-gray-900">
 <SelectItem value="mild">خفيف</SelectItem>
 <SelectItem value="classic">عادي / كلاسيك</SelectItem>
 <SelectItem value="medium">متوسط</SelectItem>
 <SelectItem value="strong">قوي</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Inline Addons Section - Grouped by Section */}
{/* Sizes for add form */}
<div className="space-y-2">
  <Label className="text-gray-300">الأحجام المتاحة</Label>
  <div className="space-y-2">
    {addEditableSizes.map((size, idx) => (
      <div key={idx} className="flex gap-2 items-end">
        <Input
          type="text"
          placeholder="اسم الحجم (مثال: صغير)"
          value={size.nameAr}
          onChange={(e) => {
            const next = [...addEditableSizes];
            next[idx].nameAr = e.target.value;
            setAddEditableSizes(next);
          }}
          className="bg-gray-50 border-gray-300 text-gray-900 flex-1"
          data-testid={`input-add-size-name-${idx}`}
        />
        <Input
          type="number"
          placeholder="السعر"
          value={size.price}
          onChange={(e) => {
            const next = [...addEditableSizes];
            next[idx].price = parseFloat(e.target.value) || 0;
            setAddEditableSizes(next);
          }}
          className="bg-gray-50 border-gray-300 text-gray-900 w-24"
          data-testid={`input-add-size-price-${idx}`}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setAddEditableSizes(addEditableSizes.filter((_, i) => i !== idx))}
          className="border-red-500/30 text-red-500"
          data-testid={`button-remove-size-${idx}`}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    ))}
  </div>
  <Button
    type="button"
    size="sm"
    variant="outline"
    onClick={() => setAddEditableSizes([...addEditableSizes, { nameAr: '', price: 0 }])}
    className="border-green-500/30 text-green-400 w-full"
    data-testid="button-add-size"
  >
    <Plus className="w-4 h-4 ml-1" />
    إضافة حجم
  </Button>
</div>

<div className="space-y-2">
  <Label className="text-gray-300">الإضافات المتاحة (مع السعر)</Label>
  {(() => {
    const sectionOrder: string[] = [];
    const sectionMap: Record<string, number[]> = {};
    addEditableAddons.forEach((addon, idx) => {
      const key = addon.section || '';
      if (!sectionMap[key]) { sectionMap[key] = []; if (key && !sectionOrder.includes(key)) sectionOrder.push(key); }
      sectionMap[key].push(idx);
    });
    const noSectionIndices = sectionMap[''] || [];
    const changeSectionType = (sectionName: string, type: 'single' | 'multiple') => setAddEditableAddons(prev => prev.map(a => (a.section || '') === sectionName ? {...a, selectionType: type} : a));
    const getSectionType = (sectionName: string): 'single' | 'multiple' => { const f = addEditableAddons.find(a => (a.section || '') === sectionName); return f?.selectionType || 'multiple'; };
    return (
      <div className="space-y-3">
        {sectionOrder.map(sectionName => {
          const indices = sectionMap[sectionName] || [];
          const selType = getSectionType(sectionName);
          return (
            <div key={sectionName} className="border border-primary/30 rounded-xl p-3 space-y-2 bg-gray-50/20">
              <div className="flex items-center gap-1.5">
                <span className="text-primary text-sm">📂</span>
                <input
                  type="text"
                  value={sectionName}
                  onChange={(e) => { const newName = e.target.value; setAddEditableAddons(prev => prev.map(a => a.section === sectionName ? {...a, section: newName} : a)); }}
                  placeholder="اسم القسم"
                  className="flex-1 text-sm font-semibold text-gray-700 bg-transparent border-b border-gray-200 focus:border-primary focus:outline-none"
                  data-testid={"input-add-section-name-" + sectionName}
                />
                <button type="button" onClick={() => changeSectionType(sectionName, 'multiple')} className={`text-xs px-2 py-0.5 rounded-r-none rounded-l border transition-colors ${selType === 'multiple' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-300 hover:border-primary/50'}`} data-testid={"btn-add-sec-multi-" + sectionName}>☑ متعدد</button>
                <button type="button" onClick={() => changeSectionType(sectionName, 'single')} className={`text-xs px-2 py-0.5 rounded-l-none rounded-r border-t border-b border-r transition-colors ${selType === 'single' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-300 hover:border-primary/50'}`} data-testid={"btn-add-sec-single-" + sectionName}>◉ واحد</button>
                <button type="button" onClick={() => setAddEditableAddons(prev => prev.filter((_, i) => !indices.includes(i)))} className="text-red-400 hover:text-red-600 mr-0.5" data-testid={"btn-del-section-" + sectionName}><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-1.5 pr-2">
                {indices.map(idx => { const addon = addEditableAddons[idx]; return (
                  <div key={idx} className="flex gap-2 items-center">
                    <button type="button" onClick={() => { setEditingAddonImageIdx(idx); setImageLibraryContext("add-addon"); setIsImageLibraryOpen(true); }} className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0 overflow-hidden hover:border-accent/50 transition-colors" data-testid={"button-add-addon-img-" + idx}>
                      {addon.imageUrl ? <img src={addon.imageUrl.startsWith('/') || addon.imageUrl.startsWith('data:') || addon.imageUrl.startsWith('http') ? addon.imageUrl : '/' + addon.imageUrl} className="w-full h-full object-cover rounded-lg" alt="" /> : <Plus className="w-3 h-3 text-gray-400" />}
                    </button>
                    <Input type="text" placeholder={tc("اسم الخيار (عربي)", "Option name (AR)")} value={addon.nameAr} onChange={(e) => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], nameAr: e.target.value }; setAddEditableAddons(next); }} className="bg-white border-gray-300 text-gray-900 flex-1 h-8 text-sm" data-testid={"input-add-addon-name-" + idx} />
                    <Input type="text" placeholder={tc("الاسم (إنجليزي)", "Option name (EN)")} value={addon.nameEn || ''} onChange={(e) => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], nameEn: e.target.value }; setAddEditableAddons(next); }} className="bg-white border-gray-300 text-gray-900 flex-1 h-8 text-sm" dir="ltr" data-testid={"input-add-addon-name-en-" + idx} />
                    <Input type="number" placeholder={tc("السعر", "Price")} value={addon.price} onChange={(e) => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], price: parseFloat(e.target.value) || 0 }; setAddEditableAddons(next); }} className="bg-white border-gray-300 text-gray-900 w-20 h-8 text-sm" data-testid={"input-add-addon-price-" + idx} />
                    <button type="button" onClick={() => setAddEditableAddons(addEditableAddons.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 shrink-0" data-testid={"button-remove-addon-" + idx}><X className="w-4 h-4" /></button>
                  </div>
                ); })}
              </div>
              <button type="button" onClick={() => setAddEditableAddons(prev => [...prev, { nameAr: '', price: 0, imageUrl: '', category: 'other', section: sectionName, selectionType: selType }])} className="text-xs text-primary hover:underline pr-2" data-testid={"btn-add-option-" + sectionName}>+ إضافة خيار لهذا القسم</button>
            </div>
          );
        })}
        {noSectionIndices.map(idx => { const addon = addEditableAddons[idx]; return (
          <div key={idx} className="space-y-1.5 p-2 rounded-lg bg-gray-50/50 border border-gray-200">
            <div className="flex gap-2 items-center">
              <button type="button" onClick={() => { setEditingAddonImageIdx(idx); setImageLibraryContext("add-addon"); setIsImageLibraryOpen(true); }} className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0 overflow-hidden hover:border-accent/50 transition-colors" data-testid={"button-add-addon-img-" + idx}>
                {addon.imageUrl ? <img src={addon.imageUrl.startsWith('/') || addon.imageUrl.startsWith('data:') || addon.imageUrl.startsWith('http') ? addon.imageUrl : '/' + addon.imageUrl} className="w-full h-full object-cover rounded-lg" alt="" /> : <Plus className="w-3 h-3 text-gray-500" />}
              </button>
              <Input type="text" placeholder={tc("اسم الإضافة (عربي)", "Addon name (AR)")} value={addon.nameAr} onChange={(e) => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], nameAr: e.target.value }; setAddEditableAddons(next); }} className="bg-gray-50 border-gray-300 text-gray-900 flex-1" data-testid={"input-add-addon-name-" + idx} />
              <Input type="text" placeholder={tc("الاسم (إنجليزي)", "Addon name (EN)")} value={addon.nameEn || ''} onChange={(e) => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], nameEn: e.target.value }; setAddEditableAddons(next); }} className="bg-gray-50 border-gray-300 text-gray-900 flex-1" dir="ltr" data-testid={"input-add-addon-name-en-" + idx} />
              <Input type="number" placeholder={tc("السعر", "Price")} value={addon.price} onChange={(e) => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], price: parseFloat(e.target.value) || 0 }; setAddEditableAddons(next); }} className="bg-gray-50 border-gray-300 text-gray-900 w-20" data-testid={"input-add-addon-price-" + idx} />
              <Button type="button" size="sm" variant="outline" onClick={() => setAddEditableAddons(addEditableAddons.filter((_, i) => i !== idx))} className="border-red-500/30 text-red-500 shrink-0" data-testid={"button-remove-addon-" + idx}><X className="w-4 h-4" /></Button>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], selectionType: 'multiple' }; setAddEditableAddons(next); }} className={`flex-1 text-xs py-1 rounded border transition-colors ${(addon.selectionType || 'multiple') === 'multiple' ? 'bg-primary text-primary-foreground border-primary' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'}`} data-testid={"button-add-addon-multi-" + idx}>☑ اختيار متعدد</button>
              <button type="button" onClick={() => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], selectionType: 'single' }; setAddEditableAddons(next); }} className={`flex-1 text-xs py-1 rounded border transition-colors ${(addon.selectionType || 'multiple') === 'single' ? 'bg-primary text-primary-foreground border-primary' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'}`} data-testid={"button-add-addon-single-" + idx}>◉ اختيار واحد فقط</button>
            </div>
          </div>
        ); })}
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => { const newName = `قسم ${sectionOrder.length + 1}`; setAddEditableAddons(prev => [...prev, { nameAr: '', price: 0, imageUrl: '', category: 'other', section: newName, selectionType: 'multiple' }]); }} className="border-blue-400/40 text-blue-400 flex-1" data-testid="button-add-section"><Plus className="w-4 h-4 ml-1" />إضافة قسم جديد</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAddEditableAddons([...addEditableAddons, { nameAr: '', price: 0, imageUrl: '', category: 'other', section: '', selectionType: 'multiple' }])} className="border-green-500/30 text-green-400 flex-1" data-testid="button-add-addon"><Plus className="w-4 h-4 ml-1" />إضافة خيار بدون قسم</Button>
        </div>
      </div>
    );
  })()}
</div>

{/* Bundled Items Section */}
<div className="space-y-2">
  <Label className="text-gray-300 flex items-center gap-2"><span>🔗</span> منتجات مصاحبة مع الطلب</Label>
  <p className="text-xs text-gray-500">أضف منتجات من المنيو تُعرض على العميل عند طلب هذا المنتج (مجانية أو بسعر مخفض)</p>
  {addBundledItems.map((section, secIdx) => (
    <div key={secIdx} className="border border-purple-200 rounded-lg p-3 space-y-2 bg-purple-50/30">
      <div className="flex items-center gap-2">
        <Input
          placeholder="اسم القسم (مثال: اختر مشروبك)"
          value={section.sectionTitle}
          onChange={(e) => { const n = [...addBundledItems]; n[secIdx] = {...n[secIdx], sectionTitle: e.target.value}; setAddBundledItems(n); }}
          className="bg-white border-gray-300 text-gray-900 flex-1 h-8 text-sm"
          data-testid={`input-add-bundle-title-${secIdx}`}
        />
        <button type="button" onClick={() => setAddBundledItems(addBundledItems.filter((_, i) => i !== secIdx))} className="text-red-400 hover:text-red-600" data-testid={`btn-del-bundle-${secIdx}`}><X className="w-4 h-4" /></button>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-xs text-gray-500">نوع الاختيار:</span>
        <button type="button" onClick={() => { const n = [...addBundledItems]; n[secIdx] = {...n[secIdx], selectionType: 'single', maxSelectable: 1}; setAddBundledItems(n); }} className={`text-xs px-2 py-1 rounded border transition-colors ${section.selectionType === 'single' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-600 border-gray-300'}`} data-testid={`btn-bundle-single-${secIdx}`}>◉ واحد فقط</button>
        <button type="button" onClick={() => { const n = [...addBundledItems]; n[secIdx] = {...n[secIdx], selectionType: 'multiple'}; setAddBundledItems(n); }} className={`text-xs px-2 py-1 rounded border transition-colors ${section.selectionType === 'multiple' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-600 border-gray-300'}`} data-testid={`btn-bundle-multi-${secIdx}`}>☑ متعدد</button>
        {section.selectionType === 'multiple' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">حتى:</span>
            <Input type="number" min={1} value={section.maxSelectable || 1} onChange={(e) => { const n = [...addBundledItems]; n[secIdx] = {...n[secIdx], maxSelectable: parseInt(e.target.value) || 1}; setAddBundledItems(n); }} className="bg-white border-gray-300 text-gray-900 w-14 h-7 text-xs" data-testid={`input-bundle-max-${secIdx}`} />
            <span className="text-xs text-gray-500">خيار</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">إلزامي؟</span>
          <button type="button" onClick={() => { const n = [...addBundledItems]; n[secIdx] = {...n[secIdx], minSelectable: n[secIdx].minSelectable > 0 ? 0 : 1}; setAddBundledItems(n); }} className={`text-xs px-2 py-1 rounded border transition-colors ${section.minSelectable > 0 ? 'bg-orange-400 text-white border-orange-400' : 'bg-white text-gray-600 border-gray-300'}`} data-testid={`btn-bundle-required-${secIdx}`}>{section.minSelectable > 0 ? 'نعم' : 'اختياري'}</button>
        </div>
      </div>
      {section.items.map((bItem, itemIdx) => (
        <div key={itemIdx} className="flex items-center gap-2 bg-white rounded p-2 border border-gray-200">
          <select value={bItem.productId} onChange={(e) => {
            const picked = coffeeItems.find(c => c.id === e.target.value);
            const n = [...addBundledItems];
            n[secIdx].items[itemIdx] = { productId: e.target.value, nameAr: picked?.nameAr || '', nameEn: picked?.nameEn, imageUrl: picked?.imageUrl, originalPrice: picked?.price || 0, customPrice: n[secIdx].items[itemIdx].customPrice };
            setAddBundledItems(n);
          }} className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-900" data-testid={`select-bundle-product-${secIdx}-${itemIdx}`}>
            <option value="">اختر منتجاً من المنيو</option>
            {coffeeItems.map(c => <option key={c.id} value={c.id}>{c.nameAr} ({c.price} ر.س)</option>)}
          </select>
          <div className="flex items-center gap-1 shrink-0">
            <Input type="number" min={0} step={0.5} placeholder="سعره" value={bItem.customPrice} onChange={(e) => { const n = [...addBundledItems]; n[secIdx].items[itemIdx] = {...n[secIdx].items[itemIdx], customPrice: parseFloat(e.target.value) || 0}; setAddBundledItems(n); }} className="bg-white border-gray-300 text-gray-900 w-20 h-8 text-sm" data-testid={`input-bundle-price-${secIdx}-${itemIdx}`} />
            <SarIcon size={11} />
            {bItem.customPrice === 0 && bItem.productId && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">مجاني</span>}
          </div>
          <button type="button" onClick={() => { const n = [...addBundledItems]; n[secIdx].items = n[secIdx].items.filter((_, i) => i !== itemIdx); setAddBundledItems(n); }} className="text-red-400 hover:text-red-600 shrink-0" data-testid={`btn-del-bundle-item-${secIdx}-${itemIdx}`}><X className="w-3 h-3" /></button>
        </div>
      ))}
      <button type="button" onClick={() => { const n = [...addBundledItems]; n[secIdx].items.push({ productId: '', nameAr: '', originalPrice: 0, customPrice: 0 }); setAddBundledItems(n); }} className="text-xs text-purple-600 hover:underline" data-testid={`btn-add-bundle-item-${secIdx}`}>+ إضافة منتج لهذا القسم</button>
    </div>
  ))}
  <Button type="button" size="sm" variant="outline" onClick={() => setAddBundledItems([...addBundledItems, { sectionTitle: '', selectionType: 'single', minSelectable: 0, maxSelectable: 1, items: [] }])} className="border-purple-400/40 text-purple-600 w-full" data-testid="btn-add-bundle-section"><Plus className="w-4 h-4 ml-1" />إضافة قسم منتجات مصاحبة</Button>
</div>

{/* Advanced Addon Groups Section */}
<AddonGroupsEditor value={addAddonGroups} onChange={setAddAddonGroups} />

{/* Reservation Section */}
<div className="space-y-2 border border-amber-200 rounded-lg p-3 bg-amber-50/30">
  <div className="flex items-center justify-between">
    <Label className="text-gray-700 font-semibold flex items-center gap-2">🗓️ منتج يحتاج حجز مسبق</Label>
    <button
      type="button"
      onClick={() => setAddIsReservation(!addIsReservation)}
      className={`relative w-12 h-6 rounded-full transition-colors ${addIsReservation ? 'bg-amber-500' : 'bg-gray-300'}`}
      data-testid="toggle-add-reservation"
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${addIsReservation ? 'right-1' : 'left-1'}`} />
    </button>
  </div>
  {addIsReservation && (
    <div className="space-y-3 pt-2">
      <p className="text-xs text-amber-700">هذا المنتج لا يمكن طلبه مع منتجات أخرى، ويُلزم العميل بالحجز في الفرع فقط مع تأكيد عبر واتساب</p>
      <Label className="text-gray-600 text-sm">الباقات المتاحة للحجز</Label>
      {addReservationPackages.map((pkg, idx) => (
        <div key={idx} className="border border-amber-200 rounded-lg p-3 space-y-2 bg-white">
          <div className="flex items-center gap-2">
            <Input placeholder="اسم الباقة (مثال: باقة رومانسية)" value={pkg.packageName} onChange={(e) => { const n = [...addReservationPackages]; n[idx] = {...n[idx], packageName: e.target.value}; setAddReservationPackages(n); }} className="bg-white border-gray-300 text-gray-900 flex-1 h-8 text-sm" data-testid={`input-add-pkg-name-${idx}`} />
            <button type="button" onClick={() => setAddReservationPackages(addReservationPackages.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600" data-testid={`btn-del-pkg-${idx}`}><X className="w-4 h-4" /></button>
          </div>
          <Input placeholder="الوصف (اختياري)" value={pkg.description || ''} onChange={(e) => { const n = [...addReservationPackages]; n[idx] = {...n[idx], description: e.target.value}; setAddReservationPackages(n); }} className="bg-white border-gray-300 text-gray-900 h-8 text-sm" data-testid={`input-add-pkg-desc-${idx}`} />
          <div className="flex gap-2">
            <div className="flex-1">
              <Input type="number" min={0} step={0.5} placeholder="السعر (ر.س)" value={pkg.price} onChange={(e) => { const n = [...addReservationPackages]; n[idx] = {...n[idx], price: parseFloat(e.target.value) || 0}; setAddReservationPackages(n); }} className="bg-white border-gray-300 text-gray-900 h-8 text-sm w-full" data-testid={`input-add-pkg-price-${idx}`} />
            </div>
            <div className="flex-1">
              <Input placeholder="المدة (مثال: 2 ساعة)" value={pkg.duration || ''} onChange={(e) => { const n = [...addReservationPackages]; n[idx] = {...n[idx], duration: e.target.value}; setAddReservationPackages(n); }} className="bg-white border-gray-300 text-gray-900 h-8 text-sm w-full" data-testid={`input-add-pkg-duration-${idx}`} />
            </div>
            <div className="flex-1">
              <Input type="number" min={1} placeholder="الحد الأقصى للضيوف" value={pkg.maxGuests || ''} onChange={(e) => { const n = [...addReservationPackages]; n[idx] = {...n[idx], maxGuests: parseInt(e.target.value) || undefined}; setAddReservationPackages(n); }} className="bg-white border-gray-300 text-gray-900 h-8 text-sm w-full" data-testid={`input-add-pkg-guests-${idx}`} />
            </div>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => setAddReservationPackages([...addReservationPackages, { packageName: '', price: 0 }])} className="border-amber-400/40 text-amber-700 w-full" data-testid="btn-add-pkg"><Plus className="w-4 h-4 ml-1" />إضافة باقة</Button>
    </div>
  )}
</div>

{canManageMenu && branches.length > 0 && (
   <div>
     <Label className="text-gray-300">متوفر في الفروع</Label>
     <p className="text-gray-500 text-xs mb-2">اختر الفروع التي سيتوفر فيها هذا المنتج (اتركه فارغاً للتوفر في جميع الفروع)</p>
     <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto bg-gray-50 p-3 rounded-lg border border-gray-200">
       {branches.filter((b: any) => b.isActive === 1 || b.isActive === "1").map((branch: any) => {
         const branchId = branch.id;
         const isSelected = selectedBranches.some(sb => sb.branchId === branchId);
         return (
           <div key={branchId} className="flex items-center gap-2">
             <Checkbox
               id={`branch-${branchId}`}
               checked={isSelected}
               onCheckedChange={(checked) => handleToggleBranch(branchId, !!checked)}
               className="border-primary/50"
               data-testid={`checkbox-branch-${branchId}`}
             />
             <label htmlFor={`branch-${branchId}`} className="text-gray-600 text-sm cursor-pointer">
               {branch.nameAr}
             </label>
           </div>
         );
       })}
     </div>
   </div>
 )}

 <div className="flex justify-end gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={() => { setIsAddDialogOpen(false); setAddImageUrls([]); setAddEditableAddons([]); setSelectedIngredients([]); setRecipeItems([]); setSelectedBranches([]); setAddStep(1); setStep1Data(null); setSelectedCategory(defaultCategory); setSelectedCoffeeStrength("classic"); setAiAddNameAr(""); setAiAddNameEn(""); setAiAddDescription(""); }}
 className="border-gray-600 text-gray-300"
 data-testid="button-cancel"
 >
 إلغاء
 </Button>
 <Button
 type="submit"
  className="bg-primary"
 data-testid="button-next"
 >
 "التالي: إضافة المكونات"
 <ArrowLeft className="w-4 h-4 mr-2" />
 </Button>
 </div>
 </form>
 ) : (
 <div className="space-y-4">
   <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
     <p className="text-gray-400 text-sm mb-1">المشروب:</p>
     <p className="text-accent font-bold text-lg">{step1Data?.nameAr}</p>
     <p className="text-gray-500 text-sm">{step1Data?.category && categoryNames[step1Data.category as keyof typeof categoryNames]} • {step1Data?.price} <SarIcon size={11} /></p>
   </div>

   <div className="border-t border-gray-200 pt-4">
     <Label className="text-gray-600 text-lg flex items-center gap-2">
       <FlaskConical className="w-5 h-5" />
       وصفة المنتج (المواد الخام)
     </Label>
     <p className="text-gray-500 text-sm mb-3">اختر المواد الخام اللازمة لتحضير المشروب مع الكميات</p>
     
    {canManageMenu && rawItems.length > 0 ? (
       <>
         <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
           {rawItems.filter(r => r.isActive === 1).map((raw) => {
             const isSelected = recipeItems.some(s => s.rawItemId === raw.id);
             const selected = recipeItems.find(s => s.rawItemId === raw.id);
             
             return (
               <div key={raw.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-primary/10">
                 <Checkbox
                   id={`raw-step2-${raw.id}`}
                   checked={isSelected}
                   onCheckedChange={(checked) => {
                     if (checked) {
                       setRecipeItems([...recipeItems, {
                         rawItemId: raw.id,
                         rawItem: raw,
                         quantity: 10,
                         unit: raw.unit
                       }]);
                     } else {
                       setRecipeItems(recipeItems.filter(s => s.rawItemId !== raw.id));
                     }
                   }}
                   className="border-primary/50"
                   data-testid={`checkbox-raw-${raw.id}`}
                 />
                 <label htmlFor={`raw-step2-${raw.id}`} className="text-gray-600 flex-1 cursor-pointer">
                   <span>{raw.nameAr}</span>
                   <span className="text-gray-500 text-xs mr-2">({raw.unitCost.toFixed(2)} <SarIcon size={10} />/{raw.unit})</span>
                 </label>
                 {isSelected && (
                   <div className="flex items-center gap-2">
                     <Input
                       type="number"
                       min="0.1"
                       step="0.1"
                       value={selected?.quantity || 10}
                       onChange={(e) => {
                         setRecipeItems(recipeItems.map(s =>
                           s.rawItemId === raw.id ? { ...s, quantity: parseFloat(e.target.value) || 0 } : s
                         ));
                       }}
                       className="w-20 bg-white border-gray-300 text-gray-900 text-center"
                       data-testid={`input-qty-raw-${raw.id}`}
                     />
                     <Select
                       value={selected?.unit || raw.unit}
                       onValueChange={(value) => {
                         setRecipeItems(recipeItems.map(s =>
                           s.rawItemId === raw.id ? { ...s, unit: value } : s
                         ));
                       }}
                     >
                       <SelectTrigger className="w-20 bg-white border-gray-300 text-gray-900" data-testid={`select-unit-raw-${raw.id}`}>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="bg-white border-gray-200 text-gray-900">
                         <SelectItem value="g">جرام</SelectItem>
                         <SelectItem value="ml">مل</SelectItem>
                         <SelectItem value="kg">كجم</SelectItem>
                         <SelectItem value="liter">لتر</SelectItem>
                         <SelectItem value="piece">قطعة</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 )}
               </div>
             );
           })}
         </div>
         
         {recipeItems.length > 0 && (
           <div className="flex flex-wrap gap-2 mb-2">
             {recipeItems.map((item) => {
               const raw = rawItems.find(r => r.id === item.rawItemId);
               return (
                 <Badge key={item.rawItemId} className="bg-green-500/20 text-green-400 border border-green-500/30">
                   {raw?.nameAr}: {item.quantity} {item.unit}
                   <button
                     type="button"
                     onClick={() => setRecipeItems(recipeItems.filter(s => s.rawItemId !== item.rawItemId))}
                     className="mr-1 hover:text-red-400"
                   >
                     <X className="w-3 h-3" />
                   </button>
                 </Badge>
               );
             })}
           </div>
         )}

         {recipeItems.length > 0 && (
           <div className="bg-gradient-to-r from-background to-background p-4 rounded-lg border border-green-500/30 mt-3" data-testid="recipe-cost-preview">
             {(() => {
               const { totalCost, breakdown } = calculateRecipeCost(recipeItems);
               const sellingPrice = step1Data?.price ? parseFloat(step1Data.price) : 0;
               const grossProfit = sellingPrice - totalCost;
               const profitMargin = sellingPrice > 0 ? ((grossProfit / sellingPrice) * 100) : 0;
               
               return (
                 <>
                   <div className="flex items-center justify-between mb-3">
                     <span className="text-gray-600 font-medium flex items-center gap-2">
                       <FlaskConical className="w-4 h-4 text-green-400" />
                       تكلفة الوصفة التقديرية
                     </span>
                   </div>
                   
                   {breakdown.length > 0 && (
                     <div className="space-y-1 mb-3 text-sm">
                       {breakdown.map((item, idx) => (
                         <div key={idx} className="flex justify-between text-gray-400">
                           <span>{item.name} ({item.quantity} {item.unit})</span>
                           <span>{item.cost.toFixed(2)} <SarIcon size={10} /></span>
                         </div>
                       ))}
                     </div>
                   )}
                   
                   <div className="border-t border-green-500/20 pt-3 space-y-2">
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">تكلفة الوصفة (COGS):</span>
                       <span className="text-green-400 font-bold" data-testid="text-recipe-cost">{totalCost.toFixed(2)} <SarIcon size={11} /></span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">سعر البيع:</span>
                       <span className="text-white font-bold">{sellingPrice.toFixed(2)} <SarIcon size={11} /></span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">هامش الربح:</span>
                       <span className={`font-bold ${grossProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-profit-margin">
                         {grossProfit.toFixed(2)} <SarIcon size={11} /> ({profitMargin.toFixed(1)}%)
                       </span>
                     </div>
                   </div>
                 </>
               );
             })()}
           </div>
         )}
         
         {recipeItems.length === 0 && (
           <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
             <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
             <div>
               <p className="text-yellow-400 text-sm font-medium">تنبيه: لم يتم إضافة وصفة</p>
               <p className="text-yellow-500/80 text-xs">المنتجات بدون وصفة لن يتم خصمها من المخزون عند البيع.</p>
             </div>
           </div>
         )}
       </>
     ) : (
       <div className="bg-gray-800/50 rounded-lg p-4 text-center">
         <p className="text-gray-400 text-sm">الوصفات متاحة للمديرين فقط</p>
         <p className="text-gray-500 text-xs mt-1">أو لا توجد مواد خام متاحة</p>
       </div>
     )}
   </div>

   <div className="flex justify-between gap-2">
     <Button
       type="button"
       variant="outline"
       onClick={() => setAddStep(1)}
       className="border-gray-300 text-primary"
       data-testid="button-back-step"
     >
       <ArrowRight className="w-4 h-4 ml-2" />
       السابق
     </Button>
     <div className="flex gap-2">
       <Button
         type="button"
         variant="outline"
         onClick={handleSkipIngredients}
         disabled={createItemMutation.isPending}
         className="border-gray-600 text-gray-300"
         data-testid="button-skip"
       >
         {createItemMutation.isPending ? "جاري الإضافة..." : "تخطي المكونات"}
       </Button>
       <Button
         type="button"
         onClick={handleStep2Submit}
         disabled={createItemMutation.isPending || (recipeItems.length === 0 && selectedIngredients.length === 0)}
         className="bg-gradient-to-r from-green-500 to-green-700"
         data-testid="button-submit"
       >
         {createItemMutation.isPending ? "جاري الإضافة..." : "إضافة المشروب"}
       </Button>
     </div>
   </div>
 </div>
 )}
 </DialogContent>
 </Dialog>
 )}
 <Button
 variant="outline"
 onClick={() => setLocation("/employee/ingredients")}
 className="border-primary/50 text-primary hover:bg-primary hover:text-white"
 data-testid="button-ingredients"
 >
 إدارةالمكونات
 </Button>
 <Button
 variant="outline"
 onClick={() => setLocation("/employee/home")}
 className="border-primary/50 text-primary hover:bg-primary hover:text-white"
 data-testid="button-back"
 >
 <ArrowRight className="w-4 h-4 ml-2" />
 العودةللوحةالتحكم
 </Button>
 </div>
 </div>
 </div>

 {/* Content */}
 <div className="max-w-7xl mx-auto space-y-6">
 {isLoading ? (
 <div className="text-center text-primary py-12">
 <Coffee className="w-12 h-12 animate-spin mx-auto mb-4" />
 <p>{isFood ? 'جاري تحميل المأكولات...' : 'جاري تحميل المشروبات...'}</p>
 </div>
 ) : (
 Object.entries(categorizedItems).map(([category, items]) => (
 <Card key={category} className="bg-white border-gray-200">
 <CardHeader>
 <CardTitle className="text-accent text-right text-xl">
 {categoryNames[category as keyof typeof categoryNames] || category}
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {items.map((item) => (
 <div
 key={item.id}
 className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-primary/10 hover:border-gray-300 transition-all"
 data-testid={`item-${item.id}`}
 >
 <div className="flex items-center gap-4 flex-1">
 <img
 src={item.imageUrl ? (item.imageUrl.startsWith('/') || item.imageUrl.startsWith('data:') || item.imageUrl.startsWith('http') ? item.imageUrl : `/${item.imageUrl}`) : getCoffeeImage(item.id)}
 alt={item.nameAr}
 className="w-16 h-16 rounded-lg object-cover"
 onError={(e) => {
 e.currentTarget.src = getCoffeeImage(item.id);
 }}
 data-testid={`img-${item.id}`}
 />
 <div className="flex-1">
 <h3 className="text-lg font-bold text-primary" data-testid={`text-name-${item.id}`}>
 {item.nameAr}
 </h3>
 <p className="text-gray-400 text-sm">{item.nameEn}</p>
 <div className="flex items-center gap-2 mt-1">
 <span className="text-accent font-bold" data-testid={`text-price-${item.id}`}>
 {parseFloat(String(item.price)).toFixed(2)} <SarIcon size={11} />
 </span>
 {item.coffeeStrength && item.coffeeStrength !== "classic" && (
 <Badge variant="outline" className="text-xs border-gray-300 text-gray-400">
 {item.coffeeStrength === "strong" && "قوي"}
 {item.coffeeStrength === "medium" && "متوسط"}
 {item.coffeeStrength === "mild" && "خفيف"}
 </Badge>
 )}
 </div>
 </div>
 </div>

 <div className="flex items-center gap-4">
 <div className="text-right flex flex-col gap-2">
 <Badge
 className={
 item.availabilityStatus === 'available' ? "bg-green-500" :
 item.availabilityStatus === 'out_of_stock' ? "bg-red-500" :
 item.availabilityStatus === 'coming_soon' ? "bg-blue-500" :
 "bg-primary"
 }
 data-testid={`badge-status-${item.id}`}
 >
 {item.availabilityStatus === 'available' && (
 <>
 <CheckCircle className="w-4 h-4 ml-1" />
 متوفر
 </>
 )}
 {item.availabilityStatus === 'out_of_stock' && (
 <>
 <XCircle className="w-4 h-4 ml-1" />
 نفذت الكمية 
 </>
 )}
 {item.availabilityStatus === 'coming_soon' && (
 <>
 <Coffee className="w-4 h-4 ml-1" />
 قريباً
 </>
 )}
 {item.availabilityStatus === 'temporarily_unavailable' && (
 <>
 <XCircle className="w-4 h-4 ml-1" />
 غير متوفر مؤقتاً
 </>
 )}
 </Badge>
 
 <select
 value={item.availabilityStatus || 'available'}
 onChange={(e) => handleStatusChange(item.id, e.target.value)}
 disabled={updateAvailabilityMutation.isPending}
 className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1 text-sm text-primary"
 data-testid={`select-status-${item.id}`}
 >
 <option value="available"> متوفر</option>
 <option value="out_of_stock"> نفذت الكمية </option>
 <option value="temporarily_unavailable">⏸ غير متوفر مؤقتاً</option>
 <option value="coming_soon"> قريباً</option>
 </select>
 </div>

{canManageMenu && (
 <div className="flex flex-col gap-2">
 <div className="flex items-center gap-2">
   {getProductRecipeCount(item.id) > 0 ? (
     <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-xs">
       <FlaskConical className="w-3 h-3 ml-1" />
       {getProductRecipeCount(item.id)} مكون
     </Badge>
   ) : (
     <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs">
       بدون وصفة
     </Badge>
   )}
 </div>
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleToggleNewProduct(item)}
 className={`${
 item.isNewProduct === 1
 ? "bg-yellow-500 border-yellow-500 text-white"
 : "border-gray-300 text-primary"
 }`}
 disabled={toggleNewProductMutation.isPending}
 data-testid={`button-toggle-new-${item.id}`}
 >
 <Sparkles className="w-4 h-4 ml-1" />
 {item.isNewProduct === 1 ? "منتج جديد" : "جديد؟"}
 </Button>
 <div className="flex gap-1">
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleOpenRecipeEditor(item)}
 className="border-green-500/30 text-green-400 hover:bg-green-600 hover:text-white flex-1"
 data-testid={`button-recipe-${item.id}`}
 >
 <FlaskConical className="w-4 h-4" />
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleEdit(item)}
 className="border-blue-500/30 text-blue-500 hover:bg-blue-500 hover:text-white flex-1"
 data-testid={`button-edit-${item.id}`}
 >
 <Edit2 className="w-4 h-4" />
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleDelete(item.id)}
 className="border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white flex-1"
 data-testid={`button-delete-${item.id}`}
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </div>
 </div>
 )}
 </div>
 </div>
 ))}
 </CardContent>
 </Card>
 ))
 )}
 </div>

 {/* Edit Dialog */}
 <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
 <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="text-accent">تعديل المشروب</DialogTitle>
 </DialogHeader>
 {editingItem && (
 <form onSubmit={handleSubmitEditItem} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="edit-nameAr" className="text-gray-300">الاسم بالعربية *</Label>
 <Input
 id="edit-nameAr"
 name="nameAr"
 defaultValue={editingItem.nameAr}
 required
 className="bg-gray-50 border-gray-300 text-gray-900"
 data-testid="input-edit-name-ar"
 />
 </div>
 <div>
 <Label htmlFor="edit-nameEn" className="text-gray-300">
   <span className="flex items-center justify-between">
     <span>{tc("الاسم بالإنجليزية", "English Name")}</span>
     <AIMenuAssistant
       nameAr={editingItem.nameAr}
       nameEn={aiEditNameEn}
       category={editingItem.category}
       existingDescription={aiEditDescription}
       onInsertNameEn={(name) => setAiEditNameEn(name)}
       onInsertDescription={(desc) => setAiEditDescription(desc)}
       onInsertAddons={(addons) => setEditableAddons(prev => [...prev, ...addons.map(a => ({ ...a, imageUrl: '', category: 'other', section: '' }))])}
       compact
     />
   </span>
 </Label>
 <Input
 id="edit-nameEn"
 name="nameEn"
 value={aiEditNameEn}
 onChange={(e) => setAiEditNameEn(e.target.value)}
 className="bg-gray-50 border-gray-300 text-gray-900"
 data-testid="input-edit-name-en"
 />
 </div>
 </div>

 <div>
 <Label htmlFor="edit-description" className="text-gray-300">
   <span className="flex items-center justify-between mb-1">
     <span>{tc("الوصف *", "Description *")}</span>
     <AIMenuAssistant
       nameAr={editingItem.nameAr}
       nameEn={aiEditNameEn}
       category={editingItem.category}
       existingDescription={aiEditDescription}
       onInsertDescription={(desc) => setAiEditDescription(desc)}
       onInsertNameEn={(name) => setAiEditNameEn(name)}
       onInsertAddons={(addons) => setEditableAddons(prev => [...prev, ...addons.map(a => ({ ...a, imageUrl: '', category: 'other', section: '' }))])}
       compact
     />
   </span>
 </Label>
 <Textarea
 id="edit-description"
 name="description"
 value={aiEditDescription}
 onChange={(e) => setAiEditDescription(e.target.value)}
 required
 className="bg-gray-50 border-gray-300 text-gray-900 min-h-[80px]"
 data-testid="input-edit-description"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="edit-category" className="text-gray-300">{tc("القسم *", "Category *")}</Label>
 <Select name="category" defaultValue={editingItem.category} required>
 <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900" data-testid="select-edit-category">
 <SelectValue placeholder={tc("اختر القسم", "Select category")} />
 </SelectTrigger>
 <SelectContent className="bg-white border-gray-200 text-gray-900">
 {availableForDropdown.map(cat => (
   <SelectItem key={cat.id} value={cat.id}>{cat.nameAr}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="edit-price" className="text-gray-300">{tc("السعر (ريال) *", "Price (SAR) *")}</Label>
 <Input
 id="edit-price"
 name="price"
 type="number"
 step="0.01"
 min="0"
 defaultValue={editingItem.price}
 required
 className="bg-gray-50 border-gray-300 text-gray-900"
 data-testid="input-edit-price"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="edit-oldPrice" className="text-gray-300">{tc("السعر القديم (ريال)", "Old Price (SAR)")}</Label>
 <Input
 id="edit-oldPrice"
 name="oldPrice"
 type="number"
 step="0.01"
 min="0"
 defaultValue={editingItem.oldPrice}
 className="bg-gray-50 border-gray-300 text-gray-900"
 data-testid="input-edit-old-price"
 />
 </div>
 <div>
 <Label htmlFor="edit-costOfGoods" className="text-gray-300">{tc("تكلفة الإنتاج (ريال)", "Production Cost (SAR)")}</Label>
 <Input
 id="edit-costOfGoods"
 name="costOfGoods"
 type="number"
 step="0.01"
 min="0"
 defaultValue={editingItem.costOfGoods || 0}
 className="bg-gray-50 border-gray-300 text-gray-900"
 data-testid="input-edit-cost-of-goods"
 placeholder="0.00"
 />
 </div>
 </div>
<div>
<Label className="text-gray-300">{tc("صور المنتج (حتى 5 صور)", "Item Photos (up to 5)")}</Label>
<div className="mt-2 space-y-2">
  <div className="flex flex-wrap gap-2">
    {editImageUrls.map((url, idx) => (
      <div key={idx} className="relative w-16 h-16">
        <img src={url.startsWith('/') ? url : (url.startsWith('http') ? url : "/" + url)} alt={"صورة " + (idx+1)} className="w-full h-full object-cover rounded-lg border border-gray-300" />
        <button type="button" onClick={() => setEditImageUrls(editImageUrls.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center">
          <X className="w-3 h-3 text-white" />
        </button>
        {idx === 0 && <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-primary/80 text-white rounded-b-lg">{tc("رئيسية", "Main")}</span>}
      </div>
    ))}
    {editImageUrls.length < 5 && (
      <button type="button" onClick={() => { setImageLibraryContext("edit"); setIsImageLibraryOpen(true); }} className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-primary/60 hover:text-accent hover:border-accent/50 transition-colors">
        <Plus className="w-4 h-4" />
        <span className="text-[10px] mt-1">{tc("إضافة", "Add")}</span>
      </button>
    )}
  </div>
  {editImageUrls.length === 0 && <p className="text-gray-500 text-xs">اختر صوراً من المكتبة. الصورة الأولى ستكون الرئيسية</p>}
  <button
    type="button"
    disabled={isAiGeneratingEditImage}
    onClick={async () => {
      const name = editingItem?.nameAr;
      if (!name) { toast({ title: "اسم المنتج غير متوفر", variant: "destructive" }); return; }
      setIsAiGeneratingEditImage(true);
      try {
        const res = await fetch("/api/ai/generate-product-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productName: name, description: editingItem?.description }) });
        const data = await res.json();
        if (data.imageUrl) { setEditImageUrls(prev => [...prev, data.imageUrl]); toast({ title: "✨ تم توليد الصورة بالذكاء الاصطناعي" }); }
      } catch { toast({ title: "فشل توليد الصورة", variant: "destructive" }); }
      finally { setIsAiGeneratingEditImage(false); }
    }}
    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-60"
    data-testid="button-ai-generate-edit-image"
  >
    <Sparkles className="w-4 h-4" />
    {isAiGeneratingEditImage ? "جاري التوليد..." : "توليد صورة بالذكاء الاصطناعي ✨"}
  </button>
</div>
</div>

 {/* Editable Sizes */}
 <div className="space-y-2">
   <Label className="text-gray-300">الأحجام المتاحة</Label>
   <div className="space-y-2">
     {editableSizes.map((size, idx) => (
       <div key={idx} className="flex gap-2 items-end">
         <Input
           type="text"
           placeholder="اسم الحجم"
           value={size.nameAr}
           onChange={(e) => {
             const newSizes = [...editableSizes];
             newSizes[idx].nameAr = e.target.value;
             setEditableSizes(newSizes);
           }}
           className="bg-gray-50 border-gray-300 text-gray-900 flex-1"
           data-testid={`input-edit-size-name-${idx}`}
         />
         <Input
           type="number"
           placeholder="السعر"
           value={size.price}
           onChange={(e) => {
             const newSizes = [...editableSizes];
             newSizes[idx].price = parseFloat(e.target.value) || 0;
             setEditableSizes(newSizes);
           }}
           className="bg-gray-50 border-gray-300 text-gray-900 w-24"
           data-testid={`input-edit-size-price-${idx}`}
         />
         <Button
           type="button"
           size="sm"
           variant="outline"
           onClick={() => setEditableSizes(editableSizes.filter((_, i) => i !== idx))}
           className="border-red-500/30 text-red-500"
           data-testid={`button-delete-size-${idx}`}
         >
           <X className="w-4 h-4" />
         </Button>
       </div>
     ))}
   </div>
   <Button
     type="button"
     size="sm"
     variant="outline"
     onClick={() => setEditableSizes([...editableSizes, {nameAr: '', price: 0}])}
     className="border-green-500/30 text-green-400 w-full"
     data-testid="button-add-edit-size"
   >
     <Plus className="w-4 h-4 ml-1" />
     إضافة حجم
   </Button>
 </div>

 {/* Editable Addons - Grouped by Section */}
 <div className="space-y-2">
   <Label className="text-gray-300">الإضافات المتاحة</Label>
   {(() => {
     const sectionOrder: string[] = [];
     const sectionMap: Record<string, number[]> = {};
     editableAddons.forEach((addon, idx) => {
       const key = addon.section || '';
       if (!sectionMap[key]) { sectionMap[key] = []; if (key && !sectionOrder.includes(key)) sectionOrder.push(key); }
       sectionMap[key].push(idx);
     });
     const noSectionIndices = sectionMap[''] || [];
     const changeSectionType = (sectionName: string, type: 'single' | 'multiple') => setEditableAddons(prev => prev.map(a => (a.section || '') === sectionName ? {...a, selectionType: type} : a));
     const getSectionType = (sectionName: string): 'single' | 'multiple' => { const f = editableAddons.find(a => (a.section || '') === sectionName); return f?.selectionType || 'multiple'; };
     return (
       <div className="space-y-3">
         {sectionOrder.map(sectionName => {
           const indices = sectionMap[sectionName] || [];
           const selType = getSectionType(sectionName);
           return (
             <div key={sectionName} className="border border-primary/30 rounded-xl p-3 space-y-2 bg-gray-50/20">
               <div className="flex items-center gap-1.5">
                 <span className="text-primary text-sm">📂</span>
                 <input
                   type="text"
                   value={sectionName}
                   onChange={(e) => { const newName = e.target.value; setEditableAddons(prev => prev.map(a => a.section === sectionName ? {...a, section: newName} : a)); }}
                   placeholder="اسم القسم"
                   className="flex-1 text-sm font-semibold text-gray-700 bg-transparent border-b border-gray-200 focus:border-primary focus:outline-none"
                   data-testid={"input-edit-section-name-" + sectionName}
                 />
                 <button type="button" onClick={() => changeSectionType(sectionName, 'multiple')} className={`text-xs px-2 py-0.5 rounded-r-none rounded-l border transition-colors ${selType === 'multiple' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-300 hover:border-primary/50'}`} data-testid={"btn-edit-sec-multi-" + sectionName}>☑ متعدد</button>
                 <button type="button" onClick={() => changeSectionType(sectionName, 'single')} className={`text-xs px-2 py-0.5 rounded-l-none rounded-r border-t border-b border-r transition-colors ${selType === 'single' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-300 hover:border-primary/50'}`} data-testid={"btn-edit-sec-single-" + sectionName}>◉ واحد</button>
                 <button type="button" onClick={() => setEditableAddons(prev => prev.filter((_, i) => !indices.includes(i)))} className="text-red-400 hover:text-red-600 mr-0.5" data-testid={"btn-del-edit-section-" + sectionName}><X className="w-4 h-4" /></button>
               </div>
               <div className="space-y-1.5 pr-2">
                 {indices.map(idx => { const addon = editableAddons[idx]; return (
                   <div key={idx} className="flex gap-2 items-center">
                     <button type="button" onClick={() => { setEditingAddonImageIdx(idx); setImageLibraryContext("edit-addon"); setIsImageLibraryOpen(true); }} className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0 overflow-hidden hover:border-accent/50 transition-colors" data-testid={`button-edit-addon-img-${idx}`}>
                       {addon.imageUrl ? <img src={addon.imageUrl.startsWith('/') || addon.imageUrl.startsWith('data:') || addon.imageUrl.startsWith('http') ? addon.imageUrl : '/' + addon.imageUrl} className="w-full h-full object-cover rounded-lg" alt="" /> : <Plus className="w-3 h-3 text-gray-400" />}
                     </button>
                     <Input type="text" placeholder={tc("اسم الخيار (عربي)", "Option name (AR)")} value={addon.nameAr} onChange={(e) => { const n = [...editableAddons]; n[idx] = { ...n[idx], nameAr: e.target.value }; setEditableAddons(n); }} className="bg-white border-gray-300 text-gray-900 flex-1 h-8 text-sm" data-testid={`input-edit-addon-name-${idx}`} />
                     <Input type="text" placeholder={tc("الاسم (إنجليزي)", "Option name (EN)")} value={addon.nameEn || ''} onChange={(e) => { const n = [...editableAddons]; n[idx] = { ...n[idx], nameEn: e.target.value }; setEditableAddons(n); }} className="bg-white border-gray-300 text-gray-900 flex-1 h-8 text-sm" dir="ltr" data-testid={`input-edit-addon-name-en-${idx}`} />
                     <Input type="number" placeholder={tc("السعر", "Price")} value={addon.price} onChange={(e) => { const n = [...editableAddons]; n[idx] = { ...n[idx], price: parseFloat(e.target.value) || 0 }; setEditableAddons(n); }} className="bg-white border-gray-300 text-gray-900 w-20 h-8 text-sm" data-testid={`input-edit-addon-price-${idx}`} />
                     <button type="button" onClick={() => setEditableAddons(editableAddons.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 shrink-0" data-testid={`button-delete-addon-${idx}`}><X className="w-4 h-4" /></button>
                   </div>
                 ); })}
               </div>
               <button type="button" onClick={() => setEditableAddons(prev => [...prev, { nameAr: '', price: 0, imageUrl: '', category: 'other', section: sectionName, selectionType: selType }])} className="text-xs text-primary hover:underline pr-2" data-testid={"btn-edit-add-option-" + sectionName}>+ إضافة خيار لهذا القسم</button>
             </div>
           );
         })}
         {noSectionIndices.map(idx => { const addon = editableAddons[idx]; return (
           <div key={idx} className="space-y-1.5 p-2 rounded-lg bg-gray-50/50 border border-gray-200">
             <div className="flex gap-2 items-center">
               <button type="button" onClick={() => { setEditingAddonImageIdx(idx); setImageLibraryContext("edit-addon"); setIsImageLibraryOpen(true); }} className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0 overflow-hidden hover:border-accent/50 transition-colors" data-testid={`button-edit-addon-img-${idx}`}>
                 {addon.imageUrl ? <img src={addon.imageUrl.startsWith('/') || addon.imageUrl.startsWith('data:') || addon.imageUrl.startsWith('http') ? addon.imageUrl : '/' + addon.imageUrl} className="w-full h-full object-cover rounded-lg" alt="" /> : <Plus className="w-3 h-3 text-gray-500" />}
               </button>
               <Input type="text" placeholder={tc("اسم الإضافة (عربي)", "Addon name (AR)")} value={addon.nameAr} onChange={(e) => { const n = [...editableAddons]; n[idx] = { ...n[idx], nameAr: e.target.value }; setEditableAddons(n); }} className="bg-gray-50 border-gray-300 text-gray-900 flex-1" data-testid={`input-edit-addon-name-${idx}`} />
               <Input type="text" placeholder={tc("الاسم (إنجليزي)", "Addon name (EN)")} value={addon.nameEn || ''} onChange={(e) => { const n = [...editableAddons]; n[idx] = { ...n[idx], nameEn: e.target.value }; setEditableAddons(n); }} className="bg-gray-50 border-gray-300 text-gray-900 flex-1" dir="ltr" data-testid={`input-edit-addon-name-en-${idx}`} />
               <Input type="number" placeholder={tc("السعر", "Price")} value={addon.price} onChange={(e) => { const n = [...editableAddons]; n[idx] = { ...n[idx], price: parseFloat(e.target.value) || 0 }; setEditableAddons(n); }} className="bg-gray-50 border-gray-300 text-gray-900 w-20" data-testid={`input-edit-addon-price-${idx}`} />
               <Button type="button" size="sm" variant="outline" onClick={() => setEditableAddons(editableAddons.filter((_, i) => i !== idx))} className="border-red-500/30 text-red-500 shrink-0" data-testid={`button-delete-addon-${idx}`}><X className="w-4 h-4" /></Button>
             </div>
             <div className="flex gap-1">
               <button type="button" onClick={() => { const n = [...editableAddons]; n[idx] = { ...n[idx], selectionType: 'multiple' }; setEditableAddons(n); }} className={`flex-1 text-xs py-1 rounded border transition-colors ${(addon.selectionType || 'multiple') === 'multiple' ? 'bg-primary text-primary-foreground border-primary' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'}`} data-testid={`button-edit-addon-multi-${idx}`}>☑ اختيار متعدد</button>
               <button type="button" onClick={() => { const n = [...editableAddons]; n[idx] = { ...n[idx], selectionType: 'single' }; setEditableAddons(n); }} className={`flex-1 text-xs py-1 rounded border transition-colors ${(addon.selectionType || 'multiple') === 'single' ? 'bg-primary text-primary-foreground border-primary' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'}`} data-testid={`button-edit-addon-single-${idx}`}>◉ اختيار واحد فقط</button>
             </div>
           </div>
         ); })}
         <div className="flex gap-2">
           <Button type="button" size="sm" variant="outline" onClick={() => { const newName = `قسم ${sectionOrder.length + 1}`; setEditableAddons(prev => [...prev, { nameAr: '', price: 0, imageUrl: '', category: 'other', section: newName, selectionType: 'multiple' }]); }} className="border-blue-400/40 text-blue-400 flex-1" data-testid="button-add-edit-section"><Plus className="w-4 h-4 ml-1" />إضافة قسم جديد</Button>
           <Button type="button" size="sm" variant="outline" onClick={() => setEditableAddons([...editableAddons, {nameAr: '', price: 0, imageUrl: '', category: 'other', section: '', selectionType: 'multiple'}])} className="border-green-500/30 text-green-400 flex-1" data-testid="button-add-edit-addon"><Plus className="w-4 h-4 ml-1" />إضافة خيار بدون قسم</Button>
         </div>
       </div>
     );
   })()}
 </div>

 {/* Bundled Items Section - Edit */}
 <div className="space-y-2">
   <Label className="text-gray-300 flex items-center gap-2"><span>🔗</span> منتجات مصاحبة مع الطلب</Label>
   <p className="text-xs text-gray-500">منتجات من المنيو تُعرض على العميل عند طلب هذا المنتج</p>
   {editBundledItems.map((section, secIdx) => (
     <div key={secIdx} className="border border-purple-200 rounded-lg p-3 space-y-2 bg-purple-50/30">
       <div className="flex items-center gap-2">
         <Input placeholder="اسم القسم" value={section.sectionTitle} onChange={(e) => { const n = [...editBundledItems]; n[secIdx] = {...n[secIdx], sectionTitle: e.target.value}; setEditBundledItems(n); }} className="bg-white border-gray-300 text-gray-900 flex-1 h-8 text-sm" data-testid={`input-edit-bundle-title-${secIdx}`} />
         <button type="button" onClick={() => setEditBundledItems(editBundledItems.filter((_, i) => i !== secIdx))} className="text-red-400 hover:text-red-600" data-testid={`btn-del-edit-bundle-${secIdx}`}><X className="w-4 h-4" /></button>
       </div>
       <div className="flex gap-2 items-center flex-wrap">
         <span className="text-xs text-gray-500">نوع الاختيار:</span>
         <button type="button" onClick={() => { const n = [...editBundledItems]; n[secIdx] = {...n[secIdx], selectionType: 'single', maxSelectable: 1}; setEditBundledItems(n); }} className={`text-xs px-2 py-1 rounded border transition-colors ${section.selectionType === 'single' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-600 border-gray-300'}`} data-testid={`btn-edit-bundle-single-${secIdx}`}>◉ واحد فقط</button>
         <button type="button" onClick={() => { const n = [...editBundledItems]; n[secIdx] = {...n[secIdx], selectionType: 'multiple'}; setEditBundledItems(n); }} className={`text-xs px-2 py-1 rounded border transition-colors ${section.selectionType === 'multiple' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-600 border-gray-300'}`} data-testid={`btn-edit-bundle-multi-${secIdx}`}>☑ متعدد</button>
         {section.selectionType === 'multiple' && (
           <div className="flex items-center gap-1">
             <span className="text-xs text-gray-500">حتى:</span>
             <Input type="number" min={1} value={section.maxSelectable || 1} onChange={(e) => { const n = [...editBundledItems]; n[secIdx] = {...n[secIdx], maxSelectable: parseInt(e.target.value) || 1}; setEditBundledItems(n); }} className="bg-white border-gray-300 text-gray-900 w-14 h-7 text-xs" data-testid={`input-edit-bundle-max-${secIdx}`} />
             <span className="text-xs text-gray-500">خيار</span>
           </div>
         )}
         <button type="button" onClick={() => { const n = [...editBundledItems]; n[secIdx] = {...n[secIdx], minSelectable: n[secIdx].minSelectable > 0 ? 0 : 1}; setEditBundledItems(n); }} className={`text-xs px-2 py-1 rounded border transition-colors ${section.minSelectable > 0 ? 'bg-orange-400 text-white border-orange-400' : 'bg-white text-gray-600 border-gray-300'}`} data-testid={`btn-edit-bundle-required-${secIdx}`}>{section.minSelectable > 0 ? 'إلزامي' : 'اختياري'}</button>
       </div>
       {section.items.map((bItem, itemIdx) => (
         <div key={itemIdx} className="flex items-center gap-2 bg-white rounded p-2 border border-gray-200">
           <select value={bItem.productId} onChange={(e) => {
             const picked = coffeeItems.find(c => c.id === e.target.value);
             const n = [...editBundledItems];
             n[secIdx].items[itemIdx] = { productId: e.target.value, nameAr: picked?.nameAr || '', nameEn: picked?.nameEn, imageUrl: picked?.imageUrl, originalPrice: picked?.price || 0, customPrice: n[secIdx].items[itemIdx].customPrice };
             setEditBundledItems(n);
           }} className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-900" data-testid={`select-edit-bundle-product-${secIdx}-${itemIdx}`}>
             <option value="">اختر منتجاً من المنيو</option>
             {coffeeItems.map(c => <option key={c.id} value={c.id}>{c.nameAr} ({c.price} ر.س)</option>)}
           </select>
           <div className="flex items-center gap-1 shrink-0">
             <Input type="number" min={0} step={0.5} placeholder="سعره" value={bItem.customPrice} onChange={(e) => { const n = [...editBundledItems]; n[secIdx].items[itemIdx] = {...n[secIdx].items[itemIdx], customPrice: parseFloat(e.target.value) || 0}; setEditBundledItems(n); }} className="bg-white border-gray-300 text-gray-900 w-20 h-8 text-sm" data-testid={`input-edit-bundle-price-${secIdx}-${itemIdx}`} />
             <SarIcon size={11} />
             {bItem.customPrice === 0 && bItem.productId && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">مجاني</span>}
           </div>
           <button type="button" onClick={() => { const n = [...editBundledItems]; n[secIdx].items = n[secIdx].items.filter((_, i) => i !== itemIdx); setEditBundledItems(n); }} className="text-red-400 hover:text-red-600 shrink-0" data-testid={`btn-del-edit-bundle-item-${secIdx}-${itemIdx}`}><X className="w-3 h-3" /></button>
         </div>
       ))}
       <button type="button" onClick={() => { const n = [...editBundledItems]; n[secIdx].items.push({ productId: '', nameAr: '', originalPrice: 0, customPrice: 0 }); setEditBundledItems(n); }} className="text-xs text-purple-600 hover:underline" data-testid={`btn-add-edit-bundle-item-${secIdx}`}>+ إضافة منتج لهذا القسم</button>
     </div>
   ))}
   <Button type="button" size="sm" variant="outline" onClick={() => setEditBundledItems([...editBundledItems, { sectionTitle: '', selectionType: 'single', minSelectable: 0, maxSelectable: 1, items: [] }])} className="border-purple-400/40 text-purple-600 w-full" data-testid="btn-add-edit-bundle-section"><Plus className="w-4 h-4 ml-1" />إضافة قسم منتجات مصاحبة</Button>
 </div>

{/* Advanced Addon Groups Section - Edit */}
<AddonGroupsEditor value={editAddonGroups} onChange={setEditAddonGroups} />

{/* Reservation Section - Edit */}
<div className="space-y-2 border border-amber-200 rounded-lg p-3 bg-amber-50/30">
  <div className="flex items-center justify-between">
    <Label className="text-gray-700 font-semibold flex items-center gap-2">🗓️ منتج يحتاج حجز مسبق</Label>
    <button
      type="button"
      onClick={() => setEditIsReservation(!editIsReservation)}
      className={`relative w-12 h-6 rounded-full transition-colors ${editIsReservation ? 'bg-amber-500' : 'bg-gray-300'}`}
      data-testid="toggle-edit-reservation"
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editIsReservation ? 'right-1' : 'left-1'}`} />
    </button>
  </div>
  {editIsReservation && (
    <div className="space-y-3 pt-2">
      <p className="text-xs text-amber-700">هذا المنتج لا يمكن طلبه مع منتجات أخرى، ويُلزم العميل بالحجز في الفرع فقط مع تأكيد عبر واتساب</p>
      <Label className="text-gray-600 text-sm">الباقات المتاحة للحجز</Label>
      {editReservationPackages.map((pkg, idx) => (
        <div key={idx} className="border border-amber-200 rounded-lg p-3 space-y-2 bg-white">
          <div className="flex items-center gap-2">
            <Input placeholder="اسم الباقة (مثال: باقة رومانسية)" value={pkg.packageName} onChange={(e) => { const n = [...editReservationPackages]; n[idx] = {...n[idx], packageName: e.target.value}; setEditReservationPackages(n); }} className="bg-white border-gray-300 text-gray-900 flex-1 h-8 text-sm" data-testid={`input-edit-pkg-name-${idx}`} />
            <button type="button" onClick={() => setEditReservationPackages(editReservationPackages.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600" data-testid={`btn-edit-del-pkg-${idx}`}><X className="w-4 h-4" /></button>
          </div>
          <Input placeholder="الوصف (اختياري)" value={pkg.description || ''} onChange={(e) => { const n = [...editReservationPackages]; n[idx] = {...n[idx], description: e.target.value}; setEditReservationPackages(n); }} className="bg-white border-gray-300 text-gray-900 h-8 text-sm" data-testid={`input-edit-pkg-desc-${idx}`} />
          <div className="flex gap-2">
            <div className="flex-1">
              <Input type="number" min={0} step={0.5} placeholder="السعر (ر.س)" value={pkg.price} onChange={(e) => { const n = [...editReservationPackages]; n[idx] = {...n[idx], price: parseFloat(e.target.value) || 0}; setEditReservationPackages(n); }} className="bg-white border-gray-300 text-gray-900 h-8 text-sm w-full" data-testid={`input-edit-pkg-price-${idx}`} />
            </div>
            <div className="flex-1">
              <Input placeholder="المدة (مثال: 2 ساعة)" value={pkg.duration || ''} onChange={(e) => { const n = [...editReservationPackages]; n[idx] = {...n[idx], duration: e.target.value}; setEditReservationPackages(n); }} className="bg-white border-gray-300 text-gray-900 h-8 text-sm w-full" data-testid={`input-edit-pkg-duration-${idx}`} />
            </div>
            <div className="flex-1">
              <Input type="number" min={1} placeholder="الحد الأقصى للضيوف" value={pkg.maxGuests || ''} onChange={(e) => { const n = [...editReservationPackages]; n[idx] = {...n[idx], maxGuests: parseInt(e.target.value) || undefined}; setEditReservationPackages(n); }} className="bg-white border-gray-300 text-gray-900 h-8 text-sm w-full" data-testid={`input-edit-pkg-guests-${idx}`} />
            </div>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => setEditReservationPackages([...editReservationPackages, { packageName: '', price: 0 }])} className="border-amber-400/40 text-amber-700 w-full" data-testid="btn-edit-add-pkg"><Plus className="w-4 h-4 ml-1" />إضافة باقة</Button>
    </div>
  )}
</div>

 <div className="flex justify-end gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={() => {
 setIsEditDialogOpen(false);
 setEditingItem(null);
 setEditImageUrls([]);
 }}
 className="border-gray-600 text-gray-300"
 data-testid="button-edit-cancel"
 >
 إلغاء
 </Button>
 <Button
 type="submit"
 disabled={updateItemMutation.isPending}
 className="bg-gradient-to-r from-blue-500 to-blue-700"
 data-testid="button-edit-submit"
 >
 {updateItemMutation.isPending ? "جاري التحديث..." : "تحديث المشروب"}
 </Button>
 </div>
 </form>
 )}
 </DialogContent>
 </Dialog>

 {/* Recipe Editor Dialog */}
 <Dialog open={isRecipeDialogOpen} onOpenChange={(open) => {
   setIsRecipeDialogOpen(open);
   if (!open) {
     setEditingRecipeItem(null);
     setRecipeItems([]);
   }
 }}>
   <DialogContent className="bg-white border-green-500/20 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
     <DialogHeader>
       <DialogTitle className="text-green-400 flex items-center gap-2">
         <FlaskConical className="w-5 h-5" />
         تعديل وصفة: {editingRecipeItem?.nameAr}
       </DialogTitle>
     </DialogHeader>
     
     <div className="space-y-4 py-4">
       <div className="bg-gray-50 p-3 rounded-lg border border-green-500/20">
         <p className="text-gray-400 text-sm">سعر البيع: <span className="text-accent font-bold">{editingRecipeItem?.price} <SarIcon size={11} /></span></p>
       </div>
       
       <div>
         <Label className="text-gray-600 text-lg">اختر المواد الخام للوصفة</Label>
         <p className="text-gray-500 text-sm mb-3">حدد الكميات المستخدمة في تحضير المنتج</p>
         
         <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
           {rawItems.filter(r => r.isActive === 1).map((raw) => {
             const isSelected = recipeItems.some(s => s.rawItemId === raw.id);
             const selected = recipeItems.find(s => s.rawItemId === raw.id);
             
             return (
               <div key={raw.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-primary/10">
                 <Checkbox
                   id={`recipe-edit-${raw.id}`}
                   checked={isSelected}
                   onCheckedChange={(checked) => {
                     if (checked) {
                       setRecipeItems([...recipeItems, {
                         rawItemId: raw.id,
                         rawItem: raw,
                         quantity: 10,
                         unit: raw.unit
                       }]);
                     } else {
                       setRecipeItems(recipeItems.filter(s => s.rawItemId !== raw.id));
                     }
                   }}
                   className="border-green-500/50"
                   data-testid={`checkbox-recipe-edit-${raw.id}`}
                 />
                 <label htmlFor={`recipe-edit-${raw.id}`} className="text-gray-600 flex-1 cursor-pointer">
                   <span>{raw.nameAr}</span>
                   <span className="text-gray-500 text-xs mr-2">({raw.unitCost.toFixed(2)} <SarIcon size={10} />/{raw.unit})</span>
                 </label>
                 {isSelected && (
                   <div className="flex items-center gap-2">
                     <Input
                       type="number"
                       min="0.1"
                       step="0.1"
                       value={selected?.quantity || 10}
                       onChange={(e) => {
                         setRecipeItems(recipeItems.map(s =>
                           s.rawItemId === raw.id ? { ...s, quantity: parseFloat(e.target.value) || 0 } : s
                         ));
                       }}
                       className="w-20 bg-white border-green-500/30 text-gray-900 text-center"
                       data-testid={`input-recipe-qty-${raw.id}`}
                     />
                     <Select
                       value={selected?.unit || raw.unit}
                       onValueChange={(value) => {
                         setRecipeItems(recipeItems.map(s =>
                           s.rawItemId === raw.id ? { ...s, unit: value } : s
                         ));
                       }}
                     >
                       <SelectTrigger className="w-20 bg-white border-green-500/30 text-gray-900" data-testid={`select-recipe-unit-${raw.id}`}>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="bg-white border-gray-200 text-gray-900">
                         <SelectItem value="g">جرام</SelectItem>
                         <SelectItem value="ml">مل</SelectItem>
                         <SelectItem value="kg">كجم</SelectItem>
                         <SelectItem value="liter">لتر</SelectItem>
                         <SelectItem value="piece">قطعة</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 )}
               </div>
             );
           })}
         </div>
         
         {recipeItems.length > 0 && (
           <div className="bg-gradient-to-r from-background to-background p-4 rounded-lg border border-green-500/30 mt-3">
             {(() => {
               const { totalCost, breakdown } = calculateRecipeCost(recipeItems);
               const sellingPrice = editingRecipeItem?.price ? parseFloat(String(editingRecipeItem.price)) : 0;
               const grossProfit = sellingPrice - totalCost;
               const profitMargin = sellingPrice > 0 ? ((grossProfit / sellingPrice) * 100) : 0;
               
               return (
                 <>
                   <div className="flex items-center justify-between mb-3">
                     <span className="text-gray-600 font-medium flex items-center gap-2">
                       <FlaskConical className="w-4 h-4 text-green-400" />
                       تكلفة الوصفة
                     </span>
                   </div>
                   
                   {breakdown.length > 0 && (
                     <div className="space-y-1 mb-3 text-sm">
                       {breakdown.map((item, idx) => (
                         <div key={idx} className="flex justify-between text-gray-400">
                           <span>{item.name} ({item.quantity} {item.unit})</span>
                           <span>{item.cost.toFixed(2)} <SarIcon size={10} /></span>
                         </div>
                       ))}
                     </div>
                   )}
                   
                   <div className="border-t border-green-500/20 pt-3 space-y-2">
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">تكلفة الوصفة (COGS):</span>
                       <span className="text-green-400 font-bold">{totalCost.toFixed(2)} <SarIcon size={11} /></span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">سعر البيع:</span>
                       <span className="text-white font-bold">{sellingPrice.toFixed(2)} <SarIcon size={11} /></span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">هامش الربح:</span>
                       <span className={`font-bold ${grossProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                         {grossProfit.toFixed(2)} <SarIcon size={11} /> ({profitMargin.toFixed(1)}%)
                       </span>
                     </div>
                   </div>
                 </>
               );
             })()}
           </div>
         )}
       </div>
       
       <div className="flex justify-end gap-2">
         <Button
           type="button"
           variant="outline"
           onClick={() => {
             setIsRecipeDialogOpen(false);
             setEditingRecipeItem(null);
             setRecipeItems([]);
           }}
           className="border-gray-600 text-gray-300"
           data-testid="button-recipe-cancel"
         >
           إلغاء
         </Button>
         <Button
           type="button"
           onClick={handleSaveRecipe}
           disabled={bulkRecipeMutation.isPending || recipeItems.length === 0}
           className="bg-gradient-to-r from-green-500 to-green-700"
           data-testid="button-recipe-save"
         >
           {bulkRecipeMutation.isPending ? "جاري الحفظ..." : "حفظ الوصفة"}
         </Button>
       </div>
     </div>
   </DialogContent>
 </Dialog>

 {/* Delete Confirmation */}
 <AlertDialog open={!!deletingItemId} onOpenChange={() => setDeletingItemId(null)}>
 <AlertDialogContent className="bg-white border-red-500/20 text-gray-900">
 <AlertDialogHeader>
 <AlertDialogTitle className="text-red-500">تأكيد الحذف</AlertDialogTitle>
 <AlertDialogDescription className="text-gray-300">
 هل أنت متأكد من حذف هذا المشروب؟ لا يمكن التراجع عن هذا الإجراء.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel
 className="bg-transparent border-gray-600 text-gray-300"
 data-testid="button-delete-cancel"
 >
 إلغاء
 </AlertDialogCancel>
 <AlertDialogAction
 onClick={confirmDelete}
 disabled={deleteItemMutation.isPending}
 className="bg-gradient-to-r from-red-500 to-red-700 text-white"
 data-testid="button-delete-confirm"
 >
 {deleteItemMutation.isPending ? "جاري الحذف..." : "حذف"}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>

 {/* Skip Recipe Confirmation Dialog */}
 <AlertDialog open={skipRecipeConfirmOpen} onOpenChange={setSkipRecipeConfirmOpen}>
   <AlertDialogContent className="bg-white border-gray-200 text-gray-900">
     <AlertDialogHeader>
       <AlertDialogTitle className="text-accent">تأكيد إنشاء منتج بدون وصفة</AlertDialogTitle>
       <AlertDialogDescription className="text-gray-300">
         أنت على وشك إنشاء منتج بدون وصفة. هذا يعني أن:
         <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
           <li>لن يتم خصم المخزون تلقائياً عند البيع</li>
           <li>لن يمكن حساب تكلفة المنتج بدقة</li>
           <li>لن يكون المنتج "جاهز للبيع" بالكامل</li>
         </ul>
         <p className="mt-3 text-primary">يمكنك إضافة الوصفة لاحقاً من قائمة المنتجات.</p>
       </AlertDialogDescription>
     </AlertDialogHeader>
     <AlertDialogFooter>
       <AlertDialogCancel
         className="bg-transparent border-gray-600 text-gray-300"
         data-testid="button-skip-recipe-cancel"
       >
         الرجوع لإضافة الوصفة
       </AlertDialogCancel>
       <AlertDialogAction
         onClick={handleConfirmSkipRecipe}
         className="bg-primary text-white"
         data-testid="button-skip-recipe-confirm"
       >
         إنشاء بدون وصفة
       </AlertDialogAction>
     </AlertDialogFooter>
   </AlertDialogContent>
 </AlertDialog>
{/* Category Reorder Dialog */}
<Dialog open={isCategoryReorderOpen} onOpenChange={setIsCategoryReorderOpen}>
  <DialogContent className="bg-card border-border text-foreground max-w-sm">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-foreground">
        <ListOrdered className="w-5 h-5 text-primary" />
        {tc("ترتيب الأقسام", "Reorder Categories")}
      </DialogTitle>
    </DialogHeader>
    <div className="space-y-2 my-2">
      {localCategories.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-6">
          {tc("لا توجد أقسام مخصصة لهذا القسم", "No custom categories for this department")}
        </p>
      ) : (
        localCategories.map((cat, idx) => (
          <div
            key={cat.id}
            className="flex items-center gap-3 bg-muted/40 border border-border rounded-xl px-3 py-2.5"
            data-testid={`category-row-${cat.id}`}
          >
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
              {idx + 1}
            </span>
            <span className="flex-1 text-sm font-medium text-foreground">{cat.nameAr}</span>
            {cat.nameEn && <span className="text-xs text-muted-foreground">{cat.nameEn}</span>}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => moveCategoryUp(idx)}
                disabled={idx === 0}
                className="p-1 rounded-lg hover:bg-primary/10 disabled:opacity-25 disabled:cursor-not-allowed text-primary transition-colors"
                data-testid={`btn-cat-up-${cat.id}`}
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => moveCategoryDown(idx)}
                disabled={idx === localCategories.length - 1}
                className="p-1 rounded-lg hover:bg-primary/10 disabled:opacity-25 disabled:cursor-not-allowed text-primary transition-colors"
                data-testid={`btn-cat-down-${cat.id}`}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
    <div className="flex gap-2 justify-end pt-2 border-t border-border">
      <Button
        variant="outline"
        onClick={() => setIsCategoryReorderOpen(false)}
        className="text-sm"
        data-testid="btn-cat-reorder-cancel"
      >
        {tc("إلغاء", "Cancel")}
      </Button>
      <Button
        onClick={saveCategoryOrder}
        disabled={reorderCategoriesMutation.isPending || localCategories.length === 0}
        className="bg-primary text-primary-foreground text-sm"
        data-testid="btn-cat-reorder-save"
      >
        {reorderCategoriesMutation.isPending ? tc("جاري الحفظ...", "Saving...") : tc("حفظ الترتيب", "Save Order")}
      </Button>
    </div>
  </DialogContent>
</Dialog>

<ImageLibraryModal
  open={isImageLibraryOpen}
  onClose={() => setIsImageLibraryOpen(false)}
  onSelect={(url) => {
    if (imageLibraryContext === "add") {
      setAddImageUrls(prev => prev.length < 5 ? [...prev, url] : prev);
    } else if (imageLibraryContext === "edit") {
      setEditImageUrls(prev => prev.length < 5 ? [...prev, url] : prev);
    } else if (imageLibraryContext === "add-addon" && editingAddonImageIdx >= 0) {
      setAddEditableAddons(prev => prev.map((a, i) => i === editingAddonImageIdx ? { ...a, imageUrl: url } : a));
    } else if (imageLibraryContext === "edit-addon" && editingAddonImageIdx >= 0) {
      setEditableAddons(prev => prev.map((a, i) => i === editingAddonImageIdx ? { ...a, imageUrl: url } : a));
    }
    setIsImageLibraryOpen(false);
  }}
/>
 <MobileBottomNav employeeRole={employee?.role} />
 </div>
 );
}
