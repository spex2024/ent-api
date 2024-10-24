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

export const purchase =  async (req, res) => {
    const { email, amount } = req.body;

    try {
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
        if (response.body.status === "success") {
            res.status(200).json(response.body);
        } else {
            res.status(400).json({ error: error.message });
        }
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
            status: 'completed',
            paymentType: 'one-time',
        });

        await newPayment.save();
        await updateAgencySubscription(agency, subscription);

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
        const subscription = await Subscription.findOne({ plan });
        if (!subscription) {
            return res.status(404).json({ message: 'Subscription plan not found' });
        }

        const orderNumber = await generateInvoiceNumber();

        // Find the agency by email
        const agency = await Agency.findOne({ email }).populate('subscription');
        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        // Calculate total amount for the subscription plan
        const totalAmount = subscription.price; // Assuming the price field exists in the Subscription model

        // Calculate how much each installment should be
        const installmentAmount = totalAmount / installmentDuration;

        // Record the installment payment
        const newPayment = new PaymentModel({
            email,
            plan,
            amount, // Current payment amount
            reference,
            orderNumber,
            totalAmount, // Total amount due
            amountPaid: amount, // First payment amount
            balance: totalAmount - amount, // Remaining balance
            installmentDuration,
            nextDueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // Next due date is in 1 month
            installmentPayments: [{
                amount,
                date: new Date(),
                status: 'paid',
            }],
            status: amount >= totalAmount ? 'completed' : 'partially_paid',
            paymentType: 'installment',
        });

        await newPayment.save();

        // Update the agency's subscription after the first installment
        if (!agency.subscription) {
            await updateAgencySubscription(agency, subscription);
        }


        res.status(200).json({
            message: 'Installment payment recorded successfully',
            orderNumber,
            balance: newPayment.balance,
            nextDueDate: newPayment.nextDueDate,
        });
    } catch (error) {
        console.error('Error recording installment payment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
