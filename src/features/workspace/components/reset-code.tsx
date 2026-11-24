"use client";

import { workspace as words } from "@/messages/workspace";
import { Button, Dialog, DialogActions } from "@/ui";
import { Reset } from "@/ui/icons";

/**
 * Reset to the starter code, after a confirmation (FR-WSP-10). The workspace
 * then offers Undo, which brings back the code from before the reset.
 */
export function ResetCode({ disabled, onReset }: { disabled: boolean; onReset: () => void }) {
  return (
    <Dialog
      title={words.resetTitle}
      trigger={
        <Button variant="secondary" icon={<Reset size={16} />} isDisabled={disabled}>
          {words.reset}
        </Button>
      }
    >
      {(close) => (
        <>
          <p className="text-base text-text">{words.resetBody}</p>
          <DialogActions>
            <Button variant="secondary" surface="raised" onPress={close}>
              {words.cancel}
            </Button>
            <Button
              variant="destructive"
              surface="raised"
              onPress={() => {
                onReset();
                close();
              }}
            >
              {words.resetConfirm}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
