"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TestCase } from "@/grader/test-case";
import { runtimeAssetBase } from "@/runtime/assets";
import { createPythonWorker } from "@/runtime/browser";
import {
  createRuntimeController,
  type InputRequest,
  type RunRequest,
  type RuntimeController,
} from "@/runtime/controller";
import {
  INITIAL_STATE,
  transition,
  type WorkspaceEvent,
  type WorkspaceState,
} from "@/runtime/workspace-chart";
import { chartEventFor, performEffects } from "@/runtime/workspace-driver";
import {
  addRefusal,
  addReport,
  INITIAL_VIEW,
  reduceView,
  type RuntimeView,
  startCheck,
  startRun,
} from "./runtime-view";

/** What Run and Check send: read when the effect runs, so it is the code on screen then. */
export type Program = { source: string; stdin: string[] | undefined; tests: readonly TestCase[] };

const NOT_READY: RunRequest = { ok: false, error: "not_ready" };

/**
 * Starts the Python runtime when the page opens and ends it when the page
 * closes. The workspace statechart decides what each control does; this hook
 * carries out its effects on the controller (architecture section 6).
 */
export function useRuntime(program: (interactiveInput: boolean) => Program): {
  view: RuntimeView;
  chart: WorkspaceState;
  dispatch: (event: WorkspaceEvent) => void;
  sendInput: (line: string) => InputRequest;
  endInput: () => void;
} {
  const [view, setView] = useState<RuntimeView>(INITIAL_VIEW);
  const [chart, setChart] = useState<WorkspaceState>(INITIAL_STATE);
  const chartRef = useRef<WorkspaceState>(INITIAL_STATE);
  const controller = useRef<RuntimeController | undefined>(undefined);
  const programRef = useRef(program);

  useEffect(() => {
    programRef.current = program;
  }, [program]);

  const dispatch = useCallback((event: WorkspaceEvent) => {
    const next = transition(chartRef.current, event);
    chartRef.current = next.state;
    setChart(next.state);
    const refused = performEffects(next.effects, event, {
      start: () => controller.current?.start(),
      stop: () => controller.current?.stop(),
      run: () => {
        const current = controller.current;
        if (current === undefined) return NOT_READY;
        const { source, stdin } = programRef.current(current.interactiveInput);
        const request = current.run(source, stdin);
        if (request.ok) setView((previous) => startRun(previous, current.status));
        return request;
      },
      check: () => {
        const current = controller.current;
        if (current === undefined) return NOT_READY;
        const { source, tests } = programRef.current(current.interactiveInput);
        const request = current.check(source, tests);
        if (request.ok) setView((previous) => startCheck(previous, current.status));
        return request;
      },
      // The development page has no lesson to record; the chart shows `passed`.
      complete: () => undefined,
    });
    if (refused.length > 0) setView((previous) => addRefusal(previous, refused.length));
  }, []);

  useEffect(() => {
    const created = createRuntimeController({
      createWorker: createPythonWorker,
      assetBase: runtimeAssetBase,
      timers: {
        setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
        clearTimeout: (handle) => {
          if (typeof handle === "number") window.clearTimeout(handle);
        },
      },
      now: () => performance.now(),
      onEvent: (event) => {
        // Read the status now: React may run the updater later.
        const status = created.status;
        setView((current) => reduceView(current, event, status));
        const chartEvent = chartEventFor(event, chartRef.current);
        if (chartEvent !== undefined) dispatch(chartEvent);
      },
      report: (report) => {
        setView((current) => addReport(current, report));
      },
    });
    controller.current = created;
    dispatch({ type: "LESSON_OPENED" });
    return () => {
      created.dispose();
      controller.current = undefined;
      chartRef.current = INITIAL_STATE;
    };
  }, [dispatch]);

  const sendInput = useCallback(
    (line: string): InputRequest =>
      controller.current?.sendInput(line) ?? { ok: false, error: "not_waiting" },
    [],
  );

  const endInput = useCallback(() => {
    controller.current?.endInput();
  }, []);

  return { view, chart, dispatch, sendInput, endInput };
}
