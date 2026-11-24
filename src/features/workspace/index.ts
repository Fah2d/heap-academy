// The workspace (docs/spec/03-experience.md section 6). Other features use
// only what this file exports. Until WP-5.2 builds the lesson page, the
// runtime console serves only the development runtime page.
export { LessonContent } from "./components/lesson-content";
export { CodeEditor, type CodeEditorProps } from "./components/code-editor";
export { RuntimeConsole } from "./components/runtime-console";
