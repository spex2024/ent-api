import express from "express";
import {checkPaymentPlan} from "../../controller/check-payment-plan.js";
import {checkInstallment} from "../../helper/update-status.js";





const router = express.Router();

// POST route for adding a subscription
router.get('/check-installment',checkInstallment);


export default router;