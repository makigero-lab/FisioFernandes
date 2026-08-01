/**
 * Proxy route: GET /api/staff/consultas/hoje
 *
 * Devolve as consultas de HOJE do fisioterapeuta autenticado.
 *
 * Internamente faz proxy para o endpoint do backend:
 *   GET /api/gestor/consultas?inicio=<meia-noite UTC de hoje>&fim=<meia-noite UTC de amanhã>
 *
 * O backend (consultaController.listarConsultas) aplica automaticamente o filtro
 * `fisioterapeuta_id = req.user.id` quando o role é 'fisioterapeuta' — por isso
 * o fisio só vê as SUAS consultas, sem necessidade de passar o ID explicitamente.
 *
 * Resposta 200: { consultas: ConsultaDTO[], total: number }
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const COOKIE_NAME = "fisiofernandes_token";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { erro: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    // Calcula o intervalo de HOJE em UTC (meia-noite UTC a meia-noite de amanhã).
    // O backend filtra por data_hora_inicio entre inicio e fim.
    const agora = new Date();
    const inicioHoje = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
    );
    const fimHoje = new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);

    const url = `${BACKEND_URL}/api/gestor/consultas?inicio=${encodeURIComponent(
      inicioHoje.toISOString()
    )}&fim=${encodeURIComponent(fimHoje.toISOString())}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    // O backend devolve { consultas: [...], total: N } — repassamos tal qual.
    const response = NextResponse.json(data, { status: res.status });
    if (res.status === 401) {
      response.cookies.delete(COOKIE_NAME);
    }
    return response;
  } catch {
    return NextResponse.json(
      { erro: "Erro ao comunicar com o backend." },
      { status: 502 }
    );
  }
}
