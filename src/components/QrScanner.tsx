// Reads student ID cards (QR) with the phone camera, using jsQR on each video frame.

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

interface Props {
  onCode: (code: string) => void;
  onClose: () => void;
}

const QR_PATTERN = /^RS-[A-Z0-9]{4,8}(?:-[A-Z0-9]{4})?$/;
const REPEAT_MS = 3000; // ignore the same card for 3 seconds

export function QrScanner({ onCode, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const lastSeen = useRef<{ code: string; at: number } | null>(null);
  const handler = useRef(onCode);
  handler.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara. Escriba el código manualmente.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        setError("No se pudo abrir la cámara. Revise el permiso de cámara del navegador (se requiere HTTPS).");
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      tick();
    }

    function tick() {
      if (stopped) return;
      const v = video.current;
      const c = canvas.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
        const width = Math.min(v.videoWidth, 640);
        const height = Math.round((v.videoHeight / v.videoWidth) * width);
        c.width = width;
        c.height = height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, width, height);
          const image = ctx.getImageData(0, 0, width, height);
          const result = jsQR(image.data, width, height, { inversionAttempts: "dontInvert" });
          const text = result?.data.trim().toUpperCase();
          if (text && QR_PATTERN.test(text)) {
            const now = Date.now();
            const previous = lastSeen.current;
            if (!previous || previous.code !== text || now - previous.at > REPEAT_MS) {
              lastSeen.current = { code: text, at: now };
              setLast(text);
              navigator.vibrate?.(120);
              handler.current(text);
            }
          }
        }
      }
      frame = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="scanner">
      {error ? (
        <p className="notice notice-error">{error}</p>
      ) : (
        <div className="scanner-view">
          <video ref={video} playsInline muted />
          <span className="scanner-frame" aria-hidden="true" />
        </div>
      )}
      <canvas ref={canvas} hidden />
      <div className="scanner-foot">
        <span className="muted" role="status">
          {last ? `Último carnet leído: ${last}` : "Apunte la cámara al código QR del carnet."}
        </span>
        <button type="button" className="button button-quiet" onClick={onClose}>
          Cerrar cámara
        </button>
      </div>
    </div>
  );
}
