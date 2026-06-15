import { egp } from "@/lib/utils";

type Color = "blue" | "green" | "red" | "yellow";

export function StatCard({
  label,
  value,
  sub,
  color = "blue",
  icon,
  money = false,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: Color;
  icon?: string;
  money?: boolean;
}) {
  const display = typeof value === "number" && money ? egp(value) : typeof value === "number" ? value.toLocaleString("en-US") : value;
  return (
    <div className={`stat-card ${color}`}>
      {icon ? <div className="card-icon">{icon}</div> : null}
      <div className="card-label">{label}</div>
      <div className="card-value">{display}</div>
      {sub ? <div className="card-sub">{sub}</div> : null}
    </div>
  );
}
