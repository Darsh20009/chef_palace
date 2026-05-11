import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, FileText, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileUpload: (url: string) => void;
  uploadedFileUrl?: string;
  label?: string;
}

export default function FileUpload({ onFileUpload, uploadedFileUrl, label = "رفع إيصال الدفع" }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "حجم الملف كبير جداً",
        description: "يرجى اختيار ملف أصغر من 5 ميجابايت",
      });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "نوع الملف غير مدعوم",
        description: "يرجى رفع صور (JPG, PNG, WEBP) أو ملف PDF",
      });
      return;
    }

    setUploading(true);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-receipt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('فشل في رفع الملف');
      }

      const data = await response.json();
      onFileUpload(data.url);

      toast({
        title: "تم رفع الملف بنجاح",
        description: "تم حفظ إيصال الدفع",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ في رفع الملف",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
      });
      setFileName(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFileName(null);
    onFileUpload('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2" data-testid="component-file-upload">
      <label className="text-sm font-medium text-foreground">
        {label} <span className="text-destructive">*</span>
      </label>

      {!uploadedFileUrl && !fileName ? (
        <Card
          className="border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer hover-elevate"
          onClick={() => fileInputRef.current?.click()}
          data-testid="card-upload-area"
        >
          <div className="p-6 text-center space-y-2">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                انقر لرفع إيصال الدفع
              </p>
              <p className="text-xs text-muted-foreground">
                صور أو PDF (حد أقصى 5 ميجابايت)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file"
            />
          </div>
        </Card>
      ) : (
        <Card className="border-primary bg-primary/5">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {fileName || 'إيصال الدفع'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {uploading ? 'جاري الرفع...' : 'تم الرفع بنجاح'}
                </p>
              </div>
            </div>
            {!uploading && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemove}
                className="hover:bg-destructive/10 hover:text-destructive"
                data-testid="button-remove-file"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Card>
      )}

      {uploadedFileUrl && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => window.open(uploadedFileUrl, '_blank')}
          data-testid="button-view-receipt"
        >
          عرض الإيصال
        </Button>
      )}
    </div>
  );
}
