import { runActionProgress } from "@/lib/action-progress-bridge";
import { queueReleaseDialogBodyLock } from "@/lib/release-dialog-body-lock";

/** Close a confirm dialog, release UI locks, then run delete with the global progress overlay. */
export async function runConfirmDeleteAction<T>(
  message: string,
  closeDialog: () => void,
  fn: () => Promise<T>,
): Promise<T> {
  closeDialog();
  queueReleaseDialogBodyLock();
  return runActionProgress(message, async () => {
    try {
      return await fn();
    } finally {
      queueReleaseDialogBodyLock();
    }
  });
}
