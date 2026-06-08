import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Send, Loader2, Bot, User, Sparkles,
  TrendingDown, AlertTriangle, ShoppingCart, Shield, RefreshCw
} from "lucide-react";

interface Message { role: "user" | "assistant"; content: string }

const QUICK_PROMPTS = [
  { icon: TrendingDown,  label: "كشف الهدر",       q: "هل هناك مواد بها هدر غير طبيعي خلال الشهر الماضي؟ حدد المشكلة والحل" },
  { icon: AlertTriangle, label: "توقع النفاد",      q: "أي المواد الخام ستنفد خلال أسبوع؟ بناءً على معدل الاستهلاك الحالي" },
  { icon: ShoppingCart,  label: "اقتراح الشراء",   q: "ما المواد التي يجب شراؤها الآن وبأي كميات؟ بناءً على المبيعات والمخزون" },
  { icon: Shield,        label: "كشف السرقة",       q: "هل هناك فروقات غير منطقية بين المبيعات والاستهلاك الفعلي؟ كشف أي شذوذ" },
  { icon: RefreshCw,     label: "تحليل شامل",       q: "أعطني تحليلاً شاملاً للمخزون: الهدر، النفاد المتوقع، المخاطر، والتوصيات" },
];

function formatMessage(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold mt-2">{line.slice(2, -2)}</p>;
    if (line.startsWith('- ') || line.startsWith('• ')) return <li key={i} className="mr-4">{line.slice(2)}</li>;
    if (line.match(/^\d+\./)) return <li key={i} className="mr-4">{line}</li>;
    if (line.trim() === '') return <br key={i} />;
    return <p key={i}>{line}</p>;
  });
}

export default function InventoryAI() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askMut = useMutation({
    mutationFn: async (question: string) => {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await apiRequest("POST", "/api/ai/inventory-insights", { question, history });
      return res.json();
    },
    onSuccess: (data: any) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: "assistant", content: "عذراً، حدث خطأ أثناء التحليل. حاول مرة أخرى." }]);
    },
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
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight">ذكاء مخزون QIROX</h1>
          <p className="text-xs text-muted-foreground">كشف الهدر · توقع النفاد · اقتراح الشراء · كشف السرقة</p>
        </div>
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div className="p-4 flex-1 flex flex-col">
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-primary/20 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-bold mb-1">محلل المخزون الذكي</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              يحلل بيانات مخزونك الفعلية لاكتشاف الهدر والسرقة وتوقع النفاد قبل حدوثه
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto w-full">
            {QUICK_PROMPTS.map((p, i) => (
              <Card key={i} className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => send(p.q)} data-testid={`button-prompt-${i}`}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <p.icon className="w-4 h-4 text-primary" />
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
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "assistant" ? "bg-primary/10" : "bg-muted"}`}>
                  {msg.role === "assistant" ? <Sparkles className="w-4 h-4 text-primary" /> : <User className="w-4 h-4" />}
                </div>
                <div className={`rounded-2xl px-4 py-3 max-w-[80%] text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none"}`}>
                  {msg.role === "assistant" ? (
                    <div className="space-y-1 leading-relaxed">{formatMessage(msg.content)}</div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {askMut.isPending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-none px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            placeholder="اسأل عن المخزون... (مثال: ما أسباب ارتفاع الهدر هذا الأسبوع؟)"
            value={input}
            onChange={e => setInput(e.target.value)}
            className="resize-none min-h-[48px] max-h-32"
            rows={1}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            data-testid="input-question"
          />
          <Button className="self-end" onClick={() => send()} disabled={askMut.isPending || !input.trim()} data-testid="button-send">
            {askMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
