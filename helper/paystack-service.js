// paystackService.js
import Paystack from 'paystack-node';
import dotenv from 'dotenv';

dotenv.config();

const APIKEY = process.env.PAYSTACK_SECRET; // Load from environment variables
const paystack = new Paystack(APIKEY);

export default paystack;
