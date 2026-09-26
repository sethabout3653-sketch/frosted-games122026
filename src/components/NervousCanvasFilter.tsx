import React, { useEffect, useRef } from "react";

interface NervousCanvasFilterProps {
  videoElement?: HTMLVideoElement | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  className?: string;
  style?: React.CSSProperties;
}

declare global {
  interface Window {
    vision?: any;
  }
}

let faceLandmarkerPromise: Promise<any> | null = null;

function loadMediaPipeFaceLandmarker() {
  if (faceLandmarkerPromise) return faceLandmarkerPromise;

  faceLandmarkerPromise = new Promise((resolve) => {
    // Load MediaPipe CDN Bundle if missing
    if (window.vision) {
      initLandmarker(window.vision).then(resolve);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/tasks-vision_bundle.js";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (window.vision) {
        initLandmarker(window.vision).then(resolve);
      } else {
        resolve(null);
      }
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return faceLandmarkerPromise;
}

async function initLandmarker(vision: any) {
  try {
    const { FilesetResolver, FaceLandmarker } = vision;
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });
    return landmarker;
  } catch (err) {
    console.error("MediaPipe FaceLandmarker load error:", err);
    return null;
  }
}

export default function NervousCanvasFilter({
  videoElement,
  videoRef,
  isActive,
  className = "",
  style = {},
}: NervousCanvasFilterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  useEffect(() => {
    if (!isActive) return;

    loadMediaPipeFaceLandmarker().then((landmarker) => {
      landmarkerRef.current = landmarker;
    });
  }, [isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const currentVideo = videoElement !== undefined ? videoElement : videoRef?.current;

    if (!canvas || !currentVideo || !isActive) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let isRunning = true;

    const renderFilter = () => {
      if (!isRunning || !canvas) return;
      const targetVideo = videoElement !== undefined ? videoElement : videoRef?.current;
      if (!targetVideo) return;

      if (targetVideo.readyState >= 2 && targetVideo.videoWidth > 0) {
        // High-performance canvas width and height
        const targetW = Math.min(targetVideo.videoWidth || 640, 640);
        const targetH = Math.min(targetVideo.videoHeight || 480, 480);

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const width = canvas.width;
        const height = canvas.height;

        // 1. Draw raw video frame
        ctx.drawImage(targetVideo, 0, 0, width, height);

        // 2. Locate Face Center via MediaPipe or fallback
        let noseX = width / 2;
        let noseY = height * 0.45;
        let faceRadius = Math.min(width, height) * 0.42;

        const landmarker = landmarkerRef.current;
        if (landmarker && targetVideo.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = targetVideo.currentTime;
          try {
            const results = landmarker.detectForVideo(targetVideo, performance.now());
            if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
              const landmarks = results.faceLandmarks[0];
              const nose = landmarks[1]; // Nose Tip
              const chin = landmarks[152];
              const forehead = landmarks[10];

              if (nose) {
                noseX = nose.x * width;
                noseY = nose.y * height;
              }
              if (chin && forehead) {
                const faceHeight = Math.abs(chin.y - forehead.y) * height;
                faceRadius = faceHeight * 1.1;
              }
            }
          } catch (e) {}
        }

        // Extract raw pixels
        const frame = ctx.getImageData(0, 0, width, height);
        const originalData = new Uint8ClampedArray(frame.data);

        // 3. THE WARPING MATH (MATCHING THE SCREENSHOT)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const dx = x - noseX;
            const dy = y - noseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < faceRadius) {
              const strength = (faceRadius - distance) / faceRadius;

              let sourceX = x;
              let sourceY = y;

              if (y < noseY) {
                // Above nose tip: Inward horizontal squeeze to pinch top of head
                sourceX = noseX + dx * (1.0 + strength * 0.35);
              } else {
                // Below nose tip: Aggressive outward horizontal stretch (~0.65 strength) to balloon mouth and cheeks
                sourceX = noseX + dx * (1.0 - strength * 0.65);
              }

              // Vertical Squash: Compress face matrix vertically (on Y-axis) to flatten nose closer to mouth
              sourceY = noseY + dy * (1.0 + strength * 0.25);

              // Clamp inside bounds
              sourceX = Math.max(0, Math.min(width - 1, Math.floor(sourceX)));
              sourceY = Math.max(0, Math.min(height - 1, Math.floor(sourceY)));

              const targetIdx = (y * width + x) * 4;
              const sourceIdx = (sourceY * width + sourceX) * 4;

              frame.data[targetIdx] = originalData[sourceIdx]; // Red
              frame.data[targetIdx + 1] = originalData[sourceIdx + 1]; // Green
              frame.data[targetIdx + 2] = originalData[sourceIdx + 2]; // Blue
            }
          }
        }

        // 4. Output warped real face pixels
        ctx.putImageData(frame, 0, 0);
      }

      animFrameIdRef.current = requestAnimationFrame(renderFilter);
    };

    renderFilter();

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [videoElement, isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full object-cover transform -scale-x-100 ${className}`}
      style={style}
    />
  );
}
