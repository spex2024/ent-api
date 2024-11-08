import Agency from "../model/agency.js";
import { sendMail } from "./mail.js";
import payment from "../model/payment.js";


const URL_APP = "https://enterprise.spexafrica.app/subscribe";
const URL_SITE = "https://enterprise.spexafrica.site/subscribe";


const getUrlBasedOnReferer = (req) => {
    const referer = req.headers.referer || req.headers.origin || '';
    if (referer.includes('.site')) {
        return { baseUrl: URL_SITE };
    }
    return { baseUrl: URL_APP};
};


export const checkInstallment = async (req, res) => {
    try {
        const agencies = await Agency.find().populate('payment');
        const notifications = []; // Array to hold notifications
        const currentDate = new Date();
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday
        const url = getUrlBasedOnReferer(req);

        for (const agency of agencies) {
            const paymentsWithNextDueDate = agency.payment.filter(payment => payment.createdAt);

            if (paymentsWithNextDueDate.length > 0) {
                const recentPayment = paymentsWithNextDueDate
                    .reduce((latest, payment) => new Date(payment.createdAt) > new Date(latest.createdAt) ? payment : latest, paymentsWithNextDueDate[0]);

                if (recentPayment) {
                    const { installmentPayments ,amount , nextDueDate: dueDate } = recentPayment;

                    // Set nextDueDate to 30 days after createdAt
                    const nextDueDate = new Date(recentPayment.createdAt);
                    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

                    // Calculate time difference in minutes
                    const timeDifferenceInMinutes = Math.floor((nextDueDate - currentDate) / (1000 * 60));
                    const timeDifferenceInHours = Math.floor(timeDifferenceInMinutes / 60);

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
                            template: 'payment', // Assuming your EJS file is 'verification.ejs'
                            context: {
                                title:'Upcoming Payment Reminder',
                                username: agency.company,
                                amountDue: amount,
                                dueDate : dueDate,
                                paymentLink: url,


                            }
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
                            template: 'payment', // Assuming your EJS file is 'verification.ejs'
                            context: {
                                title:'Account Deactivated - Payment Overdue',
                                username: agency.company,
                                amountDue: amount,
                                dueDate : dueDate,
                                paymentLink: url,


                            }
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
                            template: 'payment',
                            context: {
                                title:'Payment Overdue',
                                username: agency.company,
                                amountDue: amount,
                                dueDate : dueDate,
                                paymentLink: url,


                            }
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
                template:notification.template,
                html: notification.context
            });
        }

        res.status(200).json({ message: "success ok" });

    } catch (error) {
        console.error('Error checking agency subscriptions:', error);
        res.status(500).json({ message: "An error occurred" });
    }
};
