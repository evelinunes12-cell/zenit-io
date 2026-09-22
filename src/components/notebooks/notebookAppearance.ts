export const NOTEBOOK_COLORS = [
  { value: "primary", label: "Violeta", swatch: "bg-primary" },
  { value: "success", label: "Verde", swatch: "bg-success" },
  { value: "warning", label: "Amarelo", swatch: "bg-warning" },
  { value: "destructive", label: "Vermelho", swatch: "bg-destructive" },
  { value: "supporter", label: "Rosa", swatch: "bg-supporter" },
  { value: "muted", label: "Neutro", swatch: "bg-muted-foreground" },
] as const;

export const NOTEBOOK_ACCENTS: Record<string, { border: string; background: string; text: string }> = {
  primary: { border: "border-primary/30", background: "bg-primary/10", text: "text-primary" },
  success: { border: "border-success/30", background: "bg-success/10", text: "text-success" },
  warning: { border: "border-warning/30", background: "bg-warning/10", text: "text-warning" },
  destructive: { border: "border-destructive/30", background: "bg-destructive/10", text: "text-destructive" },
  supporter: { border: "border-supporter/30", background: "bg-supporter/10", text: "text-supporter" },
  muted: { border: "border-border", background: "bg-muted", text: "text-muted-foreground" },
};

export const getNotebookAccent = (color?: string | null) =>
  NOTEBOOK_ACCENTS[color || "primary"] ?? NOTEBOOK_ACCENTS.primary;
