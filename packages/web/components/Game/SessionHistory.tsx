import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type {
  SessionEvent,
  SessionHistory as History,
  SessionRound,
  HistoryAward,
} from "schema";
import { calculateHistoryStats } from "schema";
import { getTeamColor, getTeamName } from "./Board/getTeamColor";

const EMPTY_ROUNDS: SessionRound[] = [];

const OUTCOMES = {
  correct: { label: "Correct", icon: "✓", color: "text-emerald-300" },
  opponent: { label: "Other team's word", icon: "↗", color: "text-amber-300" },
  neutral: { label: "Neutral", icon: "—", color: "text-purple-300" },
  assassin: { label: "Assassin", icon: "☠", color: "text-red-300" },
};

function duration(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function resultLabel(round: SessionRound) {
  if (round.status === "active") return "Active round";
  if (round.status === "aborted") return "Aborted round";
  if (round.result?.winningTeam !== undefined)
    return `${getTeamName(round.result.winningTeam)} wins`;
  if (round.result?.losingTeam !== undefined)
    return `${getTeamName(round.result.losingTeam)} loses`;
  return "Completed round";
}

function RoundEvent({
  event,
  startedAt,
}: {
  event: SessionEvent;
  startedAt: number;
}) {
  const team = getTeamName(event.team);
  const outcome = event.type === "guess" ? OUTCOMES[event.outcome] : undefined;
  return (
    <li className="flex min-w-0 items-start gap-3 border-l border-purple-700/50 py-2 pl-4">
      <span className="mt-0.5 w-10 shrink-0 font-mono text-[0.65rem] tabular-nums text-purple-400">
        +{duration(event.timestamp - startedAt)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-purple-400">
          Team {team}
        </p>
        {event.type === "hint" ? (
          <p className="break-words text-sm text-white">
            <span className="mr-1 text-purple-300" aria-hidden="true">
              💬
            </span>
            Clue <span className="font-bold">{event.hint}</span>{" "}
            <span className="text-purple-300">({event.count})</span>
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="min-w-0 font-semibold text-white [overflow-wrap:anywhere]">
              {event.word}
            </span>
            <span className={`text-xs ${outcome!.color}`}>
              <span aria-hidden="true">{outcome!.icon} </span>
              {outcome!.label}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

function Round({ round, now }: { round: SessionRound; now: number }) {
  const [open, setOpen] = useState(round.status === "active");
  const guesses = round.events.filter((event) => event.type === "guess");
  const correct = guesses.filter((event) => event.outcome === "correct").length;
  const elapsed = duration((round.endedAt ?? now) - round.startedAt);
  const statusColor =
    round.status === "active"
      ? "text-emerald-300"
      : round.status === "aborted"
        ? "text-purple-400"
        : "text-amber-300";
  return (
    <details
      className="group/round min-w-0 rounded-xl border border-purple-700/25 bg-elevated/40"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer rounded-xl px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
        <span className="ml-1 inline-flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-3 gap-y-1 align-middle">
          <span className={`text-sm font-bold ${statusColor}`}>
            {resultLabel(round)}
          </span>
          <span className="text-xs tabular-nums text-purple-300">
            {elapsed}
            {round.status === "active" ? " elapsed" : ""}
          </span>
          <span className="text-xs text-purple-400">
            {guesses.length} guess{guesses.length === 1 ? "" : "es"} · {correct}{" "}
            correct
          </span>
        </span>
      </summary>
      {open && (
        <div className="border-t border-purple-700/25 px-4 pb-4 pt-3">
          <p className="text-xs text-purple-400">
            {new Date(round.startedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            ·{" "}
            {round.wordPackName ??
              round.wordPack.charAt(0).toUpperCase() +
                round.wordPack.slice(1)}{" "}
            pack · {round.teamCount} teams
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {round.players.map((player) => {
              const color = getTeamColor(player.team);
              return (
                <span
                  key={player.id}
                  title={`Team ${getTeamName(player.team)} · ${player.role}`}
                  className={`max-w-full truncate rounded-full bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} px-2.5 py-1 text-[0.65rem] text-white`}
                >
                  <span aria-hidden="true">{player.animal ?? "🐾"} </span>
                  {player.name}
                  {player.role === "spymaster" && " · 🕵️"}
                </span>
              );
            })}
            {!!round.playersOmitted && (
              <span className="rounded-full bg-surface px-2.5 py-1 text-[0.65rem] text-purple-400">
                +{round.playersOmitted} players omitted
              </span>
            )}
          </div>
          {round.events.length ? (
            <ul
              aria-label="Round events"
              className="mt-4 max-h-80 overflow-y-auto overscroll-contain"
            >
              {round.events.map((event, index) => (
                <RoundEvent
                  key={`${event.timestamp}-${index}`}
                  event={event}
                  startedAt={round.startedAt}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-purple-400">
              The first clue will start this round&apos;s story.
            </p>
          )}
        </div>
      )}
    </details>
  );
}

const AWARD_STYLES = [
  "from-purple-800/50 to-fuchsia-950/40 border-fuchsia-500/25",
  "from-emerald-900/40 to-purple-950/40 border-emerald-500/25",
  "from-indigo-800/40 to-purple-950/40 border-indigo-400/25",
  "from-orange-900/40 to-purple-950/40 border-amber-500/25",
  "from-fuchsia-900/40 to-purple-950/40 border-pink-500/25",
  "from-amber-900/40 to-purple-950/40 border-amber-400/25",
];

function Award({ award, index }: { award: HistoryAward; index: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article
      aria-label={award.title}
      data-award={award.id}
      className={`min-w-0 rounded-2xl border bg-gradient-to-br p-4 ${AWARD_STYLES[index % AWARD_STYLES.length]}`}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{
        type: "spring",
        stiffness: 250,
        damping: 26,
        delay: reduceMotion ? 0 : index * 0.035,
      }}
    >
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="text-3xl">
          {award.emoji}
        </span>
        <h4 className="text-sm font-extrabold text-white">{award.title}</h4>
      </div>
      <p className="mt-2 text-[0.65rem] leading-relaxed text-purple-300">
        {award.description}
      </p>
      <motion.p
        key={award.valueLabel}
        className="my-3 text-xl font-black text-white"
        initial={reduceMotion ? false : { opacity: 0.4, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.25 }}
      >
        {award.valueLabel}
      </motion.p>
      <div className="flex flex-wrap gap-1.5">
        {award.winners.map((winner) => {
          const color =
            winner.kind === "team" ? getTeamColor(winner.team) : undefined;
          return (
            <span
              key={winner.kind === "team" ? `team-${winner.team}` : winner.id}
              className={`max-w-full rounded-full px-2.5 py-1 text-xs font-semibold text-white ${color ? `bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo}` : "bg-purple-950/50"}`}
            >
              {winner.kind === "team" ? (
                `Team ${getTeamName(winner.team)}`
              ) : (
                <>
                  <span aria-hidden="true">{winner.animal ?? "🐾"} </span>
                  <span className="[overflow-wrap:anywhere]">
                    {winner.name}
                  </span>
                </>
              )}
            </span>
          );
        })}
      </div>
      {award.winners.length > 1 && (
        <p className="mt-2 text-[0.6rem] font-semibold text-amber-300">
          Shared award · tied for the lead
        </p>
      )}
      <p className="mt-2 text-[0.6rem] leading-relaxed text-purple-400">
        {award.context}
      </p>
    </motion.article>
  );
}

export default function SessionHistory({ history }: { history?: History }) {
  const rounds = history?.rounds ?? EMPTY_ROUNDS;
  const [open, setOpen] = useState(false);
  const hasActiveRound = rounds.some((round) => round.status === "active");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!hasActiveRound || !open) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasActiveRound, open]);
  const stats = useMemo(
    () => calculateHistoryStats(rounds, history?.awardSeed),
    [rounds, history?.awardSeed],
  );
  const {
    completedCount,
    totalGuesses,
    correctGuesses,
    accuracy,
    averageCompletedDuration: average,
    teamWins: teams,
    awards,
  } = stats;
  const maxWins = Math.max(1, ...teams.map((team) => team.wins));

  return (
    <details
      aria-label="Room history"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="w-full min-w-0 rounded-2xl border border-purple-700/35 bg-surface/70"
    >
      <summary className="cursor-pointer rounded-2xl px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:px-5">
        <span className="ml-1 inline-flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-3 gap-y-1 align-middle">
          <span className="text-base font-bold text-white">
            <span aria-hidden="true">📜 </span>Room history
          </span>
          <span className="text-xs text-purple-300">
            {rounds.length
              ? `${completedCount} completed${hasActiveRound ? " · Round in progress" : ""}`
              : "Your room's story starts here"}
          </span>
        </span>
      </summary>
      {open && (
        <div className="flex min-w-0 flex-col gap-5 border-t border-purple-700/25 px-4 pb-5 pt-4 sm:px-5">
          <p className="text-xs leading-relaxed text-purple-400">
            History stays with this room and expires after two weeks with nobody
            connected. Up to 50 recent rounds and 200 recorded events per round.
            Guess stats include active and aborted rounds; completed round
            duration is elapsed time from start to finish.
          </p>
          {rounds.length === 0 ? (
            <div className="rounded-xl bg-elevated/40 px-4 py-6 text-center">
              <p className="font-semibold text-purple-200">No rounds yet</p>
              <p className="mt-1 text-sm text-purple-400">
                Start a game to collect clues, guesses and results here.
                Everyone in the room shares this history.
              </p>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    label: "Rounds completed",
                    value: completedCount,
                    note: "Aborted rounds excluded",
                  },
                  {
                    label: "Total guesses",
                    value: totalGuesses,
                    note: `${correctGuesses} correct guesses`,
                  },
                  {
                    label: "Guess accuracy",
                    value: accuracy === undefined ? "—" : `${accuracy}%`,
                    note: "All rounds, including aborted",
                  },
                  {
                    label: "Avg. completed round",
                    value: average === undefined ? "—" : duration(average),
                    note: "Completed rounds only",
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="min-w-0 rounded-xl bg-elevated/60 p-3"
                  >
                    <dt className="text-[0.65rem] font-semibold text-purple-300">
                      {metric.label}
                    </dt>
                    <dd
                      aria-label={metric.label}
                      className="mt-1 text-2xl font-black tabular-nums text-white"
                    >
                      {metric.value}
                    </dd>
                    <p className="mt-1 text-[0.6rem] text-purple-400">
                      {metric.note}
                    </p>
                  </div>
                ))}
              </dl>
              <section aria-label="Room awards">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
                  <h3 className="text-sm font-bold text-white">
                    ✨ Room awards
                  </h3>
                  <span className="text-[0.65rem] text-purple-400">
                    Spymaster magic. Team spirit.
                  </span>
                </div>
                {awards.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {awards.map((award, index) => (
                      <Award key={award.id} award={award} index={index} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-elevated/40 px-4 py-3 text-sm text-purple-400">
                    Awards appear when your clues and guesses create standout
                    moments.
                  </p>
                )}
              </section>
              <section
                aria-label="Team wins"
                className="rounded-xl bg-elevated/40 p-4"
              >
                <h3 className="text-xs font-bold text-purple-200">Team wins</h3>
                <div className="mt-3 flex flex-col gap-2.5">
                  {teams.map(({ team, wins }) => {
                    const color = getTeamColor(team);
                    return (
                      <div
                        key={team}
                        className="flex items-center gap-3 text-xs"
                      >
                        <span className="w-16 shrink-0 text-purple-200">
                          {getTeamName(team)}
                        </span>
                        <div
                          aria-hidden="true"
                          className="h-2 flex-1 overflow-hidden rounded-full bg-purple-950/70"
                        >
                          <div
                            style={{ width: `${(wins / maxWins) * 100}%` }}
                            className={`h-full rounded-full bg-gradient-to-r ${color.badgeFrom} ${color.badgeTo}`}
                          />
                        </div>
                        <span
                          aria-label={`${getTeamName(team)} wins`}
                          className="w-5 shrink-0 text-right font-bold tabular-nums text-white"
                        >
                          {wins}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[0.65rem] text-purple-400">
                  Only recorded winners count. Assassin losses are shown in the
                  round timeline.
                </p>
              </section>
              <section aria-label="Recent rounds">
                <h3 className="mb-3 text-xs font-bold text-purple-200">
                  Recent rounds{" "}
                  <span className="font-normal text-purple-400">
                    · newest first
                  </span>
                </h3>
                <div className="flex flex-col gap-2">
                  {[...rounds].reverse().map((round) => (
                    <Round key={round.id} round={round} now={now} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </details>
  );
}
