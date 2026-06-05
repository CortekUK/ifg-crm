"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "./theme";
import { VideoProvider } from "./video-modal";
import { MotionProvider } from "./motion";
import { Ubar } from "./ubar";
import { Header } from "./header";
import { Footer } from "./footer";
import { Loader, Grain, Cursor } from "./chrome";

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Programme micro-sites supply their own header (and hide the announcement bar).
  const microSite = pathname.startsWith("/programmes/macclesfield");
  return (
    <ThemeProvider>
      <VideoProvider>
        <MotionProvider>
          <Loader />
          <Grain />
          <Cursor />
          <div className="atmos" aria-hidden="true" />
          {!microSite && <Ubar />}
          {!microSite && <Header />}
          <main>{children}</main>
          <Footer />
        </MotionProvider>
      </VideoProvider>
    </ThemeProvider>
  );
}
