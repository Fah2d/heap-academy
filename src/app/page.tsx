import { HomePage, homeMetadata } from "@/features/catalog";

export function generateMetadata() {
  return homeMetadata();
}

export default function Page() {
  return <HomePage />;
}
