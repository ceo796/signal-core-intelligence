import { Router, type IRouter } from "express";
import healthRouter from "./health";
import demoRouter from "./demo";
import documentsRouter from "./documents";
import chatRouter from "./chat";
import multiChatRouter from "./multi-chat";
import briefRouter from "./brief";
import agentRouter from "./agent";
import trashRouter from "./trash";
import { requireApprovedEmail } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Health check and public landing-page demo content are always public
router.use(healthRouter);
router.use(demoRouter);

// All other routes require approved-email auth
router.use(requireApprovedEmail);
router.use(documentsRouter);
router.use(multiChatRouter);
router.use(briefRouter);
router.use(agentRouter);
router.use(chatRouter);
router.use(trashRouter);

export default router;
