import { useCallback, useEffect, useRef, useState } from "react";

type ScreenCaptureState = {
  isSharing: boolean;
  error: string | null;
  startSharing: () => Promise<boolean>;
  stopSharing: () => void;
  captureFrame: () => Promise<string | null>;
};

const MAX_FRAME_WIDTH = 1280;
const JPEG_QUALITY = 0.72;

/**
 * Captura consentida da tela no navegador local.
 * A API getDisplayMedia sempre abre o seletor do sistema; o Jarvis não inicia a captura sozinho.
 */
export function useScreenCapture(): ScreenCaptureState {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopSharing = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
  }, []);

  const startSharing = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Este navegador não suporta compartilhamento de tela.");
      return false;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 2, max: 5 } },
        audio: false,
      });
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopSharing());
      streamRef.current = stream;
      videoRef.current = video;
      setIsSharing(true);
      return true;
    } catch (captureError) {
      const message = captureError instanceof Error ? captureError.message : "Compartilhamento de tela cancelado.";
      setError(message);
      stopSharing();
      return false;
    }
  }, [stopSharing]);

  const captureFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || !streamRef.current || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Compartilhe uma tela antes de pedir uma análise visual.");
      return null;
    }

    const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      setError("Não foi possível preparar a captura de tela.");
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64 = dataUrl.split(",")[1] || "";

    if (!base64) {
      setError("A captura de tela não gerou uma imagem válida.");
      return null;
    }

    setError(null);
    return base64;
  }, []);

  useEffect(() => stopSharing, [stopSharing]);

  return { isSharing, error, startSharing, stopSharing, captureFrame };
}
