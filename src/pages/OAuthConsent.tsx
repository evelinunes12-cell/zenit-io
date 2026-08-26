import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

// The `supabase.auth.oauth` namespace is in beta and may be missing from the
// generated types. This narrow wrapper types only the methods used here.
type AuthorizationDetails = {
  client?: { name?: string } | null;
  redirect_uri?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult<T> = { data: T | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult<AuthorizationDetails>>;
  approveAuthorization: (
    id: string,
    options?: { skipBrowserRedirect?: boolean },
  ) => Promise<OAuthResult<AuthorizationDetails>>;
  denyAuthorization: (
    id: string,
    options?: { skipBrowserRedirect?: boolean },
  ) => Promise<OAuthResult<AuthorizationDetails>>;
};

function getOAuthApi(): OAuthApi | null {
  const api = (supabase.auth as unknown as { oauth?: OAuthApi }).oauth;
  return api && typeof api.getAuthorizationDetails === "function" ? api : null;
}

function redirectTargetOf(data: AuthorizationDetails | null | undefined) {
  return data?.redirect_url ?? data?.redirect_to ?? data?.redirect_uri ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!authorizationId) {
          setError("Solicitação de autorização inválida (authorization_id ausente).");
          return;
        }
        const oauth = getOAuthApi();
        if (!oauth) {
          setError(
            "Este navegador carregou uma versão antiga do aplicativo. Recarregue a página (Ctrl+Shift+R) e tente novamente.",
          );
          return;
        }
        const { data: sess } = await supabase.auth.getSession();
        if (!active) return;
        if (!sess.session) {
          // Preserve the FULL consent URL so auth returns the user here.
          const next = window.location.pathname + window.location.search;
          window.location.href = "/auth?redirect=" + encodeURIComponent(next);
          return;
        }
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message);
          return;
        }
        const immediate = redirectTargetOf(data);
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        if (!data) {
          setError("O servidor de autorização não retornou os dados da solicitação.");
          return;
        }
        setDetails(data);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Erro inesperado ao carregar a solicitação.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const oauth = getOAuthApi();
      if (!oauth) {
        setError("Recurso de autorização indisponível. Recarregue a página e tente novamente.");
        setBusy(false);
        return;
      }
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = redirectTargetOf(data);
      if (!target) {
        setBusy(false);
        setError("O servidor de autorização não retornou um redirecionamento.");
        return;
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Erro inesperado ao processar a autorização.");
    }
  }


  const clientName = details?.client?.name ?? "um aplicativo";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 p-8 shadow-xl backdrop-blur">
        {error ? (
          <div className="space-y-3 text-center">
            <h1 className="text-lg font-semibold text-foreground">
              Não foi possível carregar
            </h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : !details ? (
          <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Carregando solicitação…</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <h1 className="text-xl font-semibold text-foreground">
                Conectar {clientName} à sua conta
              </h1>
              <p className="text-sm text-muted-foreground">
                Isso permitirá que {clientName} acesse os seus dados do Zenit
                (tarefas, ciclos de estudo e ranking) agindo como você.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button disabled={busy} onClick={() => decide(true)} className="w-full">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Aprovar
              </Button>
              <Button
                disabled={busy}
                variant="ghost"
                onClick={() => decide(false)}
                className="w-full"
              >
                Recusar
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
