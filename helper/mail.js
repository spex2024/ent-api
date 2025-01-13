import ejs from "ejs";
import path from "path";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { Resend } from "resend";

dotenv.config();

// Manually define __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Resend API
const resend = new Resend(process.env.RESEND_API);

// Reusable sendMail function
export const sendMail = async ({ to, subject, template, context }) => {
    try {
        // Render the EJS template
        const html = await ejs.renderFile(
            path.join(__dirname, `../views/emails/${template}.ejs`),  // Adjusted path
            context
        );


        // Use Resend to send the email
        const email = await resend.emails.send({
            from: 'hello@spexafrica.app', // Replace with your verified sender email
            to,
            subject,
            html,
        });

        // Log the sent email response
        console.log('Email sent successfully:', email);
        return email;
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send email');
    }
};
