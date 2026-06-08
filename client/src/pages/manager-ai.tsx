import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTranslate } from "@/lib/useTranslate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles, Send, RefreshCw, Bot, User, Loader2, Brain,
  TrendingUp, Star, Lightbulb, BarChart3, ShoppingBag,
  Users, Clock, ChevronDown, ChevronUp, Zap, MessageSquare,
  Target, Coffee, ArrowLeft, Trash2
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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

function formatContent(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s(.+)$/gm, '<div class="font-bold text-primary mt-3 mb-1 text-sm">$1</div>')
    .replace(/^[-•]\s(.+)$/gm, '<div class="flex gap-2 items-start mt-1"><span class="text-primary mt-0.5 shrink-0">•</span><span>$1</span></div>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>');
}

export default function ManagerAI() {
  const [, setLocation] = useLocation();
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const isAr = i18n.language !== 'en';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showInsights, setShowInsights] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const sendMessage = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || chatMutation.isPending) return;
    setMessages(prev => [...prev, { role: "user", content: msg, timestamp: new Date() }]);
    setInput("");
    chatMutation.mutate(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const insights: Insight[] = (insightsData as any)?.insights || [];
  const stats = (insightsData as any)?.stats;
  const hasApiError = (insightsData as any)?.error?.includes("KIMI_API_KEY") || (insightsData as any)?.configured === false;

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">

        {/* ── Header ── */}
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
                <span className="text-xs text-muted-foreground">{tc('مدعوم بـ', 'Powered by')} Kimi AI (Moonshot)</span>
              </div>
            </div>
          </div>
          <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-0 gap-1">
            <Sparkles className="w-3 h-3" />
            AI
          </Badge>
        </div>

        {/* ── API Key Warning ── */}
        {!insightsLoading && hasApiError && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400 text-sm">{tc('مفتاح API غير مضبوط', 'API Key Not Configured')}</p>
                <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                  {tc('لتفعيل الذكاء الاصطناعي، تأكد من ضبط مفتاح', 'To activate AI, make sure the key')}{" "}
                  <code className="bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300 font-mono text-[11px]">KIMI_API_KEY</code>{" "}
                  {tc('في متغيرات البيئة', 'is set in environment variables')} — <a href="https://platform.moonshot.ai" target="_blank" className="text-amber-600 underline">platform.moonshot.ai</a>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Stats Strip ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { labelAr: "مبيعات اليوم",   labelEn: "Today's Sales",    value: `${(stats.todayRevenue || 0).toFixed(0)}`, icon: TrendingUp, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
              { labelAr: "طلبات اليوم",    labelEn: "Today's Orders",   value: stats.todayOrders || 0, icon: ShoppingBag, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
              { labelAr: "مبيعات الأسبوع", labelEn: "Weekly Sales",     value: `${(stats.weekRevenue || 0).toFixed(0)}`, icon: BarChart3, color: "text-violet-600 bg-violet-100 dark:bg-violet-900/30" },
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

        {/* ── AI Insights ── */}
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
                <button
                  onClick={e => { e.stopPropagation(); refetchInsights(); }}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                  data-testid="btn-refresh-insights"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                {showInsights
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
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

        {/* ── Chat Area ── */}
        <Card className="border flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-semibold text-foreground">{tc('محادثة مع المساعد', 'Chat with Assistant')}</span>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMessages([])}
                className="text-muted-foreground hover:text-destructive text-xs h-7 gap-1"
                data-testid="btn-clear-chat"
              >
                <Trash2 className="w-3 h-3" />
                {tc('مسح', 'Clear')}
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 320, maxHeight: 420 }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
                  <Coffee className="w-8 h-8 text-violet-500" />
                </div>
                <p className="font-semibold text-foreground mb-1">{tc('أهلاً، كيف يمكنني مساعدتك؟', 'Hello, how can I help you?')}</p>
                <p className="text-muted-foreground text-sm max-w-sm">
                  {tc('اسألني عن مبيعاتك، موظفيك، منيوك، أو اطلب مني تحليل أداء كافيهك', 'Ask me about your sales, staff, menu, or request a performance analysis of your cafe')}
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "user"
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700"
                  }`}>
                    {msg.role === "user"
                      ? <User className="w-4 h-4 text-primary" />
                      : <Bot className="w-4 h-4 text-violet-500" />}
                  </div>
                  <div className={`max-w-[80%] flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tl-sm"
                        : "bg-muted border border-border text-foreground rounded-tr-sm"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                      ) : msg.content}
                    </div>
                    <p className="text-muted-foreground text-[10px] mt-1 px-1">
                      {msg.timestamp.toLocaleTimeString(isAr ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}

            {chatMutation.isPending && (
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

          {/* Quick Prompts — shown only when no messages */}
          {messages.length === 0 && (
            <div className="px-4 pb-3 border-t border-border bg-muted/20">
              <p className="text-muted-foreground text-xs mb-2 pt-3">{tc('اختر سؤالاً سريعاً:', 'Choose a quick question:')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {QUICK_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(isAr ? p.promptAr : p.promptEn)}
                    disabled={chatMutation.isPending}
                    className={`flex items-center gap-1.5 px-3 py-2 bg-background hover:bg-muted border border-border hover:border-primary/30 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-all ${isAr ? 'text-right' : 'text-left'} disabled:opacity-50`}
                    data-testid={`quick-prompt-${i}`}
                  >
                    <span className="shrink-0">{p.icon}</span>
                    <span className="line-clamp-1">{isAr ? p.labelAr : p.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-3 border-t border-border">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tc('اسألني أي شيء عن كافيهك... (Enter للإرسال)', 'Ask me anything about your cafe... (Enter to send)')}
                className="resize-none text-sm min-h-[44px] max-h-[120px]"
                rows={1}
                disabled={chatMutation.isPending}
                data-testid="input-ai-message"
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || chatMutation.isPending}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl bg-violet-600 hover:bg-violet-700"
                data-testid="btn-send-message"
              >
                {chatMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-muted-foreground text-[10px] mt-1.5">
              {tc('اضغط', 'Press')} <kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono text-[9px]">Enter</kbd> {tc('للإرسال', 'to send')} ·{" "}
              <kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono text-[9px]">Shift+Enter</kbd> {tc('لسطر جديد', 'for new line')}
            </p>
          </div>
        </Card>

        {/* ── Feature Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: BarChart3,
              colorClass: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
              titleAr: "تحليل المبيعات",       titleEn: "Sales Analysis",
              descAr: "يقرأ الذكاء الاصطناعي بيانات مبيعاتك في الوقت الفعلي ويقدم تحليلاً دقيقاً",
              descEn: "AI reads your sales data in real-time and provides accurate analysis"
            },
            {
              icon: Star,
              colorClass: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
              titleAr: "تحسين المنيو",         titleEn: "Menu Optimization",
              descAr: "اقتراحات ذكية لتطوير قائمة الطعام بناءً على الطلب والأداء",
              descEn: "Smart suggestions to improve the menu based on demand and performance"
            },
            {
              icon: Users,
              colorClass: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
              titleAr: "إدارة الفريق",         titleEn: "Team Management",
              descAr: "نصائح وتوصيات لتحسين إدارة موظفيك وجدولة الوردايات",
              descEn: "Tips and recommendations to improve staff management and shift scheduling"
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
