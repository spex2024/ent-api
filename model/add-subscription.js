import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
    plan: {
        type: String,
        required: true,
        enum: ['Gold', 'Silver', 'Bronze'], // Define the plans here
    },
    price: {
        type: Number,
        required: true,
    },
    paymentType: {
        type: String,
        required: true,
        enum: ['one-time', 'installment', 'custom'], // Define payment types
    },
    staff: {
        type: Number, // Number of staff included in the subscription
    },
    features: {
        type: [String], // Array of features included in the subscription
    },
    installmentDuration: {
        type: Number,
        enum: [3, 6], // Allow only 3 or 6 months
    },
    monthlyPayment: {
        type: Number,
    },
    customDescription: {
        type: String, // Description for custom subscription payments
    },
}, { timestamps: true });

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
export default Subscription;
