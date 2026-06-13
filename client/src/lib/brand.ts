// ═══════════════════════════════════════════════════════════════════════════
//  ██████╗██╗  ██╗███████╗███████╗███████╗    ██████╗  █████╗ ██╗      █████╗  ██████╗███████╗
// ██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝    ██╔══██╗██╔══██╗██║     ██╔══██╗██╔════╝██╔════╝
// ██║     ███████║█████╗  █████╗  ███████╗    ██████╔╝███████║██║     ███████║██║     █████╗
// ██║     ██╔══██║██╔══╝  ██╔══╝  ╚════██║    ██╔═══╝ ██╔══██║██║     ██╔══██║██║     ██╔══╝
// ╚██████╗██║  ██║███████╗██║     ███████║    ██║     ██║  ██║███████╗██║  ██║╚██████╗███████╗
//  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝     ╚══════╝    ╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝
//
//  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
//  │                        MASTER BRAND CONFIGURATION — SINGLE SOURCE OF TRUTH                  │
//  │                                                                                             │
//  │  This file controls EVERY branding detail across the entire مكان الشيف البخاري system:          │
//  │  • System name (Arabic + English)                                                           │
//  │  • Logo paths (customer app, staff app, admin panel)                                        │
//  │  • Primary & accent colors (HSL format for Tailwind + CSS variables)                        │
//  │  • App metadata (title, description, keywords, Open Graph)                                  │
//  │  • PWA manifest settings (theme color, background color, display name)                      │
//  │  • Contact / social info (email, phone, website, social handles)                            │
//  │  • Loyalty / points program name                                                            │
//  │  • Email template branding                                                                  │
//  │                                                                                             │
//  │  HOW TO REBRAND:                                                                            │
//  │  1. Change the values below                                                                 │
//  │  2. Run: npm run dev — the entire system reflects the new brand instantly                   │
//  └─────────────────────────────────────────────────────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════════════════

export const brand = {

  // ───────────────────────────────────────────────────────────────────────
  //  SYSTEM IDENTITY
  // ───────────────────────────────────────────────────────────────────────

  /** Full system name in English — shown in headers, titles, receipts, emails */
  nameEn: "مكان الشيف البخاري",

  /** Full system name in Arabic — shown in Arabic UI, receipts, notifications */
  nameAr: "مكان الشيف البخاري",

  /** Short display name used in tight spaces (PWA label, browser tab) */
  shortNameEn: "مكان الشيف",

  /** Short display name in Arabic */
  shortNameAr: "مكان الشيف",

  /** Internal system/platform brand — shown in the admin/staff panel header */
  platformNameEn: "مكان الشيف — الإدارة",

  /** Internal platform name in Arabic */
  platformNameAr: "مكان الشيف — الإدارة",

  /** Tagline shown under the logo in customer-facing screens */
  taglineEn: "أصالة البخاري بنكهة الشيف",

  /** Tagline in Arabic */
  taglineAr: "أصالة البخاري بنكهة الشيف",

  /** One-line marketing description (used in meta tags, manifests) */
  descriptionEn: "مكان الشيف البخاري — أشهى وجبات البخاري الأصيلة في الرياض. اطلب الآن وجبتك من أرز بخاري، دجاج بخاري، لحم بخاري، زربيان، ومندي محضرة بأيدي الشيف مع توصيل سريع.",

  /** Arabic marketing description */
  descriptionAr: "مكان الشيف البخاري — أشهى وجبات البخاري الأصيلة في الرياض. اطلب الآن وجبتك من أرز بخاري، دجاج بخاري، لحم بخاري، زربيان، ومندي محضرة بأيدي الشيف مع توصيل سريع.",

  /** Keywords for SEO meta tag */
  keywords: "مكان الشيف البخاري, مكان الشيف, شيف بخاري, بخاري الرياض, مطعم بخاري, أرز بخاري, رز بخاري, بخاري, chefsplace, chefsplace.online, Chef Bukhari, مطعم شيف بخاري, أكلات بخارية, وجبات بخارية, بخاري أصيل, بخاري طازج, أفضل بخاري الرياض, توصيل بخاري الرياض, طلب بخاري, دجاج بخاري, لحم بخاري, زربيان, مندي الرياض, مطاعم الرياض, مطعم عربي الرياض",


  // ───────────────────────────────────────────────────────────────────────
  //  LOGO & VISUAL ASSETS
  //  Paths are relative to /public in the web app
  //  Use @assets/... for imported assets in components
  // ───────────────────────────────────────────────────────────────────────

  /** Main customer-facing logo (used in customer app, receipts, loyalty card, QR cards) */
  logoCustomer: "/logo.png",

  /** Staff/employee portal logo (used in sidebars, login screens, employee app) */
  logoStaff: "/employee-logo.png",

  /** Favicon (browser tab icon) */
  favicon: "/logo.png",

  /** Apple touch icon (iOS home screen) */
  appleTouchIcon: "/apple-touch-icon.png",

  /** Logo URL for imported asset (Vite @assets path) — used in TSX files with import */
  logoAssetCustomer: "logo.png",

  /** Staff logo asset path */
  logoAssetStaff: "employee-logo.png",

  /** Logo URL for email templates (must be absolute/public URL) */
  logoEmailUrl: "https://www.chefsplace.online/logo.png",

  /** Open Graph / social share image */
  ogImageUrl: "/logo.png",


  // ───────────────────────────────────────────────────────────────────────
  //  COLORS  — HSL format (H S% L%) for Tailwind CSS variable injection
  //  مكان الشيف البخاري — برتقالي نحاسي دافئ مع خلفية داكنة
  // ───────────────────────────────────────────────────────────────────────

  colors: {
    /** Primary brand color — warm copper orange (matches logo) */
    primary: {
      h: 25,
      s: 72,
      l: 47,
      hex: "#C06520",
    },

    /** Lighter primary variant (hover states, dark mode) */
    primaryLight: {
      h: 25,
      s: 68,
      l: 60,
      hex: "#D4852E",
    },

    /** App background — near-black */
    background: {
      h: 0,
      s: 0,
      l: 4,
      hex: "#0a0a0a",
    },

    /** Card/surface color */
    surface: {
      h: 0,
      s: 0,
      l: 7,
      hex: "#111111",
    },

    /** Text accent (headings, active items) */
    accent: {
      h: 35,
      s: 85,
      l: 60,
      hex: "#E8962A",
    },
  },


  // ───────────────────────────────────────────────────────────────────────
  //  PWA / MANIFEST SETTINGS
  // ───────────────────────────────────────────────────────────────────────

  /** Theme color used by browser chrome */
  themeColor: "#C06520",

  /** Background color shown while PWA is loading */
  pwaBackgroundColor: "#0a0a0a",

  /** App display mode */
  pwaDisplay: "standalone" as const,


  // ───────────────────────────────────────────────────────────────────────
  //  CONTACT & SOCIAL
  // ───────────────────────────────────────────────────────────────────────

  website: "chefsplace.online",
  websiteUrl: "https://www.chefsplace.online",

  /** Branch phone number (Saudi format) */
  phone: "0536558528",
  /** Branch phone in international format for tel: links */
  phoneIntl: "+966536558528",
  /** Branch phone display format */
  phoneDisplay: "+966 53 655 8528",
  /** Branch phone for WhatsApp (no +) */
  phoneWhatsapp: "966536558528",

  /** Google Maps link to branch location */
  locationUrl: "https://maps.app.goo.gl/XMZVc2cYWBkmgJZW6",
  /** Human-readable address */
  locationDisplay: "الرياض، المملكة العربية السعودية",

  emailNoReply: "noreply@chefsplace.online",
  emailSupport: "support@chefsplace.online",

  social: {
    instagram: "@chefsplace",
    twitter: "@chefsplace",
    snapchat: "@chefsplace",
    tiktok: "@chefsplace",
  },

  // ───────────────────────────────────────────────────────────────────────
  //  BUSINESS INFO
  // ───────────────────────────────────────────────────────────────────────

  commercialRegister: "1009092745",
  taxNumber: "310894802100003",
  registrationNumber: "1009092745",
  saudiBusinessUrl: "https://qr.saudibusiness.gov.sa/viewcr?nCrNumber=opQsRLgqEFrL8PpAgImEew==",


  // ───────────────────────────────────────────────────────────────────────
  //  LOYALTY / POINTS PROGRAM
  // ───────────────────────────────────────────────────────────────────────

  pointsBrandEn: "نقاط مكان الشيف",
  pointsBrandAr: "نقاط مكان الشيف",

  cardBrandEn: "بطاقة مكان الشيف",
  cardBrandAr: "بطاقة مكان الشيف",

  loyaltyTaglineEn: "برنامج ولاء مكان الشيف",
  loyaltyTaglineAr: "برنامج ولاء مكان الشيف",


  // ───────────────────────────────────────────────────────────────────────
  //  AI ASSISTANT IDENTITY
  // ───────────────────────────────────────────────────────────────────────

  aiAssistantNameEn: "مساعد مكان الشيف الذكي",
  aiAssistantNameAr: "مساعد مكان الشيف الذكي",


  // ───────────────────────────────────────────────────────────────────────
  //  COPYRIGHT
  // ───────────────────────────────────────────────────────────────────────

  copyrightEn: `© ${new Date().getFullYear()} مكان الشيف البخاري —   جميع الحقوق محفوظة`,
  copyrightAr: `© ${new Date().getFullYear()} مكان الشيف البخاري — جميع الحقوق محفوظة`,

} as const;


// ═══════════════════════════════════════════════════════════════════════════
//  HELPER UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/** Returns a color as a CSS HSL string, e.g. "38 75% 42%" */
export function hsl(color: { h: number; s: number; l: number }): string {
  return `${color.h} ${color.s}% ${color.l}%`;
}

/** Returns full hsl() call, e.g. "hsl(38, 75%, 42%)" */
export function hslFull(color: { h: number; s: number; l: number }): string {
  return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
}

/**
 * Applies brand colors to CSS custom properties at runtime.
 * Call this once in your app entry point (main.tsx or App.tsx).
 */
export function applyBrandColors(): void {
  const root = document.documentElement;
  const { colors } = brand;

  root.style.setProperty("--primary", hsl(colors.primary));
  root.style.setProperty("--primary-light", hsl(colors.primaryLight));
  root.style.setProperty("--ring", hsl(colors.primary));
  root.style.setProperty("--success", hsl(colors.primary));

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", brand.themeColor);
  }
}

/**
 * Updates the browser tab title with the brand name.
 */
export function setPageTitle(pageTitle?: string): void {
  document.title = pageTitle
    ? `${pageTitle} | ${brand.nameEn}`
    : `${brand.nameEn} | ${brand.taglineEn}`;
}

/** Returns the full display name based on language preference */
export function getBrandName(lang: "ar" | "en" = "ar"): string {
  return lang === "ar" ? brand.nameAr : brand.nameEn;
}

/** Returns the platform name (used in staff/admin portals) */
export function getPlatformName(lang: "ar" | "en" = "ar"): string {
  return lang === "ar" ? brand.platformNameAr : brand.platformNameEn;
}

/** Returns the tagline */
export function getTagline(lang: "ar" | "en" = "ar"): string {
  return lang === "ar" ? brand.taglineAr : brand.taglineEn;
}

/** Returns copyright text */
export function getCopyright(lang: "ar" | "en" = "ar"): string {
  return lang === "ar" ? brand.copyrightAr : brand.copyrightEn;
}

export default brand;
