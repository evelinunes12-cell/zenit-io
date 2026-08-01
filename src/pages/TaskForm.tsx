import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Upload, X, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import TaskStepForm, { TaskStep } from "@/components/TaskStepForm";
import { Separator } from "@/components/ui/separator";
import ChecklistManager, { ChecklistItem } from "@/components/ChecklistManager";
import { fetchEnvironmentSubjects, fetchEnvironmentStatusesHierarchical } from "@/services/environmentData";
import TaskAssigneesManager from "@/components/environments/TaskAssigneesManager";
import { fetchTaskAssignees, setTaskAssignees as persistTaskAssignees } from "@/services/taskAssignees";
import HierarchicalStatusSelect, { HierarchicalStatus } from "@/components/HierarchicalStatusSelect";
import { logError } from "@/lib/logger";
import { taskFormSchema, linkSchema, checklistSchema } from "@/lib/validation";

import { registerActivity } from "@/services/activity";
import { logXP, logXPForTaskAssignees, XP } from "@/services/scoring";


const TaskForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(id);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if we're creating a task within an environment
  const urlEnvironmentId = searchParams.get('environment');
  const isFromEnvironment = Boolean(urlEnvironmentId);

  const [loading, setLoading] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [isGroupWork, setIsGroupWork] = useState(false);
  const [groupMembers, setGroupMembers] = useState("");
  const [googleDocsLink, setGoogleDocsLink] = useState("");
  const [canvaLink, setCanvaLink] = useState("");
  const [status, setStatus] = useState("");
  const [environmentId, setEnvironmentId] = useState<string | null>(urlEnvironmentId);
  const [environments, setEnvironments] = useState<{ id: string; environment_name: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<{ name: string; url: string }[]>([]);
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [existingSubjects, setExistingSubjects] = useState<string[]>([]);
  const [openSubjectCombo, setOpenSubjectCombo] = useState(false);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [existingStatuses, setExistingStatuses] = useState<HierarchicalStatus[]>([]);
  const [openStatusCombo, setOpenStatusCombo] = useState(false);
  const [environmentName, setEnvironmentName] = useState<string>("");
  const [environmentRestricted, setEnvironmentRestricted] = useState(false);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      if (!isFromEnvironment) {
        fetchEnvironments();
      }
      
      // If we're in an environment context, fetch environment-specific data
      if (urlEnvironmentId) {
        fetchEnvironmentData();
      } else {
        fetchExistingSubjects();
        fetchExistingStatuses();
      }
    }
  }, [user, urlEnvironmentId]);

  useEffect(() => {
    if (isEditing && id) {
      fetchTask();
    }
  }, [isEditing, id]);

  // When environmentId changes (only when not from URL), reload subjects/statuses
  useEffect(() => {
    if (user && !isEditing && !isFromEnvironment) {
      if (environmentId) {
        fetchEnvironmentData();
      } else {
        fetchExistingSubjects();
        fetchExistingStatuses();
      }
      // Reset subject and status when switching environments
      setSubjectName("");
      setStatus("");
    }
  }, [environmentId]);

  const fetchEnvironmentData = async () => {
    const envId = urlEnvironmentId || environmentId;
    if (!envId) return;

    try {
      // Fetch environment name
      const { data: envData } = await supabase
        .from("shared_environments")
        .select("environment_name, restrict_tasks_to_assignees")
        .eq("id", envId)
        .single();

      if (envData) {
        setEnvironmentName(envData.environment_name);
        setEnvironmentRestricted(Boolean((envData as any).restrict_tasks_to_assignees));
      }

      // Fetch environment subjects
      const subjects = await fetchEnvironmentSubjects(envId);
      setExistingSubjects(subjects.map(s => s.name));

      // Fetch environment statuses (hierarchical)
      const statuses = await fetchEnvironmentStatusesHierarchical(envId);
      setExistingStatuses(statuses);
    } catch (error) {
      logError("Error fetching environment data", error);
      // Fallback to user's personal subjects/statuses
      fetchExistingSubjects();
      fetchExistingStatuses();
    }
  };

  const fetchExistingSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      const subjectNames = data.map(subject => subject.name);
      setExistingSubjects(subjectNames);
    } catch (error) {
      logError("Error fetching subjects", error);
    }
  };

  const fetchExistingStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from("task_statuses")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;

      const allStatuses = (data || []) as HierarchicalStatus[];
      const parents = allStatuses.filter(s => !s.parent_id);
      const children = allStatuses.filter(s => s.parent_id);
      const hierarchical = parents.map(parent => ({
        ...parent,
        children: children.filter(child => child.parent_id === parent.id),
      }));
      setExistingStatuses(hierarchical);
    } catch (error) {
      logError("Error fetching statuses", error);
    }
  };

  const fetchEnvironments = async () => {
    try {
      const { data, error } = await supabase
        .from("shared_environments")
        .select("id, environment_name")
        .order("environment_name");

      if (error) throw error;

      setEnvironments(data || []);
    } catch (error) {
      logError("Error fetching environments", error);
    }
  };

  const ensureSubjectExists = async (subjectName: string) => {
    // If we're in an environment context, don't create personal subjects
    if (environmentId) return;

    try {
      // Verifica se a disciplina já existe
      const { data: existingSubject } = await supabase
        .from("subjects")
        .select("id")
        .eq("name", subjectName)
        .eq("user_id", user!.id)
        .single();

      // Se não existir, cria
      if (!existingSubject) {
        await supabase
          .from("subjects")
          .insert({
            name: subjectName,
            user_id: user!.id,
            color: null,
          });
      }
    } catch (error) {
      logError("Error ensuring subject exists", error);
    }
  };

  const ensureStatusExists = async (statusName: string) => {
    // If we're in an environment context, don't create personal statuses
    if (environmentId) return;

    try {
      // Verifica se o status já existe
      const { data: existingStatus } = await supabase
        .from("task_statuses")
        .select("id")
        .eq("name", statusName)
        .eq("user_id", user!.id)
        .single();

      // Se não existir, cria
      if (!existingStatus) {
        await supabase
          .from("task_statuses")
          .insert({
            name: statusName,
            user_id: user!.id,
            color: null,
          });
      }
    } catch (error) {
      logError("Error ensuring status exists", error);
    }
  };

  const fetchTask = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setSubjectName(data.subject_name);
      setDescription(data.description || "");
      
      // Corrige a leitura da data sem aplicar timezone
      if (data.due_date) {
        const parts = data.due_date.split("-");
        const normalized = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        setDueDate(normalized);
      }
      
      setIsGroupWork(data.is_group_work);
      setGroupMembers(data.group_members || "");
      setGoogleDocsLink(data.google_docs_link || "");
      setCanvaLink(data.canva_link || "");
      setStatus(data.status);
      // Garante que itens do checklist tenham IDs
      const rawChecklist = (data.checklist as any) || [];
      const checklistWithIds = rawChecklist.map((item: any, index: number) => ({
        id: item.id || `item-${Date.now()}-${index}`,
        text: item.text || "",
        completed: Boolean(item.completed),
      }));
      setChecklist(checklistWithIds);
      setEnvironmentId(data.environment_id);
      
      // If editing a task with environment, load environment data
      if (data.environment_id) {
        const subjects = await fetchEnvironmentSubjects(data.environment_id);
        setExistingSubjects(subjects.map(s => s.name));
        const statuses = await fetchEnvironmentStatusesHierarchical(data.environment_id);
        setExistingStatuses(statuses);

        // Load environment privacy flag
        const { data: envRow } = await supabase
          .from("shared_environments")
          .select("environment_name, restrict_tasks_to_assignees")
          .eq("id", data.environment_id)
          .single();
        if (envRow) {
          setEnvironmentName(envRow.environment_name);
          setEnvironmentRestricted(Boolean((envRow as any).restrict_tasks_to_assignees));
        }

        // Load existing assignees
        try {
          const assignees = await fetchTaskAssignees(id!);
          setAssignedUserIds(assignees.map((a) => a.user_id));
        } catch (e) {
          logError("loading task assignees", e);
        }
      }
      
      // Fetch existing links
      const { data: attachmentsData } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", id)
        .eq("is_link", true);

      if (attachmentsData) {
        setLinks(attachmentsData.map(att => ({
          name: att.file_name,
          url: att.file_path
        })));
      }

      // Fetch existing steps
      const { data: stepsData } = await supabase
        .from("task_steps")
        .select("*")
        .eq("task_id", id)
        .order("order_index");

      if (stepsData) {
        const formattedSteps: TaskStep[] = stepsData.map(step => {
          let stepDueDate = undefined;
          if (step.due_date) {
            const parts = step.due_date.split("-");
            stepDueDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          }
          
          return {
            id: step.id,
            title: step.title,
            description: step.description || "",
            dueDate: stepDueDate,
            status: step.status,
            googleDocsLink: step.google_docs_link || "",
            canvaLink: step.canva_link || "",
            files: [],
            links: [],
            checklist: (step.checklist as any) || [],
            isExpanded: false,
          };
        });

        // Fetch attachments for each step
        for (let i = 0; i < formattedSteps.length; i++) {
          const stepId = stepsData[i].id;
          const { data: stepAttachments } = await supabase
            .from("task_step_attachments")
            .select("*")
            .eq("task_step_id", stepId);

          if (stepAttachments) {
            formattedSteps[i].links = stepAttachments
              .filter(att => att.is_link)
              .map(att => ({
                name: att.file_name,
                url: att.file_path,
              }));
          }
        }

        setSteps(formattedSteps);
      }
    } catch (error) {
      logError("Error fetching task", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar tarefa",
        description: "Tente novamente mais tarde.",
      });
    }
  };

  // Allowed file types for uploads
  const ALLOWED_FILE_TYPES = ['image/', 'application/pdf', 'application/vnd.', 'text/', 'application/msword', 'application/zip'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      
      for (const file of selectedFiles) {
        // Validate file type
        const isAllowedType = ALLOWED_FILE_TYPES.some(type => file.type.startsWith(type));
        if (!isAllowedType) {
          toast({
            variant: "destructive",
            title: "Tipo de arquivo não permitido",
            description: `O arquivo "${file.name}" não é um tipo permitido.`,
          });
          continue;
        }
        
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          toast({
            variant: "destructive",
            title: "Arquivo muito grande",
            description: `O arquivo "${file.name}" excede o limite de 10MB.`,
          });
          continue;
        }
        
        validFiles.push(file);
      }
      
      // Add new files to existing list instead of replacing
      setFiles(prevFiles => [...prevFiles, ...validFiles]);
      
      // Reset input value to allow selecting same files again
      e.target.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const addLink = () => {
    const validation = linkSchema.safeParse({ name: newLinkName, url: newLinkUrl });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Link inválido",
        description: validation.error.errors[0]?.message || "Verifique os dados do link.",
      });
      return;
    }
    setLinks([...links, { name: validation.data.name, url: validation.data.url }]);
    setNewLinkName("");
    setNewLinkUrl("");
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const uploadFiles = async (taskId: string) => {
    if (files.length === 0 && links.length === 0) return;

    setUploading(true);
    try {
      // Upload files
      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user!.id}/${taskId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("task-attachments")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from("task_attachments")
          .insert({
            task_id: taskId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            is_link: false,
          });

        if (dbError) throw dbError;
      }

      // Save links
      for (const link of links) {
        const { error: dbError } = await supabase
          .from("task_attachments")
          .insert({
            task_id: taskId,
            file_name: link.name,
            file_path: link.url,
            file_size: null,
            file_type: null,
            is_link: true,
          });

        if (dbError) throw dbError;
      }
    } catch (error) {
      logError("Error uploading files", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const saveSteps = async (taskId: string) => {
    if (steps.length === 0) return;

    try {
      // Delete existing steps if editing
      if (isEditing) {
        await supabase
          .from("task_steps")
          .delete()
          .eq("task_id", taskId);
      }

      // Insert new steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Corrige o fuso horário local antes de salvar
        let stepDueDate = null;
        if (step.dueDate) {
          const adjusted = new Date(step.dueDate);
          adjusted.setMinutes(adjusted.getMinutes() - adjusted.getTimezoneOffset());
          stepDueDate = adjusted.toISOString().split("T")[0];
        }

        const { data: stepData, error: stepError } = await supabase
          .from("task_steps")
          .insert({
            task_id: taskId,
            title: step.title,
            description: step.description || null,
            due_date: stepDueDate,
            status: step.status,
            google_docs_link: step.googleDocsLink || null,
            canva_link: step.canvaLink || null,
            order_index: i,
            checklist: checklistSchema.parse(step.checklist || []) as any,
          })
          .select()
          .single();

        if (stepError) throw stepError;

        // Upload step files
        for (const file of step.files) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${user!.id}/${taskId}/steps/${stepData.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("task-attachments")
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { error: dbError } = await supabase
            .from("task_step_attachments")
            .insert({
              task_step_id: stepData.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
              is_link: false,
            });

          if (dbError) throw dbError;
        }

        // Save step links
        for (const link of step.links) {
          const { error: dbError } = await supabase
            .from("task_step_attachments")
            .insert({
              task_step_id: stepData.id,
              file_name: link.name,
              file_path: link.url,
              file_size: null,
              file_type: null,
              is_link: true,
            });

          if (dbError) throw dbError;
        }
      }
    } catch (error) {
      logError("Error saving steps", error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data using Zod schema
      const validation = taskFormSchema.safeParse({
        subject_name: subjectName,
        description: description || undefined,
        google_docs_link: googleDocsLink || undefined,
        canva_link: canvaLink || undefined,
        group_members: groupMembers || undefined,
        status,
      });

      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast({
          variant: "destructive",
          title: "Dados inválidos",
          description: firstError?.message || "Verifique os campos do formulário.",
        });
        setLoading(false);
        return;
      }

      const validatedData = validation.data;

      // Garanta que a disciplina existe na tabela subjects (only for personal tasks)
      await ensureSubjectExists(validatedData.subject_name);
      
      // Garante que o status existe na tabela task_statuses (only for personal tasks)
      await ensureStatusExists(validatedData.status);

      // Corrige o fuso horário local antes de salvar no Supabase
      let localDueDate = null;
      if (dueDate) {
        const adjusted = new Date(dueDate);
        adjusted.setMinutes(adjusted.getMinutes() - adjusted.getTimezoneOffset());
        localDueDate = adjusted.toISOString().split("T")[0]; // garante formato yyyy-MM-dd
      }

      const taskData = {
        subject_name: validatedData.subject_name,
        description: validatedData.description || null,
        due_date: localDueDate,
        is_group_work: isGroupWork,
        group_members: isGroupWork ? (validatedData.group_members || null) : null,
        google_docs_link: validatedData.google_docs_link || null,
        canva_link: validatedData.canva_link || null,
        status: validatedData.status,
        user_id: user!.id,
        checklist: checklistSchema.parse(checklist) as any,
        environment_id: environmentId,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", id);

        if (error) throw error;

        // Delete existing links if editing
        await supabase
          .from("task_attachments")
          .delete()
          .eq("task_id", id)
          .eq("is_link", true);

        if (files.length > 0 || links.length > 0) {
          await uploadFiles(id!);
        }

        await saveSteps(id!);

        // Persist assignees for environment tasks
        if (environmentId && user) {
          try {
            await persistTaskAssignees(id!, assignedUserIds, user.id);
          } catch (e) {
            logError("persist task assignees (edit)", e);
            toast({
              variant: "destructive",
              title: "Não foi possível salvar os vínculos",
              description: (e as any)?.message || "Tente novamente.",
            });
          }
        }

        toast({
          title: "Tarefa atualizada",
          description: "As alterações foram salvas com sucesso.",
        });
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert(taskData)
          .select()
          .single();

        if (error) throw error;

        if (files.length > 0 || links.length > 0) {
          await uploadFiles(data.id);
        }

        await saveSteps(data.id);

        // Persist assignees for environment tasks
        if (environmentId && user && assignedUserIds.length > 0) {
          try {
            await persistTaskAssignees(data.id, assignedUserIds, user.id);
          } catch (e) {
            logError("persist task assignees (create)", e);
            toast({
              variant: "destructive",
              title: "Não foi possível salvar os vínculos",
              description: (e as any)?.message || "Tente novamente.",
            });
          }
        }

        toast({
          title: "Tarefa criada",
          description: "Sua nova tarefa foi adicionada com sucesso.",
        });
      }

      // Registra atividade para a ofensiva
      if (user) {
        registerActivity(user.id);
        logXP(user.id, isEditing ? "edit_basic" : "create_task", isEditing ? XP.EDIT_BASIC : XP.CREATE_ITEM);
        if (isEditing && id) {
          logXPForTaskAssignees(id, "edit_basic");
        }
      }

      // Invalida o cache de tarefas para forçar atualização na Dashboard
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });

      // Navigate back to the appropriate page
      if (environmentId) {
        navigate(`/environment/${environmentId}`);
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      logError("Error saving task", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar tarefa",
        description: "Tente novamente mais tarde.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar minimal />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {isEditing ? "Editar Tarefa" : "Nova Tarefa"}
            </CardTitle>
            {isFromEnvironment && environmentName && (
              <CardDescription>
                Criando tarefa no ambiente: <strong>{environmentName}</strong>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="subject">Nome da Disciplina *</Label>
                <Popover open={openSubjectCombo} onOpenChange={setOpenSubjectCombo}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openSubjectCombo}
                      className="w-full justify-between"
                    >
                      {subjectName || "Selecione ou digite uma disciplina..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Pesquisar ou adicionar disciplina..." 
                        value={subjectName}
                        onValueChange={setSubjectName}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="text-sm p-2">
                            {subjectName ? (
                              environmentId ? (
                                <span className="text-muted-foreground">
                                  Disciplina "{subjectName}" não encontrada. Peça ao proprietário do ambiente para adicionar.
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setOpenSubjectCombo(false)}
                                  className="w-full text-left hover:bg-accent rounded p-2"
                                >
                                  Criar "{subjectName}"
                                </button>
                              )
                            ) : (
                              "Digite o nome da disciplina"
                            )}
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {existingSubjects.map((subject) => (
                            <CommandItem
                              key={subject}
                              value={subject}
                              onSelect={(value) => {
                                setSubjectName(value);
                                setOpenSubjectCombo(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  subjectName === subject ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {subject}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {existingSubjects.length === 0 && environmentId && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma disciplina configurada para este ambiente. O proprietário precisa adicionar disciplinas nas configurações.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Descrição da Tarefa</Label>
                <RichTextEditor
                  content={description}
                  onChange={setDescription}
                  placeholder="Descreva os detalhes da tarefa..."
                  minHeight="100px"
                />
              </div>

              <div className="space-y-2">
                <Label>Data de Entrega</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP", { locale: ptBR }) : "Selecione uma data (opcional)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                      className="pointer-events-auto"
                      modifiers={{
                        weekend: (date) => date.getDay() === 0 || date.getDay() === 6,
                      }}
                      modifiersClassNames={{
                        weekend: "text-red-500",
                      }}
                      disabled={() => false}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status da Tarefa *</Label>
                <HierarchicalStatusSelect
                  value={status}
                  onChange={setStatus}
                  statuses={existingStatuses}
                  open={openStatusCombo}
                  onOpenChange={setOpenStatusCombo}
                  allowCreate={!environmentId}
                  environmentId={environmentId}
                />
                {existingStatuses.length === 0 && environmentId && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum status configurado para este ambiente. O proprietário precisa adicionar status nas configurações.
                  </p>
                )}
              </div>

              {/* Only show environment selector when NOT coming from an environment */}
              {!isFromEnvironment && !isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="environment">Grupo de Trabalho</Label>
                  <Select
                    value={environmentId || "personal"}
                    onValueChange={(value) => setEnvironmentId(value === "personal" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Sem grupo (Pessoal)</SelectItem>
                      {environments.map((env) => (
                        <SelectItem key={env.id} value={env.id}>
                          {env.environment_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Tarefas pessoais são visíveis apenas para você. Tarefas em grupos são visíveis para todos os membros.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="googleDocs">Link do Trabalho Escrito</Label>
                <Input
                  id="googleDocs"
                  type="url"
                  value={googleDocsLink}
                  onChange={(e) => setGoogleDocsLink(e.target.value)}
                  placeholder="https://docs.google.com/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="canva">Link da Apresentação</Label>
                <Input
                  id="canva"
                  type="url"
                  value={canvaLink}
                  onChange={(e) => setCanvaLink(e.target.value)}
                  placeholder="https://www.canva.com/..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="groupWork"
                  checked={isGroupWork}
                  onCheckedChange={(checked) => setIsGroupWork(checked as boolean)}
                />
                <Label htmlFor="groupWork" className="cursor-pointer">
                  É um trabalho em grupo?
                </Label>
              </div>

              {isGroupWork && (
                <div className="space-y-2">
                  <Label htmlFor="groupMembers">Participantes do Grupo</Label>
                  <Textarea
                    id="groupMembers"
                    value={groupMembers}
                    onChange={(e) => setGroupMembers(e.target.value)}
                    placeholder="Nome dos participantes (um por linha)"
                    rows={3}
                  />
                </div>
              )}

              {environmentId && (
                <div className="rounded-lg border p-4">
                  <TaskAssigneesManager
                    environmentId={environmentId}
                    selectedUserIds={assignedUserIds}
                    onChange={setAssignedUserIds}
                    restrictedMode={environmentRestricted}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="files">Anexar Arquivos</Label>
                <Input
                  id="files"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                {files.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-secondary rounded-lg"
                      >
                        <span className="text-sm truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Anexar Links</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Nome do link"
                    value={newLinkName}
                    onChange={(e) => setNewLinkName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="URL do link"
                      type="url"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                    />
                    <Button
                      type="button"
                      onClick={addLink}
                      disabled={!newLinkName || !newLinkUrl}
                    >
                      Adicionar
                    </Button>
                  </div>
                </div>
                {links.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {links.map((link, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-secondary rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{link.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLink(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator className="my-6" />

              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label>Checklist da Tarefa</Label>
              </div>


              <ChecklistManager
                items={checklist}
                onItemsChange={setChecklist}
                label=""
                showProgress
              />

              <Separator className="my-6" />

              <TaskStepForm steps={steps} onStepsChange={setSteps} />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => environmentId ? navigate(`/environment/${environmentId}`) : navigate("/dashboard")}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading || uploading} className="flex-1">
                  {loading || uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploading ? "Enviando arquivos..." : "Salvando..."}
                    </>
                  ) : isEditing ? (
                    "Atualizar Tarefa"
                  ) : (
                    "Criar Tarefa"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TaskForm;
