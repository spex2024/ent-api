import { Resend } from "resend";
import dotenv from 'dotenv';
import nodemailer from "nodemailer";
dotenv.config();
const api = process.env.RESEND_API;
const resend = new Resend(`${process.env.RESEND_API}`);
const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use `true` for port 465, `false` for all other ports
    auth: {
        user: "spexdev95@gmail.com",
        pass: process.env.APP,
    },
});


// Reusable sendMail function
export  const sendMail = async ({ to, subject, html }) => {
    try {
        // Use Resend to send the email
        const email = await resend.emails.send({
            from: 'enunoch@spexafrica.app', // Replace with your verified sender email
            to,
            subject,
            html,
        });

        // Log the sent email response
        console.log('Email sent successfully:', email , api);
        return email;
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send email');
    }
};

export const sendSuccessMail = async ({ to, subject, html }) => {
    transporter.sendMail({
        to,
        subject,
        html,
    });
}

export const verifyEmail =  ({subject,html}) => {
    try {
        nodemailer
            .createTransport({
                service: "gmail",
                host: "smtp.gmail.com",
                port: 465,
                secure: true, // Use `true` for port 465, `false` for all other ports
                auth: {
                    user: "spexdev95@gmail.com",
                    pass: process.env.APP,
                },
            })
            .sendMail({
                from: 'spexdev95@gmail.com',
                to: 'ekowfirminno@gmail.com',
                subject,
                html,
            })
        console.log('Email sent to ')
    } catch (e) {
        console.error(e)
    }

}

