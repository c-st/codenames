# Codenames

> Codenames is a word association game for two teams, each led by a spymaster. The spymasters give one-word clues and a number, guiding their teammates to guess specific words from a shared grid. Teams aim to identify their own words while avoiding the opponent’s, neutral words, and the deadly assassin word, which ends the game immediately if guessed. The first team to identify all their words wins.

## Development and verification

Install dependencies with `pnpm install --frozen-lockfile`. Run `pnpm --filter api dev` and `pnpm --filter web dev` in separate terminals. The web client uses `ws://localhost:8787` in development; `NEXT_PUBLIC_API_URL` overrides it.

- `pnpm test`: word-pack, game-rule, schema and server protocol tests.
- `pnpm typecheck`: API, frontend and shared type checks.
- `pnpm --filter web build`: production static export. The existing Google Font requires network access during the build.
- `pnpm --filter web exec playwright install chromium`: one-time browser setup.
- `pnpm test:integration`: server integration tests followed by real Chromium multiplayer tests. Playwright starts local Wrangler and Next automatically on ports 8787 and 3000 (override with `E2E_API_PORT` and `E2E_WEB_PORT` to run beside another checkout); browser traces are retained on failure. It uses a separate `.next-e2e` build directory and unique rooms. Its expiry check uses a test-only 60-second retention override and waits just over one minute.

Server integration tests exercise the actual server, schema, storage flow and game engine with a mocked Cloudflare platform. Browser tests exercise the actual local Wrangler runtime and four independent browser clients, including profile persistence, repeated reloads without duplicates, offline recovery, custom lists, shuffled roles, guesses, coordinated audio scheduling, and every fun cue (card flips, marks, reactions, banners, celebrations, recap, rematch, thinking indicator, timer heartbeat) plus reconnect-token privacy. These tests verify local behavior; production network latency and outages still need monitoring.

## Room behavior

Names and animal avatars are remembered in this browser across visits and rooms. Room identity is also remembered, so reloads, additional tabs and reopening the same room retain one player. The browser keeps a private reconnect token; other players only ever see a one-way hash of it as the public player id. Clearing browser storage creates a new identity; when storage is unavailable, persistence cannot be guaranteed. Disconnected players keep their team and role for 60 seconds. Returning after removal rejoins the room with the saved profile but may receive a different team or role. Room settings and disconnect deadlines survive server hibernation. Once the last connected player leaves, the room is retained for two weeks; then all backend room data is deleted automatically. A rejoin cancels expiry, and leaving again starts a fresh two-week window. Connected rooms do not expire. Opening an expired invitation creates a fresh room with the same name; browser-saved profiles remain available.

The lobby supports shared custom packs of 25–500 unique words and browser-saved drafts. Shuffle teams & spymasters produces balanced random teams with one spymaster each. Classic two-team boards use a random starting team with nine words, eight for the other team, seven neutral cards and one assassin. Three- and four-team games use adapted card counts on the same 25-card board.

### Session history and statistics

The session history panel shows the up to 50 recent rounds, including the current round, with expandable clue and guess timelines. It records completed results and distinguishes rounds stopped before a result. Team win bars, guess accuracy and average completed-round duration summarize the retained history. Accuracy is correct guesses divided by recorded guesses, including active and stopped rounds; average duration includes completed rounds only. Assassin losses are labeled as losses, without inventing a winner when the game reports none.

A playful trophy shelf celebrates spymasters and whole teams, with room-specific emoji titles for correct guesses, clue accuracy, combos, assassin hits and team streaks. Guesses are credited collectively to the team; personal awards apply only to the spymaster who gave the clue. Award titles stay the same throughout the room’s lifetime, including rejoins, rematches and history pruning. Different rooms can use different names, meaningful ties share trophies, and animations respect reduced-motion settings.

History is shared with everyone in the room and survives reloads and server hibernation. Each round retains up to 200 public clue/guess events, with a 96 KiB total history budget that may remove older records, so room data stays bounded. No unrevealed card identities are recorded. History is cleared when the room expires; it is not a permanent cross-room leaderboard.

### Sound and browser interaction

Browsers generally prevent a newly opened page from playing audio until the player interacts with it. The game enables or resumes audio on a click/tap (`pointerdown`) or keyboard press (`keydown`); clicking Play or editing the profile normally does this automatically. A player who opens an invitation link and only watches should click/tap the page or press a key. Another player's interaction cannot enable sound on their device. See [MDN's Web Audio guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

The speaker button controls mute, which is remembered per browser. An unmuted speaker icon does not guarantee that audio has been enabled by a gesture. There is currently no separate “Enable sound” prompt. After a reload, another interaction may be needed; if returning from a background tab leaves audio suspended, interact with the page again.

Shared server events specify the sound, a unique event ID and a playback time. Clients estimate the server clock through heartbeats and schedule the same cue. Muted or audio-blocked clients skip cues without queuing them for later. Reconnect snapshots do not replay past sounds. Cues arriving more than one second after their playback time are discarded; slightly late cues play immediately. Network latency and device behavior mean exact sample-level synchronization is not guaranteed.

## Playfulness

Reveals flip the card and land with team-coloured sparkles, a wobble for wrong guesses, or a blow-up, red flash and screen shake for the assassin. Cards are dealt in at the start of each game; ribbons announce who starts, whose turn it is and perfect clues, timed from the same shared cues as the sounds. Operatives can mark cards as maybes (📍 or right-click) so teammates see each other's picks, everyone can send floating emoji reactions, and the room sees when the spymaster is drafting a clue. The timer ring gets urgent, beats like a heart for the last ten seconds and buzzes at zero. Winners get team-coloured confetti, losers a small rain cloud, followed by a recap of every clue with silly awards and a one-tap rematch. Reduced-motion preferences turn off the movement.

## Recommended next improvements

1. **Host controls and ready checks:** give one host control over shared settings/reset, let every player confirm readiness, and explain what is missing before start.
2. **Optional reveal confirmation:** reduce accidental mobile guesses, e.g. require a mark before a reveal.
3. **Flexible timers and pause:** offer classic untimed play, configurable deadlines and host pause for breaks or connection trouble.
4. **Better rematches:** rotate spymasters, keep or reshuffle teams, and exclude recently used words for fresher rounds.
5. **Word-library tools:** clone built-in packs into the editor, import/export reusable packs, and offer language/difficulty tags.
6. **Audio activation feedback:** show an “Enable sound” prompt until audio is running, so players joining by invitation know when an interaction is needed.
7. **Connection visibility:** show connected/reconnecting player badges and production reconnect/error metrics.

## Package documentation

- [Web client](packages/web/README.md): profile storage, word editor, sound troubleshooting and browser tests.
- [Backend](packages/api/README.md): connection protocol, commands, persistence and server integration tests.
