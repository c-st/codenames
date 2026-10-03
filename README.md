# Codenames

> Codenames is a word association game for two teams, each led by a spymaster. The spymasters give one-word clues and a number, guiding their teammates to guess specific words from a shared grid. Teams aim to identify their own words while avoiding the opponent’s, neutral words, and the deadly assassin word, which ends the game immediately if guessed. The first team to identify all their words wins.

## Development and verification

Install dependencies with `pnpm install --frozen-lockfile`. Run `pnpm --filter api dev` and `pnpm --filter web dev` in separate terminals. The web client uses `ws://localhost:8787` in development; `NEXT_PUBLIC_API_URL` overrides it.

- `pnpm test`: word-pack, game-rule, schema and server protocol tests.
- `pnpm --filter web typecheck`: frontend and shared type checks.
- `pnpm --filter web build`: production static export. The existing Google Font requires network access during the build.
- `pnpm --filter web exec playwright install chromium`: one-time browser setup.
- `pnpm test:integration`: server integration tests followed by real Chromium multiplayer tests. Playwright starts local Wrangler and Next automatically on ports 8787 and 3000; browser traces are retained on failure. It uses a separate `.next-e2e` build directory and unique rooms.

Server integration tests exercise the actual server, schema, storage flow and game engine with a mocked Cloudflare platform. Browser tests exercise the actual local Wrangler runtime and four independent browser clients, including profile persistence, repeated reloads without duplicates, offline recovery, custom lists, shuffled roles, guesses, and coordinated audio scheduling. These tests verify local behavior; production network latency and outages still need monitoring.

## Room behavior

Names and animal avatars are remembered in this browser across visits and rooms. Room identity is also remembered, so reloads, additional tabs and reopening the same room retain one player. Clearing browser storage creates a new identity; when storage is unavailable, persistence cannot be guaranteed. Disconnected players keep their team and role for 60 seconds. Returning after removal rejoins the room with the saved profile but may receive a different team or role. Room settings and disconnect deadlines survive server hibernation.

The lobby supports shared custom packs of 25–500 unique words and browser-saved drafts. Shuffle teams & spymasters produces balanced random teams with one spymaster each. Classic two-team boards use a random starting team with nine words, eight for the other team, seven neutral cards and one assassin. Three- and four-team games use adapted card counts on the same 25-card board.

### Sound and browser interaction

Browsers generally prevent a newly opened page from playing audio until the player interacts with it. The game enables or resumes audio on a click/tap (`pointerdown`) or keyboard press (`keydown`); clicking Play or editing the profile normally does this automatically. A player who opens an invitation link and only watches should click/tap the page or press a key. Another player's interaction cannot enable sound on their device. See [MDN's Web Audio guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

The speaker button controls mute, which is remembered per browser. An unmuted speaker icon does not guarantee that audio has been enabled by a gesture. There is currently no separate “Enable sound” prompt. After a reload, another interaction may be needed; if returning from a background tab leaves audio suspended, interact with the page again.

Shared server events specify the sound, a unique event ID and a playback time. Clients estimate the server clock through heartbeats and schedule the same cue. Muted or audio-blocked clients skip cues without queuing them for later. Reconnect snapshots do not replay past sounds. Cues arriving more than one second after their playback time are discarded; slightly late cues play immediately. Network latency and device behavior mean exact sample-level synchronization is not guaranteed.

## Recommended next improvements

1. **Host controls and ready checks:** give one host control over shared settings/reset, let every player confirm readiness, and explain what is missing before start. Use private reconnect credentials separate from public player IDs before exposing rooms to untrusted players.
2. **Optional reveal confirmation or team votes:** reduce accidental mobile guesses and let teammates signal tentative choices before committing a card.
3. **Flexible timers and pause:** offer classic untimed play, configurable deadlines and host pause for breaks or connection trouble.
4. **Better rematches:** rotate spymasters, keep or reshuffle teams, and exclude recently used words for fresher rounds.
5. **Word-library tools:** clone built-in packs into the editor, import/export reusable packs, and offer language/difficulty tags.
6. **Audio activation feedback:** show an “Enable sound” prompt until audio is running, so players joining by invitation know when an interaction is needed.
7. **Round history and connection visibility:** show clues and guess outcomes, connected/reconnecting player badges, and production reconnect/error metrics.

## Package documentation

- [Web client](packages/web/README.md): profile storage, word editor, sound troubleshooting and browser tests.
- [Backend](packages/api/README.md): connection protocol, commands, persistence and server integration tests.
