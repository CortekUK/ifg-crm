"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { Icon } from "./icons";
import { VIDEO_SRC, VIDEO_POSTER } from "@/lib/data";

type VideoOpts = { title?: string; src?: string; poster?: string };
type Ctx = { open: (o?: VideoOpts) => void; close: () => void };

const VideoCtx = createContext<Ctx>({ open: () => {}, close: () => {} });
export const useVideo = () => useContext(VideoCtx);

export function VideoProvider({ children }: { children: ReactNode }) {
  const [v, setV] = useState<VideoOpts | null>(null);
  const open = useCallback((o?: VideoOpts) => setV(o || { title: "IFG Film", src: VIDEO_SRC, poster: VIDEO_POSTER }), []);
  const close = useCallback(() => setV(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setV(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <VideoCtx.Provider value={{ open, close }}>
      {children}
      {v && (
        <div className="vmodal" onClick={close}>
          <div className="vmodal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="vmodal-bar">
              <span>{v.title || "IFG Film"} <em>· placeholder clip</em></span>
              <button onClick={close} aria-label="Close"><Icon name="x" size={20} /></button>
            </div>
            <video src={v.src || VIDEO_SRC} poster={v.poster || VIDEO_POSTER} controls autoPlay playsInline />
          </div>
        </div>
      )}
    </VideoCtx.Provider>
  );
}
