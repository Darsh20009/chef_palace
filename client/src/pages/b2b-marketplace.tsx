import { useState } from "react";
import { PlanGate } from "@/components/plan-gate";
  import { useQuery, useMutation } from "@tanstack/react-query";
  import { queryClient, apiRequest } from "@/lib/queryClient";
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
  import { Button } from "@/components/ui/button";
  import { Badge } from "@/components/ui/badge";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
  import { Textarea } from "@/components/ui/textarea";
  import { useToast } from "@/hooks/use-toast";
  import { useTranslate } from "@/lib/useTranslate";
  import { useLocation } from "wouter";
  import { 
    Store, Package, Star, Truck, TrendingDown, Search, Filter, ArrowLeft,
    Phone, Mail, MapPin, ShoppingCart, Plus, CheckCircle, Clock, Award,
    BarChart3, ArrowDownToLine, RefreshCw
  } from "lucide-react";

  const MOCK_SUPPLIERS = [
    { id: '1', nameAr: 'شركة الأرز الذهبي', nameEn: 'Golden Rice Co.', category: 'grains', rating: 4.8, reviews: 124, location: 'الرياض', minOrder: 500, deliveryDays: 2, verified: true, products: ['أرز بسمتي هندي', 'أرز بسمتي باكستاني', 'أرز قصير الحبة'], phone: '+966501234567', discount: 15 },
    { id: '2', nameAr: 'مستودعات التوابل العربية', nameEn: 'Arab Spice Warehouse', category: 'spices', rating: 4.6, reviews: 89, location: 'جدة', minOrder: 300, deliveryDays: 3, verified: true, products: ['توابل بخاري', 'كمون', 'هيل', 'زعفران'], phone: '+966509876543', discount: 0 },
    { id: '3', nameAr: 'مزارع الدواجن الطازجة', nameEn: 'Fresh Poultry Farms', category: 'meat', rating: 4.9, reviews: 201, location: 'الدمام', minOrder: 200, deliveryDays: 1, verified: true, products: ['دجاج كامل', 'دجاج مقطع', 'فيليه دجاج'], phone: '+966503456789', discount: 10 },
    { id: '4', nameAr: 'مستودعات اللحوم المميزة', nameEn: 'Premium Meats', category: 'meat', rating: 4.4, reviews: 56, location: 'الرياض', minOrder: 1000, deliveryDays: 5, verified: false, products: ['لحم خروف', 'لحم بقر', 'لحم مفروم'], phone: '+966507654321', discount: 20 },
    { id: '5', nameAr: 'رواد التوابل والإضافات', nameEn: 'Spice Leaders', category: 'spices', rating: 4.7, reviews: 178, location: 'مكة', minOrder: 150, deliveryDays: 2, verified: true, products: ['قرفة', 'هيل', 'زعفران', 'جوز الطيب'], phone: '+966502345678', discount: 5 },
    { id: '6', nameAr: 'مؤسسة المطبخ الاحترافي', nameEn: 'Pro Kitchen Equipment', category: 'equipment', rating: 4.5, reviews: 43, location: 'الرياض', minOrder: 2000, deliveryDays: 7, verified: true, products: ['أواني طبخ', 'شوايات فحم', 'معدات مطبخ'], phone: '+966508765432', discount: 0 },
  ];

  const CATEGORIES = [
    { id: 'all', labelAr: 'الكل', labelEn: 'All' },
    { id: 'grains', labelAr: 'أرز وحبوب', labelEn: 'Rice & Grains' },
    { id: 'spices', labelAr: 'توابل وبهارات', labelEn: 'Spices & Seasonings' },
    { id: 'meat', labelAr: 'دواجن ولحوم', labelEn: 'Poultry & Meat' },
    { id: 'ingredients', labelAr: 'مكونات وإضافات', labelEn: 'Ingredients & Extras' },
    { id: 'equipment', labelAr: 'معدات ومستلزمات', labelEn: 'Equipment & Supplies' },
  ];

  export default function B2BMarketplacePage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const tc = useTranslate();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [selectedSupplier, setSelectedSupplier] = useState<typeof MOCK_SUPPLIERS[0] | null>(null);
    const [rfqOpen, setRfqOpen] = useState(false);
    const [rfqForm, setRfqForm] = useState({ product: '', quantity: '', notes: '' });
    const [cart, setCart] = useState<{supplier: string, product: string, qty: number}[]>([]);

    const filtered = MOCK_SUPPLIERS.filter(s => {
      const matchCat = category === 'all' || s.category === category;
      const matchSearch = !search || s.nameAr.includes(search) || s.nameEn.toLowerCase().includes(search.toLowerCase()) || s.products.some(p => p.includes(search));
      return matchCat && matchSearch;
    });

    const sendRFQ = () => {
      toast({ title: tc("✅ تم إرسال طلب العرض", "✅ RFQ Sent"), description: tc(`تم إرسال طلبك إلى ${selectedSupplier?.nameAr}`, `Your RFQ was sent to ${selectedSupplier?.nameEn}`) });
      setRfqOpen(false);
      setRfqForm({ product: '', quantity: '', notes: '' });
    };

    return (
      <PlanGate feature="b2bMarketplace">
      <div className="min-h-screen bg-background p-4 md:p-6" dir="rtl">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/manager/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Store className="w-7 h-7 text-primary" />
                {tc("سوق الموردين B2B", "B2B Supplier Marketplace")}
              </h1>
              <p className="text-sm text-muted-foreground">{tc("اطلب مباشرة من الموردين المعتمدين بأسعار الجملة", "Order directly from certified suppliers at wholesale prices")}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center">
              <p className="text-2xl font-black text-primary">{MOCK_SUPPLIERS.length}</p>
              <p className="text-xs text-muted-foreground">{tc("مورد معتمد", "Certified Suppliers")}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-black text-green-500">-15%</p>
              <p className="text-xs text-muted-foreground">{tc("متوسط التوفير", "Avg. Savings")}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-black text-blue-500">24h</p>
              <p className="text-xs text-muted-foreground">{tc("متوسط التوصيل", "Avg. Delivery")}</p>
            </Card>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tc("ابحث عن مورد أو منتج...", "Search supplier or product...")} value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <Button key={cat.id} size="sm" variant={category === cat.id ? 'default' : 'outline'} onClick={() => setCategory(cat.id)} className="text-xs">
                {tc(cat.labelAr, cat.labelEn)}
              </Button>
            ))}
          </div>

          {/* Supplier Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(supplier => (
              <Card key={supplier.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedSupplier(supplier)}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{tc(supplier.nameAr, supplier.nameEn)}</p>
                        {supplier.verified && <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 border text-[10px]">✓ {tc("معتمد", "Verified")}</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-0.5 text-sm"><Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />{supplier.rating}</span>
                        <span className="text-xs text-muted-foreground">({supplier.reviews} {tc("تقييم", "reviews")})</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{supplier.location}</span>
                      </div>
                    </div>
                    {supplier.discount > 0 && (
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30 border text-xs">-{supplier.discount}% {tc("خصم", "OFF")}</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {supplier.products.slice(0, 3).map(p => (
                      <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                    ))}
                    {supplier.products.length > 3 && <Badge variant="secondary" className="text-[10px]">+{supplier.products.length - 3}</Badge>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span><Package className="w-3 h-3 inline ml-1" />{tc("حد أدنى:", "Min Order:")} {supplier.minOrder} {tc("ريال", "SAR")}</span>
                    <span><Truck className="w-3 h-3 inline ml-1" />{supplier.deliveryDays} {tc("أيام", "days")}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={e => { e.stopPropagation(); setSelectedSupplier(supplier); setRfqOpen(true); }}>
                      <ShoppingCart className="w-3.5 h-3.5 ml-1" />{tc("طلب عرض سعر", "Request Quote")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); window.location.href = `tel:${supplier.phone}`; }}>
                      <Phone className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* RFQ Dialog */}
          <Dialog open={rfqOpen} onOpenChange={setRfqOpen}>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>{tc("طلب عرض سعر", "Request for Quotation")} — {selectedSupplier ? tc(selectedSupplier.nameAr, selectedSupplier.nameEn) : ''}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>{tc("المنتج المطلوب", "Product Needed")}</Label>
                  <Input placeholder={tc("مثال: بن عربي فاخر", "e.g. Premium Arabic Coffee")} value={rfqForm.product} onChange={e => setRfqForm({...rfqForm, product: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>{tc("الكمية المطلوبة", "Quantity Needed")}</Label>
                  <Input placeholder={tc("مثال: 50 كيلو / شهرياً", "e.g. 50kg / monthly")} value={rfqForm.quantity} onChange={e => setRfqForm({...rfqForm, quantity: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>{tc("ملاحظات إضافية", "Additional Notes")}</Label>
                  <Textarea placeholder={tc("جودة، مواصفات، شروط دفع...", "Quality, specs, payment terms...")} value={rfqForm.notes} onChange={e => setRfqForm({...rfqForm, notes: e.target.value})} rows={3} />
                </div>
                <Button onClick={sendRFQ} className="w-full" disabled={!rfqForm.product || !rfqForm.quantity}>
                  {tc("إرسال طلب العرض", "Send Quote Request")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      </PlanGate>
    );
  }
  