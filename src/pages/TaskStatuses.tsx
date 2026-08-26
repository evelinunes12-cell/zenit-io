import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight, LayoutDashboard, Columns3, GripVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TaskStatus {
  id: string;
  name: string;
  color: string | null;
  is_default: boolean;
  order_index: number;
  parent_id: string | null;
  show_in_dashboard: boolean;
  show_in_kanban: boolean;
  children?: TaskStatus[];
}

// Sortable Card Component
function SortableStatusCard({
  status,
  expandedParents,
  toggleExpand,
  handleOpenDialog,
  handleDeleteStatus,
}: {
  status: TaskStatus;
  expandedParents: Set<string>;
  toggleExpand: (id: string) => void;
  handleOpenDialog: (status?: TaskStatus, isChild?: boolean, preselectedParentId?: string) => void;
  handleDeleteStatus: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <Collapsible
        open={expandedParents.has(status.id)}
        onOpenChange={() => toggleExpand(status.id)}
      >
        <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1.5 -m-1 rounded hover:bg-muted touch-none shrink-0"
                aria-label="Arrastar para reordenar"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  {expandedParents.has(status.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <div
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: status.color || "#3b82f6" }}
              />
              <CardTitle className="text-base sm:text-lg truncate">{status.name}</CardTitle>
            </div>
            <div className="flex gap-0.5 sm:gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-9 sm:w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDialog(undefined, true, status.id);
                }}
                title="Adicionar status filho"
                aria-label="Adicionar status filho"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDialog(status);
                }}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {!status.is_default && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteStatus(status.id);
                  }}
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {/* Badges row — wraps below on mobile to keep header tidy */}
          <div className="flex flex-wrap gap-1 mt-1 ml-9 sm:ml-12">
            {status.is_default && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Padrão</Badge>
            )}
            {status.children && status.children.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {status.children.length} {status.children.length === 1 ? 'filho' : 'filhos'}
              </Badge>
            )}
            {status.show_in_dashboard && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 flex items-center gap-1">
                <LayoutDashboard className="h-3 w-3" />
              </Badge>
            )}
            {status.show_in_kanban && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 flex items-center gap-1">
                <Columns3 className="h-3 w-3" />
              </Badge>
            )}
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 sm:pb-4 px-3 sm:px-4">
            {status.children && status.children.length > 0 ? (
              <div className="ml-6 sm:ml-8 space-y-2">
                {status.children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/50 border"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: child.color || "#3b82f6" }}
                      />
                      <span className="font-medium text-sm truncate">{child.name}</span>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleOpenDialog(child)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleDeleteStatus(child.id)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ml-6 sm:ml-8 text-sm text-muted-foreground">
                Nenhum status filho. Toque em + para adicionar.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function TaskStatuses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [hierarchicalStatuses, setHierarchicalStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<TaskStatus | null>(null);
  const [statusName, setStatusName] = useState("");
  const [statusColor, setStatusColor] = useState("#3b82f6");
  const [parentId, setParentId] = useState<string | null>(null);
  const [showInDashboard, setShowInDashboard] = useState(true);
  const [showInKanban, setShowInKanban] = useState(true);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchStatuses();
    }
  }, [user]);

  const fetchStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from("task_statuses")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;
      
      const allStatuses = (data || []) as TaskStatus[];
      setStatuses(allStatuses);
      
      // Organize into hierarchy
      const parents = allStatuses.filter(s => !s.parent_id);
      const children = allStatuses.filter(s => s.parent_id);
      
      const hierarchical = parents.map(parent => ({
        ...parent,
        children: children.filter(child => child.parent_id === parent.id)
      }));
      
      setHierarchicalStatuses(hierarchical);
      
      // Auto-expand parents that have children
      const parentsWithChildren = new Set(
        hierarchical.filter(p => p.children && p.children.length > 0).map(p => p.id)
      );
      setExpandedParents(parentsWithChildren);
    } catch (error) {
      toast({
        title: "Erro ao carregar status",
        description: "Não foi possível carregar os status.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (status?: TaskStatus, isChild: boolean = false, preselectedParentId?: string) => {
    if (status) {
      setEditingStatus(status);
      setStatusName(status.name);
      setStatusColor(status.color || "#3b82f6");
      setParentId(status.parent_id);
      setShowInDashboard(status.show_in_dashboard);
      setShowInKanban(status.show_in_kanban);
    } else {
      setEditingStatus(null);
      setStatusName("");
      setStatusColor("#3b82f6");
      setParentId(isChild && preselectedParentId ? preselectedParentId : null);
      setShowInDashboard(true);
      setShowInKanban(true);
    }
    setDialogOpen(true);
  };

  const handleSaveStatus = async () => {
    if (!statusName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insira um nome para o status.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingStatus) {
        const updateData: Record<string, unknown> = { 
          name: statusName, 
          color: statusColor,
          parent_id: parentId 
        };
        
        // Only include visibility options for parent statuses
        if (!parentId) {
          updateData.show_in_dashboard = showInDashboard;
          updateData.show_in_kanban = showInKanban;
        }

        const { error } = await supabase
          .from("task_statuses")
          .update(updateData as never)
          .eq("id", editingStatus.id);

        if (error) throw error;
        toast({
          title: "Status atualizado",
          description: "O status foi atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("task_statuses")
          .insert({
            name: statusName, 
            color: statusColor, 
            user_id: user?.id as string,
            parent_id: parentId,
            is_default: false, // New statuses are never default - only the original 3 are default
            show_in_dashboard: !parentId ? showInDashboard : true,
            show_in_kanban: !parentId ? showInKanban : true,
          });

        if (error) throw error;
        toast({
          title: "Status criado",
          description: "O status foi criado com sucesso.",
        });
      }

      setDialogOpen(false);
      fetchStatuses();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar status",
        description: error.message || "Não foi possível salvar o status.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteStatus = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este status? Os status filhos também serão excluídos.")) return;

    try {
      const { error } = await supabase.from("task_statuses").delete().eq("id", id);

      if (error) throw error;
      toast({
        title: "Status excluído",
        description: "O status foi excluído com sucesso.",
      });
      fetchStatuses();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir status",
        description: error.message || "Não foi possível excluir o status.",
        variant: "destructive",
      });
    }
  };

  const toggleExpand = (parentId: string) => {
    setExpandedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  };

  const parentStatuses = statuses.filter(s => !s.parent_id);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = hierarchicalStatuses.findIndex((s) => s.id === active.id);
      const newIndex = hierarchicalStatuses.findIndex((s) => s.id === over.id);

      const reorderedStatuses = arrayMove(hierarchicalStatuses, oldIndex, newIndex);
      setHierarchicalStatuses(reorderedStatuses);

      // Update order_index in database
      try {
        const updates = reorderedStatuses.map((status, index) => ({
          id: status.id,
          order_index: index,
        }));

        for (const update of updates) {
          await supabase
            .from("task_statuses")
            .update({ order_index: update.order_index })
            .eq("id", update.id);
        }

        toast({
          title: "Ordem atualizada",
          description: "A ordem dos status foi salva com sucesso.",
        });
      } catch (error) {
        toast({
          title: "Erro ao salvar ordem",
          description: "Não foi possível salvar a nova ordem.",
          variant: "destructive",
        });
        fetchStatuses(); // Revert on error
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 sm:h-16 items-center gap-3 px-3 sm:px-4">
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-lg sm:text-2xl font-bold truncate">Status de Tarefas</h1>
        </div>
      </header>

      <main className="container py-4 sm:py-8 px-3 sm:px-4">
        <div className="mb-4 sm:mb-6 flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => handleOpenDialog()} size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              <span className="ml-1">Novo Status Pai</span>
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Arraste pelo ícone <GripVertical className="h-3.5 w-3.5 inline" /> para reordenar.
          </p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={hierarchicalStatuses.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {hierarchicalStatuses.map((status) => (
                <SortableStatusCard
                  key={status.id}
                  status={status}
                  expandedParents={expandedParents}
                  toggleExpand={toggleExpand}
                  handleOpenDialog={handleOpenDialog}
                  handleDeleteStatus={handleDeleteStatus}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {hierarchicalStatuses.length === 0 && (
          <p className="text-center text-muted-foreground mt-8">
            Nenhum status cadastrado. Clique em "Novo Status Pai" para começar.
          </p>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStatus ? "Editar Status" : parentId ? "Novo Status Filho" : "Novo Status Pai"}
            </DialogTitle>
            <DialogDescription>
              {parentId 
                ? "Este status será associado ao status pai selecionado."
                : "Status pai podem ter status filhos associados."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={statusName}
                onChange={(e) => setStatusName(e.target.value)}
                placeholder="Nome do status"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="color">Cor</Label>
              <Input
                id="color"
                type="color"
                value={statusColor}
                onChange={(e) => setStatusColor(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="parent">Status Pai (opcional)</Label>
              <Select
                value={parentId || "none"}
                onValueChange={(value) => setParentId(value === "none" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um status pai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (será um status pai)</SelectItem>
                  {parentStatuses
                    .filter(s => s.id !== editingStatus?.id)
                    .map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: status.color || "#3b82f6" }}
                          />
                          {status.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Visibility options - only for parent statuses */}
            {!parentId && (
              <div className="space-y-4 pt-2 border-t">
                <p className="text-sm font-medium text-muted-foreground">Visibilidade</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="show-dashboard" className="font-normal">
                      Mostrar na Widget do Dashboard
                    </Label>
                  </div>
                  <Switch
                    id="show-dashboard"
                    checked={showInDashboard}
                    onCheckedChange={setShowInDashboard}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Columns3 className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="show-kanban" className="font-normal">
                      Mostrar na Visão Kanban
                    </Label>
                  </div>
                  <Switch
                    id="show-kanban"
                    checked={showInKanban}
                    onCheckedChange={setShowInKanban}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveStatus}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}