

import mongoose from 'mongoose';

const { Schema } = mongoose;


const orderSchema = new Schema({
    orderId: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    mealId: { type: Schema.Types.ObjectId, ref: 'Meal', required: true },
    mealName: { type: String, required: true },
    price: { type: Number, required: true },
    selectedDays: {
            type: [String],
            required: true
        }, // Array of selected days for the meal
     options:{  type: Object,
         required: true},
    imageUrl: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    status: { type: String, required: true, default: 'pending' }, // e.g., Pending, Completed, Canceled
}, { timestamps: true });

// Create Order model
const Order = mongoose.model('Order', orderSchema);

export default Order;
