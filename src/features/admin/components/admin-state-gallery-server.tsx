import "server-only";
import { requestNonce } from "@/infrastructure/http/nonce";
import { type AdminGalleryPart, AdminStateGallery } from "./admin-state-gallery";

/**
 * The development gallery, given this request's nonce for the code editors'
 * styles. Not an admin page: its data is fake and it has no guard. An
 * `example` in the address shows that one example alone.
 */
export async function AdminStateGalleryServer({
  part,
  searchParams,
}: {
  part: AdminGalleryPart;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { example } = await searchParams;
  return (
    <AdminStateGallery
      nonce={await requestNonce()}
      part={part}
      example={typeof example === "string" ? example : undefined}
    />
  );
}
