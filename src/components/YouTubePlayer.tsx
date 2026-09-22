import React, { useState, useEffect } from "react";
import {
  Heart,
  ArrowLeft,
  Music,
} from "lucide-react";
import { YouTubeVideo } from "../types";
import { isVideoSaved, toggleSaveVideo, addToWatchHistory } from "../lib/youtubeStorage";

export function extractYouTubeId(urlOrId: string): string {
  const trimmed = (urlOrId || "").trim();
  if (!trimmed) return "";
  
  // If it's already a clean 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Try extracting from various URL formats
  try {
    // Handle youtube-nocookie.com or youtube.com embed links
    const embedRegex = /\/(embed|v)\/([a-zA-Z0-9_-]{11})/;
    const embedMatch = trimmed.match(embedRegex);
    if (embedMatch && embedMatch[2]) {
      return embedMatch[2];
    }

    // Handle watch?v= or watch/ format
    const watchRegex = /(v=|vi=|\/v\/|\/vi\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/;
    const watchMatch = trimmed.match(watchRegex);
    if (watchMatch && watchMatch[2]) {
      return watchMatch[2];
    }
    
    // Fallback search params search
    if (trimmed.includes("?")) {
      const urlObj = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const v = urlObj.searchParams.get("v") || urlObj.searchParams.get("vi");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v;
      }
    }
  } catch (e) {
    console.warn("Failed to parse YouTube URL:", e);
  }
  
  return trimmed;
}

interface YouTubePlayerProps {
  video: YouTubeVideo;
  onBack?: () => void;
  onSelectRelated?: (video: YouTubeVideo) => void;
  autoPlayNext?: boolean;
}

export default function YouTubePlayer({
  video,
  onBack,
  onSelectRelated,
  autoPlayNext = true,
}: YouTubePlayerProps) {
  const cleanVideoId = extractYouTubeId(video.id);
  const [isSaved, setIsSaved] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  useEffect(() => {
    setIsSaved(isVideoSaved(video.id));
    // Log watch history instantly for official embed playback
    addToWatchHistory(video, 0, 0);
  }, [video.id]);

  const handleToggleFavorite = () => {
    const next = toggleSaveVideo(video);
    setIsSaved(next);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
        <button
          id="yt-back-btn"
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-all border border-white/5 hover:border-white/10 cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Frosted Music</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400">
          <div
            style={{ backgroundColor: "var(--theme-accent)" }}
            className="w-5 h-5 rounded-md flex items-center justify-center text-white"
          >
            <Music size={11} />
          </div>
          <span className="text-white font-bold">Frosted Music Player</span>
        </div>
      </div>

      {/* Video Player Canvas Container */}
      <div className={`relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl group select-none transition-all duration-300 ${
        video.isShort
          ? "aspect-[9/16] max-w-[400px] mx-auto"
          : "w-full aspect-video"
      }`}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${cleanVideoId}?autoplay=1&rel=0&modestbranding=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>

      {/* Video Details & Meta Info Card */}
      <div className="space-y-3 pt-2">
        <h1 className="text-lg sm:text-xl font-bold text-white leading-snug">
          {video.title}
        </h1>

        <div className="flex items-center justify-between gap-4 flex-wrap pb-1">
          {/* Channel Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#272727] overflow-hidden border border-white/5 shrink-0 flex items-center justify-center">
              {video.channelThumbnail ? (
                <img
                  src={video.channelThumbnail}
                  alt={video.channelTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-sm">
                  {(video.channelTitle || "M")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                {video.channelTitle}
              </h2>
              <p className="text-xs text-neutral-400 font-normal">Official Audio / Track</p>
            </div>
          </div>

          {/* Save Action */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              style={{
                backgroundColor: isSaved ? "var(--theme-accent)" : "rgba(255, 255, 255, 0.08)",
                borderColor: isSaved ? "var(--theme-border)" : "transparent",
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                isSaved
                  ? "text-white shadow-md ring-1 ring-white/20"
                  : "hover:bg-white/15 text-white"
              }`}
              onClick={handleToggleFavorite}
            >
              <Heart size={14} className={isSaved ? "fill-white" : ""} />
              <span>{isSaved ? "Saved to Library" : "Save Track"}</span>
            </button>
          </div>
        </div>

        {/* Expandable Description Box */}
        {video.description && (
          <div
            onClick={() => setShowFullDesc(!showFullDesc)}
            className="p-3.5 rounded-2xl bg-[#272727]/80 hover:bg-[#272727] transition-colors cursor-pointer space-y-1.5"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              {video.views && <span>{video.views}</span>}
              {video.views && video.publishedTime && <span>•</span>}
              {video.publishedTime && <span>{video.publishedTime}</span>}
            </div>
            <p
              className={`text-xs text-neutral-300 leading-relaxed whitespace-pre-line ${
                showFullDesc ? "" : "line-clamp-2"
              }`}
            >
              {video.description}
            </p>
            {video.description.length > 120 && (
              <span className="text-xs font-bold text-neutral-400 hover:text-white inline-block pt-0.5">
                {showFullDesc ? "Show less" : "...more"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
