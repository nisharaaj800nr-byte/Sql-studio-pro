import { Router, type IRouter } from "express";
import healthRouter from "./health";
import connectionsRouter from "./connections";
import queriesRouter from "./queries";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/connections", connectionsRouter);
router.use("/queries", queriesRouter);
router.use("/ai", aiRouter);

export default router;
