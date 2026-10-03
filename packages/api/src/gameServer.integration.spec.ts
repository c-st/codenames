import { CodenamesGame } from "./gameServer";
import { publicPlayerId } from "./identity";
import type { GameState, GameStateForClient } from "schema";

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
const create = async (context = new FakeContext()) => {
  const game = new CodenamesGame(
    context as unknown as DurableObjectState,
    {} as never,
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
            `https://game.test/room?playerId=${id(index + 1)}&name=Player${index + 1}`,
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
      expect(effects).toEqual([
        { id: expect.any(String), type, playAt: Date.now() + 300 },
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
        playAt: Date.now() + 300,
      },
      { id: expect.any(String), type: "gameWin", playAt: Date.now() + 750 },
    ]);
    expect(spy.latest().effects).toEqual(agent.latest().effects);
    expect(agent.latest().gameResult).toMatchObject({ winningTeam: 0 });
    expect(
      agent.latest().board.find((card) => card.word === "bomb")?.isAssassin,
    ).toBe(true);
    expect(context.storage.alarm).toBe(Date.now() + 60_000); // Unconnected players still receive reconnect grace.
  });
});
