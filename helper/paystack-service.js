import Paystack from 'paystack-node';
import dotenv from 'dotenv';

dotenv.config();

const APIKEY = process.env.PAYSTACK_SECRET; // Ensure this is correct
const environment = process.env.PAYSTACK_ENV || 'test'; // default to 'test'

const paystack = new Paystack(APIKEY, environment); // Initialize with environment
export default paystack;
