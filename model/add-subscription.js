// models/Subscription.js
import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
    plan: {
        type: String,

    },
    price: {
        type: Number,

    },
    paymentType: {
        type: String,

    },
    staff: {
        type: Number,

    },
    features: { type: [String] },
}, { timestamps: true });

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
export default Subscription;
