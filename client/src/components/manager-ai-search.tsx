import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Sparkles, X, Send, Loader2, ChevronDown, Bot, RotateCcw, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  { ar: "كم مبيعات اليوم؟", en: "Today's sales?" },
  { ar: "ما أكثر منتج مبيعاً؟", en: "Best selling product?" },
  { ar: "كيف حضور الموظفين اليوم؟", en: "Employee attendance today?" },
  { ar: "ما هامش الربح هذا الأسبوع؟", en: "Profit margin this week?" },
  { ar: "هل يوجد مخزون ناقص؟", en: "Low stock items?" },
  { ar: "ما وضع الوردية الحالية؟", en: "Current shift status?" },
];

function MessageBubble({ msg, onCopy }: { msg: Message; onCopy: (text: string) => void }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"} items-start group`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap relative ${
        isUser
          ? "bg-primary text-white rounded-tr-sm"
          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm"
      }`}>
        {msg.content}
        {!isUser && (
          <button
            onClick={handleCopy}
            className="absolute -bottom-5 left-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
          >
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function ManagerAISearch() {
  const tc = useTranslate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages, scrollToBottom]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-12).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.response || tc("لم أتمكن من الحصول على رد.", "Could not get a response.");
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: tc("⚠️ حدث خطأ في الاتصال. حاول مرة أخرى.", "⚠️ Connection error. Please try again.") }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, tc]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
    if (e.key === "Escape") setOpen(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    toast({ title: tc("تم النسخ", "Copied"), className: "bg-primary text-white" });
  };

  const clearChat = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={panelRef} className="relative" data-testid="manager-ai-search">

      {/* Search trigger bar */}
      <button
        onClick={() => setOpen(v => !v)}
        data-testid="button-open-ai-search"
        className="flex items-center gap-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 text-sm text-gray-500 dark:text-gray-400 transition-all min-w-[220px] max-w-xs"
      >
        <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="flex-1 text-right truncate">{tc("اسأل المساعد الذكي…", "Ask AI assistant…")}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Floating chat panel */}
      {open && (
        <div className="absolute top-full mt-2 left-0 w-[420px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          style={{ maxHeight: "520px" }}>

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-l from-primary/5 to-transparent">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-900 dark:text-white">مساعد مكان الشيف</p>
              <p className="text-xs text-primary font-medium">chefsplace.online</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={clearChat} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title={tc("مسح المحادثة","Clear chat")}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4" style={{ minHeight: "200px", maxHeight: "320px" }}>
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-center text-gray-400 pt-1">{tc("اسأل أي سؤال عن النظام أو اختر من الأسئلة السريعة:", "Ask anything about the system or pick a quick question:")}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q.ar)}
                      data-testid={`button-quick-q-${i}`}
                      className="text-right text-xs px-2.5 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-primary/5 hover:border-primary/30 border border-gray-200 dark:border-gray-700 rounded-xl transition-all text-gray-700 dark:text-gray-300 leading-snug"
                    >
                      {q.ar}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} onCopy={handleCopy} />
                ))}
                {loading && (
                  <div className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tc("اكتب سؤالك هنا…", "Type your question…")}
                disabled={loading}
                data-testid="input-ai-search"
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none text-right"
                dir="auto"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                data-testid="button-send-ai"
                className="w-7 h-7 flex items-center justify-center bg-primary hover:bg-primary/90 disabled:opacity-40 rounded-lg text-white transition-all flex-shrink-0"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-center text-gray-300 dark:text-gray-600 mt-1.5">
              مساعد مكان الشيف البخاري · chefsplace.online
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
