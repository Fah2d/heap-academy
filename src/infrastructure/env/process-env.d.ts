// The build-time variables that next.config.ts inlines into server code. They
// are read as `process.env.NAME`, the form the compiler replaces.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly HEAP_RELEASE?: string;
  }
}
