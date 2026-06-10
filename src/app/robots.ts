import type { MetadataRoute } from "next";
import { isDemoMode } from "@/lib/demo-mode";

export default function robots(): MetadataRoute.Robots {
  // Demo/staging environments must not be indexed.
  if (isDemoMode()) {
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
