import { useState } from "react";
import { useTranslate, tc } from "@/lib/useTranslate";
import { brand } from "@/lib/brand";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  MessageCircle,
  Ticket,
  HelpCircle,
  Book,
  Search,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Send,
  Paperclip,
  Phone,
  Mail,
  Video,
  ExternalLink,
  ChevronRight,
  Star,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Lightbulb,
  Settings,
  Shield,
  Zap,
  Coffee,
  CreditCard,
  Package,
  Loader2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  category: "technical" | "billing" | "feature" | "general";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  createdAt: Date;
  updatedAt: Date;
  assignee?: string;
  messages: TicketMessage[];
}

interface TicketMessage {
  id: string;
  sender: "user" | "support";
  senderName: string;
  content: string;
  timestamp: Date;
  attachments?: string[];
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  helpful: number;
}

interface Article {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  views: number;
  createdAt: Date;
}

const mockTickets: SupportTicket[] = [
  {
    id: "TKT-001",
    subject: "مشكلة في طباعة الفواتير",
    description: "الفواتير لا تُطبع بشكل صحيح على الطابعة الحرارية",
    category: "technical",
    priority: "high",
    status: "in_progress",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60000),
    updatedAt: new Date(Date.now() - 30 * 60000),
    assignee: "أحمد - فريق الدعم",
    messages: [
      {
        id: "msg-1",
        sender: "user",
        senderName: "محمد",
        content: "الفواتير لا تُطبع بشكل صحيح على الطابعة الحرارية. النص يظهر مقطوعاً.",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60000),
      },
      {
        id: "msg-2",
        sender: "support",
        senderName: "أحمد - فريق الدعم",
        content: "مرحباً محمد، شكراً لتواصلك. هل يمكنك إخبارنا بنوع الطابعة المستخدمة؟",
        timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60000),
      },
      {
        id: "msg-3",
        sender: "user",
        senderName: "محمد",
        content: "الطابعة Epson TM-T20III",
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60000),
      },
    ],
  },
  {
    id: "TKT-002",
    subject: "استفسار عن الفوترة الإلكترونية",
    description: "كيف يمكنني تفعيل فوترة ZATCA؟",
    category: "billing",
    priority: "medium",
    status: "waiting",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60000),
    assignee: "سارة - فريق الدعم",
    messages: [],
  },
  {
    id: "TKT-003",
    subject: "طلب ميزة جديدة - تقارير مخصصة",
    description: "نحتاج إمكانية إنشاء تقارير مخصصة حسب الفترة الزمنية",
    category: "feature",
    priority: "low",
    status: "open",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60000),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60000),
    messages: [],
  },
];

const mockFAQs: FAQItem[] = [
  {
    id: "faq-1",
    question: "كيف أضيف منتج جديد للقائمة؟",
    answer: "اذهب إلى إدارة القائمة > اضغط على إضافة منتج > أدخل تفاصيل المنتج > احفظ",
    category: "المنتجات",
    helpful: 45,
  },
  {
    id: "faq-2",
    question: "كيف أربط تطبيقات التوصيل؟",
    answer: "اذهب إلى التكاملات الخارجية > اختر التطبيق > أدخل مفتاح API > اضغط ربط",
    category: "التكاملات",
    helpful: 38,
  },
  {
    id: "faq-3",
    question: "كيف أعدّ الطابعة الحرارية؟",
    answer: "اذهب إلى الإعدادات > الأجهزة > الطابعات > أضف طابعة جديدة واتبع التعليمات",
    category: "الأجهزة",
    helpful: 32,
  },
  {
    id: "faq-4",
    question: "كيف أنشئ تقرير مبيعات يومي؟",
    answer: "اذهب إلى التقارير > تقرير المبيعات > اختر التاريخ > اضغط إنشاء التقرير",
    category: "التقارير",
    helpful: 28,
  },
  {
    id: "faq-5",
    question: "كيف أضيف موظف جديد؟",
    answer: "اذهب إلى إدارة الموظفين > إضافة موظف > أدخل البيانات > حدد الصلاحيات > احفظ",
    category: "الموظفين",
    helpful: 25,
  },
];

const mockArticles: Article[] = [
  {
    id: "art-1",
    title: "دليل البدء السريع لنظام مكان الشيف البخاري",
    category: "البداية",
    excerpt: "تعرف على كيفية إعداد نظامك في 5 دقائق فقط...",
    views: 1250,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60000),
  },
  {
    id: "art-2",
    title: "إعداد الفوترة الإلكترونية ZATCA",
    category: "الفوترة",
    excerpt: "خطوات تفعيل الفوترة الإلكترونية والامتثال للوائح هيئة الزكاة...",
    views: 980,
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60000),
  },
  {
    id: "art-3",
    title: "ربط تطبيقات التوصيل خطوة بخطوة",
    category: "التكاملات",
    excerpt: "كيفية ربط هنقرستيشن ومرسول وجاهز مع نظامك...",
    views: 850,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60000),
  },
  {
    id: "art-4",
    title: "إدارة المخزون بذكاء",
    category: "المخزون",
    excerpt: "أفضل الممارسات لإدارة مخزون مقهاك وتجنب النفاذ...",
    views: 720,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60000),
  },
];

const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
  technical: { label: tc("تقني", "Technical"), icon: Settings, color: "bg-blue-500" },
  billing: { label: tc("فوترة", "Billing"), icon: CreditCard, color: "bg-green-500" },
  feature: { label: tc("ميزة جديدة", "New Feature"), icon: Lightbulb, color: "bg-purple-500" },
  general: { label: tc("عام", "General"), icon: HelpCircle, color: "bg-gray-500" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: tc("منخفض", "Low"), color: "bg-gray-500" },
  medium: { label: tc("متوسط", "Medium"), color: "bg-primary" },
  high: { label: tc("عالي", "High"), color: "bg-primary" },
  urgent: { label: tc("عاجل", "Urgent"), color: "bg-red-500" },
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: tc("مفتوح", "Open"), color: "bg-blue-500", icon: AlertCircle },
  in_progress: { label: tc("قيد المعالجة", "In Progress"), color: "bg-primary", icon: Clock },
  waiting: { label: tc("بانتظار الرد", "Waiting for Reply"), color: "bg-purple-500", icon: Clock },
  resolved: { label: tc("تم الحل", "Resolved"), color: "bg-green-500", icon: CheckCircle },
  closed: { label: tc("مغلق", "Closed"), color: "bg-gray-500", icon: XCircle },
};

export default function SupportSystemPage() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const { data: businessConfig } = useQuery<any>({ queryKey: ['/api/business-config'] });

  const [activeTab, setActiveTab] = useState("tickets");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false);
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const openTickets = mockTickets.filter(t => t.status !== "resolved" && t.status !== "closed");
  const resolvedTickets = mockTickets.filter(t => t.status === "resolved" || t.status === "closed");

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/manager")}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">{tc("مركز الدعم", "Support Center")}</h1>
              <p className="text-white/60 text-sm">{tc("نحن هنا لمساعدتك على مدار الساعة", "We are here to help you 24/7")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Phone className="w-4 h-4 ml-2" />
              اتصل بنا
            </Button>
            <Button 
              className="bg-primary hover:bg-primary/90"
              onClick={() => setShowNewTicketDialog(true)}
            >
              <Plus className="w-4 h-4 ml-2" />
              تذكرة جديدة
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">{tc("التذاكر المفتوحة", "Open Tickets")}</p>
                  <p className="text-2xl font-bold text-white mt-1">{openTickets.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <Ticket className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">{tc("تم الحل", "Resolved")}</p>
                  <p className="text-2xl font-bold text-white mt-1">{resolvedTickets.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/20">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">{tc("متوسط الرد", "Avg. Response")}</p>
                  <p className="text-2xl font-bold text-white mt-1">{tc("2 ساعة", "2 hours")}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/20">
                  <Clock className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">{tc("رضا العملاء", "Customer Satisfaction")}</p>
                  <p className="text-2xl font-bold text-white mt-1">98%</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/20">
                  <Star className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1">
            <TabsTrigger value="tickets" className="data-[state=active]:bg-primary data-[state=active]:text-black">
              <Ticket className="w-4 h-4 ml-2" />
              التذاكر
            </TabsTrigger>
            <TabsTrigger value="faq" className="data-[state=active]:bg-primary data-[state=active]:text-black">
              <HelpCircle className="w-4 h-4 ml-2" />
              الأسئلة الشائعة
            </TabsTrigger>
            <TabsTrigger value="articles" className="data-[state=active]:bg-primary data-[state=active]:text-black">
              <Book className="w-4 h-4 ml-2" />
              قاعدة المعرفة
            </TabsTrigger>
            <TabsTrigger value="contact" className="data-[state=active]:bg-primary data-[state=active]:text-black">
              <MessageCircle className="w-4 h-4 ml-2" />
              تواصل معنا
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-accent" />
                    تذاكر الدعم
                  </CardTitle>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <Input 
                      placeholder="بحث في التذاكر..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10 bg-white/5 border-white/10 text-white w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/60 text-right">رقم التذكرة</TableHead>
                      <TableHead className="text-white/60 text-right">الموضوع</TableHead>
                      <TableHead className="text-white/60 text-right">الفئة</TableHead>
                      <TableHead className="text-white/60 text-right">الأولوية</TableHead>
                      <TableHead className="text-white/60 text-right">الحالة</TableHead>
                      <TableHead className="text-white/60 text-right">آخر تحديث</TableHead>
                      <TableHead className="text-white/60 text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTickets.map((ticket) => {
                      const category = categoryConfig[ticket.category];
                      const priority = priorityConfig[ticket.priority];
                      const status = statusConfig[ticket.status];
                      const StatusIcon = status.icon;
                      
                      return (
                        <TableRow 
                          key={ticket.id} 
                          className="border-white/10 hover:bg-white/5 cursor-pointer"
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setShowTicketDetails(true);
                          }}
                        >
                          <TableCell className="text-white font-mono">{ticket.id}</TableCell>
                          <TableCell>
                            <div>
                              <p className="text-white font-medium">{ticket.subject}</p>
                              <p className="text-white/40 text-sm truncate max-w-xs">{ticket.description}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${category.color} text-white`}>
                              {category.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${priority.color} text-white`}>
                              {priority.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${status.color} text-white`}>
                              <StatusIcon className="w-3 h-3 ml-1" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white/60">
                            {formatDistanceToNow(ticket.updatedAt, { locale: ar, addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="text-white/60 hover:text-white">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faq" className="space-y-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-accent" />
                  الأسئلة الشائعة
                </CardTitle>
                <CardDescription className="text-white/60">
                  إجابات سريعة على الأسئلة الأكثر شيوعاً
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockFAQs.map((faq) => (
                  <div 
                    key={faq.id} 
                    className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="border-white/20 text-white/60">
                            {faq.category}
                          </Badge>
                        </div>
                        <h4 className="text-white font-medium mb-2">{faq.question}</h4>
                        <p className="text-white/60 text-sm">{faq.answer}</p>
                      </div>
                      <div className="flex items-center gap-2 text-white/40">
                        <ThumbsUp className="w-4 h-4" />
                        <span className="text-sm">{faq.helpful}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="articles" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mockArticles.map((article) => (
                <Card 
                  key={article.id}
                  className="bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <CardContent className="p-6">
                    <Badge variant="outline" className="border-white/20 text-white/60 mb-3">
                      {article.category}
                    </Badge>
                    <h3 className="text-white font-bold text-lg mb-2">{article.title}</h3>
                    <p className="text-white/60 text-sm mb-4">{article.excerpt}</p>
                    <div className="flex items-center justify-between text-white/40 text-sm">
                      <span>{article.views} مشاهدة</span>
                      <span>{format(article.createdAt, "d MMMM yyyy", { locale: ar })}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:bg-blue-500/30 transition-all cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Phone className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">{tc("اتصل بنا", "Contact Us")}</h3>
                  <p className="text-white/60 text-sm mb-4">متاحون على مدار الساعة</p>
                  <p className="text-white font-mono text-lg" dir="ltr">{brand.phoneDisplay}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30 hover:bg-green-500/30 transition-all cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <MessageCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">واتساب</h3>
                  <p className="text-white/60 text-sm mb-4">دردشة فورية مع فريق الدعم</p>
                  <Button className="bg-green-500 hover:bg-green-600">
                    ابدأ المحادثة
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:bg-purple-500/30 transition-all cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Mail className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">البريد الإلكتروني</h3>
                  <p className="text-white/60 text-sm mb-4">رد خلال 24 ساعة</p>
                  <p className="text-white font-mono">support@chefsplace.online</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">أرسل رسالة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">الاسم</Label>
                    <Input 
                      placeholder="اسمك الكامل"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">البريد الإلكتروني</Label>
                    <Input 
                      type="email"
                      placeholder="email@example.com"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white">الموضوع</Label>
                  <Input 
                    placeholder="موضوع الرسالة"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">الرسالة</Label>
                  <Textarea 
                    placeholder="اكتب رسالتك هنا..."
                    className="bg-white/5 border-white/10 text-white min-h-32"
                  />
                </div>
                <Button className="bg-primary hover:bg-primary/90">
                  <Send className="w-4 h-4 ml-2" />
                  إرسال الرسالة
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-accent" />
              تذكرة دعم جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الموضوع</Label>
              <Input 
                placeholder="عنوان موجز للمشكلة"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">تقني</SelectItem>
                    <SelectItem value="billing">فوترة</SelectItem>
                    <SelectItem value="feature">ميزة جديدة</SelectItem>
                    <SelectItem value="general">عام</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الأولوية</Label>
                <Select>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="اختر الأولوية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفضة</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="high">عالية</SelectItem>
                    <SelectItem value="urgent">عاجلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>وصف المشكلة</Label>
              <Textarea 
                placeholder="اشرح المشكلة بالتفصيل..."
                className="bg-white/5 border-white/10 text-white min-h-32"
              />
            </div>
            <div className="space-y-2">
              <Label>المرفقات (اختياري)</Label>
              <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-primary/50 transition-all cursor-pointer">
                <Paperclip className="w-8 h-8 text-white/40 mx-auto mb-2" />
                <p className="text-white/60 text-sm">اسحب الملفات هنا أو انقر للرفع</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowNewTicketDialog(false)}
              className="border-white/20 text-white"
            >
              إلغاء
            </Button>
            <Button className="bg-primary">
              <Ticket className="w-4 h-4 ml-2" />
              إنشاء التذكرة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTicketDetails} onOpenChange={setShowTicketDetails}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-accent" />
                {selectedTicket?.id}
              </span>
              {selectedTicket && (
                <Badge className={`${statusConfig[selectedTicket.status].color} text-white`}>
                  {statusConfig[selectedTicket.status].label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-white font-bold text-lg">{selectedTicket.subject}</h3>
                <p className="text-white/60">{selectedTicket.description}</p>
                <div className="flex items-center gap-4 text-white/40 text-sm">
                  <span>أُنشئت {formatDistanceToNow(selectedTicket.createdAt, { locale: ar, addSuffix: true })}</span>
                  {selectedTicket.assignee && (
                    <span>• {selectedTicket.assignee}</span>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-white font-medium">المحادثة</h4>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedTicket.messages.map((message) => (
                    <div 
                      key={message.id}
                      className={`p-4 rounded-lg ${
                        message.sender === "user" 
                          ? "bg-white/5 mr-8" 
                          : "bg-primary/10 ml-8 border border-primary/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          message.sender === "user" ? "bg-white/10" : "bg-primary/20"
                        }`}>
                          <User className="w-4 h-4 text-white/60" />
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{message.senderName}</p>
                          <p className="text-white/40 text-xs">
                            {format(message.timestamp, "d MMM, hh:mm a", { locale: ar })}
                          </p>
                        </div>
                      </div>
                      <p className="text-white/80 text-sm pr-10">{message.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Input 
                  placeholder="اكتب ردك..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="bg-white/5 border-white/10 text-white flex-1"
                />
                <Button className="bg-primary">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
