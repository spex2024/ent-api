// cronJobs.js
import cron from 'node-cron';
import Agency from "../model/agency.js";
import { sendMail } from "./mail.js";

export const checkInstallment= async ( req ,res) => {
    try {
        const agencies = await Agency.find().populate('payment');
        const notifications = []; // Array to hold notifications

        for (const agency of agencies) {
            const paymentsWithNextDueDate = agency.payment.filter(payment => payment.nextDueDate);

            if (paymentsWithNextDueDate.length > 0) {
                const recentPayment = paymentsWithNextDueDate
                    .reduce((latest, payment) => new Date(payment.createdAt) > new Date(latest.createdAt) ? payment : latest, paymentsWithNextDueDate[0]);

                if (recentPayment) {
                    const { balance, installmentPayments } = recentPayment;
                    const currentDate = new Date();
                    const nextDueDate = new Date(recentPayment.nextDueDate);
                    const timeDifferenceInMinutes = Math.ceil((currentDate - nextDueDate) / (1000 * 60)); // Corrected the calculation
                    const gracePeriodEnd = 10;
                    const graceEnds = new Date(nextDueDate.getTime() + gracePeriodEnd * 60 * 1000);
                    const timeSinceGraceEnd = Math.ceil((currentDate - graceEnds) / (1000 * 60));

                    console.log(timeDifferenceInMinutes);
                    console.log(nextDueDate);

                    // 1. Thank-you message for completed payment
                    if (agency.isActive && installmentPayments === "complete" && agency.completeNotificationSent === false) {
                        notifications.push({
                            email: agency.email,
                            subject: "Thank You for Completing Your Payment",
                            message: `<p>Dear ${agency.company}, thank you for completing your installment payment. Your account is now up to date.</p>`
                        });
                        agency.completeNotificationSent = true;
                        await agency.save();
                    }

                    // 2. Reminder before due date (now using a range for time difference)
                    if (timeDifferenceInMinutes >= -15 && timeDifferenceInMinutes <= 0 && installmentPayments === "in-progress" && agency.remainderNotificationSent === false) {
                        notifications.push({
                            email: agency.email,
                            subject: "Upcoming Payment Reminder",
                            message: `<p>Dear ${agency.company}, your next installment payment is due in ${Math.abs(timeDifferenceInMinutes)} minutes. Please ensure you complete it to avoid deactivation.</p>`
                        });
                        agency.remainderNotificationSent = true;
                        await agency.save();
                    }

                    // 3. Due date message
                    if (timeDifferenceInMinutes >= 0 && installmentPayments === "in-progress" && agency.dueNotificationSent === false) {
                        notifications.push({
                            email: agency.email,
                            subject: "Payment Due Now",
                            message: `<p>Dear ${agency.company}, your installment payment is now due. Please make the payment promptly to maintain your account status.</p>`
                        });
                        agency.dueNotificationSent = true;
                        await agency.save();
                    }

                    // 4. Overdue and grace period handling
                    if (timeDifferenceInMinutes >= 0 && installmentPayments === "in-progress") {
                        if (balance < 0) {
                            const timeAfterDue = timeDifferenceInMinutes + gracePeriodEnd;
                            if (timeAfterDue <= gracePeriodEnd && agency.graceNotificationSent === false) {
                                notifications.push({
                                    email: agency.email,
                                    subject: "Grace Period Notification",
                                    message: `<p>Dear ${agency.company}, you are within the grace period. Please settle payment before deactivation.</p>`
                                });
                                agency.graceNotificationSent = true;
                                await agency.save();
                            } else if (timeSinceGraceEnd > 0 && agency.isActive) {
                                agency.isActive = false;
                                recentPayment.installmentPayments = "overdue";
                                await recentPayment.save();

                                notifications.push({
                                    email: agency.email,
                                    subject: "Payment Overdue",
                                    message: `<p>Dear ${agency.company}, your payment is overdue. Please settle the balance to reactivate your account.</p>`
                                });
                                agency.dueNotificationSent = true;
                                await agency.save();
                            }
                        }

                        // 5. Periodic overdue reminder after grace period
                        if (!agency.isActive && installmentPayments === "overdue" && timeSinceGraceEnd >= 0 && timeSinceGraceEnd % 5 === 0) {
                            notifications.push({
                                email: agency.email,
                                subject: "Overdue Payment Reminder",
                                message: `<p>Dear ${agency.company}, your payment is still overdue. Please make the payment as soon as possible to avoid further penalties.</p>`
                            });
                            agency.overDueNotificationSent = true;
                            await agency.save();
                        }
                    }
                }
            } else {
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

// Schedule the task to run every 3 minutes to stay current with installment due times
cron.schedule('*/3 * * * *', () => {
    console.log('Running subscription check...');
    checkInstallment();
});

export default checkInstallment;
