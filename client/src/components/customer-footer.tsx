import { useTranslation } from "react-i18next";
import { brand } from "@/lib/brand";
import { useQuery } from "@tanstack/react-query";
import { SiInstagram, SiX as SiXIcon, SiFacebook, SiSnapchat, SiTiktok, SiWhatsapp } from "react-icons/si";
import * as SiIcons from "react-icons/si";

const SiTwitter = (SiIcons as any).SiTwitter || SiXIcon;

export function CustomerFooter() {
  const { t } = useTranslation();
  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
  });

  const socialIcons: Record<string, any> = {
    instagram: SiInstagram,
    twitter: SiTwitter,
    facebook: SiFacebook,
    snapchat: SiSnapchat,
    tiktok: SiTiktok,
    whatsapp: SiWhatsapp,
  };

  return (
    <footer className="bg-muted/30 py-12 border-t mb-16 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      
      <div className="container px-4 flex flex-col items-center gap-10">
        {/* Social Section */}
        <div className="flex flex-col items-center gap-4 w-full">
          <h4 className="text-sm font-bold text-primary/60 uppercase tracking-widest">{t("footer.connect_with_us")}</h4>
          {businessConfig?.socialLinks && (
            <div className="flex items-center gap-6 flex-wrap justify-center">
              {Object.entries(businessConfig.socialLinks).map(([platform, url]) => {
                if (!url) return null;
                const Icon = socialIcons[platform];
                if (!Icon) return null;
                return (
                  <a
                    key={platform}
                    href={url as string}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative"
                    aria-label={platform}
                  >
                    <div className="absolute -inset-2 bg-primary/5 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300" />
                    <Icon className="w-6 h-6 text-primary/70 group-hover:text-primary transition-colors duration-300 relative" />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Legal & Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full max-w-4xl border-y border-primary/5 py-10 my-4">
          <div className="flex flex-col items-center gap-4">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-primary/5">
              <img 
                src="https://assets.zid.store/themes/f9f0914d-3c58-493b-bd83-260ed3cb4e82/business_center.png" 
                loading="lazy" 
                alt="Saudi Business Center Certification" 
                className="h-10 w-auto grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all" 
              />
            </div>
            <a 
              href="https://qr.saudibusiness.gov.sa/viewcr?nCrNumber=opQsRLgqEFrL8PpAgImEew==" 
              target="_blank" 
              rel="noreferrer" 
              className="text-xs text-muted-foreground hover:text-primary transition-colors font-ibm-arabic"
              data-testid="link-cr-saudi-business"
            >
              {t("legal.cr")}
            </a>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <div className="text-xl font-bold text-primary tracking-tighter">{brand.nameEn}</div>
            <div className="text-xs text-muted-foreground/60 font-ibm-arabic max-w-[200px]">
              {t("footer.tagline") || "نقدم لك تجربة قهوة لا تُنسى في ينبع"}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3">
            <div className="px-4 py-1.5 bg-primary/5 rounded-full border border-primary/10">
              <div className="text-xs font-bold text-primary font-ibm-arabic">{t("legal.vat")}</div>
            </div>
            <div className="text-[10px] text-muted-foreground/60 text-center font-ibm-arabic leading-relaxed">
              جميع الأسعار تشمل ضريبة القيمة المضافة<br/>رقم التسجيل: 312718675800003
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-[11px] font-medium text-muted-foreground/40 text-center uppercase tracking-[0.2em]">
            {brand.copyrightEn.toUpperCase()}
          </div>
          <div className="h-1 w-8 bg-primary/20 rounded-full" />
        </div>
      </div>
    </footer>
  );
}
