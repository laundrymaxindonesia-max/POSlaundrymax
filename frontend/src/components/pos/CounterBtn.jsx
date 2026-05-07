/**
 * CounterBtn — circular +/− button used by the kiloan keypad and item rows.
 * Two visual variants: `primary` (yellow filled) and `default` (glass outline).
 */
export default function CounterBtn({
  onClick,
  children,
  testid,
  variant = "default",
  disabled = false,
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      disabled={disabled}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed ${
        variant === "primary"
          ? "bg-[#FFD700] text-black hover:bg-[#ffdf33] shadow-[0_0_20px_rgba(255,215,0,0.35)]"
          : "bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-[#FFD700]/40"
      }`}
    >
      {children}
    </button>
  );
}
