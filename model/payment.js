import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
    email: { type: String, required: true },
    plan: { type: String, required: true },
    amount: { type: Number, required: true },
    reference: { type: String, required: true },
    orderNumber: { type: String, required: true },
    status: { type: String, default: 'pending' }, // pending, completed, partially_paid
    paymentType: { type: String, required: true }, // 'one-time' or 'installment'
    totalAmount: { type: Number }, // For installment payments
    amountPaid: { type: Number, default: 0 }, // Amount paid so far (installment)
    balance: { type: Number, default: 0 }, // Remaining balance (installment)
    installmentDuration: { type: Number }, // Duration for installments in months
    nextDueDate: { type: Date }, // When the next installment is due
    installmentPayments: [{
        amount: { type: Number },
        date: { type: Date },
        status: { type: String, default: 'pending' }, // paid, pending
    }],
    createdAt: { type: Date, default: Date.now },
});


const PaymentModel = mongoose.model('Payment', PaymentSchema);

export default PaymentModel;
