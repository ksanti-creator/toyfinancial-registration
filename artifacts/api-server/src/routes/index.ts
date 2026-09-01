import { Router, type IRouter } from "express";
import healthRouter from "./health";
import toyfinancialRouter from "./toyfinancial";

const router: IRouter = Router();

router.use(healthRouter);
router.use(toyfinancialRouter);

export default router;
