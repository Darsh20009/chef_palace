import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SarIcon from "@/components/sar-icon";
import { 
  Plus, 
  BookOpen,
  Search,
  Eye,
  Trash2,
  Calculator,
  Loader2,
  Coffee,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Beaker,
  Zap,
  Info,
  CheckCircle,
  Edit,
  Copy,
  AlertTriangle,
  Droplet,
  Wheat,
  Package,
  FlaskConical,
} from "lucide-react";

interface CoffeeItem {
  id: string;
  nameAr: string;
  nameEn?: string;
  price: number;
  category: string;
  imageUrl?: string;
}

interface RawItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  unit: string;
  unitCost: number;
  category?: string;
}

interface RecipeItem {
  id: string;
  coffeeItemId: string;
  rawItemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

const unitLabels: Record<string, string> = {
  kg: "كيلوجرام",
  g: "جرام",
  liter: "لتر",
  ml: "ملليلتر",
  piece: "قطعة",
  box: "صندوق",
  bag: "كيس",
};

const unitShortLabels: Record<string, string> = {
  kg: "كجم",
  g: "غ",
  liter: "ل",
  ml: "مل",
  piece: "قطعة",
  box: "صندوق",
  bag: "كيس",
};

const unitDimensions: Record<string, string> = {
  kg: "mass",
  g: "mass",
  liter: "volume",
  ml: "volume",
  piece: "count",
  box: "count",
  bag: "count",
};

const unitConversions: Record<string, Record<string, number>> = {
  mass: { kg: 1000, g: 1 },
  volume: { liter: 1000, ml: 1 },
  count: { piece: 1, box: 1, bag: 1 },
};

const drinkRecipeTemplates: Record<string, { name: string; ingredients: Array<{ rawCode: string; quantity: number; unit: string; description: string }> }> = {
  "bukhari-chicken": {
    name: "بخاري دجاج (1 شخص)",
    ingredients: [
      { rawCode: "RAW-001", quantity: 250, unit: "g", description: "أرز بسمتي" },
      { rawCode: "RAW-002", quantity: 300, unit: "g", description: "دجاج طازج" },
      { rawCode: "RAW-003", quantity: 20, unit: "g", description: "توابل بخاري" },
      { rawCode: "RAW-004", quantity: 30, unit: "ml", description: "زيت نباتي" },
    ]
  },
  "bukhari-lamb": {
    name: "بخاري لحم (1 شخص)",
    ingredients: [
      { rawCode: "RAW-001", quantity: 250, unit: "g", description: "أرز بسمتي" },
      { rawCode: "RAW-005", quantity: 350, unit: "g", description: "لحم خروف" },
      { rawCode: "RAW-003", quantity: 25, unit: "g", description: "توابل بخاري" },
      { rawCode: "RAW-004", quantity: 30, unit: "ml", description: "زيت نباتي" },
    ]
  },
  "mandi-chicken": {
    name: "مندي دجاج (1 شخص)",
    ingredients: [
      { rawCode: "RAW-001", quantity: 250, unit: "g", description: "أرز بسمتي" },
      { rawCode: "RAW-002", quantity: 350, unit: "g", description: "دجاج طازج" },
      { rawCode: "RAW-006", quantity: 15, unit: "g", description: "توابل مندي" },
    ]
  },
  "shish-tawook": {
    name: "شيش طاووق",
    ingredients: [
      { rawCode: "RAW-002", quantity: 200, unit: "g", description: "دجاج طازج" },
      { rawCode: "RAW-007", quantity: 50, unit: "g", description: "مارينا ثوم وليمون" },
    ]
  },
  "lentil-soup": {
    name: "شوربة عدس",
    ingredients: [
      { rawCode: "RAW-008", quantity: 100, unit: "g", description: "عدس أحمر" },
      { rawCode: "RAW-009", quantity: 10, unit: "ml", description: "زيت زيتون" },
      { rawCode: "RAW-010", quantity: 5, unit: "g", description: "كمون وتوابل" },
    ]
  },
  "hummus": {
    name: "حمص بالطحينة",
    ingredients: [
      { rawCode: "RAW-011", quantity: 100, unit: "g", description: "حمص مطبوخ" },
      { rawCode: "RAW-012", quantity: 30, unit: "g", description: "طحينة" },
      { rawCode: "RAW-009", quantity: 10, unit: "ml", description: "زيت زيتون" },
    ]
  },
  "ayran": {
    name: "عيران بالنعناع",
    ingredients: [
      { rawCode: "RAW-013", quantity: 200, unit: "ml", description: "لبن" },
      { rawCode: "RAW-014", quantity: 5, unit: "g", description: "نعناع طازج" },
    ]
  },
};

const quickIngredientTemplates = [
  { name: "أرز بسمتي (100غ)", rawCode: "RAW-001", quantity: 100, unit: "g", icon: Wheat },
  { name: "أرز بسمتي (250غ)", rawCode: "RAW-001", quantity: 250, unit: "g", icon: Wheat },
  { name: "دجاج (200غ)", rawCode: "RAW-002", quantity: 200, unit: "g", icon: Package },
  { name: "دجاج (300غ)", rawCode: "RAW-002", quantity: 300, unit: "g", icon: Package },
  { name: "لحم خروف (200غ)", rawCode: "RAW-005", quantity: 200, unit: "g", icon: Package },
  { name: "توابل بخاري (20غ)", rawCode: "RAW-003", quantity: 20, unit: "g", icon: FlaskConical },
  { name: "توابل مندي (15غ)", rawCode: "RAW-006", quantity: 15, unit: "g", icon: FlaskConical },
  { name: "زيت نباتي (30مل)", rawCode: "RAW-004", quantity: 30, unit: "ml", icon: Droplet },
  { name: "زيت زيتون (10مل)", rawCode: "RAW-009", quantity: 10, unit: "ml", icon: Droplet },
  { name: "طحينة (30غ)", rawCode: "RAW-012", quantity: 30, unit: "g", icon: FlaskConical },
  { name: "لبن (200مل)", rawCode: "RAW-013", quantity: 200, unit: "ml", icon: Droplet },
];

const categoryLabels: Record<string, string> = {
  basic: "أساسية",
  hot: "ساخنة",
  cold: "باردة",
  special: "خاصة",
  "cat-bukhari": "أرز بخاري",
  "cat-mandi": "مندي وزربيان",
  "cat-grills": "مشاوي",
  "cat-soup": "شوربة",
  "cat-appetizers": "مقبلات",
  "cat-drinks": "مشروبات",
  "cat-desserts": "حلويات",
};

const getCompatibleUnits = (baseUnit: string): string[] => {
  const dimension = unitDimensions[baseUnit];
  if (!dimension) return [baseUnit];
  return Object.keys(unitConversions[dimension] || {});
};

const normalizeQuantity = (quantity: number, fromUnit: string, toUnit: string): number | null => {
  const fromDimension = unitDimensions[fromUnit];
  const toDimension = unitDimensions[toUnit];
  
  if (fromDimension !== toDimension) return null;
  
  const conversions = unitConversions[fromDimension];
  if (!conversions) return quantity;
  
  const fromFactor = conversions[fromUnit] || 1;
  const toFactor = conversions[toUnit] || 1;
  
  return (quantity * fromFactor) / toFactor;
};

export default function InventoryRecipesPage() {
  const tc = useTranslate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedCoffeeItem, setSelectedCoffeeItem] = useState<CoffeeItem | null>(null);
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [isQuickSetupOpen, setIsQuickSetupOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const [newIngredient, setNewIngredient] = useState({
    rawItemId: "",
    quantity: 1,
    unit: "g",
  });

  const { data: coffeeItems = [], isLoading: loadingCoffee } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
  });

  const { data: rawItems = [] } = useQuery<RawItem[]>({
    queryKey: ["/api/inventory/raw-items"],
  });

  const { data: recipes = [], isLoading: loadingRecipes, isFetched: recipesFetched } = useQuery<RecipeItem[]>({
    queryKey: ["/api/inventory/recipes", selectedCoffeeItem?.id],
    enabled: !!selectedCoffeeItem?.id,
    queryFn: async () => {
      if (!selectedCoffeeItem?.id) return [];
      const res = await fetch(`/api/inventory/recipes/${selectedCoffeeItem.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("فشل في جلب الوصفة");
      const data = await res.json();
      // Route returns { items: RecipeItem[], totalCost: number }
      return Array.isArray(data) ? data : (data.items || []);
    },
  });

  const { data: allRecipes = [] } = useQuery<RecipeItem[]>({
    queryKey: ["/api/inventory/all-recipes"],
  });

  const addIngredientMutation = useMutation({
    mutationFn: (data: { coffeeItemId: string; rawItemId: string; quantity: number; unit: string }) => {
      if (!data.coffeeItemId || !data.rawItemId) {
        return Promise.reject(new Error("يرجى تحديد المنتج والمادة الخام"));
      }
      return apiRequest("POST", "/api/inventory/recipes", data);
    },
    onSuccess: () => {
      if (selectedCoffeeItem?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/inventory/recipes", selectedCoffeeItem.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/all-recipes"] });
      setIsAddIngredientOpen(false);
      setNewIngredient({ rawItemId: "", quantity: 1, unit: "g" });
      toast({ title: "تم إضافة المكون بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إضافة المكون", variant: "destructive" });
    },
  });

  const deleteIngredientMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inventory/recipes/${id}`),
    onSuccess: () => {
      if (selectedCoffeeItem?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/inventory/recipes", selectedCoffeeItem.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/all-recipes"] });
      toast({ title: "تم حذف المكون بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في حذف المكون", variant: "destructive" });
    },
  });

  const bulkAddIngredientsMutation = useMutation({
    mutationFn: async (data: { coffeeItemId: string; ingredients: Array<{ rawItemId: string; quantity: number; unit: string }> }) => {
      const results = [];
      for (const ingredient of data.ingredients) {
        try {
          const result = await apiRequest("POST", "/api/inventory/recipes", {
            coffeeItemId: data.coffeeItemId,
            ...ingredient,
          });
          results.push(result);
        } catch (error) {
          console.error("Failed to add ingredient:", error);
        }
      }
      return results;
    },
    onSuccess: () => {
      if (selectedCoffeeItem?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/inventory/recipes", selectedCoffeeItem.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/all-recipes"] });
      setIsQuickSetupOpen(false);
      setSelectedTemplate(null);
      toast({ title: "تم إضافة الوصفة بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إضافة الوصفة", variant: "destructive" });
    },
  });

  const getRawItemName = (id: string) => rawItems.find(r => r.id === id)?.nameAr || id;
  const getRawItemById = (id: string) => rawItems.find(r => r.id === id);
  const getRawItemByCode = (code: string) => rawItems.find(r => r.code === code);

  const selectedRawItem = useMemo(() => {
    return rawItems.find(r => r.id === newIngredient.rawItemId);
  }, [rawItems, newIngredient.rawItemId]);

  const compatibleUnits = useMemo(() => {
    if (!selectedRawItem) return Object.keys(unitLabels);
    return getCompatibleUnits(selectedRawItem.unit);
  }, [selectedRawItem]);

  const ingredientCostPreview = useMemo(() => {
    if (!selectedRawItem || newIngredient.quantity <= 0) return null;
    
    const normalizedQty = normalizeQuantity(newIngredient.quantity, newIngredient.unit, selectedRawItem.unit);
    if (normalizedQty === null) return null;
    
    const cost = selectedRawItem.unitCost * normalizedQty;
    return cost;
  }, [selectedRawItem, newIngredient.quantity, newIngredient.unit]);

  const recipeCost = useMemo(() => {
    if (loadingRecipes || rawItems.length === 0) return null;
    
    return recipes.reduce((total, item) => {
      const rawItem = rawItems.find(r => r.id === item.rawItemId);
      if (!rawItem) return total;
      
      const normalizedQty = normalizeQuantity(item.quantity, item.unit, rawItem.unit);
      if (normalizedQty === null) return total;
      
      return total + (rawItem.unitCost * normalizedQty);
    }, 0);
  }, [recipes, rawItems, loadingRecipes]);

  const profitMargin = useMemo(() => {
    if (recipeCost === null || !selectedCoffeeItem) return null;
    const margin = selectedCoffeeItem.price - recipeCost;
    const percentage = selectedCoffeeItem.price > 0 
      ? ((1 - recipeCost / selectedCoffeeItem.price) * 100)
      : 0;
    return { margin, percentage };
  }, [recipeCost, selectedCoffeeItem]);

  const getItemRecipeCount = (coffeeItemId: string) => {
    return allRecipes.filter(r => r.coffeeItemId === coffeeItemId).length;
  };

  const getItemCOGS = (coffeeItemId: string) => {
    const itemRecipes = allRecipes.filter(r => r.coffeeItemId === coffeeItemId);
    return itemRecipes.reduce((total, item) => {
      const rawItem = rawItems.find(r => r.id === item.rawItemId);
      if (!rawItem) return total;
      
      const normalizedQty = normalizeQuantity(item.quantity, item.unit, rawItem.unit);
      if (normalizedQty === null) return total;
      
      return total + (rawItem.unitCost * normalizedQty);
    }, 0);
  };

  const handleViewRecipe = (item: CoffeeItem) => {
    setSelectedCoffeeItem(item);
    setIsRecipeDialogOpen(true);
  };

  const handleQuickSetup = (item: CoffeeItem) => {
    setSelectedCoffeeItem(item);
    setSelectedTemplate(item.id);
    setIsQuickSetupOpen(true);
  };

  const handleApplyTemplate = () => {
    if (!selectedCoffeeItem || !selectedTemplate) return;
    
    const template = drinkRecipeTemplates[selectedTemplate];
    if (!template) {
      toast({ title: "لا يوجد قالب لهذا المنتج", variant: "destructive" });
      return;
    }

    const ingredients = template.ingredients.map(ing => {
      const rawItem = getRawItemByCode(ing.rawCode);
      if (!rawItem) return null;
      return {
        rawItemId: rawItem.id,
        quantity: ing.quantity,
        unit: ing.unit,
      };
    }).filter(Boolean) as Array<{ rawItemId: string; quantity: number; unit: string }>;

    if (ingredients.length === 0) {
      toast({ title: "لم يتم العثور على المواد الخام المطلوبة", variant: "destructive" });
      return;
    }

    bulkAddIngredientsMutation.mutate({
      coffeeItemId: selectedCoffeeItem.id,
      ingredients,
    });
  };

  const handleAddIngredient = () => {
    if (!selectedCoffeeItem?.id) {
      toast({ title: "يرجى تحديد المنتج أولاً", variant: "destructive" });
      return;
    }
    if (!recipesFetched) {
      toast({ title: "جاري تحميل البيانات، يرجى الانتظار", variant: "destructive" });
      return;
    }
    if (!newIngredient.rawItemId || !selectedRawItem) {
      toast({ title: "يرجى تحديد المادة الخام", variant: "destructive" });
      return;
    }
    if (newIngredient.quantity <= 0) {
      toast({ title: "يرجى إدخال كمية صحيحة", variant: "destructive" });
      return;
    }
    
    const normalizedQty = normalizeQuantity(newIngredient.quantity, newIngredient.unit, selectedRawItem.unit);
    if (normalizedQty === null) {
      toast({ title: "وحدة القياس غير متوافقة مع المادة الخام", variant: "destructive" });
      return;
    }
    
    addIngredientMutation.mutate({
      coffeeItemId: selectedCoffeeItem.id,
      rawItemId: newIngredient.rawItemId,
      quantity: newIngredient.quantity,
      unit: newIngredient.unit,
    });
  };

  const filteredCoffeeItems = coffeeItems.filter((item) => {
    const matchesSearch = item.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(coffeeItems.map(item => item.category))];

  const stats = useMemo(() => {
    const withRecipes = coffeeItems.filter(item => getItemRecipeCount(item.id) > 0).length;
    const withoutRecipes = coffeeItems.length - withRecipes;
    const avgCOGS = coffeeItems.length > 0 
      ? coffeeItems.reduce((sum, item) => sum + getItemCOGS(item.id), 0) / coffeeItems.length 
      : 0;
    return { withRecipes, withoutRecipes, avgCOGS };
  }, [coffeeItems, allRecipes, rawItems]);

  if (loadingCoffee) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="relative">
            <BookOpen className="h-12 w-12 text-primary animate-pulse mx-auto" />
            <Loader2 className="h-6 w-6 animate-spin text-primary absolute -bottom-1 -right-1" />
          </div>
          <p className="text-muted-foreground mt-3">{tc("جاري تحميل وصفات المنتجات...","Loading product recipes...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100">
            <BookOpen className="h-7 w-7 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {tc("وصفات المنتجات","Product Recipes")}
              <Badge variant="secondary" className="font-normal bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                COGS
              </Badge>
            </h1>
            <p className="text-muted-foreground text-sm">{tc("ربط المنتجات بالمواد الخام وحساب تكلفة الصنف تلقائياً","Link products to raw materials and auto-calculate item cost")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border p-4 bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900/50 dark:to-stone-800/50 border-stone-200 dark:border-stone-700">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">{tc("إجمالي المنتجات","Total Products")}</span>
            <Coffee className="h-4 w-4 text-stone-600 dark:text-stone-400" />
          </div>
          <div className="text-3xl font-bold text-stone-700 dark:text-stone-300">{coffeeItems.length}</div>
          <p className="text-xs text-muted-foreground mt-1">{tc("منتج في القائمة","products in menu")}</p>
        </div>

        <div className="rounded-xl border p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 border-emerald-200 dark:border-emerald-700">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">{tc("منتجات بوصفات","Products with Recipes")}</span>
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{stats.withRecipes}</div>
          <p className="text-xs text-muted-foreground mt-1">{tc("وصفة مكتملة","complete recipe")}</p>
        </div>

        <div className="rounded-xl border p-4 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/20 dark:to-primary/10 border-primary dark:border-primary">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">{tc("تحتاج وصفات","Need Recipes")}</span>
            <AlertTriangle className="h-4 w-4 text-accent dark:text-accent" />
          </div>
          <div className="text-3xl font-bold text-accent dark:text-accent">{stats.withoutRecipes}</div>
          <p className="text-xs text-muted-foreground mt-1">{tc("منتج بدون وصفة","products without recipe")}</p>
        </div>

        <div className="rounded-xl border p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">{tc("متوسط التكلفة","Avg Cost")}</span>
            <Calculator className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.avgCOGS.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground mt-1"><SarIcon /> / منتج</p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-stone-50/50 to-transparent dark:from-stone-900/20 dark:to-transparent">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tc("بحث بالاسم...","Search by name...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-search-recipes"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                <SelectValue placeholder="الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("جميع الفئات","All Categories")}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {categoryLabels[cat] || cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">{tc("المنتج","Product")}</TableHead>
                  <TableHead className="text-right">{tc("الفئة","Category")}</TableHead>
                  <TableHead className="text-right">{tc("سعر البيع","Selling Price")}</TableHead>
                  <TableHead className="text-right">{tc("التكلفة (COGS)","Cost (COGS)")}</TableHead>
                  <TableHead className="text-right">{tc("هامش الربح","Profit Margin")}</TableHead>
                  <TableHead className="text-right">{tc("المكونات","Ingredients")}</TableHead>
                  <TableHead className="text-right">{tc("الإجراءات","Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoffeeItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Coffee className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">{tc("لا توجد منتجات","No products found")}</p>
                      <p className="text-sm">{tc("لم يتم العثور على منتجات مطابقة","No matching products found")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCoffeeItems.map((item) => {
                    const recipeCount = getItemRecipeCount(item.id);
                    const itemCOGS = getItemCOGS(item.id);
                    const itemMargin = item.price - itemCOGS;
                    const marginPercentage = item.price > 0 ? ((1 - itemCOGS / item.price) * 100) : 0;
                    const hasTemplate = drinkRecipeTemplates[item.id];

                    return (
                      <TableRow 
                        key={item.id} 
                        className="hover-elevate transition-all"
                        data-testid={`row-recipe-${item.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.imageUrl && (
                              <img 
                                src={item.imageUrl} 
                                alt={item.nameAr} 
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            )}
                            <div>
                              <div className="font-medium">{item.nameAr}</div>
                              {item.nameEn && (
                                <div className="text-sm text-muted-foreground">{item.nameEn}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-muted/50">
                            {categoryLabels[item.category] || item.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{item.price.toFixed(2)}</span>
                          <span className="text-muted-foreground mr-1"><SarIcon /></span>
                        </TableCell>
                        <TableCell>
                          {recipeCount > 0 ? (
                            <span className="font-medium text-accent dark:text-accent">
                              {itemCOGS.toFixed(2)} <SarIcon />
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {recipeCount > 0 ? (
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${
                                marginPercentage >= 50 
                                  ? 'text-emerald-600 dark:text-emerald-400' 
                                  : marginPercentage >= 30 
                                    ? 'text-accent dark:text-accent'
                                    : 'text-red-600 dark:text-red-400'
                              }`}>
                                {marginPercentage.toFixed(0)}%
                              </span>
                              {marginPercentage >= 50 ? (
                                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              ) : marginPercentage >= 30 ? (
                                <TrendingUp className="h-4 w-4 text-accent dark:text-accent" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {recipeCount > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                              {recipeCount} مكون
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              لا توجد
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleViewRecipe(item)}
                                  data-testid={`button-view-recipe-${item.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>عرض الوصفة</TooltipContent>
                            </Tooltip>
                            {hasTemplate && recipeCount === 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleQuickSetup(item)}
                                    className="text-emerald-600 hover:text-emerald-700"
                                    data-testid={`button-quick-setup-${item.id}`}
                                  >
                                    <Zap className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>إعداد سريع</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-600" />
              {tc("وصفة","Recipe:")} {selectedCoffeeItem?.nameAr}
            </DialogTitle>
            <DialogDescription>
              {tc("إدارة مكونات وتكلفة هذا المنتج","Manage ingredients and cost for this product")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCoffeeItem && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <CircleDollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{tc("سعر البيع","Selling Price")}</p>
                        <p className="text-xl font-bold">{selectedCoffeeItem.price.toFixed(2)} <SarIcon /></p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-primary/20 dark:border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary dark:bg-primary/30">
                        <Beaker className="h-5 w-5 text-accent dark:text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{tc("تكلفة الصنف (COGS)","Item Cost (COGS)")}</p>
                        {recipeCost === null ? (
                          <p className="text-xl font-bold text-muted-foreground">{tc("جاري الحساب...","Calculating...")}</p>
                        ) : (
                          <p className="text-xl font-bold text-accent dark:text-accent">
                            {recipeCost.toFixed(2)} <SarIcon />
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${
                  profitMargin && profitMargin.percentage >= 50 
                    ? 'border-emerald-500/20 dark:border-emerald-400/20 bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-900/10 dark:to-transparent' 
                    : profitMargin && profitMargin.percentage >= 30 
                      ? 'border-primary/20 dark:border-primary/20 bg-gradient-to-br from-primary/5 to-transparent'
                      : 'border-red-500/20 dark:border-red-400/20 bg-gradient-to-br from-red-50 to-transparent dark:from-red-900/10 dark:to-transparent'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        profitMargin && profitMargin.percentage >= 50 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                          : profitMargin && profitMargin.percentage >= 30 
                            ? 'bg-primary dark:bg-primary/30'
                            : 'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {profitMargin && profitMargin.percentage >= 30 ? (
                          <TrendingUp className={`h-5 w-5 ${
                            profitMargin.percentage >= 50 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : 'text-accent dark:text-accent'
                          }`} />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">{tc("هامش الربح","Profit Margin")}</p>
                        {profitMargin === null ? (
                          <p className="text-xl font-bold text-muted-foreground">{tc("جاري الحساب...","Calculating...")}</p>
                        ) : selectedCoffeeItem.price === 0 ? (
                          <p className="text-xl font-bold text-muted-foreground">{tc("غير متاح","N/A")}</p>
                        ) : (
                          <div>
                            <p className={`text-xl font-bold ${
                              profitMargin.percentage >= 50 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : profitMargin.percentage >= 30 
                                  ? 'text-accent dark:text-accent'
                                  : 'text-red-600 dark:text-red-400'
                            }`}>
                              {profitMargin.margin.toFixed(2)} <SarIcon />
                              <span className="text-sm font-normal mr-1">
                                ({profitMargin.percentage.toFixed(1)}%)
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    {profitMargin && selectedCoffeeItem.price > 0 && (
                      <div className="mt-3">
                        <Progress 
                          value={Math.min(profitMargin.percentage, 100)} 
                          className={`h-2 ${
                            profitMargin.percentage >= 50 
                              ? '[&>div]:bg-emerald-500' 
                              : profitMargin.percentage >= 30 
                                ? '[&>div]:bg-primary'
                                : '[&>div]:bg-red-500'
                          }`}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  {tc("المكونات","Ingredients")}
                </h3>
                <div className="flex items-center gap-2">
                  {drinkRecipeTemplates[selectedCoffeeItem.id] && recipes.length === 0 && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedTemplate(selectedCoffeeItem.id);
                        handleApplyTemplate();
                      }}
                      disabled={bulkAddIngredientsMutation.isPending}
                      className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-700 dark:hover:bg-emerald-900/20"
                      data-testid="button-apply-template"
                    >
                      {bulkAddIngredientsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 ml-1" />
                      )}
                      {tc("إعداد سريع","Quick Setup")}
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    onClick={() => setIsAddIngredientOpen(true)}
                    data-testid="button-add-ingredient"
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    {tc("إضافة مكون","Add Ingredient")}
                  </Button>
                </div>
              </div>

              {loadingRecipes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : recipes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                  <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">{tc("لا توجد مكونات مضافة لهذا المنتج","No ingredients added for this product")}</p>
                  <p className="text-sm">{tc("أضف المكونات لحساب تكلفة الصنف","Add ingredients to calculate item cost")}</p>
                  {drinkRecipeTemplates[selectedCoffeeItem.id] && (
                    <div className="mt-4">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedTemplate(selectedCoffeeItem.id);
                          handleApplyTemplate();
                        }}
                        disabled={bulkAddIngredientsMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        data-testid="button-quick-setup-empty"
                      >
                        {bulkAddIngredientsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4 ml-1" />
                        )}
                        {tc("استخدام القالب الجاهز","Use Ready Template")}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">{tc("المكون","Ingredient")}</TableHead>
                        <TableHead className="text-right">{tc("الكمية","Quantity")}</TableHead>
                        <TableHead className="text-right">{tc("الوحدة","Unit")}</TableHead>
                        <TableHead className="text-right">{tc("تكلفة الوحدة","Unit Cost")}</TableHead>
                        <TableHead className="text-right">{tc("الإجمالي","Total")}</TableHead>
                        <TableHead className="text-right">{tc("الإجراءات","Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipes.map((recipe) => {
                        const rawItem = rawItems.find(r => r.id === recipe.rawItemId);
                        const normalizedQty = rawItem ? normalizeQuantity(recipe.quantity, recipe.unit, rawItem.unit) : null;
                        const totalCost = normalizedQty !== null && rawItem ? rawItem.unitCost * normalizedQty : 0;
                        const costPerDisplayUnit = rawItem && normalizedQty !== null && recipe.quantity > 0 
                          ? totalCost / recipe.quantity 
                          : 0;

                        return (
                          <TableRow key={recipe.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded bg-muted">
                                  <Beaker className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <span className="font-medium">{getRawItemName(recipe.rawItemId)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono">{recipe.quantity}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {unitLabels[recipe.unit] || recipe.unit}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-muted-foreground">{costPerDisplayUnit.toFixed(4)} <SarIcon /></span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-accent dark:text-accent">{totalCost.toFixed(2)} <SarIcon /></span>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteIngredientMutation.mutate(recipe.id)}
                                disabled={deleteIngredientMutation.isPending}
                                data-testid={`button-delete-ingredient-${recipe.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecipeDialogOpen(false)}>{tc("إغلاق","Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddIngredientOpen} onOpenChange={setIsAddIngredientOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              {tc("إضافة مكون جديد","Add New Ingredient")}
            </DialogTitle>
            <DialogDescription>
              {tc("أضف مكون جديد لوصفة","Add new ingredient to recipe:")} {selectedCoffeeItem?.nameAr}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="quick" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quick" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                {tc("قوالب سريعة","Quick Templates")}
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                {tc("إدخال يدوي","Manual Entry")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-2">
                {quickIngredientTemplates.map((template) => {
                  const rawItem = getRawItemByCode(template.rawCode);
                  if (!rawItem) return null;
                  const Icon = template.icon;
                  return (
                    <Button
                      key={template.name}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="justify-start h-auto py-3 text-right hover-elevate"
                      onClick={() => {
                        setNewIngredient({
                          rawItemId: rawItem.id,
                          quantity: template.quantity,
                          unit: template.unit,
                        });
                      }}
                      data-testid={`quick-template-${template.rawCode}`}
                    >
                      <Icon className="h-4 w-4 ml-2 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {rawItem.nameAr}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>

              {newIngredient.rawItemId && (
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium text-emerald-800 dark:text-emerald-200">{tc("تم اختيار المكون","Ingredient selected")}</span>
                    </div>
                    {ingredientCostPreview !== null && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100">
                        {ingredientCostPreview.toFixed(4)} <SarIcon />
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {selectedRawItem?.nameAr} - {newIngredient.quantity} {unitShortLabels[newIngredient.unit]}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{tc("المادة الخام *","Raw Material *")}</Label>
                <Select
                  value={newIngredient.rawItemId}
                  onValueChange={(value) => setNewIngredient({ ...newIngredient, rawItemId: value })}
                >
                  <SelectTrigger data-testid="select-raw-item">
                    <SelectValue placeholder={tc("اختر المادة الخام","Select raw material")} />
                  </SelectTrigger>
                  <SelectContent>
                    {rawItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{item.nameAr}</span>
                          <span className="text-muted-foreground text-sm">
                            {item.unitCost.toFixed(2)} <SarIcon /> / {unitLabels[item.unit]}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tc("الكمية *","Quantity *")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newIngredient.quantity}
                    onChange={(e) => setNewIngredient({ ...newIngredient, quantity: parseFloat(e.target.value) || 1 })}
                    data-testid="input-quantity"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tc("الوحدة *","Unit *")}</Label>
                  <Select
                    value={newIngredient.unit}
                    onValueChange={(value) => setNewIngredient({ ...newIngredient, unit: value })}
                  >
                    <SelectTrigger data-testid="select-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {compatibleUnits.map((key) => (
                        <SelectItem key={key} value={key}>{unitLabels[key] || key}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRawItem && (
                    <p className="text-xs text-muted-foreground">
                      {tc("وحدة المادة الخام:","Raw material unit:")} {unitLabels[selectedRawItem.unit] || selectedRawItem.unit}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {ingredientCostPreview !== null && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{tc("التكلفة المتوقعة","Expected Cost")}</span>
                </div>
                <span className="text-lg font-bold text-primary">{ingredientCostPreview.toFixed(4)} <SarIcon /></span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {newIngredient.quantity} {unitLabels[newIngredient.unit]} {tc("من","of")} {selectedRawItem?.nameAr}
              </p>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsAddIngredientOpen(false)}>{tc("إلغاء","Cancel")}</Button>
            <Button
              onClick={handleAddIngredient}
              disabled={addIngredientMutation.isPending || !newIngredient.rawItemId}
              data-testid="button-submit-ingredient"
            >
              {addIngredientMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              {tc("إضافة المكون","Add Ingredient")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickSetupOpen} onOpenChange={setIsQuickSetupOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-600" />
              {tc("إعداد سريع للوصفة","Quick Recipe Setup")}
            </DialogTitle>
            <DialogDescription>
              {tc("استخدم القالب الجاهز لإضافة جميع مكونات","Use ready template to add all ingredients for")} {selectedCoffeeItem?.nameAr} {tc("بنقرة واحدة","in one click")}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && drinkRecipeTemplates[selectedTemplate] && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                <h4 className="font-medium text-emerald-800 dark:text-emerald-200 mb-3">
                  {drinkRecipeTemplates[selectedTemplate].name}
                </h4>
                <div className="space-y-2">
                  {drinkRecipeTemplates[selectedTemplate].ingredients.map((ing, idx) => {
                    const rawItem = getRawItemByCode(ing.rawCode);
                    return (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Beaker className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700 dark:text-emerald-300">{ing.description}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {ing.quantity} {unitShortLabels[ing.unit]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickSetupOpen(false)}>{tc("إلغاء","Cancel")}</Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={bulkAddIngredientsMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-confirm-template"
            >
              {bulkAddIngredientsMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              {tc("تطبيق القالب","Apply Template")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
