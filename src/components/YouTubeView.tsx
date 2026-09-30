import React from "react";
import MusicView from "./MusicView";

interface YouTubeViewProps {
  isActive?: boolean;
  onBackToHome?: () => void;
  onActiveVideoChange?: (title: string | null) => void;
}

export default function YouTubeView({
  isActive = true,
  onBackToHome,
}: YouTubeViewProps) {
  return (
    <div className="w-full flex-1 flex flex-col">
      <MusicView isActive={isActive} onBackToHome={onBackToHome} />
    </div>
  );
}
