import { Resend } from "resend";
import dotenv from 'dotenv';
dotenv.config();
const api = process.env.RESEND_API;
const resend = new Resend(`${process.env.RESEND_API}`);


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



