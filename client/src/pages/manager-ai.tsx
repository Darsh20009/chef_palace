import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTranslate } from "@/lib/useTranslate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles, Send, RefreshCw, Bot, User, Loader2, Brain,
  TrendingUp, Star, Lightbulb, BarChart3, ShoppingBag,
  Users, Clock, ChevronDown, ChevronUp, Zap, MessageSquare,
  Target, Coffee, ArrowLeft, Trash2, Mic, MicOff, Image, X,
  Download, Copy, Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUrl?: string;
  imagePrompt?: string;
}

interface Insight {
  icon: string;
  title: string;
  insight: string;
}

const QUICK_PROMPTS = [
  { icon: "📊", labelAr: "حلل مبيعات اليوم",   labelEn: "Analyze today's sales",   promptAr: "حلل مبيعات اليوم وأعطني ملاحظات وتوصيات", promptEn: "Analyze today's sales and give me insights and recommendations" },
  { icon: "★",  labelAr: "أفضل المنتجات",       labelEn: "Top products",             promptAr: "ما هي أكثر المنتجات مبيعاً هذا الأسبوع وما توصيتك بشأنها؟", promptEn: "What are the best-selling products this week and what do you recommend?" },
  { icon: "◈",  labelAr: "اقتراح عروض",         labelEn: "Suggest promotions",       promptAr: "اقترح عروضاً ترويجية مناسبة للأسبوع القادم بناءً على بيانات المبيعات", promptEn: "Suggest suitable promotions for next week based on sales data" },
  { icon: "📈", labelAr: "تحسين الأرباح",       labelEn: "Improve profits",          promptAr: "كيف يمكنني تحسين أرباح الكافيه؟ أعطني خطة عملية", promptEn: "How can I improve the cafe's profits? Give me a practical plan" },
  { icon: "🕐", labelAr: "أوقات الذروة",        labelEn: "Peak hours",               promptAr: "ما هي أوقات الذروة وكيف أستثمرها بشكل أفضل؟", promptEn: "What are the peak hours and how can I best leverage them?" },
  { icon: "👥", labelAr: "إدارة الموظفين",      labelEn: "Staff management",         promptAr: "أعطني نصائح لتحسين إنتاجية الموظفين في الكافيه", promptEn: "Give me tips to improve staff productivity in the cafe" },
  { icon: "🍵", labelAr: "منتجات جديدة",        labelEn: "New products",             promptAr: "اقترح منتجات جديدة أو موسمية يمكن إضافتها للمنيو", promptEn: "Suggest new or seasonal products that can be added to the menu" },
  { icon: "📉", labelAr: "تقليل التكاليف",      labelEn: "Reduce costs",             promptAr: "كيف يمكنني تقليل تكاليف التشغيل دون التأثير على الجودة؟", promptEn: "How can I reduce operating costs without affecting quality?" },
];

const IMAGE_QUICK_PROMPTS = [
  { ar: "صورة أرز بخاري ذهبي بالبخار فوقه",  en: "golden steaming bukhari rice, professional food photography" },
  { ar: "صورة مطعم عربي فاخر ودافئ",         en: "luxury warm Arabic restaurant interior, elegant ambiance" },
  { ar: "صورة لحم مشوي بالبهارات",            en: "grilled spiced lamb, Middle Eastern cuisine, studio lighting" },
  { ar: "شعار مطعم بخاري احترافي",            en: "professional bukhari restaurant logo, gold and brown colors" },
];

function formatContent(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s(.+)$/gm, '<div class="font-bold text-primary mt-3 mb-1 text-sm">$1</div>')
    .replace(/^[-•]\s(.+)$/gm, '<div class="flex gap-2 items-start mt-1"><span class="text-primary mt-0.5 shrink-0">•</span><span>$1</span></div>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>');
}

function buildImageUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=768&height=512&nologo=true&enhance=true&seed=${Math.floor(Math.random() * 999999)}`;
}

export default function ManagerAI() {
  const [, setLocation] = useLocation();
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const { toast } = useToast();
  const isAr = i18n.language !== 'en';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showInsights, setShowInsights] = useState(true);
  const [isImageMode, setIsImageMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { data: insightsData, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ["/api/ai/insights"],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await apiRequest("POST", "/api/ai/chat", { message, history });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply || tc("عذراً، لم أتمكن من الإجابة.", "Sorry, I couldn't generate a response."),
        timestamp: new Date(),
      }]);
    },
    onError: (error: any) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `❌ ${error?.message || tc("حدث خطأ في الاتصال بالذكاء الاصطناعي.", "An error occurred connecting to AI.")}`,
        timestamp: new Date(),
      }]);
    },
  });

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || chatMutation.isPending || generatingImage) return;
    setInput("");

    if (isImageMode) {
      setMessages(prev => [...prev, { role: "user", content: `🖼️ ${msg}`, timestamp: new Date() }]);
      setGeneratingImage(true);

      let englishPrompt = msg;
      try {
        if (/[\u0600-\u06FF]/.test(msg)) {
          const res = await apiRequest("POST", "/api/ai/chat", {
            message: `Translate this Arabic image description to English for an AI image generator (return only the English prompt, no explanation): "${msg}"`,
            history: [],
          });
          const data = await res.json();
          const translated = data.reply?.trim();
          if (translated && translated.length > 3) englishPrompt = translated;
        }
      } catch {}

      const imageUrl = buildImageUrl(englishPrompt + ", high quality, professional photography, 8k");
      const loadingMsg: Message = {
        role: "assistant",
        content: tc("جارٍ توليد الصورة…", "Generating image…"),
        timestamp: new Date(),
        imageUrl: undefined,
        imagePrompt: englishPrompt,
      };
      setMessages(prev => [...prev, loadingMsg]);

      const img = new window.Image();
      img.onload = () => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant" && last.imagePrompt === englishPrompt) {
            updated[updated.length - 1] = {
              ...last,
              content: tc("تم توليد الصورة ✅", "Image generated ✅"),
              imageUrl,
            };
          }
          return updated;
        });
        setGeneratingImage(false);
      };
      img.onerror = () => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant" && last.imagePrompt === englishPrompt) {
            updated[updated.length - 1] = {
              ...last,
              content: tc("❌ فشل توليد الصورة. حاول مرة أخرى.", "❌ Failed to generate image. Try again."),
            };
          }
          return updated;
        });
        setGeneratingImage(false);
      };
      img.src = imageUrl;
    } else {
      setMessages(prev => [...prev, { role: "user", content: msg, timestamp: new Date() }]);
      chatMutation.mutate(msg);
    }
  }, [input, isImageMode, chatMutation, generatingImage, tc]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: tc("المتصفح لا يدعم التسجيل الصوتي", "Browser doesn't support voice input"), variant: "destructive" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = isAr ? "ar-SA" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t + " ";
        else interim = t;
      }
      setInput(finalTranscript + interim);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
  }, [isAr, toast, tc]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleMicClick = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleDownloadImage = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated-image.jpg";
    a.target = "_blank";
    a.click();
  };

  const insights: Insight[] = (insightsData as any)?.insights || [];
  const stats = (insightsData as any)?.stats;
  const hasApiError = (insightsData as any)?.error?.includes("KIMI_API_KEY") || (insightsData as any)?.configured === false;
  const isBusy = chatMutation.isPending || generatingImage;

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/manager/dashboard')} data-testid="btn-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20 shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground leading-none">{tc('مركز الذكاء الاصطناعي', 'AI Center')}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">{tc('مدعوم بـ', 'Powered by')} Kimi K2 + Gemini · Pollinations AI</span>
              </div>
            </div>
          </div>
          <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-0 gap-1">
            <Sparkles className="w-3 h-3" />
            AI
          </Badge>
        </div>

        {/* API Key Warning */}
        {!insightsLoading && hasApiError && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400 text-sm">{tc('مفتاح API غير مضبوط', 'API Key Not Configured')}</p>
                <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                  {tc('لتفعيل الذكاء الاصطناعي، تأكد من ضبط مفتاح', 'To activate AI, make sure the key')}{" "}
                  <code className="bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300 font-mono text-[11px]">KIMI_API_KEY</code>{" "}
                  {tc('أو', 'or')}{" "}
                  <code className="bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300 font-mono text-[11px]">GEMINI_API_KEY</code>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Strip */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { labelAr: "مبيعات اليوم",   labelEn: "Today's Sales",    value: `${(stats.todayRevenue || 0).toFixed(0)} ر.س`, icon: TrendingUp, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
              { labelAr: "طلبات اليوم",    labelEn: "Today's Orders",   value: stats.todayOrders || 0, icon: ShoppingBag, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
              { labelAr: "مبيعات الأسبوع", labelEn: "Weekly Sales",     value: `${(stats.weekRevenue || 0).toFixed(0)} ر.س`, icon: BarChart3, color: "text-violet-600 bg-violet-100 dark:bg-violet-900/30" },
              { labelAr: "نمو الأسبوع",    labelEn: "Weekly Growth",    value: stats.growthPct ? `${stats.growthPct}%` : "—", icon: Target, color: stats.growthPct > 0 ? "text-green-600 bg-green-100 dark:bg-green-900/30" : "text-red-600 bg-red-100 dark:bg-red-900/30" },
            ].map((stat, i) => (
              <Card key={i} className="border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{stat.value}</p>
                    <p className="text-muted-foreground text-[11px]">{isAr ? stat.labelAr : stat.labelEn}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* AI Insights */}
        {(insightsLoading || insights.length > 0) && (
          <Card className="border">
            <button
              onClick={() => setShowInsights(v => !v)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-foreground">{tc('رؤى الذكاء الاصطناعي', 'AI Insights')}</span>
                <Badge variant="secondary" className="text-[10px] h-5">{tc('محدث تلقائياً', 'Auto-updated')}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); refetchInsights(); }} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted" data-testid="btn-refresh-insights">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                {showInsights ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>
            {showInsights && (
              <CardContent className="pt-0 pb-4">
                <Separator className="mb-4" />
                {insightsLoading ? (
                  <div className="flex items-center gap-3 py-6 justify-center">
                    <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                    <span className="text-muted-foreground text-sm">{tc('يولد الذكاء الاصطناعي رؤى لكافيهك...', 'AI is generating insights for your cafe...')}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border/60">
                        <span className="text-xl shrink-0">{insight.icon}</span>
                        <div>
                          <p className="text-foreground text-sm font-semibold">{insight.title}</p>
                          <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{insight.insight}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* Chat Area */}
        <Card className="border flex flex-col overflow-hidden">
          {/* Chat Header — mode switcher */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              {/* Mode toggle pills */}
              <button
                onClick={() => setIsImageMode(false)}
                data-testid="btn-mode-chat"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  !isImageMode
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {tc('محادثة', 'Chat')}
              </button>
              <button
                onClick={() => setIsImageMode(true)}
                data-testid="btn-mode-image"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isImageMode
                    ? "bg-pink-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Image className="w-3.5 h-3.5" />
                {tc('توليد صور', 'Generate Images')}
              </button>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="text-muted-foreground hover:text-destructive text-xs h-7 gap-1" data-testid="btn-clear-chat">
                <Trash2 className="w-3 h-3" />
                {tc('مسح', 'Clear')}
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 320, maxHeight: 460 }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isImageMode ? "bg-pink-100 dark:bg-pink-900/30" : "bg-violet-100 dark:bg-violet-900/30"}`}>
                  {isImageMode ? <Image className="w-8 h-8 text-pink-500" /> : <Coffee className="w-8 h-8 text-violet-500" />}
                </div>
                <p className="font-semibold text-foreground mb-1">
                  {isImageMode
                    ? tc('صف الصورة التي تريدها…', 'Describe the image you want…')
                    : tc('أهلاً، كيف يمكنني مساعدتك؟', 'Hello, how can I help you?')}
                </p>
                <p className="text-muted-foreground text-sm max-w-sm">
                  {isImageMode
                    ? tc('يمكنك الكتابة بالعربي أو الإنجليزي — سيُحوّل تلقائياً ويُولّد الصورة', 'You can type in Arabic or English — it will be auto-translated and the image generated')
                    : tc('اسألني عن مبيعاتك، موظفيك، منيوك، أو اطلب مني تحليل أداء كافيهك', 'Ask me about your sales, staff, menu, or request a performance analysis')}
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === "user"
                      ? "bg-primary/10 border border-primary/20"
                      : isImageMode ? "bg-pink-100 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-700" : "bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700"
                  }`}>
                    {msg.role === "user"
                      ? <User className="w-4 h-4 text-primary" />
                      : isImageMode ? <Image className="w-4 h-4 text-pink-500" /> : <Bot className="w-4 h-4 text-violet-500" />}
                  </div>
                  <div className={`max-w-[82%] flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    {/* Image bubble */}
                    {msg.imageUrl ? (
                      <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
                        <img
                          src={msg.imageUrl}
                          alt={msg.imagePrompt || "generated"}
                          className="max-w-[320px] w-full object-cover"
                          loading="lazy"
                        />
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/70 border-t border-border">
                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{msg.imagePrompt}</span>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => handleCopy(msg.imageUrl!, i)} className="p-1 hover:bg-background rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                              {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => handleDownloadImage(msg.imageUrl!)} className="p-1 hover:bg-background rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed group relative ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tl-sm"
                          : "bg-muted border border-border text-foreground rounded-tr-sm"
                      }`}>
                        {msg.role === "assistant" ? (
                          <>
                            {msg.content.includes("جارٍ توليد") || msg.content.includes("Generating") ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
                                <span>{msg.content}</span>
                              </div>
                            ) : (
                              <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                            )}
                            <button
                              onClick={() => handleCopy(msg.content, i)}
                              className="absolute -bottom-5 left-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            >
                              {copiedIdx === i ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </>
                        ) : msg.content}
                      </div>
                    )}
                    <p className="text-muted-foreground text-[10px] mt-1 px-1">
                      {msg.timestamp.toLocaleTimeString(isAr ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}

            {chatMutation.isPending && !isImageMode && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-violet-500" />
                </div>
                <div className="bg-muted border border-border rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="text-muted-foreground text-xs mr-1">{tc('يفكر...', 'Thinking...')}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts — shown only when no messages */}
          {messages.length === 0 && (
            <div className={`px-4 pb-3 border-t border-border bg-muted/20`}>
              <p className="text-muted-foreground text-xs mb-2 pt-3">
                {isImageMode ? tc('أمثلة للصور:', 'Image examples:') : tc('اختر سؤالاً سريعاً:', 'Choose a quick question:')}
              </p>
              {isImageMode ? (
                <div className="grid grid-cols-2 gap-2">
                  {IMAGE_QUICK_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(isAr ? p.ar : p.en)}
                      disabled={isBusy}
                      className={`flex items-center gap-1.5 px-3 py-2 bg-background hover:bg-pink-50 dark:hover:bg-pink-900/20 border border-border hover:border-pink-300 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-all ${isAr ? 'text-right' : 'text-left'} disabled:opacity-50`}
                      data-testid={`img-prompt-${i}`}
                    >
                      <Image className="w-3.5 h-3.5 shrink-0 text-pink-400" />
                      <span className="line-clamp-1">{isAr ? p.ar : p.en}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {QUICK_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(isAr ? p.promptAr : p.promptEn)}
                      disabled={isBusy}
                      className={`flex items-center gap-1.5 px-3 py-2 bg-background hover:bg-muted border border-border hover:border-primary/30 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-all ${isAr ? 'text-right' : 'text-left'} disabled:opacity-50`}
                      data-testid={`quick-prompt-${i}`}
                    >
                      <span className="shrink-0">{p.icon}</span>
                      <span className="line-clamp-1">{isAr ? p.labelAr : p.labelEn}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Input area */}
          <div className="px-4 pb-4 pt-3 border-t border-border">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isImageMode
                    ? tc('صف الصورة المطلوبة… (مثال: أرز بخاري ذهبي شهي)', 'Describe the image… (e.g., golden steaming bukhari rice)')
                    : isRecording
                    ? tc('🔴 يستمع… تكلم الآن', '🔴 Listening… speak now')
                    : tc('اسألني أي شيء عن كافيهك… (Enter للإرسال)', 'Ask me anything about your cafe…')
                }
                className={`resize-none text-sm min-h-[44px] max-h-[120px] transition-all ${isRecording ? "border-red-400 ring-1 ring-red-300" : ""}`}
                rows={1}
                disabled={isBusy}
                data-testid="input-ai-message"
                dir="auto"
              />

              {/* Mic button */}
              <Button
                type="button"
                onClick={handleMicClick}
                size="icon"
                disabled={isBusy && !isRecording}
                data-testid="btn-mic"
                className={`h-11 w-11 shrink-0 rounded-xl transition-all ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 animate-pulse"
                    : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}
                title={isRecording ? tc("إيقاف التسجيل", "Stop recording") : tc("تسجيل صوتي", "Voice input")}
              >
                {isRecording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
              </Button>

              {/* Send / Generate button */}
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isBusy}
                size="icon"
                className={`h-11 w-11 shrink-0 rounded-xl transition-all ${
                  isImageMode
                    ? "bg-pink-600 hover:bg-pink-700"
                    : "bg-violet-600 hover:bg-violet-700"
                }`}
                data-testid="btn-send-message"
              >
                {isBusy
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : isImageMode
                  ? <Image className="w-4 h-4" />
                  : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-muted-foreground text-[10px]">
                {isRecording
                  ? <span className="text-red-500 font-medium animate-pulse">{tc('🔴 جارٍ التسجيل — اضغط على المايك للإيقاف', '🔴 Recording — click mic to stop')}</span>
                  : isImageMode
                  ? <span className="text-pink-500">{tc('وضع توليد الصور · Pollinations AI', 'Image generation mode · Pollinations AI')}</span>
                  : <>{tc('اضغط', 'Press')} <kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono text-[9px]">Enter</kbd> {tc('للإرسال', 'to send')} · <kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono text-[9px]">Shift+Enter</kbd> {tc('لسطر جديد', 'for new line')}</>
                }
              </p>
              {isRecording && (
                <button onClick={stopRecording} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                  <X className="w-3 h-3" />
                  {tc('إيقاف', 'Stop')}
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: BarChart3,
              colorClass: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
              titleAr: "تحليل المبيعات",   titleEn: "Sales Analysis",
              descAr: "يقرأ الذكاء الاصطناعي بيانات مبيعاتك في الوقت الفعلي ويقدم تحليلاً دقيقاً",
              descEn: "AI reads your sales data in real-time and provides accurate analysis"
            },
            {
              icon: Image,
              colorClass: "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400",
              titleAr: "توليد صور احترافية", titleEn: "Image Generation",
              descAr: "اصنع صور منتجاتك ومطعمك بالذكاء الاصطناعي — اكتب الوصف بالعربي وتولّد فوراً",
              descEn: "Create product & restaurant images with AI — describe in Arabic and get instant results"
            },
            {
              icon: Mic,
              colorClass: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
              titleAr: "تحكم صوتي",       titleEn: "Voice Control",
              descAr: "تكلم مع المساعد بالعربية أو الإنجليزية — يحوّل كلامك نصاً تلقائياً",
              descEn: "Talk to the assistant in Arabic or English — your speech is auto-transcribed"
            },
          ].map((card, i) => (
            <Card key={i} className="border">
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.colorClass}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{isAr ? card.titleAr : card.titleEn}</p>
                  <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{isAr ? card.descAr : card.descEn}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      </div>
    </div>
  );
}
