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
  "-mb-(--hairline) inline-flex min-h-target items-center border-b-(length:--marker-width) border-transparent px-4 text-base text-text-muted transition-colors data-hovered:text-text data-selected:border-action data-selected:font-semibold data-selected:text-text";

/** Selected: text color, weight 600, and the 2 px amber bar on the block-end edge. */
export function Tabs({ label, items, defaultSelectedKey, onSelectionChange }: TabsProps) {
  return (
    <AriaTabs
      className="flex flex-col"
      {...(defaultSelectedKey !== undefined && { defaultSelectedKey })}
      {...(onSelectionChange !== undefined && { onSelectionChange })}
    >
      <TabList aria-label={label} className="flex gap-1 border-b border-border">
        {items.map((item) => (
          <Tab key={item.id} id={item.id} className={tab}>
            {item.title}
          </Tab>
        ))}
      </TabList>
      {items.map((item) => (
        <TabPanel key={item.id} id={item.id} className="pt-4">
          {item.content}
        </TabPanel>
      ))}
    </AriaTabs>
  );
}
