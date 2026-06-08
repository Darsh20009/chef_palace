import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Coffee, Utensils } from "lucide-react";
import SarIcon from "@/components/sar-icon";
import { useTranslate } from "@/lib/useTranslate";

interface CoffeeItem {
  id: string;
  nameAr: string;
  nameEn?: string;
  imageUrl?: string;
  price: number | string;
  description?: string;
  category?: string;
}

interface CashierLayoutProps {
  items: CoffeeItem[];
  isLoading: boolean;
  getItemDisplayName: (item: CoffeeItem) => string;
  onAddItem: (item: CoffeeItem) => void;
}

export function ClassicCashierLayout({ items, isLoading, getItemDisplayName, onAddItem }: CashierLayoutProps) {
  const tc = useTranslate();
  if (isLoading) return <div className="text-center text-gray-400 py-8">{tc("جاري التحميل...", "Loading...")}</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map((item) => (
        <Card key={item.id} className="bg-[#1a1410] border-primary/10 hover:border-primary/30 transition-colors">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="text-right flex-1">
                <h3 className="text-accent font-bold mb-1" data-testid={`text-item-name-${item.id}`}>
                  {getItemDisplayName(item)}
                </h3>
                <p className="text-gray-400 text-sm line-clamp-2">{item.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <Badge variant="outline" className="border-primary/30 text-accent">
                {Number(item.price).toFixed(2)} <SarIcon size={11} />
              </Badge>
              <Button
                size="sm"
                onClick={() => onAddItem(item)}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid={`button-add-${item.id}`}
              >
                <Plus className="w-4 h-4 ml-1" />
                {tc("إضافة", "Add")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function POSCashierLayout({ items, isLoading, getItemDisplayName, onAddItem }: CashierLayoutProps) {
  const tc = useTranslate();
  if (isLoading) return <div className="text-center text-gray-400 py-8">{tc("جاري التحميل...", "Loading...")}</div>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onAddItem(item)}
          data-testid={`button-add-${item.id}`}
          className="relative flex flex-col items-center justify-between gap-2 p-4 rounded-2xl bg-[#1a1410] border border-primary/10 hover:border-primary/50 hover:bg-[#211810] active:scale-95 transition-all text-center group"
        >
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/30 flex-shrink-0 flex items-center justify-center">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                alt={getItemDisplayName(item)}
                onError={(e) => { const img = e.target as HTMLImageElement; img.src = '/images/brand-logo.png'; img.className = img.className.replace('object-cover', 'object-contain') + ' p-1 opacity-40'; }}
              />
            ) : (
              <Coffee className="w-7 h-7 text-primary/40" />
            )}
          </div>
          <div className="flex-1 w-full">
            <p className="text-accent font-bold text-xs leading-tight line-clamp-2 text-center mb-1">
              {getItemDisplayName(item)}
            </p>
            <p className="text-primary font-black text-sm">{Number(item.price).toFixed(2)} <SarIcon size={10} /></p>
          </div>
          <div className="absolute top-2 left-2 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus className="w-3 h-3 text-white" />
          </div>
        </button>
      ))}
    </div>
  );
}

function getCategoryFromItem(item: CoffeeItem): string {
  if (item.category) return item.category;
  const name = (item.nameAr || "").toLowerCase();
  if (name.includes("لاتيه") || name.includes("latte")) return "latte";
  if (name.includes("قهوة") || name.includes("coffee") || name.includes("كوفي")) return "coffee";
  if (name.includes("شوكولا") || name.includes("chocolate")) return "chocolate";
  if (name.includes("موهيتو") || name.includes("موكا")) return "drinks";
  if (name.includes("عصير") || name.includes("juice")) return "juice";
  if (name.includes("شاي") || name.includes("tea")) return "tea";
  return "other";
}

function getCategoryLabel(category: string, tc: (ar: string, en: string) => string): string {
  const map: Record<string, [string, string]> = {
    latte: ["لاتيه", "Latte"],
    coffee: ["قهوة", "Coffee"],
    chocolate: ["شوكولاتة", "Chocolate"],
    drinks: ["مشروبات", "Drinks"],
    juice: ["عصائر", "Juices"],
    tea: ["شاي", "Tea"],
    other: ["أخرى", "Other"],
  };
  const entry = map[category];
  return entry ? tc(entry[0], entry[1]) : category;
}

export function SplitCashierLayout({ items, isLoading, getItemDisplayName, onAddItem }: CashierLayoutProps) {
  const tc = useTranslate();
  const ALL_KEY = "__all__";
  const categories = [ALL_KEY, ...Array.from(new Set(items.map(getCategoryFromItem)))];
  const [selected, setSelected] = useState(ALL_KEY);
  const filtered = selected === ALL_KEY ? items : items.filter(i => getCategoryFromItem(i) === selected);

  if (isLoading) return <div className="text-center text-gray-400 py-8">{tc("جاري التحميل...", "Loading...")}</div>;

  return (
    <div className="flex gap-3 h-full">
      <div className="w-28 flex-shrink-0 flex flex-col gap-1.5 overflow-y-auto max-h-[65vh] pr-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelected(cat)}
            className={`w-full py-2.5 px-2 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-1 ${
              selected === cat
                ? "bg-primary text-white shadow-md"
                : "bg-[#1a1410] text-gray-400 hover:bg-[#221810] border border-primary/10"
            }`}
            data-testid={`button-category-${cat}`}
          >
            {cat === ALL_KEY
              ? <><Utensils className="w-3 h-3" />{tc("الكل", "All")}</>
              : getCategoryLabel(cat, tc)
            }
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto max-h-[65vh]">
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className="bg-[#1a1410] border-primary/10 hover:border-primary/40 transition-colors cursor-pointer group"
              onClick={() => onAddItem(item)}
              data-testid={`button-add-${item.id}`}
            >
              <CardContent className="p-3">
                <div className="w-full h-20 rounded-lg overflow-hidden bg-black/30 mb-2">
                  <img
                    src={item.imageUrl || '/images/brand-logo.png'}
                    className={`w-full h-full transition-transform group-hover:scale-105 ${item.imageUrl ? 'object-cover' : 'object-contain opacity-30 p-2'}`}
                    alt={getItemDisplayName(item)}
                    onError={(e) => { const img = e.target as HTMLImageElement; img.src = '/images/brand-logo.png'; img.className = 'w-full h-full object-contain opacity-30 p-2'; }}
                  />
                </div>
                <p className="text-accent font-bold text-xs line-clamp-2 text-right mb-2">
                  {getItemDisplayName(item)}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-primary/30 text-accent text-[10px] px-1.5">
                    {Number(item.price).toFixed(2)} <SarIcon size={10} />
                  </Badge>
                  <button
                    className="w-7 h-7 bg-green-600 hover:bg-green-700 rounded-lg flex items-center justify-center transition-colors"
                    onClick={(e) => { e.stopPropagation(); onAddItem(item); }}
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
