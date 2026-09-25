import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://zenit-io.lovable.app";
const SITE_NAME = "Zenit";

type Meta = { title: string; description: string };

const DEFAULT_META: Meta = {
  title: "Zenit — Organizador de estudos, foco e produtividade",
  description:
    "Zenit é a plataforma de estudos que reúne Pomodoro, ciclos de estudo, planner, tarefas e relatórios de desempenho para você alcançar o ponto máximo da sua produtividade.",
};

/** Exact-path metadata. Dynamic routes are matched by prefix below. */
const EXACT_META: Record<string, Meta> = {
  "/": DEFAULT_META,
  "/auth": {
    title: `Entrar ou criar conta — ${SITE_NAME}`,
    description:
      "Acesse sua conta Zenit para organizar tarefas, ciclos de estudo, planner e acompanhar seu desempenho acadêmico.",
  },
  "/apoie": {
    title: `Apoie o Zenit — doações via Pix`,
    description:
      "Contribua com o Zenit via Pix e ajude a manter a plataforma de estudos gratuita para estudantes e concurseiros.",
  },
  "/connect": {
    title: `Conectar assistente de IA — ${SITE_NAME}`,
    description:
      "Saiba como conectar o Zenit ao ChatGPT, Claude ou outro cliente MCP para gerenciar tarefas e ciclos por voz ou texto.",
  },
  "/onboarding": {
    title: `Primeiros passos — ${SITE_NAME}`,
    description: "Configure seu perfil e comece a organizar sua rotina de estudos no Zenit.",
  },
  "/dashboard": {
    title: `Início — ${SITE_NAME}`,
    description:
      "Veja seu foco do dia, tarefas próximas do prazo, agenda e recomendações do Assistente Zenit.",
  },
  "/planner": {
    title: `Planner — ${SITE_NAME}`,
    description:
      "Organize aulas, compromissos, metas e anotações em um calendário unificado de estudos.",
  },
  "/planner/cadernos": {
    title: `Cadernos — ${SITE_NAME}`,
    description: "Crie e organize cadernos pessoais para seus conteúdos acadêmicos no Zenit.",
  },
  "/reports": {
    title: `Relatórios — ${SITE_NAME}`,
    description: "Acompanhe conclusão de tarefas, produtividade e evolução acadêmica ao longo do tempo.",
  },
  "/archived": {
    title: `Tarefas Arquivadas — ${SITE_NAME}`,
    description: "Consulte tarefas concluídas e arquivadas automaticamente pelo Zenit.",
  },
  "/subjects": {
    title: `Disciplinas — ${SITE_NAME}`,
    description: "Cadastre e gerencie as disciplinas usadas em tarefas, ciclos e registros de estudo.",
  },
  "/task-statuses": {
    title: `Status de tarefas — ${SITE_NAME}`,
    description: "Personalize os status usados no quadro e na lista de tarefas do Zenit.",
  },
  "/settings": {
    title: `Configurações — ${SITE_NAME}`,
    description: "Ajuste perfil, notificações, preferências de estudo e integrações da sua conta Zenit.",
  },
  "/ranking": {
    title: `Ranking — ${SITE_NAME}`,
    description: "Veja o ranking de XP semanal e mensal da comunidade Zenit.",
  },
  "/shared-environments": {
    title: `Grupos de Trabalho — ${SITE_NAME}`,
    description: "Colabore em tarefas compartilhadas, converse e acompanhe o progresso do grupo.",
  },
  "/grupos-de-estudo": {
    title: `Grupos de Estudo — ${SITE_NAME}`,
    description: "A área de grupos de estudo do Zenit está em reformulação.",
  },
  "/estudos/pomodoro": {
    title: `Pomodoro — ${SITE_NAME}`,
    description:
      "Cronômetro Pomodoro personalizável com registro automático de sessões, questões e avaliação de foco.",
  },
  "/estudos/ciclo": {
    title: `Ciclo de Estudos — ${SITE_NAME}`,
    description:
      "Monte ciclos de estudo com disciplinas, pesos e metas de tempo, e acompanhe o progresso de cada bloco.",
  },
  "/estudos/desempenho": {
    title: `Desempenho de Estudos — ${SITE_NAME}`,
    description:
      "Analise tempo estudado, questões, taxa de acerto e evolução por disciplina em cada período.",
  },
};

const PREFIX_META: Array<[string, Meta]> = [
  [
    "/planner/cadernos/",
    { title: `Caderno — ${SITE_NAME}`, description: "Organize as páginas e informações do seu caderno acadêmico no Zenit." },
  ],
  [
    "/invite/",
    {
      title: `Convite para grupo de trabalho — ${SITE_NAME}`,
      description: "Aceite o convite para participar de um grupo de trabalho colaborativo no Zenit.",
    },
  ],
  [
    "/task/new",
    { title: `Nova tarefa — ${SITE_NAME}`, description: "Crie uma nova tarefa acadêmica com prazo, disciplina e etapas." },
  ],
  [
    "/task/edit/",
    { title: `Editar tarefa — ${SITE_NAME}`, description: "Atualize prazo, disciplina, etapas e status da tarefa." },
  ],
  [
    "/task/",
    { title: `Detalhes da tarefa — ${SITE_NAME}`, description: "Veja e edite os detalhes, etapas e responsáveis da tarefa." },
  ],
  [
    "/environment/",
    { title: `Grupo de Trabalho — ${SITE_NAME}`, description: "Gerencie tarefas, membros e conversas do grupo de trabalho." },
  ],
  [
    "/admin",
    { title: `Administração — ${SITE_NAME}`, description: "Painel administrativo do Zenit." },
  ],
];

function resolveMeta(pathname: string): Meta {
  if (EXACT_META[pathname]) return EXACT_META[pathname];
  const prefix = PREFIX_META.find(([p]) => pathname.startsWith(p));
  return prefix ? prefix[1] : DEFAULT_META;
}

/** Per-route <head> metadata: unique title, description, self-referencing canonical and og:url. */
const RouteMeta = () => {
  const { pathname } = useLocation();
  const meta = resolveMeta(pathname);
  const url = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
    </Helmet>
  );
};

export default RouteMeta;
