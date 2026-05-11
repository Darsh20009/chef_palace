import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Check, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DrinkImage {
  filename: string;
  url: string;
  uploadedAt: string;
}

interface ImageLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  currentUrl?: string;
}

export function ImageLibraryModal({ open, onClose, onSelect, currentUrl }: ImageLibraryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string | null>(currentUrl || null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { data: images = [], isLoading } = useQuery<DrinkImage[]>({
    queryKey: ["/api/drink-images"],
    enabled: open,
    staleTime: 0,
  });

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "نوع الملف غير مدعوم", description: "يُرجى اختيار ملف صورة", variant: "destructive" });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "حجم الملف كبير جداً", description: "الحد الأقصى 15MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload-drink-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      let errorMsg = "فشل رفع الصورة";
      if (!res.ok) {
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }
      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/drink-images"] });
      setSelected(data.url);
      toast({ title: "✓ تم رفع الصورة", description: "الصورة محفوظة في المكتبة" });
    } catch (err: any) {
      toast({ title: "خطأ في رفع الصورة", description: err?.message || "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#12100e] border-primary/20 max-w-2xl w-full max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b border-primary/10">
          <DialogTitle className="text-accent flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            مكتبة الصور
          </DialogTitle>
        </DialogHeader>

        {/* Upload area */}
        <div className="px-4 py-3 border-b border-primary/10 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />

          {/* Drag & drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? "border-accent bg-accent/10"
                : "border-primary/30 hover:border-primary/50 hover:bg-primary/5"
            }`}
            data-testid="drop-zone-image"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-accent text-sm">جاري رفع الصورة...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className={`w-8 h-8 ${isDragOver ? 'text-accent' : 'text-primary/40'}`} />
                <p className="text-sm font-medium text-accent/80">
                  {isDragOver ? "أفلت الصورة هنا" : "اسحب صورة هنا أو انقر للاختيار"}
                </p>
                <p className="text-[10px] text-gray-500">JPG · PNG · WEBP · GIF — الحد الأقصى 15MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد صور في المكتبة</p>
              <p className="text-sm mt-1">ارفع صورة لتبدأ</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {images.map((img) => {
                const isSelected = selected === img.url;
                return (
                  <button
                    key={img.filename}
                    type="button"
                    onClick={() => setSelected(isSelected ? null : img.url)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      isSelected
                        ? "border-accent shadow-lg shadow-accent/20 scale-[0.97]"
                        : "border-primary/20 hover:border-primary/50"
                    }`}
                    data-testid={`image-option-${img.filename}`}
                  >
                    <img
                      src={img.url}
                      alt={img.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-accent/30 flex items-center justify-center">
                        <div className="bg-accent rounded-full p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-primary/10 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 border-primary/30 text-gray-400"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selected}
            className="flex-1 bg-primary text-primary-foreground"
            data-testid="button-confirm-image"
          >
            اختيار الصورة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
