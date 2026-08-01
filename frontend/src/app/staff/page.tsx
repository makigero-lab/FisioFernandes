"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  ClipboardList,
  LogOut,
  CalendarDays,
  CalendarOff,
  Bell,
  Loader2,
  AlertTriangle,
  Send,
  Activity,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConsultaCard } from "@/components/staff/consulta-card";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { fazerLogout, lerUtilizador } from "@/lib/auth";
import type { UtilizadorAuth } from "@/lib/auth";
import { NotificationBell } from "@/components/notification-bell";
import { parsearDataSegura } from "@/lib/utils";
import type { ConsultaDTO } from "@/lib/api";

/**
 * Área do Fisioterapeuta (/staff) — mobile-first.
 *
 * Cabeçalho "Bem-vindo, [Nome]" + lista de cartões de Consultas de Hoje.
 *
 * Dados reais: busca o nome do utilizador via /api/auth/me e as consultas
 * de hoje via /api/staff/consultas/hoje (proxy para /api/gestor/consultas
 * com filtro de fisioterapeuta_id automático pelo backend).
 *
 * RF1 — Refatorizado do domínio legacy "Tarefas" para "Consultas".
 */
export default function StaffPage() {
  const [user, setUser] = useState<UtilizadorAuth | null>(null);
  const [consultas, setConsultas] = useState<ConsultaDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado da funcionalidade "Reportar Falta Hoje".
  const [faltaPendente, setFaltaPendente] = useState(false);
  const [mostrarDialogFalta, setMostrarDialogFalta] = useState(false);
  const [justificacao, setJustificacao] = useState("");
  const [submetendoFalta, setSubmetendoFalta] = useState(false);
  const [erroFalta, setErroFalta] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const userData = await lerUtilizador();
      if (userData) setUser(userData);

      const [consultasRes, ausenciasRes] = await Promise.all([
        fetch("/api/staff/consultas/hoje", { credentials: "include", cache: "no-store" }),
        fetch("/api/staff/ausencias", { credentials: "include", cache: "no-store" }),
      ]);

      if (consultasRes.ok) {
        const data = await consultasRes.json();
        setConsultas(data.consultas ?? []);
      }

      // Verifica se já existe uma ausência pendente_emergencia para hoje.
      if (ausenciasRes.ok) {
        const ausData = await ausenciasRes.json();
        const hoje = new Date();
        const hojeUTC = new Date(
          Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())
        );
        const temFaltaHoje = (ausData.ausencias ?? []).some((a: { estado: string; data_inicio: string; data_fim: string }) => {
          if (a.estado !== "pendente_emergencia") return false;
          const ini = parsearDataSegura(a.data_inicio);
          const fim = parsearDataSegura(a.data_fim);
          if (!ini || !fim) return false;
          return hojeUTC >= ini && hojeUTC <= fim;
        });
        setFaltaPendente(temFaltaHoje);
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Submete a falta de emergência para o dia atual. */
  async function handleReportarFalta(e: React.FormEvent) {
    e.preventDefault();
    setErroFalta(null);
    setSubmetendoFalta(true);
    try {
      const res = await fetch("/api/staff/falta-hoje", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          justificacao: justificacao.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.erro || `Erro ${res.status}`);
      }
      setMostrarDialogFalta(false);
      setJustificacao("");
      setFaltaPendente(true);
    } catch (e) {
      setErroFalta(e instanceof Error ? e.message : "Erro ao reportar falta.");
    } finally {
      setSubmetendoFalta(false);
    }
  }

  const nome = user?.nome ?? "Fisioterapeuta";
  const iniciais = nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Total de minutos de consulta hoje (somatório das durações).
  const totalMinutos = consultas.reduce(
    (acc, c) => acc + (c.duracao_minutos || 0),
    0
  );

  // Evitar mismatch de hidratação: a data formatada depende do timezone.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const hoje = mounted
    ? new Date().toLocaleDateString("pt-PT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  // Filtra consultas ativas (não concluídas/canceladas) e concluídas.
  const consultasAtivas = useMemo(
    () => consultas.filter((c) => !["concluida", "cancelada", "faltou", "nao_compareceu"].includes(c.estado)),
    [consultas]
  );
  const consultasConcluidas = useMemo(
    () => consultas.filter((c) => c.estado === "concluida"),
    [consultas]
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-muted/20">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 border-b bg-background/95 px-5 pb-4 pt-6 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{iniciais}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Bem-vindo,</span>
              <span className="text-lg font-semibold leading-tight">
                {nome}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => fazerLogout()}
              aria-label="Terminar sessão"
              title="Terminar sessão"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Data + resumo */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm capitalize text-muted-foreground">{hoje}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" />
              {consultas.length} consultas
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {Math.floor(totalMinutos / 60)}h{String(totalMinutos % 60).padStart(2, "0")}
            </span>
          </div>
        </div>
      </header>

      {/* Lista de consultas */}
      <main className="flex-1 space-y-4 p-5">
        {/* Reportar Falta Hoje */}
        {faltaPendente ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Falta reportada.</strong> Aguarda confirmação do Administrador.
            </span>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-center gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setMostrarDialogFalta(true);
              setErroFalta(null);
            }}
          >
            <AlertTriangle className="h-4 w-4" />
            Reportar Falta Hoje
          </Button>
        )}

        {/* Botões de navegação */}
        <Link href="/staff/calendario" prefetch>
          <Button variant="outline" className="w-full justify-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Ver a minha Agenda
          </Button>
        </Link>

        <Link href="/staff/ausencias" prefetch>
          <Button variant="outline" className="w-full justify-center gap-2">
            <CalendarOff className="h-4 w-4" />
            Pedidos de Ausência
          </Button>
        </Link>

        <Link href="/staff/notificacoes" prefetch>
          <Button variant="outline" className="w-full justify-center gap-2">
            <Bell className="h-4 w-4" />
            Histórico de Notificações
          </Button>
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            A carregar consultas…
          </div>
        ) : (
          <>
            {/* Cabeçalho da lista */}
            <div className="pt-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Minhas Consultas de Hoje
              </h2>
            </div>

            {/* Consultas ativas */}
            {consultasAtivas.length > 0 && (
              <div className="space-y-4">
                {consultasAtivas.map((c) => (
                  <ConsultaCard key={c._id} consulta={c} />
                ))}
              </div>
            )}

            {/* Consultas concluídas */}
            {consultasConcluidas.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pt-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Concluídas ({consultasConcluidas.length})
                  </h2>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-4 opacity-60">
                  {consultasConcluidas.map((c) => (
                    <ConsultaCard key={c._id} consulta={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Sem consultas hoje */}
            {consultas.length === 0 && (
              <div className="mt-10 flex flex-col items-center gap-2 text-center text-muted-foreground">
                <ClipboardList className="h-10 w-10 opacity-40" />
                <p className="text-sm">Sem consultas marcadas para hoje.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Rodapé */}
      <footer className="border-t px-5 py-4 text-center text-xs text-muted-foreground">
        FisioFernandes · Área do Fisioterapeuta
      </footer>

      {/* Dialog: Reportar Falta Hoje */}
      <Dialog open={mostrarDialogFalta} onOpenChange={setMostrarDialogFalta}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Reportar Falta Hoje
          </DialogTitle>
          <DialogDescription>
            Tem a certeza que não pode trabalhar hoje? O Administrador será
            notificado para reatribuir as suas consultas.
          </DialogDescription>
          <DialogClose onClick={() => setMostrarDialogFalta(false)} />
        </DialogHeader>
        <form onSubmit={handleReportarFalta}>
          <DialogContent className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="justificacao" className="text-sm font-medium">
                Motivo / Justificação (opcional)
              </label>
              <textarea
                id="justificacao"
                value={justificacao}
                onChange={(e) => setJustificacao(e.target.value)}
                rows={3}
                placeholder="Ex.: Doença súbita, emergência familiar…"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {erroFalta && (
              <p className="text-sm text-destructive">{erroFalta}</p>
            )}
          </DialogContent>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMostrarDialogFalta(false)}
              disabled={submetendoFalta}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={submetendoFalta}
            >
              {submetendoFalta ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A enviar…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Confirmar Falta
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
