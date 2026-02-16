import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import SessionProvider from "@/components/providers/SessionProvider";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { FeatureFlagProvider } from "@/components/providers/FeatureFlagProvider";
import { Toaster } from "@/components/ui/sonner";
import { Footer } from "@/components/layout/Footer";
import { DevBanner } from "@/components/layout/DevBanner";
import { CookieNotice } from "@/components/layout/CookieNotice";
import { getFeatureFlags } from "@/lib/feature-flags";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Equinet - Bokningsplattform för hästtjänster",
  description: "Boka hovslagare, veterinärer och andra hästtjänster enkelt",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialFlags = await getFeatureFlags()

  return (
    <html lang="sv">
      <body className={`${inter.className} antialiased`}>
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
            </SWRProvider>
          </FeatureFlagProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
