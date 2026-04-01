const titles = [
  "Spymaster",
  "Spymistress",
  "Spy Chief",
  "Spy Boss",
  "Secret Agent",
  "Mastermind",
  "Intel Officer",
];

let cachedTitle: string | null = null;

export function getSpymasterTitle(): string {
  if (!cachedTitle) {
    cachedTitle = titles[Math.floor(Math.random() * titles.length)];
  }
  return cachedTitle;
}
