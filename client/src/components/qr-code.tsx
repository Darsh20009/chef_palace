import { QrCode } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface QRCodeProps {
 url: string;
 size?: "sm" | "md" | "lg" | "xl";
 showURL?: boolean;
 title?: string;
 className?: string;
}

export default function QRCodeComponent({ 
 url, 
 size = "md", 
 showURL = true, 
 title = "امسح للطلب",
 className = ""
}: QRCodeProps) {
 const sizeClasses = {
 sm: "w-24 h-24",
 md: "w-32 h-32", 
 lg: "w-48 h-48",
 xl: "w-64 h-64"
 };

 const generateQRDataURL = (text: string) => {
  // Enhanced QR code with coffee theme colors
  const finalUrl = text.includes('http') ? text.replace(/https?:\/\/localhost:\d+/, window.location.origin) : `${window.location.origin}${text}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(finalUrl)}&bgcolor=FFFBEB&color=92400E&qzone=3&format=png&ecc=M`;
 };

 return (
 <div className={`relative ${className}`}>
 {/* Glowing background effect */}
 <div className="absolute inset-0 bg-gradient-to-br from-amber-300/30 to-orange-400/30 rounded-3xl blur-2xl animate-pulse"></div>
 
 <Card className="relative bg-gradient-to-br from-white via-amber-50/80 to-orange-50/60 border-3 border-amber-300/70 shadow-2xl backdrop-blur-sm overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-br from-amber-100/20 to-orange-100/20"></div>
 
 <CardContent className="relative p-8 text-center space-y-6">
 {title && (
 <div className="space-y-2">
 <div className="flex items-center justify-center space-x-2 space-x-reverse">
 <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
 <h3 className="font-amiri text-2xl font-bold text-primary">
 {title}
 </h3>
 <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
 </div>
 <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto"></div>
 </div>
 )}
 
 <div className="flex justify-center">
 <div className="relative group">
 {/* Multiple glow layers for depth */}
 <div className="absolute inset-0 bg-amber-400/30 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
 <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-500 delay-75"></div>
 
 <div className="relative bg-white rounded-3xl p-6 border-4 border-amber-200 shadow-2xl group-hover:shadow-amber-300/50 transition-all duration-500 group-hover:scale-105">
 {/* Corner decorations */}
 <div className="absolute top-2 left-2 w-3 h-3 border-l-2 border-t-2 border-amber-400 rounded-tl-lg"></div>
 <div className="absolute top-2 right-2 w-3 h-3 border-r-2 border-t-2 border-amber-400 rounded-tr-lg"></div>
 <div className="absolute bottom-2 left-2 w-3 h-3 border-l-2 border-b-2 border-amber-400 rounded-bl-lg"></div>
 <div className="absolute bottom-2 right-2 w-3 h-3 border-r-2 border-b-2 border-amber-400 rounded-br-lg"></div>
 
 <img
 src={generateQRDataURL(url)}
 alt={`QR Code for ${url}`}
 className={`${sizeClasses[size]} mx-auto rounded-2xl shadow-lg`}
 loading="lazy"
 onError={(e) => {
 e.currentTarget.style.display = 'none';
 const parent = e.currentTarget.parentElement;
 if (parent) {
 parent.innerHTML = `
 <div class="flex flex-col items-center justify-center ${sizeClasses[size]} bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl border-2 border-amber-300 shadow-lg">
 <div class="text-amber-600 mb-3">
 <svg class="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
 <path d="M3 11v8h8v-8H3zm2 6V13h4v4H5zm6-16v8h8V1h-8zm6 6V3h-4v4h4zM1 21V11H11V21H1zm2-8v6h6V13H3zm8-10V11H21V3H11zm8 6V5H13v4h6z"/>
 </svg>
 </div>
 <span class="text-sm text-amber-700 font-bold">QR Code</span>
 </div>
 `;
 }
 }}
 />
 </div>
 </div>
 </div>

 {showURL && (
 <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border-2 border-amber-200/70 shadow-lg">
 <p className="text-amber-800 font-mono text-sm break-all font-semibold">
 {url}
 </p>
 </div>
 )}

 <div className="space-y-3">
 <div className="flex items-center justify-center space-x-3 space-x-reverse text-amber-700">
 <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg">
 <QrCode className="w-4 h-4 text-white" />
 </div>
 <span className="text-lg font-bold font-amiri">
 وجّه الكاميرا نحو الرمز للطلب
 </span>
 <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg">
 <span className="text-white text-xs"></span>
 </div>
 </div>
 
 {/* Animated instruction dots */}
 <div className="flex justify-center space-x-2 space-x-reverse">
 {[0, 1, 2].map((i) => (
 <div 
 key={i}
 className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"
 style={{ animationDelay: `${i * 0.3}s` }}
 ></div>
 ))}
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 );
}