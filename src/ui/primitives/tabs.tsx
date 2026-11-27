"use client";

import type { Key, ReactNode } from "react";
import { Tab, TabList, TabPanel, Tabs as AriaTabs } from "react-aria-components";

export type TabItem = {
  id: string;
  title: string;
  content: ReactNode;
};

export type TabsProps = {
  /** Names the tab list for assistive technology. */
  label: string;
  items: ReadonlyArray<TabItem>;
  defaultSelectedKey?: string;
  /** The selected tab, when the screen decides it (the workspace's Run and Check). */
  selectedKey?: string;
  onSelectionChange?: (key: Key) => void;
  /** Fill the height of the box it is in; each panel scrolls on its own. */
  fill?: boolean;
  /**
   * `views`: the tabs share the width and stay at the top of the screen while
   * the page scrolls, and every panel stays mounted, hidden and inert while
   * another is selected, so a view keeps its state (the workspace below
   * 768 px, 03-experience.md section 6.8).
   */
  kind?: "panes" | "views";
};

const tab =
  "-mbe-(--hairline) inline-flex min-h-target items-center justify-center border-be-(length:--marker-width) border-transparent px-4 text-base text-text-muted transition-colors data-hovered:text-text data-selected:border-action data-selected:font-semibold data-selected:text-text";

/** Selected: text color, weight 600, and the 2 px amber bar on the block-end edge. */
export function Tabs({
  label,
  items,
  defaultSelectedKey,
  selectedKey,
  onSelectionChange,
  fill = false,
  kind = "panes",
}: TabsProps) {
  const views = kind === "views";
  return (
    <AriaTabs
      className={
        fill ? "flex min-h-0 flex-1 flex-col" : views ? "flex flex-1 flex-col" : "flex flex-col"
      }
      {...(defaultSelectedKey !== undefined && { defaultSelectedKey })}
      {...(selectedKey !== undefined && { selectedKey })}
      {...(onSelectionChange !== undefined && { onSelectionChange })}
    >
      <TabList
        aria-label={label}
        className={
          views
            ? "sticky inset-bs-0 z-10 flex border-be border-border bg-bg px-gutter"
            : "flex gap-1 border-be border-border"
        }
      >
        {items.map((item) => (
          <Tab key={item.id} id={item.id} className={views ? `${tab} flex-1` : tab}>
            {/* A hidden weight-600 copy holds the width, so selecting a tab
                does not move its neighbors. */}
            <span className="grid">
              <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-semibold">
                {item.title}
              </span>
              <span className="col-start-1 row-start-1">{item.title}</span>
            </span>
          </Tab>
        ))}
      </TabList>
      {items.map((item) => (
        <TabPanel
          key={item.id}
          id={item.id}
          shouldForceMount={views}
          className={
            views
              ? "flex flex-1 flex-col focus-visible:-outline-offset-2 data-inert:hidden"
              : fill
                ? "scroll-visible flex min-h-0 flex-1 flex-col overflow-auto pbs-3 focus-visible:-outline-offset-2"
                : "pbs-4"
          }
        >
          {item.content}
        </TabPanel>
      ))}
    </AriaTabs>
  );
}
