const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define the Cashout schema
const cashoutSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User', // Reference to the User model
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        transactionId: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

// Create and export the Cashout model
const Cashout = mongoose.model('Cashout', cashoutSchema);

module.exports = Cashout;
