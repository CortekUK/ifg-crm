"use client";
import type { ReactNode } from "react";
import { ThemeProvider } from "./theme";
import { VideoProvider } from "./video-modal";
import { MotionProvider } from "./motion";
import { Ubar } from "./ubar";
import { Header } from "./header";
import { Footer } from "./footer";
import { Loader, Grain } from "./chrome";
import { AssistantWidget } from "./assistant-widget";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <VideoProvider>
        <MotionProvider>
          <Loader />
          <Grain />
          <div className="atmos" aria-hidden="true" />
          <Ubar />
          <Header />
          <main>{children}</main>
          <Footer />
          <AssistantWidget />
        </MotionProvider>
      </VideoProvider>
    </ThemeProvider>
  );
}
