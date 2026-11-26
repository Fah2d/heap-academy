import { CoursePage, courseMetadata } from "@/features/catalog";

type Props = { params: Promise<{ course: string }> };

export function generateMetadata({ params }: Props) {
  return courseMetadata(params);
}

export default function Page({ params }: Props) {
  return <CoursePage params={params} />;
}
