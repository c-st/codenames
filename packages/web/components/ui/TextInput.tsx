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
      className="border-1 input input-bordered input-primary w-full max-w-xs rounded-xl font-mono font-bold md:input-lg"
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
