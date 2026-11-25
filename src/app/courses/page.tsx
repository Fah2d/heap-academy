import { CourseListPage, courseListMetadata } from "@/features/catalog";

export function generateMetadata() {
  return courseListMetadata();
}

export default function Page() {
  return <CourseListPage />;
}
