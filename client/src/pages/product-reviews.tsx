import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquare } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslate } from "@/lib/useTranslate";

export default function ProductReviews({ productId }: { productId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const tc = useTranslate();

  const { data: reviews } = useQuery({
    queryKey: ["/api/reviews", productId],
    queryFn: async () => {
      const res = await fetch(`/api/reviews?productId=${productId}`);
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest("POST", "/api/reviews", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", productId] });
      setRating(0);
      setComment("");
    },
  });

  const avgRating = reviews?.length
    ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-6 p-4">
      <div className="bg-card rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">{tc("التقييمات والآراء", "Ratings & Reviews")}</h3>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold">{avgRating}</div>
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-5 h-5 ${i < Math.round(Number(avgRating)) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
              />
            ))}
          </div>
          <div className="text-sm text-muted-foreground">({reviews?.length || 0} {tc("تقييم", "reviews")})</div>
        </div>
      </div>

      <div className="bg-card rounded-lg p-4">
        <h4 className="font-semibold mb-4">{tc("أضف تقييمك", "Add Your Review")}</h4>
        <div className="space-y-3">
          <div>
            <label className="text-sm mb-2 block">{tc("التقييم (1-5)", "Rating (1-5)")}</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => setRating(num)}
                  data-testid={`button-rate-${num}`}
                  className="p-1"
                >
                  <Star
                    className={`w-6 h-6 ${rating >= num ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm mb-2 block">{tc("التعليق (اختياري)", "Comment (optional)")}</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={tc("شارك رأيك عن المنتج...", "Share your opinion about this product...")}
              data-testid="input-review-comment"
              className="min-h-20"
            />
          </div>

          <Button
            onClick={() => mutation.mutate({ productId, rating, comment })}
            disabled={!rating || mutation.isPending}
            data-testid="button-submit-review"
            className="w-full"
          >
            {mutation.isPending ? tc("جاري الإرسال...", "Submitting...") : tc("إرسال التقييم", "Submit Review")}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold">{tc("التقييمات الأخيرة", "Recent Reviews")}</h4>
        {reviews?.map((review: any) => (
          <Card key={review.id} className="p-4" data-testid={`card-review-${review.id}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString("ar-SA")}
              </span>
            </div>
            {review.comment && <p className="text-sm mb-3">{review.comment}</p>}
            {review.adminReply && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-sm">
                <p className="font-semibold text-blue-900 dark:text-blue-300 mb-1 flex gap-2">
                  <MessageSquare className="w-4 h-4" /> {tc("رد الإدارة:", "Admin Reply:")}
                </p>
                <p>{review.adminReply}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
