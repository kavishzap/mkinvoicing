/** Clear Radix scroll-lock / pointer-events left on document after dialogs close. */
export function releaseDialogBodyLock(): void {
  if (typeof document === "undefined") return;

  const { body, documentElement: html } = document;

  body.style.pointerEvents = "";
  body.style.overflow = "";
  body.style.paddingRight = "";
  body.style.marginRight = "";
  html.style.pointerEvents = "";
  html.style.overflow = "";
  html.style.paddingRight = "";
  html.removeAttribute("data-scroll-locked");
  body.removeAttribute("data-scroll-locked");

  document
    .querySelectorAll<HTMLElement>(
      '[data-slot="alert-dialog-overlay"][data-state="closed"], [data-slot="dialog-overlay"][data-state="closed"]',
    )
    .forEach((el) => {
      el.style.pointerEvents = "none";
    });
}

/** Run cleanup now and again after exit animations finish. */
export function queueReleaseDialogBodyLock(): void {
  releaseDialogBodyLock();
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(releaseDialogBodyLock);
  window.setTimeout(releaseDialogBodyLock, 0);
  window.setTimeout(releaseDialogBodyLock, 200);
}
