import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    plan: {
        type: String,
        required: true,
        enum: ['Gold ', 'Silver ', 'Bronze'], // You can add more plans here if necessary
    },
    amount: {
        type: Number,
        required: true,
    },
    orderNumber: {
        type: String,
        required: true,
    },
    reference: {
        type: String,
        required: true,
        unique: true, // Ensure each transaction has a unique reference
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed'], // Tracks the status of the payment
        default: 'pending',
    },
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

const PaymentModel = mongoose.model('Payment', PaymentSchema);

export default PaymentModel;
