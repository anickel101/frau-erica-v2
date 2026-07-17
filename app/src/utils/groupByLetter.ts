export function groupByLetter<T>(
  items: T[],
  getLetter: (item: T) => string,
): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const letter = getLetter(item)
    const group = groups.get(letter)
    if (group) group.push(item)
    else groups.set(letter, [item])
  }
  return [...groups.entries()]
}
