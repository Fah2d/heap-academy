import "server-only";
import { requestNonce } from "@/infrastructure/http/nonce";
import { type AdminGalleryPart, AdminStateGallery } from "./admin-state-gallery";

/**
 * The development gallery, given this request's nonce for the code editors'
 * styles. Not an admin page: its data is fake and it has no guard.
 */
export async function AdminStateGalleryServer({ part }: { part: AdminGalleryPart }) {
  return <AdminStateGallery nonce={await requestNonce()} part={part} />;
}
