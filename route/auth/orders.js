import { Router } from 'express';
import {cancelOrder, completeOrder, deleteOrder, getOrdersByUserId, placeOrder} from "../../controller/order.js";
import authenticate from "../../middleware/protected.js";
import {getAllOrders} from "../../controller/admin.js";
import {authAdmin} from "../../middleware/admin.js";
import authUser from "../../middleware/user.js";

// Adjust the path as necessary

const router = Router();

// Public routes
router.post('/order', authUser, placeOrder);
router.post('/complete',authAdmin, completeOrder);
router.post('/cancel',authUser, cancelOrder);
router.get('/user',authUser, getOrdersByUserId);
router.get('/orders',authAdmin, getAllOrders);
router.delete('/:id', deleteOrder);
// router.post('/register', signUp);
// router.get('/verify/:token', verifyEmail);
// router.post('/resend', resendVerificationEmail);
//
// router.get('/profile', );

export default router;
