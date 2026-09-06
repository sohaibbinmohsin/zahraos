export function StatCard(
  { accent, label, value, sub }: { accent: "gold" | "green" | "dark" | "red"; label: string; value: string; sub: string },
) {
  return (
    <div className={`stat-card accent-${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}
