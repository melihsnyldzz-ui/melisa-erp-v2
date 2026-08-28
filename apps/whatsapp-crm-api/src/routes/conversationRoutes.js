import { Router } from 'express';
import {
  patchConversationAssignment,
  patchConversationRead,
  patchConversationStage,
  patchConversationStatus,
  postConversationNote,
  postConversationProductInterest,
  postConversationQuote,
  postConversationTask,
  postConversationTag,
} from '../controllers/conversationController.js';
import { requireCrmAuth, requireCrmPermission } from '../middleware/auth.js';

export const conversationRoutes = Router();

conversationRoutes.patch(
  '/crm/conversations/:conversationId/assignment',
  requireCrmAuth,
  requireCrmPermission('crm.manage'),
  patchConversationAssignment,
);

conversationRoutes.patch(
  '/crm/conversations/:conversationId/read',
  requireCrmAuth,
  requireCrmPermission('crm.manage'),
  patchConversationRead,
);

conversationRoutes.patch(
  '/crm/conversations/:conversationId/status',
  requireCrmAuth,
  requireCrmPermission('crm.manage'),
  patchConversationStatus,
);

conversationRoutes.patch(
  '/crm/conversations/:conversationId/stage',
  requireCrmAuth,
  requireCrmPermission('crm.manage'),
  patchConversationStage,
);

conversationRoutes.post(
  '/crm/conversations/:conversationId/notes',
  requireCrmAuth,
  requireCrmPermission('crm.manage'),
  postConversationNote,
);

conversationRoutes.post(
  '/crm/conversations/:conversationId/tasks',
  requireCrmAuth,
  requireCrmPermission('crm.manage'),
  postConversationTask,
);

conversationRoutes.post(
  '/crm/conversations/:conversationId/product-interests',
  requireCrmAuth,
  requireCrmPermission('crm.manage'),
  postConversationProductInterest,
);

conversationRoutes.post(
  '/crm/conversations/:conversationId/quotes',
  requireCrmAuth,
  requireCrmPermission('crm.manage'),
  postConversationQuote,
);

conversationRoutes.post(
  '/crm/conversations/:conversationId/tags',
  requireCrmAuth,
  requireCrmPermission('crm.manage'),
  postConversationTag,
);
