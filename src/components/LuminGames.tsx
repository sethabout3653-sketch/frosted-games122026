import React, { useEffect, useState, useRef } from "react";
import "../lumin"; // Ensures global Window.Lumin typing is registered

interface LuminGamesProps {
  className?: string;
  theme?: "light" | "dark" | "auto";
}

/**
 * Clean, idiomatic React component that loads the official LuminSDK script dynamically
 * and initializes it via window.Lumin.init({ container: '#games', theme: 'dark' })
 * into a native <div id="games"></div> mount target.
 */
export const LuminGames: React.FC<LuminGamesProps> = ({
  className = "",
  theme = "dark",
}) => {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const scriptSrc = "https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js";

    const initLumin = async () => {
      try {
        if (window.Lumin && typeof window.Lumin.init === "function") {
          // Allow DOM container to paint
          await new Promise((resolve) => requestAnimationFrame(resolve));
          
          await window.Lumin.init({
            container: "#games",
            theme,
          });
          
          if (isMounted) {
            setIsLoaded(true);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn("[LuminSDK] Native mount:", err);
          setIsLoaded(true);
        }
      }
    };

    if (window.Lumin && typeof window.Lumin.init === "function") {
      initLumin();
      return;
    }

    let scriptTag = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);

    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.src = scriptSrc;
      scriptTag.async = true;
      scriptTag.crossOrigin = "anonymous";

      scriptTag.onload = () => {
        if (isMounted) {
          initLumin();
        }
      };

      scriptTag.onerror = () => {
        if (isMounted) {
          setError("Failed to load LuminSDK script from CDN");
        }
      };

      document.body.appendChild(scriptTag);
    } else {
      scriptTag.addEventListener("load", () => {
        if (isMounted) {
          initLumin();
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [theme]);

  return (
    <div className={`lumin-wrapper w-full ${className}`}>
      {error && (
        <div className="flex items-center justify-center p-4 text-xs text-rose-400 bg-rose-950/30 rounded-xl border border-rose-800/40 mb-3">
          {error}
        </div>
      )}
      {/* Official LuminSDK Mount Target */}
      <div id="games" ref={containerRef} className="w-full min-h-[400px]" />
    </div>
  );
};

export default LuminGames;
