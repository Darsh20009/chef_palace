import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LanguageToggleProps {
  variant?: "ghost" | "outline" | "default";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export function LanguageToggle({
  variant = "ghost",
  size = "sm",
  className,
  showLabel = true,
}: LanguageToggleProps) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const toggle = () => {
    const newLang = isAr ? "en" : "ar";
    i18n.changeLanguage(newLang);
    try {
      localStorage.setItem("i18nextLng", newLang);
    } catch {}
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLang;
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggle}
      className={cn("gap-1.5", className)}
      data-testid="button-header-language-toggle"
      title={isAr ? "Switch to English" : "التحويل إلى العربية"}
    >
      <Languages className="h-4 w-4" />
      {showLabel && (
        <span className="text-xs font-semibold">{isAr ? "EN" : "عربي"}</span>
      )}
    </Button>
  );
}
