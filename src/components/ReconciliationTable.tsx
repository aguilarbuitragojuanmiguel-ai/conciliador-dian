import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ReconciliationItem, STATUS_META, formatCurrency } from "@/lib/reconciliation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  items: ReconciliationItem[];
}

const truncCufe = (c: string, n = 20) => (c.length > n ? c.slice(0, n) + "…" : c);

export function ReconciliationTable({ items }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (items.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No hay registros para mostrar.</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-sm border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-subtle">
              <tr>
                <th className="px-2 py-3 w-8"></th>
                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">NIT</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Razón Social</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right whitespace-nowrap">Valor DIAN</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right whitespace-nowrap">Valor Contabilidad</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right whitespace-nowrap">Diferencia</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">CUFE</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item, idx) => {
                const meta = STATUS_META[item.estado];
                const diff = item.diferencia;
                const diffClass =
                  diff > 0 ? "text-destructive" : diff < 0 ? "text-status-correct" : "text-muted-foreground";
                const cufes = item.cufesDian ?? [];
                const cufeJoined = cufes.join(", ");
                const cufeDisplay = truncCufe(cufeJoined);
                const isOpen = !!expanded[idx];
                const hasDetail = (item.facturasDian?.length ?? 0) + (item.facturasConta?.length ?? 0) > 0;

                return (
                  <Fragment key={idx}>
                    <tr
                      key={idx}
                      className="hover:bg-surface-subtle/50 transition-colors cursor-pointer"
                      onClick={() => hasDetail && setExpanded((e) => ({ ...e, [idx]: !e[idx] }))}
                    >
                      <td className="px-2 py-3 text-muted-foreground">
                        {hasDetail ? (
                          isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground whitespace-nowrap">{item.nit}</td>
                      <td className="px-4 py-3 text-foreground">{item.razonSocial}</td>
                      <td className="px-4 py-3 font-mono text-right tabular-nums text-foreground whitespace-nowrap">
                        {formatCurrency(item.valorDian)}
                      </td>
                      <td className="px-4 py-3 font-mono text-right tabular-nums text-foreground whitespace-nowrap">
                        {formatCurrency(item.valorContabilidad)}
                      </td>
                      <td className={`px-4 py-3 font-mono text-right tabular-nums whitespace-nowrap ${diffClass}`}>
                        {diff === 0 ? "—" : formatCurrency(diff)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap max-w-[200px] truncate">
                        {cufeJoined ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{cufeDisplay}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md break-all">
                              <span className="font-mono text-xs">{cufeJoined}</span>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${meta.bg} ${meta.border} ${meta.text}`}
                        >
                          <span className={`size-1.5 rounded-full ${meta.dotBg}`} />
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                    {isOpen && hasDetail && (
                      <tr key={`${idx}-detail`} className="bg-surface-subtle/30">
                        <td colSpan={8} className="px-8 py-4">
                          <div className="grid md:grid-cols-2 gap-6">
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Facturas DIAN ({item.facturasDian?.length ?? 0})
                              </div>
                              <div className="flex flex-col gap-2">
                                {(item.facturasDian ?? []).map((f, i) => {
                                  const contaValores = (item.facturasConta ?? []).map((x) => x.valor);
                                  const cruzada = contaValores.some((vc) => Math.abs(f.valor - vc) <= 5);
                                  return (
                                    <div
                                      key={i}
                                      className="rounded-sm border p-2"
                                      style={
                                        cruzada
                                          ? undefined
                                          : { backgroundColor: "#FFCCCC", borderColor: "#F5A8A8" }
                                      }
                                    >
                                      <div className="flex justify-between items-center gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-mono text-sm text-foreground truncate">
                                            {f.folio || "(sin folio)"}
                                          </span>
                                          {!cruzada && (
                                            <span className="inline-flex items-center rounded-sm bg-destructive px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive-foreground whitespace-nowrap">
                                              Sin contabilizar
                                            </span>
                                          )}
                                        </div>
                                        <span
                                          className={`font-mono text-sm tabular-nums whitespace-nowrap ${
                                            cruzada ? "text-foreground" : "text-destructive font-semibold"
                                          }`}
                                        >
                                          {formatCurrency(f.valor)}
                                        </span>
                                      </div>
                                      {f.cufe && (
                                        <div className="mt-1 font-mono text-[10px] text-muted-foreground select-all break-all">
                                          {f.cufe}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {(item.facturasDian?.length ?? 0) === 0 && (
                                  <span className="text-xs text-muted-foreground">Sin registros</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Facturas Contabilidad ({item.facturasConta?.length ?? 0})
                              </div>
                              <div className="flex flex-col gap-2">
                                {(item.facturasConta ?? []).map((f, i) => (
                                  <div key={i} className="rounded-sm border border-border bg-card p-2">
                                    <div className="flex justify-between items-center gap-3">
                                      <span className="font-mono text-sm text-foreground">{f.folio || "(sin folio)"}</span>
                                      <span className="font-mono text-sm tabular-nums text-foreground">
                                        {formatCurrency(f.valor)}
                                      </span>
                                    </div>
                                    {f.cufe && (
                                      <div className="mt-1 font-mono text-[10px] text-muted-foreground select-all break-all">
                                        {f.cufe}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {(item.facturasConta?.length ?? 0) === 0 && (
                                  <span className="text-xs text-muted-foreground">Sin registros</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
