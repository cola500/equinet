import type { Metadata, Viewport } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { FeatureFlagProvider } from "@/components/providers/FeatureFlagProvider";
import { Toaster } from "@/components/ui/sonner";
import { Footer } from "@/components/layout/Footer";
import { DevBanner } from "@/components/layout/DevBanner";
import { CookieNotice } from "@/components/layout/CookieNotice";
import { BugReportFab } from "@/components/provider/BugReportFab";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getFeatureFlags } from "@/lib/feature-flags";
import { isDemoMode } from "@/lib/demo-mode";

const inter = Inter({
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
});

export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Equinet - Bokningsplattform för hästtjänster",
  description: "Boka hovslagare, veterinärer och andra hästtjänster enkelt",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Equinet",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialFlags = await getFeatureFlags()
  const demo = isDemoMode() || initialFlags.demo_mode === true

  return (
    <html lang="sv">
      <body className={`${inter.className} ${dmSerif.variable} antialiased`}>
        <DevBanner />
        <SessionProvider>
          <FeatureFlagProvider initialFlags={initialFlags}>
            <SWRProvider>
              <div className="min-h-screen flex flex-col">
                <main className="flex-1">
                  {children}
                </main>
                <Footer />
              </div>
              <Toaster />
              <CookieNotice />
              {!demo && <BugReportFab />}
            </SWRProvider>
          </FeatureFlagProvider>
        </SessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
