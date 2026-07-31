/**
 * Modelo Notificacao — FisioCell
 *
 * Prompt 114 — Centro de Notificações In-App (O Sino).
 * F8/DT1 — Adaptado ao domínio Fisioterapia: tarefa_id → consulta_id,
 *          ref 'Tarefa' → 'Consulta', enum tipos tarefa_* → consulta_*.
 *
 * Representa uma notificação in-app dirigida a um utilizador específico.
 * Mostrada no sino do header (Diretor Clínico/Rececionista e Fisioterapeuta)
 * com badge de não-lidas.
 *
 * Campos:
 *   - utilizador_id: destinatário (ref Utilizador)
 *   - mensagem: texto da notificação
 *   - lida: boolean (default false)
 *   - data: timestamp (default agora)
 *   - tipo: categoria opcional ('consulta_marcada', 'consulta_reatribuida',
 *     'consulta_cancelada', 'aviso', etc.) para futura filtragem/ícones
 *   - url: URL para abrir ao clicar (ex.: '/gestor/consultas')
 *   - consulta_id: referência opcional à Consulta que originou a notificação
 *     (ex.: para o frontend abrir o detalhe da consulta ao clicar no sino)
 *
 * Índice em { utilizador_id, lida } para a query de contagem de não-lidas
 * ser rápida.
 */

const mongoose = require('mongoose');

const NotificacaoSchema = new mongoose.Schema(
  {
    utilizador_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utilizador',
      required: true,
      index: true,
    },
    empresa_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Empresa',
      default: null,
      index: true,
    },
    mensagem: {
      type: String,
      required: true,
      trim: true,
    },
    tipo: {
      type: String,
      enum: [
        'consulta_marcada',
        'consulta_reatribuida',
        'consulta_cancelada',
        'aviso',
        'sistema',
      ],
      default: 'sistema',
    },
    url: {
      type: String,
      default: '/gestor/consultas',
    },
    // DT1 (F8) — referência opcional à Consulta que originou a notificação
    // (ex.: para o frontend abrir o detalhe da consulta ao clicar no sino).
    // Anteriormente tarefa_id (ref 'Tarefa') — removido em F8 (Tarefa eliminada).
    consulta_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consulta',
      default: null,
      index: true,
    },
    lida: {
      type: Boolean,
      default: false,
      index: true,
    },
    data: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// Índice composto para a query frequente: "não-lidas de um utilizador".
NotificacaoSchema.index({ utilizador_id: 1, lida: 1, createdAt: -1 });

module.exports = mongoose.model('Notificacao', NotificacaoSchema);
