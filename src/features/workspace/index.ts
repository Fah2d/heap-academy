// The workspace (docs/spec/03-experience.md section 6). Other features use
// only what this file exports. RuntimeConsole serves the development-only
// runtime page until WP-5.2 builds the lesson workspace.
export { RuntimeConsole } from "./components/runtime-console";
export { LessonContent } from "./components/lesson-content";
export { CodeEditor, type CodeEditorProps } from "./components/code-editor";
