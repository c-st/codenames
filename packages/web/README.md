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

| Key                                | Contents                      |
| ---------------------------------- | ----------------------------- |
| `codenames:profile`                | Name and animal               |
| `codenames:token:<room-name>`      | Private reconnect token for that room |
| `codenames:muted`                  | Personal mute preference      |
| `codenames:word-draft:<room-name>` | Unpublished custom-word draft |

Room tokens use localStorage. Values under the older `codenames:playerId:<room-name>` key were broadcast to other players, so they are never reused as tokens. Additional tabs in the same browser share a player identity. A different browser or cleared storage creates a separate identity. Browser storage is local to the site's origin; it is not an account or cross-device profile.

Connections recover automatically after unexpected disconnection, with heartbeat checks and retry backoff. The server keeps a disconnected player's team and role for 60 seconds. The client disables game actions while disconnected; unsent actions must be tried again after reconnection.

## Custom words and team shuffle

Expand **Create or edit a custom word pack** in the lobby. Paste words separated by newlines or commas. The editor trims whitespace, removes duplicates ignoring capitalization, and requires 25–500 unique words of up to 50 characters each.

Drafts are saved locally for the room. **Save & use custom pack** publishes the validated list to everyone and selects it for the next game. Editing a draft does not change the shared list until saved. **Load room’s saved list** replaces the current draft with the shared version. Packs can only change in the lobby.

**Shuffle teams & spymasters** balances teams and randomly selects one spymaster per team. Changing the number of teams also reshuffles assignments. Roles cannot change during an active round; players can swap roles after the game finishes.

## Sound troubleshooting

The game automatically creates or resumes its audio context when a player clicks/taps the page or presses a key. Browsers generally require this interaction before allowing sound. Someone who joins through an invitation and only watches should interact with the page once. Another player cannot enable audio for them. [MDN describes this browser policy](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

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

Playwright starts Wrangler on port 8787 and Next on port 3000 (set `E2E_API_PORT`/`E2E_WEB_PORT` to run beside another checkout). Outside CI it may reuse servers already running on those ports; stop unrelated or stale servers before testing. Test Next uses `.next-e2e` so its output does not conflict with the production `dist` directory. The test API endpoint is fixed to the local server; leave `NEXT_PUBLIC_API_URL` unset for this suite.

The tests cover profile restoration, repeated reloads, multiple tabs sharing one identity, reconnect after a simulated socket failure while offline, and four independent players sharing custom words, shuffled roles, a board, clues and reveals. They compare shared sound events and record Web Audio scheduling through a silent fake `AudioContext`, so a misbehaving host audio service cannot stall the suite. Local audio assertions allow 200 ms of timing difference; this is a test tolerance, not a production latency guarantee. Mobile checks include 50-character words and horizontal overflow. `e2e/fun.spec.ts` covers card flips and landings, tap feedback, shared marks, reactions, banners, the assassin flash, win/lose celebrations, recap awards, rematch, the spymaster thinking indicator, the timer heartbeat and buzzer, and reconnect-token privacy.

Failure traces are retained under `packages/web/test-results/`. To inspect one:

```sh
pnpm --filter web exec playwright show-trace test-results/<failed-test>/trace.zip
```
