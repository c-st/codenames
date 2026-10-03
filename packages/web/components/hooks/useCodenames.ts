import {
  Animal,
  Command,
  gameEventSchema,
  GameStateForClient,
  ReactionEmoji,
  SharedEffect,
  WordPackId,
} from "schema";
import useGameSession from "./useGameSession";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveProfile } from "./playerProfile";

export type Reaction = {
  id: string;
  playerId: string;
  emoji: ReactionEmoji;
  expiresAt: number;
};
/** How this browser's player should feel about a result that just happened. */
export type Celebration = "win" | "lose";

const REACTION_LIFETIME_MS = 2600;
const TYPING_LIFETIME_MS = 5000;

/** Re-renders when the earliest deadline passes, dropping expired entries. */
function useExpiry<T>(
  items: T[],
  expiresAt: (item: T) => number,
  setItems: (update: (items: T[]) => T[]) => void,
) {
  useEffect(() => {
    if (!items.length) return;
    const next = Math.min(...items.map(expiresAt));
    const timer = setTimeout(
      () => {
        const now = Date.now();
        setItems((current) => current.filter((item) => expiresAt(item) > now));
      },
      Math.max(16, next - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [items, expiresAt, setItems]);
}

const reactionExpiry = (reaction: Reaction) => reaction.expiresAt;
const typingExpiry = ([, until]: [string, number]) => until;

const useCodenames = (skip = false) => {
  const [gameState, setGameState] = useState<GameStateForClient>();
  const [celebration, setCelebration] = useState<Celebration>();
  const [effects, setEffects] = useState<SharedEffect[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [typing, setTypingEntries] = useState<[string, number][]>([]);
  const [commandError, setCommandError] = useState<string>();
  const previousRef = useRef<GameStateForClient | undefined>(undefined);
  const seenEffectsRef = useRef(new Set<string>());
  const connection = useGameSession(
    process.env.NEXT_PUBLIC_API_URL ??
      (process.env.NODE_ENV === "development"
        ? "ws://localhost:8787"
        : "wss://api.codenam.es"),
    skip,
  );

  useEffect(() => {
    previousRef.current = undefined;
    seenEffectsRef.current.clear();
    setGameState(undefined);
    setCelebration(undefined);
    setEffects([]);
    setReactions([]);
    setTypingEntries([]);
    setCommandError(undefined);
  }, [connection.sessionName]);

  useExpiry(reactions, reactionExpiry, setReactions);
  useExpiry(typing, typingExpiry, setTypingEntries);

  useEffect(() => {
    const newEffects: SharedEffect[] = [];
    const newReactions: Reaction[] = [];
    for (const message of connection.incomingMessages) {
      let parsed;
      try {
        parsed = gameEventSchema.safeParse(JSON.parse(message));
      } catch {
        continue;
      }
      if (!parsed.success) continue;
      const event = parsed.data;
      if (event.type === "commandRejected") {
        setCommandError(event.reason);
        continue;
      }
      if (event.type === "reaction") {
        newReactions.push({
          id: event.id,
          playerId: event.playerId,
          emoji: event.emoji,
          expiresAt: Date.now() + REACTION_LIFETIME_MS,
        });
        continue;
      }
      if (event.type === "typing") {
        setTypingEntries((current) => [
          ...current.filter(([id]) => id !== event.playerId),
          ...(event.typing
            ? [
                [event.playerId, Date.now() + TYPING_LIFETIME_MS] as [
                  string,
                  number,
                ],
              ]
            : []),
        ]);
        continue;
      }
      const state = event.gameState;
      const previous = previousRef.current;
      if (!state.gameResult) setCelebration(undefined);
      else if (previous && !previous.gameResult) {
        // Only a result that happens while watching celebrates; reconnecting to a finished game stays calm.
        const me = state.players.find((p) => p.id === state.playerId);
        const { winningTeam, losingTeam } = state.gameResult;
        const won =
          winningTeam !== undefined
            ? me?.team === winningTeam
            : me?.team !== losingTeam;
        setCelebration(won ? "win" : "lose");
      }
      const player = state.players.find((p) => p.id === state.playerId);
      if (player)
        saveProfile({ name: player.name, animal: player.animal ?? "🦊" });
      for (const effect of state.effects ?? []) {
        if (!seenEffectsRef.current.has(effect.id)) {
          seenEffectsRef.current.add(effect.id);
          newEffects.push(effect);
        }
      }
      if (seenEffectsRef.current.size > 1000) {
        seenEffectsRef.current = new Set(
          Array.from(seenEffectsRef.current).slice(-500),
        );
      }
      // A clue ends the spymaster's typing for everyone.
      if (state.turn?.hint) setTypingEntries([]);
      previousRef.current = state;
      setGameState(state);
      setCommandError(undefined);
    }
    if (newEffects.length) setEffects(newEffects);
    if (newReactions.length)
      setReactions((current) => [...current, ...newReactions].slice(-30));
  }, [connection.incomingMessages]);

  const { sendMessage } = connection;
  const sendCommand = (command: Command) => {
    if (!sendMessage(JSON.stringify(command))) {
      setCommandError("Reconnecting — please wait, then try again.");
      return false;
    }
    setCommandError(undefined);
    return true;
  };
  // Ephemeral signals fail silently: there's nothing useful to retry.
  const react = useCallback(
    (emoji: ReactionEmoji) => {
      sendMessage(JSON.stringify({ type: "react", emoji }));
    },
    [sendMessage],
  );
  const setTyping = useCallback(
    (typing: boolean) => {
      sendMessage(JSON.stringify({ type: "typing", typing }));
    },
    [sendMessage],
  );

  return {
    ...connection,
    commandError,
    effects,
    reactions,
    typingPlayerIds: typing.map(([id]) => id),
    players: gameState?.players ?? [],
    board: gameState?.board,
    turn: gameState?.turn,
    hintHistory: gameState?.hintHistory ?? [],
    remainingWordsByTeam: gameState?.remainingWordsByTeam ?? [],
    gameResult: gameState?.gameResult,
    gameCanBeStarted: gameState?.gameCanStart ?? false,
    currentPlayerId: gameState?.playerId ?? "",
    celebration,
    marks: gameState?.marks ?? [],
    turnSeconds: gameState?.turnSeconds ?? 120,
    wordPack: (gameState?.wordPack ?? "classic") as WordPackId,
    customWords: gameState?.customWords,
    teamCount: gameState?.teamCount ?? 2,
    setProfile: (name: string, animal: Animal) =>
      sendCommand({ type: "setProfile", name, animal }),
    randomizeName: () => sendCommand({ type: "randomizeName" }),
    shuffleTeams: () => sendCommand({ type: "shuffleTeams" }),
    promoteToSpymaster: (playerId: string) =>
      sendCommand({ type: "promoteToSpymaster", playerId }),
    startGame: () => sendCommand({ type: "startGame" }),
    setWordPack: (wordPack: WordPackId) =>
      sendCommand({ type: "setWordPack", wordPack }),
    setCustomWords: (words: string[]) =>
      sendCommand({ type: "setCustomWords", words }),
    setTeamCount: (teamCount: number) =>
      sendCommand({ type: "setTeamCount", teamCount }),
    giveHint: (hint: string, count: number) =>
      sendCommand({ type: "giveHint", hint, count }),
    revealWord: (word: string) => sendCommand({ type: "revealWord", word }),
    markCard: (word: string) => sendCommand({ type: "markCard", word }),
    endTurn: () => sendCommand({ type: "endTurn" }),
    endGame: () => sendCommand({ type: "endGame" }),
    react,
    setTyping,
  };
};
export default useCodenames;
