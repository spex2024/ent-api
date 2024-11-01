import paystack from "../helper/paystack-service.js";
import generateInvoiceNumber from "../helper/order-number.js";
import PaymentModel from "../model/payment.js";
import Agency from "../model/agency.js";
import Subscription from "../model/add-subscription.js";

// Helper function for updating agency subscription
const updateAgencySubscription = async (agency, newSubscription) => {
    const numberOfStaff = newSubscription.staff || 0;
    const numberOfPacks = numberOfStaff * 2;
    const numberOfUsers = agency.users ? agency.users.length : 0;
    const userPacks = numberOfUsers * 2;
    const availablePacks = numberOfPacks - userPacks;

    agency.subscription = newSubscription._id;
    agency.issuedPack = userPacks;
    agency.packs = availablePacks;
    agency.isActive = true;

    return agency.save();
};

export const purchase = async (req, res) => {
    const { email, amount, plan } = req.body;

    try {
        // Fetch the agency details (assuming you have a way to retrieve the agency by email)
        const agency = await Agency.findOne({ email });

        // Check if the agency already has a completed one-time or installment subscription for the same plan
        if (agency && agency.subscription) {
            const { subscription } = agency;

            if (subscription.plan === plan) {
                if (subscription.paymentType === "one-time") {
                    return res.status(400).json({ message: "You are already subscribed to this one-time plan." });
                } else if (subscription.paymentType === "installment" && agency.isActive && agency.s) {
                    return res.status(400).json({ message: "You have already completed this installment plan." });
                }
            }
        }

        // Initialize transaction with Paystack if no existing completed subscription is found
        const response = await paystack.initializeTransaction({
            email,
            amount: amount * 100, // Convert to kobo
            callback_url: req.body.callback_url,
        });

        res.status(200).json(response.body);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const verifyPayment = async (req, res) => {
    const { reference } = req.params;

    try {
        const response = await paystack.verifyTransaction({ reference });
        res.status(200).json(response.body);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};




export const recordOneTimePayment = async (req, res) => {
    const { email, plan, amount, reference } = req.body;

    try {
        // Generate an invoice number
        const orderNumber = await generateInvoiceNumber();

        // Find the agency by email
        const agency = await Agency.findOne({ email }).populate('subscription');
        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        // Find the subscription plan by name
        const subscription = await Subscription.findOne({ plan });
        if (!subscription) {
            return res.status(404).json({ message: 'Subscription plan not found' });
        }

        // Record the one-time payment
        const newPayment = new PaymentModel({
            email,
            plan,
            amount,
            reference,
            orderNumber,
            status: 'complete',
            paymentType: 'one-time',
        });

        await newPayment.save();
        agency.payment.push(newPayment._id);
        await agency.save(); // Save the updated agency document
        // Update the agency's subscription after the first installment
        if (!agency.subscription || agency.subscription.plan !== subscription.plan || agency.isActive === false) {
            await updateAgencySubscription(agency, subscription);
        }

        res.status(200).json({
            message: 'One-time payment recorded successfully',
            orderNumber,
            agency,
        });
    } catch (error) {
        console.error('Error recording one-time payment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


export const recordInstallmentPayment = async (req, res) => {
    const { email, plan, amount, reference, installmentDuration } = req.body;

    try {
        // Find the subscription plan
        const subscription = await Subscription.findOne({ monthlyPayment: amount });
        if (!subscription) {
            return res.status(404).json({ message: 'Subscription plan not found' });
        }

        const orderNumber = await generateInvoiceNumber();

        // Find the agency by email
        const agency = await Agency.findOne({ email }).populate('subscription').populate('payment');
        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        // Calculate total amount paid so far from previous payments
        const totalPaid = agency.payment.reduce((accum, payment) => {
            if (payment.plan === plan && payment.paymentType === 'installment') {
                return accum + payment.amount; // Summing amountPaid for relevant installment payments
            }
            return accum;
        }, 0);
         console.log(totalPaid);
        const totalAmount = subscription.price; // Total amount for the subscription plan
        const nextDueDate = new Date(recentPayment.createdAt.getTime() + 24 * 60 * 60 * 1000);


        // Calculate new total paid including the current installment
        const newTotalPaid = totalPaid + amount;
        const balance = newTotalPaid - totalAmount; // Calculate remaining balance
        console.log(newTotalPaid)
        // Create a new payment record
        const newPayment = new PaymentModel({
            email,
            plan,
            amount, // Current payment amount
            reference,
            orderNumber,
            totalAmount, // Total amount due
            amountPaid: newTotalPaid, // Include previous payments in amountPaid
            balance: balance, // Remaining balance
            installmentDuration,
            nextDueDate,
            status: newTotalPaid >= totalAmount ? 'completed' : 'partially_paid',
            installmentPayments: newTotalPaid >= totalAmount ? 'complete' : 'in-progress',
            paymentType: 'installment',

        });

        await newPayment.save(); // Save the new payment record
            agency.remainderNotificationSent = false
            agency.graceNotificationSent = false
            agency. dueNotificationSent = false
            agency.overDueNotificationSent =false
            agency.completeNotificationSent =false
        // Add the new payment to the agency's payment array
        agency.payment.push(newPayment._id);
        await agency.save(); // Save the updated agency document

        // Update the agency's subscription after the installment payment
        if (!agency.subscription || agency.subscription.plan !== subscription.plan || agency.isActive === false) {
            await updateAgencySubscription(agency, subscription);
        }

        res.status(200).json({
            message: 'Installment payment recorded successfully',
            orderNumber,
            balance: newPayment.balance, // Reflecting the current balance (could be negative for overpayment)
            nextDueDate: newPayment.nextDueDate,
        });
    } catch (error) {
        console.error('Error recording installment payment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

