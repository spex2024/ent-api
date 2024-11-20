
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'
import userRoute from'./route/auth/route.js'
import agencyRoute from './route/auth/agency.js'
import vendorRoute from './route/auth/vendor.js'
import orderRoute from './route/auth/orders.js'
import adminRoute from "./route/auth/admin.js";
import subscriptionRoutes from './route/auth/subscription.js';
import subscriptionPayment from './route/auth/payment.js'
import cookieParser from "cookie-parser";
import {v2 as cloudinary} from "cloudinary";
import mongoose from "mongoose";
import checkAgencySubscriptions, {checkInstallment} from "./helper/check-installment.js";
import checkPaymentPlan from "./route/auth/cron.js";


dotenv.config();

const app = express();


// Middleware
app.use(express.json());
app.use(cookieParser())
app.use(cors({
    origin: ['https://admin.spexafrica.app','https://admin.spexafrica.site', 'https://user.spexafrica.app', 'https://user.spexafrica.site', 'https://vendor.spexafrica.app','https://vendor.spexafrica.site', 'https://enterprise.spexafrica.app',  'https://enterprise.spexafrica.site', 'http://localhost:3000', 'http://localhost:3001','http://localhost:3002'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));




cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});





app.use('/api/user' , userRoute)
app.use('/api/enterprise' , agencyRoute)
app.use('/api/vendor' , vendorRoute)
app.use('/api/orders' ,orderRoute )
app.use('/api/admin' ,adminRoute)
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/paystack', subscriptionPayment );
app.use('/api/payment-plan', checkPaymentPlan );

app.get('/', (req, res) => {
    res.send('Hello World')
})

checkInstallment()


mongoose.connect(process.env.MONGODB_URI)
    .then(() => app.listen(process.env.PORT, () => {
        console.log(`Server connected to the database and running on port ${process.env.PORT}`);
    }))
    .catch((err) => console.log(`Database connection error: ${err.message}`));

// Add this to catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});




