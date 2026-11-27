// The build-time variables that next.config.ts inlines: HEAP_RELEASE into
// server code, NEXT_PUBLIC_HEAP_RELEASE into server and browser code. They
// are read as `process.env.NAME`, the form the compiler replaces.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly HEAP_RELEASE?: string;
    readonly NEXT_PUBLIC_HEAP_RELEASE?: string;
  }
}
