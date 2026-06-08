import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ReconciliationItem, STATUS_META, ReconciliationStatus } from "@/lib/reconciliation";

interface Props {
  items: ReconciliationItem[];
}

const STATUSES: ReconciliationStatus[] = [
  "Correcto",
  "Diferencia Menor",
  "Revisar",
  "Solo DIAN",
  "Solo Contabilidad",
];

const COLOR_MAP: Record<ReconciliationStatus, string> = {
  Correcto: "hsl(var(--status-correct))",
  "Diferencia Menor": "hsl(var(--status-review))",
  Revisar: "hsl(var(--status-review))",
  "Solo DIAN": "hsl(var(--status-dian))",
  "Solo Contabilidad": "hsl(var(--status-conta))",
};

export function StatusDonut({ items }: Props) {
  const data = STATUSES.map((status) => ({
    name: status,
    value: items.filter((i) => i.estado === status).length,
  })).filter((d) => d.value > 0);

  const total = items.length;
  const correctPct = total
    ? Math.round((items.filter((i) => i.estado === "Correcto").length / total) * 100)
    : 0;

  return (
    <div className="flex items-center gap-6 rounded-sm border border-border bg-surface-subtle/40 p-6">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={1}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLOR_MAP[entry.name as ReconciliationStatus]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "2px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-2xl font-medium text-foreground tabular-nums">
            {correctPct}%
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Correctos
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <div className="text-sm font-medium text-foreground mb-3">Distribución por estado</div>
        {STATUSES.map((status) => {
          const count = items.filter((i) => i.estado === status).length;
          const meta = STATUS_META[status];
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={status} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${meta.dotBg}`} />
                <span className="text-muted-foreground">{meta.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-foreground tabular-nums">{count}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums w-10 text-right">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
