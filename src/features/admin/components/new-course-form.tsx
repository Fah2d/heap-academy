"use client";

import { adminCoursePath } from "@/domain/admin/gate";
import { CourseDetailsForm, type SaveCourse } from "./course-details-form";

export type NewCourseFormProps = {
  saveCourse: SaveCourse;
  navigate?: (path: string) => void;
};

/** `/admin/courses/new`: the details, then the new course's editor opens. */
export function NewCourseForm({
  saveCourse,
  navigate = (path) => window.location.assign(path),
}: NewCourseFormProps) {
  return (
    <CourseDetailsForm
      initial={{ title: "", slug: "", summary: "", outcomes: [] }}
      save={saveCourse}
      onCreated={(id) => navigate(adminCoursePath(id))}
    />
  );
}
