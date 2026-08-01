/**
 * Catch-all proxy: /api/staff/consultas/[...path]
 *
 * Encaminha pedidos do frontend /api/staff/consultas/* para o endpoint do
 * backend /api/gestor/consultas/* (onde as consultas realmente vivem), injetando
 * o token JWT do cookie httpOnly.
 *
 * Isto permite que o frontend do fisioterapeuta aceda a:
 *   GET    /api/staff/consultas/:id             — detalhe de uma consulta
 *   PATCH  /api/staff/consultas/:id/nota-clinica — registar/atualizar SOAP
 *   PUT    /api/staff/consultas/:id             — atualizar consulta (ex.: mudar estado)
 *   DELETE /api/staff/consultas/:id             — eliminar (apenas diretor/admin)
 *
 * O backend aplica as permissões por role: fisioterapeuta só vê/edita as SUAS
 * consultas (filtro automático em listarConsultas; validação em obterConsulta).
 *
 * Nota: a rota /api/staff/consultas/hoje é tratada por route handler próprio
 * (faz o cálculo do intervalo de hoje antes de chamar o backend).
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const COOKIE_NAME = "fisiofernandes_token";

async function proxyHandler(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathString = path.join("/");

    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { erro: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    const method = req.method;
    let body: string | undefined;
    if (method !== "GET" && method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = await req.text();
    }

    const url = new URL(req.url);
    const queryString = url.search;
    // Mapeia /api/staff/consultas/* → /api/gestor/consultas/* no backend.
    const backendUrl = `${BACKEND_URL}/api/gestor/consultas/${pathString}${queryString}`;

    const res = await fetch(backendUrl, {
      method,
      headers,
      body,
      cache: "no-store",
    });

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

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
