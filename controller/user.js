import User from '../model/user.js';
import Agency from "../model/agency.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { v2 as cloudinary} from 'cloudinary'
import upload from "../middleware/multer-upload.js";
import {Vendor} from "../model/vendor.js";
import Admin from "../model/admin.js";
import Order from "../model/order.js";
import Pack from "../model/pack.js";
import PackRequest from "../model/return-pack.js";
import {sendMail} from "../helper/mail.js";


dotenv.config();

const URL_APP = "https://user.spexafrica.app";
const URL_SITE = "https://user.spexafrica.site";
const local = "http://localhost:3000";
const VERIFY_APP = "https://api.spexafrica.app";
const VERIFY_SITE = "https://api.spexafrica.site";

// Development URLs
const DEV_SITE_URL = "http://localhost:3000"; // or http://localhost:3001
const DEV_VERIFY_URL = "http://localhost:8080";

const getUrlBasedOnReferer = (req) => {
    const referer = req.headers.referer || req.headers.origin || '';

    if (referer.includes('localhost')) {
        return { baseUrl: DEV_SITE_URL, verifyUrl: DEV_VERIFY_URL };
    } else if (referer.includes('.site')) {
        return { baseUrl: URL_SITE, verifyUrl: VERIFY_SITE };
    }

    return { baseUrl: URL_APP, verifyUrl: VERIFY_APP };
};



const sendVerificationEmail = async (user, emailToken, req) => {
    const { verifyUrl } = getUrlBasedOnReferer(req);
    const url = `${verifyUrl}/api/user/verify/${emailToken}`;
    console.log(verifyUrl)
    await sendMail({
        to: user.email,
        subject: 'Account Verification',
        template: 'verification', // Assuming your EJS file is 'verification.ejs'
        context: {
            username: user.firstName,
            verificationLink: url,
            code: user.code,
        }
    });
};
const sendResetEmail = async (user, resetToken, req) => {
    const { baseUrl } = getUrlBasedOnReferer(req);
    const url = `${baseUrl}/reset/password-reset?token=${resetToken}`;

    await sendMail({
        to: user.email,
        subject: 'Password Reset',
        template: 'reset', // Assuming your EJS file is 'verification.ejs'
        context: {
            username: user.firstName,
            resetLink: url,
        }
    });
};
// Function to generate unique user code based on agency's initials and random 3-digit counter
const generateUserCode = (agencyInitials, firstName, lastName) => {
    const counter = Math.floor(Math.random() * 900) + 100; // Generates a random number between 100 and 999
    return `${agencyInitials}${firstName.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase()}${counter}`;
};

// Function to update user code while keeping the numeric part constant
const updateUserCode = (userCode, updatedFirstName, updatedLastName) => {
    // Length of the numeric part (assumed to be 3 digits)
    const numericPartLength = 3;

    // Extract the numeric part from the userCode
    const numericPart = userCode.slice(-numericPartLength); // Last 3 digits

    // Extract the agency initials (everything before the initials and numeric part)
    const agencyInitials = userCode.slice(0, -numericPartLength - 2); // Remove last 5 characters (initials and numeric)

    // Generate new initials based on updated first and last names
    const newInitials = `${updatedFirstName.charAt(0).toUpperCase()}${updatedLastName.charAt(0).toUpperCase()}`;

    // Reconstruct the updated user code
    const updatedUserCode = `${agencyInitials}${newInitials}${numericPart}`;

    return updatedUserCode;
};


const generateToken = (payload, expiresIn) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

export const signUp = async (req, res) => {
    const uploadSingle = upload.single('profilePhoto');
    uploadSingle(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: "Multer error", error: err.message });
        }

        const { firstName, lastName, email, password, code, phone } = req.body;
        const profilePhoto = req.file;

        if (!firstName || !lastName || !email || !password || !code || !phone ) {
            return res.status(400).json({ message: "Please fill in all required fields" });
        }

        try {
            const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
            const existingVendor = await Vendor.findOne({ $or: [{ email }, { phone }] });
            const existingAgency = await Agency.findOne({ $or: [{ email }, { phone }] });
            const existingAdmin = await Admin.findOne({ $or: [{ email }, { phone }] });

            if (existingUser || existingVendor || existingAgency || existingAdmin) {
                return res.status(400).json({ message: "Email or phone already in use by another account" });
            }


            // Find the agency based on the provided code
            const agency = await Agency.findOne({ code });
            if (!agency) {
                return res.status(400).json({ message: "Invalid agency code" });
            }
            if (agency.packs === 0 || agency.packs < 0  || !agency.subscription) {
                return res.status(400).json({ message: "Enterprise limit reached or not subscribed yet " });
            }

            // Generate user code based on agency's initials
            const userCode = generateUserCode(agency.initials, firstName, lastName);

            // Upload profile photo to Cloudinary
            const uploadedPhoto = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    {
                        folder: 'meals',
                        transformation: [
                            { quality: 'auto', fetch_format: 'auto' },
                            { crop: 'fill', gravity: 'auto', width: 500, height: 600 }
                        ]
                    },
                    (error, result) => {
                        if (error) {
                            return reject(error);
                        }
                        resolve(result);
                    }
                ).end(profilePhoto.buffer);
            });


            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await  User.create({
                firstName,
                lastName,
                email,
                password: hashedPassword,
                phone,
                imageUrl: uploadedPhoto.secure_url,
                imagePublicId: uploadedPhoto.public_id,
                code: userCode,
                agency: agency._id,
                isVerified: false,
            });


            // Generate email verification token
            const emailToken = generateToken({ userId: user._id, email: user.email }, '1h');

            await sendVerificationEmail(user, emailToken ,req);
            setTimeout(async () => {
                try {

                    const userToDelete = await User.findOne({ email:user.email });

                    if (userToDelete && userToDelete.isVerified === false) {
                        await User.deleteOne({ email });

                    }
                } catch (error) {
                    console.error(`Error deleting user ${email}:`, error.message);
                }
            }, 60 * 60 * 1000);

            res.status(200).json({ message: "User registered successfully. Please check your email for verification link." });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error", error });
        }
    });
};

export const verifyEmail = async (req, res) => {
    const token = req.params.token;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find the user by email
        const user = await User.findOne({ email: decoded.email });

        // Check if the user exists
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user is already verified
        if (user.isVerified) {
            res.redirect(`${getUrlBasedOnReferer(req).baseUrl}/verify?status=verified`);
        }

        // Update user verification status
        user.isVerified = true;
        await user.save();

        // Find the agency and update it
        const agency = await Agency.findById(user.agency);
        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        // Add the user to the agency's user list if not already present
        if (!agency.users.includes(user._id)) {
            agency.users.push(user._id);
        }
        await agency.save();

        // Extract user's full name and agency's company name
        const packUser = `${user.firstName} ${user.lastName}`;
        const company = agency.company;

        // Get the current date in YYYY-MM-DD format
        const currentDate = new Date().toISOString().split('T')[0];

        // Check if the pack already exists for the user; if not, create a new one
        let pack = await Pack.findOne({ userCode: user.code });
        if (!pack) {
            pack = await Pack.create({
                packId: `${user.code}-${currentDate}`,
                userCode: user.code,
                userName: packUser,
                agency: company,
                status: 'inactive',
                quantity: 2,
            });
            user.pack = pack._id;
            await user.save();
        } else {
            // If the pack exists, just update its status
            pack.status = 'inactive';
            await pack.save();
        }

        // Decrement enterprise pack count
        agency.packs = agency.packs - 2;
        agency.issuedPack +=2
        await agency.save();
        // Redirect on successful verification
        return res.redirect(`${URL}/verify?status=success`);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.redirect(`${URL}/verify?status=expired`);
        }

        // Log error and send a generic server error response if necessary
        console.error(error.message);
        if (!res.headersSent) {
            return res.status(500).send('Server Error');
        }
    }
};

export const resendVerificationEmail = async (req, res) => {
    const { email } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user is already verified
        if (user.isVerified) {
            return res.status(400).json({ message: 'User already verified' });
        }

        // Generate a new verification token
        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        await sendVerificationEmail(user, token);

        res.status(200).json({ message: 'Verification email sent successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

export const signIn = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email }).populate('agency');

        if (!user) {
            return res.status(400).json({ message: 'Account does not exist or token has expired. Please create an account.' });
        }
        if (!user.agency.isActive) {
            return res.status(400).json({ message: 'Your company has outstanding payments, and access is currently restricted.' });
        }


        if (!user.isVerified) {
            return res.status(400).json({ message: 'Please verify your email first.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ message: 'Incorrect password.' });
        }

        // Check if returnedPack is 1 and validate the emissionSaved, points, and moneyBalance
        if (user.returnedPack === 1) {
            const expectedEmissionSaved = 4; // 4 emissions saved per returned pack
            const expectedPoints = 0.07; // Points earned for the returned pack
            const expectedGrams = 0.07; // Points earned for the returned pack
            const expectedMoneyBalance = (expectedEmissionSaved / 60).toFixed(2); // 60 emission = 1kg = 1 GHS

            // Check if the values are correct, and update if needed
            if (
                user.emissionSaved !== expectedEmissionSaved ||
                user.points !== expectedPoints ||
                user.gramPoints !== expectedGrams ||
                user.moneyBalance !== expectedMoneyBalance
            ) {
                // Update the values
                user.emissionSaved = expectedEmissionSaved;
                user.points = expectedPoints;
                user.gramPoints = expectedGrams;
                user.moneyBalance = expectedMoneyBalance;

                await user.save(); // Save updated values
            }
        }

        const payload = {
            user: {
                id: user._id,
                email: user.email,
            },
        };

        const token = generateToken(payload, '1d');

        const cookieOptions = {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
        };

        // Set cookie for spexafrica.app and its subdomains
        res.cookie('user', token, { ...cookieOptions, domain: '.spexafrica.app' });
        // Set cookie for spexafrica.site and its subdomains
        res.cookie('user', token, { ...cookieOptions, domain: '.spexafrica.site' });
        res.cookie('user', token, { ...cookieOptions, domain: '' });
        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};


export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

export const getCurrentUser = async (req, res) => {
    const token = req.cookies.user;

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized access' });
    }

    try {
        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id).populate({
            path : 'agency',
            populate :{
                path:'vendors',
                populate:{
                    path:'meals',
                    populate :{
                        path:'vendor',
                    }

                }

            }
        }).populate({
            path :'orders',
            populate :'vendor'
        }).populate('pack');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }


        res.status(200).json({ user});
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
};

export const getVendor = async (req, res) => {
    const token = req.cookies.user;

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized access' });
    }

    try {
        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id).populate('agency');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Fetch the agency and populate vendors
        const agency = await Agency.findById(user.agency._id).populate({
            path: 'vendors',
            populate: {
                path: 'meals',
                model: 'Meal' // Ensure this matches the correct meal model name
            }
        });

        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }
         const vendors = agency.vendors
        res.status(200).json({ vendors});
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        console.error(error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

export const signOut = (req, res) => {
    try {

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        };
        // Set cookie for spexafrica.app and its subdomains
        res.clearCookie('user',  { ...cookieOptions, domain: '.spexafrica.app' });
        // Set cookie for spexafrica.site and its subdomains
        res.clearCookie('user',  { ...cookieOptions, domain: '.spexafrica.site' });
        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

export const requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'User with this email does not exist.' });
        }
        if (user && user.isVerified === false) {
            return res.status(400).json({ message: 'check your email and verify your account' });
        }


        const resetToken = generateToken({ email: user.email }, '1h'); // Token expires in 15 minutes
        user.resetPasswordToken = resetToken;
        await user.save();

        await sendResetEmail(user, resetToken);

        res.status(200).json({ message: 'Password reset link has been sent to your email.' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

export const resetPassword = async (req, res) => {

    const {newPassword:password , token} = req.body;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token.' });
        }
        const isSamePassword = await bcrypt.compare(password, user.password);
        if (isSamePassword) {
            return res.status(400).json({ message: 'New password must be different from the old password.' });
        }

        const newPassword = await bcrypt.hash(password, 10);
        user.password = newPassword;
        await user.save();

        res.status(200).json({ message: 'Password reset successful. You can now log in with your new password.' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

export const updateUserInfo = async (req, res) => {
    const uploadSingle = upload.single('profilePhoto');
    uploadSingle(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: "Multer error", error: err.message });
        }

        const { firstName, lastName, phone ,email } = req.body;
        const profilePhoto = req.file;
        const userId = req.params.userId;

        try {
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ message: "User not found" });
            const existingVendor = await Vendor.findOne({ $or: [{ email }, { phone }] });
            const existingAgency = await Agency.findOne({ $or: [{ email }, { phone }] });
            const existingAdmin = await Admin.findOne({ $or: [{ email }, { phone }] });

            if ( existingVendor || existingAgency || existingAdmin) {
                return res.status(400).json({ message: "Email or phone already in use by another account" });
            }


            // Update user info
            if (firstName || lastName || phone) {
                user.firstName = firstName || user.firstName;
                user.lastName = lastName || user.lastName;
                user.phone = phone || user.phone;
                user.email = email || user.email;
            }
            user.code = updateUserCode(user.code, firstName, lastName);
            // Handle profile photo update
            if (profilePhoto) {
                // Delete old image from Cloudinary
                if (user.imagePublicId) {
                    await cloudinary.uploader.destroy(user.imagePublicId);
                }

                // Upload new image to Cloudinary
                const uploadedPhoto = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        { folder: 'meals', transformation: [{ crop: 'fill', width: 500, height: 600 }] },
                        (error, result) => {
                            if (error) {
                                return reject(error);
                            }
                            resolve(result);
                        }
                    ).end(profilePhoto.buffer);
                });

                // Update user with new image details
                user.imageUrl = uploadedPhoto.secure_url;
                user.imagePublicId = uploadedPhoto.public_id;
            }

            await user.save();
            res.status(200).json({ message: "User updated successfully", user });

        } catch (error) {
            console.error(error.message);
            res.status(500).json({ message: error.message });
        }
    });
};

export const deleteUser = async (req, res) => {
    const userId = req.params.userId;

    try {
        // Find the user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get the agency associated with the user
        const agencyId = user.agency; // Assuming user has an 'agency' field that references the agency

        // Delete the user's profile photo from Cloudinary if it exists
        if (user.imagePublicId) {
            await cloudinary.uploader.destroy(user.imagePublicId);
        }

        // Find and delete the user's orders
        const orders = await Order.find({ user: userId });
        await Order.deleteMany({ user: userId });

        // Update vendors to remove the deleted user's orders
        for (const order of orders) {
            await Vendor.updateMany(
                { _id: order.vendor },
                { $pull: { orders: order._id } }
            );
        }

        // Optionally, delete related packs and pack requests
        await Pack.deleteMany({ user: userId });
        await PackRequest.deleteMany({ user: userId });

        // If the agency exists, remove the user from the agency's user array
        if (agencyId) {
            await Agency.updateOne(
                { _id: agencyId },
                { $pull: { users: userId } } // Assuming 'users' is the field holding user references
            );
        }

        // Delete user record
        await User.findByIdAndDelete(userId);

        // Return success message
        res.status(200).json({ message: 'User successfully deleted' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

