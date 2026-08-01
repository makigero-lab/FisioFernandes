"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  AlertCircle,
} from "lucide-react";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptLocale from "@fullcalendar/core/locales/pt";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type { ConsultaDTO, EstadoConsulta } from "@/lib/api";

/**
 * Calendário do Fisioterapeuta — /staff/calendario
 *
 * RF2 — Refatorizado do calendário legacy (que consumia o stub
 * /api/auth/me/calendario com Tarefas) para usar a API real de Consultas
 * via /api/staff/consultas (proxy → /api/gestor/consultas).
 *
 * FullCalendar v6 com:
 *   - Vista mensal + semanal + diária
 *   - Eventos carregados dinamicamente (fetch com inicio/fim do range visível)
 *   - Título do evento: sala + nome do paciente
 *   - Cores por estado da consulta
 *   - eventClick → /staff/consultas/${id}
 */

// ------------------------------------------------------------------ //
// Helpers                                                             //
// ------------------------------------------------------------------ //

/** Extrai o nome do paciente do ConsultaDTO (com populate do backend). */
function nomePaciente(c: ConsultaDTO): string {
  if (c.paciente_id && typeof c.paciente_id === "object" && "nome" in c.paciente_id) {
    return c.paciente_id.nome || "Paciente";
  }
  return "Paciente";
}

/** Extrai o nome da sala do ConsultaDTO (com populate do backend). */
function nomeSala(c: ConsultaDTO): string {
  if (c.sala_id && typeof c.sala_id === "object" && "nome" in c.sala_id) {
    return c.sala_id.nome || "Sala";
  }
  return "Sala";
}

/** Mapa de cores por estado da consulta. */
const corPorEstado: Record<EstadoConsulta, string> = {
  marcada: "#2563eb",        // azul
  confirmada: "#2563eb",     // azul
  em_curso: "#d97706",       // amarelo/laranja
  concluida: "#16a34a",      // verde
  cancelada: "#dc2626",      // vermelho
  faltou: "#dc2626",         // vermelho
  nao_compareceu: "#dc2626", // vermelho
};

/** Converte ConsultaDTO para EventInput do FullCalendar. */
function consultaParaEvento(c: ConsultaDTO): EventInput {
  return {
    id: c._id,
    title: `${nomeSala(c)} · ${nomePaciente(c)}`,
    start: c.data_hora_inicio,
    end: c.data_hora_fim,
    backgroundColor: corPorEstado[c.estado] || "#6b7280",
    borderColor: corPorEstado[c.estado] || "#6b7280",
    extendedProps: { estado: c.estado, tipo: c.tipo },
  };
}

// ------------------------------------------------------------------ //
// Componente                                                          //
// ------------------------------------------------------------------ //

export default function StaffCalendarioPage() {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  /**
   * Função de eventos do FullCalendar — chamada quando o calendário
   * muda de mês/semana/dia. Recebe o range de datas visível (start, end)
   * e faz fetch ao backend com esses parâmetros.
   */
  async function fetchEventos(fetchInfo: {
    start: Date;
    end: Date;
    startStr: string;
    endStr: string;
  }): Promise<EventInput[]> {
    try {
      const params = new URLSearchParams({
        inicio: fetchInfo.startStr,
        fim: fetchInfo.endStr,
      });

      const res = await fetch(`/api/staff/consultas?${params}`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Erro ${res.status}`);
      }

      const data = await res.json();
      const consultas: ConsultaDTO[] = data.consultas || [];

      return consultas.map(consultaParaEvento);
    } catch (err) {
      console.error("❌ [Calendário Staff] erro ao carregar eventos:", err);
      setErro("Não foi possível carregar as consultas.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  /** eventClick — redireciona para o detalhe da consulta. */
  function handleEventClick(info: EventClickArg) {
    const consultaId = info.event.id;
    router.push(`/staff/consultas/${consultaId}`);
  }

  /** datesSet — limpa erro quando muda de vista. */
  function handleDatesSet(_info: DatesSetArg) {
    setErro(null);
    setLoading(true);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-muted/20">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 border-b bg-background/95 px-5 pb-4 pt-6 backdrop-blur">
        <Link
          href="/staff"
          prefetch
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">
            A minha Agenda
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Consultas marcadas
        </p>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 p-5">
        {erro && (
          <Card className="mb-4 border-destructive/50">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{erro}</span>
            </CardContent>
          </Card>
        )}

        {/* Legenda de cores */}
        <div className="mb-4 flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: "#2563eb" }} />
            Marcada/Confirmada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: "#d97706" }} />
            Em Curso
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: "#16a34a" }} />
            Concluída
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: "#dc2626" }} />
            Cancelada/Faltou
          </span>
        </div>

        {/* FullCalendar */}
        <div className="overflow-hidden rounded-lg border bg-background">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={ptLocale}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={fetchEventos}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height="auto"
            contentHeight={500}
            firstDay={1} // Segunda-feira
            slotMinTime="08:00:00"
            slotMaxTime="20:00:00"
            nowIndicator
            eventDisplay="block"
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            displayEventEnd
            eventContent={(arg: { timeText: string; event: { title: string; extendedProps: { estado?: string } } }) => {
              // Render custom para mostrar hora + título de forma compacta.
              return (
                <div className="overflow-hidden px-1 py-0.5 text-xs">
                  <div className="font-semibold">{arg.timeText}</div>
                  <div className="truncate">{arg.event.title}</div>
                </div>
              );
            }}
          />
        </div>

        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar consultas…
          </div>
        )}
      </main>

      {/* Rodapé */}
      <footer className="border-t px-5 py-4 text-center text-xs text-muted-foreground">
        FisioFernandes · Área do Fisioterapeuta
      </footer>
    </div>
  );
}
