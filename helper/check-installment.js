// cronJobs.js
import cron from 'node-cron';
import Agency from "../model/agency.js";
import {sendMail} from "./mail.js";

// Function to check agency subscriptions and update their status
const checkAgencySubscriptions = async () => {
    try {
        const agencies = await Agency.find().populate('payment');
        const notifications = []; // Array to hold notifications

        for (const agency of agencies) {
            const recentPayment = agency.payment
                .filter(payment => payment.nextDueDate)
                .reduce((latest, payment) => {
                    return new Date(payment.createdAt) > new Date(latest.createdAt) ? payment : latest;
                }, agency.payment[0]);

            if (recentPayment) {
                const { installmentDuration, balance } = recentPayment;

                if ([3, 6].includes(installmentDuration)) {
                    const currentDate = new Date();
                    const nextDueDate = new Date(recentPayment.nextDueDate);
                    const timeDifferenceInMinutes = (currentDate - nextDueDate) / (1000 * 60);
                      console.log('balance :', balance)
                      console.log('time left :', timeDifferenceInMinutes);
                    if (timeDifferenceInMinutes >= 0 && balance > 0) {
                        if (!agency.isActive) {
                            console.log(`Agency ${agency.email} is already inactive. No further action needed.`);
                        } else {
                            agency.isActive = false;
                            await agency.save();
                            notifications.push({
                                email: agency.email,
                                subject: "Payment Due",
                                message: `<p>${agency.company} is now inactive, payment overdue.</p>`
                            });
                            console.log(`Agency ${agency.email} is now inactive, payment overdue.`);
                        }
                    }
                }
            } else {
                notifications.push({
                    email: agency.email,
                    subject: "Payment Due",
                    message: `<p>${agency.company} is now inactive, payment overdue.</p>`
                });
                console.log(`No payments with a next due date found for agency ${agency.email}.`);
            }
        }

        // Send notifications in batch
        for (const notification of notifications) {
            await sendMail({
                to: notification.email,
                subject: notification.subject,
                html: notification.message
            });
        }
    } catch (error) {
        console.error('Error checking agency subscriptions:', error);
    }
};



// Schedule the task to run every hour
cron.schedule('*/10 * * * *', () => {
    console.log('Running subscription check...');
    checkAgencySubscriptions();
});

export default checkAgencySubscriptions; // Export the function if needed elsewhere
