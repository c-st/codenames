import classic from "../resources/classic.json";
import movies from "../resources/movies.json";
import food from "../resources/food.json";
import geography from "../resources/geography.json";
import science from "../resources/science.json";
import tech from "../resources/tech.json";
import agile from "../resources/agile.json";
import design from "../resources/design.json";
import startup from "../resources/startup.json";
import internet from "../resources/internet.json";

export const builtInWordPackIds = [
  "classic",
  "movies",
  "food",
  "geography",
  "science",
  "tech",
  "agile",
  "design",
  "startup",
  "internet",
] as const;
export type BuiltInWordPackId = (typeof builtInWordPackIds)[number];

export const wordPacks: Record<BuiltInWordPackId, string[]> = {
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
};
