"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Timer,
  Stethoscope,
  CheckCircle2,
  ListChecks,
  User,
  UserCheck,
  Activity,
  CalendarCheck,
  Play,
  Loader2,
  AlertTriangle,
  ClipboardList,
  FileText,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

import { cn, parsearDataSegura } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ConsultaDTO, TipoConsulta, EstadoConsulta } from "@/lib/api";

const tipoLabel: Record<TipoConsulta, string> = {
  primeira_consulta: "Primeira Consulta",
  sessao: "Sessão",
  reavaliacao: "Reavaliação",
  alta: "Alta",
  grupo: "Sessão de Grupo",
};

const tipoIcon: Record<TipoConsulta, React.ComponentType<{ className?: string }>> = {
  primeira_consulta: UserCheck,
  sessao: Activity,
  reavaliacao: Stethoscope,
  alta: CalendarCheck,
  grupo: User,
};

const estadoLabel: Record<EstadoConsulta, string> = {
  marcada: "Marcada",
  confirmada: "Confirmada",
  em_curso: "Em Curso",
  concluida: "Concluída",
  cancelada: "Cancelada",
  faltou: "Faltou",
  nao_compareceu: "Não Compareceu",
};

function formatarDataHora(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = parsearDataSegura(iso);
    if (!d) return "—";
    return format(d, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt });
  } catch {
    return "—";
  }
}

function formatarHora(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = parsearDataSegura(iso);
    if (!d) return "—";
    return format(d, "HH:mm", { locale: pt });
  } catch {
    return "—";
  }
}

function formatarMinutos(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

// Helpers para extrair dados do ConsultaDTO (com populate do backend).
function nomePaciente(c: ConsultaDTO): string {
  if (c.paciente_id && typeof c.paciente_id === "object" && "nome" in c.paciente_id) {
    return c.paciente_id.nome || "Paciente";
  }
  return "Paciente";
}
function telefonePaciente(c: ConsultaDTO): string | null {
  if (c.paciente_id && typeof c.paciente_id === "object" && "telefone" in c.paciente_id) {
    return (c.paciente_id as { telefone?: string }).telefone || null;
  }
  return null;
}
function nomeSala(c: ConsultaDTO): string {
  if (c.sala_id && typeof c.sala_id === "object" && "nome" in c.sala_id) {
    return c.sala_id.nome || "Sala";
  }
  return "Sala";
}
function nomeFisio(c: ConsultaDTO): string {
  if (c.fisioterapeuta_id && typeof c.fisioterapeuta_id === "object" && "nome" in c.fisioterapeuta_id) {
    return c.fisioterapeuta_id.nome || "Fisioterapeuta";
  }
  return "Fisioterapeuta";
}

interface ProtocoloSeccao {
  nome: string;
  items: { texto: string; concluido: boolean }[];
}

/**
 * Detalhe da Consulta — /staff/consultas/[id]
 *
 * Componente client-side que mostra:
 *   - Dados do paciente (nome, telefone)
 *   - Dados da consulta (tipo, sala, fisio, data/hora, duração, estado)
 *   - ModeloProtocolo aplicado (snapshot imutável na consulta, se existir)
 *   - Botão "Iniciar Consulta" (muda estado para 'em_curso') se aplicável
 *   - Formulário de Nota Clínica SOAP (S/O/A/P/Tratamento) + items do protocolo
 *   - Campo de Cédula Profissional (obrigatório para concluir)
 *   - Botão "Concluir Consulta" (muda estado para 'concluida' + grava SOAP)
 *
 * Substitui o antigo DetalheTarefaClient (legacy do Alojamento Local).
 *
 * Backend: PATCH /api/staff/consultas/:id/nota-clinica
 *   - Body: { subjetivo, objetivo, avaliacao, plano, tratamento_efetuado,
 *             protocolo_aplicado?, estado?: 'em_curso' | 'concluida' }
 *   - A cédula é validada pelo backend a partir do perfil do fisioterapeuta
 *     (perfil_profissional.cedula), NÃO do body.
 *   - Consultas concluídas são imutáveis (RGPD/legal).
 */
export function DetalheConsultaClient({ consulta: consultaInicial }: { consulta: ConsultaDTO }) {
  const router = useRouter();
  const Icon = tipoIcon[consultaInicial.tipo] ?? Activity;

  const [consulta, setConsulta] = useState<ConsultaDTO>(consultaInicial);
  const [subjetivo, setSubjetivo] = useState(consultaInicial.nota_clinica?.subjetivo ?? "");
  const [objetivo, setObjetivo] = useState(consultaInicial.nota_clinica?.objetivo ?? "");
  const [avaliacao, setAvaliacao] = useState(consultaInicial.nota_clinica?.avaliacao ?? "");
  const [plano, setPlano] = useState(consultaInicial.nota_clinica?.plano ?? "");
  const [tratamento, setTratamento] = useState(consultaInicial.nota_clinica?.tratamento_efetuado ?? "");

  // Cédula — o backend valida a do perfil do fisio, mas pedimos confirmação
  // visual ao fisio (must be non-empty to enable Concluir). O valor mostrado
  // por defeito é o que já está na consulta (cedula_assinante) se houver.
  const [cedulaConfirmada, setCedulaConfirmada] = useState(
    consultaInicial.nota_clinica?.cedula_assinante ?? ""
  );

  // Protocolo aplicado (snapshot) — editável (marcar items concluídos).
  const [protocolo, setProtocolo] = useState<ProtocoloSeccao[]>(
    Array.isArray(consultaInicial.nota_clinica?.protocolo_aplicado)
      ? (consultaInicial.nota_clinica!.protocolo_aplicado as unknown as ProtocoloSeccao[])
      : []
  );

  const [guardando, setGuardando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const jaConcluida = consulta.estado === "concluida";
  const emCurso = consulta.estado === "em_curso";
  const podeIniciar = ["marcada", "confirmada"].includes(consulta.estado);
  const cancelada = ["cancelada", "faltou", "nao_compareceu"].includes(consulta.estado);

  const totalItensProtocolo = protocolo.reduce((acc, sec) => acc + sec.items.length, 0);
  const itensConcluidos = protocolo.reduce(
    (acc, sec) => acc + sec.items.filter((i) => i.concluido).length,
    0
  );

  // Validação: para concluir, a cédula confirmada tem de estar preenchida.
  const podeConcluir = !jaConcluida && !cancelada && cedulaConfirmada.trim().length > 0;

  function toggleProtocoloItem(secIdx: number, itemIdx: number, value: boolean) {
    setProtocolo((prev) =>
      prev.map((sec, si) =>
        si === secIdx
          ? {
              ...sec,
              items: sec.items.map((item, ii) =>
                ii === itemIdx ? { ...item, concluido: value } : item
              ),
            }
          : sec
      )
    );
  }

  /**
   * Guarda a nota clínica (SOAP) sem mudar o estado.
   * Disponível quando a consulta está em_curso (ou marcada/confirmada — permite rascunho).
   */
  async function handleGuardarNota() {
    setGuardando(true);
    setErro(null);
    setSucesso(null);
    try {
      const res = await fetch(`/api/staff/consultas/${consulta._id}/nota-clinica`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjetivo,
          objetivo,
          avaliacao,
          plano,
          tratamento_efetuado: tratamento,
          protocolo_aplicado: protocolo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.erro || `Erro ${res.status}`);
      }
      if (data.consulta) setConsulta(data.consulta);
      setSucesso("Nota clínica guardada com sucesso.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar a nota clínica.");
    } finally {
      setGuardando(false);
    }
  }

  /**
   * Inicia a consulta (muda estado para 'em_curso').
   */
  async function handleIniciar() {
    setIniciando(true);
    setErro(null);
    setSucesso(null);
    try {
      const res = await fetch(`/api/staff/consultas/${consulta._id}/nota-clinica`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "em_curso" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.erro || `Erro ${res.status}`);
      }
      if (data.consulta) setConsulta(data.consulta);
      setSucesso("Consulta iniciada.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao iniciar a consulta.");
    } finally {
      setIniciando(false);
    }
  }

  /**
   * Conclui a consulta (muda estado para 'concluida' + grava SOAP + cédula).
   * Exige cédula confirmada (preenchida pelo fisio no formulário).
   */
  async function handleConcluir() {
    if (!cedulaConfirmada.trim()) {
      setErro("É obrigatório confirmar a cédula profissional para concluir a consulta.");
      return;
    }
    setConcluindo(true);
    setErro(null);
    setSucesso(null);
    try {
      const res = await fetch(`/api/staff/consultas/${consulta._id}/nota-clinica`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjetivo,
          objetivo,
          avaliacao,
          plano,
          tratamento_efetuado: tratamento,
          protocolo_aplicado: protocolo,
          estado: "concluida",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.erro || `Erro ${res.status}`);
      }
      if (data.consulta) setConsulta(data.consulta);
      setSucesso("Consulta concluída com sucesso. Nota clínica assinada.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao concluir a consulta.");
    } finally {
      setConcluindo(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-muted/20">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 border-b bg-background/95 px-5 pb-4 pt-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/staff")}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-tight">
                {nomePaciente(consulta)}
              </h1>
              <p className="text-xs text-muted-foreground">
                {tipoLabel[consulta.tipo]}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge
            variant={
              jaConcluida ? "success" :
              emCurso ? "warning" :
              cancelada ? "destructive" : "secondary"
            }
            className={cn(emCurso && "bg-blue-500/15 text-blue-700 border-blue-500/40")}
          >
            {estadoLabel[consulta.estado]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatarDataHora(consulta.data_hora_inicio)}
          </span>
        </div>
      </header>

      <main className="flex-1 space-y-4 p-5">
        {/* Aviso de consulta imutável (concluída/cancelada) */}
        {jaConcluida && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Consulta concluída.</strong> A nota clínica está assinada e é imutável (RGPD/legal).
              {consulta.nota_clinica?.cedula_assinante && (
                <> Cédula do assinante: <strong>{consulta.nota_clinica.cedula_assinante}</strong>.</>
              )}
            </span>
          </div>
        )}
        {cancelada && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Consulta {estadoLabel[consulta.estado].toLowerCase()}.</strong> Não pode ser editada.
            </span>
          </div>
        )}

        {/* Dados da Consulta */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="h-5 w-5 text-primary" />
              Detalhes da Consulta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Início</p>
                  <p className="font-medium tabular-nums">{formatarHora(consulta.data_hora_inicio)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Duração</p>
                  <p className="font-medium">{formatarMinutos(consulta.duracao_minutos)}</p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Sala:</span>
                <span className="font-medium">{nomeSala(consulta)}</span>
              </p>
              <p className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Fisioterapeuta:</span>
                <span className="font-medium">{nomeFisio(consulta)}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dados do Paciente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-primary" />
              Paciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Nome:</span>{" "}
              <strong>{nomePaciente(consulta)}</strong>
            </p>
            {telefonePaciente(consulta) && (
              <p>
                <span className="text-muted-foreground">Telefone:</span>{" "}
                <span className="font-medium tabular-nums">{telefonePaciente(consulta)}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Protocolo Aplicado (se existir snapshot) */}
        {protocolo.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-5 w-5 text-primary" />
                Protocolo Aplicado
                <Badge variant="secondary" className="ml-auto text-xs">
                  {itensConcluidos}/{totalItensProtocolo}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {protocolo.map((sec, si) => (
                <div key={si} className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{sec.nome}</p>
                  <div className="space-y-2">
                    {sec.items.map((item, ii) => (
                      <div key={ii} className="flex items-start gap-2">
                        <Checkbox
                          id={`sec-${si}-item-${ii}`}
                          checked={item.concluido}
                          onCheckedChange={(v) => toggleProtocoloItem(si, ii, v === true)}
                          disabled={jaConcluida || cancelada}
                        />
                        <label
                          htmlFor={`sec-${si}-item-${ii}`}
                          className={cn(
                            "text-sm leading-relaxed cursor-pointer",
                            item.concluido && "line-through text-muted-foreground",
                            (jaConcluida || cancelada) && "cursor-not-allowed"
                          )}
                        >
                          {item.texto}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Nota Clínica SOAP */}
        {!cancelada && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-primary" />
                Nota Clínica (SOAP)
                {jaConcluida && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    <Lock className="mr-1 h-3 w-3" /> Imutável
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="subjetivo">
                  S — Subjetivo
                </label>
                <Textarea
                  id="subjetivo"
                  value={subjetivo}
                  onChange={(e) => setSubjetivo(e.target.value)}
                  rows={2}
                  disabled={jaConcluida}
                  placeholder="Motivo da consulta, sintomas relatados pelo paciente..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="objetivo">
                  O — Objetivo
                </label>
                <Textarea
                  id="objetivo"
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  rows={2}
                  disabled={jaConcluida}
                  placeholder="Observação clínica, amplitude de movimento, palpação..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="avaliacao">
                  A — Avaliação
                </label>
                <Textarea
                  id="avaliacao"
                  value={avaliacao}
                  onChange={(e) => setAvaliacao(e.target.value)}
                  rows={2}
                  disabled={jaConcluida}
                  placeholder="Diagnóstico clínico, evolução..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="plano">
                  P — Plano
                </label>
                <Textarea
                  id="plano"
                  value={plano}
                  onChange={(e) => setPlano(e.target.value)}
                  rows={2}
                  disabled={jaConcluida}
                  placeholder="Plano de tratamento, próximos passos..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="tratamento">
                  Tratamento Efetuado
                </label>
                <Textarea
                  id="tratamento"
                  value={tratamento}
                  onChange={(e) => setTratamento(e.target.value)}
                  rows={2}
                  disabled={jaConcluida}
                  placeholder="Técnicas aplicadas, exercícios, duração..."
                />
              </div>

              {/* Cédula Profissional — obrigatória para concluir */}
              {!jaConcluida && (
                <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-50 p-3 dark:bg-amber-950/20">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-100" htmlFor="cedula">
                    <AlertTriangle className="h-4 w-4" />
                    Cédula Profissional (obrigatória para concluir)
                  </label>
                  <Input
                    id="cedula"
                    value={cedulaConfirmada}
                    onChange={(e) => setCedulaConfirmada(e.target.value)}
                    placeholder="Confirmar cédula profissional..."
                    disabled={jaConcluida}
                  />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    A cédula é validada pelo backend contra o teu perfil (perfil_profissional.cedula).
                    Sem cédula válida não podes assinar notas clínicas.
                  </p>
                </div>
              )}

              {erro && (
                <p className="text-sm text-destructive">{erro}</p>
              )}
              {sucesso && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">{sucesso}</p>
              )}

              {/* Botões de ação */}
              <div className="flex flex-col gap-2 pt-2">
                {!jaConcluida && !cancelada && (
                  <>
                    {podeIniciar && (
                      <Button
                        onClick={handleIniciar}
                        disabled={iniciando || guardando || concluindo}
                        variant="default"
                        className="w-full gap-2"
                      >
                        {iniciando ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> A iniciar...</>
                        ) : (
                          <><Play className="h-4 w-4" /> Iniciar Consulta</>
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={handleGuardarNota}
                      disabled={guardando || iniciando || concluindo}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      {guardando ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> A guardar...</>
                      ) : (
                        <><FileText className="h-4 w-4" /> Guardar Nota (rascunho)</>
                      )}
                    </Button>
                    <Button
                      onClick={handleConcluir}
                      disabled={!podeConcluir || guardando || iniciando || concluindo}
                      variant="default"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {concluindo ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> A concluir...</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4" /> Concluir Consulta</>
                      )}
                    </Button>
                    {!podeConcluir && !jaConcluida && (
                      <p className="text-center text-xs text-muted-foreground">
                        Preenche a cédula profissional para poder concluir.
                      </p>
                    )}
                  </>
                )}
                {jaConcluida && (
                  <div className="flex items-center justify-center gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                    Consulta concluída e assinada.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Voltar */}
        <Link href="/staff" prefetch>
          <Button variant="ghost" className="w-full gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar às Minhas Consultas
          </Button>
        </Link>
      </main>

      <footer className="border-t px-5 py-4 text-center text-xs text-muted-foreground">
        FisioFernandes · Área do Fisioterapeuta
      </footer>
    </div>
  );
}
