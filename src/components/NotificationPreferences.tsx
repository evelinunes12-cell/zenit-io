import { useState, useEffect } from "react";
import { Loader2, Bell, BellOff, Monitor, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Preferences {
  tasks_system: boolean;
  tasks_push: boolean;
  schedules_system: boolean;
  schedules_push: boolean;
  goals_system: boolean;
  goals_push: boolean;
  notes_system: boolean;
  notes_push: boolean;
  study_cycle_system: boolean;
  study_cycle_push: boolean;
}

const defaultPrefs: Preferences = {
  tasks_system: true,
  tasks_push: true,
  schedules_system: true,
  schedules_push: true,
  goals_system: true,
  goals_push: true,
  notes_system: true,
  notes_push: true,
  study_cycle_system: true,
  study_cycle_push: true,
};

const categories = [
  { key: "tasks", label: "Tarefas", description: "Prazos, atrasos e atualizações de tarefas" },
  { key: "schedules", label: "Horários", description: "Lembretes de blocos de estudo e horários" },
  { key: "goals", label: "Metas", description: "Metas do planner com prazo próximo ou atrasadas" },
  { key: "notes", label: "Anotações", description: "Anotações planejadas para hoje ou atrasadas" },
  { key: "study_cycle", label: "Ciclo de Estudo", description: "Progresso e lembretes do ciclo de estudo" },
] as const;

type CategoryKey = (typeof categories)[number]["key"];

const NotificationPreferences = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPrefs({
          tasks_system: data.tasks_system,
          tasks_push: data.tasks_push,
          schedules_system: data.schedules_system,
          schedules_push: data.schedules_push,
          goals_system: data.goals_system,
          goals_push: data.goals_push,
          notes_system: data.notes_system,
          notes_push: data.notes_push,
          study_cycle_system: data.study_cycle_system,
          study_cycle_push: data.study_cycle_push,
        });
      } else {
        // Create default row
        await supabase.from("notification_preferences").insert({ user_id: user.id });
      }
    } catch (err) {
      console.error("Error loading notification preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  const updatePref = async (key: keyof Preferences, value: boolean) => {
    if (!user) return;
    const prev = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaving(true);

    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          { user_id: user.id, [key]: value } as never,
          { onConflict: "user_id" }
        );

      if (error) throw error;
    } catch {
      setPrefs((p) => ({ ...p, [key]: prev }));
      toast.error("Erro ao salvar preferência.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Preferências de Notificação
        </CardTitle>
        <CardDescription>
          Escolha quais notificações deseja receber no sistema (sino) e via push (celular/desktop).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 items-center px-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoria</span>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide w-20 justify-center">
            <Monitor className="h-3.5 w-3.5" />
            Sistema
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide w-20 justify-center">
            <Smartphone className="h-3.5 w-3.5" />
            Push
          </div>
        </div>

        <Separator />

        {categories.map((cat, idx) => {
          const systemKey = `${cat.key}_system` as keyof Preferences;
          const pushKey = `${cat.key}_push` as keyof Preferences;

          return (
            <div key={cat.key}>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 sm:gap-4 items-start sm:items-center py-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>

                {/* Mobile labels */}
                <div className="flex items-center justify-between sm:justify-center gap-2 sm:w-20">
                  <span className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                    <Monitor className="h-3.5 w-3.5" /> Sistema
                  </span>
                  <Switch
                    checked={prefs[systemKey]}
                    onCheckedChange={(v) => updatePref(systemKey, v)}
                    disabled={saving}
                    aria-label={`${cat.label} - Sistema`}
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-center gap-2 sm:w-20">
                  <span className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                    <Smartphone className="h-3.5 w-3.5" /> Push
                  </span>
                  <Switch
                    checked={prefs[pushKey]}
                    onCheckedChange={(v) => updatePref(pushKey, v)}
                    disabled={saving}
                    aria-label={`${cat.label} - Push`}
                  />
                </div>
              </div>
              {idx < categories.length - 1 && <Separator />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default NotificationPreferences;
