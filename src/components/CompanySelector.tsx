import { useState } from "react";
import { Building2, Plus, Trash2, ChevronDown, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Company } from "@/lib/companies";
import { toast } from "sonner";

interface Props {
  companies: Company[];
  activeNit: string | null;
  onSelect: (nit: string) => void;
  onCreate: (c: Company) => void;
  onDelete: (nit: string) => void;
}

const PALETTE = ["#2563EB","#059669","#D97706","#DC2626","#7C3AED","#DB2777","#0891B2","#EA580C"];

export function CompanySelector({ companies, activeNit, onSelect, onCreate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [nombre, setNombre] = useState("");
  const [nit, setNit] = useState("");
  const [color, setColor] = useState(PALETTE[0]);

  const active = companies.find((c) => c.nit === activeNit) ?? null;

  const handleCreate = () => {
    const cleanNit = nit.replace(/\D/g, "").trim();
    if (!nombre.trim() || !cleanNit) { toast.error("Nombre y NIT son obligatorios"); return; }
    if (companies.some((c) => c.nit === cleanNit)) { toast.error("Ya existe una empresa con ese NIT"); return; }
    onCreate({ nombre: nombre.trim(), nit: cleanNit, color });
    setNombre(""); setNit(""); setColor(PALETTE[0]);
    setCreateOpen(false); setOpen(false);
    toast.success("Empresa creada");
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-surface transition-colors min-w-[200px] shadow-sm">
            {active ? (
              <><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: active.color }} />
              <span className="truncate flex-1 text-left">{active.nombre}</span></>
            ) : (
              <><Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left text-muted-foreground">Seleccionar empresa</span></>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {companies.length === 0 && <div className="px-3 py-6 text-xs text-muted-foreground text-center">Sin empresas todavía</div>}
            {companies.map((c) => (
              <div key={c.nit}
                className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent transition-colors ${c.nit === activeNit ? "bg-accent/50" : ""}`}
                onClick={() => { onSelect(c.nit); setOpen(false); }}>
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{c.nombre}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">NIT {c.nit}</div>
                </div>
                {c.nit === activeNit && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-1 pt-1">
            <button onClick={() => { setOpen(false); setCreateOpen(true); }}
              className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-xs font-semibold text-primary hover:bg-accent transition-colors">
              <Plus className="h-3.5 w-3.5" />Nueva empresa
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
            <DialogDescription>Cada empresa guarda su propio historial de conciliaciones.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Comercial XYZ S.A.S."
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">NIT</label>
              <input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="Solo números"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Color</label>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110 shadow-md" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setCreateOpen(false)} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">Cancelar</button>
            <button onClick={handleCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Crear empresa</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará <strong>{deleteTarget?.nombre}</strong> y todo su historial. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) { onDelete(deleteTarget.nit); toast.success("Empresa eliminada"); setDeleteTarget(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
