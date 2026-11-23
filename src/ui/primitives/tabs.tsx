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
  onSelectionChange?: (key: Key) => void;
};

const tab =
  "-mbe-(--hairline) inline-flex min-h-target items-center border-be-(length:--marker-width) border-transparent px-4 text-base text-text-muted transition-colors data-hovered:text-text data-selected:border-action data-selected:font-semibold data-selected:text-text";

/** Selected: text color, weight 600, and the 2 px amber bar on the block-end edge. */
export function Tabs({ label, items, defaultSelectedKey, onSelectionChange }: TabsProps) {
  return (
    <AriaTabs
      className="flex flex-col"
      {...(defaultSelectedKey !== undefined && { defaultSelectedKey })}
      {...(onSelectionChange !== undefined && { onSelectionChange })}
    >
      <TabList aria-label={label} className="flex gap-1 border-be border-border">
        {items.map((item) => (
          <Tab key={item.id} id={item.id} className={tab}>
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
        <TabPanel key={item.id} id={item.id} className="pbs-4">
          {item.content}
        </TabPanel>
      ))}
    </AriaTabs>
  );
}
