export function trappedFocusIndex(currentIndex: number, count: number, backwards: boolean) {
  if (count <= 0) return -1;
  if (backwards && currentIndex <= 0) return count - 1;
  if (!backwards && currentIndex >= count - 1) return 0;
  return backwards ? currentIndex - 1 : currentIndex + 1;
}
