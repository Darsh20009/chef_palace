import { useState } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Send, Users, User, Megaphone, CheckCircle, AlertCircle, RefreshCw, Trash2, Eye, Clock, Sparkles, BarChart3, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface NotifItem {
  id?: string;
  _id?: string;
  title: string;
  message: string;
  type?: string;
  icon?: string;
  link?: string;
  isRead?: number;
  userId?: string;
  userType?: string;
  createdAt?: string | Date;
}

export default function AdminNotificationsPage() {
  const tc = useTranslate();
  const { toast } = useToast();
  const [broadcastForm, setBroadcastForm] = useState({ title: "", body: "", link: "/", target: "all" });
  const [userForm, setUserForm] = useState({ userId: "", userType: "customer", title: "", body: "", link: "/" });

  const { data: notifications = [], isLoading, refetch } = useQuery<NotifItem[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const broadcastMutation = useMutation({
    mutationFn: (data: typeof broadcastForm) =>
      apiRequest("POST", "/api/notifications/broadcast", data),
    onSuccess: () => {
      toast({ title: "✅ تم الإرسال", description: "تم إرسال الإشعار بنجاح لجميع المشتركين" });
      setBroadcastForm({ title: "", body: "", link: "/", target: "all" });
      refetch();
    },
    onError: () => toast({ title: "❌ خطأ", description: "فشل إرسال الإشعار", variant: "destructive" }),
  });

  const userNotifMutation = useMutation({
    mutationFn: (data: typeof userForm) =>
      apiRequest("POST", "/api/notifications/send", data),
    onSuccess: () => {
      toast({ title: "✅ تم الإرسال", description: "تم إرسال الإشعار للمستخدم" });
      setUserForm({ userId: "", userType: "customer", title: "", body: "", link: "/" });
    },
    onError: () => toast({ title: "❌ خطأ", description: "فشل إرسال الإشعار", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/notifications/${id}`, {}),
    onSuccess: () => { refetch(); toast({ title: "تم الحذف" }); },
  });

  const [promoForm, setPromoForm] = useState({ title: "", body: "", url: "/menu" });

  const promoMutation = useMutation({
    mutationFn: (data: typeof promoForm) => apiRequest("POST", "/api/push/send-promo", data),
    onSuccess: () => {
      toast({ title: "✅ تم الإرسال", description: "تم إرسال العرض لجميع المشتركين عبر Web Push" });
      setPromoForm({ title: "", body: "", url: "/menu" });
    },
    onError: () => toast({ title: "❌ خطأ في الإرسال", variant: "destructive" }),
  });

  const summarMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/push/admin-summary", {}),
    onSuccess: () => toast({ title: "✅ تم إرسال التقرير", description: "تم إرسال ملخص اليوم لجميع المديرين" }),
    onError: () => toast({ title: "❌ فشل إرسال التقرير", variant: "destructive" }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`, {}),
    onSuccess: () => refetch(),
  });

  const typeColors: Record<string, string> = {
    order_update: "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
    order: "bg-blue-100 text-blue-700",
    payment: "bg-purple-100 text-purple-700",
    promo: "bg-orange-100 text-orange-700",
    info: "bg-gray-100 text-gray-700",
  };

  const formatTime = (date?: string | Date) => {
    if (!date) return "";
    return new Date(date).toLocaleString("ar");
  };

  const unreadCount = notifications.filter((n) => !n.isRead || n.isRead === 0).length;

  return (
    <div className="min-h-screen bg-muted/30" dir="rtl">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{tc("مركز الإشعارات", "Notifications Center")}</h1>
              <p className="text-sm text-muted-foreground">{tc("إدارة وإرسال الإشعارات", "Manage and send notifications")}</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white">{unreadCount} {tc("غير مقروء", "unread")}</Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Broadcast Notification */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                {tc("إشعار جماعي", "Broadcast Notification")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>{tc("الجمهور المستهدف", "Target Audience")}</Label>
                <Select
                  value={broadcastForm.target}
                  onValueChange={(v) => setBroadcastForm((f) => ({ ...f, target: v }))}
                >
                  <SelectTrigger data-testid="select-broadcast-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tc("الجميع", "Everyone")}</SelectItem>
                    <SelectItem value="admins">{tc("المديرون والمشرفون فقط", "Managers & Admins Only")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{tc("عنوان الإشعار", "Notification Title")}</Label>
                <Input
                  placeholder={tc("مثال: عرض جديد 🎉", "Example: New Offer 🎉")}
                  value={broadcastForm.title}
                  onChange={(e) => setBroadcastForm((f) => ({ ...f, title: e.target.value }))}
                  data-testid="input-broadcast-title"
                />
              </div>
              <div className="space-y-1">
                <Label>{tc("نص الإشعار", "Notification Body")}</Label>
                <Textarea
                  placeholder={tc("اكتب رسالة الإشعار هنا...", "Write the notification message here...")}
                  value={broadcastForm.body}
                  onChange={(e) => setBroadcastForm((f) => ({ ...f, body: e.target.value }))}
                  rows={3}
                  data-testid="textarea-broadcast-body"
                />
              </div>
              <div className="space-y-1">
                <Label>{tc("رابط (اختياري)", "Link (optional)")}</Label>
                <Input
                  placeholder="/"
                  value={broadcastForm.link}
                  onChange={(e) => setBroadcastForm((f) => ({ ...f, link: e.target.value }))}
                  data-testid="input-broadcast-link"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => broadcastMutation.mutate(broadcastForm)}
                disabled={broadcastMutation.isPending || !broadcastForm.title || !broadcastForm.body}
                data-testid="button-send-broadcast"
              >
                {broadcastMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Megaphone className="h-4 w-4 mr-2" />
                )}
                {tc("إرسال للجميع", "Send to Everyone")}
              </Button>
            </CardContent>
          </Card>

          {/* Single User Notification */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {tc("إشعار لمستخدم محدد", "Notify Specific User")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{tc("معرف المستخدم", "User ID")}</Label>
                  <Input
                    placeholder="userId / customerId"
                    value={userForm.userId}
                    onChange={(e) => setUserForm((f) => ({ ...f, userId: e.target.value }))}
                    data-testid="input-user-notif-id"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{tc("نوع المستخدم", "User Type")}</Label>
                  <Select
                    value={userForm.userType}
                    onValueChange={(v) => setUserForm((f) => ({ ...f, userType: v }))}
                  >
                    <SelectTrigger data-testid="select-user-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">{tc("عميل", "Customer")}</SelectItem>
                      <SelectItem value="employee">{tc("موظف", "Employee")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>{tc("عنوان الإشعار", "Notification Title")}</Label>
                <Input
                  placeholder={tc("عنوان الإشعار", "Notification Title")}
                  value={userForm.title}
                  onChange={(e) => setUserForm((f) => ({ ...f, title: e.target.value }))}
                  data-testid="input-user-notif-title"
                />
              </div>
              <div className="space-y-1">
                <Label>{tc("نص الإشعار", "Notification Body")}</Label>
                <Textarea
                  placeholder={tc("محتوى الإشعار", "Notification content")}
                  value={userForm.body}
                  onChange={(e) => setUserForm((f) => ({ ...f, body: e.target.value }))}
                  rows={3}
                  data-testid="textarea-user-notif-body"
                />
              </div>
              <div className="space-y-1">
                <Label>{tc("رابط (اختياري)", "Link (optional)")}</Label>
                <Input
                  placeholder="/"
                  value={userForm.link}
                  onChange={(e) => setUserForm((f) => ({ ...f, link: e.target.value }))}
                  data-testid="input-user-notif-link"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => userNotifMutation.mutate(userForm)}
                disabled={userNotifMutation.isPending || !userForm.userId || !userForm.title || !userForm.body}
                data-testid="button-send-user-notif"
              >
                {userNotifMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {tc("إرسال", "Send")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Smart Scheduler Section */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {tc("الجدولة الذكية للإشعارات", "Smart Notification Scheduler")}
              <Badge variant="secondary" className="text-xs font-normal">تلقائي ✦</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {tc("يرسل النظام تلقائياً رسائل مخصصة في الأوقات التالية (توقيت السعودية):", "The system automatically sends personalized messages at these times (Saudi time):")}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Schedule Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { time: "3:30 ص", label: "تذكير السحور", note: "رمضان فقط", icon: "🌙" },
                { time: "8:00 ص", label: "تحية الصباح", note: "مخصصة بالطبق المفضل", icon: "☀️" },
                { time: "10:30 ص", label: "تشجيع منتصف الصباح", note: "أيام الأسبوع فقط", icon: "☕" },
                { time: "5:30 م", label: "تذكير الإفطار", note: "رمضان فقط", icon: "🌅" },
                { time: "9:00 م", label: "رسالة المساء", note: "مع وجبتك المفضلة", icon: "🌙" },
                { time: "11:00 م", label: "تقرير الإدارة", note: "الإيرادات + المخزون", icon: "📊" },
              ].map((item) => (
                <div key={item.time} className="flex items-center gap-2 bg-background rounded-lg p-2.5 border">
                  <span className="text-lg">{item.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-primary">{item.time}</span>
                      <span className="text-xs font-medium truncate">{item.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{item.note}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Manual Promo Send */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                {tc("إرسال عرض ترويجي الآن (Web Push)", "Send Promotional Offer Now (Web Push)")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Input
                    placeholder={tc("عنوان العرض — مثال: ☕ خصم 20% اليوم فقط!", "Offer title — e.g.: ☕ 20% Off Today Only!")}
                    value={promoForm.title}
                    onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))}
                    data-testid="input-promo-title"
                  />
                  <Input
                    placeholder={tc("رابط التوجيه (اختياري)", "Redirect link (optional)")}
                    value={promoForm.url}
                    onChange={(e) => setPromoForm((f) => ({ ...f, url: e.target.value }))}
                    data-testid="input-promo-url"
                  />
                </div>
                <div className="space-y-2">
                  <Textarea
                    placeholder={tc("نص الرسالة — مثال: زورونا اليوم واستمتع بخصم خاص على وجبتك المفضلة 🍛", "Message text — e.g.: Visit us today for a special discount on your favorite dish 🍛")}
                    value={promoForm.body}
                    onChange={(e) => setPromoForm((f) => ({ ...f, body: e.target.value }))}
                    rows={3}
                    data-testid="textarea-promo-body"
                  />
                </div>
              </div>
              <Button
                className="mt-3 w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => promoMutation.mutate(promoForm)}
                disabled={promoMutation.isPending || !promoForm.title || !promoForm.body}
                data-testid="button-send-promo"
              >
                {promoMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Sparkles className="h-4 w-4 ml-2" />
                )}
                {tc("إرسال العرض للجميع الآن", "Send Offer to Everyone Now")}
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="border-t pt-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => summarMutation.mutate()}
                disabled={summarMutation.isPending}
                data-testid="button-trigger-summary"
                className="flex items-center gap-2"
              >
                {summarMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4 text-primary" />
                )}
                {tc("إرسال تقرير اليوم الآن", "Send Today's Report Now")}
              </Button>
              <p className="text-xs text-muted-foreground self-center">
                {tc("يشمل عدد الطلبات، الإيرادات، الأكثر مبيعاً، وتنبيهات المخزون", "Includes order count, revenue, top sellers, and inventory alerts")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Notifications Log */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                {tc("سجل الإشعارات الأخيرة", "Recent Notifications Log")}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>{tc("لا توجد إشعارات", "No notifications")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif, i) => {
                  const id = notif.id || notif._id || String(i);
                  const isRead = notif.isRead === 1;
                  return (
                    <div
                      key={id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                        !isRead ? "bg-primary/5 border-primary/20" : "bg-background border-border/50"
                      )}
                      data-testid={`admin-notif-item-${id}`}
                    >
                      <div className="text-xl shrink-0 mt-0.5">{notif.icon || "🔔"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{notif.title}</span>
                          {notif.type && (
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", typeColors[notif.type] || typeColors.info)}>
                              {notif.type}
                            </span>
                          )}
                          {!isRead && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{tc("جديد", "New")}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {notif.userId && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> {notif.userType === "employee" ? tc("موظف", "Employee") : tc("عميل", "Customer")}: {notif.userId?.slice(-8)}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{formatTime(notif.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600"
                            onClick={() => markReadMutation.mutate(id)}
                            title="تحديد كمقروء"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteMutation.mutate(id)}
                          data-testid={`button-delete-notif-${id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
