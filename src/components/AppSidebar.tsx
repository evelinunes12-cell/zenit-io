import { useEffect, useState } from "react";
import { Home, BookOpen, Settings, ListChecks, Users, BarChart3, Archive, NotebookPen, ShieldCheck, Image, ChevronDown, LayoutDashboard, Bell, Timer, Repeat, Sparkles, Trophy, TrendingUp, LogOut, MessageSquarePlus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NavLink, useLocation } from "react-router-dom";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatUsername } from "@/lib/username";
import { prefetchRoute } from "@/lib/routePrefetch";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStudyGroupsUnreadTotal } from "@/hooks/useStudyGroupsUnreadTotal";
import { useSharedEnvironmentsUnreadTotal } from "@/hooks/useSharedEnvironmentsUnreadTotal";

const menuItems = [
  { title: "Início", url: "/dashboard", icon: Home, description: "Painel principal com suas tarefas" },
  { title: "Planner", url: "/planner", icon: NotebookPen, description: "Planeje metas e anotações" },
  { title: "Grupos de Trabalho", url: "/shared-environments", icon: Users, description: "Colabore com colegas em tarefas compartilhadas" },
  { title: "Disciplinas", url: "/subjects", icon: BookOpen, description: "Gerencie suas disciplinas/matérias" },
  { title: "Status", url: "/task-statuses", icon: ListChecks, description: "Personalize os status das tarefas" },
  { title: "Tarefas Arquivadas", url: "/archived", icon: Archive, description: "Tarefas que foram arquivadas" },
];

const analyticsSubItems = [
  { title: "Relatórios", url: "/reports", icon: BarChart3, description: "Veja estatísticas e sua constância" },
  { title: "Ranking", url: "/ranking", icon: Trophy, description: "Veja o ranking de XP da comunidade" },
];

const studySubItems = [
  { title: "Pomodoro", url: "/estudos/pomodoro", icon: Timer, description: "Timer de foco Pomodoro" },
  { title: "Ciclo de Estudos", url: "/estudos/ciclo", icon: Repeat, description: "Configure seu ciclo ideal de estudos" },
  { title: "Desempenho", url: "/estudos/desempenho", icon: BarChart3, description: "Métricas e relatórios de estudo" },
];

const adminSubItems = [
  { title: "Visão Geral", url: "/admin", icon: LayoutDashboard, description: "Métricas e estatísticas do sistema" },
  { title: "Usuários", url: "/admin/users", icon: Users, description: "Gerenciar usuários da plataforma" },
  { title: "Banners", url: "/admin/banners", icon: Image, description: "Gerenciar banners da Dashboard" },
  { title: "Notificações", url: "/admin/notifications", icon: Bell, description: "Enviar notificações aos usuários" },
  { title: "Feedbacks", url: "/admin/feedback", icon: MessageSquarePlus, description: "Ver feedbacks dos usuários" },
  { title: "Versão do app", url: "/admin/version", icon: RefreshCw, description: "Forçar atualização para todos os usuários" },
];

export function AppSidebar() {
  const { open, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const { isAdmin } = useAdminRole();
  const { user, signOut } = useAuth();
  const studyGroupsUnread = useStudyGroupsUnreadTotal();
  const sharedEnvironmentsUnread = useSharedEnvironmentsUnreadTotal();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isStudyRoute = location.pathname.startsWith("/estudos");
  const isAnalyticsRoute = location.pathname === "/reports" || location.pathname === "/ranking";
  const [adminOpen, setAdminOpen] = useState(isAdminRoute);
  const [studyOpen, setStudyOpen] = useState(isStudyRoute);
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsRoute);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileLabel, setProfileLabel] = useState({ name: "Usuário", username: "@usuario" });

  useEffect(() => {
    if (!user?.id) return;

    supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileLabel({
          name: data?.full_name || user.email || "Usuário",
          username: formatUsername(data?.username),
        });
      });
  }, [user?.id, user?.email]);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const renderMenuItem = (item: { title: string; url: string; icon: any; description: string; comingSoon?: boolean; isNew?: boolean }) => {
    const isStudyGroups = item.url === "/grupos-de-estudo";
    const isSharedEnvs = item.url === "/shared-environments";
    const unread = isStudyGroups
      ? studyGroupsUnread
      : isSharedEnvs
      ? sharedEnvironmentsUnread
      : 0;
    return (
      <SidebarMenuItem key={item.title}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild>
              <NavLink
                to={item.url}
                aria-label={item.title}
                onClick={handleLinkClick}
                onMouseEnter={() => prefetchRoute(item.url)}
                onFocus={() => prefetchRoute(item.url)}
                onTouchStart={() => prefetchRoute(item.url)}
                className={({ isActive }) =>
                  isActive
                    ? "bg-accent text-accent-foreground relative"
                    : "hover:bg-accent/50 relative"
                }
              >
                <span className="relative inline-flex">
                  <item.icon className="h-4 w-4" />
                  {unread > 0 && !open && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                  )}
                </span>
                {open && <span className="flex-1">{item.title}</span>}
                {open && unread > 0 && (
                  <Badge
                    variant="default"
                    className="text-[10px] px-1.5 py-0 h-4 ml-auto bg-primary text-primary-foreground min-w-[1rem] justify-center"
                  >
                    {unread > 99 ? "99+" : unread}
                  </Badge>
                )}
                {open && item.comingSoon && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-auto">
                    Em breve
                  </Badge>
                )}
                {open && item.isNew && unread === 0 && (
                  <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 ml-auto bg-primary text-primary-foreground animate-pulse">
                    <Sparkles className="h-3 w-3 mr-0.5" />
                    Novo
                  </Badge>
                )}
              </NavLink>
            </SidebarMenuButton>
          </TooltipTrigger>
          {!open && (
            <TooltipContent side="right">
              <p className="font-medium">
                {item.title}
                {item.comingSoon ? " (Em breve)" : ""}
                {unread > 0 ? ` · ${unread} nova${unread > 1 ? "s" : ""}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <div className="p-4 flex justify-end border-b">
            <SidebarTrigger className="hover:bg-accent transition-colors" />
          </div>

          {/* Menu principal */}
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <TooltipProvider delayDuration={300}>
                  {menuItems.map(renderMenuItem)}
                </TooltipProvider>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Estudos */}
          <SidebarGroup>
            <Collapsible open={studyOpen} onOpenChange={setStudyOpen}>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="cursor-pointer flex items-center justify-between pr-2">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    {open && "Estudos"}
                  </span>
                  <span className="flex items-center gap-1">
                    {open && (
                      <ChevronDown className={`h-4 w-4 transition-transform ${studyOpen ? "rotate-180" : ""}`} />
                    )}
                  </span>
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <TooltipProvider delayDuration={300}>
                      {studySubItems.map(renderMenuItem)}
                    </TooltipProvider>
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>

          {/* Análises */}
          <SidebarGroup>
            <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="cursor-pointer flex items-center justify-between pr-2">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {open && "Análises"}
                  </span>
                  {open && (
                    <ChevronDown className={`h-4 w-4 transition-transform ${analyticsOpen ? "rotate-180" : ""}`} />
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <TooltipProvider delayDuration={300}>
                      {analyticsSubItems.map(renderMenuItem)}
                    </TooltipProvider>
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>

          {/* Configurações */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <TooltipProvider delayDuration={300}>
                  {[{ title: "Configurações", url: "/settings", icon: Settings, description: "Perfil, tema e preferências" }].map(renderMenuItem)}
                </TooltipProvider>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Admin */}
          {isAdmin && (
            <SidebarGroup>
              <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                <CollapsibleTrigger className="w-full">
                  <SidebarGroupLabel className="cursor-pointer flex items-center justify-between pr-2">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      {open && "Admin"}
                    </span>
                    {open && (
                      <ChevronDown className={`h-4 w-4 transition-transform ${adminOpen ? "rotate-180" : ""}`} />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <TooltipProvider delayDuration={300}>
                        {adminSubItems.map(renderMenuItem)}
                      </TooltipProvider>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* Sair - fixo no rodapé da sidebar */}

        <SidebarFooter className="border-t gap-2">
          {open && (
            <div className="px-2 py-1">
              <p className="text-sm font-medium truncate">{profileLabel.name}</p>
              <p className="text-xs text-muted-foreground truncate">{profileLabel.username}</p>
            </div>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <Tooltip>
                <TooltipProvider delayDuration={300}>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      onClick={() => setShowLogoutConfirm(true)}
                      aria-label="Sair"
                      className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      {open && <span>Sair</span>}
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  {!open && (
                    <TooltipContent side="right">
                      <p className="font-medium">Sair</p>
                      <p className="text-xs text-muted-foreground">Encerrar sessão</p>
                    </TooltipContent>
                  )}
                </TooltipProvider>
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja sair?</AlertDialogTitle>
            <AlertDialogDescription>
              Você será desconectado da sua conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}