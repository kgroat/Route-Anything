export const uniqueElementsBy = <T>(arr: T[], fn: (a: T, b: T) => boolean) =>
  arr.reduce((acc, v) => {
    if (!acc.some((x) => fn(v, x))) acc.push(v)
    return acc
  }, [] as T[])
