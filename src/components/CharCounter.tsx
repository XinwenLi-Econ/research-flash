// components/CharCounter.tsx
// @source: real.md R2

interface CharCounterProps {
  current: number;
  max: number;
}

export function CharCounter({ current, max }: CharCounterProps) {
  const remaining = max - current;
  const isWarning = remaining <= 30 && remaining > 0;
  const isError = remaining < 0;

  return (
    <span
      className={`text-sm ${
        isError ? 'text-red-500 font-bold' :
        isWarning ? 'text-amber-500' :
        'text-gray-400'
      }`}
    >
      {current}/{max}
    </span>
  );
}
