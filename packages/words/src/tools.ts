export const findDuplicates = (arr: string[]) => {
  const duplicates = arr.filter((item, index) => arr.indexOf(item) !== index);
  return [...new Set(duplicates)];
};

export const makeUnique = (arr: string[]) =>
  Array.from(new Set(arr.map((animal) => animal.toLowerCase())));
