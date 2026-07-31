# FisioCell

**SaaS multi-tenant de gestão para Clínicas de Fisioterapia.**

O FisioCell é uma aplicação dividida em duas partes:

- **`backend/`** — API REST construída em **Node.js + Express**, com base de dados **MongoDB** (via Mongoose). Desenhada para o [Render](https://render.com).
- **`frontend/`** — Interface de utilizador em **Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui**, com três áreas: Super Admin (`/admin`), Diretor Clínico/Rececionista (`/gestor`) e Fisioterapeuta (`/staff`). Desenhada para a [Vercel](https://vercel.com), comunica com a API via proxy routes + CORS.

> 📌 Repositório: https://github.com/makigero-lab/FisioCell
> 🌿 Branch de desenvolvimento ativa: **`dev`**

---

## Funcionalidades principais

- **Consultas** — marcações com validação de 4 conflitos em tempo real (fisioterapeuta + sala + paciente + horário), nota clínica SOAP, cédula profissional obrigatória, imutabilidade RGPD (consultas concluídas não se apagam/editam).
- **Pacientes** — ficha completa (demográficos + clínicos + contacto de emergência) com consentimento RGPD estruturado e soft delete. Controlo de acesso por role (rececionista não vê notas clínicas).
- **Horários de Fisioterapeutas** — motor de disponibilidade em 3 camadas (ausência aprovada → folga fixa → horário de trabalho com exceções).
- **Protocolos Clínicos** — templates reutilizáveis com snapshot imutável aplicado à Consulta (a edição do template não afeta consultas passadas).
- **Documentos Clínicos** (F9) — anexos (receitas, relatórios, termos de consentimento, fotografias, exames) com storage local via multer + consentimento RGPD. Preparado para S3/Cloudinary.
- **Calendário Visual** — FullCalendar v6 com cores por fisioterapeuta, filtros e modal de detalhe.
- **RBAC com 4 roles** — `admin` (Super Admin cross-tenant), `diretor_clinico`, `fisioterapeuta`, `rececionista` — com middlewares composáveis (`isAdmin`, `isDiretorClinico`, `isClinico`, `isRececionista`).
- **5 Cron Jobs clínicos** — briefing diário (08h00), lembrete de consultas de amanhã (19h00), lembrete 2h antes (a cada 15min), cão de guarda (02h00), arquivista semanal (domingo 03h00 → `ConsultaArquivo` para retenção RGPD 10-20 anos).
- **Notificações** — push (Web Push API / VAPID) + in-app (sino com badge e polling 30s).
- **Impersonation** — Super Admin pode entrar como diretor clínico de qualquer empresa (com cookie de backup para "Voltar a Admin").
- **AI Summary** — resumo executivo do relatório de produtividade via Google Gemini (never-crash: placeholder se a IA falhar).
- **Auditoria & Soft Delete** — registo de ações administrativas + soft delete em Pacientes/Utilizadores/Documentos/Horários; Empresas têm Reciclagem (soft delete + restaurar).

---

## Estrutura do repositório

```
FisioCell/
├── backend/        # API REST (Node.js + Express + MongoDB)
│   ├── package.json
│   ├── server.js
│   ├── controllers/ (auth, gestor, admin, staff, consulta, paciente, horario,
│   │                 protocolo, documento, ausencia, relatorio, notificacao,
│   │                 superAdmin)
│   ├── models/ (Empresa, Utilizador, Paciente, Consulta, ConsultaArquivo,
│   │             HorarioFisioterapeuta, ModeloProtocolo, Documento, Ausencia,
│   │             Notificacao, Auditoria, WebhookLog, Propriedade [alias Sala])
│   ├── routes/ (auth, gestor, admin, staff, consulta, paciente, horario,
│   │             protocolo, documento, ausencia, relatorio)
│   ├── middleware/ (auth [JWT], requireRole [RBAC])
│   ├── utils/ (disponibilidade, notificar, push, auditoria, distancia, geocoding)
│   ├── jobs/ (briefingDiarioFisio, lembreteConsultasAmanha, lembrete2hConsulta,
│   │           caoGuardaConsultas, arquivistaConsultas)
│   ├── tests/ (integration.test.js, server.test.js)
│   ├── .env.example
│   └── .gitignore
├── frontend/       # Interface (Next.js 14 + TS + Tailwind + shadcn/ui)
│   ├── package.json
│   ├── src/app/        # Rotas: /, /login, /admin/*, /gestor/*, /staff/*
│   ├── src/components/ # ui (shadcn) + admin + gestor + staff + auth
│   └── src/lib/        # api (DTOs + helpers) + auth (cache) + utils
├── uploads/        # Storage local de documentos clínicos (multer, F9) — ignorado pelo git
├── docs/           # Documentação técnica
│   ├── BACKEND.md
│   ├── FRONTEND.md
│   └── ARQUITETURA.md
├── .github/workflows/ci.yml  # CI (lint + tsc + build no frontend; jest no backend)
└── README.md
```

---

## Backend

### Pré-requisitos
- Node.js **18 ou superior**
- Uma instância do **MongoDB** (local, MongoDB Atlas ou um add-on do Render)

### Instalação e execução local

```bash
cd backend
npm install
cp .env.example .env      # preenche MONGODB_URI, JWT_SECRET, VAPID_* no .env
npm run dev               # desenvolvimento (com reinício automático)
# ou
npm start                 # produção
```

A API arranca na porta definida em `PORT` (por defeito **5000**).

### Variáveis de ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `MONGODB_URI` | URI de ligação ao MongoDB | `mongodb://localhost:27017/fisiocell` |
| `PORT` | Porta onde a API escuta (no Render é injetada) | `5000` |
| `JWT_SECRET` | Segredo de assinatura dos JWT (obrigatório em produção) | `(valor aleatório longo)` |
| `JWT_EXPIRACAO` | Expiração do JWT (default `7d`) | `7d` |
| `FRONTEND_URL` | Origem permitida para CORS (URL do frontend) | `https://fisiocell.vercel.app` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Chaves VAPID para notificações push | `mailto:admin@fisiocell.com` |
| `GEMINI_API_KEY` | Chave do Google Gemini para o AI Summary (opcional) | `AIza...` |

### Endpoints disponíveis

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`  | `/` | Healthcheck. Devolve `{ "status": "API do FisioCell online e ligada à BD!" }` |
| `GET`  | `/api/health` | Estado da API + BD (MongoDB) + uptime. Devolve `503` se a BD estiver em baixo. |
| **Autenticação** (`/api/auth`) | | |
| `POST` | `/api/auth/login` | Login (público, com rate limiting). Body: `{ email, password }`. Devolve `{ token, utilizador }`. |
| `GET`  | `/api/auth/me` | Dados do utilizador autenticado. **Auth:** JWT. |
| `GET`  | `/api/auth/me/calendario` | Calendário pessoal (consultas + ausências). **Auth:** JWT. |
| `GET`  | `/api/auth/me/push-vapid-public-key` | Chave pública VAPID para subscrição push. **Auth:** JWT. |
| `POST` | `/api/auth/me/push-subscribe` | Guarda a subscrição push do browser. **Auth:** JWT. |
| `POST` | `/api/auth/me/push-unsubscribe` | Remove a subscrição push. **Auth:** JWT. |
| `POST` | `/api/auth/exit-impersonation` | Restaura a sessão de Super Admin após impersonação. |
| **Notificações in-app** (`/api/auth/me/notificacoes`) | | |
| `GET`  | `/api/auth/me/notificacoes` | Lista notificações (query `?lidas=false`). **Auth:** JWT. |
| `GET`  | `/api/auth/me/notificacoes/contagem` | Contagem de não-lidas (badge do sino). **Auth:** JWT. |
| `PATCH`| `/api/auth/me/notificacoes/marcar-lidas` | Marca todas como lidas. **Auth:** JWT. |
| `PATCH`| `/api/auth/me/notificacoes/:id/lida` | Marca uma como lida. **Auth:** JWT. |
| **Dashboard & Equipa** (`/api/gestor`) | | |
| `GET`  | `/api/gestor/setup` | Bootstrap do "Cliente Zero" (Empresa + Admin + Diretor + Fisio + Rececionista + Sala). Idempotente. **PÚBLICO.** |
| `GET`  | `/api/gestor/dashboard` | Estatísticas em tempo real (consultas hoje, carga por fisio, etc.). **Auth:** JWT + `isDiretorClinico`. |
| `GET`  | `/api/gestor/propriedades` | Lista as salas da clínica (alias `Propriedade`). **Auth:** JWT + `isDiretorClinico`. |
| `POST` | `/api/gestor/propriedades` | Cria sala (com geocoding da morada). **Auth:** JWT + `isDiretorClinico`. |
| `PUT`  | `/api/gestor/propriedades/:id` | Atualiza sala. **Auth:** JWT + `isDiretorClinico`. |
| `PATCH`| `/api/gestor/propriedades/:id/estado` | Ativa/desativa sala. **Auth:** JWT + `isDiretorClinico`. |
| `GET`  | `/api/gestor/equipa` | Lista utilizadores da clínica. **Auth:** JWT + `isDiretorClinico`. |
| `POST` | `/api/gestor/equipa` | Cria membro de equipa (bcrypt hash). **Auth:** JWT + `isDiretorClinico`. |
| `PUT`  | `/api/gestor/equipa/:id` | Atualiza utilizador. **Auth:** JWT + `isDiretorClinico`. |
| `PATCH`| `/api/gestor/equipa/:id/estado` | Alterna ativo/desativado. **Auth:** JWT + `isDiretorClinico`. |
| `DELETE`| `/api/gestor/equipa/:id` | Elimina utilizador (soft delete). **Auth:** JWT + `isDiretorClinico`. |
| `GET`  | `/api/gestor/auditoria` | Histórico de ações administrativas. **Auth:** JWT + `isDiretorClinico`. |
| `GET`/`PUT` | `/api/gestor/configuracoes` | Lê/atualiza configuração da clínica. **Auth:** JWT + `isDiretorClinico`. |
| **Pacientes** (`/api/gestor/pacientes`) | | |
| `GET`  | `/api/gestor/pacientes` | Lista pacientes. **Auth:** JWT + `podeVer` (4 roles). |
| `GET`  | `/api/gestor/pacientes/:id` | Detalhe (rececionista não vê dados clínicos sensíveis). **Auth:** JWT + `podeVer`. |
| `POST` | `/api/gestor/pacientes` | Cria paciente. **Auth:** JWT + `podeVer`. |
| `PUT`  | `/api/gestor/pacientes/:id` | Atualiza. **Auth:** JWT + `podeVer`. |
| `PATCH`| `/api/gestor/pacientes/:id/estado` | Ativa/desativa. **Auth:** JWT + `isRececionista`. |
| `DELETE`| `/api/gestor/pacientes/:id` | Soft delete. **Auth:** JWT + `isDiretorClinico`. |
| **Horários** (`/api/gestor/horarios`) | | |
| `GET`  | `/api/gestor/horarios` | Lista horários. **Auth:** JWT + `podeVer`. |
| `GET`  | `/api/gestor/horarios/disponibilidade` | Verifica disponibilidade (3 camadas). **Auth:** JWT + `podeVer`. |
| `POST` | `/api/gestor/horarios` | Cria horário (recorrente/exceção). **Auth:** JWT + `isDiretorClinico`. |
| `PUT`  | `/api/gestor/horarios/:id` | Atualiza. **Auth:** JWT + `isDiretorClinico`. |
| `DELETE`| `/api/gestor/horarios/:id` | Elimina. **Auth:** JWT + `isDiretorClinico`. |
| **Consultas** (`/api/gestor/consultas`) | | |
| `GET`  | `/api/gestor/consultas` | Lista consultas (filtros `?inicio=&fim=&fisioterapeuta_id=&sala_id=&paciente_id=&estado=`). **Auth:** JWT + `podeVer`. |
| `GET`  | `/api/gestor/consultas/validar` | Valida conflitos em tempo real (debounce 400ms no frontend). **Auth:** JWT + `podeVer`. |
| `GET`  | `/api/gestor/consultas/:id` | Detalhe. **Auth:** JWT + `podeVer`. |
| `POST` | `/api/gestor/consultas` | Cria consulta (valida 4 conflitos; soft block 409 ou 200 com `warning` se `forcar: true`; snapshot de protocolo se `protocolo_id`). **Auth:** JWT + `isRececionista`. |
| `PUT`  | `/api/gestor/consultas/:id` | Atualiza. **Auth:** JWT + `isRececionista`. |
| `PATCH`| `/api/gestor/consultas/:id/nota-clinica` | Atualiza nota SOAP (exige cédula válida; imutável após conclusão). **Auth:** JWT + `isClinico`. |
| `DELETE`| `/api/gestor/consultas/:id` | Elimina (bloqueada se concluída — RGPD). **Auth:** JWT + `isDiretorClinico`. |
| **Protocolos** (`/api/gestor/protocolos`) | | |
| `GET`  | `/api/gestor/protocolos` | Lista. **Auth:** JWT + `podeVer`. |
| `POST` | `/api/gestor/protocolos` | Cria. **Auth:** JWT + `isDiretorClinico`. |
| `PUT`  | `/api/gestor/protocolos/:id` | Atualiza. **Auth:** JWT + `isDiretorClinico`. |
| `DELETE`| `/api/gestor/protocolos/:id` | Apaga. **Auth:** JWT + `isDiretorClinico`. |
| **Documentos** (`/api/gestor/documentos`) | | |
| `GET`  | `/api/gestor/documentos` | Lista (filtros `?paciente_id=&consulta_id=&tipo=`). **Auth:** JWT + `podeVer`. |
| `GET`  | `/api/gestor/documentos/:id` | Detalhe. **Auth:** JWT + `podeVer`. |
| `GET`  | `/api/gestor/documentos/:id/download` | Download com nome original. **Auth:** JWT + `podeVer`. |
| `POST` | `/api/gestor/documentos/upload` | Upload multipart (PDF/imagens, 20MB). **Auth:** JWT + `podeVer`. |
| `DELETE`| `/api/gestor/documentos/:id` | Soft delete. **Auth:** JWT + `isDiretorClinico`. |
| **Ausências** (`/api/gestor/ausencias` + `/api/staff`) | | |
| `GET`  | `/api/gestor/ausencias` | Lista ausências (folgas/férias/doença). **Auth:** JWT + `isDiretorClinico`. |
| `POST` | `/api/gestor/ausencias` | Regista ausência. **Auth:** JWT + `isDiretorClinico`. |
| `DELETE`| `/api/gestor/ausencias/:id` | Elimina. **Auth:** JWT + `isDiretorClinico`. |
| `PATCH`| `/api/gestor/ausencias/:id/estado` | Aprovar/rejeitar pedido do staff. **Auth:** JWT + `isDiretorClinico`. |
| `GET`  | `/api/staff/ausencias` | Staff vê as suas ausências. **Auth:** JWT. |
| `POST` | `/api/staff/ausencias` | Staff pede ausência (sempre 'pendente'). **Auth:** JWT. |
| `POST` | `/api/staff/falta-hoje` | Staff reporta falta de emergência. **Auth:** JWT. |
| **Relatórios** (`/api/gestor/relatorios`) | | |
| `GET`  | `/api/gestor/relatorios/produtividade` | Relatório de produtividade. **Auth:** JWT. |
| `POST` | `/api/gestor/relatorios/ai-summary` | Resumo executivo via Gemini (never-crash). **Auth:** JWT. |
| **Super Admin** (`/api/admin`) | | |
| `GET`  | `/api/admin/empresas` | Lista todas as clínicas (cross-tenant). **Auth:** JWT + `isAdmin`. |
| `POST` | `/api/admin/empresas` | Cria clínica. **Auth:** JWT + `isAdmin`. |
| `DELETE`| `/api/admin/empresas/:id` | Soft delete (Reciclagem). **Auth:** JWT + `isAdmin`. |
| `PATCH`| `/api/admin/empresas/:id/restaurar` | Restaura da Reciclagem. **Auth:** JWT + `isAdmin`. |
| `PATCH`| `/api/admin/empresas/:id/toggle-status` | Suspende/ativa. **Auth:** JWT + `isAdmin`. |
| `POST` | `/api/admin/empresas/:id/hard-reset` | Hard reset scoped à clínica. **Auth:** JWT + `isAdmin`. |
| `GET`/`PUT` | `/api/admin/empresas/:id/config` | Lê/atualiza config da clínica. **Auth:** JWT + `isAdmin`. |
| `POST` | `/api/admin/empresas/:id/impersonar` | Impersonation de diretor clínico. **Auth:** JWT + `isAdmin`. |
| `GET`/`POST` | `/api/admin/empresas/:empresaId/utilizadores` | Lista/cria utilizadores de clínica terceira. **Auth:** JWT + `isAdmin`. |
| `PATCH`| `/api/admin/empresas/:empresaId/utilizadores/:utilizadorId/estado` | Alterna ativo/inativo. **Auth:** JWT + `isAdmin`. |

> Detalhes completos da lógica de marcação (validação de 4 conflitos, soft block, snapshot de protocolo) em [`docs/BACKEND.md`](docs/BACKEND.md).

### Deploy no Render
1. Cria um novo serviço **Web Service** apontando para a pasta `backend/`.
2. **Build Command:** `npm install`
3. **Start Command:** `npm start` (executa `node server.js`)
4. Adiciona as variáveis de ambiente `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `VAPID_*` (e opcionalmente `GEMINI_API_KEY`).
5. O Render injeta automaticamente a variável `PORT`; a aplicação respeita esse valor.

---

## Frontend

### Pré-requisitos
- Node.js **18 ou superior**

### Instalação e execução local

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### Rotas

| Rota | Área | Descrição |
|------|------|-----------|
| `/` | — | Landing (autenticados são redirecionados para o seu painel) |
| `/login` | — | Login (redirect admin→`/admin`, diretor/rececionista→`/gestor`, fisio→`/staff`) |
| `/admin` | Super Admin (role `admin`) | Gestão de clínicas (Ativas / Reciclagem) + impersonação |
| `/admin/empresas/[id]` | Super Admin | Gaveta de clínica (utilizadores + webhook-logs + hard-reset + impersonação) |
| `/gestor` | Diretor Clínico / Rececionista | Dashboard (consultas hoje, carga por fisio, etc.) |
| `/gestor/consultas` | Gestor | Lista + modal criar/editar com validação em tempo real + detalhe SOAP |
| `/gestor/calendario-consultas` | Gestor | FullCalendar v6 com cores por fisioterapeuta |
| `/gestor/pacientes` | Gestor | CRUD de pacientes |
| `/gestor/equipa` | Gestor | CRUD de utilizadores |
| `/gestor/equipa/horarios` | Gestor | Horários de fisioterapeutas |
| `/gestor/protocolos` | Gestor | CRUD de protocolos clínicos |
| `/gestor/documentos` | Gestor | Upload/download de documentos clínicos |
| `/gestor/propriedades` | Gestor | Gestão de salas (alias `Propriedade`) |
| `/gestor/ausencias` | Gestor | Folgas/férias/doença |
| `/gestor/relatorios` | Gestor | Relatório de produtividade + AI Summary (PDF via print) |
| `/gestor/notificacoes` | Gestor | Centro de notificações in-app |
| `/gestor/configuracoes` | Gestor | Configuração da clínica |
| `/staff` | Fisioterapeuta | Área do fisio (ausências, notificações) |

> **Proteção de rotas:** `/admin/**`, `/gestor/**` e `/staff/**` exigem token JWT válido (via `middleware.ts` + `RouteGuard`). `/` e `/login` redirecionam utilizadores autenticados para o seu painel.

### Variáveis de ambiente

| Variável | Descrição | Exemplo |
|-----------|-----------|---------|
| `NEXT_PUBLIC_API_URL` | URL base da API backend (Render). | `https://fisiocell-backend.onrender.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública VAPID (igual à do backend). | `(chave pública)` |

### Deploy na Vercel

**Definições obrigatórias (Project Settings):**

| Definição | Valor |
|-----------|-------|
| Root Directory | `frontend` |
| Framework Preset | **Next.js** |
| Build Command | `next build` *(auto)* |
| Output Directory | `.next` *(auto)* |
| Environment Variables | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |

O repositório inclui `frontend/vercel.json` com `"framework": "nextjs"` que força a deteção correta do framework.

---

## Documentação

- [📚 Documentação técnica do Backend](docs/BACKEND.md)
- [🎨 Documentação técnica do Frontend](docs/FRONTEND.md)
- [🏛️ Arquitetura do sistema](docs/ARQUITETURA.md)

---

## Notas de desenvolvimento
- Todo o desenvolvimento decorre na branch **`dev`**.
- Sempre que o código é alterado, a documentação (`README.md`, `docs/BACKEND.md`, `docs/FRONTEND.md`, `WORKLOG.md`) é atualizada em conformidade.
- Histórico de evolução técnica disponível no `WORKLOG.md` (migração F0–F9: Alojamento Local → Fisioterapia).

---

## Integração Contínua (CI)

O repositório inclui um workflow de GitHub Actions em [`.github/workflows/ci.yml`](.github/workflows/ci.yml) que corre em todos os `push` e `pull_request` nas branches `main` e `dev`:

| Job | Passos | Diretoria |
|-----|--------|-----------|
| **Frontend** | `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm run build` | `frontend/` |
| **Backend** | `npm ci` → `npm test` (Jest + Supertest) | `backend/` |

Ambos os jobs correm em `ubuntu-latest` com Node.js 18.

### Testes do Backend
- Framework: **Jest** + **Supertest** + **mongodb-memory-server**
- Localização: `backend/tests/`
- Para correr localmente: `cd backend && npm test`
- O `server.js` exporta a instância `app` e isola o `app.listen` em `if (require.main === module)`, permitindo testar as rotas sem iniciar o servidor HTTP nem ligar ao MongoDB.
