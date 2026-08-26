import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Copy, Check, ArrowLeft, Mountain, Terminal, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const APP_NAME = "Zenit";
const APP_SLUG = "zenit";

function buildMcpUrl(): string {
  const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!configuredSupabaseUrl) {
    throw new Error("VITE_SUPABASE_URL não está configurado");
  }
  const supabaseUrl = new URL(configuredSupabaseUrl);
  const authority = configuredSupabaseUrl.match(/^https?:\/\/([^/?#]*)/i)?.[1];
  const loopbackAuthority = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(authority || "");
  if (
    !authority ||
    authority.includes("@") ||
    configuredSupabaseUrl.includes("?") ||
    configuredSupabaseUrl.includes("#") ||
    (supabaseUrl.protocol === "http:" && !loopbackAuthority)
  ) {
    throw new Error("VITE_SUPABASE_URL deve usar HTTPS, exceto em localhost, e não conter credenciais, query ou fragmento");
  }
  const legacyLovableCloud = supabaseUrl.hostname.endsWith(".lovable.cloud") && !supabaseUrl.hostname.startsWith("c--");
  const dataPlaneUrl = legacyLovableCloud
    ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
    : configuredSupabaseUrl.replace(/\/+$/, "");
  return `${dataPlaneUrl}/functions/v1/mcp`;
}

function escapeShellSingleQuotes(value: string): string {
  return value.replace(/'/g, "'\\''");
}

export default function AgentConnectInstructions() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Conectar assistente de IA — ${APP_NAME}`;
  }, []);

  const mcpUrl = useMemo(() => {
    try {
      return buildMcpUrl();
    } catch {
      return "";
    }
  }, []);

  const claudeWebUrl = useMemo(() => {
    if (!mcpUrl) return "";
    const params = new URLSearchParams({
      modal: "add-custom-connector",
      connectorName: APP_NAME,
      connectorUrl: mcpUrl,
    });
    return `https://claude.ai/customize/connectors?${params.toString()}`;
  }, [mcpUrl]);

  const claudeCodeCommand = useMemo(() => {
    if (!mcpUrl) return "";
    return `claude mcp add --scope user --transport http ${APP_SLUG} '${escapeShellSingleQuotes(mcpUrl)}'`;
  }, [mcpUrl]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
      toast.success(`${label} copiado para a área de transferência!`);
    } catch {
      toast.error("Não foi possível copiar. Tente selecionar o texto manualmente.");
    }
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Mountain className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold text-foreground">{APP_NAME}</span>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Bot className="h-7 w-7 text-primary" />
            Conectar um assistente de IA
          </h1>
          <p className="text-muted-foreground">
            Use as ferramentas do {APP_NAME} diretamente dentro do ChatGPT, Claude ou outro cliente MCP.
            Basta colar a URL abaixo no seu assistente.
          </p>
        </div>

        {mcpUrl ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                URL do servidor MCP
                <Badge variant="secondary" className="font-mono text-xs">copie este endereço</Badge>
              </CardTitle>
              <CardDescription>
                Este é o endereço público que o assistente usará para se comunicar com o {APP_NAME}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={mcpUrl} readOnly className="text-xs sm:text-sm font-mono bg-muted" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(mcpUrl, "URL do servidor MCP")}
                  className="shrink-0"
                  aria-label="Copiar URL do servidor MCP"
                >
                  {copied === "URL do servidor MCP" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-6">
              <p className="text-sm text-warning-foreground">
                Não foi possível montar a URL do servidor MCP. Verifique se a variável VITE_SUPABASE_URL está configurada.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span aria-hidden>🤖</span> ChatGPT
              </CardTitle>
              <CardDescription>Conecte o {APP_NAME} como um plugin personalizado no ChatGPT.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
                <li>
                  Abra{" "}
                  <a
                    href="https://chatgpt.com/#settings/Connectors/Advanced"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Configurações de Plugins do ChatGPT
                    <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  e ative o <strong>modo Desenvolvedor</strong>.
                </li>
                <li>
                  Clique em{" "}
                  <a
                    href="https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Criar novo plugin
                    <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  para abrir a tela de cadastro.
                </li>
                <li>
                  Preencha o <strong>nome</strong> com <code className="bg-muted px-1 rounded">{APP_NAME}</code> e a{" "}
                  <strong>URL</strong> com o endereço do servidor MCP copiado acima.
                </li>
                <li>
                  Aceite o aviso de segurança do ChatGPT, revise os detalhes e clique em <strong>Criar</strong>.
                </li>
                <li>
                  Ative o aplicativo no campo de mensagens e peça ao ChatGPT para usar o {APP_NAME}.
                </li>
              </ol>

              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Atualizar depois de mudanças no app
                </p>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Abra a página de Plugins do ChatGPT e selecione o {APP_NAME}.</li>
                  <li>Role até <strong>Informações</strong> e clique em <strong>Atualizar</strong>.</li>
                  <li>
                    Se a URL mudou, remova o plugin e cadastre-o novamente com a nova URL.
                  </li>
                  <li>Inicie um novo chat e peça ao assistente para usar o {APP_NAME}.</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span aria-hidden>✨</span> Claude (web)
              </CardTitle>
              <CardDescription>Adicione o {APP_NAME} como conector personalizado no Claude.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
                <li>
                  Abra a tela de{" "}
                  {claudeWebUrl ? (
                    <a
                      href={claudeWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Conectores do Claude com nome e URL preenchidos
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "Conectores do Claude"
                  )}
                  .
                </li>
                <li>Se o formulário não abrir preenchido, clique em <strong>Adicionar conector personalizado</strong>.</li>
                <li>
                  Coloque o <strong>nome</strong> <code className="bg-muted px-1 rounded">{APP_NAME}</code> e cole a <strong>URL</strong> do servidor MCP copiada acima.
                </li>
                <li>Clique em <strong>Adicionar</strong> para confirmar.</li>
                <li>Ative o conector na barra de mensagens e peça ao Claude para usar o {APP_NAME}.</li>
              </ol>

              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Atualizar depois de mudanças no app
                </p>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Abra a página de Conectores do Claude e selecione o {APP_NAME}.</li>
                  <li>Clique em <strong>Atualizar ferramentas</strong>.</li>
                  <li>Se a URL mudou, remova o conector e adicione-o novamente com a nova URL.</li>
                  <li>Peça ao Claude para usar o {APP_NAME}.</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Terminal className="h-5 w-5" /> Claude Code
              </CardTitle>
              <CardDescription>Conecte o {APP_NAME} ao Claude Code pelo terminal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
                <li>
                  Copie o comando abaixo e execute no terminal:
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={claudeCodeCommand}
                      readOnly
                      className="text-xs font-mono bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(claudeCodeCommand, "Comando do Claude Code")}
                      className="shrink-0"
                      aria-label="Copiar comando do Claude Code"
                    >
                      {copied === "Comando do Claude Code" ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </li>
                <li>Inicie o Claude Code e execute <code className="bg-muted px-1 rounded">/mcp</code> para confirmar a conexão.</li>
                <li>Se o {APP_NAME} exigir login, o menu solicitará autenticação.</li>
                <li>Peça ao Claude Code para usar o {APP_NAME}.</li>
              </ol>

              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Atualizar depois de mudanças no app
                </p>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Inicie uma nova sessão do Claude Code para carregar as ferramentas mais recentes.</li>
                  <li>Se a URL mudou, execute <code className="bg-muted px-1 rounded">claude mcp remove {APP_SLUG}</code> e depois execute o comando de instalação novamente.</li>
                  <li>Peça ao Claude Code para usar o {APP_NAME}.</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5" /> Outros clientes MCP
              </CardTitle>
              <CardDescription>Conecte qualquer assistente que suporte servidores MCP remotos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
                <li>Abra as configurações de servidores MCP ou conectores personalizados do seu assistente.</li>
                <li>Crie uma nova conexão remota do tipo <strong>MCP server</strong>.</li>
                <li>Dê o nome <code className="bg-muted px-1 rounded">{APP_NAME}</code> e cole a URL do servidor MCP copiada acima.</li>
                <li>Complete qualquer etapa de login ou autorização solicitada.</li>
                <li>Ative a conexão e peça ao assistente para usar o {APP_NAME}.</li>
              </ol>

              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Atualizar depois de mudanças no app
                </p>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Abra as configurações de servidores MCP do seu assistente.</li>
                  <li>Selecione a conexão criada para o {APP_NAME}.</li>
                  <li>Atualize a lista de ferramentas, recarregue o servidor ou reconecte.</li>
                  <li>Se a URL mudou, cole a nova URL copiada acima.</li>
                  <li>Inicie um novo chat e peça ao assistente para usar o {APP_NAME}.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          O {APP_NAME} usa autenticação segura OAuth para que cada usuário acesse apenas seus próprios dados.
        </p>
      </div>
    </div>
  );
}
