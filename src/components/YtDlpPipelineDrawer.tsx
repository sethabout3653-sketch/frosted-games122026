import React, { useState } from "react";
import {
  Terminal,
  Copy,
  Check,
  Play,
  Download,
  Flame,
  Radio,
  ExternalLink,
  Code2,
  X,
  Sparkles,
  Server,
} from "lucide-react";
import { useMusicPlayer } from "../context/MusicPlayerContext";

interface YtDlpPipelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function YtDlpPipelineDrawer({
  isOpen,
  onClose,
}: YtDlpPipelineDrawerProps) {
  const { resolveAndPlayUrl, currentTrack } = useMusicPlayer();
  const [testUrl, setTestUrl] = useState("https://music.youtube.com/watch?v=5qap5aO4i9A");
  const [audioFormat, setAudioFormat] = useState<"mp3" | "flac" | "wav" | "m4a" | "opus">("mp3");
  const [audioQuality, setAudioQuality] = useState<string>("0");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const targetUrl = testUrl.trim() || "https://soundcloud.com/artist/track";

  // CLI Command 1: Archive & Sync Extraction (Skip duplicate downloads)
  const cmdExtraction = `yt-dlp -x --audio-format ${audioFormat} --download-archive archive.txt "${targetUrl}"`;

  // CLI Command 2: Direct Stdout Media Pipeline
  const cmdStreamingPipe = `yt-dlp -o - "${targetUrl}" | vlc -`;

  // CLI Command 3: High-Res Metadata & Stream URL Dump
  const cmdDumpStream = `yt-dlp -g -f bestaudio "${targetUrl}"`;

  // Python Script Example
  const pythonScript = `import yt_dlp

ydl_opts = {
    'format': 'bestaudio/best',
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': '${audioFormat}',
        'preferredquality': '192',
    }],
    'outtmpl': 'downloads/%(title)s.%(ext)s',
}

def play_track(url):
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        print(f"Downloaded audio track: {filename}")
        # Pass stream to your audio engine (e.g. pygame.mixer, vlc-python)
`;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleRunStreamTest = async () => {
    if (!testUrl.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    const res = await resolveAndPlayUrl(testUrl.trim());
    setIsTesting(false);
    if (res.success && res.track) {
      setTestResult({
        status: "success",
        title: res.track.title,
        artist: res.track.artist,
        mediaUrl: res.track.mediaUrl || "Live Audio Buffer",
        source: res.track.sourceType || "yt-dlp stream",
      });
    } else {
      setTestResult({
        status: "error",
        message: res.error || "Failed to resolve stream",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl bg-[#0e111a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Terminal size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>yt-dlp Audio Extraction & Streaming Pipeline</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  v2026.08.19
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Direct audio stream extraction, FFmpeg conversion, and streaming without video overhead
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {/* Live URL Extraction Tester */}
          <div className="bg-[#080a10] p-4 rounded-2xl border border-white/10 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Server size={14} />
              <span>Live URL Stream Tester</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="Paste track or direct stream link..."
                className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={handleRunStreamTest}
                disabled={isTesting || !testUrl.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/30"
              >
                {isTesting ? (
                  <span className="animate-spin">&bull;</span>
                ) : (
                  <Play size={14} className="fill-white" />
                )}
                <span>{isTesting ? "Resolving..." : "Extract & Play"}</span>
              </button>
            </div>

            {/* Quick Source Platform Presets */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Supported yt-dlp Extraction Sources:</span>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {[
                  { name: "SoundCloud", url: "https://soundcloud.com/chillhopdotcom/distantdays" },
                  { name: "YouTube Music", url: "https://www.youtube.com/watch?v=5qap5aO4i9A" },
                  { name: "Bandcamp", url: "https://chillhop.bandcamp.com/track/distant-days" },
                  { name: "Audiomack", url: "https://audiomack.com/chillhop-music/song/distant-days" },
                  { name: "Mixcloud", url: "https://www.mixcloud.com/ChillhopMusic/chillhop-essentials-spring-2024/" },
                  { name: "Direct Stream URL", url: "https://stream.chillhop.com/mp3/1000" },
                ].map((src) => (
                  <button
                    key={src.name}
                    type="button"
                    onClick={() => setTestUrl(src.url)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-neutral-300 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {src.name}
                  </button>
                ))}
              </div>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono ${
                  testResult.status === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                {testResult.status === "success" ? (
                  <div>
                    <strong>Stream Extracted:</strong> {testResult.title} by {testResult.artist} &bull; Loaded into player queue!
                  </div>
                ) : (
                  <div>
                    <strong>Error:</strong> {testResult.message}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Core Command Formats */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                01. Clean Audio Extraction (yt-dlp)
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-400">Format:</span>
                {(["mp3", "flac", "wav", "m4a", "opus"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setAudioFormat(fmt)}
                    className={`px-2 py-0.5 rounded border uppercase text-[10px] font-mono font-bold transition-colors ${
                      audioFormat === fmt
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-white/5 border-white/5 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Command 1 Block */}
            <div className="bg-[#080a10] rounded-2xl border border-white/10 p-4 space-y-2 relative group">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span className="font-mono text-emerald-400">Extracts audio without saving massive video files:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(cmdExtraction, 1)}
                  className="flex items-center gap-1 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedIndex === 1 ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedIndex === 1 ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="p-3 bg-black/60 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto selection:bg-emerald-600 selection:text-white">
                {cmdExtraction}
              </pre>
              <div className="text-[11px] text-neutral-400 space-y-1 pt-1">
                <div>&bull; <strong className="text-neutral-300">-x</strong>: Extracts the audio-only track from the media.</div>
                <div>&bull; <strong className="text-neutral-300">--audio-format {audioFormat}</strong>: Converts and saves the audio as an MP3 file.</div>
                <div>&bull; <strong className="text-neutral-300">--download-archive archive.txt</strong>: Logs downloaded track IDs in archive.txt to skip duplicates and download only newly added tracks.</div>
              </div>
            </div>

            {/* Command 2 Block: Direct Pipe */}
            <div className="bg-[#080a10] rounded-2xl border border-white/10 p-4 space-y-2 relative group">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span className="font-mono text-cyan-400">02. Streaming Without Local Disk Writing:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(cmdStreamingPipe, 2)}
                  className="flex items-center gap-1 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedIndex === 2 ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedIndex === 2 ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="p-3 bg-black/60 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto">
                {cmdStreamingPipe}
              </pre>
              <p className="text-[11px] text-neutral-400">
                Pipes the stream standard output directly into a media engine (VLC / FFplay / custom player).
              </p>
            </div>

            {/* Python Backend Example */}
            <div className="bg-[#080a10] rounded-2xl border border-white/10 p-4 space-y-2 relative group">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span className="font-mono text-purple-400">03. Python Backend Integration (yt_dlp module):</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(pythonScript, 3)}
                  className="flex items-center gap-1 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedIndex === 3 ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedIndex === 3 ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="p-3 bg-black/60 rounded-xl text-xs font-mono text-purple-200 overflow-x-auto">
                {pythonScript}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400 font-mono">
            yt-dlp release v2026.08.19 &bull; Web Audio API Engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
