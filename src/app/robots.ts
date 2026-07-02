import type { MetadataRoute } from "next";
import { isStagingSafe } from "@/lib/environment";

export default function robots(): MetadataRoute.Robots {
  // Only the real production runtime (IS_LIVE_PRODUCTION=true) is indexable.
  // Staging/local/preview must never be indexed.
  if (isStagingSafe()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/provider/", "/stable/"],
      },
    ],
    sitemap: "https://equinet-app.vercel.app/sitemap.xml",
  };
}
