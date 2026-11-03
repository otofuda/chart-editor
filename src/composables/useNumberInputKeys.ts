// Allow the browser to change number inputs without triggering VList navigation.
export function stopNumberInputArrowKeys(event: KeyboardEvent): void {
  if (
    (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
    event.target instanceof HTMLInputElement &&
    event.target.type === 'number'
  ) {
    event.stopPropagation()
  }
}
