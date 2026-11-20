// The development-only runtime page (WP-3.1). It drives the Python worker for
// the browser tests and for a person checking the runtime by hand; learners
// never see it, and production builds leave it out.

export const runtimeDev = {
  title: "Python runtime",
  intro: "Runs Python in this browser's worker, as a lesson will. Development only.",
  program: "Program",
  input: "Input, one line per answer",
  run: "Run",
  stop: "Stop",
  output: "Output",
  sample: 'name = input()\nprint("Hello,", name)\n',
  status: {
    idle: "Not started",
    loading: "Starting Python",
    ready: "Ready",
    running: "Running",
    checking: "Checking",
    restarting: "Starting a new Python",
    failed: "Python could not start",
    disposed: "Closed",
  },
  outcome: {
    ok: "Finished",
    syntax: "Syntax error",
    runtime: "Error while running",
    input_ended: "The program asked for more input than was given",
    output_limit: "Output limit reached: the program printed more than 64,000 characters",
    memory: "Out of memory",
    time_limit: "Time limit reached: the program ran for 5 seconds",
    stopped: "Stopped",
    crashed: "Python stopped unexpectedly",
  },
  restarts: "New workers started",
  dropped: "Messages dropped",
  progress: (loaded: number, total: number) =>
    `${(loaded / 1_000_000).toFixed(1)} of ${(total / 1_000_000).toFixed(1)} MB`,
  line: (line: number) => `line ${String(line)}`,
  duration: (ms: number) => `${String(ms)} ms`,
} as const;
