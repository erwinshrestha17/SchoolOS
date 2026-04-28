export function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="shell-card p-5 hover:shadow-md transition-shadow duration-200">
      <p className="label mb-3">{label}</p>
      <div className="flex items-end justify-between gap-4">
        <p className="text-3xl font-bold tracking-tight text-gray-900">
          {value}
        </p>
        <span
          className="h-10 w-10 rounded-xl shrink-0"
          style={{ background: accent }}
        />
      </div>
    </div>
  );
}
