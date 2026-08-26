import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ImagePlus, Link as LinkIcon, X, Monitor, Tablet, Smartphone } from "lucide-react";

export interface EditableBanner {
  id: string;
  image_url: string;
  image_url_tablet: string | null;
  image_url_mobile: string | null;
  title: string | null;
  link_url: string | null;
}

type DeviceKey = "desktop" | "tablet" | "mobile";

const DEVICE_META: Record<DeviceKey, { label: string; hint: string; icon: typeof Monitor; required: boolean }> = {
  desktop: { label: "Desktop", hint: "Recomendado: 1920 × 384 px (proporção 5:1)", icon: Monitor, required: true },
  tablet: { label: "Tablet", hint: "Recomendado: 1280 × 400 px (proporção ~3:1)", icon: Tablet, required: false },
  mobile: { label: "Celular", hint: "Recomendado: 800 × 400 px (proporção 2:1)", icon: Smartphone, required: false },
};

const DEVICE_ORDER: DeviceKey[] = ["desktop", "tablet", "mobile"];
const URL_FIELD: Record<DeviceKey, "image_url" | "image_url_tablet" | "image_url_mobile"> = {
  desktop: "image_url",
  tablet: "image_url_tablet",
  mobile: "image_url_mobile",
};

interface Props {
  banner: EditableBanner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const uploadFile = async (file: File): Promise<string | null> => {
  const fileExt = file.name.split(".").pop();
  const filePath = `${crypto.randomUUID()}.${fileExt}`;
  const { error } = await supabase.storage.from("banners").upload(filePath, file);
  if (error) return null;
  const { data } = supabase.storage.from("banners").getPublicUrl(filePath);
  return data.publicUrl;
};

const storagePathFromUrl = (url: string): string | null => {
  const parts = url.split("/banners/");
  return parts[parts.length - 1] || null;
};

const BannerEditDialog = ({ banner, open, onOpenChange, onSaved }: Props) => {
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  // New files selected to replace existing images
  const [files, setFiles] = useState<Record<DeviceKey, File | null>>({ desktop: null, tablet: null, mobile: null });
  const [previews, setPreviews] = useState<Record<DeviceKey, string | null>>({ desktop: null, tablet: null, mobile: null });
  // Existing image URLs (null means cleared by user)
  const [existing, setExisting] = useState<Record<DeviceKey, string | null>>({ desktop: null, tablet: null, mobile: null });

  useEffect(() => {
    if (banner) {
      setTitle(banner.title || "");
      setLinkUrl(banner.link_url || "");
      setExisting({
        desktop: banner.image_url,
        tablet: banner.image_url_tablet,
        mobile: banner.image_url_mobile,
      });
      setFiles({ desktop: null, tablet: null, mobile: null });
    }
  }, [banner]);

  useEffect(() => {
    const urls: string[] = [];
    const next: Record<DeviceKey, string | null> = { desktop: null, tablet: null, mobile: null };
    (Object.keys(files) as DeviceKey[]).forEach(key => {
      const file = files[key];
      if (file) {
        const url = URL.createObjectURL(file);
        urls.push(url);
        next[key] = url;
      }
    });
    setPreviews(next);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  const selectFile = (device: DeviceKey, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são aceitas");
      return;
    }
    setFiles(prev => ({ ...prev, [device]: file }));
  };

  const clearImage = (device: DeviceKey) => {
    setFiles(prev => ({ ...prev, [device]: null }));
    setExisting(prev => ({ ...prev, [device]: null }));
  };

  const handleSave = async () => {
    if (!banner) return;

    if (!files.desktop && !existing.desktop) {
      toast.error("A imagem de desktop é obrigatória");
      return;
    }

    const normalizedLink = linkUrl.trim();
    if (normalizedLink && !/^https?:\/\//i.test(normalizedLink)) {
      toast.error("O link deve começar com http:// ou https://");
      return;
    }

    setSaving(true);

    const update: Record<string, string | null> = {
      title: title.trim() || null,
      link_url: normalizedLink || null,
    };
    const oldPaths: string[] = [];

    for (const device of DEVICE_ORDER) {
      const field = URL_FIELD[device];
      const newFile = files[device];
      if (newFile) {
        const url = await uploadFile(newFile);
        if (!url) {
          toast.error(`Erro ao enviar imagem de ${DEVICE_META[device].label}`);
          setSaving(false);
          return;
        }
        update[field] = url;
        // mark previous image for cleanup
        const prevUrl = banner[field];
        if (prevUrl) {
          const p = storagePathFromUrl(prevUrl);
          if (p) oldPaths.push(p);
        }
      } else {
        update[field] = existing[device];
        // If user cleared an optional image, remove old file from storage
        const prevUrl = banner[field];
        if (prevUrl && !existing[device]) {
          const p = storagePathFromUrl(prevUrl);
          if (p) oldPaths.push(p);
        }
      }
    }

    const { error } = await supabase
      .from("system_banners")
      .update(update as never)
      .eq("id", banner.id);

    if (error) {
      toast.error("Erro ao salvar alterações");
      setSaving(false);
      return;
    }

    if (oldPaths.length > 0) {
      await supabase.storage.from("banners").remove(oldPaths);
    }

    toast.success("Banner atualizado!");
    setSaving(false);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar banner</DialogTitle>
          <DialogDescription>
            Altere o título, o link de redirecionamento ou substitua as imagens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-banner-title">Título (alt text)</Label>
              <Input
                id="edit-banner-title"
                placeholder="Descrição da imagem..."
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-banner-link">Link (opcional)</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-banner-link"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {DEVICE_ORDER.map(device => {
              const meta = DEVICE_META[device];
              const Icon = meta.icon;
              const shown = previews[device] || existing[device];
              return (
                <div key={device} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4 text-primary" />
                    {meta.label}
                    {meta.required && <span className="text-destructive">*</span>}
                  </div>
                  <div className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 transition-colors hover:border-primary/50 min-h-[120px]">
                    {shown ? (
                      <>
                        <img
                          src={shown}
                          alt={`Pré-visualização ${meta.label}`}
                          className="max-h-24 w-full rounded-md object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => clearImage(device)}
                          className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-destructive"
                          aria-label={`Remover imagem ${meta.label}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="h-7 w-7 text-muted-foreground" />
                        <p className="text-center text-xs text-muted-foreground">Selecionar imagem</p>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={saving}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) selectFile(device, f);
                        e.target.value = "";
                      }}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </div>
                  <p className="text-[11px] leading-tight text-muted-foreground">{meta.hint}</p>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BannerEditDialog;
