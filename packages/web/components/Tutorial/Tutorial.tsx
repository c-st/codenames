export default function Tutorial({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-xl">Tutorial coming next...</p>
      <button onClick={onComplete} className="ml-4 text-accent underline">
        Skip
      </button>
    </div>
  );
}
