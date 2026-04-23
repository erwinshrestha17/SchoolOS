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
    <div className="shell-card rounded-[28px] p-6">
      <p className="label mb-4">{label}</p>
      <div className="flex items-end justify-between gap-4">
        <p className="text-4xl font-black tracking-tight">{value}</p>
        <span
          className="h-12 w-12 rounded-2xl"
          style={{ background: accent }}
        />
      </div>
    </div>
  );
}
