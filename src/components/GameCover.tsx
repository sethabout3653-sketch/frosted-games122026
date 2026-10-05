import React, { memo } from "react";
import { formatCoverUrl } from "../utils";

interface GameCoverProps {
  name: string;
  cover?: string;
  url?: string;
  className?: string;
}

const GameCover = memo(function GameCover({
  name,
  cover = "",
  className = "",
}: GameCoverProps) {
  // Normalize cover source to direct real image URL
  const rawSrc = (cover || "").trim();
  const formattedSrc = formatCoverUrl(rawSrc);
  const activeSrc = formattedSrc || rawSrc;

  return (
    <div className={`relative h-full w-full overflow-hidden bg-neutral-900 ${className}`}>
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-neutral-900" />
      )}
    </div>
  );
});

export default GameCover;
