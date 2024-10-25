// cronJobs.js
import cron from 'node-cron';
import Agency from "../model/agency.js";
import { sendMail } from "./mail.js";

// Function to check agency subscriptions and update their status
const checkAgencySubscriptions = async () => {
    try {
        const agencies = await Agency.find().populate('payment');
        const notifications = []; // Array to hold notifications

        for (const agency of agencies) {
            const recentPayment = agency.payment
                .filter(payment => payment.nextDueDate) // Filter payments with a next due date
                .reduce((latest, payment) => new Date(payment.createdAt) > new Date(latest.createdAt) ? payment : latest, agency.payment[0]);

            if (recentPayment) {
                const { installmentDuration, balance, installmentPayments } = recentPayment;
                const currentDate = new Date();
                const nextDueDate = new Date(recentPayment.nextDueDate);
                const timeDifferenceInMinutes = Math.ceil((currentDate - nextDueDate) / (1000 * 60)); // Round up the difference
                const gracePeriodEnd = 10; // Grace period is 10 minutes
                const graceEnds = new Date(nextDueDate.getTime() + gracePeriodEnd * 60 * 1000); // Grace period end time
                const timeSinceGraceEnd = Math.ceil((currentDate - graceEnds) / (1000 * 60)); // Time in minutes since grace period ended



                console.log('Balance:', balance);
                console.log('Time left until due date:', timeDifferenceInMinutes);
                console.log('Time left until due date:', timeSinceGraceEnd % 5);

                // Check for reminders and notifications
                await handleNotifications(agency, recentPayment, timeDifferenceInMinutes, balance, installmentPayments, notifications, currentDate, nextDueDate, gracePeriodEnd);
            } else {
                console.log(`No payments with a next due date found for agency ${agency.email}.`);
            }
        }

        // Send notifications in batch
        await sendNotifications(notifications);
    } catch (error) {
        console.error('Error checking agency subscriptions:', error);
    }
};

const handleNotifications = async (agency, recentPayment, timeDifferenceInMinutes, balance, installmentPayments, notifications, currentDate, nextDueDate, gracePeriodEnd) => {
    // 1. Reminder message (20 minutes before due date)

    if (agency.isActive === true && installmentPayments === "complete" && agency.completeNotificationSent === false) {
        notifications.push({
            email: agency.email,
            subject: "Thank You for Completing Your Payment",
            message: `<p>Dear ${agency.company}, thank you for completing your installment payment. Your account is now up to date.</p>`
        });
        console.log(`Thank-you notification sent to ${agency.email} for payment completion.`);
        agency.completeNotificationSent = true; // Set the flag to true to prevent multiple thank-you messages
        await agency.save(); // Persist the update
    }


    if (timeDifferenceInMinutes > -14.5 && timeDifferenceInMinutes === -11.5 && installmentPayments === "in-progress" && agency.remainderNotificationSent === false) {
        notifications.push({
            email: agency.email,
            subject: "Upcoming Payment Reminder",
            message: `<p>Dear ${agency.company}, your next installment payment is due in ${timeDifferenceInMinutes} minutes. Please ensure you complete it to avoid deactivation.</p>`
        });
        console.log(`Reminder sent to ${agency.email} for upcoming payment.`);
        agency.remainderNotificationSent = true; // Set the flag to true
    }

    // 2. Due date message (when the time difference is 0)
    else if (timeDifferenceInMinutes >= 0 && installmentPayments === "in-progress" && !agency.dueNotificationSent) {
        notifications.push({
            email: agency.email,
            subject: "Payment Due Now",
            message: `<p>Dear ${agency.company}, your installment payment is now due. Please make the payment promptly to maintain your account status.</p>`
        });
        console.log(`Due date notification sent to ${agency.email}.`);
        agency.dueNotificationSent = true; // Set the flag to true
        agency.save()
    }

    // 3. Overdue and grace period handling
    else if (timeDifferenceInMinutes >= 0) {
        if (balance < 0) {
            const timeAfterDue = timeDifferenceInMinutes + gracePeriodEnd;
            if (timeAfterDue <= timeDifferenceInMinutes && agency.graceNotificationSent === false) {
                // Still within grace period
                notifications.push({
                    email: agency.email,
                    subject: "Grace Period Notification",
                    message: `<p>Dear ${agency.company}, you are within the grace period. Please settle payment before deactivation.</p>`
                });
                console.log(`Agency ${agency.email} is still within grace period. Settle payment before deactivation.`);
                agency.graceNotificationSent = true; // Set the flag to true
            } else {
                // Beyond grace period, mark agency as inactive
                if (agency.isActive === true && agency.dueNotificationSent === false) {
                    agency.isActive = false; // Mark the agency as inactive
                    recentPayment.installmentPayments = "overdue"; // Set payment status to overdue
                    await recentPayment.save(); // Save the updated payment status

                    notifications.push({
                        email: agency.email,
                        subject: "Payment Overdue",
                        message: `<p>Dear ${agency.company}, your payment is overdue. Please settle the balance to reactivate your account.</p>`
                    });
                    console.log(`Agency ${agency.email} marked as inactive due to overdue payment.`);
                    agency.dueNotificationSent = true; // Set the flag to true
                    agency.save()

            }
        }
    }

        if (agency.isActive === false && installmentPayments === "overdue") {
            const graceEnds = new Date(nextDueDate.getTime() + gracePeriodEnd * 60 * 1000); // Grace period end time
            const timeSinceGraceEnd = (currentDate - graceEnds) / (1000 * 60); // Time in minutes since grace period ended

            // Check if grace period has ended and send reminders at exact 5-minute intervals
            if (timeSinceGraceEnd >= 0 && Math.floor(timeSinceGraceEnd) % 5 === 0) {
                notifications.push({
                    email: agency.email,
                    subject: "Overdue Payment Reminder",
                    message: `<p>Dear ${agency.company}, your payment is still overdue. Please make the payment as soon as possible to avoid further penalties.</p>`
                });
                console.log(`Overdue reminder sent to ${agency.email}.`);
                agency.overDueNotificationSent = true; // Set the flag to true for tracking purposes
                await agency.save(); // Persist the update
            }
        }


    }
};

const sendNotifications = async (notifications) => {
    for (const notification of notifications) {
        await sendMail({
            to: notification.email,
            subject: notification.subject,
            html: notification.message
        });
    }
};

// Schedule the task to run every 3 minutes to stay current with installment due times
cron.schedule('*/1 * * * *', () => {
    console.log('Running subscription check...');
    checkAgencySubscriptions();
});

export default checkAgencySubscriptions;
