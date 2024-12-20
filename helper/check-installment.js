// cronJobs.js
import cron from 'node-cron';


import Agency from "../model/agency.js";
import { sendMail } from "./mail.js";

export const checkInstallment = async (req, res) => {
    try {
        const agencies = await Agency.find().populate('payment');
        const notifications = []; // Array to hold notifications
        const currentDate = new Date();
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday

        for (const agency of agencies) {
            const paymentsWithNextDueDate = agency.payment.filter(payment => payment.createdAt);

            if (paymentsWithNextDueDate.length > 0) {
                const recentPayment = paymentsWithNextDueDate
                    .reduce((latest, payment) => new Date(payment.createdAt) > new Date(latest.createdAt) ? payment : latest, paymentsWithNextDueDate[0]);

                if (recentPayment) {
                    const { installmentPayments } = recentPayment;

                    // Set nextDueDate to 30 days after createdAt
                    const nextDueDate = new Date(recentPayment.createdAt);
                    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

                    // Calculate time difference in minutes
                    const timeDifferenceInMinutes = Math.floor((nextDueDate - currentDate) / (1000 * 60));
                    const timeDifferenceInHours = Math.floor(timeDifferenceInMinutes / 60);

                    console.log('Hours :',timeDifferenceInHours)
                    console.log('Minutes :',timeDifferenceInMinutes)

                    // 1. Thank-you message for completed payment
                    if (agency.isActive && installmentPayments === "complete" && !agency.completeNotificationSent) {
                        notifications.push({
                            email: agency.email,
                            subject: "Thank You for Completing Your Payment",
                            message: `<p>Dear ${agency.company}, thank you for completing your installment payment. Your account is now up to date.</p>`
                        });
                        agency.completeNotificationSent = true;
                        await agency.save();
                    }

                    // 2. Reminder 3 days (72 hours) before due date
                    if (timeDifferenceInHours <= 72 && timeDifferenceInHours > 0 && installmentPayments === "in-progress" && !agency.remainderNotificationSent) {
                        notifications.push({
                            email: agency.email,
                            subject: "Upcoming Payment Reminder",
                            message: `<p>Dear ${agency.company}, your next installment payment is due in approximately ${timeDifferenceInHours} hours. Please ensure you complete it to avoid deactivation.</p>`
                        });
                        agency.remainderNotificationSent = true;
                        await agency.save();
                    }

                    // 3. Deactivate immediately when due date is reached
                    if (timeDifferenceInMinutes <= 0 && installmentPayments === "in-progress" && agency.isActive) {
                        agency.isActive = false;
                        notifications.push({
                            email: agency.email,
                            subject: "Account Deactivated - Payment Overdue",
                            message: `<p>Dear ${agency.company}, your payment is overdue, and your account has been deactivated. Please settle the balance to reactivate your account.</p>`
                        });
                        agency.dueNotificationSent = true;
                        agency.packs = 0;
                        recentPayment.installmentPayments = "overdue";
                        await recentPayment.save();
                        await agency.save();
                    }

                    // 4. Periodic overdue reminder every Monday and Friday if overdue
                    if (!agency.isActive && installmentPayments === "overdue" && (dayOfWeek === 1 || dayOfWeek === 5) && !agency.overDueNotificationSent) {
                        notifications.push({
                            email: agency.email,
                            subject: "Overdue Payment Reminder",
                            message: `<p>Dear ${agency.company}, your payment is still overdue. Please make the payment as soon as possible to avoid further penalties.</p>`
                        });
                        agency.overDueNotificationSent = true;
                        await agency.save();
                    }
                }
            } else {
                console.log(`No payments with a created date found for agency ${agency.email}.`);
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
        res.status(500).json({ message: "An error occurred" });
    }
};







// Schedule the task to run every 3 minutes to stay current with installment due times
cron.schedule('*/3 * * * *', () => {
    console.log('Running subscription check...');
    checkInstallment();
});

export default checkInstallment;
