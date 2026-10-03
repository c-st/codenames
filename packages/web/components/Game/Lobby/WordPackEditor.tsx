import { useEffect, useId, useMemo, useState } from "react";
import { customWordsSchema } from "schema";

const EMPTY_WORDS: string[] = [];

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

export default function WordPackEditor({
  words = EMPTY_WORDS,
  onSave,
  roomId = "default",
}: {
  words?: string[];
  onSave: (words: string[]) => void;
  roomId?: string;
}) {
  const inputId = useId();
  const storageKey = `codenames:word-draft:${roomId}`;
  const [draft, setDraft] = useState(words.join("\n"));
  const [loadedKey, setLoadedKey] = useState<string>();
  const [storageWarning, setStorageWarning] = useState(false);
  const [submitted, setSubmitted] = useState<string>();
  const parsed = useMemo(() => parseWords(draft), [draft]);
  const validation = customWordsSchema.safeParse(parsed.words);
  const isSaved = JSON.stringify(parsed.words) === JSON.stringify(words);
  const awaitingSave = submitted === JSON.stringify(parsed.words) && !isSaved;

  useEffect(() => {
    let savedDraft: string | null = null;
    try {
      savedDraft = localStorage.getItem(storageKey);
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
    setDraft(savedDraft ?? words.join("\n"));
    setLoadedKey(storageKey);
    setSubmitted(undefined);
    // Room changes load its own draft. Incoming shared words never overwrite edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, draft);
    } catch {
      setStorageWarning(true);
    }
  }, [draft, loadedKey, storageKey]);

  return (
    <details className="rounded-xl border border-purple-700/40 bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold text-white">
        ✏️ Create or edit a custom word pack
        {words.length > 0 && (
          <span className="ml-2 text-xs text-purple-300">
            {words.length} room words
          </span>
        )}
      </summary>
      <div className="mt-4 flex flex-col gap-3">
        <p className="text-sm text-purple-300">
          Paste 25–500 words separated by newlines or commas. Saving shares this
          list with everyone and selects the custom pack. More than 25 words
          keeps each board fresh.
        </p>
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-purple-300"
        >
          Your words (up to 50 characters each)
        </label>
        <textarea
          id={inputId}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSubmitted(undefined);
          }}
          rows={8}
          maxLength={260000}
          spellCheck={false}
          placeholder={"Moon\nBridge\nTiger\n…"}
          aria-describedby={`${inputId}-status`}
          className="w-full resize-y rounded-lg border border-purple-700/50 bg-elevated p-3 text-sm text-white outline-none focus:border-accent"
        />
        <div
          id={`${inputId}-status`}
          aria-live="polite"
          className="text-sm text-purple-300"
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
          {isSaved && words.length > 0 && (
            <p className="mt-1 text-emerald-300">
              This list is saved in the room.
            </p>
          )}
          {awaitingSave && (
            <p className="mt-1">Waiting for the room to confirm your list…</p>
          )}
          {storageWarning && (
            <p className="mt-1 text-amber-300">
              Browser storage is unavailable. Copy your draft before leaving.
            </p>
          )}
        </div>
        {parsed.words.length > 0 && (
          <p className="break-words text-xs text-purple-400">
            Preview: {parsed.words.slice(0, 8).join(" · ")}
            {parsed.words.length > 8 && " · …"}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!validation.success}
            onClick={() => {
              if (validation.success) {
                setSubmitted(JSON.stringify(validation.data));
                onSave(validation.data);
              }
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save & use custom pack
          </button>
          {words.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDraft(words.join("\n"));
                setSubmitted(undefined);
              }}
              className="rounded-lg bg-elevated px-4 py-2 text-sm text-purple-200"
            >
              Load room’s saved list
            </button>
          )}
        </div>
        <p className="text-xs text-purple-400">
          Your draft is kept in this browser for this room. Save again to
          publish any edits.
        </p>
      </div>
    </details>
  );
}
