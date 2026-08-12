import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Mountain, LogOut, Plus, ArrowLeft, Sun, Moon, ListTodo, StickyNote, Target, ChevronDown, BookOpenCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import ShortcutsHelpDialog from "./ShortcutsHelpDialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSubjects } from "@/services/subjects";
import { createNote, createGoal } from "@/services/planner";
import { NoteDialog } from "@/components/planner/NoteDialog";
import { GoalDialog } from "@/components/planner/GoalDialog";
import StudyLogDialog from "@/components/StudyLogDialog";
import { toast } from "sonner";

interface NavbarProps {
  minimal?: boolean;
}

const Navbar = ({ minimal = false }: NavbarProps) => {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [studyLogOpen, setStudyLogOpen] = useState(false);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: fetchSubjects,
    enabled: !!user && !minimal,
  });

  const createNoteMut = useMutation({
    mutationFn: (data: { title: string; content: string; subject_id: string | null; task_id: string | null; planned_date: string | null }) =>
      createNote(user!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-notes"] });
      toast.success("Anotação criada!");
    },
    onError: () => toast.error("Erro ao criar anotação"),
  });

  const createGoalMut = useMutation({
    mutationFn: (data: { title: string; description: string | null; subject_id: string | null; target_date: string | null }) =>
      createGoal(user!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-goals"] });
      toast.success("Meta criada!");
    },
    onError: () => toast.error("Erro ao criar meta"),
  });

  return (
    <>
      <nav className="border-b bg-card shadow-sm w-full">
        <div className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!minimal && <SidebarTrigger className="md:hidden" />}
            
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => minimal ? navigate(-1) : navigate("/dashboard")}>
              {minimal ? (
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-5 h-5" />
                  <span className="hidden sm:inline">Voltar</span>
                </Button>
              ) : (
                <>
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Mountain className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">Zenit</h1>
                </>
              )}
            </div>
          </div>
          {!minimal && (
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1.5 sm:gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="hidden sm:block"><ShortcutsHelpDialog /></div>
                  </TooltipTrigger>
                  <TooltipContent>Atalhos do teclado</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div><NotificationBell /></div>
                  </TooltipTrigger>
                  <TooltipContent>Notificações de prazos e atualizações</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleTheme}
                      aria-label="Alternar tema"
                      className="rounded-xl"
                    >
                      {theme === "dark" ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Alternar tema claro/escuro</TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" className="gap-1.5 sm:gap-2 rounded-xl sm:size-default">
                          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="hidden sm:inline">Criar</span>
                          <ChevronDown className="w-3.5 h-3.5 hidden sm:inline" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Criar tarefa, anotação, meta ou registro de estudo</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate("/task/new")} className="gap-2">
                      <ListTodo className="w-4 h-4" />
                      Nova tarefa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNoteDialogOpen(true)} className="gap-2">
                      <StickyNote className="w-4 h-4" />
                      Nova anotação
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setGoalDialogOpen(true)} className="gap-2">
                      <Target className="w-4 h-4" />
                      Nova meta
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStudyLogOpen(true)} className="gap-2">
                      <BookOpenCheck className="w-4 h-4" />
                      Registrar estudo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowLogoutConfirm(true)}
                      className="rounded-xl sm:size-default sm:px-4 sm:w-auto"
                      aria-label="Sair"
                    >
                      <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline ml-2">Sair</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Encerrar sessão</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}
        </div>
      </nav>

      <NoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        subjects={subjects}
        onSave={(data) => createNoteMut.mutate(data)}
      />

      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        subjects={subjects}
        onSave={(data) => createGoalMut.mutate(data)}
      />

      <StudyLogDialog
        open={studyLogOpen}
        onOpenChange={setStudyLogOpen}
        onLogged={() => {
          queryClient.invalidateQueries({ queryKey: ["focus-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["study-analytics"] });
        }}
      />



      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar sessão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja sair da sua conta? Você precisará fazer login novamente para acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={signOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Navbar;
