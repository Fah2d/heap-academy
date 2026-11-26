import { lessonMetadata, LessonPage } from "@/features/catalog";

type Params = Promise<{ course: string; lesson: string }>;

export function generateMetadata({ params }: { params: Params }) {
  return lessonMetadata(params);
}

export default function Page({ params }: { params: Params }) {
  return <LessonPage params={params} />;
}
