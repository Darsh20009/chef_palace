import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Mail, Send } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

export default function AdminEmail() {
  const { toast } = useToast();
  const tc = useTranslate();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: customers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/customers-list"],
  });

  const mutation = useMutation({
    mutationFn: async (payload: { customerId: string; subject: string; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/send-email", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: tc("تم الإرسال بنجاح", "Sent Successfully"),
        description: tc("تم إرسال البريد الإلكتروني للعميل بنجاح.", "Email sent to customer successfully."),
      });
      setSubject("");
      setMessage("");
      setSelectedCustomerId("");
    },
    onError: (error: Error) => {
      toast({
        title: tc("فشل الإرسال", "Send Failed"),
        description: error.message || tc("حدث خطأ أثناء إرسال البريد الإلكتروني.", "An error occurred while sending the email."),
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!selectedCustomerId || !subject || !message) {
      toast({
        title: tc("تنبيه", "Notice"),
        description: tc("يرجى ملء جميع الحقول المطلوبة.", "Please fill in all required fields."),
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({ customerId: selectedCustomerId, subject, message });
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            {tc("إرسال بريد إلكتروني للعملاء", "Send Email to Customers")}
          </CardTitle>
          <CardDescription>
            {tc("أرسل رسائل مخصصة أو عروض ترويجية لعملائك المسجلين.", "Send personalized messages or promotions to your registered customers.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{tc("اختر العميل", "Select Customer")}</label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? tc("جاري التحميل...", "Loading...") : tc("اختر عميلاً", "Select a customer")} />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer: any) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} ({customer.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{tc("الموضوع", "Subject")}</label>
            <Input
              placeholder={tc("أدخل موضوع الرسالة", "Enter email subject")}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{tc("الرسالة", "Message")}</label>
            <Textarea
              placeholder={tc("اكتب رسالتك هنا...", "Write your message here...")}
              className="min-h-[150px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSend}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {tc("إرسال البريد الإلكتروني", "Send Email")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
