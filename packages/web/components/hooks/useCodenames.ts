import {
  Animal,
  Command,
  gameEventSchema,
  GameStateForClient,
  SharedEffect,
  WordPackId,
} from "schema";
import useGameSession from "./useGameSession";
import { useEffect, useRef, useState } from "react";
import { saveProfile } from "./playerProfile";

const useCodenames = (skip = false) => {
  const [gameState, setGameState] = useState<GameStateForClient>();
  const [gameWon, setGameWon] = useState(false);
  const [effects, setEffects] = useState<SharedEffect[]>([]);
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
    setGameWon(false);
    setEffects([]);
    setCommandError(undefined);
  }, [connection.sessionName]);

  useEffect(() => {
    const newEffects: SharedEffect[] = [];
    for (const message of connection.incomingMessages) {
      let parsed;
      try {
        parsed = gameEventSchema.safeParse(JSON.parse(message));
      } catch {
        continue;
      }
      if (!parsed.success) continue;
      if (parsed.data.type === "commandRejected") {
        setCommandError(parsed.data.reason);
        continue;
      }
      const state = parsed.data.gameState;
      const previous = previousRef.current;
      if (!state.gameResult) setGameWon(false);
      else if (
        state.gameResult.winningTeam !== undefined &&
        previous &&
        !previous.gameResult
      )
        setGameWon(true);
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
      previousRef.current = state;
      setGameState(state);
      setCommandError(undefined);
    }
    if (newEffects.length) setEffects(newEffects);
  }, [connection.incomingMessages]);

  const sendCommand = (command: Command) => {
    if (!connection.sendMessage(JSON.stringify(command))) {
      setCommandError("Reconnecting — please wait, then try again.");
      return false;
    }
    setCommandError(undefined);
    return true;
  };

  return {
    ...connection,
    commandError,
    effects,
    players: gameState?.players ?? [],
    board: gameState?.board,
    turn: gameState?.turn,
    hintHistory: gameState?.hintHistory ?? [],
    remainingWordsByTeam: gameState?.remainingWordsByTeam ?? [],
    gameResult: gameState?.gameResult,
    sessionHistory: gameState?.sessionHistory,
    gameCanBeStarted: gameState?.gameCanStart ?? false,
    currentPlayerId: gameState?.playerId ?? "",
    gameWon,
    wordPack: (gameState?.wordPack ?? "classic") as WordPackId,
    customWords: gameState?.customWords,
    teamCount: gameState?.teamCount ?? 2,
    setProfile: (name: string, animal: Animal) =>
      sendCommand({ type: "setProfile", name, animal }),
    setName: (name: string) => sendCommand({ type: "setName", name }),
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
    endTurn: () => sendCommand({ type: "endTurn" }),
    endGame: () => sendCommand({ type: "endGame" }),
  };
};
export default useCodenames;
