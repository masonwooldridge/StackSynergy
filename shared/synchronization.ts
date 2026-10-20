/** Late responses cannot resurrect a left room or replace a newer revision. */
export function acceptRoom<T extends { code: string; revision: number }>(
  current: T | null,
  incoming: T,
): T | null {
  return current &&
    current.code === incoming.code &&
    incoming.revision >= current.revision
    ? incoming
    : current;
}
export function repeatedCameraFrame(
  previous: { signature: string; at: number } | null,
  signature: string,
  camera: boolean,
  now: number,
) {
  return (
    camera &&
    !!signature &&
    previous?.signature === signature &&
    now - previous.at < 12000
  );
}
