import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import chatRouter from "./chat";
import multiChatRouter from "./multi-chat";
import briefRouter from "./brief";
import { requireApprovedEmail } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Health check is always public
router.use(healthRouter);

// All other routes require approved-email auth
router.use(requireApprovedEmail);
router.use(documentsRouter);
router.use(multiChatRouter);
router.use(briefRouter);
router.use(chatRouter);

export default router;
