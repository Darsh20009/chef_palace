import { useState, useEffect } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Calendar, FileText, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  numberOfDays: number;
  rejectionReason?: string;
  createdAt: string;
}

export default function LeaveRequestPage() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      const response = await fetch("/api/leave-requests", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate || !reason.trim()) {
      toast({
        title: "خطأ",
        description: tc("يرجى ملء جميع الحقول", "Please fill all fields"),
        variant: "destructive"
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      toast({
        title: "خطأ",
        description: tc("تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية", "End date must be after start date"),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          reason
        }),
        credentials: "include"
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "خطأ",
          description: data.error || tc("فشل تقديم طلب الاجازة", "Failed to submit leave request"),
          variant: "destructive"
        });
        return;
      }

      toast({
        title: tc("نجح", "Success"),
        description: tc("تم تقديم طلب الاجازة بنجاح", "Leave request submitted successfully")
      });

      setStartDate("");
      setEndDate("");
      setReason("");
      fetchLeaveRequests();
    } catch (error) {
      toast({
        title: "خطأ",
        description: tc("حدث خطأ في تقديم الطلب", "An error occurred while submitting the request"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500';
      case 'rejected':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return tc('موافق عليه', 'Approved');
      case 'rejected':
        return tc('مرفوض', 'Rejected');
      default:
        return tc('قيد الانتظار', 'Pending');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/employee/attendance")}
            className="text-gray-400 hover:text-accent"
            data-testid="button-back-attendance"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-accent">{tc("التقديم على اجازة", "Apply for Leave")}</h1>
            <p className="text-gray-400 text-sm">{tc("إدارة طلبات الاجازات", "Manage Leave Requests")}</p>
          </div>
        </div>

        {/* Leave Request Form */}
        <Card className="bg-gradient-to-br from-background to-background border-primary/20 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-accent flex items-center gap-2">
              <FileText className="w-5 h-5" />
              نموذج تقديم اجازة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Start Date */}
              <div>
                <Label htmlFor="start-date" className="text-gray-300">{tc("تاريخ البداية", "Start Date")}</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-primary/30 border-primary/30 text-white"
                  data-testid="input-start-date"
                />
              </div>

              {/* End Date */}
              <div>
                <Label htmlFor="end-date" className="text-gray-300">{tc("تاريخ النهاية", "End Date")}</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-primary/30 border-primary/30 text-white"
                  data-testid="input-end-date"
                />
              </div>

              {/* Number of Days */}
              {startDate && endDate && (
                <div className="bg-primary/30 rounded-lg p-3 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">{tc("عدد الأيام", "Number of Days")}</span>
                    <Badge className="bg-primary/20 text-accent border-primary/30">
                      {calculateDays()} أيام
                    </Badge>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <Label htmlFor="reason" className="text-gray-300">{tc("السبب", "Reason")}</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={tc("اذكر سبب الاجازة...", "State the reason for leave...")}
                  className="bg-primary/30 border-primary/30 text-white resize-none h-24"
                  data-testid="textarea-reason"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading || !startDate || !endDate || !reason.trim()}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white text-lg"
                data-testid="button-submit-leave"
              >
                {isLoading ? tc("جاري الإرسال...", "Sending...") : tc("تقديم الطلب", "Submit Request")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Leave Requests History */}
        <Card className="bg-gradient-to-br from-background to-background border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-accent flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              سجل الطلبات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingRequests ? (
              <div className="text-center py-8 text-gray-400">
                <p>{tc("جاري تحميل البيانات...", "Loading data...")}</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>لا توجد طلبات اجازات</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-primary/20 border border-primary/20 rounded-lg p-4"
                    data-testid={`card-leave-request-${request.id}`}
                  >
                    {/* Status Badge */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {request.status === 'approved' && (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        )}
                        {request.status === 'rejected' && (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                        {request.status === 'pending' && (
                          <Clock className="w-5 h-5 text-yellow-500" />
                        )}
                        <span className="text-gray-300 text-sm">
                          {new Date(request.createdAt).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                      <Badge className={`${getStatusColor(request.status)} text-white`}>
                        {getStatusText(request.status)}
                      </Badge>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div className="text-muted-foreground">
                        من: {new Date(request.startDate).toLocaleDateString('ar-SA')}
                      </div>
                      <div className="text-muted-foreground">
                        إلى: {new Date(request.endDate).toLocaleDateString('ar-SA')}
                      </div>
                    </div>

                    {/* Number of Days */}
                    <div className="text-xs text-accent mb-2">
                      عدد الأيام: {request.numberOfDays} أيام
                    </div>

                    {/* Reason */}
                    <div className="text-sm text-gray-300 mb-2">
                      <span className="text-muted-foreground">السبب: </span>
                      {request.reason}
                    </div>

                    {/* Rejection Reason */}
                    {request.status === 'rejected' && request.rejectionReason && (
                      <div className="text-xs text-red-400 bg-red-950/20 p-2 rounded mt-2">
                        سبب الرفض: {request.rejectionReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
