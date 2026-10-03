# Codenames backend

Cloudflare Worker with one Durable Object per room. It stores authoritative game state and broadcasts player-specific snapshots over WebSockets.

## Development and verification

Run commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter api dev
pnpm --filter api test
```

The local API runs on port 8787. `GET /health` returns `200 OK` for readiness checks. `GET /` redirects to a generated room name; a room request without a WebSocket upgrade returns `426`.

`pnpm --filter api deploy` deploys the worker using `wrangler.toml`. `pnpm test:integration` runs server protocol tests followed by real-browser tests against local Wrangler and Next. See the [web test guide](../web/README.md#browser-integration-tests).

## Connection protocol

Connect to `ws://localhost:8787/<room-name>` locally or `wss://api.codenam.es/<room-name>` in production. Optional query parameters are:

| Parameter  | Behavior                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------- |
| `token`    | Private reconnect token; 21–64 letters, digits, underscores or hyphens. The public player ID is its SHA-256 hash, so the token itself is never broadcast. The pre-token `playerId` parameter is ignored because those values were public |
| `name`     | Initial name for a new player; trimmed and limited to 50 characters                       |
| `animal`   | Initial animal for a new player; one of the emojis in `animalSchema`                      |

An existing player retains their server-stored profile, team and role on reconnect. Multiple sockets using the same token share one roster entry. If the identity has already been removed, reconnecting joins again. Requests without a valid token receive a generated identity.

Player IDs are currently public in room snapshots and serve as reconnect identifiers. They are not private authentication credentials. Private reconnect credentials and host permissions remain planned improvements.

Commands and events are JSON text frames. Their authoritative schemas are [message.ts](../schema/src/message.ts) and [game.ts](../schema/src/game.ts).

## Commands

| Type                 | Fields           | Behavior                                                                |
| -------------------- | ---------------- | ----------------------------------------------------------------------- |
| `ping`               | None             | Reply with `pong` and server time                                       |
| `setProfile`         | `name`, `animal` | Set a trimmed 1–50 character name and supported animal                  |
| `setName`            | `name`           | Legacy name-only command, 1–50 characters                               |
| `randomizeName`      | None             | Generate a new name, retaining the animal                               |
| `setWordPack`        | `wordPack`       | Select a built-in or saved custom pack in the lobby                     |
| `setCustomWords`     | `words`          | Validate, share and select a custom pack in the lobby                   |
| `setTeamCount`       | `teamCount`      | Set 2–4 teams and reshuffle assignments in the lobby                    |
| `shuffleTeams`       | None             | Create balanced random teams with one spymaster each, in the lobby      |
| `promoteToSpymaster` | `playerId`       | Swap spymaster roles before or after a game; blocked during active play |
| `startGame`          | None required    | Start a ready game or a rematch after completion                        |
| `giveHint`           | `hint`, `count`  | Current team's spymaster gives one clue per turn; count 0–25            |
| `revealWord`         | `word`           | Current team's operative reveals an unrevealed card after a clue        |
| `endTurn`            | None             | Current team advances to the next turn                                  |
| `endGame`            | None             | Clear the board and return to the lobby                                 |

Built-in pack IDs are `classic`, `movies`, `food`, `geography`, `science`, `tech`, `agile`, `design`, `startup`, and `internet`. `custom` requires a saved list. Custom lists contain 25–500 unique, trimmed words, each 1–50 characters; duplicates are rejected ignoring capitalization. The browser editor removes duplicates before submitting.

The schema accepts optional `wordPack` and `teamCount` fields on `startGame`, but the handler uses the room's saved settings. Send the settings commands before starting.

## Server responses

- `gameStateUpdated`: contains `gameState`, including players, board, turn, clue history, the receiving client's `playerId`, readiness, remaining card counts, result, selected pack/team count, custom words, server time, shared sound effects and `sessionHistory`.
- `commandRejected`: contains a `reason` when a schema-valid command violates game rules. Malformed JSON or schema-invalid commands are currently logged and ignored without a rejection frame.
- `pong`: contains `serverTime` as Unix epoch milliseconds. Heartbeats are handled outside the game-event schema.

Unrevealed card teams and assassin identities are omitted from operative snapshots. Spymasters and clients viewing a finished game receive the full board. Optional values are omitted when serialized to JSON; turn deadlines are ISO date strings on the wire.

Each shared sound effect has an `id`, `type` and `playAt` in Unix epoch milliseconds. Types are `correctGuess`, `wrongGuess`, `assassinReveal`, `gameWin` and `turnChange`. Reveal outcomes use the team that made the guess, even when the reveal advances the turn. Cues are scheduled 300 ms ahead; a winning reveal's victory cue follows 450 ms later. Effects are transient and are not replayed in reconnect snapshots. Clients still need a local user interaction to enable browser audio.

## Persistence, reconnects and game rules

Stored room keys are `gameState`, `roomSettings`, `disconnected`, `roomExpiresAt` and `sessionHistory`. Settings include the word pack, team count and custom list. Disconnect deadlines are persisted and handled by a durable alarm alongside turn deadlines. A disconnect removes a player only after the last live socket is gone and the 60-second grace expires. Returning during that grace preserves the assigned team and role. When everyone is removed, the active game ends; settings and history remain stored until room expiry.

### Automatic room expiry

The last live socket closing starts a two-week idle retention window. A successful rejoin cancels it; the next time the room becomes empty, a new window starts. Rooms with connected players are never expired. Disconnect-grace cleanup and turn alarms do not extend idle retention.

`ROOM_IDLE_TTL_SECONDS` configures retention, with `1209600` (14 days) set for production and local development in `wrangler.toml`. Values must be whole seconds, at least 60, and within the supported date range; invalid or missing values use the two-week default. The minimum preserves the reconnect grace period.

The expiration timestamp is persisted, and the existing durable alarm schedules the earliest turn, disconnect or expiry deadline. At expiry, the backend clears all storage and the alarm, then resets in-memory room settings and history. It also checks expiry before accepting a join, so delayed alarms cannot restore old data. Alarm retries do not recreate deleted room storage. Visiting the same room name afterward creates a fresh session.

Existing stored rooms without expiry metadata adopt the policy when their Durable Object next wakes. Rooms that are already dormant without a scheduled alarm are not awakened merely by deploying this code; a one-time namespace sweep would be needed to enroll those rooms without waiting for access. [Cloudflare's namespace object-list API](https://developers.cloudflare.com/api/resources/durable_objects/subresources/namespaces/subresources/objects/) can enumerate their IDs for such a maintenance job.

### Session history

`sessionHistory.rounds` holds up to 50 rounds, ordered oldest to newest. Each round includes an ID, start/end timestamps in epoch milliseconds, status (`active`, `completed`, or `aborted`), word pack, team count, starting player roster, optional result and up to 200 events. The serialized history has a 96 KiB budget for the current KV-backed storage: older rounds, then older events or roster entries in an oversized single round, may be dropped to stay within it. `playersOmitted` records any roster truncation. Event schemas and exported types live in [game.ts](../schema/src/game.ts).

`sessionHistory.awardSeed` keeps playful award titles stable for this room's lifetime, including rematches, reconnects, hibernation, and history pruning. New rooms receive a random UUID. Existing histories without a seed adopt their first retained round ID, or a random UUID if no rounds exist, and persist it. Room expiry removes the seed; reopening the same room name starts a fresh session with a new seed. The field remains optional in the schema for older clients and stored histories.

Hint events contain the public clue, count, team and timestamp. Clue and guess events can also include a `spymaster` identity snapshot (`id`, `name`, optional `animal`) for the person who gave the clue. Guesses retain that attribution through disconnect-driven role changes, rather than crediting the replacement spymaster. Older or unmatched clues leave guesses unattributed. No individual clicker identity is recorded.

Guess events contain the revealed word, guessing team, timestamp and outcome (`correct`, `opponent`, `neutral`, or `assassin`). History stores no unrevealed board identities. Rejected commands and duplicate guesses do not add events. A winning or assassin reveal completes the round once; stopping an unfinished game or removing its last player records an aborted round. Starting a rematch creates a separate round.

The client derives KPIs and playful awards from retained rounds and events using the shared `calculateHistoryStats` helper in the schema package. Personal awards use only explicitly attributed spymaster guesses; team statistics include all recorded guesses. History is persisted with game state, restored after hibernation, shared in snapshots and removed with all other room data at expiry. Pre-existing games cannot reconstruct events from before history recording was introduced.

Mutations are serialized through `blockConcurrencyWhile`. Expected rule rejections are caught inside the block so they do not reset the object. Simultaneous duplicate guesses consume one guess and produce one reveal event.

Each team needs a spymaster and an operative to start. The starting team is random. Default 25-card boards use:

| Teams | Starting team's cards | Each other team's cards | Neutral | Assassin |
| ----- | --------------------- | ----------------------- | ------- | -------- |
| 2     | 9                     | 8                       | 7       | 1        |
| 3     | 8                     | 7                       | 2       | 1        |
| 4     | 6                     | 5                       | 3       | 1        |

Turns currently last 120 seconds. A positive clue count permits that number plus one guesses; zero permits unlimited guesses. Wrong guesses advance the turn. Finished games reject additional clues/reveals and cannot advance their turn. Flexible timers, pause and further classic-rule options remain proposed features.

## Server integration test scope

`gameServer.integration.spec.ts` exercises the actual room server, schemas and game engine with an in-memory storage implementation and mocked Cloudflare socket/context APIs. It covers reconnect grace, lingering closed sockets, settings restoration, board privacy, role restrictions, shared sound classification/timing, finished-game guards, concurrent joins/profile updates, duplicate guesses, expiry across hibernation/rejoin/alarm retries, and bounded session history.

These tests model platform behavior; they do not replace the browser suite's real local Wrangler runtime checks or production connection monitoring.
