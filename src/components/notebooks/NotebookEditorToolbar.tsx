import { useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold, ExternalLink, Heading1, Heading2, Italic, Link2, List, ListChecks, ListOrdered, Quote, Redo, Underline, Undo, Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { safeOpen, safeUrl } from "@/utils/sanitize";

export const normalizeLinkUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return safeUrl(withProtocol);
};

function ToolButton({ label, active, onClick, disabled, children }: { label: string; active?: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn("h-9 w-9 shrink-0", active && "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary")}
    >
      {children}
    </Button>
  );
}

const Divider = () => <Separator orientation="vertical" className="mx-1 h-6 shrink-0" />;

export default function NotebookEditorToolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  const openLink = (open: boolean) => {
    setLinkOpen(open);
    if (open) {
      setLinkValue(state.href);
      setLinkError("");
    }
  };

  const applyLink = () => {
    const url = normalizeLinkUrl(linkValue);
    if (!url) {
      setLinkError("Informe um link válido (http, https, e-mail ou telefone).");
      return;
    }
    const { empty } = editor.state.selection;
    if (empty && !state.link) {
      chain().insertContent({ type: "text", text: linkValue.trim(), marks: [{ type: "link", attrs: { href: url } }] }).run();
    } else {
      chain().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    chain().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <div role="toolbar" aria-label="Formatação do texto" className="flex items-center gap-0.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ToolButton label="Negrito" active={state.bold} onClick={() => chain().toggleBold().run()}><Bold className="h-4 w-4" /></ToolButton>
      <ToolButton label="Itálico" active={state.italic} onClick={() => chain().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolButton>
      <ToolButton label="Sublinhado" active={state.underline} onClick={() => chain().toggleUnderline().run()}><Underline className="h-4 w-4" /></ToolButton>
      <Divider />
      <ToolButton label="Título" active={state.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></ToolButton>
      <ToolButton label="Subtítulo" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolButton>
      <Divider />
      <ToolButton label="Lista com marcadores" active={state.bullet} onClick={() => chain().toggleBulletList().run()}><List className="h-4 w-4" /></ToolButton>
      <ToolButton label="Lista numerada" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolButton>
      <ToolButton label="Checklist" active={state.task} onClick={() => chain().toggleTaskList().run()}><ListChecks className="h-4 w-4" /></ToolButton>
      <Divider />
      <ToolButton label="Citação" active={state.quote} onClick={() => chain().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolButton>
      <Popover open={linkOpen} onOpenChange={openLink}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Link"
            title="Link"
            aria-pressed={state.link}
            onMouseDown={(event) => event.preventDefault()}
            className={cn("h-9 w-9 shrink-0", state.link && "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary")}
          >
            <Link2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] space-y-3">
          <form onSubmit={(event) => { event.preventDefault(); applyLink(); }} className="space-y-2">
            <label htmlFor="notebook-link-url" className="text-sm font-medium">Endereço do link</label>
            <Input
              id="notebook-link-url"
              autoFocus
              inputMode="url"
              placeholder="https://exemplo.com"
              value={linkValue}
              onChange={(event) => { setLinkValue(event.target.value); setLinkError(""); }}
              aria-invalid={!!linkError}
            />
            {linkError && <p className="text-xs text-destructive">{linkError}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {state.link && (
                <>
                  <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => safeOpen(state.href)}><ExternalLink className="h-3.5 w-3.5" />Abrir</Button>
                  <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={removeLink}><Unlink className="h-3.5 w-3.5" />Remover</Button>
                </>
              )}
              <Button type="submit" size="sm">{state.link ? "Atualizar" : "Inserir"}</Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
      <Divider />
      <ToolButton label="Desfazer" disabled={!state.canUndo} onClick={() => chain().undo().run()}><Undo className="h-4 w-4" /></ToolButton>
      <ToolButton label="Refazer" disabled={!state.canRedo} onClick={() => chain().redo().run()}><Redo className="h-4 w-4" /></ToolButton>
    </div>
  );
}
