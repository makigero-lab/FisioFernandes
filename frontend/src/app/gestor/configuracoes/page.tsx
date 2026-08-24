"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Save,
  Building2,
  CheckCircle2,
  AlertCircle,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Toast = { tipo: "sucesso" | "erro"; msg: string } | null;

/**
 * Página de Configurações — Painel do Gestor.
 *
 * Rebranding — Refatorizada para refletir apenas a configuração da empresa
 * (clínica) ao nível do tenant local. Removido completamente:
 *   - Bloco "Ações Smoobu" (integração Smoobu eliminada em F0; endpoints
 *     /api/gestor/smoobu/* não existem mais — causavam 404/HTML →
 *     "Unexpected token '<' is not valid JSON" no ecrã).
 *   - Modal "Logs de Sincronização Smoobu" (WebhookLog eliminado em F8;
 *     endpoint /api/gestor/webhooks não existe).
 *   - Campo "Smoobu API Key" (Empresa.smoobu_api_key removido em F0).
 *   - Botões de "Testes Manuais (Cron Jobs)" que apontavam para endpoints
 *     inexistentes (/api/gestor/configuracoes/forcar-*).
 *
 * Mantido:
 *   - Dados da Empresa (nome, nif, morada, telefone, email) — suportado pelo
 *     backend (GET/PUT /api/gestor/configuracoes).
 *
 * Visibilidade: este item de menu só aparece para role === 'admin' (ver
 * gestor-sidebar.tsx). Os utilizadores da clínica (diretor_clinico,
 * rececionista) não veem esta página — as suas configurações operacionais
 * estão dispersas pelas restantes secções (Equipa, Salas, Protocolos, etc.).
 */
export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const [nome, setNome] = useState("");
  const [nif, setNif] = useState("");
  const [morada, setMorada] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  function showToast(tipo: "sucesso" | "erro", msg: string) {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 6000);
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gestor/configuracoes", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setNome(data.nome || "");
        setNif(data.nif || "");
        setMorada(data.morada || "");
        setTelefone(data.telefone || "");
        setEmail(data.email || "");
      } else {
        showToast("erro", data?.erro || `Erro ${res.status}`);
      }
    } catch {
      showToast("erro", "Erro ao carregar configuração.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const body = {
        nome: nome.trim(),
        nif: nif.trim(),
        morada: morada.trim(),
        telefone: telefone.trim(),
        email: email.trim().toLowerCase(),
      };

      const res = await fetch("/api/gestor/configuracoes", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro || `Erro ${res.status}`);
      showToast("sucesso", data.message || "Configuração guardada.");
    } catch (e) {
      showToast("erro", e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        A carregar configuração…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      </div>

      {toast && (
        <Card className={toast.tipo === "sucesso" ? "border-emerald-500/50" : "border-destructive/50"}>
          <CardContent className={`flex items-center gap-3 p-4 text-sm ${toast.tipo === "sucesso" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {toast.tipo === "sucesso" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span className="flex-1">{toast.msg}</span>
            <Button variant="ghost" size="sm" onClick={() => setToast(null)}>Fechar</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Dados da Empresa (Clínica) */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" />
              Dados da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSalvar} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="cfg-nome">Nome da Empresa</label>
                <Input id="cfg-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da empresa" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="cfg-nif">NIF</label>
                <Input id="cfg-nif" value={nif} onChange={(e) => setNif(e.target.value)} placeholder="000000000" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium" htmlFor="cfg-morada">Morada</label>
                <Input id="cfg-morada" value={morada} onChange={(e) => setMorada(e.target.value)} placeholder="Rua da Clínica, 123" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="cfg-telefone">Telefone</label>
                <Input id="cfg-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="+351 210 000 000" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="cfg-email">Email</label>
                <Input id="cfg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="clinica@exemplo.pt" />
              </div>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" />A guardar…</> : <><Save className="h-4 w-4" />Guardar</>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
