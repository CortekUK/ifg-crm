import type { Metadata } from "next"
import { Suspense } from "react"
import { Inter, Oswald } from "next/font/google"
import { QueryProvider } from "@/components/providers/QueryProvider"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { TopProgressBar } from "@/components/ui/top-progress-bar"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "IFG CRM - International Football Group",
  description: "Football player recruitment CRM",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${oswald.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {/* Top progress bar — uses useSearchParams so it must live in
                a Suspense boundary to satisfy Next 15's static-bailout rule. */}
            <Suspense fallback={null}>
              <TopProgressBar />
            </Suspense>
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
