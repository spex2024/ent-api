import express from 'express';
import {addSubscription, getAllSubscriptions} from "../../controller/subscription.js";


const router = express.Router();

// POST route for adding a subscription
router.post('/add', addSubscription);

// GET route for fetching all subscriptions
router.get('/plans', getAllSubscriptions);

export default router;