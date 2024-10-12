// controllers/subscriptionController.js


import Subscription from "../model/add-subscription.js";

export const addSubscription = async (req, res) => {
    const { plan, price, paymentType, features ,staff} = req.body;

    try {
        // check if plan exist or subscription plan exist
        const existingSubscription = await Subscription.findOne({ plan });

        if (existingSubscription) {
            return res.status(400).json({ error: 'Plan already exists. Please choose a different plan name.' });
        }
        // Create a new subscription
        const newSubscription = await Subscription.create({
            plan,
            price,
            paymentType,
            staff,
            features,
        });

        return res.status(201).json(newSubscription);
    } catch (error) {
        console.error('Error adding subscription:', error);
        return res.status(500).json({ error: 'Failed to add subscription' });
    }
};


export const getAllSubscriptions = async (req, res) => {
    try {
        const subscriptions = await Subscription.find({});
        return res.status(200).json(subscriptions);
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
};