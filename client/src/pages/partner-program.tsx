import { useState } from "react";
import { PlanGate } from "@/components/plan-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import {
  Users, Award, TrendingUp, DollarSign, ArrowLeft, Copy,
  CheckCircle, Globe, Handshake, HeartHandshake, BarChart3,
  Search, Star, Filter, Building2, Zap, Shield, Layers
} from "lucide-react";
import {
  TECH_PARTNERS, PARTNER_CATEGORIES, getFeaturedPartners, getKsaPartners,
  type PartnerCategory, type TechPartner
} from "@/lib/tech-partners";

const TIERS = [
  { id: 'silver', nameAr: 'فضي', nameEn: 'Silver', minClients: 1, commission: 15, color: 'from-slate-400 to-slate-500', benefits: ['15% عمولة شهرية', 'دعم فني مخصص', 'لوحة تحكم شريك'] },
  { id: 'gold', nameAr: 'ذهبي', nameEn: 'Gold', minClients: 5, commission: 20, color: 'from-yellow-400 to-amber-500', benefits: ['20% عمولة شهرية', 'مدير حساب مخصص', 'تدريب مجاني', 'مواد تسويقية'] },
  { id: 'platinum', nameAr: 'بلاتيني', nameEn: 'Platinum', minClients: 15, commission: 25, color: 'from-cyan-400 to-blue-500', benefits: ['25% عمولة شهرية', 'أولوية في الدعم', 'شعار في موقعنا', 'أسعار خاصة للعملاء'] },
  { id: 'diamond', nameAr: 'ماسي', nameEn: 'Diamond', minClients: 30, commission: 30, color: 'from-purple-400 to-pink-500', benefits: ['30% عمولة شهرية', 'حصرية منطقة جغرافية', 'مشاركة في الإيرادات', 'وصول beta للميزات'] },
];

const MOCK_PARTNERS = [
  { nameAr: 'تك سولوشنز للحلول', nameEn: 'Tech Solutions LLC', clients: 12, revenue: 8400, tier: 'gold', city: 'الرياض' },
  { nameAr: 'سمارت ريتيل', nameEn: 'Smart Retail Co.', clients: 28, revenue: 19600, tier: 'platinum', city: 'جدة' },
  { nameAr: 'مطعم برو للاستشارات', nameEn: 'Cafe Pro Consulting', clients: 6, revenue: 4200, tier: 'gold', city: 'الدمام' },
  { nameAr: 'ديجيتال بيزنس', nameEn: 'Digital Business Co.', clients: 32, revenue: 22400, tier: 'diamond', city: 'أبوظبي' },
  { nameAr: 'نيكست لفل سيستمز', nameEn: 'Next Level Systems', clients: 9, revenue: 6300, tier: 'gold', city: 'المدينة' },
];

const REFERRAL_CODE = 'BR-' + Math.random().toString(36).toUpperCase().slice(2, 8);

const CAT_COLORS: Record<PartnerCategory, string> = {
  payment:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  delivery:        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  accounting:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  erp:             'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  government:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  cloud:           'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  hardware:        'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300',
  loyalty:         'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  communication:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  analytics:       'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  food_aggregator: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  marketplace:     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  hr:              'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  security:        'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300',
  reservation:     'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
};

const REGION_LABELS = { ksa: '🇸🇦 السعودية', gcc: '🌍 الخليج', global: '🌐 عالمي' };

function PartnerLogo({ partner }: { partner: TechPartner }) {
  const initials = partner.nameEn.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm"
      style={{ background: partner.color }}
    >
      {initials}
    </div>
  );
}

function PartnerCard({ partner }: { partner: TechPartner }) {
  const tc = useTranslate();
  const catInfo = PARTNER_CATEGORIES[partner.category];
  return (
    <Card className="border hover:border-primary/40 hover:shadow-md transition-all group" data-testid={`partner-card-${partner.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <PartnerLogo partner={partner} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">{partner.nameAr}</span>
              {partner.featured && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-400" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{partner.descriptionAr}</p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <Badge className={`text-[10px] px-1.5 border-0 ${CAT_COLORS[partner.category]}`}>
                {catInfo.icon} {catInfo.nameAr}
              </Badge>
              <Badge className="text-[10px] px-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
                <CheckCircle className="w-2.5 h-2.5 ml-0.5" />
                {partner.badgeAr}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{REGION_LABELS[partner.region || 'global']}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PartnerProgramPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [applyOpen, setApplyOpen] = useState(false);
  const [form, setForm] = useState({ companyAr: '', companyEn: '', phone: '', email: '', city: '', experience: '', website: '' });
  const [copied, setCopied] = useState(false);
  const [searchPartner, setSearchPartner] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterFeatured, setFilterFeatured] = useState(false);

  const myTier = TIERS[1];
  const myClients = 7;
  const myRevenue = 4900;
  const nextTier = TIERS[2];
  const progressToNext = Math.min((myClients / nextTier.minClients) * 100, 100);

  const tierColors: Record<string, string> = { silver: 'text-slate-400', gold: 'text-yellow-500', platinum: 'text-cyan-500', diamond: 'text-purple-500' };
  const tierBadgeColors: Record<string, string> = {
    silver: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    gold: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    platinum: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
    diamond: 'bg-purple-500/20 text-purple-500 border-purple-500/30'
  };

  const copyCode = () => {
    navigator.clipboard.writeText(REFERRAL_CODE).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: tc('تم نسخ الكود', 'Code Copied!') });
  };

  const filteredPartners = TECH_PARTNERS.filter(p => {
    if (filterCat !== 'all' && p.category !== filterCat) return false;
    if (filterRegion !== 'all' && p.region !== filterRegion) return false;
    if (filterFeatured && !p.featured) return false;
    if (searchPartner) {
      const q = searchPartner.toLowerCase();
      return p.nameEn.toLowerCase().includes(q) || p.nameAr.includes(q) || p.descriptionAr.includes(q);
    }
    return true;
  });

  const categories = Object.keys(PARTNER_CATEGORIES) as PartnerCategory[];
  const byCategory: Record<string, TechPartner[]> = {};
  filteredPartners.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });

  const featured = getFeaturedPartners();
  const ksaPartners = getKsaPartners();
  const totalPartners = TECH_PARTNERS.length;
  const totalCategories = new Set(TECH_PARTNERS.map(p => p.category)).size;

  return (
    <PlanGate feature="partnerProgram">
      <div className="min-h-screen bg-background" dir="rtl">
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/manager/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Handshake className="w-7 h-7 text-primary" />
                {tc('الشركاء والتكاملات', 'Partners & Integrations')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {tc('شركاء الموزعين + 80+ تكامل تقني متوافق 100%', 'Reseller partners + 80+ technology integrations')}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <p className="text-3xl font-black text-primary">{totalPartners}+</p>
              <p className="text-xs text-muted-foreground">{tc('شريك تقني', 'Tech Partners')}</p>
            </Card>
            <Card className="p-4 text-center bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-200 dark:border-green-800">
              <p className="text-3xl font-black text-green-600">{totalCategories}</p>
              <p className="text-xs text-muted-foreground">{tc('تصنيف', 'Categories')}</p>
            </Card>
            <Card className="p-4 text-center bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-200 dark:border-emerald-800">
              <p className="text-3xl font-black text-emerald-600">{ksaPartners.length}</p>
              <p className="text-xs text-muted-foreground">🇸🇦 {tc('شريك سعودي', 'Saudi Partners')}</p>
            </Card>
            <Card className="p-4 text-center bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-200 dark:border-blue-800">
              <p className="text-3xl font-black text-blue-600">100%</p>
              <p className="text-xs text-muted-foreground">{tc('نسبة التوافق', 'Compatibility')}</p>
            </Card>
          </div>

          <Tabs defaultValue="integrations">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="integrations" data-testid="tab-integrations">
                <Layers className="w-4 h-4 ml-1" />{tc('التكاملات', 'Integrations')}
              </TabsTrigger>
              <TabsTrigger value="dashboard" data-testid="tab-dashboard">
                <BarChart3 className="w-4 h-4 ml-1" />{tc('لوحتي', 'My Dashboard')}
              </TabsTrigger>
              <TabsTrigger value="tiers" data-testid="tab-tiers">
                <Award className="w-4 h-4 ml-1" />{tc('مستويات', 'Tiers')}
              </TabsTrigger>
              <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">
                <TrendingUp className="w-4 h-4 ml-1" />{tc('المتصدرون', 'Top Partners')}
              </TabsTrigger>
            </TabsList>

            {/* ═══════════════ INTEGRATIONS TAB ═══════════════ */}
            <TabsContent value="integrations" className="space-y-5">

              {/* Search & Filter */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pr-10"
                      placeholder={tc('ابحث عن شريك أو تكامل...', 'Search partner or integration...')}
                      value={searchPartner}
                      onChange={e => setSearchPartner(e.target.value)}
                      data-testid="input-search-partners"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select
                      className="h-8 px-3 text-xs border rounded-md bg-background"
                      value={filterCat}
                      onChange={e => setFilterCat(e.target.value)}
                      data-testid="select-filter-category"
                    >
                      <option value="all">{tc('كل الفئات', 'All Categories')}</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{PARTNER_CATEGORIES[cat].icon} {PARTNER_CATEGORIES[cat].nameAr}</option>
                      ))}
                    </select>
                    <select
                      className="h-8 px-3 text-xs border rounded-md bg-background"
                      value={filterRegion}
                      onChange={e => setFilterRegion(e.target.value)}
                      data-testid="select-filter-region"
                    >
                      <option value="all">{tc('كل المناطق', 'All Regions')}</option>
                      <option value="ksa">🇸🇦 {tc('السعودية', 'Saudi Arabia')}</option>
                      <option value="gcc">🌍 {tc('الخليج', 'GCC')}</option>
                      <option value="global">🌐 {tc('عالمي', 'Global')}</option>
                    </select>
                    <Button
                      variant={filterFeatured ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => setFilterFeatured(!filterFeatured)}
                      data-testid="btn-filter-featured"
                    >
                      <Star className="w-3 h-3" /> {tc('المميزون', 'Featured')}
                    </Button>
                    {(searchPartner || filterCat !== 'all' || filterRegion !== 'all' || filterFeatured) && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearchPartner(''); setFilterCat('all'); setFilterRegion('all'); setFilterFeatured(false); }}>
                        <Filter className="w-3 h-3 ml-1" /> {tc('مسح', 'Clear')}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tc('يعرض', 'Showing')} <span className="font-bold text-foreground">{filteredPartners.length}</span> {tc('من', 'of')} {totalPartners} {tc('شريك', 'partners')}
                  </p>
                </CardContent>
              </Card>

              {/* Featured Section */}
              {!searchPartner && filterCat === 'all' && !filterFeatured && (
                <Card className="border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50/50 to-transparent dark:from-yellow-950/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-400" />
                      {tc('الشركاء المميزون', 'Featured Partners')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {featured.map(p => <PartnerCard key={p.id} partner={p} />)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Grouped by Category */}
              {Object.entries(byCategory).map(([cat, partners]) => {
                const catInfo = PARTNER_CATEGORIES[cat as PartnerCategory];
                return (
                  <div key={cat} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{catInfo.icon}</span>
                      <h3 className="font-bold">{catInfo.nameAr}</h3>
                      <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                        {partners.length} {tc('شريك', 'partners')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {partners.map(p => <PartnerCard key={p.id} partner={p} />)}
                    </div>
                  </div>
                );
              })}

              {filteredPartners.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>{tc('لا توجد نتائج', 'No results found')}</p>
                </div>
              )}

              {/* Compatibility Banner */}
              <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/10">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-green-800 dark:text-green-300">{tc('ضمان التوافق 100%', '100% Compatibility Guarantee')}</h3>
                      <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                        {tc('جميع الشركاء المدرجين تم اختبارهم والتحقق منهم بالكامل. مكان الشيف البخاري متوافق مع جميع هذه الأنظمة ويضمن تكاملاً سلساً دون أي انقطاع في الخدمة.', 'All listed partners are fully tested and verified. مكان الشيف البخاري is compatible with all these systems and guarantees seamless integration.')}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {['ZATCA معتمد ✅', 'PCI DSS Compliant', 'SSL 256-bit', 'API RESTful', 'Real-time Sync'].map(tag => (
                          <Badge key={tag} className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══════════════ DASHBOARD TAB ═══════════════ */}
            <TabsContent value="dashboard" className="space-y-4">
              <Card className={`bg-gradient-to-r ${myTier.color} text-white`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-80">{tc('مستواك الحالي', 'Your Current Tier')}</p>
                      <h2 className="text-3xl font-black mt-1">{tc(myTier.nameAr, myTier.nameEn)}</h2>
                      <p className="text-sm opacity-80 mt-1">{myTier.commission}% {tc('عمولة شهرية', 'monthly commission')}</p>
                    </div>
                    <Award className="w-16 h-16 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4 text-center">
                  <Users className="w-6 h-6 mx-auto mb-1 text-primary" />
                  <p className="text-2xl font-black">{myClients}</p>
                  <p className="text-[11px] text-muted-foreground">{tc('عميل نشط', 'Active Clients')}</p>
                </Card>
                <Card className="p-4 text-center">
                  <DollarSign className="w-6 h-6 mx-auto mb-1 text-green-500" />
                  <p className="text-2xl font-black">{myRevenue.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">{tc('ريال عمولة', 'SAR Commission')}</p>
                </Card>
                <Card className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                  <p className="text-2xl font-black">+23%</p>
                  <p className="text-[11px] text-muted-foreground">{tc('نمو شهري', 'Monthly Growth')}</p>
                </Card>
              </div>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">{tc('التقدم نحو مستوى', 'Progress to')} {tc(nextTier.nameAr, nextTier.nameEn)}</p>
                    <Badge className={`${tierBadgeColors[nextTier.id]} border text-xs`}>{tc(nextTier.nameAr, nextTier.nameEn)}</Badge>
                  </div>
                  <Progress value={progressToNext} className="h-3" />
                  <p className="text-xs text-muted-foreground">{myClients}/{nextTier.minClients} {tc('عميل — تحتاج', 'clients — need')} {nextTier.minClients - myClients} {tc('عملاء أكثر', 'more clients')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">{tc('كود الإحالة الخاص بك', 'Your Referral Code')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <code className="flex-1 font-mono text-lg font-black text-primary">{REFERRAL_CODE}</code>
                    <Button size="sm" variant="outline" onClick={copyCode} data-testid="btn-copy-referral">
                      {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{tc('شارك الكود مع عملائك ليحصلوا على خصم 10% واكسب عمولتك', 'Share this code for 10% client discount and earn your commission')}</p>
                </CardContent>
              </Card>

              <Button size="lg" className="w-full" onClick={() => setApplyOpen(true)} data-testid="btn-apply-partner">
                <HeartHandshake className="w-5 h-5 ml-2" />{tc('التقديم كشريك جديد', 'Apply as New Partner')}
              </Button>
            </TabsContent>

            {/* ═══════════════ TIERS TAB ═══════════════ */}
            <TabsContent value="tiers" className="space-y-3">
              {TIERS.map(tier => (
                <Card key={tier.id} className={`border-2 ${myTier.id === tier.id ? 'border-primary' : 'border-transparent'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Award className={`w-6 h-6 ${tierColors[tier.id]}`} />
                        <div>
                          <p className="font-bold">{tc(tier.nameAr, tier.nameEn)}</p>
                          <p className="text-xs text-muted-foreground">{tier.minClients}+ {tc('عملاء', 'clients')}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-2xl font-black text-primary">{tier.commission}%</p>
                        <p className="text-xs text-muted-foreground">{tc('عمولة', 'commission')}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {tier.benefits.map(b => (
                        <div key={b} className="flex items-center gap-2 text-sm"><CheckCircle className="w-3.5 h-3.5 text-green-500" />{b}</div>
                      ))}
                    </div>
                    {myTier.id === tier.id && <Badge className="mt-3 bg-primary/20 text-primary border-primary/30 border">{tc('مستواك الحالي', 'Your Current Tier')}</Badge>}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* ═══════════════ LEADERBOARD TAB ═══════════════ */}
            <TabsContent value="leaderboard" className="space-y-3">
              <Card>
                <CardHeader><CardTitle className="text-sm">{tc('أفضل الشركاء هذا الشهر', 'Top Partners This Month')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {MOCK_PARTNERS.sort((a, b) => b.clients - a.clients).map((p, i) => (
                    <div key={p.nameEn} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50" data-testid={`partner-row-${i}`}>
                      <span className={`text-2xl font-black w-8 text-center ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        #{i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{tc(p.nameAr, p.nameEn)}</p>
                        <p className="text-xs text-muted-foreground">{p.city} · {p.clients} {tc('عملاء', 'clients')}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-green-500">{p.revenue.toLocaleString()} {tc('ريال', 'SAR')}</p>
                        <Badge className={`${tierBadgeColors[p.tier]} border text-[10px]`}>
                          {tc(TIERS.find(t => t.id === p.tier)?.nameAr || '', TIERS.find(t => t.id === p.tier)?.nameEn || '')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Apply Dialog */}
          <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
            <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{tc('طلب الانضمام لبرنامج الشركاء', 'Partner Program Application')}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {[
                  { key: 'companyAr', labelAr: 'اسم الشركة (عربي)', labelEn: 'Company Name (Arabic)' },
                  { key: 'companyEn', labelAr: 'اسم الشركة (إنجليزي)', labelEn: 'Company Name (English)' },
                  { key: 'phone', labelAr: 'رقم الجوال', labelEn: 'Phone Number' },
                  { key: 'email', labelAr: 'البريد الإلكتروني', labelEn: 'Email Address' },
                  { key: 'city', labelAr: 'المدينة', labelEn: 'City' },
                  { key: 'website', labelAr: 'الموقع الإلكتروني (اختياري)', labelEn: 'Website (Optional)' },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label>{tc(f.labelAr, f.labelEn)}</Label>
                    <Input value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} data-testid={`input-apply-${f.key}`} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label>{tc('خبرتك في قطاع المطاعم', 'Experience in restaurant sector')}</Label>
                  <Textarea placeholder={tc('اذكر خبرتك وعدد العملاء المتوقعين...', 'Describe your experience...')} value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} rows={3} data-testid="textarea-apply-experience" />
                </div>
                <Button onClick={() => { toast({ title: tc('✅ تم استلام طلبك', '✅ Application Received'), description: tc('سنتواصل معك خلال 24 ساعة', "We'll contact you within 24 hours") }); setApplyOpen(false); }} className="w-full" disabled={!form.companyAr || !form.phone || !form.email} data-testid="btn-submit-application">
                  {tc('إرسال الطلب', 'Submit Application')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </PlanGate>
  );
}
