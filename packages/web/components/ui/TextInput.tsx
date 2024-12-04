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
      className="border-1 text-md h-12 rounded-xl border-gray-300 px-4 py-2 font-mono font-bold focus:border-transparent focus:outline-none focus:ring-4 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:ring-blue-500 md:text-xl"
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
