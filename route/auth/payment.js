import express from "express";
import {
    purchase,
    recordInstallmentPayment,
    recordOneTimePayment,
    verifyPayment
} from "../../controller/paystack.js";



const router = express.Router();

// POST route for adding a subscription
router.post('/initialize-payment', purchase);
router.get('/verify-payment/:reference', verifyPayment);
router.post('/record-payment', recordOneTimePayment);
router.post('/record-installment', recordInstallmentPayment);

export default router;