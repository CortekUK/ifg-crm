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
import { AssistantWidget } from "./assistant-widget";
import { ExitIntent } from "./exit-intent";

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
          <AssistantWidget />
          <ExitIntent />
        </MotionProvider>
      </VideoProvider>
    </ThemeProvider>
  );
}
