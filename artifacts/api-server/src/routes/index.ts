import { Router, type IRouter } from "express";
import demoRouter from "./demo";
import billingRouter from "./billing";
import documentsRouter from "./documents";
import chatRouter from "./chat";
import multiChatRouter from "./multi-chat";
import briefRouter from "./brief";
import agentRouter from "./agent";
import skillsRouter from "./skills";
import trashRouter from "./trash";
import notesRouter from "./notes";
import { requireApprovedEmail } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(demoRouter);
router.use(billingRouter);

router.use(requireApprovedEmail);
router.use(documentsRouter);
router.use(multiChatRouter);
router.use(briefRouter);
router.use(agentRouter);
router.use(skillsRouter);
router.use(chatRouter);
router.use(notesRouter);
router.use(trashRouter);

export default router;
