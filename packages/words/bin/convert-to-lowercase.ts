import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Please provide the path to the JSON file.");
  process.exit(1);
}

const filePath = path.resolve(args[0]);
const data = fs.readFileSync(filePath, "utf8");
const words = JSON.parse(data);

const uniqueLowecasedWords = Array.from(
  new Set(words.map((animal) => animal.toLowerCase()))
);

fs.writeFileSync(filePath, JSON.stringify(uniqueLowecasedWords, null, 2));
