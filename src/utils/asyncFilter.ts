export async function asyncFilter<T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => Promise<boolean>
) {
  return Promise.all(array.map(predicate)).then((results) =>
    array.filter((_v, index) => results[index])
  );
}
