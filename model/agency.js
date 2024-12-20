import mongoose from 'mongoose';

const { Schema } = mongoose;

const AgencySchema = new Schema(
    {
            company: { type: String, required: true },
            branch: { type: String, required: true },
            email: { type: String, required: true, unique: true },
            phone: { type: String, required: true },
            location: { type: String , required: true },
            code: { type: String , required: true },
            password: { type: String, required: true },
            initials:{type:String,required:true},
            packs: { type: Number, default: 0 },
            activePack: { type: Number, default: 0 },
            availablePacks: { type: Number, default: 0 },
            issuedPack: { type: Number, default: 0 },
            returnedPack: { type: Number, default: 0 },
            points: { type: Number, default: 0 },
            gramPoints: { type: Number, default: 0 },
            moneyBalance: { type: Number, default: 0 },
            emissionSaved: { type: Number, default: 0 },
            token:{type:String},
            subscription:{type: Schema.Types.ObjectId, ref: 'Subscription'},
            payment:[{type: Schema.Types.ObjectId, ref: 'Payment'}],
            imageUrl: { type: String,  },
            imagePublicId: { type: String,  },
            isVerified: { type: Boolean, default: false }, // Assuming isVerified is a boolean
            isActive: { type: Boolean, default: false }, // Assuming isVerified is a boolean
            users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
            vendors: [{ type: Schema.Types.ObjectId, ref: 'Vendor' }],
            remainderNotificationSent: { type: Boolean, default: false },
            graceNotificationSent: { type: Boolean, default: false },
            dueNotificationSent: { type: Boolean, default: false },
            overDueNotificationSent: { type: Boolean, default: false },
            completeNotificationSent: { type: Boolean, default: false },

    },
    { timestamps: true }
);



const Agency = mongoose.model('Agency', AgencySchema);

export default Agency;
