export function TextInput({
  value,
  placeholder = "",
  onChange,
  onSubmit,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}) {
  return (
    <input
      type="text"
      className="w-full max-w-xs rounded-2xl border-2 border-purple-700 bg-surface px-4 py-3 font-mono font-bold text-white placeholder-purple-300/60 focus:border-accent focus:outline-none md:px-5 md:py-4 md:text-lg"
      placeholder={placeholder}
      onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          onSubmit(value);
        }
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
