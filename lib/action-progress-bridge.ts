type ActionRunner = <T>(message: string, fn: () => Promise<T>) => Promise<T>;

let runner: ActionRunner | null = null;

export function registerActionProgressRunner(next: ActionRunner | null) {
  runner = next;
}

/** Run an async action with the global progress dialog when the provider is mounted. */
export async function runActionProgress<T>(
  message: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (runner) return runner(message, fn);
  return fn();
}
