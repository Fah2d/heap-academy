"use client";

import { symbolRow as words } from "@/messages/workspace";
import { Button } from "@/ui";

export type SymbolInsert = (typeof words.keys)[number]["insert"];

/**
 * The row of symbols that are slow to reach on a phone's keyboard, above the
 * keyboard in the Code view (docs/spec/03-experience.md section 6.8;
 * FR-WSP-21). A press keeps focus in the editor, so the keyboard stays open,
 * and the symbol goes in at the cursor. A hardware keyboard types the same
 * symbols directly, which is the other way in that React Aria asks for when
 * a button does not take focus on press. The row scrolls sideways inside
 * itself at the narrowest widths; the page does not.
 */
export function SymbolRow({ onInsert }: { onInsert: (insert: SymbolInsert) => void }) {
  return (
    <div
      role="group"
      aria-label={words.label}
      data-symbol-row
      className="flex w-full gap-2 overflow-x-auto"
    >
      {words.keys.map((key) => (
        <Button
          key={key.name}
          variant="secondary"
          aria-label={key.name}
          preventFocusOnPress
          onPress={() => {
            onInsert(key.insert);
          }}
        >
          <span className="font-mono">{key.shown}</span>
        </Button>
      ))}
    </div>
  );
}
