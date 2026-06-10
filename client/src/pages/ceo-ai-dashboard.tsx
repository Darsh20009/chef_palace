import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Send, Loader2, Sparkles, User,
  TrendingDown, DollarSign, BarChart3, Package, Users, Lightbulb
} from "lucide-react";

interface Message { role: "user" | "assistant"; content: string }

const CEO_PROMPTS = [
  { icon: TrendingDown, label: "لماذا انخفض الربح؟",         q: "لماذا انخفض الربح؟ حلل الأسباب وقدم حلولاً عملية" },
  { icon: DollarSign,   label: "أسباب انخفاض المبيعات",       q: "ما أسباب انخفاض المبيعات؟ ما الإجراءات الفورية المطلوبة؟" },
  { icon: BarChart3,    label: "أكثر المنتجات ربحية",         q: "ما المنتجات الأكثر ربحية؟ وما التي تستنزف الموارد؟" },
  { icon: Package,      label: "أسباب ارتفاع التكاليف",       q: "لماذا ارتفعت التكاليف؟ ما بنود الإنفاق القابلة للتخفيض؟" },
  { icon: Users,        label: "كفاءة الموظفين",              q: "كيف يؤثر عدد الموظفين على الأداء والتكلفة؟" },
  { icon: Lightbulb,    label: "توصيات استراتيجية",           q: "أعطني 5 توصيات استراتيجية لتحسين أداء المطعم خلال الشهر القادم" },
];

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="font-bold text-base mt-3 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith('## '))  return <h2 key={i} className="font-bold text-lg mt-3 mb-1">{line.slice(3)}</h2>;
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold mt-2">{line.slice(2, -2)}</p>;
    if (line.startsWith('- ') || line.startsWith('• ')) return <li key={i} className="mr-5 text-sm">{line.slice(2)}</li>;
    if (line.match(/^\d+\./)) return <li key={i} className="mr-5 text-sm">{line}</li>;
    if (line.trim() === '') return <div key={i} className="h-1" />;
    return <p key={i} className="text-sm">{line}</p>;
  });
}

export default function CeoAIDashboard() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const askMut = useMutation({
    mutationFn: async (question: string) => {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await apiRequest("POST", "/api/ai/ceo-chat", { question, history });
      return res.json();
    },
    onSuccess: (data: any) => setMessages(prev => [...prev, { role: "assistant", content: data.answer }]),
    onError: () => setMessages(prev => [...prev, { role: "assistant", content: "عذراً، حدث خطأ. حاول مرة أخرى." }]),
  });

  const send = (q?: string) => {
    const question = q || input.trim();
    if (!question) return;
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setInput("");
    askMut.mutate(question);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/manager/dashboard")}>
          <ArrowLeft className="w-4 h-4 ml-2" />العودة
        </Button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-base">مستشار الأعمال الذكي — CEO AI</h1>
          <p className="text-xs text-muted-foreground">يحلل بيانات أعمالك الحقيقية ويجيب على أسئلتك الاستراتيجية</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="mr-auto text-xs" onClick={() => setMessages([])}>
            محادثة جديدة
          </Button>
        )}
      </div>

      {/* Welcome & quick prompts */}
      {messages.length === 0 && (
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">مساءً يا مدير ✦</h2>
              <p className="text-muted-foreground max-w-md mx-auto text-sm">
                أنا مستشارك الذكي. أحلل مبيعاتك وتكاليفك ومخزونك في الوقت الفعلي لأجيب على أسئلتك الاستراتيجية.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CEO_PROMPTS.map((p, i) => (
                <Card key={i} className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group" onClick={() => send(p.q)} data-testid={`button-ceo-prompt-${i}`}>
                  <CardContent className="py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <p.icon className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{p.label}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{p.q}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      {messages.length > 0 && (
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${msg.role === "assistant" ? "bg-gradient-to-br from-blue-600 to-violet-600" : "bg-muted"}`}>
                  {msg.role === "assistant" ? <Sparkles className="w-4 h-4 text-white" /> : <User className="w-4 h-4" />}
                </div>
                <div className={`rounded-2xl px-4 py-3 max-w-[85%] ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-none text-sm" : "bg-card border border-border rounded-tl-none"}`}>
                  {msg.role === "assistant" ? (
                    <div className="leading-relaxed space-y-0.5">{renderMarkdown(msg.content)}</div>
                  ) : msg.content}
                </div>
              </div>
            ))}
            {askMut.isPending && (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">أحلل البيانات...</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card p-4">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            placeholder="اسأل أي سؤال استراتيجي... (لماذا انخفض الربح؟ ما المنتجات الأفضل؟)"
            value={input}
            onChange={e => setInput(e.target.value)}
            className="resize-none min-h-[48px] max-h-36"
            rows={1}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            data-testid="input-ceo-question"
          />
          <Button onClick={() => send()} disabled={askMut.isPending || !input.trim()} data-testid="button-ceo-send">
            {askMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
