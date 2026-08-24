import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { validateInvite, consumeInvite, type InviteValidation } from "@/services/invites";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mountain, CheckCircle2, XCircle, Clock, Users, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/logger";

type InviteState = "loading" | "valid" | "invalid" | "consuming" | "success" | "error";

const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<InviteState>("loading");
  const [validation, setValidation] = useState<InviteValidation | null>(null);
  const [errorType, setErrorType] = useState<string>("");

  useEffect(() => {
    if (token) {
      checkInvite();
    }
  }, [token]);

  // After auth loads, if user is logged in and invite is valid, auto-consume
  useEffect(() => {
    if (!authLoading && user && state === "valid" && validation?.valid) {
      handleAcceptInvite();
    }
  }, [authLoading, user, state]);

  const checkInvite = async () => {
    try {
      setState("loading");
      const result = await validateInvite(token!);
      setValidation(result);

      if (result.valid) {
        setState("valid");
      } else {
        setState("invalid");
        setErrorType(result.error || "unknown");
      }
    } catch (error) {
      logError("Error validating invite", error);
      setState("invalid");
      setErrorType("unknown");
    }
  };

  const handleAcceptInvite = async () => {
    if (!user) {
      // Redirect to auth with return URL
      navigate(`/auth?redirect=/invite/${token}`);
      return;
    }

    try {
      setState("consuming");
      const result = await consumeInvite(token!);

      if (result.success) {
        setState("success");
        toast.success("Convite aceito com sucesso!");

        // Redirect after short delay
        setTimeout(() => {
          if (result.environment_id) {
            navigate(`/environment/${result.environment_id}`);
          } else {
            navigate("/dashboard");
          }
        }, 2000);
      } else {
        setState("error");
        setErrorType(result.error || "unknown");
      }
    } catch (error) {
      logError("Error consuming invite", error);
      setState("error");
      setErrorType("unknown");
    }
  };

  const getErrorMessage = (error: string) => {
    switch (error) {
      case "not_found":
        return "Este convite não existe ou foi removido.";
      case "expired":
        return "Este convite expirou. Solicite um novo convite ao administrador.";
      case "revoked":
        return "Este convite foi revogado pelo administrador.";
      case "max_uses_reached":
        return "Este convite já atingiu o limite máximo de usos.";
      case "already_member":
        return "Você já é membro deste grupo!";
      case "already_owner":
        return "Você é o proprietário deste grupo!";
      case "already_used":
        return "Você já utilizou este convite.";
      case "not_authenticated":
        return "Você precisa estar logado para aceitar este convite.";
      default:
        return "Ocorreu um erro ao processar o convite. Tente novamente.";
    }
  };

  const getErrorIcon = (error: string) => {
    switch (error) {
      case "expired":
        return <Clock className="w-16 h-16 text-warning" />;
      case "already_member":
      case "already_owner":
      case "already_used":
        return <CheckCircle2 className="w-16 h-16 text-primary" />;
      default:
        return <XCircle className="w-16 h-16 text-destructive" />;
    }
  };

  if (authLoading || state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Verificando convite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <h1 className="sr-only">Convite para grupo de trabalho no Zenit</h1>
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Mountain className="w-8 h-8 text-primary" />
        </div>
        <span className="text-2xl font-bold text-foreground">Zenit</span>
      </div>

      <Card className="w-full max-w-md">
        {/* Success state */}
        {state === "success" && (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="w-16 h-16 text-primary" />
              </div>
              <CardTitle className="text-2xl">Convite aceito!</CardTitle>
              <CardDescription>
                {validation?.type === "group"
                  ? `Você entrou no grupo "${validation.environment_name}" com sucesso.`
                  : "Bem-vindo ao Zenit!"}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Redirecionando...
              </p>
            </CardContent>
          </>
        )}

        {/* Consuming state */}
        {state === "consuming" && (
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Processando convite...</p>
          </CardContent>
        )}

        {/* Valid state - waiting for user action */}
        {state === "valid" && !user && (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Users className="w-16 h-16 text-primary" />
              </div>
              <CardTitle className="text-2xl">
                {validation?.type === "group"
                  ? "Convite para grupo"
                  : "Convite para o Zenit"}
              </CardTitle>
              <CardDescription>
                {validation?.type === "group" && validation.environment_name
                  ? `Você foi convidado para entrar no grupo "${validation.environment_name}".`
                  : "Você foi convidado para usar o Zenit."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Para aceitar o convite, faça login ou crie uma conta.
              </p>
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => navigate(`/auth?redirect=/invite/${token}`)}
              >
                <LogIn className="w-5 h-5" />
                Entrar na minha conta
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                size="lg"
                onClick={() => navigate(`/auth?mode=signup&redirect=/invite/${token}`)}
              >
                <UserPlus className="w-5 h-5" />
                Criar conta
              </Button>
            </CardContent>
          </>
        )}

        {/* Invalid or error state */}
        {(state === "invalid" || state === "error") && (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                {getErrorIcon(errorType)}
              </div>
              <CardTitle className="text-2xl">
                {errorType === "already_member" || errorType === "already_owner"
                  ? "Você já faz parte!"
                  : "Convite inválido"}
              </CardTitle>
              <CardDescription>
                {getErrorMessage(errorType)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(errorType === "already_member" || errorType === "already_owner") && validation?.environment_id && (
                <Button
                  className="w-full"
                  onClick={() => navigate(`/environment/${validation.environment_id}`)}
                >
                  Ir para o grupo
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/dashboard")}
              >
                Ir para o Dashboard
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};

export default InvitePage;
