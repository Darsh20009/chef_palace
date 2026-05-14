/**
 * QIROX Internal AI Engine
 * ─────────────────────────────────────────────────────────────────
 * Replaces all Groq/external-API calls with self-contained logic.
 * Reads live data from MongoDB and produces Arabic responses with
 * no outbound HTTP requests to any third-party AI service.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessStats {
  todayRevenue: number;
  todayOrders: number;
  weekRevenue: number;
  weekOrders: number;
  prevWeekRevenue: number;
  prevWeekOrders: number;
  topItems: Array<{ name: string; count: number; revenue: number }>;
  bestDay: { day: string; revenue: number } | null;
  peakHour: { hour: number; count: number } | null;
  employeeCount: number;
  productCount: number;
  avgOrderValue: number;
  growthPct: number | null;
  pendingOrders?: number;
}

export interface Insight {
  icon: string;
  title: string;
  insight: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("ar-SA", { maximumFractionDigits: 1 }); }
function pct(n: number) { return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`; }

// ─── 1. SMART INSIGHTS GENERATOR ─────────────────────────────────────────────

export function generateInsights(s: BusinessStats): Insight[] {
  const insights: Insight[] = [];

  // ─ Revenue trend
  if (s.growthPct !== null) {
    if (s.growthPct >= 10) {
      insights.push({
        icon: "📈",
        title: "نمو مبيعات قوي",
        insight: `ارتفعت المبيعات هذا الأسبوع بنسبة ${pct(s.growthPct)} مقارنةً بالأسبوع الماضي — حافظ على هذا الزخم بعروض في أوقات الذروة.`,
      });
    } else if (s.growthPct <= -10) {
      insights.push({
        icon: "📉",
        title: "تراجع في المبيعات",
        insight: `انخفضت المبيعات بنسبة ${pct(s.growthPct)} هذا الأسبوع. ابحث عن سبب التراجع وأطلق عرضاً لاستعادة الزخم.`,
      });
    } else {
      insights.push({
        icon: "📊",
        title: "مبيعات مستقرة",
        insight: `المبيعات هذا الأسبوع (${fmt(s.weekRevenue)} ريال) قريبة من الأسبوع الماضي — فرصة جيدة لتجربة منتج جديد لرفع المتوسط.`,
      });
    }
  } else {
    insights.push({
      icon: "📊",
      title: "إجمالي الأسبوع",
      insight: `إجمالي مبيعات الأسبوع ${fmt(s.weekRevenue)} ريال من ${s.weekOrders} طلب — متوسط قيمة الطلب ${fmt(s.avgOrderValue)} ريال.`,
    });
  }

  // ─ Today performance
  const todayAvg = s.todayOrders > 0 ? s.todayRevenue / s.todayOrders : 0;
  if (s.todayOrders > 0) {
    insights.push({
      icon: "☀️",
      title: "أداء اليوم",
      insight: `اليوم حتى الآن: ${fmt(s.todayRevenue)} ريال من ${s.todayOrders} طلب (متوسط ${fmt(todayAvg)} ريال/طلب). ${todayAvg < s.avgOrderValue ? "ارفع متوسط الفاتورة باقتراح إضافات على العملاء." : "متوسط الفاتورة أعلى من المعدل — ممتاز!"}`,
    });
  }

  // ─ Top selling item
  if (s.topItems.length > 0) {
    const top = s.topItems[0];
    insights.push({
      icon: "⭐",
      title: "النجم الأول",
      insight: `"${top.name}" هو الأكثر طلباً هذا الأسبوع (${top.count} مرة) بإيراد ${fmt(top.revenue)} ريال. احرص على توفيره دائماً وأبرزه في المنيو.`,
    });
  }

  // ─ Peak hour
  if (s.peakHour) {
    const h = s.peakHour.hour;
    const timeStr = h < 12 ? `${h} صباحاً` : h === 12 ? "الظهر" : `${h - 12} مساءً`;
    insights.push({
      icon: "🕐",
      title: "وقت الذروة",
      insight: `أكثر ساعات الإقبال هي الساعة ${timeStr} بمعدل ${s.peakHour.count} طلب/يوم. خصص أكبر عدد من الموظفين في هذا الوقت لتسريع الخدمة.`,
    });
  }

  // ─ Best day
  if (s.bestDay && insights.length < 5) {
    insights.push({
      icon: "🏆",
      title: "أفضل يوم",
      insight: `${s.bestDay.day} هو أفضل يوم هذا الأسبوع بمبيعات ${fmt(s.bestDay.revenue)} ريال. خطط لعروض خاصة في هذا اليوم لمضاعفة الإيراد.`,
    });
  }

  // ─ Low activity if needed
  if (insights.length < 3 && s.weekOrders === 0) {
    insights.push({
      icon: "💡",
      title: "ابدأ الآن",
      insight: "لا توجد طلبات مسجلة هذا الأسبوع بعد. تأكد من إعداد المنيو وافتح الكاشير لبدء تسجيل المبيعات.",
    });
  }

  return insights.slice(0, 4);
}

// ─── 2. SMART CHAT ENGINE ─────────────────────────────────────────────────────

interface ChatContext {
  message: string;
  history: Array<{ role: string; content: string }>;
  stats: BusinessStats;
  employeeNames?: string[];
  menuItems?: string[];
  pendingOrders?: number;
}

type TopicKey =
  | "sales_today" | "sales_week" | "sales_analysis" | "top_products"
  | "offers" | "peak_hours" | "employees" | "menu" | "costs"
  | "marketing" | "new_products" | "inventory" | "customers"
  | "orders_pending" | "avg_order" | "growth" | "tips" | "greeting"
  | "unknown";

function detectTopic(msg: string): TopicKey {
  const m = msg.trim().toLowerCase();

  const patterns: [RegExp, TopicKey][] = [
    [/اليوم|today|مبيعات اليوم|إيراد اليوم/, "sales_today"],
    [/الأسبوع|هذا الأسبوع|هذي الأسبوع|مبيعات الأسبوع|weekly/, "sales_week"],
    [/حلل|تحليل|analysis|ملاحظات/, "sales_analysis"],
    [/منتج|مبيعاً|الأكثر|بيع|top|best.sell/, "top_products"],
    [/عرض|عروض|offer|discount|خصم|promo/, "offers"],
    [/ذروة|وقت|ساعة|peak|rush/, "peak_hours"],
    [/موظف|staff|employ|ورديه|جدول/, "employees"],
    [/منيو|قائمة|menu|طعام|منتج جديد/, "menu"],
    [/تكلفة|تكاليف|cost|مصروف|ميزانية/, "costs"],
    [/تسويق|marketing|social|اجتذاب|عملاء جدد/, "marketing"],
    [/جديد|موسمي|seasonal|اقترح منتج/, "new_products"],
    [/مخزون|inventory|stock|كميات/, "inventory"],
    [/عميل|زبون|customer|رضا|تجربة/, "customers"],
    [/معلق|انتظار|pending|قيد/, "orders_pending"],
    [/متوسط|average|قيمة الطلب|avg/, "avg_order"],
    [/نمو|growth|ارتفع|انخفض|مقارنة/, "growth"],
    [/نصيحة|نصائح|tip|كيف|كيفية|improve/, "tips"],
    [/مرحبا|أهلاً|هلا|hi|hello|السلام/, "greeting"],
  ];

  for (const [re, topic] of patterns) {
    if (re.test(m)) return topic;
  }
  return "unknown";
}

export function generateChatReply(ctx: ChatContext): string {
  const { stats: s, message } = ctx;
  const topic = detectTopic(message);
  const todayAvg = s.todayOrders > 0 ? s.todayRevenue / s.todayOrders : 0;
  const topItem = s.topItems[0];

  switch (topic) {
    case "greeting":
      return `أهلاً! 👋 أنا المساعد الذكي لنظام QIROX.\n\nبياناتك الحالية:\n📅 مبيعات اليوم: **${fmt(s.todayRevenue)} ريال** (${s.todayOrders} طلب)\n📆 مبيعات الأسبوع: **${fmt(s.weekRevenue)} ريال** (${s.weekOrders} طلب)\n\nكيف يمكنني مساعدتك؟`;

    case "sales_today":
      return buildSalesTodayReply(s);

    case "sales_week":
    case "sales_analysis":
      return buildWeekAnalysisReply(s);

    case "top_products":
      return buildTopProductsReply(s);

    case "offers":
      return buildOffersReply(s);

    case "peak_hours":
      return buildPeakHoursReply(s);

    case "employees":
      return buildEmployeesReply(s);

    case "menu":
    case "new_products":
      return buildMenuReply(s);

    case "costs":
      return buildCostsReply(s);

    case "marketing":
      return buildMarketingReply(s);

    case "customers":
      return buildCustomersReply(s);

    case "avg_order":
      return `📊 **متوسط قيمة الطلب**\n\nهذا الأسبوع: **${fmt(s.avgOrderValue)} ريال/طلب** من ${s.weekOrders} طلب.\n${todayAvg > 0 ? `اليوم: ${fmt(todayAvg)} ريال/طلب.` : ""}\n\n💡 لرفع المتوسط:\n• اقترح الحجم الأكبر عند الطلب\n• أضف عروض "الوجبة الكاملة" بسعر محفز\n• درّب الفريق على البيع التصاعدي (Upselling)`;

    case "growth":
      return buildGrowthReply(s);

    case "orders_pending":
      if (s.pendingOrders !== undefined) {
        return `⏳ **الطلبات المعلقة الآن**\n\nيوجد حالياً **${s.pendingOrders} طلب** قيد التحضير أو الانتظار.\n\n${s.pendingOrders > 5 ? "⚠️ يبدو أن هناك ضغطاً — تأكد من توزيع المهام على الفريق وأن الطابعة تعمل." : "✅ الأمور تسير بشكل جيد."}`;
      }
      return "📋 لا تتوفر بيانات الطلبات المعلقة حالياً. تحقق من شاشة الطلبات.";

    case "tips":
      return buildTipsReply(s);

    case "unknown":
    default:
      return buildUnknownReply(message, s);
  }
}

// ─── Topic Reply Builders ──────────────────────────────────────────────────────

function buildSalesTodayReply(s: BusinessStats): string {
  const avg = s.todayOrders > 0 ? s.todayRevenue / s.todayOrders : 0;
  const trend = s.growthPct !== null
    ? (s.growthPct >= 0 ? `📈 المبيعات في نمو ${pct(s.growthPct)} مقارنة بالأسبوع الماضي.` : `📉 المبيعات تراجعت ${pct(s.growthPct)} مقارنة بالأسبوع الماضي.`)
    : "";

  const tips = avg > 0 && avg < s.avgOrderValue
    ? "\n💡 **توصية:** متوسط اليوم أقل من المعدل — حثّ الفريق على اقتراح إضافات للعملاء."
    : "";

  return `📅 **مبيعات اليوم**\n\n• الإيراد الكلي: **${fmt(s.todayRevenue)} ريال**\n• عدد الطلبات: **${s.todayOrders} طلب**\n• متوسط الفاتورة: **${fmt(avg)} ريال**\n\n${trend}${tips}`;
}

function buildWeekAnalysisReply(s: BusinessStats): string {
  const topNames = s.topItems.slice(0, 3).map((t, i) => `  ${i + 1}. ${t.name} — ${t.count} طلب (${fmt(t.revenue)} ريال)`).join("\n") || "  لا بيانات";
  const growth = s.growthPct !== null ? `\n📈 النمو مقارنة بالأسبوع الماضي: **${pct(s.growthPct)}**` : "";
  const best = s.bestDay ? `\n🏆 أفضل يوم: **${s.bestDay.day}** (${fmt(s.bestDay.revenue)} ريال)` : "";
  const peak = s.peakHour ? `\n🕐 ساعة الذروة: **${s.peakHour.hour < 12 ? s.peakHour.hour + " ص" : (s.peakHour.hour - 12) + " م"}** (${s.peakHour.count} طلب)` : "";

  return `📆 **تحليل مبيعات الأسبوع**\n\n• الإيراد الكلي: **${fmt(s.weekRevenue)} ريال**\n• عدد الطلبات: **${s.weekOrders} طلب**\n• متوسط الفاتورة: **${fmt(s.avgOrderValue)} ريال**\n${growth}${best}${peak}\n\n🥇 **أكثر المنتجات مبيعاً:**\n${topNames}\n\n💡 **توصية:** ركّز على المنتج الأول وتأكد من توفره دائماً، واستخدم يوم الذروة لإطلاق عرض جديد.`;
}

function buildTopProductsReply(s: BusinessStats): string {
  if (s.topItems.length === 0) return "📊 لا توجد بيانات مبيعات كافية هذا الأسبوع لتحديد المنتجات الأكثر مبيعاً.";

  const list = s.topItems.slice(0, 5).map((t, i) => {
    const stars = i === 0 ? " ⭐" : i === 1 ? " 🥈" : i === 2 ? " 🥉" : "";
    return `  ${i + 1}. **${t.name}**${stars} — ${t.count} طلب — ${fmt(t.revenue)} ريال`;
  }).join("\n");

  const top = s.topItems[0];
  const bottom = s.topItems[s.topItems.length - 1];
  const tips = `\n\n💡 **توصيات:**\n• أبرز "${top.name}" في المنيو وعلى وسائل التواصل\n• فكر في تقليل خيارات المنتجات الأقل طلباً\n• أضف تعديلات (Add-ons) على الأكثر مبيعاً لرفع قيمة الفاتورة`;

  return `🥇 **أكثر المنتجات مبيعاً هذا الأسبوع**\n\n${list}${tips}`;
}

function buildOffersReply(s: BusinessStats): string {
  const peak = s.peakHour;
  const slow = peak ? (peak.hour > 12 ? "الصباح الباكر" : "بعد الظهيرة") : "الأوقات الهادئة";
  const topItem = s.topItems[0]?.name || "المنتج الأكثر مبيعاً";

  return `🎯 **اقتراحات عروض ترويجية مناسبة**\n\n**1. عرض الأصدقاء 🤝**\nأحضر صديقاً واحصل على خصم 15% على طلبكما معاً — يرفع متوسط الفاتورة.\n\n**2. وجبة الموظف 💼**\nخلال ${slow}: خصم 10% على أي طلب مزدوج (مشروب + إضافة) — تحريك الأوقات الهادئة.\n\n**3. نجم الأسبوع ⭐**\n"${topItem}" بخصم 5% الأسبوع القادم — يعزز ولاء العملاء وهو رابح بالفعل.\n\n**4. برنامج الولاء 🃏**\nفعّل نقاط المكافآت لعملاء العودة — يزيد معدل الزيارات المتكررة.\n\n💡 جميع هذه العروض قابلة للضبط من قسم "العروض الترويجية" في النظام.`;
}

function buildPeakHoursReply(s: BusinessStats): string {
  if (!s.peakHour) return "📊 لا تتوفر بيانات كافية لتحديد أوقات الذروة هذا الأسبوع.";

  const h = s.peakHour.hour;
  const timeStr = h < 12 ? `${h}:00 صباحاً` : h === 12 ? "12:00 ظهراً" : `${h - 12}:00 مساءً`;
  const slowTime = h < 14 ? "3 - 5 مساءً" : "9 - 11 صباحاً";

  return `🕐 **تحليل أوقات الذروة**\n\n• **ذروة الإقبال:** الساعة ${timeStr} (${s.peakHour.count} طلب/يوم في المتوسط)\n• **الوقت الأهدأ:** ${slowTime}\n\n💡 **كيف تستثمر الذروة؟**\n• زوّد الكاشير بموظف إضافي في هذا الوقت\n• أعدّ المنتجات الأكثر طلباً مسبقاً قبل ساعة من الذروة\n• اعرض قائمة مختصرة بالمنتجات الأسرع تحضيراً\n\n💡 **في الوقت الهادئ:**\n• أطلق عروض "ساعة الهدوء" بخصم 10-15%\n• استثمر الوقت في تدريب الفريق وتحضير المخزون`;
}

function buildEmployeesReply(s: BusinessStats): string {
  return `👥 **إدارة الموظفين**\n\nعدد الموظفين الكلي: **${s.employeeCount}**\n\n💡 **نصائح لرفع الإنتاجية:**\n\n**1. التوزيع الذكي**\n• خصص 60% من القوة البشرية في وقت الذروة${s.peakHour ? ` (${s.peakHour.hour < 12 ? s.peakHour.hour + " ص" : (s.peakHour.hour - 12) + " م"})` : ""}\n• موظف واحد يكفي في الأوقات الهادئة\n\n**2. التدريب المستمر**\n• حدد أسرع الموظفين أداءً وضعهم في الكاشير الرئيسي\n• درّب الفريق على اقتراح الإضافات (Upselling)\n\n**3. الحضور والانتظام**\n• تابع الحضور والتأخر من قسم "الحضور والانصراف"\n• أعطِ مكافأة شهرية لموظف الشهر لتحفيز الفريق`;
}

function buildMenuReply(s: BusinessStats): string {
  const topItem = s.topItems[0]?.name;
  return `🍽️ **توصيات المنيو**\n\nعدد المنتجات الحالية: **${s.productCount}**\n\n💡 **منتجات مقترحة بناءً على الاتجاهات:**\n\n**موسمي / رمضاني:**\n• تمر بالقهوة العربية\n• قهوة مثلجة بالهيل والزعفران\n• عصير قمر الدين\n\n**يومي ثابت:**\n• لاتيه بنكهات إضافية (فانيلا / كراميل / بندق)\n• وجبة خفيفة سريعة مع أي مشروب\n\n${topItem ? `💡 "${topItem}" ناجح جداً — فكر في إضافة نسخة موسمية أو بنكهة مختلفة منه.\n\n` : ""}⚙️ أضف المنتجات الجديدة من قسم "إدارة المنيو" في النظام.`;
}

function buildCostsReply(s: BusinessStats): string {
  return `💰 **تقليل تكاليف التشغيل**\n\n💡 **أبرز 5 توصيات:**\n\n**1. المخزون الذكي 📦**\nتتبع كميات المواد الخام يومياً وتجنب الشراء الزائد — يقلل الهدر بنسبة 15-25%.\n\n**2. الطاقة ⚡**\nأوقف الأجهزة غير المستخدمة في الأوقات الهادئة (آلات التبريد / الشاشات).\n\n**3. الطلبات الموحدة 🚚**\nاجمع طلبات الموردين مرة أسبوعياً بدلاً من أكثر — تخفض تكلفة التوصيل.\n\n**4. التكنولوجيا ⚙️**\nالنظام الرقمي يوفر تكلفة الورق والطباعة والوقت — استثمر الميزات كاملاً.\n\n**5. التحليل الشهري 📊**\nراجع تقرير المصروفات الشهري في قسم "المحاسبة" ولاحظ أين يذهب المال.`;
}

function buildMarketingReply(s: BusinessStats): string {
  const topItem = s.topItems[0]?.name || "منتجك المميز";
  return `📣 **استراتيجيات التسويق**\n\n**1. التواصل الاجتماعي 📱**\n• انشر صورة "${topItem}" يومياً في أوقات الذروة\n• استخدم ستوريز يومية وأجب على التعليقات بسرعة\n• كل 5 منشورات: 1 للعروض، 2 للمنتجات، 2 للكواليس\n\n**2. الولاء والإحالة 🎁**\n• برنامج "أحضر صديق" بخصم للطرفين\n• كود خصم خاص لكل عميل مميز\n• رسائل "وحشتنا" للعملاء الغائبين 7+ أيام\n\n**3. المحلي 📍**\n• شارك في مناسبات الحي والأسواق الشعبية\n• اطبع ملصقات واضحة على المدخل بأبرز المنتجات\n\n**4. المراجعات ⭐**\nاطلب من العملاء الراضين تقييم المطعم على Google — المراجعات الإيجابية تجذب عملاء جدد.`;
}

function buildCustomersReply(s: BusinessStats): string {
  return `😊 **تحسين تجربة العملاء**\n\n**1. السرعة ⚡**\nمعظم العملاء لا ينتظرون أكثر من 8 دقائق — تتبع وقت التحضير وقلّصه.\n\n**2. التخصيص 🎯**\nاستخدم نظام الولاء لتذكر تفضيلات العملاء الدائمين — يشعرهم بالتميز.\n\n**3. ملاحظات مباشرة 📋**\nاسأل العملاء عن تجربتهم قبل المغادرة — التعليق الفوري أكثر صدقاً من الاستبيان.\n\n**4. المعالجة السريعة للشكاوى 🛠️**\nأي شكوى → ردّ فوري + تعويض بسيط (قهوة مجانية) → يتحول العميل الساخط لمعجب.\n\n**5. النظافة والمظهر ✨**\nتفتيش يومي على النظافة وترتيب المكان — يرفع التقييمات تلقائياً.`;
}

function buildGrowthReply(s: BusinessStats): string {
  const growth = s.growthPct !== null ? pct(s.growthPct) : "—";
  const weekCmp = s.prevWeekRevenue > 0 ? `(الماضي: ${fmt(s.prevWeekRevenue)} ريال)` : "";

  return `📈 **تحليل النمو**\n\n• مبيعات هذا الأسبوع: **${fmt(s.weekRevenue)} ريال** ${weekCmp}\n• نسبة التغيير: **${growth}**\n• إجمالي الطلبات: ${s.weekOrders} طلب\n\n${s.growthPct !== null && s.growthPct < 0
    ? `⚠️ المبيعات في تراجع. اقتراحات للتعافي:\n• أطلق عرضاً سريعاً هذا الأسبوع\n• تحقق من جودة المنتجات وسرعة الخدمة\n• راجع أسعارك مقارنةً بالمنافسين`
    : `✅ المبيعات في اتجاه إيجابي. للحفاظ على النمو:\n• استمر في ما ينجح\n• جرب منتجاً جديداً كل شهر\n• ابنِ قاعدة عملاء دائمين عبر برنامج الولاء`}`;
}

function buildTipsReply(s: BusinessStats): string {
  const tips = [
    `📦 تابع المخزون يومياً من قسم "التنبيهات" لتجنب نفاد المنتجات الرائجة`,
    `🧾 فعّل طباعة الفاتورة التلقائية لكل طلب لإبراز الاحترافية`,
    `👥 استخدم "جدول الوردايات" لتوزيع الحضور بشكل متوازن`,
    `⭐ شجّع العملاء على تقييم تجربتهم — التقييمات ترفع الظهور في الخرائط`,
    `📊 راجع تقرير الأسبوع كل جمعة واتخذ قرار واحد بناءً عليه`,
    `🎯 ركّز على الـ 20% من المنتجات التي تحقق 80% من الإيراد`,
  ];
  return `💡 **نصائح سريعة لتحسين الأداء**\n\n${tips.map(t => `• ${t}`).join("\n")}\n\n📌 مبيعاتك الحالية: **${fmt(s.weekRevenue)} ريال هذا الأسبوع** — انطلق!`;
}

function buildUnknownReply(message: string, s: BusinessStats): string {
  return `🤔 فهمت سؤالك عن: "${message.slice(0, 60)}${message.length > 60 ? "..." : ""}"\n\nلا أملك إجابة محددة على هذا لكن إليك ما أعرفه الآن:\n\n• 📅 اليوم: ${fmt(s.todayRevenue)} ريال (${s.todayOrders} طلب)\n• 📆 الأسبوع: ${fmt(s.weekRevenue)} ريال (${s.weekOrders} طلب)\n${s.topItems[0] ? `• ⭐ الأكثر مبيعاً: ${s.topItems[0].name}` : ""}\n\nجرّب سؤالاً من هذه:\n• "حلل مبيعات اليوم"\n• "ما أكثر المنتجات مبيعاً؟"\n• "اقترح عروضاً ترويجية"`;
}

// ─── 3. MENU CONTENT GENERATOR ────────────────────────────────────────────────

interface MenuAssistInput {
  nameAr: string;
  nameEn?: string;
  category?: string;
  task: string;
  existingDescription?: string;
  existingIngredients?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  hot: "مشروب ساخن",
  cold: "مشروب بارد",
  desserts: "حلويات وكيك",
  bakery: "مخبوزات",
  sandwiches: "ساندوتشات",
  specialty: "مشروب متخصص",
  food: "وجبات",
  juices: "عصائر",
};

type CategoryKey = "hot" | "cold" | "desserts" | "bakery" | "sandwiches" | "specialty" | "food" | "juices" | "default";

// Description templates by category
const DESC_AR_TEMPLATES: Record<CategoryKey, string[]> = {
  hot: [
    "رحلة حسية دافئة تبدأ من أول رشفة — {name} يجمع بين عمق الطعم وكرم الرائحة في كوب واحد يمنحك دفء اللحظة.",
    "{name} — عصارة حبوب قهوة مختارة بعناية، تستيقظ على نكهتها المخملية كل صباح. جرّبه واحكم بنفسك.",
    "من أجواء المقاهي الراقية إلى يدك — {name} بنكهة عميقة وقوام ناعم يستحق أن يكون روتينك اليومي.",
  ],
  cold: [
    "{name} — برودة منعشة تلامس روحك في أشد اللحظات حرارةً. مزيج من النكهات الطازجة في كوب مثلج.",
    "انطلاقة مثلجة من النكهات الأصيلة — {name} يمزج الطزاجة بالطعم الراقي في كل رشفة تعيد شحن طاقتك.",
    "{name} المثلج — لحظة انتعاش حقيقية صنعها لك أمهر أيدي كافيه، في كوب شفاف يعكس جمال المكونات.",
  ],
  desserts: [
    "{name} — تحفة حلوة تذوب على لسانك بنعومة مخملية، تحكي قصة شوكولاتة وكريمة وفرحة حقيقية.",
    "لأن اللحظات الحلوة تستحق الأفضل — {name} بنكهة تحضن ذاكرتك وتعيدك لأجمل لحظات الطفولة.",
    "{name} بنسخته الفاخرة — طبقات من الطعم المتناغم تجعل كل لقمة تجربة لا تُنسى.",
  ],
  bakery: [
    "{name} طازج من الفرن — يملأ المكان برائحة لا تقاوم ويقدم لك دفء البيت في قالب مميز.",
    "خبزنا بالطريقة التقليدية واخترنا أجود المكونات — {name} يجمع بين القرمشة والطعم الغني في كل قطعة.",
    "{name} — وصفة مثالية بين الطحين المنتقى والزبدة الطازجة، محضّرة بشغف يومياً لتصلك في أبهى حلة.",
  ],
  sandwiches: [
    "{name} — ساندوتش يجمع أجود المكونات في كل لقمة، مُعدٌّ بعناية ليمنحك وجبة خفيفة لا تنساها.",
    "من أوراق الخبز الطازج حتى آخر مكون — {name} يقدم تجربة نكهة متكاملة تشبع الجسم وتسعد الذوق.",
    "{name} بمكوناته الطازجة والصوص المميز — وجبة سريعة لكنها تستحق التوقف والاستمتاع الحقيقي.",
  ],
  specialty: [
    "{name} — ابتكار فريد يخرج من حدود المعتاد، مزيج لا تجده في أي مكان آخر يذهلك بكل رشفة.",
    "وُلد {name} من إبداع بارستا محترف ومكونات تحدث الفرق — تجربة حسية كاملة في كل كوب.",
    "{name} خلطتنا السرية المميزة — يجمع بين النكهات الجريئة والتوازن المثالي الذي يجعلك تطلبه مراراً.",
  ],
  food: [
    "{name} — طبق أصيل مُعدّ بوصفة منزلية بمكونات طازجة تفوح منها رائحة الحنين والطيب.",
    "نقدّم لك {name} كما طُبخ دائماً — بصدق المكونات وسخاء النكهة ولمسة من عبق التراث.",
    "{name} بتوابل مختارة ولمسة طازجة — وجبة تشبع جوعك وتُبقي أثر طيبها في فمك طويلاً.",
  ],
  juices: [
    "{name} الطازج — عصارة فاكهة منتقاة في ذروة نضجها، تمنحك دفعة من الحيوية والانتعاش الحقيقي.",
    "من الفاكهة الطازجة مباشرةً إلى كوبك — {name} لا مواد حافظة ولا ألوان صناعية، طبيعي 100%.",
    "{name} — توليفة طبيعية من أجود الفواكه، مليئة بالفيتامينات والطعم الذي لا يُقاوَم.",
  ],
  default: [
    "{name} — منتج مميز أُعدّ بعناية فائقة ومكونات مختارة لتقديم تجربة تليق بذوقك الراقي.",
    "نفخر بتقديم {name} — مُحضَّر يومياً بأجود المواد الخام لضمان أعلى معايير الجودة والطعم.",
    "{name} — الخيار المثالي لمن يبحث عن التميز في كل تفصيلة، من المكونات حتى طريقة التقديم.",
  ],
};

const DESC_EN_TEMPLATES: string[] = [
  "{name} — a carefully crafted experience where premium ingredients meet expert preparation, delivering a moment worth savoring.",
  "Introducing {name}: a harmonious blend of quality and flavor, designed to delight your senses from first taste to last.",
  "{name} — our signature creation, built on the finest ingredients and a passion for excellence that shines through in every bite or sip.",
];

const INGREDIENTS_BY_CATEGORY: Record<string, string[]> = {
  hot: ["• إسبريسو مضاعف — 60ml", "• حليب مبخر — 150ml", "• رغوة حليب — 30ml", "• سكر — حسب الطلب"],
  cold: ["• إسبريسو بارد — 60ml", "• ثلج مجروش — 150g", "• حليب — 100ml", "• شراب السكر — 20ml"],
  desserts: ["• دقيق — 200g", "• بيض — 2 حبة", "• زبدة — 100g", "• سكر — 150g", "• فانيليا — 1 ملعقة"],
  bakery: ["• دقيق أبيض — 250g", "• خميرة — 7g", "• ملح — 1 ملعقة صغيرة", "• زبدة — 50g", "• ماء دافئ — 180ml"],
  sandwiches: ["• خبز طازج — قطعتان", "• دجاج أو لحم — 100g", "• خس وطماطم — كمية كافية", "• صوص — 30ml", "• جبنة — 30g"],
  default: ["• مكون رئيسي — كمية مناسبة", "• إضافات نكهة — حسب الوصفة", "• مُحلّي — حسب الطلب"],
};

const ADDONS_BY_CATEGORY: Record<string, Array<{ nameAr: string; price: number }>> = {
  hot: [
    { nameAr: "شراب فانيليا", price: 3 },
    { nameAr: "شراب كراميل", price: 3 },
    { nameAr: "شراب بندق", price: 3 },
    { nameAr: "حليب نباتي (شوفان)", price: 5 },
    { nameAr: "حجم كبير", price: 5 },
    { nameAr: "إسبريسو إضافي", price: 4 },
  ],
  cold: [
    { nameAr: "ثلج إضافي", price: 0 },
    { nameAr: "كريمة مخفوقة", price: 3 },
    { nameAr: "شراب كراميل", price: 3 },
    { nameAr: "حجم كبير", price: 5 },
    { nameAr: "حليب نباتي", price: 5 },
  ],
  desserts: [
    { nameAr: "صوص شوكولاتة", price: 3 },
    { nameAr: "آيسكريم إضافي", price: 6 },
    { nameAr: "مكسرات محمصة", price: 5 },
    { nameAr: "حصة مزدوجة", price: 12 },
  ],
  default: [
    { nameAr: "حجم كبير", price: 5 },
    { nameAr: "بدون سكر", price: 0 },
    { nameAr: "إضافة مميزة", price: 4 },
  ],
};

export function generateMenuContent(input: MenuAssistInput): string {
  const { nameAr, nameEn, category = "default", task, existingDescription } = input;
  const catKey = (Object.keys(CATEGORY_LABELS).includes(category) ? category : "default") as CategoryKey;

  function pickTemplate(arr: string[]): string {
    const idx = (nameAr.charCodeAt(0) + (nameEn?.charCodeAt(0) || 0)) % arr.length;
    return arr[idx];
  }

  function fillName(tpl: string): string {
    return tpl.replace(/{name}/g, nameAr);
  }

  switch (task) {
    case "description_ar": {
      const templates = DESC_AR_TEMPLATES[catKey] || DESC_AR_TEMPLATES.default;
      const base = fillName(pickTemplate(templates));
      if (existingDescription) {
        return `${base}\n\n(يمكنك تحسين وصفك الحالي: "${existingDescription.slice(0, 60)}...")`;
      }
      return base;
    }

    case "description_en": {
      const name = nameEn || nameAr;
      const tpl = pickTemplate(DESC_EN_TEMPLATES).replace(/{name}/g, name);
      return tpl;
    }

    case "description_both": {
      const arTemplates = DESC_AR_TEMPLATES[catKey] || DESC_AR_TEMPLATES.default;
      const ar = fillName(pickTemplate(arTemplates));
      const name = nameEn || nameAr;
      const en = pickTemplate(DESC_EN_TEMPLATES).replace(/{name}/g, name);
      return `🇸🇦 الوصف العربي:\n${ar}\n\n🇬🇧 English Description:\n${en}`;
    }

    case "name_en": {
      const base = nameEn || nameAr;
      const suggestions = [
        `1. Golden ${base} Blend`,
        `2. Signature ${base} Experience`,
        `3. Artisan ${base} Craft`,
      ];
      return suggestions.join("\n");
    }

    case "ingredients": {
      const defaults = INGREDIENTS_BY_CATEGORY[catKey] || INGREDIENTS_BY_CATEGORY.default;
      return `مكونات ${nameAr}:\n\n${defaults.join("\n")}\n\n(تتوفر الكميات لكوب/حصة واحدة — عدّل حسب وصفتك المحددة)`;
    }

    case "addons": {
      const addons = ADDONS_BY_CATEGORY[catKey] || ADDONS_BY_CATEGORY.default;
      const lines = addons.map(a => `• ${a.nameAr} — ${a.price > 0 ? `${a.price} ريال` : "مجاناً"}`);
      return `إضافات مقترحة لـ ${nameAr}:\n\n${lines.join("\n")}`;
    }

    case "flavor_profile": {
      const profiles: Record<string, string> = {
        hot: `☕ النكهة الرئيسية: قهوة غنية بطعم كاكاو خفيف وحموضة متوازنة\n🌸 الرائحة: زيوت بن طازجة مع نفحة من الكراميل الطبيعي\n🎨 اللون والمظهر: بني عميق مع تاج من الرغوة الذهبية\n✨ الإحساس في الفم: قوام مخملي ناعم مع لمسة طيبة تبقى\n💡 مقترح التقديم: مع قطعة كيك شوكولاتة أو تمر مكنوز`,
        cold: `❄️ النكهة الرئيسية: انتعاش حيوي مع حلاوة متوازنة\n🌸 الرائحة: عطر المواد الطازجة يفوح عند الفتح\n🎨 اللون والمظهر: ألوان زاهية بصرياً وثلج يلمع في الكوب\n✨ الإحساس في الفم: برودة لطيفة تطغى على الحرارة وتعيد الانتعاش\n💡 مقترح التقديم: مع قشة وشريحة فاكهة طازجة`,
        default: `🌟 النكهة الرئيسية: مزيج فاخر ومتوازن يناسب جميع الأذواق\n🌸 الرائحة: عبق المكونات الطازجة في كل شهقة\n🎨 اللون والمظهر: مظهر احترافي يعكس جودة التحضير\n✨ الإحساس في الفم: قوام مميز وطعم يبقى أثره طويلاً\n💡 مقترح التقديم: مع أي إضافة من قائمة الـ Add-ons`,
      };
      return profiles[catKey] || profiles.default;
    }

    default:
      return `تم توليد المحتوى لـ "${nameAr}" — راجع التفاصيل وعدّل حسب وصفتك.`;
  }
}

// ─── ADDONS structured output ─────────────────────────────────────────────────
// Returns structured addons for direct insertion into the form
export function generateStructuredAddons(category: string): Array<{ nameAr: string; price: number }> {
  const catKey = Object.keys(ADDONS_BY_CATEGORY).includes(category) ? category : "default";
  return ADDONS_BY_CATEGORY[catKey];
}
