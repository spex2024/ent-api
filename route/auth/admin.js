import { Router } from 'express';
import {
    createAdmin,
    deleteAdmin,
    getAllAdmins, getAllAgencies, getAllOrders, getAllUsers, getAllVendors, getCurrentAdmin,
    resetPassword,
    signIn, signOut,
    updateAdmin
} from "../../controller/admin.js";
import authenticate from "../../middleware/protected.js";
import {getAllReturnedPacks} from "../../controller/returned-pack.js";
import {authAdmin} from "../../middleware/admin.js";


const router = Router();

// Public routes
router.post('/login', signIn);
router.post('/register', createAdmin);
router.get('/users',authAdmin,  getAllAdmins);
router.get('/user', authAdmin, getCurrentAdmin);
router.post('/logout',authAdmin, signOut);
router.post('/reset', resetPassword);
router.put('/update',authAdmin, updateAdmin);
router.delete('/update',authAdmin, deleteAdmin);
router.get('/users', getAllUsers);
router.get('/vendors',  getAllVendors);
router.get('/agency', getAllAgencies);
router.get('/orders', getAllOrders);
router.get('/return-packs', getAllReturnedPacks);
//
// router.get('/profile', );

export default router;
