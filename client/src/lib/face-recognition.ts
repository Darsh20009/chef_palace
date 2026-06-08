// ─── QIROX Face Recognition Utility ─────────────────────────────────────────
// Uses face-api.js (TensorFlow.js) for in-browser face detection and matching
// Models loaded from CDN — no local hosting needed
// ─────────────────────────────────────────────────────────────────────────────

// Local model files served from /face-models/ (copied from @vladmandic/face-api npm package)
const MODEL_URL = "/face-models";

let modelsLoaded = false;
let faceapi: any = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  try {
    const fa = await import("@vladmandic/face-api");
    faceapi = fa;

    // Ensure TensorFlow backend is ready — prefer WASM when WebGL unavailable
    try {
      const tf = (fa as any).tf || (fa as any).env?.().tf;
      if (tf?.ready) await tf.ready();
    } catch { /* backend will auto-select */ }

    await Promise.all([
      fa.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log("[FaceRecognition] Models loaded ✓");
  } catch (err: any) {
    console.error("[FaceRecognition] Failed to load models:", err);
    // Provide clearer error based on failure type
    if (err?.message?.includes("WebGL") || err?.message?.includes("backend")) {
      throw new Error("التعرف على الوجه يحتاج متصفحاً حديثاً مع دعم WebGL — جرّب Chrome أو Edge");
    }
    throw new Error("فشل تحميل نماذج التعرف على الوجه — تأكد من الاتصال بالإنترنت");
  }
}

export function isLoaded() { return modelsLoaded; }
export function getFaceApi() { return faceapi; }

export interface EmployeeFaceEntry {
  employeeId: string;
  fullName: string;
  role: string;
  jobTitle: string;
  branchId?: string;
  descriptors: Float32Array[];
}

export interface FaceMatchResult {
  found: boolean;
  employeeId?: string;
  fullName?: string;
  role?: string;
  jobTitle?: string;
  distance?: number;
  confidence?: number;
}

// Build FaceMatcher from stored employee descriptors
export function buildMatcher(employees: EmployeeFaceEntry[], threshold = 0.5): any {
  if (!faceapi) return null;
  const labeledDescriptors = employees
    .filter(e => e.descriptors.length > 0)
    .map(e => new faceapi.LabeledFaceDescriptors(
      e.employeeId,
      e.descriptors.map((d: number[]) => new Float32Array(d))
    ));
  if (labeledDescriptors.length === 0) return null;
  return new faceapi.FaceMatcher(labeledDescriptors, threshold);
}

// Detect face + extract descriptor from video element
export async function detectFaceInVideo(
  video: HTMLVideoElement,
): Promise<{ descriptor: Float32Array; detection: any } | null> {
  if (!faceapi || !modelsLoaded) return null;
  try {
    const result = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!result) return null;
    return { descriptor: result.descriptor, detection: result.detection };
  } catch (err) {
    return null;
  }
}

// Detect face from canvas/image
export async function detectFaceInImage(
  imageEl: HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  if (!faceapi || !modelsLoaded) return null;
  try {
    const result = await faceapi
      .detectSingleFace(imageEl, new faceapi.SsdMobilenetv1Options())
      .withFaceLandmarks()
      .withFaceDescriptor();
    return result?.descriptor ?? null;
  } catch { return null; }
}

// Match a detected descriptor against the employee database
export function matchDescriptor(
  descriptor: Float32Array,
  matcher: any,
  employees: EmployeeFaceEntry[]
): FaceMatchResult {
  if (!matcher) return { found: false };
  const match = matcher.findBestMatch(descriptor);
  if (match.label === "unknown" || match.distance > 0.55) {
    return { found: false };
  }
  const emp = employees.find(e => e.employeeId === match.label);
  const confidence = Math.round((1 - match.distance) * 100);
  return {
    found: true,
    employeeId: match.label,
    fullName: emp?.fullName,
    role: emp?.role,
    jobTitle: emp?.jobTitle,
    distance: match.distance,
    confidence,
  };
}

// Simple liveness check: track face movement across frames
export function createLivenessTracker() {
  const positions: { x: number; y: number }[] = [];
  let passed = false;

  return {
    addFrame(detection: any) {
      if (!detection) return;
      const box = detection.box;
      positions.push({ x: box.x, y: box.y });
      if (positions.length > 10) positions.shift();
      if (positions.length >= 5) {
        const xRange = Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x));
        const yRange = Math.max(...positions.map(p => p.y)) - Math.min(...positions.map(p => p.y));
        if (xRange > 8 || yRange > 8) passed = true;
      }
    },
    isPassed() { return passed; },
    reset() { positions.length = 0; passed = false; },
  };
}
