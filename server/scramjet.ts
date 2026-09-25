import { Router, Request, Response } from "express";
import http from "http";
import https from "https";
import { URL } from "url";

export const scramjetRouter = Router();

// Scramjet XOR codec helper for URL obfuscation & proxy decoding
export function scramjetDecode(str: string): string {
  if (!str) return "";
  // Check if standard plain URL
  if (str.startsWith("http://") || str.startsWith("https://")) {
    return str;
  }
  // Try XOR 2 (standard scramjet / UV default key)
  try {
    const decodedUri = decodeURIComponent(str);
    const xorResult = decodedUri
      .split("")
      .map((char, ind) =>
        ind % 2 === 0 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char
      )
      .join("");
    if (xorResult.startsWith("http://") || xorResult.startsWith("https://")) {
      return xorResult;
    }
  } catch {}

  // Try base64
  try {
    const b64 = Buffer.from(str, "base64").toString("utf-8");
    if (b64.startsWith("http://") || b64.startsWith("https://")) {
      return b64;
    }
  } catch {}

  // Fallback: decodeURIComponent
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export function scramjetEncode(url: string): string {
  if (!url) return "";
  return encodeURIComponent(
    url
      .split("")
      .map((char, ind) =>
        ind % 2 === 0 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char
      )
      .join("")
  );
}

const SOUNDBOARD_ORIGIN = "https://soundboardguys.com";

// Injected client script into proxied HTML pages to intercept dynamic fetches and audio
const SCRAMJET_CLIENT_INJECT = `
<script>
(function() {
  window.__SCRAMJET_ACTIVE__ = true;
  window.__SCRAMJET_ORIGIN__ = "${SOUNDBOARD_ORIGIN}";
  const PROXY_PREFIX = "/scramjet/service/";

  function rewriteUrl(url) {
    if (!url || typeof url !== "string") return url;
    if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("javascript:")) return url;
    if (url.startsWith(PROXY_PREFIX)) return url;
    
    try {
      var absolute = new URL(url, window.location.href);
      return PROXY_PREFIX + encodeURIComponent(absolute.href);
    } catch(e) {
      return url;
    }
  }

  // Intercept window.fetch
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === "string") {
      return originalFetch.call(this, rewriteUrl(input), init);
    } else if (input instanceof Request) {
      const newUrl = rewriteUrl(input.url);
      const newReq = new Request(newUrl, input);
      return originalFetch.call(this, newReq, init);
    }
    return originalFetch.apply(this, arguments);
  };

  // Intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return originalOpen.call(this, method, rewriteUrl(url), ...rest);
  };

  // Intercept Audio src
  const originalAudio = window.Audio;
  window.Audio = function(src) {
    const audio = new originalAudio();
    if (src) {
      audio.src = rewriteUrl(src);
    }
    return audio;
  };
  window.Audio.prototype = originalAudio.prototype;

  // Intercept history.pushState & replaceState to avoid messing up iframe url
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function(state, unused, url) {
    if (url) {
      return origPush.call(this, state, unused, rewriteUrl(url));
    }
    return origPush.apply(this, arguments);
  };
  history.replaceState = function(state, unused, url) {
    if (url) {
      return origReplace.call(this, state, unused, rewriteUrl(url));
    }
    return origReplace.apply(this, arguments);
  };
})();
</script>
`;

function rewriteHtmlContent(html: string, targetOrigin: string): string {
  let rewritten = html;

  // 1. Inject client interceptor at beginning of <head>
  if (rewritten.includes("<head>")) {
    rewritten = rewritten.replace("<head>", `<head>${SCRAMJET_CLIENT_INJECT}`);
  } else if (rewritten.includes("<html>")) {
    rewritten = rewritten.replace("<html>", `<html><head>${SCRAMJET_CLIENT_INJECT}</head>`);
  } else {
    rewritten = SCRAMJET_CLIENT_INJECT + rewritten;
  }

  // 2. Rewrite root-relative links/scripts/assets (href="/...", src="/...")
  rewritten = rewritten.replace(/(href|src|action)=["']\/(?!\/)([^"']*)["']/gi, (match, attr, path) => {
    const fullUrl = `${targetOrigin}/${path}`;
    return `${attr}="/scramjet/service/${encodeURIComponent(fullUrl)}"`;
  });

  // 3. Rewrite absolute soundboardguys.com URLs
  const originRegex = new RegExp(`(href|src|action)=["']https?:\\/\\/(?:www\\.)?soundboardguys\\.com([^"']*)["']`, "gi");
  rewritten = rewritten.replace(originRegex, (match, attr, path) => {
    const fullUrl = `${targetOrigin}${path}`;
    return `${attr}="/scramjet/service/${encodeURIComponent(fullUrl)}"`;
  });

  return rewritten;
}

// Scramjet Proxy Request Handler
scramjetRouter.all(["/service/*", "/service"], async (req: Request, res: Response) => {
  try {
    const rawPath = req.params[0] || (req.query.url as string) || "";
    let targetUrl = "";

    if (!rawPath) {
      // Default to soundboardguys home
      targetUrl = SOUNDBOARD_ORIGIN;
    } else {
      targetUrl = scramjetDecode(rawPath);
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = `${SOUNDBOARD_ORIGIN}/${rawPath.replace(/^\//, "")}`;
    }

    let parsedTarget: URL;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      parsedTarget = new URL(`${SOUNDBOARD_ORIGIN}/${targetUrl}`);
    }

    // Preserve query parameters
    const originalQuery = req.query;
    for (const [key, val] of Object.entries(originalQuery)) {
      if (key !== "url" && typeof val === "string") {
        parsedTarget.searchParams.set(key, val);
      }
    }

    const isSecure = parsedTarget.protocol === "https:";
    const client = isSecure ? https : http;

    const requestHeaders: Record<string, string | string[]> = {
      ...req.headers,
      host: parsedTarget.host,
      origin: parsedTarget.origin,
      referer: parsedTarget.origin + "/",
      "user-agent": req.headers["user-agent"] || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    };

    // Remove headers that prevent proxying
    delete requestHeaders["cookie"];
    delete requestHeaders["sec-fetch-dest"];
    delete requestHeaders["sec-fetch-mode"];
    delete requestHeaders["sec-fetch-site"];

    const proxyReq = client.request(
      parsedTarget.toString(),
      {
        method: req.method,
        headers: requestHeaders,
      },
      (proxyRes) => {
        // Forward status
        const statusCode = proxyRes.statusCode || 200;

        // Strip headers that block iframe embedding
        const responseHeaders = { ...proxyRes.headers };
        delete responseHeaders["x-frame-options"];
        delete responseHeaders["content-security-policy"];
        delete responseHeaders["content-security-policy-report-only"];
        delete responseHeaders["cross-origin-embedder-policy"];
        delete responseHeaders["cross-origin-opener-policy"];
        delete responseHeaders["cross-origin-resource-policy"];

        // Add permissive embedding & CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("X-Scramjet-Proxy", "active");

        for (const [headerKey, headerVal] of Object.entries(responseHeaders)) {
          if (headerVal !== undefined && headerKey.toLowerCase() !== "content-length") {
            res.setHeader(headerKey, headerVal as any);
          }
        }

        const contentType = (proxyRes.headers["content-type"] || "").toLowerCase();

        // If HTML, buffer and rewrite links & inject Scramjet runtime interceptor
        if (contentType.includes("text/html")) {
          let chunks: Buffer[] = [];
          proxyRes.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          proxyRes.on("end", () => {
            const rawBody = Buffer.concat(chunks).toString("utf-8");
            const rewrittenBody = rewriteHtmlContent(rawBody, parsedTarget.origin);
            res.status(statusCode);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("Content-Length", Buffer.byteLength(rewrittenBody));
            res.send(rewrittenBody);
          });
          return;
        }

        // For audio / video / static assets / streaming, pipe directly
        res.status(statusCode);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      console.error("[Scramjet Proxy Error]", targetUrl, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Scramjet upstream error",
          message: err.message,
          targetUrl,
        });
      }
    });

    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
        proxyReq.write(req.body);
      } else if (typeof req.body === "object") {
        proxyReq.write(JSON.stringify(req.body));
      }
    }

    req.pipe(proxyReq);
  } catch (err: any) {
    console.error("[Scramjet Proxy Fatal]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Scramjet Proxy Error", details: err?.message });
    }
  }
});
