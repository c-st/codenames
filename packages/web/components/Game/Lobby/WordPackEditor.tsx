import { useEffect, useId, useMemo, useState } from "react";
import { motion } from "motion/react";
import { customWordsSchema, type RoomWordPack } from "schema";
import type { WordPackSaveResult } from "@/components/hooks/useCodenames";

type Draft = {
  name: string;
  text: string;
  baseRevision: number;
  baseName: string;
  baseText: string;
};
type Save = (
  packId: string,
  name: string,
  words: string[],
  expectedRevision: number,
  requestId: string,
) => boolean;

function parseWords(text: string) {
  const entries = text
    .split(/[\n,]+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const words = entries.filter((word) => {
    const key = word.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { words, duplicates: entries.length - words.length };
}

function fromPack(pack?: RoomWordPack): Draft {
  const text = pack?.words.join("\n") ?? "";
  return {
    name: pack?.name ?? "",
    text,
    baseName: pack?.name ?? "",
    baseText: text,
    baseRevision: pack?.revision ?? 0,
  };
}

function readDraft(key: string, pack?: RoomWordPack): Draft {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      value &&
      ["name", "text", "baseName", "baseText"].every(
        (field) => typeof value[field] === "string",
      ) &&
      Number.isSafeInteger(value.baseRevision) &&
      value.baseRevision >= 0 &&
      value.text.length <= 260000 &&
      value.baseText.length <= 260000
    )
      return value;
  } catch {
    /* A missing or corrupt local draft starts from the room copy. */
  }
  return fromPack(pack);
}

export default function WordPackEditor({
  packs,
  selectedPackId,
  onSave,
  saveResult,
  roomId = "default",
  isConnected,
}: {
  packs: RoomWordPack[];
  selectedPackId: string;
  onSave: Save;
  saveResult?: WordPackSaveResult;
  roomId?: string;
  isConnected: boolean;
}) {
  const [editingId, setEditingId] = useState(selectedPackId);
  const [open, setOpen] = useState(false);
  const selectedKey = `codenames:pack-editor:${roomId}`;
  useEffect(() => {
    try {
      const previous = localStorage.getItem(selectedKey);
      if (previous && /^[a-z0-9][a-z0-9-]{0,63}$/.test(previous))
        setEditingId(previous);
      else setEditingId(selectedPackId);
    } catch {
      setEditingId(selectedPackId);
    }
    // A room switch restores that room's editor; selection elsewhere never replaces edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);
  const edit = (id: string) => {
    setEditingId(id);
    try {
      localStorage.setItem(selectedKey, id);
    } catch {
      /* Draft form reports unavailable storage. */
    }
  };
  const isNew = !packs.some((pack) => pack.id === editingId);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="glass-panel min-w-0 !rounded-2xl p-4 sm:p-5"
    >
      <summary className="cursor-pointer rounded-lg text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-surface">
        ✏️ Edit room word packs
      </summary>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="mt-4 flex min-w-0 flex-col gap-4"
        >
          <p className="text-sm text-purple-300">
            Edit any room pack or add your own. Saving shares it with everyone;
            choose the pack above when you want to play it.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-purple-300">
              Pack to edit
              <select
                aria-label="Pack to edit"
                value={isNew ? "new" : editingId}
                onChange={(event) =>
                  edit(
                    event.target.value === "new"
                      ? `room-${crypto.randomUUID()}`
                      : event.target.value,
                  )
                }
                className="min-w-0 rounded-xl border border-purple-400/30 bg-base/50 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-accent focus:shadow-[0_0_0_3px_rgba(160,112,224,0.16)]"
              >
                {packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
                <option value="new">New named pack</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => edit(`room-${crypto.randomUUID()}`)}
              className="rounded-xl border border-purple-400/25 bg-elevated px-3 py-2 text-sm font-bold text-purple-100 transition hover:border-purple-400/50 hover:shadow-[0_0_15px_rgba(160,112,224,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Add word pack
            </button>
          </div>
          {packs.length ? (
            <PackForm
              key={`${roomId}:${editingId}`}
              packId={editingId}
              pack={packs.find((pack) => pack.id === editingId)}
              roomId={roomId}
              onSave={onSave}
              saveResult={saveResult}
              isConnected={isConnected}
            />
          ) : (
            <p role="status" className="text-sm text-purple-300">
              Loading the room&apos;s word packs…
            </p>
          )}
        </motion.div>
      )}
    </details>
  );
}

function PackForm({
  packId,
  pack,
  roomId,
  onSave,
  saveResult,
  isConnected,
}: {
  packId: string;
  pack?: RoomWordPack;
  roomId: string;
  onSave: Save;
  saveResult?: WordPackSaveResult;
  isConnected: boolean;
}) {
  const id = useId();
  const key = `codenames:pack-draft:${roomId}:${packId}`;
  const [draft, setDraft] = useState<Draft>(() => readDraft(key, pack));
  const [storageWarning, setStorageWarning] = useState(false);
  const [pending, setPending] = useState<{
    requestId: string;
    name: string;
    words: string[];
  }>();
  const [message, setMessage] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState(false);
  const parsed = useMemo(() => parseWords(draft.text), [draft.text]);
  const validation = customWordsSchema.safeParse(parsed.words);
  const dirty =
    draft.name.trim() !== draft.baseName ||
    JSON.stringify(parsed.words) !==
      JSON.stringify(parseWords(draft.baseText).words);
  const changedElsewhere = !!pack && pack.revision !== draft.baseRevision;

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }, [draft, key]);
  useEffect(() => {
    const matchesLatest =
      !!pack &&
      draft.name.trim() === pack.name &&
      JSON.stringify(parsed.words) === JSON.stringify(pack.words);
    if (
      pack &&
      pack.revision !== draft.baseRevision &&
      (!dirty || matchesLatest) &&
      !pending
    ) {
      setDraft(fromPack(pack));
      setConflict(false);
      setMessage("Following the latest room version.");
      setError(false);
    }
  }, [pack, draft.baseRevision, draft.name, parsed.words, dirty, pending]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setPending(undefined);
      setError(true);
      setMessage(
        "Save confirmation did not arrive. Your draft is safe. Load the latest room version before retrying if it changed.",
      );
    }, 15000);
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    if (
      !pending ||
      saveResult?.requestId !== pending.requestId ||
      saveResult.packId !== packId
    )
      return;
    if (saveResult.type === "wordPackSaved") {
      setDraft((current) => ({
        ...current,
        baseRevision: saveResult.revision,
        baseName: pending.name,
        baseText: pending.words.join("\n"),
      }));
      setConflict(false);
      setError(false);
      setMessage(
        draft.name.trim() !== pending.name ||
          JSON.stringify(parsed.words) !== JSON.stringify(pending.words)
          ? "Saved the submitted version. Your newer edits are still a draft."
          : "Saved in the room. Choose this pack above to play it.",
      );
    } else {
      setError(true);
      setConflict(saveResult.code === "conflict");
      setMessage(saveResult.reason);
    }
    setPending(undefined);
  }, [saveResult, pending, packId, draft.name, parsed.words]);
  useEffect(() => {
    if (!isConnected && pending) {
      setPending(undefined);
      setError(true);
      setMessage(
        "Connection lost before confirmation. Your draft is safe; check the latest room version after reconnecting.",
      );
    }
  }, [isConnected, pending]);

  const update = (change: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setMessage(undefined);
    setError(false);
  };
  const loadLatest = () => {
    if (pack) {
      setDraft(fromPack(pack));
      setConflict(false);
      setMessage("Loaded the latest room version.");
      setError(false);
    }
  };
  const save = () => {
    if (!validation.success || !draft.name.trim() || pending) return;
    const requestId = crypto.randomUUID();
    const submission = {
      requestId,
      name: packId === "classic" ? "Classic" : draft.name.trim(),
      words: validation.data,
    };
    if (
      onSave(
        packId,
        submission.name,
        submission.words,
        draft.baseRevision,
        requestId,
      )
    ) {
      setPending(submission);
      setMessage(undefined);
    } else {
      setError(true);
      setMessage(
        "Reconnecting — your draft is safe. Try saving when connected.",
      );
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <label
        htmlFor={`${id}-name`}
        className="text-xs font-semibold text-purple-300"
      >
        Pack name
      </label>
      <input
        id={`${id}-name`}
        value={draft.name}
        onChange={(event) => update({ name: event.target.value })}
        maxLength={50}
        readOnly={packId === "classic"}
        placeholder="e.g. Family favourites"
        className="min-w-0 rounded-xl border border-purple-400/30 bg-base/50 px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-accent focus:shadow-[0_0_0_3px_rgba(160,112,224,0.16)] read-only:text-purple-300"
      />
      {packId === "classic" && (
        <p className="text-xs text-purple-400">
          Classic stays available under its familiar name. Its words can be
          edited for this room.
        </p>
      )}
      <label
        htmlFor={`${id}-words`}
        className="text-xs font-semibold text-purple-300"
      >
        Your words (up to 50 characters each)
      </label>
      <textarea
        id={`${id}-words`}
        value={draft.text}
        onChange={(event) => update({ text: event.target.value })}
        rows={8}
        maxLength={260000}
        spellCheck={false}
        placeholder={"Moon\nBridge\nTiger\n…"}
        aria-describedby={`${id}-status`}
        className="w-full min-w-0 resize-y rounded-xl border border-purple-400/30 bg-base/50 p-3 text-sm text-white outline-none transition focus:border-accent focus:shadow-[0_0_0_3px_rgba(160,112,224,0.16)]"
      />
      <div
        id={`${id}-status`}
        aria-live="polite"
        className="break-words text-sm text-purple-300"
      >
        <p>
          {parsed.words.length} unique words
          {parsed.duplicates > 0 &&
            ` · ${parsed.duplicates} duplicate${parsed.duplicates === 1 ? "" : "s"} removed automatically`}
        </p>
        {!validation.success && (
          <p className="mt-1 text-amber-300">
            {validation.error.issues[0].message}
          </p>
        )}
        {message && (
          <p
            className={`mt-1 ${error ? "text-amber-300" : "text-emerald-300"}`}
          >
            {message}
          </p>
        )}
        {pending && <p className="mt-1">Saving this pack to the room…</p>}
        {storageWarning && (
          <p className="mt-1 text-amber-300">
            Browser storage is unavailable. Copy your draft before leaving.
          </p>
        )}
      </div>
      {((changedElsewhere && dirty) || conflict) && pack && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
          <p role="alert" className="text-sm text-amber-200">
            This pack changed in the room. Your edits are still here. Load the
            latest copy or review it before keeping your edits.
          </p>
          <details className="mt-3 text-sm text-purple-200">
            <summary className="cursor-pointer font-semibold">
              Review latest room version
            </summary>
            <p className="mt-2 break-words font-bold">{pack.name}</p>
            <textarea
              aria-label="Latest room words"
              readOnly
              value={pack.words.join("\n")}
              rows={6}
              className="mt-2 w-full rounded-lg bg-elevated p-3 text-xs text-white"
            />
            <button
              type="button"
              disabled={!!pending}
              onClick={() => {
                setDraft((current) => ({
                  ...current,
                  baseRevision: pack.revision,
                  baseName: pack.name,
                  baseText: pack.words.join("\n"),
                }));
                setConflict(false);
                setError(false);
                setMessage(
                  "Your edits now use the reviewed room version as their base. Save when ready.",
                );
              }}
              className="mt-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-300/20 disabled:opacity-40"
            >
              Keep my edits on latest version
            </button>
          </details>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={
            !isConnected ||
            !validation.success ||
            !draft.name.trim() ||
            !!pending ||
            conflict
          }
          onClick={save}
          className="sheen rounded-xl bg-gradient-to-br from-primary to-accent px-4 py-2.5 text-sm font-bold text-white shadow-[0_6px_20px_-8px_rgba(160,112,224,0.6)] transition hover:shadow-[0_6px_24px_-6px_rgba(160,112,224,0.8)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save word pack
        </button>
        {pack && (
          <button
            type="button"
            disabled={!!pending}
            onClick={loadLatest}
            className="rounded-xl border border-purple-400/25 bg-elevated px-4 py-2.5 text-sm font-semibold text-purple-100 transition hover:border-purple-400/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Load latest room version
          </button>
        )}
      </div>
      <p className="text-xs text-purple-400">
        Paste 25–500 unique words separated by newlines or commas. Drafts stay
        in this browser for this room and pack; saving publishes them for
        everyone.
      </p>
    </div>
  );
}
