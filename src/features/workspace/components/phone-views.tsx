"use client";

import { useRef } from "react";
import { workspace as words } from "@/messages/workspace";
import { PHONE_VIEWS, type PhoneView, viewAfterKey } from "../client/phone-layout";

const LABEL: Record<PhoneView, string> = {
  lesson: words.viewLesson,
  code: words.viewCode,
  output: words.viewOutput,
};

/** The ids of a view's tab and of the region it shows. */
export const phoneViewIds = (base: string, view: PhoneView) => ({
  tab: `${base}-tab-${view}`,
  panel: `${base}-panel-${view}`,
});

const tab =
  "-mbe-(--hairline) inline-flex min-h-target flex-1 items-center justify-center border-be-(length:--marker-width) border-transparent px-4 text-base text-text-muted transition-colors hover:text-text aria-selected:border-action aria-selected:font-semibold aria-selected:text-text";

/**
 * The tab list of the three views below 768 px (docs/spec/03-experience.md
 * section 6.8; FR-WSP-13), after the WAI-ARIA tabs pattern: one tab in the tab
 * order, the arrows, Home and End move between tabs and show each view at
 * once. It stays at the top of the screen while the view scrolls. The
 * workspace's regions are the tab panels; at 768 px and wider this list is
 * not rendered.
 */
export function PhoneViews({
  base,
  selected,
  onSelect,
}: {
  base: string;
  selected: PhoneView;
  onSelect: (view: PhoneView) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={list}
      role="tablist"
      aria-label={words.views}
      className="sticky inset-bs-0 z-10 flex border-be border-border bg-bg px-gutter"
      onKeyDown={(event) => {
        const direction = list.current && getComputedStyle(list.current).direction;
        const next = viewAfterKey(selected, event.key, direction === "rtl" ? "rtl" : "ltr");
        if (next === undefined) return;
        event.preventDefault();
        onSelect(next);
        document.getElementById(phoneViewIds(base, next).tab)?.focus();
      }}
    >
      {PHONE_VIEWS.map((view) => {
        const ids = phoneViewIds(base, view);
        const current = view === selected;
        return (
          <button
            key={view}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={current}
            aria-controls={ids.panel}
            tabIndex={current ? 0 : -1}
            className={tab}
            onClick={() => {
              onSelect(view);
            }}
          >
            {/* A hidden weight-600 copy holds the width, so selecting a tab
                does not move its neighbors. */}
            <span className="grid">
              <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-semibold">
                {LABEL[view]}
              </span>
              <span className="col-start-1 row-start-1">{LABEL[view]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
