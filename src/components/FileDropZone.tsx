import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { Cloud, Database, FileSpreadsheet, X, LucideIcon } from "lucide-react";

interface FileDropZoneProps {
  label: string;
  icon: "cloud" | "database";
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const ICONS: Record<string, LucideIcon> = { cloud: Cloud, database: Database };

export function FileDropZone({ label, icon, file, onFileChange }: FileDropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = ICONS[icon];

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith(".xlsx")) onFileChange(f);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileChange(f);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{file.name}</div>
              <div className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Quitar archivo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed p-6 transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary hover:bg-primary/5"
          }`}
        >
          <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">Arrastra o haz click</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Solo archivos .xlsx</div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  );
}
