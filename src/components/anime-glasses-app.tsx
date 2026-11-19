"use client";

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PersonalityCard,
  type PersonalityCardData,
} from "@/components/personality-card";
import {
  computeFaceGeometry,
  createCenteredFaceGeometry,
  pickArchetype,
  pickPhrase,
  smoothFaceGeometry,
  type FaceGeometry,
} from "@/lib/anime";
import {
  createSparkleParticles,
  drawAnimeEffects,
  drawSimpleGuide,
  type AnimeLayerKey,
  type SparkleParticle,
} from "@/lib/canvas-effects";
import { downloadBlob, timestampedFileName } from "@/lib/share-card";

const MEDIA_PIPE_PATH = "/mediapipe";
const SIMPLE_WARNING = "Yüz algılama yüklenemedi — basit mod";
const DETECTION_INTERVAL_MS = 70;
const FACE_LOST_AFTER_MS = 450;

type CameraStatus = "idle" | "starting" | "live" | "stopped" | "error";
type DetectionStatus = "off" | "loading" | "ready" | "simple";
type StatusTone = "neutral" | "good" | "wait" | "bad";

const DEFAULT_LAYERS: Record<AnimeLayerKey, boolean> = {
  eyes: true,
  blush: true,
  sparkles: true,
  ears: false,
  bubble: true,
};

const LAYER_ITEMS: ReadonlyArray<{ key: AnimeLayerKey; label: string }> = [
  { key: "eyes", label: "Anime gözler" },
  { key: "blush", label: "Yanak allığı" },
  { key: "sparkles", label: "Işıltılar" },
  { key: "ears", label: "Kedi kulakları" },
  { key: "bubble", label: "Konuşma balonu" },
];

const primaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600";
const secondaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400";
const smallButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
const smallSecondaryButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

function cameraErrorMessage(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Kamera izni verilmedi. Adres çubuğundaki kamera iznini açıp yeniden deneyin.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Kamera bulunamadı. Bir web kamerası bağlayıp yeniden deneyin.";
    case "NotReadableError":
    case "TrackStartError":
      return "Kamera başka bir uygulama tarafından kullanılıyor olabilir. Diğer uygulamaları kapatıp deneyin.";
    case "OverconstrainedError":
      return "Kamera istenen çözünürlüğü desteklemiyor. Tarayıcıyı yenileyip tekrar deneyin.";
    case "AbortError":
      return "Kamera başlatma iptal edildi.";
    default:
      return "Kamera açılamadı. Tarayıcı izinlerini kontrol edip yeniden deneyin.";
  }
}

function statusDescriptor(
  cameraStatus: CameraStatus,
  detectionStatus: DetectionStatus,
  faceVisible: boolean,
  simpleCalibrated: boolean,
): { label: string; tone: StatusTone } {
  if (cameraStatus === "starting") return { label: "Kamera açılıyor…", tone: "wait" };
  if (cameraStatus === "error") return { label: "Kamera hatası", tone: "bad" };
  if (cameraStatus === "stopped") return { label: "Kamera durduruldu", tone: "neutral" };
  if (cameraStatus !== "live") return { label: "Kamera kapalı", tone: "neutral" };

  if (detectionStatus === "loading") {
    return { label: "Yüz algılama yükleniyor…", tone: "wait" };
  }
  if (detectionStatus === "simple") {
    return {
      label: simpleCalibrated ? "Basit mod • hazır" : "Basit mod • hizalama bekliyor",
      tone: "wait",
    };
  }
  if (detectionStatus === "ready") {
    return faceVisible
      ? { label: "Yüz algılandı", tone: "good" }
      : { label: "Yüz aranıyor", tone: "wait" };
  }
  return { label: "Kamera canlı", tone: "neutral" };
}

const statusDotClasses: Record<StatusTone, string> = {
  neutral: "bg-zinc-400",
  good: "bg-emerald-500",
  wait: "bg-amber-500",
  bad: "bg-red-500",
};

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2L10 4h4l1.5 2h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
    >
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="mt-0.5 h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

interface LayerToggleProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

function LayerToggle({ label, checked, onChange }: LayerToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-zinc-700">{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-zinc-200 transition-colors peer-checked:bg-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2"
        />
        <span
          aria-hidden="true"
          className="relative h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-[1.375rem]"
        />
      </span>
    </label>
  );
}

export default function AnimeGlassesApp() {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [secureContext, setSecureContext] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("off");
  const [faceVisible, setFaceVisible] = useState(false);
  const [simpleCalibrated, setSimpleCalibrated] = useState(false);
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  const [layers, setLayers] = useState<Record<AnimeLayerKey, boolean>>(
    DEFAULT_LAYERS,
  );
  const [intensity, setIntensity] = useState(75);
  const [phrase, setPhrase] = useState("Nani?!");
  const [actionMessage, setActionMessage] = useState("");
  const [cardData, setCardData] = useState<PersonalityCardData | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<{ width: number; height: number; dpr: number } | null>(
    null,
  );

  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const faceRef = useRef<FaceGeometry | null>(null);
  const lastFaceSeenRef = useRef(0);
  const lastDetectAtRef = useRef(0);
  const detectionErrorsRef = useRef(0);
  const cameraSessionRef = useRef(0);

  const faceVisibleRef = useRef(false);
  const simpleModeRef = useRef(false);
  const simpleCalibratedRef = useRef(false);
  const layersRef = useRef<Record<AnimeLayerKey, boolean>>(DEFAULT_LAYERS);
  const intensityRef = useRef(0.75);
  const phraseRef = useRef("Nani?!");
  const reduceMotionRef = useRef(false);
  const sparklesRef = useRef<SparkleParticle[]>([]);

  const isLive = cameraStatus === "live";
  const status = statusDescriptor(
    cameraStatus,
    detectionStatus,
    faceVisible,
    simpleCalibrated,
  );

  useEffect(() => {
    setSecureContext(window.isSecureContext);
    sparklesRef.current = createSparkleParticles();

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotionPreference = () => setReduceMotion(query.matches);
    applyMotionPreference();
    query.addEventListener("change", applyMotionPreference);
    return () => query.removeEventListener("change", applyMotionPreference);
  }, []);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    intensityRef.current = intensity / 100;
  }, [intensity]);

  useEffect(() => {
    phraseRef.current = phrase;
  }, [phrase]);

  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    setPhrase(pickPhrase());
    if (!layers.bubble) return;
    const timer = window.setInterval(() => setPhrase(pickPhrase()), 6_000);
    return () => window.clearInterval(timer);
  }, [layers.bubble]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const applySize = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
      const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      viewportRef.current = { width: rect.width, height: rect.height, dpr };
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(stage);
    window.addEventListener("resize", applySize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", applySize);
    };
  }, []);

  useEffect(() => {
    return () => {
      cameraSessionRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      landmarkerRef.current?.close();
      streamRef.current = null;
      landmarkerRef.current = null;
    };
  }, []);

  const switchToSimple = useCallback(() => {
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    faceRef.current = null;
    faceVisibleRef.current = false;
    simpleModeRef.current = true;
    detectionErrorsRef.current = 0;
    setDetectionStatus("simple");
    setFaceVisible(false);
  }, []);

  const initDetection = useCallback(async (session: number) => {
    setDetectionStatus("loading");

    try {
      const vision = await import("@mediapipe/tasks-vision");
      if (session !== cameraSessionRef.current) return;

      const fileset = await vision.FilesetResolver.forVisionTasks(
        `${MEDIA_PIPE_PATH}/wasm`,
      );
      if (session !== cameraSessionRef.current) return;

      const options = {
        runningMode: "VIDEO" as const,
        numFaces: 1,
        minFaceDetectionConfidence: 0.45,
        minFacePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      };

      let landmarker: FaceLandmarker;
      try {
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: `${MEDIA_PIPE_PATH}/face_landmarker.task`,
            delegate: "GPU",
          },
          ...options,
        });
      } catch (gpuError) {
        console.warn("GPU desteği kullanılamadı, CPU deneniyor.", gpuError);
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: `${MEDIA_PIPE_PATH}/face_landmarker.task`,
            delegate: "CPU",
          },
          ...options,
        });
      }

      if (session !== cameraSessionRef.current) {
        landmarker.close();
        return;
      }

      landmarkerRef.current = landmarker;
      simpleModeRef.current = false;
      detectionErrorsRef.current = 0;
      setDetectionStatus("ready");
      setActionMessage("Yüz algılama hazır. Kameraya bak.");
    } catch (error) {
      console.warn("MediaPipe Face Landmarker yüklenemedi.", error);
      if (session !== cameraSessionRef.current) return;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      simpleModeRef.current = true;
      setDetectionStatus("simple");
      setActionMessage("Yüz algılama yüklenemedi; basit moda geçildi.");
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (cameraStatus === "starting") return;

    if (!window.isSecureContext) {
      setCameraStatus("error");
      setCameraError("Kamera erişimi yalnızca HTTPS veya localhost üzerinde çalışır.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("error");
      setCameraError(
        "Tarayıcı kamera erişimini desteklemiyor. Güncel bir Chrome, Edge, Firefox veya Safari deneyin.",
      );
      return;
    }

    const session = ++cameraSessionRef.current;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    faceRef.current = null;
    faceVisibleRef.current = false;
    simpleModeRef.current = false;
    simpleCalibratedRef.current = false;
    detectionErrorsRef.current = 0;

    setCameraStatus("starting");
    setCameraError(null);
    setDetectionStatus("off");
    setFaceVisible(false);
    setSimpleCalibrated(false);
    setActionMessage("Kamera açılıyor…");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (session !== cameraSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraStatus("error");
        setCameraError("Kamera önizlemesi oluşturulamadı.");
        return;
      }

      video.srcObject = stream;
      await video.play();

      if (session !== cameraSessionRef.current) return;

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoSize({ width: video.videoWidth, height: video.videoHeight });
      }
      setCameraStatus("live");
      setActionMessage("Kamera hazır. Yüzünü göster.");
      void initDetection(session);
    } catch (error) {
      if (session !== cameraSessionRef.current) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraStatus("error");
      setCameraError(cameraErrorMessage(error));
      setActionMessage("Kamera başlatılamadı.");
    }
  }, [cameraStatus, initDetection]);

  const stopCamera = useCallback(() => {
    cameraSessionRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    faceRef.current = null;
    faceVisibleRef.current = false;
    simpleModeRef.current = false;
    simpleCalibratedRef.current = false;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    setCameraStatus("stopped");
    setDetectionStatus("off");
    setFaceVisible(false);
    setSimpleCalibrated(false);
    setCameraError(null);
    setActionMessage("Kamera durduruldu. Görüntü akışı serbest bırakıldı.");
  }, []);

  useEffect(() => {
    if (cameraStatus !== "live") return;

    let frame = 0;
    let disposed = false;

    const loop = () => {
      if (disposed) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const viewport = viewportRef.current;
      if (!canvas || !video || !viewport) {
        frame = requestAnimationFrame(loop);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
      ctx.clearRect(0, 0, viewport.width, viewport.height);

      const now = performance.now();
      const landmarker = landmarkerRef.current;

      if (
        landmarker &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        now - lastDetectAtRef.current >= DETECTION_INTERVAL_MS
      ) {
        lastDetectAtRef.current = now;
        try {
          const result = landmarker.detectForVideo(video, now);
          const points = result.faceLandmarks[0];
          if (points && points.length > 0) {
            const nextFace = computeFaceGeometry(
              points,
              video.videoWidth,
              video.videoHeight,
            );
            if (nextFace) {
              faceRef.current = smoothFaceGeometry(faceRef.current, nextFace, 0.38);
              lastFaceSeenRef.current = now;
              detectionErrorsRef.current = 0;
              if (!faceVisibleRef.current) {
                faceVisibleRef.current = true;
                setFaceVisible(true);
              }
            }
          } else if (now - lastFaceSeenRef.current > FACE_LOST_AFTER_MS) {
            faceRef.current = null;
            if (faceVisibleRef.current) {
              faceVisibleRef.current = false;
              setFaceVisible(false);
            }
          }
        } catch (error) {
          detectionErrorsRef.current += 1;
          if (detectionErrorsRef.current >= 3) {
            console.warn(
              "Yüz algılama art arda başarısız oldu; basit moda geçiliyor.",
              error,
            );
            switchToSimple();
          }
        }
      }

      const effectOptions = {
        layers: layersRef.current,
        intensity: intensityRef.current,
        mirrored: true,
        phrase: phraseRef.current,
        timeMs: now,
        reduceMotion: reduceMotionRef.current,
        sparkles: sparklesRef.current,
      };

      if (faceRef.current) {
        drawAnimeEffects(ctx, viewport.width, viewport.height, faceRef.current, {
          ...effectOptions,
          sourceWidth: video.videoWidth,
          sourceHeight: video.videoHeight,
        });
      } else if (simpleModeRef.current) {
        const fallbackFace = createCenteredFaceGeometry(
          viewport.width,
          viewport.height,
        );
        if (simpleCalibratedRef.current) {
          drawAnimeEffects(ctx, viewport.width, viewport.height, fallbackFace, {
            ...effectOptions,
            sourceWidth: viewport.width,
            sourceHeight: viewport.height,
          });
        } else {
          drawSimpleGuide(ctx, viewport.width, viewport.height, fallbackFace);
        }
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, [cameraStatus, switchToSimple]);

  function toggleLayer(key: AnimeLayerKey) {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  function calibrateSimpleMode() {
    simpleCalibratedRef.current = true;
    setSimpleCalibrated(true);
    setActionMessage("Basit mod hizalandı. Efektler ovalin içinde gösteriliyor.");
  }

  function resetSimpleCalibration() {
    simpleCalibratedRef.current = false;
    setSimpleCalibrated(false);
    setActionMessage("Hizalama sıfırlandı. Yüzünü ovalin içine getirip yeniden hizala.");
  }

  function takeSnapshot() {
    const video = videoRef.current;
    if (!isLive || !video) {
      setActionMessage("Önce kamerayı başlat.");
      return;
    }

    if (detectionStatus === "loading") {
      setActionMessage("Yüz algılama henüz hazır değil. Birkaç saniye sonra tekrar dene.");
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width < 1 || height < 1) {
      setActionMessage("Kamera görüntüsü henüz hazır değil. Bir saniye sonra tekrar dene.");
      return;
    }

    if (simpleModeRef.current && !simpleCalibratedRef.current) {
      setActionMessage("Basit modda önce yüzünü ovalin içine hizalayıp “Yüzü hizala” düğmesine bas.");
      return;
    }

    if (!simpleModeRef.current && !faceRef.current) {
      setActionMessage("Yüz algılanamadı. Yüzünü kameraya gösterip tekrar dene.");
      return;
    }

    const face = simpleModeRef.current
      ? createCenteredFaceGeometry(width, height)
      : faceRef.current;
    if (!face) {
      setActionMessage("Yüz algılanamadı. Yüzünü kameraya gösterip tekrar dene.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Tuval oluşturulamadı.");

      // Mirror the video so the saved frame matches the selfie preview.
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);
      ctx.restore();

      drawAnimeEffects(ctx, width, height, face, {
        layers: layersRef.current,
        intensity: intensityRef.current,
        mirrored: true,
        sourceWidth: width,
        sourceHeight: height,
        phrase: phraseRef.current,
        timeMs: performance.now(),
        reduceMotion: reduceMotionRef.current,
        sparkles: sparklesRef.current,
      });

      const archetype = pickArchetype();
      const imageUrl = canvas.toDataURL("image/png");
      const phraseForCard = phraseRef.current;
      setCardData({ imageUrl, archetype, phrase: phraseForCard });
      setActionMessage("Kişilik kartın hazır. Anlık görüntü PNG olarak indiriliyor.");

      canvas.toBlob((blob) => {
        if (!blob) {
          setActionMessage("PNG oluşturulamadı. Tarayıcıyı yenileyip tekrar dene.");
          return;
        }
        downloadBlob(blob, timestampedFileName("anime-gozluk"));
        setActionMessage("Anlık görüntü indirildi. Kişilik kartın hazır.");
      }, "image/png");
    } catch (error) {
      console.warn("Anlık görüntü oluşturulamadı.", error);
      setActionMessage("Anlık görüntü oluşturulamadı. Tekrar deneyin.");
    }
  }

  const placeholderTitle =
    cameraStatus === "starting"
      ? "Kamera açılıyor…"
      : cameraStatus === "error"
        ? "Kameraya erişilemedi"
        : cameraStatus === "stopped"
          ? "Kamera durduruldu"
          : "Kamera kapalı";

  const placeholderText = cameraError
    ? cameraError
    : !secureContext
      ? "Kamera erişimi için sayfayı HTTPS veya localhost üzerinden aç."
      : cameraStatus === "starting"
        ? "Tarayıcı kamera iznini isteyebilir. Görüntü yalnızca bu sekmede işlenir."
        : cameraStatus === "stopped"
          ? "Görüntü akışı serbest bırakıldı. Hazır olduğunda yeniden başlatabilirsin."
          : "Başlamak için kameranı aç. Görüntü cihazından ayrılmaz.";

  const startLabel =
    cameraStatus === "error"
      ? "Yeniden dene"
      : cameraStatus === "stopped"
        ? "Kamerayı yeniden başlat"
        : "Kamerayı başlat";

  return (
    <>
      <section aria-label="Anime kamera stüdyosu">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)] lg:gap-10">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${statusDotClasses[status.tone]}`}
                />
                {status.label}
              </span>
              <span className="text-xs text-zinc-500">Yerel işlem</span>
            </div>

            <div
              ref={stageRef}
              aria-busy={
                cameraStatus === "starting" || detectionStatus === "loading"
              }
              className={`relative overflow-hidden rounded-xl border border-zinc-200 ${
                isLive ? "bg-zinc-950" : "bg-zinc-50"
              }`}
              style={{
                aspectRatio: isLive
                  ? `${videoSize.width} / ${videoSize.height}`
                  : "4 / 3",
              }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                aria-label="Web kamerası önizlemesi"
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  if (video.videoWidth > 0 && video.videoHeight > 0) {
                    setVideoSize({
                      width: video.videoWidth,
                      height: video.videoHeight,
                    });
                  }
                }}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
                  isLive ? "opacity-100" : "opacity-0"
                }`}
                style={{ transform: "scaleX(-1)" }}
              />
              <canvas
                ref={canvasRef}
                aria-hidden="true"
                className="absolute inset-0 h-full w-full"
              />

              {!isLive ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 py-4 text-center sm:gap-4 sm:px-6 sm:py-8">
                  <span className="hidden h-12 w-12 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 sm:grid">
                    {cameraStatus === "starting" ? (
                      <span
                        aria-hidden="true"
                        className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"
                      />
                    ) : (
                      <CameraIcon />
                    )}
                  </span>
                  <div>
                    <p
                      role={cameraStatus === "error" ? "alert" : undefined}
                      className="text-sm font-semibold text-zinc-900"
                    >
                      {placeholderTitle}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-zinc-600">
                      {placeholderText}
                    </p>
                  </div>
                  {secureContext && cameraStatus !== "starting" ? (
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className={primaryButton}
                    >
                      <CameraIcon />
                      {startLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {isLive && detectionStatus === "simple" ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
                  <p className="max-w-md rounded-full bg-zinc-950/80 px-3 py-1.5 text-center text-xs font-medium leading-5 text-white">
                    {simpleCalibrated
                      ? "Basit mod: efekt hizalı"
                      : "Yüzünü ovalin içine hizala, sonra “Yüzü hizala” düğmesine bas."}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={takeSnapshot}
                disabled={!isLive}
                aria-describedby="snapshot-note"
                className={primaryButton}
              >
                <DownloadIcon />
                Fotoğraf çek
                <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
                  PNG
                </span>
              </button>
              <button
                type="button"
                onClick={stopCamera}
                disabled={cameraStatus !== "live" && cameraStatus !== "starting"}
                className={secondaryButton}
              >
                <StopIcon />
                Kamera durdur
              </button>
            </div>

            <p id="snapshot-note" className="mt-2 text-xs leading-5 text-zinc-500">
              Her fotoğraf PNG olarak indirilir ve rastgele bir kişilik kartı
              açar.
            </p>

            <p
              role="status"
              aria-live="polite"
              className="mt-2 min-h-5 text-sm leading-5 text-zinc-700"
            >
              {actionMessage}
            </p>

            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-zinc-600">
              <LockIcon />
              <span>
                Her şey tarayıcında çalışır; görüntü hiçbir yere gönderilmez.
              </span>
            </p>
          </div>

          <aside aria-label="Efekt ayarları" className="space-y-7 border-t border-zinc-200 pt-7 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {detectionStatus === "loading" && isLive ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-medium text-zinc-900">
                  Yüz modeli yükleniyor…
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  WASM ve model yalnızca yerel dosyalardan okunur. İlk açılış
                  birkaç saniye sürebilir.
                </p>
              </div>
            ) : null}

            {detectionStatus === "simple" && isLive ? (
              <div
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 p-4"
              >
                <p className="text-sm font-semibold text-amber-900">
                  {SIMPLE_WARNING}
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  Yüz modeli yüklenemedi. Yüzünü ortadaki ovalin içine hizala ve
                  efektleri elle başlat.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!simpleCalibrated ? (
                    <button
                      type="button"
                      onClick={calibrateSimpleMode}
                      className={smallButton}
                    >
                      Yüzü hizala
                    </button>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-amber-900">
                        Hizalama tamam.
                      </span>
                      <button
                        type="button"
                        onClick={resetSimpleCalibration}
                        className={smallSecondaryButton}
                      >
                        Hizalamayı sıfırla
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            <section aria-labelledby="layers-heading">
              <div className="flex items-baseline justify-between gap-3">
                <h3
                  id="layers-heading"
                  className="text-sm font-semibold text-zinc-950"
                >
                  Katmanlar
                </h3>
                <span className="text-xs text-zinc-500">5 efekt</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Efektleri tek tek açıp kapatabilirsin.
              </p>
              <div className="mt-2 divide-y divide-zinc-100 border-y border-zinc-100">
                {LAYER_ITEMS.map((item) => (
                  <LayerToggle
                    key={item.key}
                    label={item.label}
                    checked={layers[item.key]}
                    onChange={() => toggleLayer(item.key)}
                  />
                ))}
              </div>
            </section>

            <section aria-labelledby="intensity-heading">
              <div className="flex items-center justify-between gap-3">
                <label
                  id="intensity-heading"
                  htmlFor="effect-intensity"
                  className="text-sm font-semibold text-zinc-950"
                >
                  Efekt yoğunluğu
                </label>
                <output
                  htmlFor="effect-intensity"
                  className="text-sm tabular-nums text-zinc-500"
                >
                  {intensity}%
                </output>
              </div>
              <input
                id="effect-intensity"
                type="range"
                min={0}
                max={100}
                step={5}
                value={intensity}
                onChange={(event) => setIntensity(Number(event.target.value))}
                aria-describedby="intensity-help"
                className="mt-4 h-1.5 w-full cursor-pointer accent-zinc-900"
              />
              <p id="intensity-help" className="mt-2 text-xs leading-5 text-zinc-500">
                Gözlerin, allığın, kulakların ve ışıltıların belirginliğini
                ayarlar.
              </p>
            </section>

            <div className="rounded-lg bg-zinc-50 p-4">
              <p className="text-sm font-medium text-zinc-900">İyi sonuç için</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Yüzün ışığa dönük olsun. Gözlük camları, maske ve yoğun gölgeler
                yüz algılamayı zorlaştırabilir.
              </p>
            </div>

            {!secureContext ? (
              <p className="text-xs leading-5 text-amber-800">
                Not: Kamera yalnızca güvenli bağlamda (HTTPS veya localhost)
                çalışır.
              </p>
            ) : null}
          </aside>
        </div>
      </section>

      <PersonalityCard
        open={cardData !== null}
        data={cardData}
        onClose={() => setCardData(null)}
      />
    </>
  );
}
