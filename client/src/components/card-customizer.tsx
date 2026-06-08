import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Palette, Sparkles, Eye, Check } from "lucide-react";

export interface CardDesign {
  id: string;
  name: string;
  style: 'gradient' | 'solid' | 'pattern';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  preview: {
    bg: string;
    text: string;
  };
}

export const CARD_DESIGNS: CardDesign[] = [
  {
    id: 'classic-gold',
    name: 'الذهبي الكلاسيكي',
    style: 'gradient',
    colors: {
      primary: '#FFD700',
      secondary: '#FFA500',
      accent: '#8B4513'
    },
    preview: {
      bg: 'linear-gradient(135deg, #FFD700 0%, #FFA500 25%, #FF8C00 50%, #D4A574 75%, #8B4513 100%)',
      text: '#ffffff'
    }
  },
  {
    id: 'velvet-brown',
    name: 'البني المخملي',
    style: 'gradient',
    colors: {
      primary: '#8B6F47',
      secondary: '#6F5C3E',
      accent: '#4A3728'
    },
    preview: {
      bg: 'linear-gradient(135deg, #A0826D 0%, #8B6F47 50%, #6F5C3E 100%)',
      text: '#ffffff'
    }
  },
  {
    id: 'espresso-dark',
    name: 'الإسبريسو الداكن',
    style: 'gradient',
    colors: {
      primary: '#2F1B0C',
      secondary: '#1a1410',
      accent: '#0d0a08'
    },
    preview: {
      bg: 'linear-gradient(135deg, #4A2C1A 0%, #2F1B0C 50%, #1a1410 100%)',
      text: '#f5f5dc'
    }
  },
  {
    id: 'caramel-sunrise',
    name: 'الكراميل والشروق',
    style: 'gradient',
    colors: {
      primary: '#E6B87D',
      secondary: '#D4A574',
      accent: '#C19A6B'
    },
    preview: {
      bg: 'linear-gradient(135deg, #FFE4B5 0%, #E6B87D 50%, #D4A574 100%)',
      text: '#5a4a3a'
    }
  },
  {
    id: 'premium-copper',
    name: 'النحاس البريق',
    style: 'gradient',
    colors: {
      primary: '#B87333',
      secondary: '#A0522D',
      accent: '#8B4513'
    },
    preview: {
      bg: 'linear-gradient(135deg, #D4845C 0%, #B87333 50%, #A0522D 100%)',
      text: '#ffffff'
    }
  },
  {
    id: 'midnight-mocha',
    name: 'موكا منتصف الليل',
    style: 'gradient',
    colors: {
      primary: '#3C2415',
      secondary: '#5A3A2A',
      accent: '#2F1F14'
    },
    preview: {
      bg: 'linear-gradient(135deg, #5A3A2A 0%, #3C2415 50%, #2F1F14 100%)',
      text: '#e8dcc8'
    }
  },
  {
    id: 'rose-latte',
    name: 'لاتيه الوردة',
    style: 'gradient',
    colors: {
      primary: '#D4A5A5',
      secondary: '#C99B9B',
      accent: '#9B7E7E'
    },
    preview: {
      bg: 'linear-gradient(135deg, #F4D8D8 0%, #D4A5A5 50%, #C99B9B 100%)',
      text: '#4a3838'
    }
  },
  {
    id: 'forest-matcha',
    name: 'ماتشا الغابة',
    style: 'gradient',
    colors: {
      primary: '#6B8E23',
      secondary: '#556B2F',
      accent: '#3D4D1F'
    },
    preview: {
      bg: 'linear-gradient(135deg, #8FBC8F 0%, #6B8E23 50%, #556B2F 100%)',
      text: '#ffffff'
    }
  }
];

interface CardCustomizerProps {
  selectedDesign?: string;
  onDesignSelect: (design: CardDesign) => void;
  customerName: string;
  customerPhone: string;
}

export default function CardCustomizer({
  selectedDesign = 'classic-gold',
  onDesignSelect,
  customerName,
  customerPhone
}: CardCustomizerProps) {
  const [previewDesign, setPreviewDesign] = useState<CardDesign | null>(
    CARD_DESIGNS.find(d => d.id === selectedDesign) || CARD_DESIGNS[0]
  );

  const handleSelectDesign = (design: CardDesign) => {
    setPreviewDesign(design);
    onDesignSelect(design);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="designs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="designs" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            التصاميم
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            معاينة
          </TabsTrigger>
        </TabsList>

        {/* Designs Tab */}
        <TabsContent value="designs" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            اختر تصميم البطاقة الذي يعجبك من الخيارات أدناه
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {CARD_DESIGNS.map((design) => (
              <button
                key={design.id}
                onClick={() => handleSelectDesign(design)}
                className={`relative group rounded-lg overflow-hidden transition-all duration-300 border-2 ${
                  previewDesign?.id === design.id
                    ? 'border-primary shadow-lg scale-105'
                    : 'border-transparent hover:scale-110'
                }`}
              >
                {/* Card Preview Thumbnail */}
                <div
                  className="w-full h-24 flex items-center justify-center relative"
                  style={{ background: design.preview.bg }}
                >
                  {/* Card Chip */}
                  <div
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded border border-white/30"
                    style={{
                      background: design.preview.bg
                    }}
                  >
                    <div className="grid grid-cols-2 gap-px p-0.5 h-full">
                      <div className="bg-white/10 rounded-[1px]"></div>
                      <div className="bg-white/10 rounded-[1px]"></div>
                      <div className="bg-white/10 rounded-[1px]"></div>
                      <div className="bg-white/10 rounded-[1px]"></div>
                    </div>
                  </div>

                  {/* Coffee Cup Icon */}
                  <div
                    className="text-xl opacity-80"
                    style={{ color: design.preview.text }}
                  >
                    ☕
                  </div>

                  {/* Selection Checkmark */}
                  {previewDesign?.id === design.id && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="bg-primary rounded-full p-2 text-white">
                        <Check className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Design Name */}
                <div className="p-2 bg-card">
                  <p className="text-xs font-semibold text-center truncate text-foreground">
                    {design.name}
                  </p>
                </div>

                {/* New Badge for selected */}
                {previewDesign?.id === design.id && (
                  <Badge className="absolute -top-2 -left-2 bg-primary text-primary-foreground">
                    مختار
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          {previewDesign && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  معاينة البطاقة
                </h4>
                {/* Full Card Preview */}
                <div
                  className="h-56 rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between p-6 border-4 border-white relative group hover:scale-105 transition-transform duration-300"
                  style={{
                    background: previewDesign.preview.bg,
                    boxShadow:
                      '0 20px 60px rgba(0,0,0,0.3), inset -2px -2px 8px rgba(0,0,0,0.1), inset 2px 2px 8px rgba(255,255,255,0.2)'
                  }}
                >
                  {/* Card Chip */}
                  <div
                    className="absolute top-4 right-4 w-10 h-10 rounded-lg border-2 border-white/40"
                    style={{
                      background: previewDesign.preview.bg,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div className="grid grid-cols-2 gap-1 p-1.5 h-full">
                      <div className="bg-white/10 rounded"></div>
                      <div className="bg-white/10 rounded"></div>
                      <div className="bg-white/10 rounded"></div>
                      <div className="bg-white/10 rounded"></div>
                    </div>
                  </div>

                  {/* Branding */}
                  <div
                    className="absolute top-4 left-4 text-lg font-bold drop-shadow-lg"
                    style={{ color: previewDesign.preview.text }}
                  >
                    ☕ مكان الشيف البخاري
                  </div>

                  {/* Main Content */}
                  <div className="relative h-full flex flex-col justify-between">
                    {/* Card Number */}
                    <div>
                      <p
                        className="text-xs opacity-75 tracking-widest mb-1"
                        style={{ color: previewDesign.preview.text }}
                      >
                        رقم البطاقة
                      </p>
                      <p
                        className="text-xl font-mono tracking-wider font-bold drop-shadow-lg"
                        style={{ color: previewDesign.preview.text }}
                      >
                        •••• •••• •••• 2024
                      </p>
                    </div>

                    {/* Bottom Info */}
                    <div className="flex justify-between items-end">
                      <div>
                        <p
                          className="text-xs opacity-75 mb-0.5"
                          style={{ color: previewDesign.preview.text }}
                        >
                          {customerName.substring(0, 15)}
                        </p>
                        <p
                          className="text-sm font-bold drop-shadow-lg"
                          style={{ color: previewDesign.preview.text }}
                        >
                          {customerPhone}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-xs opacity-75 mb-0.5"
                          style={{ color: previewDesign.preview.text }}
                        >
                          صلاحية
                        </p>
                        <p
                          className="text-sm font-bold drop-shadow-lg"
                          style={{ color: previewDesign.preview.text }}
                        >
                          حياة
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Decorative corner elements */}
                  <div
                    className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 opacity-50 rounded-tl-lg"
                    style={{ borderColor: previewDesign.preview.text }}
                  ></div>
                  <div
                    className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 opacity-50 rounded-tr-lg"
                    style={{ borderColor: previewDesign.preview.text }}
                  ></div>
                  <div
                    className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 opacity-50 rounded-bl-lg"
                    style={{ borderColor: previewDesign.preview.text }}
                  ></div>
                  <div
                    className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 opacity-50 rounded-br-lg"
                    style={{ borderColor: previewDesign.preview.text }}
                  ></div>
                </div>
              </div>

              {/* Design Details */}
              <Card className="border border-border">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {previewDesign.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">
                      نمط التصميم
                    </Label>
                    <p className="text-sm mt-1 capitalize">
                      {previewDesign.style === 'gradient'
                        ? 'متدرج'
                        : previewDesign.style === 'solid'
                          ? 'متجانس'
                          : 'نمط'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">
                      الألوان الرئيسية
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <div
                        className="w-8 h-8 rounded-full border-2 border-border"
                        style={{ backgroundColor: previewDesign.colors.primary }}
                        title="اللون الأساسي"
                      ></div>
                      <div
                        className="w-8 h-8 rounded-full border-2 border-border"
                        style={{ backgroundColor: previewDesign.colors.secondary }}
                        title="اللون الثانوي"
                      ></div>
                      <div
                        className="w-8 h-8 rounded-full border-2 border-border"
                        style={{ backgroundColor: previewDesign.colors.accent }}
                        title="اللون الإضافي"
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={() => handleSelectDesign(previewDesign)}
                className="w-full"
                size="lg"
              >
                <Check className="w-4 h-4 ml-2" />
                تأكيد هذا التصميم
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
