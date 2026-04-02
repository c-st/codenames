export default function Logo({ size = "default" }: { size?: "default" | "large" }) {
  const textClass =
    size === "large"
      ? "text-5xl md:text-7xl font-black tracking-tighter"
      : "text-2xl md:text-4xl font-bold tracking-tighter";

  return (
    <div className={`select-none font-[family-name:var(--font-geist-sans)] ${textClass}`}>
      <span className="text-white">code</span>
      <span className="text-accent">nam</span>
      <span className="text-white">.</span>
      <span className="text-accent">es</span>
    </div>
  );
}
