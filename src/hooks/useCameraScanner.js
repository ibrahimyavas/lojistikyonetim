import { useCallback, useEffect, useRef, useState } from "react";
import { resolveQrOnlyDetector, QR_ONLY_FORMATS } from "../lib/barcodeDetector.js";

const REPEAT_COOLDOWN_MS = 1500; // ignore re-reads of the *same* code while it's still sitting in frame
const FALLBACK_INTERVAL_MS = 66; // ~15fps, used only when requestVideoFrameCallback is unavailable (e.g. Firefox)

// --- düşük ışık desteği (cropRegion verilen QR modu için) --
const BRIGHTNESS_CHECK_INTERVAL_MS = 250; // her karede ölçmeye gerek yok, ucuz olsa da
const AUTO_TORCH_LUMA = 55; // 0-255 - bunun altı "karanlık, fenere ihtiyaç var" kabul edilir
const AUTO_TORCH_HOLD_MS = 900; // ani gölgelerde (parmak, hızlı hareket) yanlışlıkla tetiklenmesin diye karanlığın bu süre kadar sürmesini bekle
const ENHANCE_LUMA = 120; // bunun altında kırpılan kareye parlaklık/kontrast artışı uygulanır

/**
 * Drives a <video> camera preview plus a continuous QR-detection loop.
 * Detection runs once per real video frame via `requestVideoFrameCallback`
 * (the tightest, lowest-latency hook available - falls back to a timer loop
 * where unsupported) and is guarded against overlap so a slow decode never
 * queues up a backlog of frames.
 *
 * Bu proje yalnızca QR okuyor (bkz. lib/barcodeDetector.js) - varsayılan
 * `formats`/`resolveDetector` bilerek QR-only, barkod-okuyucu ERP'sindeki
 * gibi çoklu-format bir Tarayıcı ekranı burada yok.
 */
export function useCameraScanner({
  enabled,
  formats = QR_ONLY_FORMATS,
  resolveDetector = resolveQrOnlyDetector,
  cropRegion = null, // { widthPct, heightPct } - analyze only a centered region, downscaled, instead of the full frame
  debug = false, // true: her ~400ms'de bir, dedektöre giden ham kareyi debugFrame olarak (data URL) dışa ver - teşhis içindir, üretimde kapalı
  onDetect,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const detectorRef = useRef(null);
  const busyRef = useRef(false);
  const loopHandleRef = useRef(null);
  const usingRvfcRef = useRef(false);
  const lastAcceptedRef = useRef({ code: null, at: 0 });
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;
  const cropRegionRef = useRef(cropRegion);
  cropRegionRef.current = cropRegion;
  const cropCanvasRef = useRef(null);
  const brightnessCanvasRef = useRef(null); // 16x16 ölçüm için ayrı, ucuz canvas
  const lastBrightnessCheckRef = useRef(0);
  const avgLumaRef = useRef(255); // ölçülene kadar "aydınlık" varsay
  const darkSinceRef = useRef(null);
  const autoTorchTriedRef = useRef(false); // her akış (stream) başına en fazla bir kez otomatik fener dene
  const lastDebugSnapshotRef = useRef(0);

  const [devices, setDevices] = useState([]);
  const [activeDeviceId, setActiveDeviceId] = useState(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [usingNative, setUsingNative] = useState(null); // null = not resolved yet
  const [debugFrame, setDebugFrame] = useState(null); // data URL - dedektöre giden son ham kare (yalnızca debug=true iken doldurulur)

  // A stable primitive to key the effect below on, instead of the `formats`
  // array itself - callers that pass a fresh array literal each render
  // would otherwise restart the camera on every render.
  const formatsKey = formats.join(",");

  const drawOverlay = useCallback((barcode) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;
    if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
    }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!barcode || !barcode.cornerPoints?.length) return;

    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;
    const pts = barcode.cornerPoints;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = p.x * scaleX;
      const y = p.y * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(barcode.rawValue, pts[0].x * scaleX, Math.max(14, pts[0].y * scaleY - 8));
  }, []);

  // Video karesinin ortalama parlaklığını ucuza ölçer: video'yu minik bir
  // 16x16 canvas'a küçültüp okur (küçültme GPU'da ucuz, 256 pikseli okumak
  // da öyle) - her karede değil, BRIGHTNESS_CHECK_INTERVAL_MS'de bir yapılır.
  function sampleBrightness(video) {
    const now = performance.now();
    if (now - lastBrightnessCheckRef.current < BRIGHTNESS_CHECK_INTERVAL_MS) {
      return avgLumaRef.current;
    }
    lastBrightnessCheckRef.current = now;
    if (!brightnessCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = 16;
      c.height = 16;
      brightnessCanvasRef.current = c;
    }
    const c = brightnessCanvasRef.current;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, 16, 16);
    const { data } = ctx.getImageData(0, 0, 16, 16);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    avgLumaRef.current = sum / (data.length / 4);
    return avgLumaRef.current;
  }

  // When cropRegion is set (QR mode), analyze a centered crop of the frame
  // instead of the whole 1920x1080 image, downscaled to a modest cap.
  function getDetectSource(video) {
    const region = cropRegionRef.current;
    if (!region || !video.videoWidth) return video;

    const srcW = video.videoWidth * region.widthPct;
    const srcH = video.videoHeight * region.heightPct;
    const srcX = (video.videoWidth - srcW) / 2;
    const srcY = (video.videoHeight - srcH) / 2;

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));

    if (!cropCanvasRef.current) cropCanvasRef.current = document.createElement("canvas");
    const canvas = cropCanvasRef.current;
    if (canvas.width !== outW || canvas.height !== outH) {
      canvas.width = outW;
      canvas.height = outH;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Düşük ışıkta kırpılan kareye parlaklık/kontrast artışı uygula - ne
    // kadar karanlıksa artış o kadar güçlü.
    const luma = sampleBrightness(video);
    if (luma < ENHANCE_LUMA) {
      const t = Math.min(1, (ENHANCE_LUMA - luma) / ENHANCE_LUMA); // 0..1, karanlık arttıkça 1'e yaklaşır
      ctx.filter = `brightness(${(1 + t * 0.6).toFixed(2)}) contrast(${(1 + t * 0.35).toFixed(2)})`;
    } else {
      ctx.filter = "none";
    }

    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

    if (debug) {
      const now = performance.now();
      if (now - lastDebugSnapshotRef.current > 400) {
        lastDebugSnapshotRef.current = now;
        setDebugFrame(canvas.toDataURL("image/jpeg", 0.7));
      }
    }

    return canvas;
  }

  // Held in a ref (rather than a plain useCallback) so `schedule` below can
  // always call the latest version without the two needing to reference each
  // other before either is defined.
  const tickRef = useRef(null);
  tickRef.current = async function tick() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || busyRef.current) {
      schedule();
      return;
    }
    busyRef.current = true;
    try {
      const source = getDetectSource(video);
      maybeAutoTorch();
      const results = await detectorRef.current.detect(source);
      const best = results[0] || null;
      drawOverlay(source === video ? best : null);
      if (best) {
        const now = Date.now();
        const last = lastAcceptedRef.current;
        if (best.rawValue !== last.code || now - last.at > REPEAT_COOLDOWN_MS) {
          lastAcceptedRef.current = { code: best.rawValue, at: now };
          onDetectRef.current?.(best.rawValue, best.format);
        }
      }
    } catch {
      // Transient decode error (e.g. frame mid-transition) - just skip it.
    } finally {
      busyRef.current = false;
      schedule();
    }
  };

  // Karanlıkta (QR modu, ayrıca cihazda fener varsa) fenerin otomatik
  // açılmasını dener - kullanıcı fenere elle dokunmuş ya da bu akışta zaten
  // bir kez denenmişse tekrar araya girmez.
  function maybeAutoTorch() {
    if (!cropRegionRef.current) return; // yalnızca QR modunda
    if (!hasTorch || torchOn || autoTorchTriedRef.current) return;
    const luma = avgLumaRef.current;
    if (luma >= AUTO_TORCH_LUMA) {
      darkSinceRef.current = null;
      return;
    }
    if (darkSinceRef.current == null) darkSinceRef.current = Date.now();
    if (Date.now() - darkSinceRef.current > AUTO_TORCH_HOLD_MS) {
      autoTorchTriedRef.current = true; // her akış (stream) başına en fazla bir kez dene
      toggleTorch();
    }
  }

  function schedule() {
    const video = videoRef.current;
    if (!video) return;
    if (typeof video.requestVideoFrameCallback === "function") {
      usingRvfcRef.current = true;
      loopHandleRef.current = video.requestVideoFrameCallback(() => tickRef.current());
    } else {
      usingRvfcRef.current = false;
      loopHandleRef.current = setTimeout(() => tickRef.current(), FALLBACK_INTERVAL_MS);
    }
  }

  const stopLoop = useCallback(() => {
    const video = videoRef.current;
    if (loopHandleRef.current == null) return;
    if (usingRvfcRef.current && video?.cancelVideoFrameCallback) {
      video.cancelVideoFrameCallback(loopHandleRef.current);
    } else {
      clearTimeout(loopHandleRef.current);
    }
    loopHandleRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
    setHasTorch(false);
    setTorchOn(false);
  }, [stopLoop]);

  useEffect(() => {
    if (!enabled) {
      stopStream();
      return;
    }
    let cancelled = false;
    setStarting(true);
    setError(null);

    // focusMode: "continuous" - QR kodları genelde yakın mesafeden
    // okutuluyor; telefonun kamerası uzak mesafeye kilitli kalırsa hiçbir
    // dekode motoru bulanık bir kareyi okuyamaz. `ideal` olduğu için
    // desteklemeyen tarayıcılarda (örn. iOS Safari) sessizce yok sayılır.
    const constraints = {
      video: activeDeviceId
        ? {
            deviceId: { exact: activeDeviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            focusMode: { ideal: "continuous" },
          }
        : {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            focusMode: { ideal: "continuous" },
          },
      audio: false,
    };

    Promise.all([resolveDetector(formats), navigator.mediaDevices.getUserMedia(constraints)])
      .then(async ([{ Impl, usingNative: isNative }, stream]) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        detectorRef.current = new Impl({ formats });
        setUsingNative(isNative);

        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = track?.getCapabilities?.() || {};
        setHasTorch(Boolean(caps.torch));
        if (caps.focusMode?.includes?.("continuous")) {
          track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
        }
        // Yeni akışta düşük-ışık ölçümünü/otomatik-fener denemesini sıfırla.
        autoTorchTriedRef.current = false;
        darkSinceRef.current = null;
        avgLumaRef.current = 255;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Device labels are only populated once permission has been granted,
        // so we (re-)enumerate here rather than on mount.
        const list = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(list.filter((d) => d.kind === "videoinput"));

        setStarting(false);
        schedule();
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Kameraya erişilemedi.");
          setStarting(false);
        }
      });

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, activeDeviceId, formatsKey, resolveDetector]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track || !hasTorch) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      // Torch toggle unsupported mid-stream on this device - ignore.
    }
  }, [hasTorch, torchOn]);

  return {
    videoRef,
    canvasRef,
    devices,
    activeDeviceId,
    setActiveDeviceId,
    hasTorch,
    torchOn,
    toggleTorch,
    error,
    starting,
    usingNative,
    debugFrame,
  };
}
