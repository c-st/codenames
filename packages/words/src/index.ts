import { wordPacks } from "./word-packs";

export { default as adjectives } from "../resources/adjectives.json";
export { default as animals } from "../resources/animals.json";
export { default as animalEmojis } from "../resources/animal-emojis.json";
export * from "./random-words";
export * from "./word-packs";
export const {
  classic,
  movies,
  food,
  geography,
  science,
  tech,
  agile,
  design,
  startup,
  internet,
} = wordPacks;
