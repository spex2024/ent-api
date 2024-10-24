import express from "express";
import {checkPaymentPlan} from "../../controller/check-payment-plan.js";





const router = express.Router();

// POST route for adding a subscription
router.get('/check-installment',checkPaymentPlan);


export default router;