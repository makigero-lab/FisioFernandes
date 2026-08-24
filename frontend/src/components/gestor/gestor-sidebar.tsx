"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarRange,
  ClipboardList,
  BarChart3,
  CalendarOff,
  Menu,
  X,
  Sparkles,
  LogOut,
  Bell,
  ListChecks,
  UserRound,
  Clock,
  CalendarPlus,
  Stethoscope,
  FileText,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fazerLogout, lerUtilizador } from "@/lib/auth";
import type { Role } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { useEffect } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Roles que podem ver este item. Se undefined, todos os roles do /gestor
   * (diretor_clinico, rececionista, admin) veem o item.
   * Se definido, só os roles listados veem.
   */
  roles?: Role[];
}

/**
 * Barra lateral do Painel do Gestor de Operações.
 *
 * Prompt 115 — Separação ABSOLUTA: este componente NÃO importa nem renderiza
 * NADA de admin. Antes, o `gestor/layout.tsx` usava `AdminSidebar` (partilhado)
 * com `mode="gestor"` — agora há um componente dedicado e isolado.
 *
 * Rebranding — O item "Configurações" só faz sentido para o Super Admin
 * (role === 'admin'), que gere integrações/keys ao nível da empresa. Os
 * utilizadores da clínica (diretor_clinico, rececionista) não o veem — as
 * configurações operacionais estão no /admin (gestão de empresas).
 */
const gestorNavItems: NavItem[] = [
  { label: "Dashboard", href: "/gestor", icon: LayoutDashboard },
  { label: "Agenda Consultas", href: "/gestor/calendario-consultas", icon: CalendarRange },
  { label: "Consultas", href: "/gestor/consultas", icon: CalendarPlus },
  { label: "Salas", href: "/gestor/propriedades", icon: Building2 },
  { label: "Pacientes", href: "/gestor/pacientes", icon: UserRound },
  { label: "Equipa", href: "/gestor/equipa", icon: Users },
  { label: "Horários", href: "/gestor/equipa/horarios", icon: Clock },
  { label: "Protocolos", href: "/gestor/protocolos", icon: Stethoscope },
  { label: "Documentos", href: "/gestor/documentos", icon: FileText },
  { label: "Ausências / Férias", href: "/gestor/ausencias", icon: CalendarOff },
  { label: "Relatórios", href: "/gestor/relatorios", icon: BarChart3 },
  { label: "Notificações", href: "/gestor/notificacoes", icon: Bell },
  // Rebranding — Configurações só visível para Super Admin (role admin).
  { label: "Configurações", href: "/gestor/configuracoes", icon: ListChecks, roles: ["admin"] },
];

export function GestorSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Rebranding — Lê o role do utilizador autenticado para filtrar items do
  // menu por permissão (ex.: "Configurações" só para admin).
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    let cancelado = false;
    lerUtilizador().then((u) => {
      if (!cancelado) setRole(u?.role ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Filtra items por role. Se o item não declara `roles`, é visível para todos.
  const itensVisiveis = gestorNavItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const basePath = "/gestor";

  const isActive = (href: string) =>
    href === basePath ? pathname === href : pathname.startsWith(href);

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {itensVisiveis.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const Brand = () => (
    <div className="flex h-16 items-center gap-2 border-b px-6">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold">FisioFernandes</span>
        <span className="text-[11px] text-muted-foreground">Gestor</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Cabeçalho mobile com sino de notificações */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="flex-1 text-sm font-semibold">FisioFernandes — Gestor</span>
        <NotificationBell />
      </header>

      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:flex lg:flex-col">
        <Brand />
        <NavLinks />
        <div className="mt-auto space-y-2 border-t p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Notificações</span>
            <NotificationBell />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm text-muted-foreground hover:text-destructive"
            onClick={() => fazerLogout()}
          >
            <LogOut className="h-4 w-4" />
            Terminar Sessão
          </Button>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} FisioFernandes
          </p>
        </div>
      </aside>

      {/* Sidebar — mobile (overlay) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-card shadow-xl">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold">FisioFernandes</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <NavLinks />
          </div>
        </div>
      )}
    </>
  );
}
