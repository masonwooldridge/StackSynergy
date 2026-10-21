/** Serialize cooperating tabs on secure contexts; unsupported environments retain optimistic stale checks. */
export async function withChoiceLock<T>(
  key: string,
  task: () => T | Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      return await navigator.locks.request(
        "stacksynergy:" + key,
        { signal: controller.signal },
        task,
      );
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error(
          "Remembered choices are busy in another tab. Close or finish that tab, then retry your choice; it has not been saved.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  return task();
}
