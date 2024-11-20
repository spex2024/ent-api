import mongoose from 'mongoose';

const { Schema } = mongoose;

const vendorSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String },
    agencies: [{ type: Schema.Types.ObjectId, ref: 'Agency' }],
    location: { type: String, required: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    code: { type: String, required: true },
    owner: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    imageUrl: { type: String },
    imagePublicId: { type: String },
    meals: [{ type: Schema.Types.ObjectId, ref: 'Meal' }],
    orders: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
    completedOrders: { type: Number, default: 0 }, // Number of completed orders
    canceledOrders: { type: Number, default: 0 },  // Number of canceled orders
    totalSales: { type: Number, default: 0 },       // Total sales amount
    totalAmount: { type: Number, default: 0 },      // Total amount (may be different from totalSales depending on your logic)
}, { timestamps: true });
// Define the schema for Meal
const mealSchema = new Schema({
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    mealName: { type: String, required: true },
    description: { type: String, required: true },
    daysAvailable: [{
        type: String, required:true
    }],
    protein: [{
        type: String, required:true
    }],
    sauce: [{
        type: String, required:true
    }],
    extra: [{
        type: String, required:true
    }],

    price: { type: Number, required: true }, // Added price field
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, required: true },
}, { timestamps: true });


// Create Vendor model
const Vendor = mongoose.model('Vendor', vendorSchema);

// Create Meal model
const Meal = mongoose.model('Meal', mealSchema);

// Export Vendor and Meal models
export { Vendor, Meal };
