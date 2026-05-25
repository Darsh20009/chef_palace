import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Plus, Minus } from "lucide-react";

export interface SidebarItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
  active?: boolean;
  activeClass?: string;
  danger?: boolean;
  shortcut?: string;
}

interface QuickSidebarProps {
  groups: SidebarItem[][];
  bottomItems?: SidebarItem[];
}

type SizeKey = "sm" | "md" | "lg";

const SIZE_CONFIG: Record<SizeKey, { aside: string; btn: string; iconScale: string; gap: string }> = {
  sm: { aside: "w-[44px]", btn: "w-8 h-8 rounded-lg",  iconScale: "scale-75",  gap: "gap-0.5" },
  md: { aside: "w-[52px]", btn: "w-10 h-10 rounded-xl", iconScale: "scale-100", gap: "gap-0.5" },
  lg: { aside: "w-[64px]", btn: "w-12 h-12 rounded-2xl", iconScale: "scale-110", gap: "gap-1"   },
};

const STORAGE_KEY = "pos-quick-sidebar-size";

export function QuickSidebar({ groups, bottomItems = [] }: QuickSidebarProps) {
  const [size, setSize] = useState<SizeKey>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SizeKey | null;
    return saved && saved in SIZE_CONFIG ? saved : "md";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, size);
  }, [size]);

  const cfg = SIZE_CONFIG[size];

  const shrink = () => setSize(prev => prev === "lg" ? "md" : prev === "md" ? "sm" : "sm");
  const grow   = () => setSize(prev => prev === "sm" ? "md" : prev === "md" ? "lg" : "lg");

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        dir="ltr"
        className={cn("shrink-0 flex flex-col border-r bg-card z-10 h-full overflow-hidden transition-all duration-200", cfg.aside)}
      >
        <div className={cn("flex-1 flex flex-col items-center py-2 overflow-y-auto no-scrollbar", cfg.gap)}>
          {groups.map((group, gi) => (
            <div key={gi} className={cn("w-full flex flex-col items-center", cfg.gap)}>
              {gi > 0 && <div className="w-7 border-t border-border/50 my-1" />}
              {group.map((item, ii) => (
                <SidebarBtn key={ii} item={item} cfg={cfg} />
              ))}
            </div>
          ))}
        </div>

        {/* Size controls */}
        <div className="flex flex-col items-center py-1.5 border-t border-border/40 gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={grow}
                disabled={size === "lg"}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-all"
                data-testid="sidebar-size-grow"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">تكبير</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={shrink}
                disabled={size === "sm"}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-all"
                data-testid="sidebar-size-shrink"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">تصغير</TooltipContent>
          </Tooltip>
        </div>

        {bottomItems.length > 0 && (
          <div className={cn("flex flex-col items-center pb-2 pt-1 border-t gap-0.5")}>
            {bottomItems.map((item, ii) => (
              <SidebarBtn key={ii} item={item} cfg={cfg} />
            ))}
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

function SidebarBtn({ item, cfg }: { item: SidebarItem; cfg: typeof SIZE_CONFIG[SizeKey] }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={item.onClick}
          data-testid={`quick-sidebar-${item.label}`}
          className={cn(
            "relative flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            cfg.btn,
            item.danger
              ? "text-destructive hover:bg-destructive/10"
              : item.active
              ? item.activeClass ?? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <span className={cn("flex items-center justify-center transition-transform", cfg.iconScale)}>
            {item.icon}
          </span>
          {!!item.badge && item.badge > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center px-0.5 leading-none pointer-events-none">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
          {item.shortcut && (
            <span className="absolute bottom-0.5 left-0.5 text-[8px] font-bold text-muted-foreground/70 leading-none pointer-events-none hidden sm:block">
              {item.shortcut}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="font-semibold text-xs">
        <div>{item.label}</div>
        {item.shortcut && (
          <div className="text-muted-foreground text-[10px] mt-0.5">{item.shortcut}</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
