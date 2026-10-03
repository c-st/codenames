# Codenames web client

Next.js/React interface for the multiplayer game, with tutorial and practice modes.

## Development

Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter api dev
# In another terminal:
pnpm --filter web dev
```

Open `http://localhost:3000`. A room invitation uses `/?session=<room-name>`. Development connects to `ws://localhost:8787`; production connects to `wss://api.codenam.es`. Set `NEXT_PUBLIC_API_URL` to override the endpoint when starting or building the client.

| Command                       | Action                                                         |
| ----------------------------- | -------------------------------------------------------------- |
| `pnpm --filter web typecheck` | Check frontend and shared TypeScript types                     |
| `pnpm --filter web build`     | Create the production static export in `packages/web/dist/`    |
| `pnpm --filter web deploy`    | Publish that export to the configured Cloudflare Pages project |
| `pnpm --filter web test:e2e`  | Run Chromium multiplayer tests against local Wrangler and Next |

Geist fonts are bundled locally. Quicksand uses `next/font/google` and requires network access during a production build. The static export is intended for static hosting.

## Profiles and room identity

In the lobby, choose a name and an animal, then click **Save profile**. The server-confirmed profile is stored in this browser and reused when joining other rooms. The dice button generates a new name and keeps the animal.

Browser storage keys are:

| Key                                  | Contents                                     |
| ------------------------------------ | -------------------------------------------- |
| `codenames:profile`                  | Name and animal                              |
| `codenames:token:<room-name>`        | Private reconnect token for that room        |
| `codenames:muted`                    | Personal mute preference                     |
| `codenames:pack-draft:<room>:<pack>` | Unpublished pack draft and its base revision |
| `codenames:pack-editor:<room>`       | Last pack opened in the editor               |

Room tokens use localStorage. Values under the older `codenames:playerId:<room-name>` key were broadcast to other players, so they are never reused as tokens. Additional tabs in the same browser share a player identity. A different browser or cleared storage creates a separate identity. Browser storage is local to the site's origin; it is not an account or cross-device profile.

Connections recover automatically after unexpected disconnection, with heartbeat checks and retry backoff. The server keeps a disconnected player's team and role for 60 seconds. The client disables game actions while disconnected; unsent actions must be tried again after reconnection.

## Room word packs and team shuffle

Every room starts with ten editable word packs. **Classic** stays prominently available under its familiar name; its words can be edited. Choose another pack with **Other room word packs**. Everyone plays the selected room pack.

Expand **Edit room word packs**, choose **Pack to edit**, or use **Add word pack** to create a named list. Paste words separated by newlines or commas. The editor trims whitespace, removes duplicates ignoring capitalization, and requires 25–500 unique words of up to 50 characters each. Names must be unique in the room. Rooms retain up to 30 packs within a 96 KiB library budget.

**Save word pack** publishes the list to everyone and waits for server confirmation. It does not change the selected pack: choose it above when ready to play. Drafts and their base revisions are stored locally per room and pack. Clean editors follow room updates; unsaved edits stay untouched. When another player saves the same pack first, a stale save is rejected. **Load latest room version** replaces your draft, or review the latest words and explicitly **Keep my edits on latest version** before saving again. Pack changes are available only in the lobby.

**Shuffle teams & spymasters** starts a shared countdown, then balances teams and randomly selects one spymaster per team. Everyone sees the same countdown and reveal; repeated clicks do not restart it. Changing the number of teams also reshuffles assignments. Roles cannot change during an active round; players can swap roles after the game finishes.

## Session history and KPIs

The session history panel is available in the lobby and during play. Expand a round to see its public clues and guess outcomes. The current round updates as everyone plays; completed rounds show their result, while stopped rounds are marked separately.

The panel summarizes the up to 50 retained rounds with completed-round counts, guess accuracy, average completed-round duration and per-team win bars. Accuracy includes recorded guesses in active, completed and stopped rounds. Average duration includes completed rounds only, measured from start to result. Team labels describe the teams in each round, not a permanent player leaderboard; shuffling can change membership. Assassin losses are displayed as losses when no winner is reported.

Each round retains up to 200 public clue/guess events, with a 96 KiB total history budget that may remove older records. History survives reloads and is shared by all clients. The backend deletes the room, including history and its word-pack library, after two weeks without connected players. Rejoining before expiry cancels that deadline. Opening an expired link creates a fresh session with the same room name; saved browser profiles and unpublished word drafts remain local.

### Playful awards

The trophy shelf recognizes both spymasters and teams. Individual spymaster awards cover correct guesses guided by their clues, accuracy (at least three attributed guesses), the best correct-guess combo under one recorded clue, and assassin hits. Team awards recognize collective correct guesses and consecutive correct guesses. The person clicking a card receives no individual credit or blame.

Award titles and emojis are chosen from playful variants using the room's persisted `awardSeed`. Everyone joining the same link sees the same names, which stay fixed across rematches, reloads, reconnects and history pruning. Different rooms can have different names; expiry starts a fresh room. Nonzero achievements are required, ties share the award, and reduced-motion preferences are respected by trophy animations. Assassin awards include sample-size context; they are playful counts, not a permanent ranking of people.

Spymaster credit follows the identity recorded when a clue was given, even if roles change before the team guesses. Older guesses without recorded attribution contribute to team KPIs but are skipped for personal awards. Changing a display name does not create a second player in the award calculations.

## Sound troubleshooting

After joining a room, the game creates or resumes its audio context when an unmuted player clicks/taps the page or presses a key. The landing page and muted rooms keep audio inactive; muting or leaving the room closes the context. Browsers generally require this interaction before allowing sound. Someone who joins through an invitation and only watches should interact with the page once. Another player cannot enable audio for them. [MDN describes this browser policy](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

If sounds are missing:

1. Click/tap the game or press a key, especially after a reload or returning from a background tab.
2. Check that the game's speaker button is unmuted, the browser tab/site is not muted, and the device volume is audible.
3. Check the room's connection status. Past sounds are not replayed on reconnect or after unmuting.

The unmuted icon reflects the saved mute preference; it does not indicate whether browser audio is running. A dedicated “Enable sound” prompt remains a proposed improvement.

The server sends shared cue IDs and playback times. The client estimates the server clock from heartbeat replies and schedules Web Audio tones. Cues more than one second late are dropped; slightly late cues play immediately. Muted or audio-blocked clients skip cues. Exact synchronization across internet connections and devices is not guaranteed.

## Browser integration tests

Install Chromium once, then run the suite from the repository root:

```sh
pnpm --filter web exec playwright install chromium
pnpm test:integration
```

Playwright starts Wrangler on port 8787 and Next on port 3000 (set `E2E_API_PORT`/`E2E_WEB_PORT` to run beside another checkout). The suite starts fresh servers; stop development servers using those ports before testing. It runs browser tests one at a time for stable timing, with four independent clients inside the multiplayer test. Test Next uses `.next-e2e` so its output does not conflict with the production `dist` directory. The test API endpoint is fixed to the local server; leave `NEXT_PUBLIC_API_URL` unset for this suite. The test worker overrides `ROOM_IDLE_TTL_SECONDS` to 60 seconds for a real expiry check; production and ordinary local development retain the two-week setting.

The tests cover profile restoration, repeated reloads, multiple tabs sharing one identity, reconnect after a simulated socket failure while offline, and four independent players sharing named room packs, shuffled roles, a board, clues, reveals and persistent session history. The library checks cover concurrent stale edits, explicit conflict review, editable Classic words, named draft persistence, shared selection and pack reloads. Tests compare shared sound events and instrument Web Audio scheduling with a silent mock that records oscillator starts while preserving gesture activation and context suspension. This avoids host audio service stalls. Local audio assertions allow 200 ms of timing difference; this is a test tolerance, not a production latency guarantee. Mobile checks include 50-character words and horizontal overflow. History checks cover an active round, a stopped round restored after reload, and a completed rematch with shared KPIs. The expiry test waits just over one minute, so the full suite takes longer than the gameplay checks. `e2e/fun.spec.ts` covers card flips and landings, tap feedback, shared marks, reactions, banners, the assassin flash, win/lose celebrations, rematch, the spymaster thinking indicator, the timer heartbeat and buzzer, and reconnect-token privacy.

Failure traces are retained under `packages/web/test-results/`. To inspect one:

```sh
pnpm --filter web exec playwright show-trace test-results/<failed-test>/trace.zip
```
