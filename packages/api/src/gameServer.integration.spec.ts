import { CodenamesGame, SHUFFLE_COUNTDOWN_MS } from "./gameServer";
import { publicPlayerId } from "./identity";
import { sessionHistorySchema } from "schema";
import type { GameState, GameStateForClient, SessionHistory } from "schema";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    protected ctx: FakeContext;
    constructor(ctx: FakeContext) {
      this.ctx = ctx;
    }
  },
}));

class FakeSocket {
  readonly OPEN = 1;
  readonly CLOSED = 3;
  readyState = this.OPEN;
  attachment: { playerId: string } | undefined;
  messages: string[] = [];
  closed = false;
  serializeAttachment(value: { playerId: string }) {
    this.attachment = structuredClone(value);
  }
  deserializeAttachment() {
    return this.attachment;
  }
  send(message: string) {
    if (this.closed) throw new Error("Closed socket");
    this.messages.push(message);
  }
  close() {
    this.closed = true;
    this.readyState = this.CLOSED;
  }
  latest(): GameStateForClient {
    return this.messages
      .map((message) => JSON.parse(message))
      .filter((event) => event.type === "gameStateUpdated")
      .at(-1)?.gameState;
  }
}

class FakeStorage {
  values = new Map<string, unknown>();
  alarm: number | undefined;
  async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.values.get(key)) as T | undefined;
  }
  async put(values: Record<string, unknown>) {
    for (const [key, value] of Object.entries(values))
      this.values.set(key, structuredClone(value));
  }
  async delete(key: string) {
    return this.values.delete(key);
  }
  async deleteAll() {
    this.values.clear();
  }
  async setAlarm(deadline: number) {
    this.alarm = deadline;
  }
  async deleteAlarm() {
    this.alarm = undefined;
  }
}

class FakeContext {
  storage = new FakeStorage();
  sockets: FakeSocket[] = [];
  includeClosedSockets = false;
  ready: Promise<unknown> = Promise.resolve();
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    const pending = this.ready.then(callback);
    this.ready = pending.catch(() => {});
    return pending;
  }
  acceptWebSocket(socket: FakeSocket) {
    this.sockets.push(socket);
  }
  getWebSockets() {
    return this.includeClosedSockets
      ? this.sockets
      : this.sockets.filter((socket) => !socket.closed);
  }
}

// id(n) is the private reconnect token a client holds; pid(n) is the public id everyone sees.
const id = (number: number) => `player_${String(number).padStart(16, "0")}`;
const publicIds = new Map<string, string>();
const pid = (number: number) => publicIds.get(id(number))!;
beforeAll(async () => {
  for (let number = 1; number <= 8; number++)
    publicIds.set(id(number), await publicPlayerId(id(number)));
});
const command = (game: CodenamesGame, socket: FakeSocket, value: object) =>
  game.webSocketMessage(socket as unknown as WebSocket, JSON.stringify(value));
const create = async (
  context = new FakeContext(),
  roomIdleTtlSeconds?: string,
) => {
  const game = new CodenamesGame(
    context as unknown as DurableObjectState,
    { ROOM_IDLE_TTL_SECONDS: roomIdleTtlSeconds } as never,
  );
  await context.ready;
  return { game, context };
};
const connect = async (
  game: CodenamesGame,
  context: FakeContext,
  playerId: string,
  extra = "",
) => {
  await game.fetch(
    new Request(`https://game.test/room?token=${playerId}${extra}`),
  );
  return context.sockets.at(-1)!;
};
const storedState = (context: FakeContext): GameState =>
  JSON.parse(context.storage.values.get("gameState") as string);
const playingState = (): GameState => ({
  players: [
    { id: pid(1), name: "Spy A", team: 0, role: "spymaster" },
    { id: pid(2), name: "Agent A", team: 0, role: "operative" },
    { id: pid(3), name: "Spy B", team: 1, role: "spymaster" },
    { id: pid(4), name: "Agent B", team: 1, role: "operative" },
  ],
  board: [
    { word: "apple", team: 0 },
    { word: "pear", team: 0 },
    { word: "berry", team: 1 },
    { word: "grape", team: 1 },
    { word: "car" },
    { word: "bomb", isAssassin: true },
  ],
  turn: {
    team: 0,
    until: new Date(Date.now() + 120_000),
    hint: { hint: "fruit", count: 2 },
    guessesRemaining: 3,
  },
  hintHistory: [{ team: 0, inTurn: 0, hint: "fruit", count: 2 }],
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "WebSocketPair",
    class {
      0 = new FakeSocket();
      1 = new FakeSocket();
    },
  );
  vi.stubGlobal(
    "Response",
    class {
      status: number;
      webSocket: FakeSocket;
      constructor(
        _body: unknown,
        init: { status: number; webSocket: FakeSocket },
      ) {
        this.status = init.status;
        this.webSocket = init.webSocket;
      }
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Durable Object room protocol", () => {
  it("serializes simultaneous joins and profile updates without losing any player changes", async () => {
    const { game, context } = await create();
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        game.fetch(
          new Request(
            `https://game.test/room?token=${id(index + 1)}&name=Player${index + 1}`,
          ),
        ),
      ),
    );
    expect(storedState(context).players).toHaveLength(8);
    expect(
      new Set(storedState(context).players.map((player) => player.id)).size,
    ).toBe(8);
    await Promise.all(
      context.sockets.map((socket, index) =>
        command(game, socket, {
          type: "setProfile",
          name: `Updated ${index + 1}`,
          animal: "🦊",
        }),
      ),
    );
    for (let index = 0; index < 8; index++) {
      expect(
        storedState(context).players.find(
          (player) => player.id === pid(index + 1),
        ),
      ).toMatchObject({ name: `Updated ${index + 1}`, animal: "🦊" });
    }
    expect(context.sockets.at(-1)!.latest().players).toEqual(
      storedState(context).players,
    );
  });

  it("accepts only one simultaneous reveal of the same card and consumes one guess", async () => {
    const context = new FakeContext();
    await context.storage.put({ gameState: JSON.stringify(playingState()) });
    const { game } = await create(context);
    const spy = await connect(game, context, id(1));
    const agent = await connect(game, context, id(2));
    spy.messages = [];
    agent.messages = [];
    await Promise.all([
      command(game, agent, { type: "revealWord", word: "apple" }),
      command(game, agent, { type: "revealWord", word: "apple" }),
    ]);
    expect(storedState(context).turn?.guessesRemaining).toBe(2);
    expect(
      storedState(context).board.filter((card) => card.revealed),
    ).toHaveLength(1);
    for (const socket of [spy, agent]) {
      const broadcasts = socket.messages
        .map((message) => JSON.parse(message))
        .filter(
          (event) =>
            event.type === "gameStateUpdated" &&
            event.gameState.effects?.length,
        );
      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0].gameState.effects).toHaveLength(1);
      expect(broadcasts[0].gameState.effects[0].type).toBe("correctGuess");
    }
    expect(
      agent.messages
        .map((message) => JSON.parse(message))
        .filter((event) => event.type === "commandRejected"),
    ).toEqual([{ type: "commandRejected", reason: "Word already revealed" }]);
  });

  it("restores the same identity and profile in a new room without leaking the other room roster", async () => {
    const first = await create();
    const socket = await connect(
      first.game,
      first.context,
      id(1),
      "&name=Alice&animal=" + encodeURIComponent("🦊"),
    );
    await command(first.game, socket, {
      type: "setProfile",
      name: "Captain Alice",
      animal: "🐼",
    });
    const other = await create();
    const second = await connect(
      other.game,
      other.context,
      id(1),
      "&name=Captain%20Alice&animal=" + encodeURIComponent("🐼"),
    );
    expect(second.latest().players).toHaveLength(1);
    expect(second.latest().players[0]).toMatchObject({
      id: pid(1),
      name: "Captain Alice",
      animal: "🐼",
    });
    const reconnect = await connect(first.game, first.context, id(1));
    expect(reconnect.latest().players).toHaveLength(1);
    expect(reconnect.latest().players[0]).toMatchObject({
      name: "Captain Alice",
      animal: "🐼",
      role: "spymaster",
      team: 0,
    });
  });

  it("keeps one roster entry across two tabs and only removes it after the last tab's grace expires", async () => {
    const { game, context } = await create();
    const first = await connect(game, context, id(1));
    const second = await connect(game, context, id(1));
    await game.webSocketClose(first as unknown as WebSocket, 1000, "", true);
    expect(storedState(context).players).toHaveLength(1);
    expect(context.storage.alarm).toBeUndefined();
    await game.webSocketError(second as unknown as WebSocket);
    expect(storedState(context).players).toHaveLength(1);
    vi.advanceTimersByTime(60_001);
    await game.alarm();
    expect(storedState(context).players).toHaveLength(0);
  });

  it("cancels pending cleanup on reconnect and retains the assigned team and role", async () => {
    const { game, context } = await create();
    const first = await connect(game, context, id(1));
    await game.webSocketClose(first as unknown as WebSocket, 1000, "", true);
    vi.advanceTimersByTime(30_000);
    const again = await connect(game, context, id(1));
    vi.advanceTimersByTime(30_001);
    await game.alarm();
    expect(again.latest().players).toHaveLength(1);
    expect(again.latest().players[0]).toMatchObject({
      id: pid(1),
      team: 0,
      role: "spymaster",
    });
  });

  it("ignores lingering closed sockets when deciding whether a disconnected identity is still connected", async () => {
    const { game, context } = await create();
    context.includeClosedSockets = true;
    const first = await connect(game, context, id(1));
    const second = await connect(game, context, id(1));
    await game.webSocketClose(first as unknown as WebSocket, 1000, "", true);
    expect(context.storage.alarm).toBeUndefined();
    await game.webSocketClose(second as unknown as WebSocket, 1000, "", true);
    expect(context.storage.alarm).toBe(Date.now() + 60_000);
    expect(context.getWebSockets()).toHaveLength(2);
    vi.advanceTimersByTime(60_001);
    await game.alarm();
    expect(storedState(context).players).toHaveLength(0);
  });

  it("shares custom lists, balances 3/4 teams, and restores settings after hibernation", async () => {
    const { game, context } = await create();
    const sockets = [];
    for (let i = 1; i <= 8; i++)
      sockets.push(await connect(game, context, id(i)));
    const words = Array.from({ length: 30 }, (_, index) => `Custom ${index}`);
    await command(game, sockets[0], { type: "setCustomWords", words });
    for (const teamCount of [3, 4]) {
      await command(game, sockets[0], { type: "setTeamCount", teamCount });
      expect(sockets[7].latest()).toMatchObject({
        wordPack: "custom",
        customWords: words,
        teamCount,
        gameCanStart: true,
      });
      for (let team = 0; team < teamCount; team++) {
        const players = sockets[0]
          .latest()
          .players.filter((player) => player.team === team);
        expect(
          players.filter((player) => player.role === "spymaster"),
        ).toHaveLength(1);
      }
    }
    await command(game, sockets[0], { type: "shuffleTeams" });
    vi.advanceTimersByTime(SHUFFLE_COUNTDOWN_MS);
    await game.alarm();
    const resumed = await create(context);
    expect(sockets[0].latest()).toMatchObject({
      customWords: words,
      teamCount: 4,
      wordPack: "custom",
    });
    await command(resumed.game, sockets[0], { type: "startGame" });
    expect(storedState(context).board).toHaveLength(25);
    expect(
      storedState(context).board.every((card) => words.includes(card.word)),
    ).toBe(true);
  });

  it("runs one shared shuffle countdown, ignores repeat presses, and reshuffles everyone at once", async () => {
    const { game, context } = await create();
    const sockets = [];
    for (let i = 1; i <= 6; i++)
      sockets.push(await connect(game, context, id(i)));
    const before = storedState(context).players;
    const rejections = (socket: FakeSocket) =>
      socket.messages
        .map((message) => JSON.parse(message))
        .filter((event) => event.type === "commandRejected");

    await command(game, sockets[0], { type: "shuffleTeams" });
    const shuffleAt = Date.now() + SHUFFLE_COUNTDOWN_MS;
    for (const socket of sockets)
      expect(socket.latest().shuffleAt).toBe(shuffleAt);
    expect(context.storage.alarm).toBe(shuffleAt);
    // Nothing moves until the countdown ends.
    expect(storedState(context).players).toEqual(before);

    // Mashing the button (from anyone) neither restarts nor stacks the countdown.
    vi.advanceTimersByTime(1_000);
    const broadcasts = sockets[1].messages.length;
    await command(game, sockets[1], { type: "shuffleTeams" });
    await command(game, sockets[2], { type: "shuffleTeams" });
    expect(sockets[1].messages).toHaveLength(broadcasts);
    expect(sockets[1].latest().shuffleAt).toBe(shuffleAt);

    // Starting mid-ceremony is refused.
    await command(game, sockets[0], { type: "startGame" });
    expect(rejections(sockets[0])).toEqual([
      { type: "commandRejected", reason: "Wait for the shuffle to finish" },
    ]);
    expect(storedState(context).turn).toBeUndefined();

    // An early alarm (e.g. another deadline) leaves the ceremony running.
    await game.alarm();
    expect(sockets[0].latest().shuffleAt).toBe(shuffleAt);

    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.advanceTimersByTime(2_000);
    await game.alarm();
    for (const socket of sockets) {
      expect(socket.latest().shuffleAt).toBeUndefined();
      expect(socket.latest().players).toEqual(storedState(context).players);
    }
    const after = storedState(context).players;
    const shuffled = after.some(
      (player, index) =>
        player.id !== before[index].id || player.team !== before[index].team,
    );
    expect(shuffled).toBe(true);
    for (const team of [0, 1])
      expect(
        after.filter((p) => p.team === team && p.role === "spymaster"),
      ).toHaveLength(1);
    expect(context.storage.alarm).toBeUndefined();

    // A finished ceremony can be started again.
    await command(game, sockets[3], { type: "shuffleTeams" });
    expect(sockets[3].latest().shuffleAt).toBe(
      Date.now() + SHUFFLE_COUNTDOWN_MS,
    );
  });

  it("restores a pending shuffle after hibernation and skips it once a game started", async () => {
    const { game, context } = await create();
    const sockets = [];
    for (let i = 1; i <= 4; i++)
      sockets.push(await connect(game, context, id(i)));
    await command(game, sockets[0], { type: "shuffleTeams" });
    const shuffleAt = Date.now() + SHUFFLE_COUNTDOWN_MS;

    const resumed = await create(context);
    vi.advanceTimersByTime(SHUFFLE_COUNTDOWN_MS);
    await resumed.game.alarm();
    expect(context.storage.values.get("shuffleAt")).toBeNull();
    expect(sockets[0].latest().shuffleAt).toBeUndefined();
    expect(shuffleAt).toBeLessThanOrEqual(Date.now());

    // If a game is somehow running when the alarm fires, its teams stay put.
    await command(resumed.game, sockets[0], { type: "shuffleTeams" });
    context.storage.values.set("gameState", JSON.stringify(playingState()));
    const playing = await create(context);
    const teams = storedState(context).players.map((p) => [p.id, p.team]);
    vi.advanceTimersByTime(SHUFFLE_COUNTDOWN_MS);
    await playing.game.alarm();
    expect(storedState(context).players.map((p) => [p.id, p.team])).toEqual(
      teams,
    );
  });

  it("does not let a client take over a player by presenting the public id broadcast to everyone", async () => {
    const context = new FakeContext();
    await context.storage.put({ gameState: JSON.stringify(playingState()) });
    const { game } = await create(context);
    const spy = await connect(game, context, id(1));
    const leakedPublicId = spy
      .latest()
      .players.find((player) => player.role === "spymaster")!.id;
    const intruder = await connect(game, context, leakedPublicId);
    expect(intruder.latest().playerId).not.toBe(pid(1));
    expect(
      intruder
        .latest()
        .players.find((player) => player.id === intruder.latest().playerId)
        ?.role,
    ).toBe("operative");
    expect(
      intruder
        .latest()
        .board.some((card) => !card.revealed && card.team !== undefined),
    ).toBe(false);
    expect(spy.latest().board.some((card) => card.team !== undefined)).toBe(
      true,
    );
  });

  it("ignores the legacy playerId parameter, whose values were broadcast before reconnect tokens", async () => {
    const context = new FakeContext();
    const state = playingState();
    // A pre-token room: the spymaster's id is the raw value its browser still holds and everyone saw.
    state.players[0].id = id(1);
    await context.storage.put({ gameState: JSON.stringify(state) });
    const { game } = await create(context);
    await game.fetch(new Request(`https://game.test/room?playerId=${id(1)}`));
    const intruder = context.sockets.at(-1)!;
    expect(intruder.latest().playerId).not.toBe(id(1));
    expect(intruder.latest().playerId).not.toBe(pid(1));
    expect(intruder.latest().board.some((card) => !card.revealed && card.team !== undefined)).toBe(false);
  });

  it("rejects malformed commands without changing storage", async () => {
    const { game, context } = await create();
    const socket = await connect(game, context, id(1));
    const before = structuredClone(context.storage.values);
    for (const value of [
      { type: "setTeamCount", teamCount: 7 },
      { type: "setProfile", name: "Alice", animal: "invalid" },
      { type: "setCustomWords", words: Array(25).fill("duplicate") },
    ])
      await command(game, socket, value);
    await game.webSocketMessage(socket as unknown as WebSocket, "not json");
    expect(context.storage.values).toEqual(before);
  });

  it("does not advance a live turn when a disconnect cleanup alarm fires early", async () => {
    const context = new FakeContext();
    await context.storage.put({ gameState: JSON.stringify(playingState()) });
    const { game } = await create(context);
    const sockets = [];
    for (let i = 1; i <= 4; i++)
      sockets.push(await connect(game, context, id(i)));
    await game.webSocketClose(
      sockets[3] as unknown as WebSocket,
      1000,
      "",
      true,
    );
    expect(context.storage.alarm).toBe(Date.now() + 60_000);
    vi.advanceTimersByTime(60_001);
    await game.alarm();
    expect(storedState(context).turn?.team).toBe(0);
    expect(storedState(context).players).toHaveLength(3);
    vi.advanceTimersByTime(60_000);
    await game.alarm();
    expect(storedState(context).turn?.team).toBe(1);
  });

  it.each([
    ["apple", "correctGuess", 0],
    ["berry", "wrongGuess", 1],
    ["car", "wrongGuess", 1],
    ["bomb", "assassinReveal", 0],
  ])(
    "broadcasts the same scheduled %s reveal cue to all clients",
    async (word, type, nextTeam) => {
      const context = new FakeContext();
      await context.storage.put({ gameState: JSON.stringify(playingState()) });
      const { game } = await create(context);
      const sockets = [];
      for (let i = 1; i <= 4; i++)
        sockets.push(await connect(game, context, id(i)));
      await command(game, sockets[1], { type: "revealWord", word });
      const effects = sockets[0].latest().effects;
      const turnChange =
        nextTeam === 0
          ? []
          : [
              {
                id: expect.any(String),
                type: "turnChange",
                team: nextTeam,
                playAt: Date.now() + 750,
              },
            ];
      expect(effects).toEqual([
        {
          id: expect.any(String),
          type,
          team: 0,
          word,
          playAt: Date.now() + 300,
        },
        ...turnChange,
      ]);
      for (const socket of sockets)
        expect(socket.latest().effects).toEqual(effects);
      expect(storedState(context).turn?.team).toBe(nextTeam);
      // A wrong opponent guess changes turns, but the cue compares the original guessing team.
      expect(
        storedState(context).board.find((card) => card.word === word)?.revealed
          ?.byTeam,
      ).toBe(0);
    },
  );

  it("freezes finished games against additional reveals and hints", async () => {
    const context = new FakeContext();
    await context.storage.put({ gameState: JSON.stringify(playingState()) });
    const { game } = await create(context);
    const spy = await connect(game, context, id(1));
    const agent = await connect(game, context, id(2));
    await command(game, agent, { type: "revealWord", word: "bomb" });
    const before = context.storage.values.get("gameState");
    await command(game, agent, { type: "revealWord", word: "apple" });
    await command(game, spy, { type: "giveHint", hint: "fruit", count: 1 });
    expect(context.storage.values.get("gameState")).toBe(before);
    expect(JSON.parse(agent.messages.at(-1)!)).toMatchObject({
      type: "commandRejected",
      reason: "Game is already over",
    });
    expect(JSON.parse(spy.messages.at(-1)!)).toMatchObject({
      type: "commandRejected",
      reason: "Game is already over",
    });
  });

  it("keeps hidden card identities private to operatives and blocks unauthorized moves", async () => {
    const context = new FakeContext();
    await context.storage.put({ gameState: JSON.stringify(playingState()) });
    const { game } = await create(context);
    const spy = await connect(game, context, id(1));
    const agent = await connect(game, context, id(2));
    const opposingAgent = await connect(game, context, id(4));
    expect(
      spy.latest().board.find((card) => card.word === "bomb")?.isAssassin,
    ).toBe(true);
    expect(
      agent
        .latest()
        .board.every(
          (card) => card.team === undefined && card.isAssassin === undefined,
        ),
    ).toBe(true);
    const before = context.storage.values.get("gameState");
    await command(game, spy, { type: "revealWord", word: "apple" });
    await command(game, agent, { type: "giveHint", hint: "fruit", count: 1 });
    await command(game, opposingAgent, { type: "revealWord", word: "apple" });
    expect(context.storage.values.get("gameState")).toBe(before);
    expect(JSON.parse(spy.messages.at(-1)!)).toMatchObject({
      reason: "Spymaster cannot reveal words",
    });
    expect(JSON.parse(agent.messages.at(-1)!)).toMatchObject({
      reason: "Not spymaster",
    });
    expect(JSON.parse(opposingAgent.messages.at(-1)!)).toMatchObject({
      reason: "Not player's turn",
    });
  });

  it("blocks spymaster promotion during play and permits a role swap after the game finishes", async () => {
    const context = new FakeContext();
    await context.storage.put({ gameState: JSON.stringify(playingState()) });
    const { game } = await create(context);
    const spy = await connect(game, context, id(1));
    const agent = await connect(game, context, id(2));
    const before = context.storage.values.get("gameState");
    await command(game, agent, { type: "promoteToSpymaster", playerId: pid(2) });
    expect(context.storage.values.get("gameState")).toBe(before);
    expect(JSON.parse(agent.messages.at(-1)!)).toMatchObject({
      type: "commandRejected",
      reason: "Roles can only change before or after a game",
    });
    expect(
      agent
        .latest()
        .board.every(
          (card) => card.team === undefined && card.isAssassin === undefined,
        ),
    ).toBe(true);
    await command(game, agent, { type: "revealWord", word: "bomb" });
    await command(game, agent, { type: "promoteToSpymaster", playerId: pid(2) });
    expect(
      storedState(context).players.find((player) => player.id === pid(2))?.role,
    ).toBe("spymaster");
    expect(
      storedState(context).players.find((player) => player.id === pid(1))?.role,
    ).toBe("operative");
    expect(spy.latest().players).toEqual(agent.latest().players);
    expect(agent.latest().gameResult).toMatchObject({ losingTeam: 0 });
  });

  it("coordinates a winning reveal followed by a victory cue with the same timing for every client", async () => {
    const context = new FakeContext();
    const state = playingState();
    state.board.find((card) => card.word === "pear")!.revealed = {
      byTeam: 0,
      inTurn: 0,
    };
    await context.storage.put({ gameState: JSON.stringify(state) });
    const { game } = await create(context);
    const spy = await connect(game, context, id(1));
    const agent = await connect(game, context, id(2));
    await command(game, agent, { type: "revealWord", word: "apple" });
    expect(agent.latest().effects).toEqual([
      {
        id: expect.any(String),
        type: "correctGuess",
        team: 0,
        word: "apple",
        playAt: Date.now() + 300,
      },
      {
        id: expect.any(String),
        type: "gameWin",
        team: 0,
        playAt: Date.now() + 750,
      },
    ]);
    expect(spy.latest().effects).toEqual(agent.latest().effects);
    expect(agent.latest().gameResult).toMatchObject({ winningTeam: 0 });
    expect(
      agent.latest().board.find((card) => card.word === "bomb")?.isAssassin,
    ).toBe(true);
    expect(context.storage.alarm).toBe(Date.now() + 60_000); // Unconnected players still receive reconnect grace.
  });

  it("celebrates a perfectly solved clue and starts the next game with a shared deal cue", async () => {
    const context = new FakeContext();
    const state = playingState();
    state.turn!.hint = { hint: "fruit", count: 1 };
    state.turn!.guessesRemaining = 2;
    state.hintHistory = [{ team: 0, inTurn: 0, hint: "fruit", count: 1 }];
    await context.storage.put({ gameState: JSON.stringify(state) });
    const { game } = await create(context);
    const sockets = [];
    for (let i = 1; i <= 4; i++)
      sockets.push(await connect(game, context, id(i)));
    await command(game, sockets[1], { type: "revealWord", word: "apple" });
    expect(sockets[0].latest().effects?.map((effect) => effect.type)).toEqual([
      "correctGuess",
      "perfectClue",
    ]);
    await command(game, sockets[1], { type: "revealWord", word: "bomb" });
    await command(game, sockets[0], { type: "startGame" });
    const [deal] = sockets[2].latest().effects!;
    expect(deal).toMatchObject({
      type: "gameStart",
      team: storedState(context).turn!.team,
    });
    expect(sockets[2].latest().turnSeconds).toBe(120);
  });

  it("shares tentative card marks for the current turn only and lets only guessing operatives mark", async () => {
    const context = new FakeContext();
    await context.storage.put({ gameState: JSON.stringify(playingState()) });
    const { game } = await create(context);
    const sockets = [];
    for (let i = 1; i <= 4; i++)
      sockets.push(await connect(game, context, id(i)));
    await command(game, sockets[1], { type: "markCard", word: "pear" });
    expect(sockets[3].latest().marks).toEqual([
      { word: "pear", playerId: pid(2) },
    ]);
    for (const [socket, word] of [
      [sockets[0], "pear"],
      [sockets[3], "pear"],
      [sockets[1], "nope"],
    ] as const) {
      await command(game, socket, { type: "markCard", word });
      expect(JSON.parse(socket.messages.at(-1)!).type).toBe("commandRejected");
    }
    await command(game, sockets[1], { type: "markCard", word: "pear" });
    expect(sockets[3].latest().marks).toEqual([]);
    await command(game, sockets[1], { type: "markCard", word: "apple" });
    await command(game, sockets[1], { type: "markCard", word: "pear" });
    await command(game, sockets[1], { type: "revealWord", word: "apple" });
    expect(sockets[0].latest().marks).toEqual([
      { word: "pear", playerId: pid(2) },
    ]);
    vi.advanceTimersByTime(1_000);
    await command(game, sockets[1], { type: "endTurn" });
    expect(sockets[0].latest().marks).toEqual([]);
  });

  it("relays reactions and spymaster typing as ephemeral events without touching storage", async () => {
    const context = new FakeContext();
    const state = playingState();
    state.turn!.hint = undefined;
    await context.storage.put({ gameState: JSON.stringify(state) });
    const { game } = await create(context);
    const sockets = [];
    for (let i = 1; i <= 4; i++)
      sockets.push(await connect(game, context, id(i)));
    const before = structuredClone(context.storage.values);
    const events = (socket: FakeSocket, type: string) =>
      socket.messages
        .map((message) => JSON.parse(message))
        .filter((event) => event.type === type);
    await command(game, sockets[3], { type: "react", emoji: "😱" });
    await command(game, sockets[3], { type: "react", emoji: "😂" }); // rate-limited
    expect(events(sockets[0], "reaction")).toEqual([
      {
        type: "reaction",
        id: expect.any(String),
        playerId: pid(4),
        emoji: "😱",
      },
    ]);
    await command(game, sockets[0], { type: "typing", typing: true });
    await command(game, sockets[2], { type: "typing", typing: true }); // not this team's turn
    expect(events(sockets[1], "typing")).toEqual([
      { type: "typing", playerId: pid(1), typing: true },
    ]);
    expect(events(sockets[0], "typing")).toEqual([]);
    expect(context.storage.values).toEqual(before);
  });
});

describe("idle room expiry", () => {
  it("maintenance enrolls legacy rooms without players or extending deadlines, and skips live/empty rooms", async () => {
    const legacy = new FakeContext();
    legacy.storage.values.set("gameState", JSON.stringify(playingState()));
    const { game } = await create(legacy);
    const originalPlayers = storedState(legacy).players;
    const deadline = Date.now() + RETENTION_MS;
    expect(await game.enrollRoomExpiry()).toEqual({
      status: "idle",
      expiresAt: deadline,
    });
    vi.advanceTimersByTime(1_000);
    expect(await game.enrollRoomExpiry()).toEqual({
      status: "idle",
      expiresAt: deadline,
    });
    expect(storedState(legacy).players).toEqual(originalPlayers);
    const socket = await connect(game, legacy, id(1));
    expect(await game.enrollRoomExpiry()).toEqual({ status: "active" });
    expect(legacy.storage.values.get("roomExpiresAt")).toBeNull();
    expect(socket.latest().players).toHaveLength(originalPlayers.length);
    await game.webSocketClose(socket as unknown as WebSocket, 1000, "", true);
    vi.advanceTimersByTime(RETENTION_MS);
    expect(await game.enrollRoomExpiry()).toEqual({ status: "empty" });
    expect(legacy.storage.values.size).toBe(0);
    expect(legacy.storage.alarm).toBeUndefined();
    const empty = await create();
    expect(await empty.game.enrollRoomExpiry()).toEqual({ status: "empty" });
    expect(empty.context.storage.values.size).toBe(0);
  });
  const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

  it("deletes all room data and the alarm two weeks after the last socket disconnects", async () => {
    const { game, context } = await create();
    const first = await connect(game, context, id(1));
    const second = await connect(game, context, id(1));
    const words = Array.from({ length: 25 }, (_, i) => `Word ${i}`);
    await command(game, first, { type: "setCustomWords", words });
    await game.webSocketClose(first as unknown as WebSocket, 1000, "", true);
    expect(context.storage.values.get("roomExpiresAt")).toBeNull();
    const leftAt = Date.now();
    await game.webSocketClose(second as unknown as WebSocket, 1000, "", true);
    expect(context.storage.values.get("roomExpiresAt")).toBe(
      leftAt + RETENTION_MS,
    );
    expect(context.storage.alarm).toBe(leftAt + 60_000);
    vi.advanceTimersByTime(60_000);
    await game.alarm();
    expect(storedState(context).players).toHaveLength(0);
    expect(context.storage.alarm).toBe(leftAt + RETENTION_MS);
    expect(context.storage.values.get("roomSettings")).toMatchObject({
      customWords: words,
    });
    vi.advanceTimersByTime(RETENTION_MS - 60_001);
    await game.alarm();
    expect(context.storage.values.size).toBeGreaterThan(0);
    vi.advanceTimersByTime(1);
    await game.alarm();
    expect(context.storage.values.size).toBe(0);
    expect(context.storage.alarm).toBeUndefined();
    // Alarm retries and constructor wakeups must not recreate empty room data.
    await game.alarm();
    await create(context);
    expect(context.storage.values.size).toBe(0);
    expect(context.storage.alarm).toBeUndefined();
    const newcomer = await connect(game, context, id(2));
    expect(newcomer.latest()).toMatchObject({
      wordPack: "classic",
      teamCount: 2,
      customWords: [],
      board: [],
    });
    expect(newcomer.latest().players).toHaveLength(1);
  });

  it("preserves a persisted expiry through hibernation without extending it on alarms", async () => {
    const { game, context } = await create();
    const socket = await connect(game, context, id(1));
    await game.webSocketClose(socket as unknown as WebSocket, 1000, "", true);
    const expiresAt = context.storage.values.get("roomExpiresAt");
    vi.advanceTimersByTime(60_000);
    const resumed = await create(context);
    await resumed.game.alarm();
    expect(context.storage.values.get("roomExpiresAt")).toBe(expiresAt);
    expect(context.storage.alarm).toBe(expiresAt);
    vi.advanceTimersByTime(RETENTION_MS - 60_000);
    const expired = await create(context);
    expect(context.storage.values.size).toBe(0);
    await expired.game.alarm();
    expect(context.storage.values.size).toBe(0);
  });

  it("cancels expiry on rejoin and starts a fresh deadline only after the player leaves again", async () => {
    const { game, context } = await create();
    const socket = await connect(game, context, id(1));
    await game.webSocketClose(socket as unknown as WebSocket, 1000, "", true);
    const oldDeadline = context.storage.values.get("roomExpiresAt") as number;
    vi.advanceTimersByTime(RETENTION_MS - 1);
    const rejoined = await connect(game, context, id(1));
    expect(context.storage.values.get("roomExpiresAt")).toBeNull();
    vi.advanceTimersByTime(RETENTION_MS);
    await game.alarm();
    expect(storedState(context).players).toHaveLength(1);
    expect(context.storage.values.get("roomExpiresAt")).toBeNull();
    await game.webSocketClose(rejoined as unknown as WebSocket, 1000, "", true);
    expect(context.storage.values.get("roomExpiresAt")).toBe(
      Date.now() + RETENTION_MS,
    );
    expect(context.storage.values.get("roomExpiresAt")).not.toBe(oldDeadline);
  });

  it("recreates an expired room on join even when its cleanup alarm was delayed", async () => {
    const { game, context } = await create();
    const socket = await connect(game, context, id(1));
    await command(game, socket, { type: "setTeamCount", teamCount: 3 });
    await game.webSocketClose(socket as unknown as WebSocket, 1000, "", true);
    vi.advanceTimersByTime(RETENTION_MS + 1);
    const joined = await connect(game, context, id(2));
    expect(joined.latest()).toMatchObject({
      teamCount: 2,
      wordPack: "classic",
      customWords: [],
    });
    expect(joined.latest().players.map((p) => p.id)).toEqual([pid(2)]);
    expect(context.storage.values.get("roomExpiresAt")).toBeNull();
  });

  it("adopts existing stored rooms without expiry metadata when they next wake", async () => {
    const context = new FakeContext();
    context.storage.values.set("gameState", JSON.stringify(playingState()));
    const { game } = await create(context);
    expect(context.storage.values.get("roomExpiresAt")).toBe(
      Date.now() + RETENTION_MS,
    );
    expect(context.storage.alarm).toBe(Date.now() + 60_000);
    vi.advanceTimersByTime(RETENTION_MS);
    await game.alarm();
    expect(context.storage.values.size).toBe(0);
  });

  it("does not persist never-joined rooms and honors a configurable timeout", async () => {
    const { game, context } = await create(undefined, "120");
    expect(context.storage.values.size).toBe(0);
    expect(context.storage.alarm).toBeUndefined();
    const socket = await connect(game, context, id(1));
    await game.webSocketClose(socket as unknown as WebSocket, 1000, "", true);
    expect(context.storage.values.get("roomExpiresAt")).toBe(
      Date.now() + 120_000,
    );
    vi.advanceTimersByTime(60_000);
    await game.alarm();
    expect(context.storage.alarm).toBe(Date.now() + 60_000);
    vi.advanceTimersByTime(60_000);
    await game.alarm();
    expect(context.storage.values.size).toBe(0);
  });

  it.each(["invalid", "0", "59", "1.5", "Infinity", "9007199254740991"])(
    "uses the safe default for invalid timeout %s",
    async (value) => {
      const { game, context } = await create(undefined, value);
      const socket = await connect(game, context, id(1));
      await game.webSocketClose(socket as unknown as WebSocket, 1000, "", true);
      expect(context.storage.values.get("roomExpiresAt")).toBe(
        Date.now() + RETENTION_MS,
      );
    },
  );
});

describe("persistent session history", () => {
  const storedHistory = (context: FakeContext): SessionHistory =>
    structuredClone(
      context.storage.values.get("sessionHistory") as SessionHistory,
    );
  const startSession = async () => {
    const { game, context } = await create();
    for (let number = 1; number <= 4; number++)
      await connect(game, context, id(number));
    await command(game, context.sockets[0], { type: "startGame" });
    return { game, context };
  };
  const turnSocket = (
    context: FakeContext,
    role: "spymaster" | "operative",
  ) => {
    const state = storedState(context);
    const player = state.players.find(
      (player) => player.team === state.turn?.team && player.role === role,
    )!;
    return context.sockets.findLast(
      (socket) => !socket.closed && socket.attachment?.playerId === player.id,
    )!;
  };

  it("restores the round log after hibernation and keeps each rematch's roster snapshot separate", async () => {
    const { game, context } = await startSession();
    const first = storedHistory(context).rounds[0];
    expect(first).toMatchObject({
      id: expect.any(String),
      startedAt: Date.now(),
      status: "active",
      wordPack: "classic",
      teamCount: 2,
      events: [],
    });
    expect(first.players).toEqual(storedState(context).players);
    expect(first).not.toHaveProperty("board");
    await command(game, context.sockets[0], {
      type: "setProfile",
      name: "New name",
      animal: "🦊",
    });
    expect(storedHistory(context).rounds[0].players).toEqual(first.players);
    vi.advanceTimersByTime(1_000);
    await command(game, turnSocket(context, "spymaster"), {
      type: "giveHint",
      hint: "  fruit  ",
      count: 2,
    });
    const ownWord = storedState(context).board.find(
      (card) => card.team === storedState(context).turn?.team,
    )!.word;
    await command(game, turnSocket(context, "operative"), {
      type: "revealWord",
      word: ownWord,
    });
    const beforeReload = storedHistory(context);
    const resumed = await create(context);
    expect(storedHistory(context)).toEqual(beforeReload);
    for (const socket of context.sockets)
      expect(socket.latest().sessionHistory).toEqual(beforeReload);
    expect(beforeReload.rounds[0].events[0]).toMatchObject({
      type: "hint",
      hint: "fruit",
      timestamp: Date.now(),
    });
    vi.advanceTimersByTime(1_000);
    await command(resumed.game, context.sockets[0], { type: "endGame" });
    await command(resumed.game, context.sockets[0], { type: "startGame" });
    const rounds = storedHistory(context).rounds;
    expect(rounds).toHaveLength(2);
    expect(rounds[0]).toMatchObject({
      id: first.id,
      status: "aborted",
      endedAt: Date.now(),
    });
    expect(rounds[1]).toMatchObject({
      status: "active",
      startedAt: Date.now(),
      events: [],
    });
    expect(rounds[1].id).not.toBe(first.id);
    expect(
      rounds[1].players.find((player) => player.id === pid(1)),
    ).toMatchObject({ name: "New name", animal: "🦊" });
  });

  it.each(["correct", "opponent", "neutral", "assassin"] as const)(
    "records only a revealed %s outcome with the original guessing team's attribution",
    async (outcome) => {
      const { game, context } = await startSession();
      const state = storedState(context);
      const team = state.turn!.team;
      const clueGiver = state.players.find(
        (player) => player.team === team && player.role === "spymaster",
      )!;
      const spymaster = { id: clueGiver.id, name: clueGiver.name };
      const card = state.board.find((card) =>
        outcome === "assassin"
          ? card.isAssassin
          : outcome === "correct"
            ? card.team === team
            : outcome === "opponent"
              ? card.team !== undefined && card.team !== team
              : card.team === undefined && !card.isAssassin,
      )!;
      await command(game, turnSocket(context, "spymaster"), {
        type: "giveHint",
        hint: "test",
        count: 0,
      });
      vi.advanceTimersByTime(500);
      await command(game, turnSocket(context, "operative"), {
        type: "revealWord",
        word: card.word,
      });
      const round = storedHistory(context).rounds[0];
      expect(round.events).toEqual([
        {
          type: "hint",
          timestamp: Date.now() - 500,
          team,
          hint: "test",
          count: 0,
          spymaster,
        },
        {
          type: "guess",
          timestamp: Date.now(),
          team,
          word: card.word,
          outcome,
          spymaster,
        },
      ]);
      expect(round).not.toHaveProperty("board");
      expect(round.events[1]).not.toHaveProperty("isAssassin");
      expect(round.events[1]).not.toHaveProperty("cardTeam");
      for (const socket of context.sockets)
        expect(socket.latest().sessionHistory).toEqual(storedHistory(context));
      expect(sessionHistorySchema.safeParse({ rounds: [round] }).success).toBe(
        true,
      );
      if (outcome === "assassin")
        expect(round).toMatchObject({
          status: "completed",
          endedAt: Date.now(),
          result: { losingTeam: team },
        });
    },
  );

  it("finalizes a win exactly once and retains it through rematch, reload, and explicit reset", async () => {
    const { game, context } = await startSession();
    const team = storedState(context).turn!.team;
    const agent = turnSocket(context, "operative");
    await command(game, turnSocket(context, "spymaster"), {
      type: "giveHint",
      hint: "all",
      count: 0,
    });
    const words = storedState(context)
      .board.filter((card) => card.team === team)
      .map((card) => card.word);
    for (const word of words)
      await command(game, agent, { type: "revealWord", word });
    const completed = storedHistory(context).rounds[0];
    expect(completed).toMatchObject({
      status: "completed",
      endedAt: Date.now(),
      result: { winningTeam: team },
    });
    expect(completed.events).toHaveLength(words.length + 1);
    vi.advanceTimersByTime(2_000);
    await command(game, agent, { type: "revealWord", word: words[0] });
    await command(game, agent, { type: "endGame" });
    expect(storedHistory(context).rounds[0]).toEqual(completed);
    const resumed = await create(context);
    await command(resumed.game, agent, { type: "startGame" });
    expect(storedHistory(context).rounds).toHaveLength(2);
    expect(storedHistory(context).rounds[0]).toEqual(completed);
    expect(storedHistory(context).rounds[1].status).toBe("active");
  });

  it("logs neither rejected actions nor duplicate concurrent guesses", async () => {
    const { game, context } = await startSession();
    const spy = turnSocket(context, "spymaster");
    const agent = turnSocket(context, "operative");
    const ownWord = storedState(context).board.find(
      (card) => card.team === storedState(context).turn?.team,
    )!.word;
    await command(game, agent, { type: "revealWord", word: ownWord });
    await command(game, agent, {
      type: "giveHint",
      hint: "wrong role",
      count: 1,
    });
    await command(game, spy, { type: "giveHint", hint: " ", count: 1 });
    expect(storedHistory(context).rounds[0].events).toEqual([]);
    await command(game, spy, { type: "giveHint", hint: "fruit", count: 2 });
    await command(game, spy, { type: "giveHint", hint: "duplicate", count: 2 });
    await Promise.all([
      command(game, agent, { type: "revealWord", word: ownWord }),
      command(game, agent, { type: "revealWord", word: ownWord }),
    ]);
    await command(game, agent, { type: "revealWord", word: "missing" });
    expect(
      storedHistory(context).rounds[0].events.map((event) => event.type),
    ).toEqual(["hint", "guess"]);
  });

  it("keeps the original clue giver's attribution when a disconnect promotes a replacement spymaster", async () => {
    const { game, context } = await startSession();
    for (const number of [5, 6]) await connect(game, context, id(number));
    const team = storedState(context).turn!.team;
    const originalSpy = turnSocket(context, "spymaster");
    const originalId = originalSpy.attachment!.playerId;
    await command(game, originalSpy, {
      type: "setProfile",
      name: "Original clue giver",
      animal: "🦊",
    });
    await command(game, originalSpy, {
      type: "giveHint",
      hint: "fruit",
      count: 0,
    });
    const originalIdentity = {
      id: originalId,
      name: "Original clue giver",
      animal: "🦊",
    };
    await game.webSocketClose(
      originalSpy as unknown as WebSocket,
      1000,
      "",
      true,
    );
    vi.advanceTimersByTime(60_001);
    await game.alarm();
    expect(storedState(context).turn!.team).toBe(team);
    expect(
      storedState(context).players.some((player) => player.id === originalId),
    ).toBe(false);
    const replacementSpy = turnSocket(context, "spymaster");
    expect(replacementSpy.attachment!.playerId).not.toBe(originalId);
    const ownWord = storedState(context).board.find(
      (card) => card.team === team,
    )!.word;
    await command(game, turnSocket(context, "operative"), {
      type: "revealWord",
      word: ownWord,
    });
    const history = storedHistory(context);
    expect(history.rounds[0].events[0]).toMatchObject({
      type: "hint",
      spymaster: originalIdentity,
    });
    expect(history.rounds[0].events[1]).toMatchObject({
      type: "guess",
      team,
      outcome: "correct",
      spymaster: originalIdentity,
    });
    expect(history.rounds[0].events[1]).not.toHaveProperty("operative");
    await command(game, replacementSpy, { type: "endTurn" });
    await command(game, turnSocket(context, "spymaster"), { type: "endTurn" });
    await command(game, replacementSpy, {
      type: "setProfile",
      name: "Replacement clue giver",
      animal: "🐼",
    });
    await command(game, replacementSpy, {
      type: "giveHint",
      hint: "fruit",
      count: 0,
    });
    const nextWord = storedState(context).board.find(
      (card) => card.team === team && !card.revealed,
    )!.word;
    await command(game, turnSocket(context, "operative"), {
      type: "revealWord",
      word: nextWord,
    });
    expect(storedHistory(context).rounds[0].events.at(-1)).toMatchObject({
      type: "guess",
      team,
      spymaster: {
        id: replacementSpy.attachment!.playerId,
        name: "Replacement clue giver",
        animal: "🐼",
      },
    });
  });

  it("snapshots each clue's profile while grouping future clues by the same stable player id", async () => {
    const { game, context } = await startSession();
    const spy = turnSocket(context, "spymaster");
    const team = storedState(context).turn!.team;
    const playerId = spy.attachment!.playerId;
    await command(game, spy, {
      type: "setProfile",
      name: "First name",
      animal: "🐧",
    });
    await command(game, spy, { type: "giveHint", hint: "fruit", count: 0 });
    await command(game, spy, {
      type: "setProfile",
      name: "New name",
      animal: "🦉",
    });
    const word = storedState(context).board.find(
      (card) => card.team === team,
    )!.word;
    await command(game, turnSocket(context, "operative"), {
      type: "revealWord",
      word,
    });
    const firstEvents = storedHistory(context).rounds[0].events;
    for (const event of firstEvents)
      expect(event.spymaster).toEqual({
        id: playerId,
        name: "First name",
        animal: "🐧",
      });
    const resumed = await create(context);
    await command(resumed.game, spy, { type: "endTurn" });
    await command(resumed.game, turnSocket(context, "spymaster"), {
      type: "endTurn",
    });
    await command(resumed.game, spy, {
      type: "giveHint",
      hint: "new clue",
      count: 0,
    });
    expect(storedHistory(context).rounds[0].events.at(-1)?.spymaster).toEqual({
      id: playerId,
      name: "New name",
      animal: "🦉",
    });
    expect(storedHistory(context).rounds[0].events[0].spymaster).toEqual({
      id: playerId,
      name: "First name",
      animal: "🐧",
    });
  });

  it("does not invent player attribution for older history events without clue-giver identities", async () => {
    const context = new FakeContext();
    const state = playingState();
    const history: SessionHistory = {
      rounds: [
        {
          id: "legacy-round",
          startedAt: Date.now(),
          status: "active",
          wordPack: "classic",
          teamCount: 2,
          players: state.players,
          events: [
            {
              type: "hint",
              timestamp: Date.now(),
              team: 0,
              hint: "fruit",
              count: 2,
            },
          ],
        },
      ],
    };
    await context.storage.put({
      gameState: JSON.stringify(state),
      sessionHistory: history,
    });
    const { game } = await create(context);
    const agent = await connect(game, context, id(2));
    await command(game, agent, { type: "revealWord", word: "apple" });
    expect(storedHistory(context).rounds[0].events.at(-1)).toMatchObject({
      type: "guess",
      team: 0,
      outcome: "correct",
    });
    expect(
      storedHistory(context).rounds[0].events.at(-1)?.spymaster,
    ).toBeUndefined();
  });

  it.each([
    { hint: "different", count: 2 },
    { hint: "fruit", count: 1 },
  ])(
    "does not attribute a guess to an older hint that differs from the active clue: %s",
    async (clue) => {
      const context = new FakeContext();
      const state = playingState();
      const history: SessionHistory = {
        rounds: [
          {
            id: "mismatched-clue",
            startedAt: Date.now(),
            status: "active",
            wordPack: "classic",
            teamCount: 2,
            players: state.players,
            events: [
              {
                type: "hint",
                timestamp: Date.now(),
                team: 0,
                ...clue,
                spymaster: { id: pid(1), name: "Older spy" },
              },
            ],
          },
        ],
      };
      await context.storage.put({
        gameState: JSON.stringify(state),
        sessionHistory: history,
      });
      const { game } = await create(context);
      const agent = await connect(game, context, id(2));
      await command(game, agent, { type: "revealWord", word: "apple" });
      expect(
        storedHistory(context).rounds[0].events.at(-1)?.spymaster,
      ).toBeUndefined();
    },
  );

  it("aborts once after all players' reconnect grace expires", async () => {
    const { game, context } = await startSession();
    for (const socket of context.sockets)
      await game.webSocketClose(socket as unknown as WebSocket, 1000, "", true);
    expect(storedHistory(context).rounds[0].status).toBe("active");
    vi.advanceTimersByTime(60_001);
    await game.alarm();
    const aborted = storedHistory(context).rounds[0];
    expect(aborted).toMatchObject({ status: "aborted", endedAt: Date.now() });
    expect(aborted.result).toBeUndefined();
    vi.advanceTimersByTime(1_000);
    await game.alarm();
    await create(context);
    expect(storedHistory(context).rounds[0]).toEqual(aborted);
  });

  it("retains at most 50 recent rounds and 200 recent events per round", async () => {
    const context = new FakeContext();
    const state = playingState();
    state.turn = undefined;
    state.board = [];
    const history: SessionHistory = {
      rounds: Array.from({ length: 50 }, (_, number) => ({
        id: `round-${number}`,
        startedAt: Date.now() - 2_000,
        endedAt: Date.now() - 1_000,
        status: "aborted",
        wordPack: "classic",
        teamCount: 2,
        players: state.players,
        events: [],
      })),
    };
    await context.storage.put({
      gameState: JSON.stringify(state),
      sessionHistory: history,
    });
    const { game } = await create(context);
    const agent = await connect(game, context, id(2));
    for (const number of [1, 3, 4]) await connect(game, context, id(number));
    expect(storedHistory(context).awardSeed).toBe("round-0");
    await command(game, agent, { type: "startGame" });
    const capped = storedHistory(context);
    expect(capped.rounds).toHaveLength(50);
    expect(capped.rounds[0].id).toBe("round-1");
    expect(capped.awardSeed).toBe("round-0");
    capped.rounds.at(-1)!.events = Array.from({ length: 199 }, (_, number) => ({
      type: "hint",
      timestamp: Date.now() - 1_000,
      team: 0,
      hint: `old-${number}`,
      count: 0,
    }));
    await context.storage.put({ sessionHistory: capped });
    const resumed = await create(context);
    const activeAgent = turnSocket(context, "operative");
    const ownWord = storedState(context).board.find(
      (card) => card.team === storedState(context).turn?.team,
    )!.word;
    await command(resumed.game, turnSocket(context, "spymaster"), {
      type: "giveHint",
      hint: "latest",
      count: 0,
    });
    await command(resumed.game, activeAgent, {
      type: "revealWord",
      word: ownWord,
    });
    const events = storedHistory(context).rounds.at(-1)!.events;
    expect(events).toHaveLength(200);
    expect(events[0]).toMatchObject({ hint: "old-1" });
    expect(events.at(-2)).toMatchObject({ type: "hint", hint: "latest" });
    expect(events.at(-1)).toMatchObject({
      type: "guess",
      word: ownWord,
      outcome: "correct",
    });
    expect(storedHistory(context).awardSeed).toBe("round-0");
    expect(sessionHistorySchema.safeParse(storedHistory(context)).success).toBe(
      true,
    );
  });

  it("deletes the persisted and in-memory history at room expiry", async () => {
    const { game, context } = await startSession();
    const oldSeed = storedHistory(context).awardSeed;
    expect(storedHistory(context).rounds).toHaveLength(1);
    for (const socket of context.sockets)
      await game.webSocketClose(socket as unknown as WebSocket, 1000, "", true);
    vi.advanceTimersByTime(14 * 24 * 60 * 60 * 1_000 + 1);
    await game.alarm();
    expect(context.storage.values.size).toBe(0);
    expect(context.storage.values.has("sessionHistory")).toBe(false);
    const newcomer = await connect(game, context, id(7));
    expect(newcomer.latest().sessionHistory).toEqual({
      rounds: [],
      awardSeed: expect.any(String),
    });
    expect(storedHistory(context)).toEqual(newcomer.latest().sessionHistory);
    expect(storedHistory(context).awardSeed).not.toBe(oldSeed);
  });

  it("preserves one room's award seed through rematches, hibernation, and rejoins", async () => {
    const { game, context } = await startSession();
    const seed = storedHistory(context).awardSeed;
    expect(seed).toMatch(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
    await command(game, context.sockets[0], { type: "endGame" });
    await command(game, context.sockets[0], { type: "startGame" });
    expect(storedHistory(context).awardSeed).toBe(seed);
    const resumed = await create(context);
    expect(storedHistory(context).awardSeed).toBe(seed);
    for (const socket of context.sockets)
      await resumed.game.webSocketClose(
        socket as unknown as WebSocket,
        1000,
        "",
        true,
      );
    vi.advanceTimersByTime(60_001);
    await resumed.game.alarm();
    const rejoined = await connect(resumed.game, context, id(1));
    expect(rejoined.latest().sessionHistory?.awardSeed).toBe(seed);
    const otherRoom = await create();
    await connect(otherRoom.game, otherRoom.context, id(1));
    expect(storedHistory(otherRoom.context).awardSeed).not.toBe(seed);
  });

  it("keeps Unicode-heavy histories below the legacy Durable Object value-size limit", async () => {
    const context = new FakeContext();
    const state = playingState();
    state.turn = undefined;
    state.board = [];
    const history: SessionHistory = {
      rounds: Array.from({ length: 50 }, (_, number) => ({
        id: `round-${number}`,
        startedAt: Date.now() - 2_000,
        endedAt: Date.now() - 1_000,
        status: "aborted",
        wordPack: "classic",
        teamCount: 2,
        players: state.players,
        events: Array.from({ length: 200 }, () => ({
          type: "hint",
          timestamp: Date.now(),
          team: 0,
          hint: "🍎".repeat(50),
          count: 0,
        })),
      })),
    };
    await context.storage.put({
      gameState: JSON.stringify(state),
      sessionHistory: history,
    });
    const { game } = await create(context);
    const recent = storedHistory(context);
    expect(recent.rounds.length).toBeLessThan(50);
    expect(recent.rounds.at(-1)!.id).toBe("round-49");
    expect(recent.awardSeed).toBe("round-0");
    expect(
      new TextEncoder().encode(JSON.stringify(recent)).byteLength,
    ).toBeLessThanOrEqual(96 * 1024);
    const agent = await connect(game, context, id(2));
    await command(game, agent, { type: "startGame" });
    expect(storedHistory(context).rounds.at(-1)!.status).toBe("active");
    expect(storedHistory(context).awardSeed).toBe("round-0");
    expect(
      new TextEncoder().encode(JSON.stringify(storedHistory(context)))
        .byteLength,
    ).toBeLessThanOrEqual(96 * 1024);
  });

  it("preserves an active round with an explicitly marked partial roster if its snapshot alone exceeds the budget", async () => {
    const context = new FakeContext();
    const state = playingState();
    const players = Array.from({ length: 1_000 }, (_, number) => ({
      id: id(number),
      name: "🐼".repeat(25),
      team: number % 2,
      role: "operative" as const,
    }));
    const history: SessionHistory = {
      rounds: [
        {
          id: "oversized-active",
          startedAt: Date.now(),
          status: "active",
          wordPack: "classic",
          teamCount: 2,
          players,
          events: [],
        },
      ],
    };
    await context.storage.put({
      gameState: JSON.stringify(state),
      sessionHistory: history,
    });
    await create(context);
    const round = storedHistory(context).rounds[0];
    expect(round).toMatchObject({ id: "oversized-active", status: "active" });
    expect(round.playersOmitted).toBeGreaterThan(0);
    expect(round.players.length + round.playersOmitted!).toBe(1_000);
    expect(
      new TextEncoder().encode(JSON.stringify(storedHistory(context)))
        .byteLength,
    ).toBeLessThanOrEqual(96 * 1024);
  });
});
