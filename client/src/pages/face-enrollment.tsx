// ─── Face Enrollment Page — تسجيل بصمة الوجه ────────────────────────────────
// Accessible from employee profile (admin/manager only)
// Captures 5 face angles and sends descriptors to the server
import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { loadFaceModels, detectFaceInImage } from "@/lib/face-recognition";
import { Camera, CheckCircle, ArrowLeft, Loader2, XCircle, RefreshCw, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ANGLES = [
  { label: "مباشر (أمامي)", instruction: "انظر مباشرة للكاميرا", icon: "👁️" },
  { label: "يمين 45°", instruction: "أدر رأسك يميناً قليلاً", icon: "↗️" },
  { label: "يسار 45°", instruction: "أدر رأسك يساراً قليلاً", icon: "↖️" },
  { label: "أعلى", instruction: "ارفع نظرك قليلاً لأعلى", icon: "⬆️" },
  { label: "أسفل", instruction: "انظر قليلاً لأسفل", icon: "⬇️" },
];

export default function FaceEnrollment() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<"intro" | "capture" | "processing" | "done" | "error">("intro");
  const [angleIdx, setAngleIdx] = useState(0);
  const [captures, setCaptures] = useState<{ descriptor: number[]; photoUrl: string }[]>([]);
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(0);

  const { data: employee } = useQuery({
    queryKey: [`/api/employees/${params.id}`],
    queryFn: async () => { const r = await fetch(`/api/employees/${params.id}`, { credentials: "include" }); return r.json(); },
    enabled: !!params.id,
  });

  const enrollMut = useMutation({
    mutationFn: async ({ descriptors, photoUrls }: { descriptors: number[][]; photoUrls: string[] }) => {
      const res = await apiRequest("POST", `/api/employees/${params.id}/enroll-face`, { descriptors, photoUrls });
      return res.json();
    },
    onSuccess: () => { setStep("done"); toast({ title: "✓ تم تسجيل بصمة الوجه بنجاح" }); },
    onError: (e: any) => { setErrorMsg(e.message || "فشل التسجيل"); setStep("error"); },
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraReady(true);
    } catch (err: any) {
      setErrorMsg("فشل فتح الكاميرا: " + err.message);
      setStep("error");
    }
  };

  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); };

  const startEnrollment = async () => {
    setStep("capture");
    setAngleIdx(0);
    setCaptures([]);
    try {
      await loadFaceModels();
      setModelsReady(true);
    } catch (e: any) { setErrorMsg(e.message); setStep("error"); return; }
    await startCamera();
  };

  useEffect(() => { return stopCamera; }, []);

  const captureAngle = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsReady) return;

    // Countdown
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise(r => setTimeout(r, 1000));
    }
    setCountdown(0);

    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(videoRef.current, 0, 0);
    const photoUrl = canvas.toDataURL("image/jpeg", 0.85);

    // Create image element for detection
    const img = new Image();
    img.src = photoUrl;
    await new Promise(r => { img.onload = r; });

    const descriptor = await detectFaceInImage(img);
    if (!descriptor) {
      toast({ title: "لم يتم اكتشاف وجه — حاول مرة أخرى", variant: "destructive" });
      return;
    }

    const newCaptures = [...captures, { descriptor: Array.from(descriptor), photoUrl }];
    setCaptures(newCaptures);

    if (angleIdx < ANGLES.length - 1) {
      setAngleIdx(angleIdx + 1);
    } else {
      // All angles captured
      setStep("processing");
      stopCamera();
      enrollMut.mutate({
        descriptors: newCaptures.map(c => c.descriptor),
        photoUrls: newCaptures.map(c => c.photoUrl),
      });
    }
  };

  const reset = () => { setStep("intro"); setAngleIdx(0); setCaptures([]); setErrorMsg(""); stopCamera(); };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto p-4 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin/employees")}>
            <ArrowLeft className="w-4 h-4 ml-2" />العودة
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              تسجيل بصمة الوجه
            </h1>
            {employee && <p className="text-sm text-muted-foreground">{employee.fullName} · {employee.jobTitle}</p>}
          </div>
          {employee?.faceEnrolledAt && (
            <Badge className="mr-auto bg-emerald-100 text-emerald-700">
              <CheckCircle className="w-3 h-3 ml-1" />
              مسجل مسبقاً
            </Badge>
          )}
        </div>

        {/* Intro */}
        {step === "intro" && (
          <Card>
            <CardHeader><CardTitle className="text-base">كيف تعمل بصمة الوجه؟</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {ANGLES.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                    <span className="text-2xl">{a.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.instruction}</p>
                    </div>
                    <Badge variant="outline" className="mr-auto text-xs">التقاط {i + 1}</Badge>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-sm text-amber-700 dark:text-amber-400">
                ⚠️ تأكد من الإضاءة الجيدة وعدم وجود عوائق أمام الوجه (نظارات شمسية، كمامة)
              </div>
              <Button className="w-full bg-primary" onClick={startEnrollment} data-testid="button-start-enrollment">
                <Camera className="w-4 h-4 ml-2" />
                بدء تسجيل البصمة
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Capture */}
        {step === "capture" && (
          <div className="space-y-4">
            {/* Progress */}
            <div className="flex gap-2 justify-center">
              {ANGLES.map((a, i) => (
                <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${i < angleIdx ? "bg-emerald-500 border-emerald-500 text-white" : i === angleIdx ? "border-primary text-primary" : "border-gray-300 text-gray-400"}`}>
                  {i < angleIdx ? "✓" : i + 1}
                </div>
              ))}
            </div>

            {/* Current angle instruction */}
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-4xl mb-2">{ANGLES[angleIdx].icon}</div>
                <h2 className="text-lg font-bold">{ANGLES[angleIdx].label}</h2>
                <p className="text-muted-foreground text-sm">{ANGLES[angleIdx].instruction}</p>
              </CardContent>
            </Card>

            {/* Camera */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 bg-black aspect-video">
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay style={{ transform: "scaleX(-1)" }} />
              <canvas ref={canvasRef} className="hidden" />

              {/* Face guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-44 h-56 rounded-full border-2 border-dashed border-white/40" />
              </div>

              {/* Countdown */}
              {countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="text-7xl font-bold text-white">{countdown}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>إلغاء</Button>
              <Button
                className="flex-1 bg-primary"
                onClick={captureAngle}
                disabled={!cameraReady || !modelsReady || countdown > 0}
                data-testid="button-capture"
              >
                <Camera className="w-4 h-4 ml-2" />
                التقاط زاوية {angleIdx + 1} من {ANGLES.length}
              </Button>
            </div>
          </div>
        )}

        {/* Processing */}
        {step === "processing" && (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-lg font-bold">جارٍ تحليل وحفظ البصمة...</h2>
              <p className="text-muted-foreground text-sm mt-2">يتم إنشاء النموذج الرياضي لوجه الموظف وتشفيره</p>
            </CardContent>
          </Card>
        )}

        {/* Done */}
        {step === "done" && (
          <Card className="border-emerald-200">
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-emerald-700">تم التسجيل بنجاح!</h2>
              <p className="text-muted-foreground mt-2 mb-6">
                تم تسجيل {captures.length} زاوية للوجه وحفظها بشكل آمن ومشفر.
                يمكن للموظف الآن تسجيل حضوره عبر الكيوسك.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={reset}>
                  <RefreshCw className="w-4 h-4 ml-2" />تحديث البصمة
                </Button>
                <Button className="bg-primary" onClick={() => navigate("/admin/employees")}>
                  العودة للموظفين
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {step === "error" && (
          <Card className="border-red-200">
            <CardContent className="py-12 text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-red-700">حدث خطأ</h2>
              <p className="text-muted-foreground mt-2 mb-6 text-sm">{errorMsg}</p>
              <Button onClick={reset}><RefreshCw className="w-4 h-4 ml-2" />حاول مرة أخرى</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
