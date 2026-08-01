/**
 * Proxy route: GET /api/staff/consultas
 *
 * Lista as consultas do fisioterapeuta autenticado com filtros de data.
 * Internamente faz proxy para o endpoint do backend:
 *   GET /api/gestor/consultas?inicio=...&fim=...
 *
 * O backend aplica automaticamente o filtro `fisioterapeuta_id = req.user.id`
 * quando o role é 'fisioterapeuta' — o fisio só vê as SUAS consultas.
 *
 * Query params:
 *   - inicio (ISO string): data de início do intervalo
 *   - fim (ISO string): data de fim do intervalo
 *
 * Resposta 200: { consultas: ConsultaDTO[], total: number }
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const COOKIE_NAME = "fisiofernandes_token";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { erro: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    // Repassa os query params (inicio, fim) para o backend.
    const url = new URL(req.url);
    const queryString = url.search;

    const res = await fetch(
      `${BACKEND_URL}/api/gestor/consultas${queryString}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    const data = await res.json();

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
