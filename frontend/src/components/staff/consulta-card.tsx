import Link from "next/link";
import {
  Clock,
  Timer,
  User,
  Stethoscope,
  ChevronRight,
  Activity,
  UserCheck,
  CalendarCheck,
  XCircle,
  UserX,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

import { cn, parsearDataSegura } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ConsultaDTO, EstadoConsulta, TipoConsulta } from "@/lib/api";

const tipoIcon: Record<TipoConsulta, React.ComponentType<{ className?: string }>> = {
  primeira_consulta: UserCheck,
  sessao: Activity,
  reavaliacao: Stethoscope,
  alta: CalendarCheck,
  grupo: User,
};

const tipoLabel: Record<TipoConsulta, string> = {
  primeira_consulta: "Primeira Consulta",
  sessao: "Sessão",
  reavaliacao: "Reavaliação",
  alta: "Alta",
  grupo: "Sessão de Grupo",
};

const estadoConfig: Record<
  EstadoConsulta,
  { label: string; variant: "default" | "secondary" | "destructive" | "warning" | "success"; className?: string }
> = {
  marcada: { label: "Marcada", variant: "secondary" },
  confirmada: { label: "Confirmada", variant: "success" },
  em_curso: { label: "Em Curso", variant: "warning", className: "bg-blue-500/15 text-blue-700 border-blue-500/40" },
  concluida: { label: "Concluída", variant: "success" },
  cancelada: { label: "Cancelada", variant: "destructive" },
  faltou: { label: "Faltou", variant: "destructive" },
  nao_compareceu: { label: "Não Compareceu", variant: "destructive" },
};

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

/**
 * Extrai o nome do paciente a partir do ConsultaDTO.
 * O backend faz populate de paciente_id (devolve {_id, nome, telefone}).
 */
function nomePaciente(c: ConsultaDTO): string {
  if (c.paciente_id && typeof c.paciente_id === "object" && "nome" in c.paciente_id) {
    return c.paciente_id.nome || "Paciente";
  }
  return "Paciente";
}

/**
 * Extrai o nome da sala a partir do ConsultaDTO.
 * O backend faz populate de sala_id (devolve {_id, nome}).
 */
function nomeSala(c: ConsultaDTO): string {
  if (c.sala_id && typeof c.sala_id === "object" && "nome" in c.sala_id) {
    return c.sala_id.nome || "Sala";
  }
  return "Sala";
}

/**
 * Cartão de Consulta para a área do Fisioterapeuta (mobile-first).
 *
 * Mostra: nome do paciente, tipo de consulta, hora de início, duração,
 * sala e estado. O cartão inteiro é clicável e leva a /staff/consultas/[id].
 *
 * Substitui o antigo TaskCard (legacy do Alojamento Local — Tarefas de Limpeza).
 */
export function ConsultaCard({ consulta }: { consulta: ConsultaDTO }) {
  const Icon = tipoIcon[consulta.tipo] ?? Activity;
  const estadoInfo = estadoConfig[consulta.estado] ?? estadoConfig.marcada;
  const hora = formatarHora(consulta.data_hora_inicio);
  const paciente = nomePaciente(consulta);
  const sala = nomeSala(consulta);
  const cancelada = ["cancelada", "faltou", "nao_compareceu"].includes(consulta.estado);

  return (
    <Link href={`/staff/consultas/${consulta._id}`} prefetch className="block">
      <Card
        className={cn(
          "cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-primary/40 active:scale-[0.99]",
          consulta.estado === "em_curso" && "border-blue-500/50",
          cancelada && "opacity-60"
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                consulta.estado === "em_curso"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "bg-primary/10 text-primary"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{paciente}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tipoLabel[consulta.tipo]}
              </p>
            </div>
          </div>
          <Badge variant={estadoInfo.variant} className={cn("shrink-0", estadoInfo.className)}>
            {estadoInfo.label}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-[11px] uppercase text-muted-foreground">
                  Início
                </span>
                <span className="font-medium tabular-nums">{hora}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-[11px] uppercase text-muted-foreground">
                  Duração
                </span>
                <span className="font-medium">
                  {formatarMinutos(consulta.duracao_minutos)}
                </span>
              </div>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Stethoscope className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Sala: {sala}</span>
          </p>

          {consulta.nota_clinica?.cedula_assinante && (
            <p className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">SOAP registado</span>
            </p>
          )}

          {cancelada && (
            <p className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">{estadoInfo.label}</span>
            </p>
          )}

          <Button
            variant={cancelada ? "outline" : "default"}
            className="w-full"
            disabled={cancelada}
          >
            {!cancelada && (
              <>
                Ver detalhe
                <ChevronRight className="h-4 w-4" />
              </>
            )}
            {cancelada && "Indisponível"}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
