import { Router } from 'express';
import {
    deleteUser,
    getAllUsers, getCurrentUser, getVendor, requestPasswordReset, resendVerificationEmail, resetPassword,
    signIn, signOut, signUp, updateUserInfo, verifyEmail
} from "../../controller/user.js";

import {getReturnedPacks, handlePackRequest, submitPackRequest} from "../../controller/returned-pack.js";
import {getAllVendors} from "../../controller/vendor.js";
import authUser from "../../middleware/user.js";
 // Adjust the path as necessary

const router = Router();

// Public routes
router.post('/login', signIn);
router.post('/register', signUp);
router.get('/verify/:token', verifyEmail);
router.post('/resend', resendVerificationEmail);
router.get('/employees',  getAllUsers);
router.get('/employee', authUser, getCurrentUser);
router.get('/vendor', authUser, getVendor);
router.get('/vendors', authUser, getAllVendors);
router.post('/logout', signOut);
router.post('/request', requestPasswordReset);
router.post('/reset', resetPassword);
router.post('/return-pack',authUser, submitPackRequest);
router.get('/return-pack',authUser, getReturnedPacks);
router.post('/approve', handlePackRequest);
router.delete('/employee/:userId', deleteUser);
router.put('/employee/:userId', updateUserInfo);
//
// router.get('/profile', );

export default router;
