import { useEffect, useMemo, useState } from "react";
import { Cloud, Database, Loader2, Download, AlertCircle, FileSpreadsheet, BarChart3, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import * as XLSXStyle from "xlsx-js-style";
import { FileDropZone } from "@/components/FileDropZone";
import { ReconciliationTable } from "@/components/ReconciliationTable";
import { StatusDonut } from "@/components/StatusDonut";
import { ColumnMapperModal, ContaColumnMap } from "@/components/ColumnMapperModal";
import { CompanySelector } from "@/components/CompanySelector";
import {
  Company, loadCompanies, saveCompanies, getActiveNit, setActiveNit,
  saveReconciliation, loadReconciliation, deleteCompany as deleteCompanyStorage,
} from "@/lib/companies";
import {
  FacturaDetalle, ReconciliationItem, ReconciliationResult,
  ReconciliationStatus, formatCurrency, STATUS_META,
} from "@/lib/reconciliation";
import { toast } from "sonner";

const STORAGE_KEY = "columnas_conta";
const STORAGE_HEADERS_KEY = "columnas_conta_headers";

const detectarColumnas = (headers: string[]): ContaColumnMap => {
  const h = headers.map((x) => String(x).toLowerCase().trim());
  const find = (opciones: string[]) => {
    const idx = opciones.map((o) => h.indexOf(o)).find((i) => i >= 0);
    return idx !== undefined && idx >= 0 ? headers[idx] : null;
  };
  return {
    nit: find(["identificación","identificacion","nit","ruc","cedula","número de identificación","nit tercero"]),
    nombre: find(["proveedor","nombre","razón social","razon social","tercero","beneficiario","nombre tercero"]),
    valor: find(["valor","total","importe","monto","débito","debito","debe","débito pcga","debito pcga","vr"]),
    factura: find(["factura proveedor","factura","comprobante","referencia","consecutivo"]),
    cufe: find(["cufe","código único","codigo unico","cufe/cude","cude","uuid"]),
    estado: find(["estado","status","situacion","situación"]),
    descripcion: find(["descripcion","descripción","concepto","cuenta contable"]),
    detalle: find(["detalle","observacion","observación","nota","notas","observaciones","descripcion detalle"]),
  };
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
type FilterKey = "Todos" | ReconciliationStatus;
const FILTERS: FilterKey[] = ["Todos","Correcto","Diferencia Menor","Revisar","Solo DIAN","Solo Contabilidad"];
const TASAS_IVA = [0.19, 0.05, 0.16, 0.08, 0.04, 0.02, 0.01];

const Index = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [dianFile, setDianFile] = useState<File | null>(null);
  const [contaFile, setContaFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [filter, setFilter] = useState<FilterKey>("Todos");
  const [mapperOpen, setMapperOpen] = useState(false);
  const [mapperHeaders, setMapperHeaders] = useState<string[]>([]);
  const [mapperInitial, setMapperInitial] = useState<ContaColumnMap>({
    nit:null, nombre:null, valor:null, factura:null, cufe:null, estado:null, descripcion:null, detalle:null,
  });
  const [pendingData, setPendingData] = useState<{ dianRows: any[]; contaRows: any[] } | null>(null);
  const [companies, setCompanies] = useState<Company[]>(() => loadCompanies());
  const [activeNit, setActiveNitState] = useState<string | null>(() => getActiveNit());

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    if (!activeNit) { setResult(null); return; }
    const stored = loadReconciliation(activeNit, year, month);
    setResult(stored); setFilter("Todos"); setError(null);
  }, [activeNit, year, month]);

  const handleSelectCompany = (nit: string) => { setActiveNit(nit); setActiveNitState(nit); };
  const handleCreateCompany = (c: Company) => {
    const next = [...companies, c];
    setCompanies(next); saveCompanies(next);
    setActiveNit(c.nit); setActiveNitState(c.nit);
  };
  const handleDeleteCompany = (nit: string) => {
    deleteCompanyStorage(nit);
    const next = companies.filter((c) => c.nit !== nit);
    setCompanies(next);
    if (activeNit === nit) { setActiveNitState(null); setResult(null); }
  };

  const filteredItems = useMemo(() => {
    if (!result) return [];
    if (filter === "Todos") return result.items;
    return result.items.filter((i) => i.estado === filter);
  }, [result, filter]);

  const counts = useMemo(() => {
    const map: Record<FilterKey, number> = {
      Todos: result?.items.length ?? 0, Correcto:0, "Diferencia Menor":0,
      Revisar:0, "Solo DIAN":0, "Solo Contabilidad":0,
    };
    result?.items.forEach((i) => (map[i.estado] += 1));
    return map;
  }, [result]);

  const parseVal = (v: any): number => {
    if (typeof v === "number") return v;
    if (!v) return 0;
    const s = String(v).trim().replace(/[$\s]/g, "");
    if (!s) return 0;
    if (s.includes(",") && s.includes(".")) {
      const coma = s.lastIndexOf(","); const punto = s.lastIndexOf(".");
      if (coma > punto) return parseFloat(s.replace(/\./g,"").replace(",",".")) || 0;
      return parseFloat(s.replace(/,/g,"")) || 0;
    }
    if (s.includes(",")) {
      const dec = s.split(",")[1];
      if (dec && dec.length <= 2) return parseFloat(s.replace(",",".")) || 0;
      return parseFloat(s.replace(/,/g,"")) || 0;
    }
    if (s.includes(".")) {
      const parts = s.split(".");
      if (parts[parts.length-1].length === 3) return parseFloat(s.replace(/\./g,"")) || 0;
      return parseFloat(s) || 0;
    }
    return parseFloat(s.replace(/[^0-9.-]/g,"")) || 0;
  };

  const readXLSXRows = (file: File): Promise<any[]> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target!.result, { type: "array", raw: true });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(sheet, { defval: 0, raw: true }));
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
    });

  // ─── IVA helpers ────────────────────────────────────────────────────────────
  const detectarTasaIVA = (descripcion: string, detalle: string): number | null => {
    const d = (descripcion + " " + detalle).toLowerCase();
    if (!d.includes("iva") && !d.includes("i.v.a")) return null;
    const match = d.match(/(\d{1,2})\s*%/);
    if (match) return parseFloat(match[1]) / 100;
    return -1;
  };

  const extraerBaseDeTexto = (detalle: string): number | null => {
    const match = String(detalle || "").match(/base[:\s]+([0-9,.]+)/i);
    if (!match) return null;
    const s = match[1].replace(/\./g,"").replace(/,/g,".");
    return parseFloat(s) || null;
  };

  const buscarIdxBase = (facturas: FacturaDetalle[], valorIVA: number, detalle: string, tasa: number): number => {
    const baseTexto = extraerBaseDeTexto(detalle);
    if (baseTexto) {
      const idx = facturas.findIndex((f) => Math.abs(f.valor - baseTexto) <= 500);
      if (idx >= 0) return idx;
    }
    if (tasa > 0) {
      const baseCalc = Math.round(valorIVA / tasa);
      const idx = facturas.findIndex((f) => Math.abs(f.valor - baseCalc) <= 500);
      if (idx >= 0) return idx;
    }
    for (const t of TASAS_IVA) {
      const baseCalc = Math.round(valorIVA / t);
      const idx = facturas.findIndex((f) => Math.abs(f.valor - baseCalc) <= 500);
      if (idx >= 0) return idx;
    }
    return -1;
  };
  // ────────────────────────────────────────────────────────────────────────────

  const buildResult = (dianRows: any[], contaRows: any[], colMap: ContaColumnMap): ReconciliationResult => {
    // ── DIAN ──
    const dianMap: Record<string, { nit:string; nombre:string; total:number; facturas:FacturaDetalle[]; cufes:string[] }> = {};
    for (const d of dianRows) {
      const nit = String(d["NIT Emisor"] ?? "").replace(/\D/g,"").trim();
      if (!nit) continue;
      if (!dianMap[nit]) dianMap[nit] = { nit, nombre: String(d["Nombre Emisor"] ?? ""), total:0, facturas:[], cufes:[] };
      const valor = parseVal(d["Total"]);
      dianMap[nit].total += valor;
      const folio = d["Folio"] ? String(d["Folio"]) : "";
      const cufe = d["CUFE"] ? String(d["CUFE"]) : (d["cufe"] ? String(d["cufe"]) : "");
      dianMap[nit].facturas.push({ folio, cufe, valor });
      if (cufe) dianMap[nit].cufes.push(cufe);
    }

    const limpiarNombre = (n: string) =>
      n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
       .replace(/s\.a\.s?\.?|ltda\.?|e\.s\.p\.?|s\.a\.?|sas|ltda/g,"")
       .replace(/[^a-z0-9\s]/g,"").replace(/\s+/g," ").trim();

    const STOPWORDS = new Set(["de","del","la","el","los","las","y","en","para","por","compania","empresa","comercial","comercializadora","industrial","servicios","soluciones","grupo","group","company","the","and","of"]);
    const palabrasClave = (n: string) => limpiarNombre(n).split(" ").filter((p) => p.length >= 3 && !STOPWORDS.has(p));
    const claveContabilidad = (nit: string, nombre: string) => nit ? nit.replace(/\D/g,"").trim() : limpiarNombre(nombre);

    // ── CONTABILIDAD ──
    const contaMap: Record<string, { nit:string; nombre:string; total:number; facturas:FacturaDetalle[] }> = {};
    const facturaMap: Record<string, { clave:string; nit:string; nombre:string; factura:string; cufe:string; descripcion:string; detalle:string; total:number }> = {};

    for (const c of contaRows) {
      const est = colMap.estado ? String(c[colMap.estado] ?? "").toLowerCase() : "";
      if (est.includes("anulado") || est.includes("elaboraci")) continue;
      const rawNit = colMap.nit ? c[colMap.nit] : "";
      const nit = String(rawNit ?? "").replace(/\.0$/,"").replace(/\D/g,"").trim();
      const nombre = colMap.nombre ? String(c[colMap.nombre] ?? "") : "";
      const factura = colMap.factura && c[colMap.factura] ? String(c[colMap.factura]).trim() : "";
      const cufe = colMap.cufe && c[colMap.cufe] ? String(c[colMap.cufe]) : "";
      const descripcion = colMap.descripcion ? String(c[colMap.descripcion] ?? "") : "";
      const detalle = colMap.detalle ? String(c[colMap.detalle] ?? "") : "";
      const valor = colMap.valor ? parseVal(c[colMap.valor]) : 0;
      const clave = claveContabilidad(nit, nombre);
      if (!clave) continue;

      const esIVA = detectarTasaIVA(descripcion, detalle) !== null;
      const claveFactura = factura
        ? `${clave}__${factura}`
        : esIVA
          ? `${clave}__iva__${Object.keys(facturaMap).length}`
          : `${clave}__sinfolio__${Object.keys(facturaMap).length}`;

      if (!facturaMap[claveFactura]) {
        facturaMap[claveFactura] = { clave, nit, nombre, factura, cufe, descripcion, detalle, total: 0 };
      } else {
        if (descripcion && !facturaMap[claveFactura].descripcion.includes(descripcion))
          facturaMap[claveFactura].descripcion += " " + descripcion;
        if (detalle && !facturaMap[claveFactura].detalle.includes(detalle))
          facturaMap[claveFactura].detalle += " " + detalle;
      }
      facturaMap[claveFactura].total += valor;
    }

    // Separar normales e IVA
    const entradasNormales: typeof facturaMap[string][] = [];
    const entradasIVA: (typeof facturaMap[string] & { tasa: number })[] = [];
    for (const item of Object.values(facturaMap)) {
      const tasa = detectarTasaIVA(item.descripcion || "", item.detalle || "");
      if (tasa !== null) entradasIVA.push({ ...item, tasa });
      else entradasNormales.push(item);
    }

    // Construir contaMap con normales
    for (const item of entradasNormales) {
      const { clave, nit, nombre, factura, cufe, total, descripcion } = item;
      if (!contaMap[clave]) contaMap[clave] = { nit, nombre, total: 0, facturas: [] };
      contaMap[clave].total += total;
      const folio = factura || (descripcion ? descripcion.substring(0, 40) : "") || "Sin número";
      const existIdx = contaMap[clave].facturas.findIndex((f) => f.folio === folio);
      if (existIdx >= 0) contaMap[clave].facturas[existIdx].valor += total;
      else contaMap[clave].facturas.push({ folio, cufe, valor: total });
    }

    // Unir IVA a su base
    for (const iva of entradasIVA) {
      const { clave, tasa, total: valorIVA, nit, nombre, detalle } = iva;
      if (!contaMap[clave]) {
        contaMap[clave] = { nit, nombre, total: valorIVA, facturas: [] };
        continue;
      }
      contaMap[clave].total += valorIVA;
      const idx = buscarIdxBase(contaMap[clave].facturas, valorIVA, detalle || "", tasa);
      if (idx >= 0) {
        contaMap[clave].facturas[idx].valor += valorIVA;
        if (!contaMap[clave].facturas[idx].folio.includes("(+ IVA)"))
          contaMap[clave].facturas[idx].folio += " (+ IVA)";
      }
    }

    // ── CRUCE ──
    const nombresSimilares = (a: string, b: string) => {
      const na = limpiarNombre(a); const nb = limpiarNombre(b);
      if (!na || !nb) return false;
      if (na.length >= 5 && nb.length >= 5 && (na.includes(nb) || nb.includes(na))) return true;
      const pA = palabrasClave(a); const pB = palabrasClave(b);
      if (pA.length === 0 || pB.length === 0) return false;
      const matches = pA.filter((p) => pB.some((q) => p === q || (p.length >= 4 && q.includes(p)) || (q.length >= 4 && p.includes(q)))).length;
      if (matches === 0) return false;
      return matches / Math.min(pA.length, pB.length) >= 0.5 || matches >= 2;
    };

    const clasificar = (dif: number): ReconciliationStatus => {
      if (Math.abs(dif) <= 5) return "Correcto";
      if (Math.abs(dif) <= 1000) return "Diferencia Menor";
      return "Revisar";
    };

    const contaUsados = new Set<string>();
    const items: ReconciliationItem[] = [];

    for (const clave of Object.keys(dianMap)) {
      if (contaMap[clave]) {
        contaUsados.add(clave);
        const d = dianMap[clave]; const c = contaMap[clave];
        const diferencia = d.total - c.total;
        items.push({ nit: d.nit || c.nit || clave, razonSocial: d.nombre || c.nombre, valorDian: d.total, valorContabilidad: c.total, diferencia, estado: clasificar(diferencia), facturasDian: d.facturas, facturasConta: c.facturas, cufesDian: d.cufes });
      }
    }

    for (const clave of Object.keys(dianMap)) {
      if (contaMap[clave]) continue;
      const d = dianMap[clave];
      const matchClave = Object.keys(contaMap).find((ck) => !contaUsados.has(ck) && nombresSimilares(d.nombre, contaMap[ck].nombre));
      if (matchClave) {
        contaUsados.add(matchClave);
        const c = contaMap[matchClave]; const diferencia = d.total - c.total;
        items.push({ nit: d.nit || clave, razonSocial: d.nombre, valorDian: d.total, valorContabilidad: c.total, diferencia, estado: clasificar(diferencia), facturasDian: d.facturas, facturasConta: c.facturas, cufesDian: d.cufes });
      } else {
        items.push({ nit: d.nit || clave, razonSocial: d.nombre, valorDian: d.total, valorContabilidad: null, diferencia: d.total, estado: "Solo DIAN", facturasDian: d.facturas, facturasConta: [], cufesDian: d.cufes });
      }
    }

    for (const clave of Object.keys(contaMap)) {
      if (contaUsados.has(clave)) continue;
      const c = contaMap[clave];
      items.push({ nit: c.nit || clave, razonSocial: c.nombre, valorDian: null, valorContabilidad: c.total, diferencia: -c.total, estado: "Solo Contabilidad", cufesDian: [], facturasDian: [], facturasConta: c.facturas });
    }

    const orden: Record<ReconciliationStatus, number> = { Revisar:0, "Diferencia Menor":1, "Solo Contabilidad":2, "Solo DIAN":3, Correcto:4 };
    items.sort((a, b) => orden[a.estado] - orden[b.estado]);

    const totalDian = items.reduce((s, i) => s + (i.valorDian ?? 0), 0);
    const totalContabilidad = items.reduce((s, i) => s + (i.valorContabilidad ?? 0), 0);
    return { totalDian: Math.round(totalDian), totalContabilidad: Math.round(totalContabilidad), diferencia: Math.round(totalDian - totalContabilidad), itemsRevisar: items.filter((i) => i.estado !== "Correcto").length, items };
  };

  const finishProcessing = (dianRows: any[], contaRows: any[], colMap: ContaColumnMap) => {
    try {
      const r = buildResult(dianRows, contaRows, colMap);
      setResult(r); setFilter("Todos");
      if (activeNit) saveReconciliation(activeNit, year, month, r);
      toast.success(`Conciliación completada — ${r.items.length} proveedores procesados`);
    } catch (e: any) {
      const msg = e?.message ?? "Error al procesar"; setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleProcess = async () => {
    setError(null);
    if (!activeNit) { setError("Selecciona o crea una empresa antes de procesar."); return; }
    if (!dianFile || !contaFile) { setError("Debes cargar ambos archivos (.xlsx) antes de procesar."); return; }
    setLoading(true);
    try {
      const dianRows = (await readXLSXRows(dianFile)).map((row) => ({
        ...row,
        Total: typeof row["Total"] === "number" ? row["Total"] : parseFloat(String(row["Total"]).replace(",",".")) || 0,
      }));
      const contaRows = await readXLSXRows(contaFile);
      const headers = contaRows.length > 0 ? Object.keys(contaRows[0]) : [];

      // Cargar mapeo y headers guardados
      let saved: ContaColumnMap | null = null;
      let savedHeaders: string[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
        const rawH = localStorage.getItem(STORAGE_HEADERS_KEY);
        if (rawH) savedHeaders = JSON.parse(rawH);
      } catch {}

      // El mapeo solo es válido si el archivo tiene EXACTAMENTE las mismas columnas que la vez anterior
      const mismosHeaders = savedHeaders.length > 0 &&
        savedHeaders.length === headers.length &&
        savedHeaders.every((h) => headers.includes(h));

      if (mismosHeaders && saved && saved.nombre && saved.valor) {
        // Mismo tipo de archivo — usar mapeo guardado directamente sin preguntar
        finishProcessing(dianRows, contaRows, saved);
        return;
      }

      // Archivo diferente o primera vez — detectar automáticamente y mostrar mapper para confirmar
      const colMap = detectarColumnas(headers);
      setMapperHeaders(headers);
      setMapperInitial(colMap);
      setPendingData({ dianRows, contaRows });
      setMapperOpen(true);
      setLoading(false);

    } catch (e: any) {
      const msg = e?.message ?? "Error al procesar"; setError(msg); toast.error(msg); setLoading(false);
    }
  };

  const handleMapperConfirm = (colMap: ContaColumnMap) => {
    setMapperOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(colMap));
      // Guardar también los headers para detectar cambios de software la próxima vez
      if (pendingData) {
        const headers = pendingData.contaRows.length > 0 ? Object.keys(pendingData.contaRows[0]) : [];
        localStorage.setItem(STORAGE_HEADERS_KEY, JSON.stringify(headers));
      }
    } catch {}
    if (pendingData) {
      setLoading(true);
      finishProcessing(pendingData.dianRows, pendingData.contaRows, colMap);
      setPendingData(null);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const COP_FMT = '"$"#,##0;[Red]("$"#,##0);"-"';
    const HEADER_STYLE = { font: { bold:true, color:{rgb:"FFFFFF"} }, fill: { patternType:"solid", fgColor:{rgb:"1E3A5F"} }, alignment: { horizontal:"center" } };
    const diffFill = (n: number) => n > 0 ? { patternType:"solid", fgColor:{rgb:"FECACA"} } : n < 0 ? { patternType:"solid", fgColor:{rgb:"D1FAE5"} } : { patternType:"solid", fgColor:{rgb:"FFFFFF"} };
    const c = { Correcto:0, "Diferencia Menor":0, Revisar:0, "Solo DIAN":0, "Solo Contabilidad":0 } as Record<ReconciliationStatus, number>;
    result.items.forEach((i) => (c[i.estado] += 1));
    const activeCompany = companies.find((co) => co.nit === activeNit);

    const resAOA: any[][] = [
      ["CONCILIACIÓN DIAN VS CONTABILIDAD"],[],
      ["Empresa", activeCompany?.nombre ?? "—"],
      ["NIT", activeNit ?? "—"],
      ["Período", `${MONTHS[month]} ${year}`],
      ["Fecha de proceso", new Date().toLocaleString("es-CO")],
      [],["Métrica","Valor"],
      ["Total DIAN", result.totalDian],["Total Contabilidad", result.totalContabilidad],["Diferencia Neta", result.diferencia],
      [],["Estado","Cantidad"],
      ["Correctos", c.Correcto],["Diferencia Menor", c["Diferencia Menor"]],["A Revisar", c.Revisar],["Solo DIAN", c["Solo DIAN"]],["Solo Contabilidad", c["Solo Contabilidad"]],
    ];
    const wsRes = XLSX.utils.aoa_to_sheet(resAOA);
    wsRes["!cols"] = [{wch:28},{wch:32}];
    wsRes["!merges"] = [{s:{r:0,c:0},e:{r:0,c:1}}];
    if (wsRes["A1"]) wsRes["A1"].s = { font:{bold:true,sz:13,color:{rgb:"FFFFFF"}}, fill:{patternType:"solid",fgColor:{rgb:"1E3A5F"}}, alignment:{horizontal:"center"} };
    ["A8","B8","A13","B13"].forEach(ref => { if(wsRes[ref]) wsRes[ref].s = HEADER_STYLE; });
    [8,9,10].forEach(r => { const ref = XLSX.utils.encode_cell({r,c:1}); if(wsRes[ref]) { wsRes[ref].t="n"; wsRes[ref].z=COP_FMT; wsRes[ref].s={numFmt:COP_FMT}; }});
    const difRef = XLSX.utils.encode_cell({r:9,c:1}); if(wsRes[difRef]) wsRes[difRef].s = { fill:diffFill(result.diferencia), font:{bold:true}, numFmt:COP_FMT };

    const detHeaders = ["NIT","Razón Social","Valor DIAN","Valor Contabilidad","Diferencia","Estado","Facturas DIAN","CUFEs","Facturas Contabilidad"];
    const detAOA: any[][] = [detHeaders];
    result.items.forEach(i => detAOA.push([
      i.nit, i.razonSocial, i.valorDian??0, i.valorContabilidad??0, i.diferencia, i.estado,
      (i.facturasDian??[]).map(f=>f.folio).filter(Boolean).join(", "),
      (i.cufesDian??[]).join(", "),
      (i.facturasConta??[]).map(f=>f.folio).filter(Boolean).join(", "),
    ]));
    const wsDet = XLSX.utils.aoa_to_sheet(detAOA);
    wsDet["!cols"] = [{wch:14},{wch:36},{wch:16},{wch:18},{wch:16},{wch:18},{wch:30},{wch:50},{wch:30}];
    detHeaders.forEach((_,c) => { const ref = XLSX.utils.encode_cell({r:0,c}); if(wsDet[ref]) wsDet[ref].s = HEADER_STYLE; });
    for (let r=1;r<detAOA.length;r++) {
      [2,3,4].forEach(c => { const ref=XLSX.utils.encode_cell({r,c}); if(wsDet[ref]){wsDet[ref].t="n";wsDet[ref].z=COP_FMT;wsDet[ref].s={numFmt:COP_FMT};} });
      const diff = Number(detAOA[r][4])||0;
      const difCell = XLSX.utils.encode_cell({r,c:4}); if(wsDet[difCell]) wsDet[difCell].s = { numFmt:COP_FMT, fill:diffFill(diff), font:{bold:diff!==0} };
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsRes, "Resumen");
    XLSX.utils.book_append_sheet(wb, wsDet, "Detalle");
    XLSX.writeFile(wb, `Conciliacion_DIAN_${MONTHS[month]}_${year}.xlsx`);
    toast.success("Excel descargado");
  };

  const exportarDIANColoreado = async () => {
    if (!dianFile || !result) { toast.error("Carga el archivo DIAN y procesa primero"); return; }
    try {
      const buffer = await dianFile.arrayBuffer();
      const wb = XLSXStyle.read(buffer, { type:"array", raw:true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const range = XLSXStyle.utils.decode_range(ws["!ref"]!);
      const headers: string[] = [];
      for (let c=range.s.c;c<=range.e.c;c++) {
        const cell = ws[XLSXStyle.utils.encode_cell({r:range.s.r,c})];
        headers.push(cell ? String(cell.v).trim() : "");
      }
      const nitCol = headers.findIndex(h => h.toLowerCase().includes("nit emisor"));
      const nombreCol = headers.findIndex(h => h.toLowerCase().includes("nombre emisor") || h.toLowerCase().includes("razon social"));
      const claveCol = nitCol >= 0 ? nitCol : nombreCol;
      if (claveCol < 0) { toast.error("No se encontró columna NIT/Nombre en el archivo DIAN"); return; }

      const colores: Record<string,string> = { Correcto:"C6EFCE", Revisar:"FFCCCC", "Solo DIAN":"CCE5FF", "Diferencia Menor":"FFEB9C" };
      const estadoMap: Record<string,string> = {};
      for (const d of result.items) {
        if (d.nit) estadoMap[String(d.nit).replace(/\D/g,"")] = d.estado;
        if (d.razonSocial) estadoMap[d.razonSocial.toLowerCase().trim()] = d.estado;
      }
      for (let r=range.s.r+1;r<=range.e.r;r++) {
        const claveCell = ws[XLSXStyle.utils.encode_cell({r,c:claveCol})];
        if (!claveCell) continue;
        const clave = String(claveCell.v||"").replace(/\.0$/,"").replace(/\D/g,"").trim();
        const nombreClave = String(claveCell.v||"").toLowerCase().trim();
        const estado = estadoMap[clave] || estadoMap[nombreClave] || "";
        const color = colores[estado];
        if (!color) continue;
        for (let c=range.s.c;c<=range.e.c;c++) {
          const addr = XLSXStyle.utils.encode_cell({r,c});
          if (!ws[addr]) ws[addr] = {v:"",t:"s"};
          ws[addr].s = { fill:{fgColor:{rgb:color},patternType:"solid"} };
        }
      }
      for (let c=range.s.c;c<=range.e.c;c++) {
        const addr = XLSXStyle.utils.encode_cell({r:range.s.r,c});
        if (!ws[addr]) ws[addr] = {v:"",t:"s"};
        ws[addr].s = { fill:{fgColor:{rgb:"1E3A5F"},patternType:"solid"}, font:{bold:true,color:{rgb:"FFFFFF"}} };
      }
      const outBuffer = XLSXStyle.write(wb, { bookType:"xlsx", type:"array" });
      const blob = new Blob([outBuffer], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href=url;
      a.download = `DIAN_Coloreado_${MONTHS[month]}_${year}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success("DIAN coloreado descargado");
    } catch (e) { console.error(e); toast.error("Error al colorear el archivo DIAN"); }
  };

  const activeCompany = companies.find((c) => c.nit === activeNit);
  const healthPct = result ? Math.round((counts.Correcto / (result.items.length || 1)) * 100) : 0;

  return (
    <div className="flex min-h-screen w-full bg-background font-sans">
      <aside className="w-[300px] shrink-0 border-r border-border bg-card flex flex-col sticky top-0 h-screen shadow-sm">
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground tracking-tight">DIAN RECON</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Conciliador Fiscal</div>
            </div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-5 flex-1 overflow-y-auto scrollbar-thin">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Período</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer">
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <FileDropZone label="Reporte DIAN (.xlsx)" icon="cloud" file={dianFile} onFileChange={setDianFile} />
          <FileDropZone label="Contabilidad (.xlsx)" icon="database" file={contaFile} onFileChange={setContaFile} />

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive animate-fade-in">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Salud del mes</span>
                <span className={`text-xs font-bold ${healthPct >= 80 ? "text-status-correct" : healthPct >= 50 ? "text-status-review" : "text-destructive"}`}>{healthPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width:`${healthPct}%`, backgroundColor: healthPct >= 80 ? "hsl(var(--status-correct))" : healthPct >= 50 ? "hsl(var(--status-review))" : "hsl(var(--destructive))" }} />
              </div>
              <div className="text-[10px] text-muted-foreground">{counts.Correcto} de {result.items.length} proveedores correctos</div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border">
          <button onClick={handleProcess} disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Procesando...</> : <><CheckCircle2 className="h-4 w-4" />Procesar conciliación</>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-background min-w-0">
        <header className="h-14 flex items-center justify-between px-8 border-b border-border bg-card gap-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-foreground">Dashboard de resultados</h2>
            {activeCompany && (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeCompany.color }} />
                <span className="text-xs font-medium text-muted-foreground">{activeCompany.nombre}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CompanySelector companies={companies} activeNit={activeNit} onSelect={handleSelectCompany} onCreate={handleCreateCompany} onDelete={handleDeleteCompany} />
            {result && (
              <>
                <button onClick={handleExport}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface transition-colors shadow-sm">
                  <Download className="h-3.5 w-3.5" />Exportar Excel
                </button>
                <button onClick={exportarDIANColoreado}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
                  <FileSpreadsheet className="h-3.5 w-3.5" />DIAN Coloreado
                </button>
              </>
            )}
          </div>
        </header>

        {!result ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm animate-fade-in">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-surface border border-border shadow-sm mb-5">
                <Cloud className="h-9 w-9 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Sin resultados todavía</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Carga el reporte DIAN y el archivo de contabilidad, selecciona la empresa y el período, luego presiona{" "}
                <span className="font-semibold text-foreground">Procesar conciliación</span>.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 scrollbar-thin">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label:"Total DIAN", value:formatCurrency(result.totalDian), color:"bg-status-dian", textColor:"text-status-dian" },
                { label:"Total Contabilidad", value:formatCurrency(result.totalContabilidad), color:"bg-status-conta", textColor:"text-status-conta" },
                { label:"Diferencia Neta", value:formatCurrency(result.diferencia), color: result.diferencia===0?"bg-status-correct":"bg-status-review", textColor: result.diferencia>0?"text-destructive":result.diferencia<0?"text-status-correct":"text-foreground" },
                { label:"Items a revisar", value:String(result.itemsRevisar), color:"bg-status-review", textColor: result.itemsRevisar===0?"text-status-correct":"text-status-review" },
              ].map((m, i) => (
                <div key={i} className="relative rounded-xl border border-border bg-card p-4 shadow-sm overflow-hidden animate-fade-in" style={{animationDelay:`${i*60}ms`}}>
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${m.color}`} />
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
                  <div className={`font-mono text-xl font-bold tabular-nums ${m.textColor}`}>{m.value}</div>
                </div>
              ))}
            </div>

            <StatusDonut items={result.items} />

            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const active = filter === f;
                const meta = f === "Todos" ? null : STATUS_META[f];
                return (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? meta ? `${meta.bg} ${meta.border} ${meta.text} border shadow-sm` : "bg-foreground text-background border border-foreground shadow-sm"
                        : "bg-card border border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                    }`}>
                    {f === "Todos" ? "Todos" : meta!.label}
                    <span className="ml-1.5 font-mono opacity-70">({counts[f]})</span>
                  </button>
                );
              })}
            </div>

            <ReconciliationTable items={filteredItems} />
          </div>
        )}
      </main>

      <ColumnMapperModal
        open={mapperOpen}
        headers={mapperHeaders}
        initial={mapperInitial}
        onConfirm={handleMapperConfirm}
        onCancel={() => { setMapperOpen(false); setPendingData(null); setLoading(false); }}
      />
    </div>
  );
};

export default Index;
