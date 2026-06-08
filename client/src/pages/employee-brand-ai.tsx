import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brand } from "@/lib/brand";
import { ArrowRight, Send, Bot, Loader2, Sparkles, RefreshCw, User } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  "ما هي المنتجات الأكثر طلباً؟",
  "كيف أتعامل مع شكوى عميل؟",
  "ما هي سياسة الاسترجاع؟",
  "كيف أضيف ملاحظة على الطلب؟",
  "ما هي مكونات القهوة؟",
  "كيف أعمل على الكاشير؟",
];

export default function EmployeeBrandAI() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `مرحباً! أنا ${brand.aiAssistantNameAr} 👋\nأنا هنا لمساعدتك في أي سؤال يخص العمل، المنتجات، السياسات، أو الطلبات. كيف أقدر أساعدك اليوم؟`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const data = await apiRequest("POST", "/api/ai/brand-chat", { message: msg, history });
      const json = await data.json();

      const aiMsg: Message = {
        role: "assistant",
        content: json.reply || "عذراً، لم أتمكن من الإجابة.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      toast({ title: "خطأ", description: "تعذر الاتصال بالمساعد الذكي.", variant: "destructive" });
      setMessages((prev) => prev.filter((m) => m !== userMsg));
      setInput(msg);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function clearChat() {
    setMessages([
      {
        role: "assistant",
        content: `مرحباً مجدداً! كيف أقدر أساعدك؟`,
        timestamp: new Date(),
      },
    ]);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/employee/home")}
          className="text-sidebar-foreground hover:bg-white/10"
          data-testid="button-back"
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">{brand.aiAssistantNameAr}</h1>
            <p className="text-xs text-sidebar-foreground/60">مساعد الموظفين الذكي</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearChat}
          className="text-sidebar-foreground hover:bg-white/10"
          title="محادثة جديدة"
          data-testid="button-clear-chat"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Chat area */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "assistant"
                  ? "bg-primary/10 text-primary"
                  : "bg-primary text-white"
              }`}>
                {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "assistant"
                  ? "bg-card border border-border text-foreground rounded-tr-none"
                  : "bg-primary text-primary-foreground rounded-tl-none"
              }`}>
                {msg.content}
                <div className={`text-[10px] mt-1.5 ${msg.role === "assistant" ? "text-muted-foreground" : "text-primary-foreground/60"}`}>
                  {msg.timestamp.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tr-none px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Quick questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground mb-2 text-center">اسأل عن:</p>
          <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-full px-3 py-1.5 transition-colors border border-primary/20"
                data-testid={`quick-question-${q.slice(0, 10)}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="اكتب سؤالك هنا..."
            className="flex-1 text-right"
            disabled={loading}
            data-testid="input-ai-message"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            size="icon"
            data-testid="button-send-message"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
