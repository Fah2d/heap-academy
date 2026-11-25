import type { MetadataRoute } from "next";
import { catalogRobots } from "@/features/catalog";

export default function robots(): MetadataRoute.Robots {
  return catalogRobots();
}
