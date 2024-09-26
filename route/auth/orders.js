import { Router } from 'express';
import {cancelOrder, completeOrder, placeOrder} from "../../controller/order.js";
import authenticate from "../../middleware/protected.js";
import {getAllOrders} from "../../controller/admin.js";
import {authAdmin} from "../../middleware/admin.js";

// Adjust the path as necessary

const router = Router();

// Public routes
router.post('/order', placeOrder);
router.post('/complete', completeOrder);
router.post('/cancel',authenticate, cancelOrder);
router.get('/orders',authAdmin, getAllOrders);
// router.post('/register', signUp);
// router.get('/verify/:token', verifyEmail);
// router.post('/resend', resendVerificationEmail);
//
// router.get('/profile', );

export default router;
