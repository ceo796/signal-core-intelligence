import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import chatRouter from "./chat";
import multiChatRouter from "./multi-chat";
import briefRouter from "./brief";
import stripeRouter from "./stripe";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(documentsRouter);
router.use(multiChatRouter);
router.use(briefRouter);
router.use(chatRouter);
router.use(aiRouter);
router.use(stripeRouter);

export default router;
