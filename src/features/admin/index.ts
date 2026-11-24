// The admin area (FR-ADM-01, FR-ADM-02; docs/spec/03-experience.md section
// 7): the gate, the second sign-in step, the course list, the course editor, the lesson editor, and its preview.
export { AdminFrame } from "./components/admin-frame";
export { AdminStateGalleryServer } from "./components/admin-state-gallery-server";
export { adminMetadata } from "./components/admin-metadata";
export { CourseEditorPage } from "./components/course-editor-page";
export { DashboardPage } from "./components/dashboard-page";
export { LessonEditorPage } from "./components/lesson-editor-page";
export { LessonPreviewPage } from "./components/lesson-preview-page";
export { NewCoursePage } from "./components/new-course-page";
export { SetupPage } from "./components/setup-page";
export { VerifyPage } from "./components/verify-page";
export { requireAdminList } from "./server/gate";
