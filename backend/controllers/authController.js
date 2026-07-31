/**
 * Auth Controller — FisioFernandes
 *
 * Autenticação com JWT + bcrypt.
 *
 * Endpoint: POST /api/auth/login
 *   Recebe { email, password }, valida as credenciais e devolve um JWT
 *   com { id, role, empresa_id }.
 *
 * F8 — Limpeza: removido o import de Tarefa (eliminado). As funções
 * meuCalendario, minhasTarefas, minhaTarefaDetalhe e concluirMinhaTarefa
 * foram convertidas em stubs (o domínio passou a usar Consultas via
 * /api/gestor/consultas). O frontend deve usar os endpoints de Consulta.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Utilizador = require('../models/Utilizador');
const Ausencia = require('../models/Ausencia');
const { JWT_SECRET } = require('../middleware/auth');

// Tempo de expiração do token (pode ser overridden por env).
const TOKEN_EXPIRACAO = process.env.JWT_EXPIRACAO || '7d';

/**
 * POST /api/auth/login
 *
 * Body: { email, password }
 *
 * Resposta 200:
 *   {
 *     "token": "<jwt>",
 *     "utilizador": { "id", "nome", "email", "role", "empresa_id" }
 *   }
 *
 * Respostas de erro:
 *   400 — email/password em falta
 *   401 — credenciais inválidas / utilizador inativo / sem password definida
 *   500 — erro interno
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ erro: 'Email e password são obrigatórios.' });
    }

    // Procura o utilizador por email (único).
    const utilizador = await Utilizador.findOne({
      email: String(email).toLowerCase().trim(),
    }).select('+password_hash');

    // Mensagem genérica para não revelar se o email existe ou não.
    const MSG_INVALIDAS = 'Credenciais inválidas.';

    if (!utilizador) {
      return res.status(401).json({ erro: MSG_INVALIDAS });
    }

    if (!utilizador.ativo) {
      return res
        .status(401)
        .json({ erro: 'Utilizador inativo. Contacta o administrador.' });
    }

    if (!utilizador.password_hash) {
      // Utilizador migrado sem password (ex.: criado antes do auth).
      return res.status(401).json({
        erro: 'Ainda não tem password definida. Contacta o administrador.',
      });
    }

    // Verifica a password contra a hash bcrypt.
    const passwordOk = await bcrypt.compare(password, utilizador.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ erro: MSG_INVALIDAS });
    }

    // Prompt 116 — Bloqueia o login se a empresa estiver inativa (ativa: false).
    // O Super Admin (role 'admin') é exceção — pode sempre entrar para
    // reativar a empresa. O admin não tem empresa_id de operações.
    if (utilizador.role !== 'admin' && utilizador.empresa_id) {
      const Empresa = require('../models/Empresa');
      const empresa = await Empresa.findById(utilizador.empresa_id).select('ativa').lean();
      if (empresa && empresa.ativa === false) {
        return res.status(403).json({
          erro: 'A tua empresa está desativada. Contacta o suporte.',
        });
      }
    }

    // Gera o JWT com o payload essencial.
    const token = jwt.sign(
      {
        id: String(utilizador._id),
        role: utilizador.role,
        empresa_id: String(utilizador.empresa_id),
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRACAO }
    );

    return res.status(200).json({
      token,
      utilizador: {
        id: String(utilizador._id),
        nome: utilizador.nome,
        email: utilizador.email,
        role: utilizador.role,
        empresa_id: String(utilizador.empresa_id),
      },
    });
  } catch (err) {
    console.error('❌ login:', err.message);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
};

/**
 * GET /api/auth/me  (requer JWT)
 * Devolve os dados do utilizador autenticado (a partir do token).
 *
 * Resposta 200: { utilizador: { id, nome, email, role, empresa_id } }
 */
exports.me = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }
    const utilizador = await Utilizador.findById(req.user.id).select(
      '-password_hash'
    );
    if (!utilizador) {
      return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    }
    return res.status(200).json({
      utilizador: {
        id: String(utilizador._id),
        nome: utilizador.nome,
        email: utilizador.email,
        role: utilizador.role,
        empresa_id: String(utilizador.empresa_id),
      },
    });
  } catch (err) {
    console.error('❌ me:', err.message);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
};

/**
 * GET /api/auth/me/calendario (requer JWT)
 *
 * F8 — STUB. O calendário pessoal agora deve ser obtido via
 * /api/gestor/consultas (F4-F6) com filtro por fisioterapeuta_id.
 * Mantém-se o array de ausências para retrocompatibilidade do frontend.
 *
 * Resposta 200: { tarefas: [], ausencias: [...] }
 */
exports.meuCalendario = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }

    const utilizadorId = req.user.id;

    // Data de hoje em meia-noite UTC.
    const agora = new Date();
    const hoje = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
    );

    // Ausências do utilizador a partir de hoje.
    const ausencias = await Ausencia.find({
      utilizador_id: utilizadorId,
      data_fim: { $gte: hoje },
    })
      .sort({ data_inicio: 1 })
      .lean();

    // F8 — Tarefas removidas (Tarefa eliminado). Devolve array vazio para
    // retrocompatibilidade do frontend. O calendário de Consultas está
    // disponível em /api/gestor/consultas.
    return res.status(200).json({ tarefas: [], ausencias });
  } catch (err) {
    console.error('❌ meuCalendario:', err.message);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
};

/**
 * GET /api/auth/me/tarefas (requer JWT)
 *
 * F8 — STUB. Tarefa eliminado em F8. As consultas do fisioterapeuta devem
 * ser obtidas via /api/gestor/consultas?fisioterapeuta_id=... (F4).
 *
 * Resposta 200: { tarefas: [] }
 */
exports.minhasTarefas = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }
    // F8 — Tarefa eliminado. Devolve array vazio para retrocompatibilidade.
    return res.status(200).json({ tarefas: [] });
  } catch (err) {
    console.error('❌ minhasTarefas:', err.message);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
};

/**
 * GET /api/auth/me/tarefas/:id (requer JWT)
 *
 * F8 — STUB. Tarefa eliminado em F8. O detalhe de uma consulta está
 * disponível em /api/gestor/consultas/:id (F4).
 *
 * Resposta 410 Gone — endpoint desativado.
 */
exports.minhaTarefaDetalhe = async (req, res) => {
  return res.status(410).json({
    erro: 'Endpoint desativado (Tarefa eliminado em F8). Usa /api/gestor/consultas/:id para detalhe de consultas.',
  });
};

/**
 * PATCH /api/auth/me/tarefas/:id/concluir (requer JWT)
 *
 * F8 — STUB. Tarefa eliminado em F8. A conclusão de consultas é feita
 * via /api/gestor/consultas/:id/estado (F4) ou PATCH /nota-clinica (F4).
 *
 * Resposta 410 Gone — endpoint desativado.
 */
exports.concluirMinhaTarefa = async (req, res) => {
  return res.status(410).json({
    erro: 'Endpoint desativado (Tarefa eliminado em F8). Usa /api/gestor/consultas/:id/estado para alterar o estado da consulta.',
  });
};

/* ------------------------------------------------------------------ */
/* Notificações Push (Web Push API) — v1.27.0                          */
/* ------------------------------------------------------------------ */

/**
 * GET /api/auth/me/push-vapid-public-key
 *
 * Devolve a chave pública VAPID para o frontend pedir a subscrição
 * do browser (PushManager.subscribe({ applicationServerKey })).
 *
 * Resposta 200: { publicKey: string }
 * Resposta 503: Web Push não configurado (chaves VAPID em falta).
 */
exports.pushVapidPublicKey = async (req, res) => {
  try {
    const { isConfigured, getPublicKey } = require('../utils/push');
    if (!isConfigured()) {
      return res.status(503).json({
        erro: 'Notificações push não configuradas no servidor.',
      });
    }
    return res.status(200).json({ publicKey: getPublicKey() });
  } catch (err) {
    console.error('❌ pushVapidPublicKey:', err.message);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
};

/**
 * POST /api/auth/me/push-subscribe
 *
 * Guarda a subscrição push gerada pelo browser no utilizador logado.
 * O frontend chama isto depois de obter a subscrição via:
 *   const sub = await registration.pushManager.subscribe({...});
 *   fetch('/api/auth/me/push-subscribe', { method: 'POST', body: sub })
 *
 * Body: { subscription: PushSubscription }
 *   - objeto com { endpoint, keys: { p256dh, auth }, expirationTime? }
 *
 * Resposta 200: { mensagem: 'Subscrição guardada com sucesso.' }
 * Resposta 400: subscription em falta ou inválida
 * Resposta 503: Web Push não configurado
 */
exports.pushSubscribe = async (req, res) => {
  try {
    const { isConfigured } = require('../utils/push');
    if (!isConfigured()) {
      return res.status(503).json({
        erro: 'Notificações push não configuradas no servidor.',
      });
    }

    const { subscription } = req.body || {};

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        erro: 'Subscrição inválida: falta o objeto subscription com endpoint.',
      });
    }

    // Guarda a subscrição no utilizador logado.
    const utilizador = await Utilizador.findById(req.user.id);
    if (!utilizador) {
      return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    }

    utilizador.pushSubscription = subscription;
    await utilizador.save();

    return res.status(200).json({
      mensagem: 'Subscrição guardada com sucesso.',
    });
  } catch (err) {
    console.error('❌ pushSubscribe:', err.message);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
};

/**
 * POST /api/auth/me/push-unsubscribe
 *
 * Remove a subscrição push do utilizador (ex: user fez logout, ou o
 * browser reportou que a subscrição expirou).
 *
 * Resposta 200: { mensagem: 'Subscrição removida.' }
 */
exports.pushUnsubscribe = async (req, res) => {
  try {
    const utilizador = await Utilizador.findById(req.user.id);
    if (!utilizador) {
      return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    }

    utilizador.pushSubscription = null;
    await utilizador.save();

    return res.status(200).json({ mensagem: 'Subscrição removida.' });
  } catch (err) {
    console.error('❌ pushUnsubscribe:', err.message);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
};

/* ------------------------------------------------------------------ */
/* Single Sign-On (SSO) com o portal Autocell                          */
/* ------------------------------------------------------------------ */

/**
 * GET /api/auth/sso  (PÚBLICO — sem auth, validado por segredo partilhado)
 *
 * Single Sign-On: permite que o portal central "Autocell" inicie a sessão
 * de um administrador no FisioFernandes sem re-pedir credenciais.
 *
 * Funciona em DOIS modos, consoante quem chama:
 *
 *  • Modo REDIRECT (padrão, retrocompatível) — acesso direto pelo browser:
 *      GET /api/auth/sso?token=<jwt_externo>
 *    Valida o token, define cookies httpOnly no backend e faz res.redirect
 *    para FRONTEND_URL/admin (ou /login?erro=sso_falhou em caso de erro).
 *    ⚠️ Só funciona se backend e frontend partilharem o mesmo domínio
 *    registável (cookie cross-origin não é guardado pelo browser em
 *    domínios diferentes — Render + Vercel têm este problema).
 *
 *  • Modo JSON (para proxy do Next.js) — quando o pedido inclui
 *    ?json=true OU o header Accept: application/json:
 *      GET /api/auth/sso?token=<jwt_externo>&json=true
 *    Valida o token e devolve { sucesso: true, token: <jwt_interno> } SEM
 *    definir cookies nem redirecionar. O frontend (proxy route Next.js)
 *    recebe este JSON, define os cookies no DOMÍNIO do frontend (que o
 *    browser aceita) e faz o redirect final para /admin. Esta é a solução
 *    para deploys cross-domain (backend Render + frontend Vercel).
 *
 * Fluxo completo (modo JSON, recomendado para produção):
 *   1. Autocell redireciona o browser para:
 *        https://fisiofernandes.vercel.app/api/auth/sso?token=<jwt_externo>
 *   2. A proxy route do Next.js faz fetch ao backend:
 *        GET https://fisiofernandes-backend.../api/auth/sso?token=...&json=true
 *   3. O backend valida o JWT externo (AUTOCELL_SSO_SECRET), procura o
 *      admin por email, gera o JWT interno e devolve JSON.
 *   4. A proxy route do Next.js define os cookies httpOnly no domínio do
 *      frontend (fisiofernandes_token + fisiofernandes_admin_token) e
 *      redireciona para /admin.
 *
 * Segurança:
 *   - O JWT externo é validado com um segredo DIFERENTE do JWT_SECRET interno
 *     (AUTOCELL_SSO_SECRET). Isto isola a confiança: se o segredo SSO for
 *     comprometido, os tokens internos do FisioFernandes continuam seguros.
 *   - Apenas role 'admin' é aceite via SSO (princípio do minimizar).
 *   - No modo REDIRECT, sameSite='lax' é obrigatório para que o cookie viaje
 *     no redirect top-level cross-origin.
 *   - No modo JSON, a proxy route do Next.js é responsável pelos cookies
 *     (mesmo domínio do frontend → sem restrições cross-origin).
 *
 * Query params:
 *   - token: JWT externo assinado pelo Autocell com AUTOCELL_SSO_SECRET.
 *   - json: se "true" (ou header Accept: application/json), devolve JSON em
 *     vez de redirect+cookies.
 *
 * Resposta (modo REDIRECT): redirect 302 para FRONTEND_URL/admin (sucesso)
 *   ou FRONTEND_URL/login?erro=sso_falhou (falha).
 * Resposta (modo JSON): 200 { sucesso: true, token: <jwt_interno> } ou
 *   401 { sucesso: false, erro: "sso_falhou" }.
 */
exports.ssoLogin = async (req, res) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  const SSO_SECRET = process.env.AUTOCELL_SSO_SECRET;

  // Deteta o modo JSON: query ?json=true OU header Accept: application/json.
  // O proxy do Next.js usa este modo para poder definir os cookies no domínio
  // do frontend (não no do backend cross-origin).
  const acceptHeader = String(req.header('accept') || req.header('Accept') || '');
  const modoJson =
    String(req.query.json || '').toLowerCase() === 'true' ||
    acceptHeader.toLowerCase().includes('application/json');

  // Helpers de resposta consoante o modo.
  const responderErro = (motivo) => {
    console.warn(`⚠️  ssoLogin: ${motivo}`);
    if (modoJson) {
      return res.status(401).json({ sucesso: false, erro: 'sso_falhou' });
    }
    return res.redirect(302, `${FRONTEND_URL}/login?erro=sso_falhou`);
  };

  try {
    const token = req.query.token;

    // 1. Token em falta ou SSO desativado (segredo não configurado).
    if (!token || !SSO_SECRET) {
      return responderErro(
        !token
          ? 'token em falta na query string.'
          : 'AUTOCELL_SSO_SECRET não configurado.'
      );
    }

    // 2. Valida o JWT externo com o segredo partilhado do Autocell.
    let payload;
    try {
      payload = jwt.verify(token, SSO_SECRET);
    } catch (err) {
      return responderErro(`token SSO inválido/expirado: ${err.message}`);
    }

    // 3. Extrai o email do payload (suporta email ou sub — convenção JWT).
    const email = String(payload.email || payload.sub || '').toLowerCase().trim();
    if (!email) {
      return responderErro('payload SSO sem email/sub.');
    }

    // 4. Procura o utilizador — apenas role 'admin' pode entrar via SSO.
    const utilizador = await Utilizador.findOne({ email, role: 'admin' });

    if (!utilizador || !utilizador.ativo) {
      return responderErro(`admin não encontrado/inativo para <${email}>.`);
    }

    // 5. Gera o JWT interno do FisioFernandes (mesmo padrão do login normal).
    const tokenInterno = jwt.sign(
      {
        id: String(utilizador._id),
        role: utilizador.role,
        empresa_id: String(utilizador.empresa_id),
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRACAO }
    );

    console.log(`✅ ssoLogin: admin <${email}> autenticado via SSO (Autocell) [modo ${modoJson ? 'JSON' : 'REDIRECT'}].`);

    // 6a. Modo JSON: devolve o token para a proxy route do Next.js definir
    //     os cookies no domínio do frontend (solução cross-domain).
    if (modoJson) {
      return res.status(200).json({ sucesso: true, token: tokenInterno });
    }

    // 6b. Modo REDIRECT (padrão, retrocompatível): define os cookies httpOnly
    //     no backend e redireciona para o /admin. Só funciona se backend e
    //     frontend partilharem o mesmo domínio registável.
    const opcoesCookie = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 dias (em segundos)
    };

    // Cookie de sessão principal (lido pelo middleware do frontend).
    res.cookie('fisiofernandes_token', tokenInterno, opcoesCookie);
    // Cookie de marcação de admin (backup de impersonação: se este admin
    // impersonar um gestor depois, o "Voltar a Admin" restaura a partir daqui).
    res.cookie('fisiofernandes_admin_token', tokenInterno, opcoesCookie);

    // 7. Redireciona para o painel de administração do frontend.
    return res.redirect(302, `${FRONTEND_URL}/admin`);
  } catch (err) {
    console.error('❌ ssoLogin:', err.message);
    return responderErro(`erro interno: ${err.message}`);
  }
};
