import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslate } from "@/lib/useTranslate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Star, MessageSquare, Filter, Loader2, CheckCircle } from "lucide-react";

interface Review {
  _id: string;
  rating: number;
  comment: string;
  customerName: string;
  customerPhone: string;
  orderId: string;
  orderNumber: string;
  managerReply?: string;
  repliedAt?: string;
  branchId: string;
  createdAt: string;
  product?: { nameAr: string; nameEn: string; imageUrl?: string };
}

interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  avgRating: number;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-4 h-4 ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`} />
      ))}
    </div>
  );
}

export default function ManagerReviewsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [ratingFilter, setRatingFilter] = useState("all");
  const [replyDialog, setReplyDialog] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data, isLoading, refetch } = useQuery<ReviewsResponse>({
    queryKey: ["/api/reviews/all", ratingFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      return fetch(`/api/reviews/all?${params}`).then(r => r.json());
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      apiRequest("PATCH", `/api/reviews/${id}/reply`, { reply }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/all"] });
      setReplyDialog(null);
      setReplyText("");
      toast({ title: tc("تم إرسال الرد بنجاح", "Reply sent successfully") });
    },
    onError: () => toast({ title: tc("فشل إرسال الرد", "Failed to send reply"), variant: "destructive" }),
  });

  const reviews = data?.reviews || [];
  const avgRating = data?.avgRating || 0;

  const ratingCounts = [5,4,3,2,1].map(r => ({
    rating: r,
    count: reviews.filter(rev => rev.rating === r).length,
  }));

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => setLocation("/manager/dashboard")} className="text-muted-foreground hover:text-foreground" data-testid="btn-back">
            <ArrowLeft className="w-4 h-4 ml-2" />{tc("العودة", "Back")}
          </Button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Star className="w-7 h-7 text-amber-400" />{tc("تقييمات العملاء", "Customer Reviews")}
          </h1>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-border text-muted-foreground">
            {tc("تحديث", "Refresh")}
          </Button>
        </div>

        {/* Rating summary */}
        <Card className="bg-card border-border mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-5xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
                <StarRating rating={Math.round(avgRating)} />
                <p className="text-muted-foreground text-xs mt-1">{data?.total || 0} {tc("تقييم", "reviews")}</p>
              </div>
              <div className="flex-1 space-y-1 min-w-[180px]">
                {ratingCounts.map(({ rating, count }) => {
                  const pct = (data?.total || 0) > 0 ? (count / (data?.total || 1)) * 100 : 0;
                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs w-3">{rating}</span>
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-muted-foreground text-xs w-6">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-40 bg-background border-border" data-testid="select-rating-filter">
              <SelectValue placeholder={tc("فلتر التقييم", "Filter by rating")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tc("الكل", "All")}</SelectItem>
              <SelectItem value="5">5 {tc("نجوم", "stars")} ★★★★★</SelectItem>
              <SelectItem value="4">4 {tc("نجوم", "stars")} ★★★★</SelectItem>
              <SelectItem value="3">3 {tc("نجوم", "stars")} ★★★</SelectItem>
              <SelectItem value="2">2 {tc("نجوم", "stars")} ★★</SelectItem>
              <SelectItem value="1">{tc("نجمة واحدة", "1 star")} ★</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Star className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>{tc("لا توجد تقييمات بعد", "No reviews yet")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review._id} className="bg-card border-border" data-testid={`card-review-${review._id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-white font-medium">{review.customerName || tc('عميل', 'Customer')}</p>
                      {review.customerPhone && <p className="text-muted-foreground text-xs">{review.customerPhone}</p>}
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {review.orderNumber ? `${tc('طلب', 'Order')} #${review.orderNumber}` : ''} · {new Date(review.createdAt).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  {review.comment && (
                    <p className="text-muted-foreground text-sm mb-3 bg-card/50 p-3 rounded-lg">"{review.comment}"</p>
                  )}
                  {review.managerReply ? (
                    <div className="bg-green-900/30 border border-green-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-xs font-medium">{tc("رد المدير", "Manager Reply")}</span>
                      </div>
                      <p className="text-muted-foreground text-sm">{review.managerReply}</p>
                    </div>
                  ) : (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setReplyDialog(review); setReplyText(""); }}
                      className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                      data-testid={`btn-reply-${review._id}`}
                    >
                      <MessageSquare className="w-3 h-3 ml-2" />{tc("رد على التقييم", "Reply to Review")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Reply Dialog */}
        <Dialog open={!!replyDialog} onOpenChange={o => !o && setReplyDialog(null)}>
          <DialogContent className="bg-card border-border" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-white">{tc("الرد على تقييم", "Reply to review by")} {replyDialog?.customerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {replyDialog?.comment && (
                <div className="bg-card/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">{tc("تقييم العميل:", "Customer review:")}</p>
                  <StarRating rating={replyDialog.rating} />
                  <p className="text-muted-foreground text-sm mt-1">"{replyDialog.comment}"</p>
                </div>
              )}
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={tc("اكتب ردك هنا...", "Write your reply here...")}
                className="bg-background border-border resize-none"
                rows={4}
                data-testid="textarea-reply"
              />
              <Button
                onClick={() => replyDialog && replyMutation.mutate({ id: replyDialog._id, reply: replyText })}
                disabled={!replyText.trim() || replyMutation.isPending}
                className="w-full bg-primary hover:bg-primary/90"
                data-testid="btn-submit-reply"
              >
                {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                {tc("إرسال الرد", "Send Reply")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
