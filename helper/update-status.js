import Agency from "../model/agency.js";
import { sendMail } from "./mail.js";

export const checkInstallment = async (req, res) => {
    try {
        const agencies = await Agency.find().populate('payment');
        const notifications = []; // Array to hold notifications

        for (const agency of agencies) {
            const paymentsWithNextDueDate = agency.payment.filter(payment => payment.nextDueDate);

            if (paymentsWithNextDueDate.length > 0) {
                const recentPayment = paymentsWithNextDueDate
                    .reduce((latest, payment) => new Date(payment.createdAt) > new Date(latest.createdAt) ? payment : latest, paymentsWithNextDueDate[0]);

                if (recentPayment) {
                    const { installmentPayments } = recentPayment;
                    const currentDate = new Date();
                    const nextDueDate = new Date(recentPayment.nextDueDate);
                    const timeDifferenceInMinutes = Math.ceil((nextDueDate - currentDate) / (1000 * 60));

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
                        res.status(200).json({message:"Payment Completion email sent"});
                    }

                    // 2. Reminder one hour before due date
                    if (timeDifferenceInMinutes <= 60 && timeDifferenceInMinutes > 0 && installmentPayments === "in-progress" && agency.remainderNotificationSent === false) {
                        notifications.push({
                            email: agency.email,
                            subject: "Upcoming Payment Reminder",
                            message: `<p>Dear ${agency.company}, your next installment payment is due in ${timeDifferenceInMinutes} minutes. Please ensure you complete it to avoid deactivation.</p>`
                        });
                        agency.remainderNotificationSent = true;
                        await agency.save();
                        res.status(200).json({message:"Payment Reminder email sent"});
                    }

                    // 3. Deactivate immediately when due date is reached
                    if (timeDifferenceInMinutes <= 0 && installmentPayments === "in-progress" && agency.isActive === true) {
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
                        res.status(200).json({message:"Deactivation email sent"});
                    }

                    // Periodic overdue reminder every 1 hour
                    if (!agency.isActive && installmentPayments === "overdue" && timeDifferenceInMinutes % 60 === 0) {
                        notifications.push({
                            email: agency.email,
                            subject: "Overdue Payment Reminder",
                            message: `<p>Dear ${agency.company}, your payment is still overdue. Please make the payment as soon as possible to avoid further penalties.</p>`
                        });
                        agency.overDueNotificationSent = true;
                        await agency.save();
                        res.status(200).json({message: "Overdue email sent successfully"});
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

        res.status(200).json({message:"Success 200 ok"});

    } catch (error) {
        console.error('Error checking agency subscriptions:', error);
        res.status(500).json({message: "Internal server error"});
    }
};
