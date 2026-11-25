import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { catalogSitemap } from "@/features/catalog";

// Read per request, like every page: a sitemap built at build time would hold
// whatever the build could read, and keep it.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return catalogSitemap();
}
