import { ReconciliationResult } from "./reconciliation";

export interface Company {
  nit: string;
  nombre: string;
  color: string;
}

const COMPANIES_KEY = "empresas_lista";
const ACTIVE_KEY = "empresa_activa_nit";

export const loadCompanies = (): Company[] => {
  try {
    const raw = localStorage.getItem(COMPANIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Company[];
  } catch {
    return [];
  }
};

export const saveCompanies = (list: Company[]) => {
  localStorage.setItem(COMPANIES_KEY, JSON.stringify(list));
};

export const getActiveNit = (): string | null => {
  return localStorage.getItem(ACTIVE_KEY);
};

export const setActiveNit = (nit: string | null) => {
  if (nit) localStorage.setItem(ACTIVE_KEY, nit);
  else localStorage.removeItem(ACTIVE_KEY);
};

const histKey = (nit: string, year: number, month: number) =>
  `empresa_${nit}_conciliacion_${year}_${String(month + 1).padStart(2, "0")}`;

export const saveReconciliation = (
  nit: string,
  year: number,
  month: number,
  result: ReconciliationResult,
) => {
  try {
    localStorage.setItem(histKey(nit, year, month), JSON.stringify(result));
  } catch {}
};

export const loadReconciliation = (
  nit: string,
  year: number,
  month: number,
): ReconciliationResult | null => {
  try {
    const raw = localStorage.getItem(histKey(nit, year, month));
    if (!raw) return null;
    return JSON.parse(raw) as ReconciliationResult;
  } catch {
    return null;
  }
};

export const deleteCompany = (nit: string) => {
  // Remove company from list
  const list = loadCompanies().filter((c) => c.nit !== nit);
  saveCompanies(list);
  // Remove all history keys for that company
  const prefix = `empresa_${nit}_conciliacion_`;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  // Clear active if matches
  if (getActiveNit() === nit) setActiveNit(null);
};
