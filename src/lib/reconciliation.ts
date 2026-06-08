export type ReconciliationStatus =
  | "Correcto"
  | "Diferencia Menor"
  | "Revisar"
  | "Solo DIAN"
  | "Solo Contabilidad";

export interface FacturaDetalle {
  folio: string;
  cufe: string;
  valor: number;
}

export interface ReconciliationItem {
  nit: string;
  razonSocial: string;
  valorDian: number | null;
  valorContabilidad: number | null;
  diferencia: number;
  estado: ReconciliationStatus;
  cufesDian?: string[];
  facturasDian?: FacturaDetalle[];
  facturasConta?: FacturaDetalle[];
}

export interface ReconciliationResult {
  totalDian: number;
  totalContabilidad: number;
  diferencia: number;
  itemsRevisar: number;
  items: ReconciliationItem[];
}

export const STATUS_META: Record<
  ReconciliationStatus,
  { label: string; bg: string; border: string; text: string; dotBg: string }
> = {
  Correcto: {
    label: "Correcto",
    bg: "bg-status-correct/10",
    border: "border-status-correct/30",
    text: "text-status-correct",
    dotBg: "bg-status-correct",
  },
  "Diferencia Menor": {
    label: "Diferencia Menor",
    bg: "bg-status-review/10",
    border: "border-status-review/30",
    text: "text-status-review",
    dotBg: "bg-status-review",
  },
  Revisar: {
    label: "Revisar",
    bg: "bg-status-review/10",
    border: "border-status-review/30",
    text: "text-status-review",
    dotBg: "bg-status-review",
  },
  "Solo DIAN": {
    label: "Solo DIAN",
    bg: "bg-status-dian/10",
    border: "border-status-dian/30",
    text: "text-status-dian",
    dotBg: "bg-status-dian",
  },
  "Solo Contabilidad": {
    label: "Solo Contabilidad",
    bg: "bg-status-conta/10",
    border: "border-status-conta/30",
    text: "text-status-conta",
    dotBg: "bg-status-conta",
  },
};

export const formatCurrency = (n: number | null) => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
};

/** Normalize webhook response — accepts variations and computes totals if missing */
export function normalizeResult(raw: any): ReconciliationResult {
  const itemsRaw: any[] = raw?.items ?? raw?.data ?? raw?.results ?? [];
  const items: ReconciliationItem[] = itemsRaw.map((it) => {
    const valorDian = it.valorDian ?? it.valor_dian ?? it.dian ?? null;
    const valorContabilidad =
      it.valorContabilidad ?? it.valor_contabilidad ?? it.contabilidad ?? null;
    const diferencia =
      it.diferencia ?? (Number(valorDian ?? 0) - Number(valorContabilidad ?? 0));
    let estado: ReconciliationStatus = it.estado ?? "Correcto";
    // Defensive: derive estado if missing
    if (!it.estado) {
      if (valorDian === null || valorDian === undefined) estado = "Solo Contabilidad";
      else if (valorContabilidad === null || valorContabilidad === undefined) estado = "Solo DIAN";
      else if (Math.abs(Number(diferencia)) <= 5) estado = "Correcto";
      else if (Math.abs(Number(diferencia)) <= 1000) estado = "Diferencia Menor";
      else estado = "Revisar";
    }
    return {
      nit: String(it.nit ?? ""),
      razonSocial: String(it.razonSocial ?? it.razon_social ?? it.nombre ?? ""),
      valorDian: valorDian === null || valorDian === undefined ? null : Number(valorDian),
      valorContabilidad:
        valorContabilidad === null || valorContabilidad === undefined
          ? null
          : Number(valorContabilidad),
      diferencia: Number(diferencia) || 0,
      estado,
    };
  });

  const totalDian =
    raw?.totalDian ?? raw?.total_dian ?? items.reduce((s, i) => s + (i.valorDian ?? 0), 0);
  const totalContabilidad =
    raw?.totalContabilidad ??
    raw?.total_contabilidad ??
    items.reduce((s, i) => s + (i.valorContabilidad ?? 0), 0);
  const diferencia = raw?.diferencia ?? totalDian - totalContabilidad;
  const itemsRevisar =
    raw?.itemsRevisar ??
    raw?.items_revisar ??
    items.filter((i) => i.estado !== "Correcto").length;

  return {
    totalDian: Number(totalDian) || 0,
    totalContabilidad: Number(totalContabilidad) || 0,
    diferencia: Number(diferencia) || 0,
    itemsRevisar: Number(itemsRevisar) || 0,
    items,
  };
}
