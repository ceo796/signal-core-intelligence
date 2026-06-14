import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import chatRouter from "./chat";
import multiChatRouter from "./multi-chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(documentsRouter);
router.use(multiChatRouter);
router.use(chatRouter);

export default router;
