"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Building2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Power,
  Pencil,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  adminGet,
  adminPost,
  adminPatch,
  adminPut,
  type PropriedadeDTO,
  type UtilizadorDTO,
} from "@/lib/api";

/**
 * Página de Salas — Painel do Gestor.
 *
 * Rebranding — Refatorizada do domínio legacy "Propriedades" (Alojamento
 * Local + Smoobu) para "Salas" / "Salas de Tratamento" (Fisioterapia).
 *
 * Removido completamente:
 *   - Integração com Smoobu (dropdown de apartamentos, botão "Importar do
 *     Smoobu", função carregarSmoobu, handleImportarPropriedades).
 *   - Campo `smoobu_id` do formulário e da tabela.
 *   - Botão "Checklist Padrão" (legado de Tarefas de Limpeza — não se aplica
 *     a Salas clínicas; o fluxo de Consultas usa ModeloProtocolo).
 *   - Select de "Modelo de Checklist" (ModeloChecklist eliminado em F8).
 *   - Avisos de geocoding (a morada da sala é livre; sem Nominatim).
 *
 * Mantido:
 *   - CRUD de salas (nome, morada, tempo_limpeza_minutos, ativo).
 *   - Select de "Fisioterapeuta Preferencial" (campo
 *     funcionario_preferencial_id da sala — mantido no modelo Propriedade).
 *
 * Consome a API real (GET/POST/PUT/PATCH /api/gestor/propriedades). O JWT é
 * enviado automaticamente pelo helper `adminGet`/`adminPost` (cookie httpOnly
 * injetado pelo proxy /api/gestor/[...path]).
 */
export default function SalasPage() {
  const [salas, setSalas] = useState<PropriedadeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Estado do formulário de criação.
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    morada: "",
    tempo_limpeza_minutos: "45",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formErro, setFormErro] = useState<string | null>(null);

  // Estado do modal de edição.
  const [editando, setEditando] = useState<PropriedadeDTO | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "",
    morada: "",
    tempo_limpeza_minutos: "45",
    funcionario_preferencial_id: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErro, setEditErro] = useState<string | null>(null);

  // Feedback de sucesso (toast inline).
  const [sucesso, setSucesso] = useState<string | null>(null);

  /** Carrega as salas da API. */
  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await adminGet<{ propriedades: PropriedadeDTO[] }>(
        "/api/gestor/propriedades"
      );
      setSalas(data.propriedades ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar salas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Submete o formulário de nova sala. */
  async function handleSubmeter(e: React.FormEvent) {
    e.preventDefault();
    setFormErro(null);

    if (!form.nome.trim() || !form.morada.trim()) {
      setFormErro("Nome e Morada são obrigatórios.");
      return;
    }

    const tempo = Number(form.tempo_limpeza_minutos);
    if (Number.isNaN(tempo) || tempo < 0) {
      setFormErro("Duração padrão deve ser um número maior ou igual a 0.");
      return;
    }

    setSubmitting(true);
    try {
      await adminPost<{ propriedade: PropriedadeDTO }>("/api/gestor/propriedades", {
        nome: form.nome.trim(),
        morada: form.morada.trim(),
        tempo_limpeza_minutos: tempo,
      });
      setForm({ nome: "", morada: "", tempo_limpeza_minutos: "45" });
      setMostrarForm(false);
      setSucesso(`Sala "${form.nome.trim()}" criada com sucesso.`);
      await carregar();
    } catch (e) {
      setFormErro(e instanceof Error ? e.message : "Erro ao criar sala.");
    } finally {
      setSubmitting(false);
    }
  }

  /** Alterna ativo/inativo com otimismo. */
  async function handleToggleAtivo(p: PropriedadeDTO) {
    const novoEstado = !p.ativo;
    setSalas((prev) =>
      prev.map((x) => (x._id === p._id ? { ...x, ativo: novoEstado } : x))
    );
    setSucesso(null);
    try {
      await adminPatch(`/api/gestor/propriedades/${p._id}/estado`);
      setSucesso(`Sala "${p.nome}" ${novoEstado ? "ativada" : "desativada"}.`);
    } catch (e) {
      // Reverte em caso de erro.
      setSalas((prev) =>
        prev.map((x) => (x._id === p._id ? { ...x, ativo: p.ativo } : x))
      );
      setErro(e instanceof Error ? e.message : "Erro ao alterar estado.");
    }
  }

  // Lista de fisioterapeutas ativos da empresa (para o select de fisio
  // preferencial no modal de edição). Carregada quando o modal abre.
  const [fisios, setFisios] = useState<UtilizadorDTO[]>([]);
  const carregarFisios = useCallback(async () => {
    try {
      const data = await adminGet<{ utilizadores: UtilizadorDTO[] }>(
        "/api/gestor/equipa"
      );
      setFisios(
        (data.utilizadores ?? []).filter(
          (u) => u.role === "fisioterapeuta" && u.ativo
        )
      );
    } catch {
      // Silencioso — o select fica vazio mas não bloqueia a edição.
    }
  }, []);

  /** Abre o modal de edição com os dados atuais da sala. */
  function abrirEdicao(p: PropriedadeDTO) {
    setEditando(p);
    setEditForm({
      nome: p.nome,
      morada: p.morada ?? "",
      tempo_limpeza_minutos: String(p.tempo_limpeza_minutos ?? 45),
      funcionario_preferencial_id: p.funcionario_preferencial_id ?? "",
    });
    setEditErro(null);
    carregarFisios();
  }

  /** Submete a edição da sala. */
  async function handleEditar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setEditErro(null);

    if (!editForm.nome.trim() || !editForm.morada.trim()) {
      setEditErro("Nome e Morada são obrigatórios.");
      return;
    }

    const tempo = Number(editForm.tempo_limpeza_minutos);
    if (Number.isNaN(tempo) || tempo < 0) {
      setEditErro("Duração padrão deve ser um número maior ou igual a 0.");
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await adminPut<{ propriedade: PropriedadeDTO }>(
        `/api/gestor/propriedades/${editando._id}`,
        {
          nome: editForm.nome.trim(),
          morada: editForm.morada.trim(),
          tempo_limpeza_minutos: tempo,
          // Fisioterapeuta preferencial (string vazia → null no backend).
          funcionario_preferencial_id:
            editForm.funcionario_preferencial_id.trim() || null,
        }
      );
      setSalas((prev) =>
        prev.map((x) => (x._id === editando._id ? res.propriedade : x))
      );
      setSucesso(`Sala "${editForm.nome.trim()}" atualizada.`);
      setEditando(null);
    } catch (e) {
      setEditErro(e instanceof Error ? e.message : "Erro ao editar sala.");
    } finally {
      setEditSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden flex-col gap-1 lg:flex">
          <h1 className="text-2xl font-bold tracking-tight">Salas de Tratamento</h1>
          <p className="text-sm text-muted-foreground">
            Espaços físicos da clínica onde decorrem as consultas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={carregar}
            disabled={loading}
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={() => {
              setMostrarForm((v) => !v);
              setFormErro(null);
            }}
          >
            <Plus className="h-4 w-4" />
            Nova Sala
          </Button>
        </div>
      </div>

      {/* Formulário inline de criação */}
      {mostrarForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" />
              Nova Sala
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmeter} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor="nome" className="text-sm font-medium">
                    Nome
                  </label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nome: e.target.value }))
                    }
                    placeholder="Ex.: Sala 1 — Fisioterapia"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="morada" className="text-sm font-medium">
                    Morada / Localização
                  </label>
                  <Input
                    id="morada"
                    value={form.morada}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, morada: e.target.value }))
                    }
                    placeholder="Ex.: Rua das Flores 12, Lisboa"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="tempo_limpeza_minutos"
                    className="text-sm font-medium"
                  >
                    Duração Padrão (min)
                  </label>
                  <Input
                    id="tempo_limpeza_minutos"
                    type="number"
                    min={0}
                    value={form.tempo_limpeza_minutos}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        tempo_limpeza_minutos: e.target.value,
                      }))
                    }
                    placeholder="45"
                  />
                  <p className="text-xs text-muted-foreground">
                    Duração padrão das consultas nesta sala (em minutos).
                  </p>
                </div>
              </div>

              {formErro && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {formErro}
                </p>
              )}

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A guardar…
                    </>
                  ) : (
                    "Guardar Sala"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMostrarForm(false);
                    setFormErro(null);
                    setForm({ nome: "", morada: "", tempo_limpeza_minutos: "45" });
                  }}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Erro de carregamento */}
      {erro && !loading && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Não foi possível carregar as salas.</p>
              <p className="text-xs opacity-80">{erro}</p>
            </div>
            <Button variant="outline" size="sm" onClick={carregar}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sucesso (toast inline) */}
      {sucesso && (
        <Card className="border-emerald-500/50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{sucesso}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSucesso(null)}
              className="ml-auto"
            >
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabela de salas */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              A carregar salas…
            </div>
          ) : salas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 opacity-40" />
              <p className="text-sm">Ainda não há salas.</p>
              <p className="text-xs">
                Clica em “Nova Sala” para adicionar a primeira.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Morada</th>
                    <th className="px-4 py-3 font-medium">Duração Padrão</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {salas.map((p) => (
                    <tr key={p._id} className={`hover:bg-muted/30 ${!p.ativo ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3 font-medium">{p.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.morada || "—"}
                      </td>
                      <td className="px-4 py-3">{p.tempo_limpeza_minutos} min</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.ativo ? "success" : "secondary"}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => abrirEdicao(p)}
                            aria-label={`Editar ${p.nome}`}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleAtivo(p)}
                            aria-label={p.ativo ? "Desativar" : "Ativar"}
                            title={p.ativo ? "Desativar" : "Ativar"}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição */}
      <Dialog
        open={editando !== null}
        onOpenChange={(o) => !o && setEditando(null)}
      >
        <DialogHeader>
          <div>
            <DialogTitle>Editar Sala</DialogTitle>
            <DialogDescription>
              Atualiza os dados da sala de tratamento.
            </DialogDescription>
          </div>
          <DialogClose onClick={() => setEditando(null)} />
        </DialogHeader>
        <form onSubmit={handleEditar}>
          <DialogContent className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-nome" className="text-sm font-medium">
                Nome
              </label>
              <Input
                id="edit-nome"
                value={editForm.nome}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, nome: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-morada" className="text-sm font-medium">
                Morada / Localização
              </label>
              <Input
                id="edit-morada"
                value={editForm.morada}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, morada: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-tempo"
                className="text-sm font-medium"
              >
                Duração Padrão (minutos)
              </label>
              <Input
                id="edit-tempo"
                type="number"
                min={0}
                value={editForm.tempo_limpeza_minutos}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    tempo_limpeza_minutos: e.target.value,
                  }))
                }
                required
              />
            </div>

            {/* Fisioterapeuta Preferencial */}
            <div className="space-y-1.5">
              <label
                htmlFor="edit-preferencial"
                className="text-sm font-medium"
              >
                Fisioterapeuta Preferencial
              </label>
              <select
                id="edit-preferencial"
                value={editForm.funcionario_preferencial_id}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    funcionario_preferencial_id: e.target.value,
                  }))
                }
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Nenhum</option>
                {fisios.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.nome}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Quando definido, pode ser usado para filtros ou preferências de
                atribuição futuras para esta sala.
              </p>
            </div>

            {editErro && (
              <p className="text-sm text-destructive">{editErro}</p>
            )}
          </DialogContent>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditando(null)}
              disabled={editSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={editSubmitting}>
              {editSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A guardar…
                </>
              ) : (
                "Guardar alterações"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
