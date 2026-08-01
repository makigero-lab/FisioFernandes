"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";

import { DetalheConsultaClient } from "@/components/staff/detalhe-consulta-client";
import type { ConsultaDTO } from "@/lib/api";

/**
 * Ecrã de Detalhe da Consulta — /staff/consultas/[id]
 *
 * Client Component: busca a consulta real da API
 * (GET /api/staff/consultas/:id → proxy para /api/gestor/consultas/:id no backend)
 * e passa ao DetalheConsultaClient que gere o estado interativo (SOAP, protocolo,
 * iniciar/concluir).
 *
 * O backend aplica a permissão por role: o fisioterapeuta só obtém a consulta
 * se for o fisioterapeuta_id atribuído (consultaController.obterConsulta valida
 * req.user.role === 'fisioterapeuta' && consulta.fisioterapeuta_id === req.user.id).
 */
export default function DetalheConsultaPage({
  params,
}: {
  params: { id: string };
}) {
  const [consulta, setConsulta] = useState<ConsultaDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/staff/consultas/${params.id}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json();
        if (res.ok && data.consulta) {
          setConsulta(data.consulta as ConsultaDTO);
        } else if (res.status === 404) {
          setErro("Consulta não encontrada.");
        } else if (res.status === 403) {
          setErro("Não tem permissão para ver esta consulta.");
        } else {
          setErro(data?.erro || `Erro ${res.status}`);
        }
      } catch {
        setErro("Erro ao comunicar com o backend.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (erro || !consulta) {
    if (!erro) notFound();
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-destructive">{erro}</p>
      </div>
    );
  }

  return <DetalheConsultaClient consulta={consulta} />;
}
