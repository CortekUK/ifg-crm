import type { Metadata, Viewport } from "next";
import { Anton, Archivo, Spectral } from "next/font/google";
import "./colors_and_type.css";
import "./styles.css";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/components/theme";
import { JsonLd } from "@/components/json-ld";
import { SOCIALS } from "@/lib/data";
import { OG, SITE_NAME, SITE_URL, abs } from "@/lib/seo";

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

const TITLE = "IFG — World-class football education & experiences";
const DESCRIPTION =
  "The International Football Group — bachelor and master degrees in sport, training inside the methodologies of world-renowned clubs while living in Europe's great cities.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · IFG" },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "football education", "football university programme", "football scholarship UK",
    "summer football residency", "football gap year", "Macclesfield FC", "University of Lancashire",
    "sports degree", "international football academy",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "en_GB",
    title: TITLE,
    description: "Bachelor and master degrees in sport, delivered with world-renowned football clubs and universities.",
    images: [{ url: OG.default, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: "Bachelor and master degrees in sport, delivered with world-renowned football clubs and universities.",
    images: [OG.default],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E1413" },
    { media: "(prefers-color-scheme: light)", color: "#F5F2EA" },
  ],
};

// Social profile URLs without their share-tracking query strings.
const sameAs = [
  ...SOCIALS.map((s) => s[3].split("?")[0]),
  "https://www.youtube.com/@Footballinternational",
];

const ORG_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "EducationalOrganization",
      "@id": SITE_URL + "/#organization",
      name: SITE_NAME,
      alternateName: "IFG",
      url: SITE_URL,
      logo: abs("/og/ifg-logo-512.png"),
      image: abs(OG.default),
      email: "info@theinternationalfootballgroup.com",
      description: DESCRIPTION,
      sameAs,
    },
    {
      "@type": "WebSite",
      "@id": SITE_URL + "/#website",
      url: SITE_URL,
      name: SITE_NAME,
      inLanguage: "en-GB",
      publisher: { "@id": SITE_URL + "/#organization" },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${anton.variable} ${archivo.variable} ${spectral.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <JsonLd data={ORG_LD} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
