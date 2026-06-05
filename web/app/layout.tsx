import type { Metadata } from "next";
import { Anton, Archivo, Spectral } from "next/font/google";
import "./colors_and_type.css";
import "./styles.css";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/components/theme";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--f-anton", display: "swap" });
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--f-archivo",
  display: "swap",
});
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--f-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "IFG — World-class football education & experiences",
    template: "%s · IFG",
  },
  description:
    "The International Football Group — bachelor and master degrees in sport, training inside the methodologies of world-renowned clubs while living in Europe's great cities.",
  metadataBase: new URL("https://theinternationalfootballgroup.com"),
  openGraph: {
    title: "IFG — World-class football education & experiences",
    description: "Bachelor and master degrees in sport, delivered with world-renowned football clubs and universities.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${archivo.variable} ${spectral.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
