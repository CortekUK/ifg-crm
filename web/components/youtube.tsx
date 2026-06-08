"use client";
import { useState } from "react";
import { Icon } from "./icons";
import { ytThumb } from "@/lib/data";

/**
 * Lightweight YouTube facade: renders the thumbnail + play button and only
 * mounts the (heavy) iframe once the user clicks — keeps the page fast.
 */
export function YouTubeLite({ id, title, className = "", eager = false }: { id: string; title: string; className?: string; eager?: boolean }) {
  const [play, setPlay] = useState(false);
  return (
    <div className={"yt-lite " + className}>
      {play ? (
        <iframe
          className="yt-frame"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button className="yt-poster" onClick={() => setPlay(true)} aria-label={`Play: ${title}`}>
          <img
            src={ytThumb(id)}
            alt={title}
            loading={eager ? "eager" : "lazy"}
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.dataset.fallback) {
                img.dataset.fallback = "1";
                img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
              }
            }}
          />
          <span className="yt-play"><Icon name="play" size={24} /></span>
        </button>
      )}
    </div>
  );
}
