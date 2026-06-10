import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Copy, Check, ChevronRight, RefreshCw, Wand2, Star, BookOpen, Layers, Palette, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { brand } from "@/lib/brand";
import { useTranslate } from "@/lib/useTranslate";

interface AIMenuAssistantProps {
  nameAr: string;
  nameEn?: string;
  category?: string;
  existingDescription?: string;
  existingIngredients?: string;
  onInsertDescription?: (text: string) => void;
  onInsertNameEn?: (text: string) => void;
  onInsertIngredients?: (text: string) => void;
  onInsertAddons?: (addons: { nameAr: string; price: number }[]) => void;
  compact?: boolean;
}

type AITask =
  | "description_ar"
  | "description_en"
  | "description_both"
  | "name_en"
  | "ingredients"
  | "addons"
  | "flavor_profile";

interface TaskOption {
  id: AITask;
  labelAr: string;
  labelEn: string;
  icon: React.ReactNode;
  color: string;
  glow: string;
  description: string;
}

const TASK_OPTIONS: TaskOption[] = [
  {
    id: "description_ar",
    labelAr: "وصف عربي",
    labelEn: "Arabic Description",
    icon: <BookOpen className="w-4 h-4" />,
    color: "from-emerald-600 to-green-700",
    glow: "shadow-emerald-500/30",
    description: "وصف شاعري إبداعي باللغة العربية",
  },
  {
    id: "description_en",
    labelAr: "وصف إنجليزي",
    labelEn: "English Description",
    icon: <Star className="w-4 h-4" />,
    color: "from-blue-600 to-indigo-700",
    glow: "shadow-blue-500/30",
    description: "Creative premium English description",
  },
  {
    id: "description_both",
    labelAr: "وصف ثنائي",
    labelEn: "Both Languages",
    icon: <Layers className="w-4 h-4" />,
    color: "from-violet-600 to-purple-700",
    glow: "shadow-violet-500/30",
    description: "وصف كامل بالعربية والإنجليزية",
  },
  {
    id: "name_en",
    labelAr: "اقتراح اسم إنجليزي",
    labelEn: "Suggest English Name",
    icon: <Wand2 className="w-4 h-4" />,
    color: "from-amber-600 to-orange-700",
    glow: "shadow-amber-500/30",
    description: "اقتراح أسماء إنجليزية إبداعية للمنتج",
  },
  {
    id: "ingredients",
    labelAr: "مكونات الوصفة",
    labelEn: "Recipe Ingredients",
    icon: <Layers className="w-4 h-4" />,
    color: "from-teal-600 to-cyan-700",
    glow: "shadow-teal-500/30",
    description: "قائمة المكونات والكميات المقترحة",
  },
  {
    id: "addons",
    labelAr: "إضافات مقترحة",
    labelEn: "Suggested Add-ons",
    icon: <PlusCircle className="w-4 h-4" />,
    color: "from-rose-600 to-pink-700",
    glow: "shadow-rose-500/30",
    description: "إضافات وخيارات تخصيص احترافية",
  },
  {
    id: "flavor_profile",
    labelAr: "ملف النكهة",
    labelEn: "Flavor Profile",
    icon: <Palette className="w-4 h-4" />,
    color: "from-fuchsia-600 to-purple-700",
    glow: "shadow-fuchsia-500/30",
    description: "تحليل النكهة والحواس بأسلوب مهني",
  },
];

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) return;
    let i = 0;
    const speed = Math.max(8, Math.min(25, 2000 / text.length));
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <span>
      {displayed}
      {!done && <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />}
    </span>
  );
}

export function AIMenuAssistant({
  nameAr,
  nameEn,
  category,
  existingDescription,
  existingIngredients,
  onInsertDescription,
  onInsertNameEn,
  onInsertIngredients,
  onInsertAddons,
  compact = false,
}: AIMenuAssistantProps) {
  const tc = useTranslate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<AITask | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const canRun = !!(nameAr || nameEn);

  const runTask = async (task: AITask) => {
    if (!canRun) {
      toast({ title: tc("أدخل اسم المنتج أولاً", "Enter product name first"), variant: "destructive" });
      return;
    }
    setActiveTask(task);
    setResult("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/menu-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nameAr, nameEn, category, task, existingDescription, existingIngredients }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc("فشل الاتصال", "Connection failed"));
      setResult(data.result || "");
    } catch (err: any) {
      toast({ title: tc("خطأ في الذكاء الاصطناعي", "AI error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (!result) return;
    if (activeTask === "description_ar" || activeTask === "description_en" || activeTask === "description_both" || activeTask === "flavor_profile") {
      onInsertDescription?.(result);
      toast({ title: tc("✅ تم إدراج الوصف في الحقل", "✅ Description inserted") });
    } else if (activeTask === "name_en") {
      const firstLine = result.split("\n").find(l => l.trim()) || result;
      const cleaned = firstLine.replace(/^[1-3][.)]\s*/, "").trim();
      onInsertNameEn?.(cleaned);
      toast({ title: tc("✅ تم إدراج الاسم الإنجليزي", "✅ English name inserted") });
    } else if (activeTask === "ingredients") {
      onInsertIngredients?.(result);
      toast({ title: tc("✅ تم إدراج المكونات", "✅ Ingredients inserted") });
    } else if (activeTask === "addons" && onInsertAddons) {
      const lines = result.split("\n").filter(l => l.includes("—") || l.includes("-"));
      const parsed = lines.slice(0, 8).map(line => {
        const parts = line.replace(/^[•\-*]\s*/, "").split(/—|-/);
        const name = parts[0]?.trim() || line.trim();
        const priceMatch = parts[1]?.match(/(\d+(?:\.\d+)?)/);
        return { nameAr: name, price: priceMatch ? parseFloat(priceMatch[1]) : 5 };
      }).filter(a => a.nameAr.length > 0);
      if (parsed.length) {
        onInsertAddons(parsed);
        toast({ title: tc(`✅ تم إضافة ${parsed.length} خيارات للمنتج`, `✅ Added ${parsed.length} options to product`) });
      }
    }
  };

  const activeTaskOption = TASK_OPTIONS.find(t => t.id === activeTask);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={`
          bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600
          hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500
          text-white shadow-lg shadow-purple-500/30
          transition-all duration-300 hover:shadow-purple-500/50 hover:scale-[1.02]
          ${compact ? "text-xs px-3 py-1 h-8" : ""}
        `}
        data-testid="button-ai-assistant"
      >
        <Sparkles className={`${compact ? "w-3 h-3" : "w-4 h-4"} ml-1.5`} />
        {compact ? "AI" : tc("مساعد الذكاء الاصطناعي", "AI Assistant")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-[#0f0a0a] border-purple-500/30 text-white overflow-hidden p-0" dir="rtl">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-violet-900/60 via-purple-900/60 to-indigo-900/60 p-6 border-b border-purple-500/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(139,92,246,0.3),_transparent_60%)]" />
            <DialogHeader className="relative">
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/40">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-white font-bold">{brand.aiAssistantNameAr}</span>
                  <p className="text-purple-300/80 text-sm font-normal mt-0.5">AI Content Generator</p>
                </div>
              </DialogTitle>
            </DialogHeader>
            {/* Item info */}
            {nameAr && (
              <div className="relative mt-4 flex items-center gap-2 flex-wrap">
                <Badge className="bg-purple-500/20 text-purple-200 border-purple-500/30">
                  {nameAr}
                </Badge>
                {nameEn && <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-500/30">{nameEn}</Badge>}
                {category && <Badge className="bg-violet-500/20 text-violet-200 border-violet-500/30">{category}</Badge>}
              </div>
            )}
            {!nameAr && (
              <p className="relative mt-3 text-amber-400 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                {tc("أدخل اسم المنتج في النموذج لتفعيل المساعد", "Enter product name in the form to activate the assistant")}
              </p>
            )}
          </div>

          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
            {/* Task Grid */}
            <div>
              <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">{tc("اختر نوع المحتوى المطلوب", "Choose content type")}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TASK_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => runTask(opt.id)}
                    disabled={loading || !canRun}
                    className={`
                      relative p-3 rounded-xl border text-right transition-all duration-200 group
                      ${activeTask === opt.id
                        ? `bg-gradient-to-br ${opt.color} border-transparent shadow-lg ${opt.glow}`
                        : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"}
                      disabled:opacity-40 disabled:cursor-not-allowed
                    `}
                  >
                    <div className={`mb-1.5 ${activeTask === opt.id ? "text-white" : "text-gray-400 group-hover:text-white"}`}>
                      {opt.icon}
                    </div>
                    <p className={`text-xs font-bold ${activeTask === opt.id ? "text-white" : "text-gray-300"}`}>
                      {opt.labelAr}
                    </p>
                    <p className={`text-[10px] mt-0.5 leading-tight ${activeTask === opt.id ? "text-white/70" : "text-gray-500"}`}>
                      {opt.description}
                    </p>
                    {activeTask === opt.id && loading && (
                      <div className="absolute top-2 left-2">
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Result Area */}
            {(loading || result) && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 overflow-hidden">
                {/* Result header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-purple-500/10 bg-purple-900/20">
                  <div className="flex items-center gap-2">
                    {activeTaskOption && (
                      <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${activeTaskOption.color} flex items-center justify-center`}>
                        {activeTaskOption.icon}
                      </div>
                    )}
                    <span className="text-purple-300 text-xs font-medium">{activeTaskOption?.labelAr}</span>
                  </div>
                  {!loading && result && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => runTask(activeTask!)}
                        className="p-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="إعادة التوليد"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="p-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="نسخ"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Result content */}
                <div ref={resultRef} className="p-4 min-h-[80px]" dir="rtl">
                  {loading ? (
                    <div className="flex items-center gap-3 text-purple-300">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                      <span className="text-sm">{tc("يفكر الذكاء الاصطناعي...", "AI is thinking...")}</span>
                      <div className="flex gap-1 mr-auto">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                      <TypewriterText text={result} />
                    </p>
                  )}
                </div>

                {/* Insert button */}
                {!loading && result && (
                  <div className="px-4 pb-4 flex gap-2">
                    {(onInsertDescription || onInsertNameEn || onInsertIngredients || onInsertAddons) && (
                      <Button
                        type="button"
                        onClick={handleInsert}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white text-sm shadow-lg shadow-emerald-500/20"
                      >
                        <ChevronRight className="w-4 h-4 ml-1" />
                        {tc("إدراج في النموذج", "Insert into form")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopy}
                      className="border-gray-600 text-gray-300 hover:border-purple-500/50 hover:text-white text-sm"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!loading && !result && (
              <div className="text-center py-6 text-gray-600">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-purple-950/40 border border-purple-800/30 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-sm">{tc("اختر نوع المحتوى لتوليده بالذكاء الاصطناعي", "Choose content type to generate with AI")}</p>
                <p className="text-xs mt-1 text-gray-700">{tc("يعمل بـ Kimi K2 + Gemini Flash — ذكاء هجين", "Powered by Kimi K2 + Gemini Flash — hybrid AI")}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
