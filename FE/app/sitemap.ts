import type { MetadataRoute } from "next";
import { siteUrl } from "./siteMetadata";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/landing/"].map((pathname) => ({
    url: new URL(pathname, siteUrl).href,
  }));
}
