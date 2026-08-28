import {
  addConversationNote,
  addConversationProductInterest,
  addConversationTask,
  addConversationTag,
  assignConversation,
  createConversationQuote,
  markConversationRead,
  updateConversationStage,
  updateConversationStatus,
} from '../repositories/crmRepository.js';
import { resolveActivePersonnelUser } from '../services/erpPersonnelService.js';
import { env } from '../config/env.js';
import { assignChatwootConversation } from '../services/chatwootConversationService.js';
import {
  addChatwootConversationNote,
  addChatwootConversationTag,
  addChatwootConversationTask,
  addChatwootProductInterest,
  createChatwootConversationQuote,
  markChatwootConversationRead,
  updateChatwootConversationStage,
  updateChatwootConversationStatus,
} from '../services/chatwootWorkflowService.js';
import { ok } from '../utils/response.js';

export async function patchConversationAssignment(req, res, next) {
  try {
    const requestedUserId = req.body?.assigneeUserId;
    const assignee = requestedUserId && String(requestedUserId) !== String(req.user?.id)
      ? await resolveActivePersonnelUser({ userId: requestedUserId, accessToken: req.erpAccessToken })
      : req.user;
    const result = env.chatwoot.inboxReadEnabled
      ? await assignChatwootConversation({
        conversationId: req.params.conversationId,
        assignee,
      })
      : await assignConversation({
        conversationId: req.params.conversationId,
        actor: req.user,
        assignee,
      });

    return ok(res, result, {
      source: env.chatwoot.inboxReadEnabled ? 'chatwoot-assignment' : 'whatsapp-crm-assignment',
      persistent: true,
    });
  } catch (error) {
    return next(error);
  }
}

export async function patchConversationRead(req, res, next) {
  try {
    const result = env.chatwoot.inboxReadEnabled
      ? await markChatwootConversationRead({ conversationId: req.params.conversationId })
      : await markConversationRead({ conversationId: req.params.conversationId, actor: req.user });
    return ok(res, result, { source: env.chatwoot.inboxReadEnabled ? 'chatwoot-read-state' : 'whatsapp-crm-read-state', persistent: true });
  } catch (error) {
    return next(error);
  }
}

export async function patchConversationStatus(req, res, next) {
  try {
    const action = env.chatwoot.inboxReadEnabled ? updateChatwootConversationStatus : updateConversationStatus;
    return ok(res, await action({ conversationId: req.params.conversationId, status: req.body?.status, actor: req.user }), {
      source: env.chatwoot.inboxReadEnabled ? 'chatwoot-status' : 'whatsapp-crm-status', persistent: true,
    });
  } catch (error) {
    return next(error);
  }
}

export async function postConversationTask(req, res, next) {
  try {
    const action = env.chatwoot.inboxReadEnabled ? addChatwootConversationTask : addConversationTask;
    const result = await action({
      conversationId: req.params.conversationId,
      title: req.body?.title,
      dueAt: req.body?.dueAt,
      actor: req.user,
    });
    return ok(res, result, { source: 'whatsapp-crm-task', persistent: true });
  } catch (error) {
    return next(error);
  }
}

export async function postConversationProductInterest(req, res, next) {
  try {
    const action = env.chatwoot.inboxReadEnabled ? addChatwootProductInterest : addConversationProductInterest;
    const result = await action({
      conversationId: req.params.conversationId,
      product: req.body?.product,
      actor: req.user,
    });
    return ok(res, result, { source: 'whatsapp-crm-product-interest', persistent: true });
  } catch (error) {
    return next(error);
  }
}

export async function postConversationQuote(req, res, next) {
  try {
    const action = env.chatwoot.inboxReadEnabled ? createChatwootConversationQuote : createConversationQuote;
    const result = await action({
      conversationId: req.params.conversationId,
      contact: req.body?.contact || req.body?.customer,
      lines: req.body?.lines,
      actor: req.user,
    });
    return ok(res, result, { source: 'whatsapp-crm-quote', persistent: true, erpOrderWritten: false });
  } catch (error) {
    return next(error);
  }
}

export async function patchConversationStage(req, res, next) {
  try {
    const action = env.chatwoot.inboxReadEnabled ? updateChatwootConversationStage : updateConversationStage;
    const result = await action({
      conversationId: req.params.conversationId,
      stage: req.body?.stage,
      actor: req.user,
    });

    return ok(res, result, {
      source: 'whatsapp-crm-stage',
      persistent: true,
    });
  } catch (error) {
    return next(error);
  }
}

export async function postConversationNote(req, res, next) {
  try {
    const action = env.chatwoot.inboxReadEnabled ? addChatwootConversationNote : addConversationNote;
    const result = await action({
      conversationId: req.params.conversationId,
      note: req.body?.note,
      actor: req.user,
    });

    return ok(res, result, {
      source: 'whatsapp-crm-note',
      persistent: true,
    });
  } catch (error) {
    return next(error);
  }
}

export async function postConversationTag(req, res, next) {
  try {
    const action = env.chatwoot.inboxReadEnabled ? addChatwootConversationTag : addConversationTag;
    const result = await action({
      conversationId: req.params.conversationId,
      tag: req.body?.tag,
      actor: req.user,
    });

    return ok(res, result, {
      source: 'whatsapp-crm-tag',
      persistent: true,
    });
  } catch (error) {
    return next(error);
  }
}
