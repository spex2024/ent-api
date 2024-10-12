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
        console.log(orderNumber);

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

        // Find the agency by email
        const agency = await Agency.findOne({ email }).populate('subscription');
        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        console.log(agency)
        // Find the new subscription by plan
        const newSubscription = await Subscription.findOne({ plan });
        if (!newSubscription) {
            return res.status(404).json({ message: 'Subscription plan not found' });
        }

        // Check if the agency already has a subscription (i.e., upgrade scenario)
        if (agency.subscription) {
            console.log('Upgrading subscription from:', agency.subscription.plan, 'to:', newSubscription.plan);
        }

        // Get the number of staff from the new subscription
        const numberOfStaff = newSubscription.staff || 0;  // Assuming `staff` is a field in Subscription
        const numberOfPacks = numberOfStaff * 2;  // Calculate packs based on staff count

        // Get the current number of users in the agency
        const numberOfUsers = agency.users ? agency.users.length : 0;
        const userPacks = numberOfUsers * 2;  // Each user "consumes" 2 packs
           console.log('users :',numberOfUsers)
           console.log('packs :',userPacks)
        // Recalculate the available packs after upgrade
        const availablePacks = numberOfPacks - userPacks;
        console.log(newSubscription);
        console.log(availablePacks)
        // Update the agency with the new subscription and recalculated packs
        agency.subscription = newSubscription._id; // Link new subscription to agency
        agency.issuedPack= userPacks
        agency.packs = numberOfPacks
        agency.availablePacks = availablePacks
        await agency.save(); // Save the updated agency details

        res.status(200).json({
            message: 'Payment and subscription update successful',
            orderNumber,
            availablePacks,
            agency
        });
    } catch (error) {
        console.error('Error recording payment or updating subscription:', error);
        res.status(500).json({ error: error.message });
    }
};

