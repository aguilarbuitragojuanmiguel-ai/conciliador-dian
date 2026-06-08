import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export type ContaColumnMap = {
  nit: string | null;
  nombre: string | null;
  valor: string | null;
  factura: string | null;
  cufe: string | null;
  estado: string | null;
  descripcion: string | null;
  detalle: string | null;
};

interface Props {
  open: boolean;
  headers: string[];
  initial: ContaColumnMap;
  onConfirm: (map: ContaColumnMap) => void;
  onCancel: () => void;
}

const FIELDS: { key: keyof ContaColumnMap; label: string; required: boolean }[] = [
  { key: "nit", label: "NIT / Identificación", required: false },
  { key: "nombre", label: "Nombre / Razón Social", required: true },
  { key: "valor", label: "Valor / Total", required: true },
  { key: "factura", label: "Factura / Comprobante", required: false },
  { key: "cufe", label: "CUFE / Código único", required: false },
  { key: "estado", label: "Estado (anulado/elaboración)", required: false },
  { key: "descripcion", label: "Descripción / Concepto", required: false },
  { key: "detalle", label: "Detalle / Observación", required: false },
];

export function ColumnMapperModal({ open, headers, initial, onConfirm, onCancel }: Props) {
  const [map, setMap] = useState<ContaColumnMap>(initial);

  const update = (k: keyof ContaColumnMap, v: string) =>
    setMap((m) => ({ ...m, [k]: v === "__none__" ? null : v }));

  const canConfirm = FIELDS.filter((f) => f.required).every((f) => map[f.key]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mapeo de columnas (Contabilidad)</DialogTitle>
          <DialogDescription>
            Algunas columnas no se detectaron automáticamente. Asigna manualmente cada campo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {f.label} {f.required && <span className="text-destructive">*</span>}
              </label>
              <select
                value={map[f.key] ?? "__none__"}
                onChange={(e) => update(f.key, e.target.value)}
                className="rounded-sm border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="__none__">— Ninguna —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <DialogFooter>
          <button
            onClick={onCancel}
            className="rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-subtle"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(map)}
            disabled={!canConfirm}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar y procesar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
