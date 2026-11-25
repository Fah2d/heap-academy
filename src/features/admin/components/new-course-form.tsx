"use client";

import { useRouter } from "next/navigation";
import { adminCoursePath } from "@/domain/admin/gate";
import { CourseDetailsForm, type SaveCourse } from "./course-details-form";

export type NewCourseFormProps = {
  saveCourse: SaveCourse;
  /** Opens the new course's editor. The router's push by default. */
  navigate?: (path: string) => void;
};

/**
 * `/admin/courses/new`: the details, then the new course's editor opens
 * inside the app. A full page load would serve the editor before it can take
 * input, and the first render after it would drop what was typed meanwhile.
 */
export function NewCourseForm({ saveCourse, navigate }: NewCourseFormProps) {
  const router = useRouter();
  const open = navigate ?? ((path: string) => router.push(path));
  return (
    <CourseDetailsForm
      initial={{ title: "", slug: "", summary: "", outcomes: [] }}
      save={saveCourse}
      onCreated={(id) => open(adminCoursePath(id))}
    />
  );
}
