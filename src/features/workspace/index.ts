// The workspace (docs/spec/03-experience.md section 6). Other features use
// only what this file exports.
export { LessonContent } from "./components/lesson-content";
export { CodeEditor, type CodeEditorProps } from "./components/code-editor";
export { RuntimeConsole } from "./components/runtime-console";
// Client-safe only: the admin's client components import this file.
export { Workspace, type WorkspaceLesson } from "./components/workspace";
export { learnPath } from "./paths";
