import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "./site";

/**
 * The indexing rules (FR-SEO-01). Sign-in, profile and admin pages carry
 * `robots: { index: false }` in their own metadata; a disallow here would stop
 * a crawler from reading it, so only the API, which has no pages, is closed.
 */
export function catalogRobots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
