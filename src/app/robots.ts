import type { MetadataRoute } from "next";
import { isStagingSafe } from "@/lib/environment";

export default function robots(): MetadataRoute.Robots {
  // Non-production environments (staging/preview/local) must not be indexed.
  // Driven by the environment, not by demo session — see isStagingSafe().
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
