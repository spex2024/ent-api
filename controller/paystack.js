// Initialize a payment
import paystack from "../helper/paystack-service.js";
import generateInvoiceNumber from "../helper/order-number.js";
import PaymentModel from "../model/payment.js";
import Agency from "../model/agency.js";
import Subscription from "../model/add-subscription.js";

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

// Verify payment
export const verifyPayment = async (req, res) => {
    const { reference } = req.params;

    try {
        const response = await paystack.verifyTransaction({ reference });
        res.status(200).json(response.body);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



// Function to record payment and link subscription with agency
export const recordPayment = async (req, res) => {
    const { email, plan, amount, reference } = req.body;
    console.log(email, plan, amount, reference);

    try {
        // Generate invoice number
        const orderNumber = await generateInvoiceNumber();
        console.log('Generated Order Number:', orderNumber);

        // Record the payment
        const newPayment = new PaymentModel({
            email,
            plan,
            amount,
            reference,
            orderNumber,
            status: 'success',
        });
        await newPayment.save();
        console.log('Payment recorded successfully');

        // Find the agency by email
        const agency = await Agency.findOne({ email }).populate('subscription');
        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        console.log('Agency found:', agency);

        // Find the new subscription by plan
        const newSubscription = await Subscription.findOne({ plan });
        if (!newSubscription) {
            return res.status(404).json({ message: 'Subscription plan not found' });
        }

        console.log('New Subscription found:', newSubscription);

        // Check if the agency already has a subscription (i.e., upgrade scenario)
        if (agency.subscription) {
            console.log('Upgrading subscription from:', agency.subscription.plan, 'to:', newSubscription.plan);
        }
        agency.isActive = true
        // Get the number of staff from the new subscription
        const numberOfStaff = newSubscription.staff || 0; // Assuming `staff` is a field in Subscription
        const numberOfPacks = numberOfStaff * 2; // Calculate packs based on staff count

        // Get the current number of users in the agency
        const numberOfUsers = agency.users ? agency.users.length : 0;
        const userPacks = numberOfUsers * 2; // Each user "consumes" 2 packs

        // Recalculate the available packs after upgrade
        const availablePacks = numberOfPacks - userPacks;

        // Assign the new subscription to the agency
        agency.subscription = newSubscription._id;
        agency.issuedPack = userPacks;
        agency.packs = availablePacks;


        console.log('Updated Agency details:', {
            subscription: agency.subscription,
            issuedPack: agency.issuedPack,
            packs: agency.packs,
        });

        await agency.save(); // Save the updated agency details
        console.log('Agency subscription updated successfully');

        res.status(200).json({
            message: 'Payment and subscription update successful',
            orderNumber,
            availablePacks,
            agency,
        });
    } catch (error) {
        console.error('Error recording payment or updating subscription:', error);
        res.status(500).json({ error: error.message });
    }
};


