
import bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import upload from "../middleware/multer-upload.js";
import jwt from 'jsonwebtoken';
import {Vendor} from "../model/vendor.js";
import User from "../model/user.js";
import Order from "../model/order.js";
import Agency from "../model/agency.js";
import Admin from "../model/admin.js";
import {sendMail, sendSuccessMail, verifyEmail} from "../helper/mail.js";

const generateToken = (payload, expiresIn) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

export const createAdmin = async (req, res) => {
    const uploadSingle = upload.single('profilePhoto');
    uploadSingle(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: "Multer error", error: err.message });
        }

        const { firstName, lastName, email, password,  username } = req.body;
        const profilePhoto = req.file;

        if (!firstName || !lastName || !email || !password || !username) {
            return res.status(400).json({ message: "Please fill in all required fields" });
        }

        try {
            // Check if admin or username already exists
            const existingUser = await User.findOne({ $or: [{ email }] });
            const existingVendor = await Vendor.findOne({ $or: [{ email }] });
            const existingAgency = await Agency.findOne({ $or: [{ email }] });
            const existingAdmin = await Admin.findOne({ $or: [{ email }] });

            if (existingUser || existingVendor || existingAgency || existingAdmin) {
                return res.status(400).json({ message: "Email or phone already in use by another account" });
            }


            const existingUsername = await Admin.findOne({ username });
            if (existingUsername) {
                return res.status(400).json({ message: "Username already exists" });
            }

            let imageUrl = null;
            let imagePublicId = null;

            if (profilePhoto) {
                // Upload profile photo to Cloudinary
                const uploadedPhoto = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        {
                            folder: 'admin_profiles',
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

                imageUrl = uploadedPhoto.secure_url;
                imagePublicId = uploadedPhoto.public_id;
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const admin = await Admin.create({
                firstName,
                lastName,
                email,
                password: hashedPassword,
                username,
                imageUrl,
                imagePublicId,
            });
            await  sendMail({  to: email,
                subject: 'Sign Up Success',
                html: `<h1>Hello, ${admin.username}</h1><p>Admin created successfully 1</p>`,})

            sendSuccessMail({
                to: email,
                subject: 'Sign Up Success',
                html: `<h1>Hello, ${admin.username}</h1><p>Admin created successfully 2</p>`,})
            res.status(200).json({ message: "Admin created successfully", admin });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error", error });
        }
    });
};

export const signIn = async (req, res) => {
    const { email, username, password } = req.body;

    if (!password || (!email && !username)) {
        return res.status(400).json({ message: "Please provide a username or email and password" });
    }

    try {
        // Determine whether to search by email or username
        const query = email ? { email } : { username };
        const admin = await Admin.findOne(query);

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = generateToken({ id: admin._id }, '1d');

        const cookieOptions = {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
        };

        // Set cookie for spexafrica.app and its subdomains
        res.cookie('admin', token, { ...cookieOptions, domain: '.spexafrica.app' });
        // Set cookie for spexafrica.site and its subdomains
        res.cookie('admin', token, { ...cookieOptions, domain: '.spexafrica.site' });





        res.status(200).json({ message: "Sign-in successful" });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Server error", error });
    }
};

export const signOut = (req, res) => {
    // res.cookie('admin', '', {
    //     domain: '.spexafrica.app',
    //     httpOnly: true,
    //     secure: process.env.NODE_ENV === 'production',
    //     maxAge: 0 // Set the cookie to expire immediately
    // });

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
    };

    // Set cookie for spexafrica.app and its subdomains
    res.clearCookie('admin',  { ...cookieOptions, domain: '.spexafrica.app' });
    // Set cookie for spexafrica.site and its subdomains
    res.clearCookie('admin',  { ...cookieOptions, domain: '.spexafrica.site' });
    res.status(200).json({ message: 'Logout successful' });

};

export const updateAdmin = async (req, res) => {
    const uploadSingle = upload.single('profilePhoto');
    uploadSingle(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: "Multer error", error: err.message });
        }

        const { adminId } = req.params;
        const { firstName, lastName, phone } = req.body;
        const profilePhoto = req.file;

        try {
            const admin = await Admin.findById(adminId);

            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            if (firstName) admin.firstName = firstName;
            if (lastName) admin.lastName = lastName;
            if (phone) admin.phone = phone;

            if (profilePhoto) {
                // Delete the old profile photo from Cloudinary
                if (admin.imagePublicId) {
                    await cloudinary.uploader.destroy(admin.imagePublicId);
                }

                // Upload the new profile photo to Cloudinary
                const uploadedPhoto = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        {
                            folder: 'admin_profiles',
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

                admin.imageUrl = uploadedPhoto.secure_url;
                admin.imagePublicId = uploadedPhoto.public_id;
            }

            await admin.save();
            res.status(200).json({ message: "Admin information updated successfully", admin });
        } catch (error) {
            console.error(error.message);
            res.status(500).json({ message: "Server error", error });
        }
    });
};

export const deleteAdmin = async (req, res) => {
    const { adminId } = req.params;

    try {
        const admin = await Admin.findByIdAndDelete(adminId);

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        if (admin.imagePublicId) {
            await cloudinary.uploader.destroy(admin.imagePublicId);
        }

        res.status(200).json({ message: "Admin deleted successfully" });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Server error", error });
    }
};

export const getAllAdmins = async (req, res) => {
    try {
        const admins = await Admin.find();
        res.status(200).json(admins);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Server error", error });
    }
};

export const getCurrentAdmin = async (req, res) => {
    const token = req.cookies.admin;

    if (!token) {
        return res.status(401).json({ message: "No token provided, please sign in" });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminId = decoded.id;

        // Find the admin by ID
        const admin = await Admin.findById(adminId);

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        res.status(200).json(admin);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Server error", error });
    }
};

export const resetPassword = async (req, res) => {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
        return res.status(400).json({ message: "Please provide a valid reset token and new password" });
    }

    try {
        const admin = await Admin.findOne({
            resetPasswordToken: resetToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!admin) {
            return res.status(400).json({ message: "Invalid or expired reset token" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        admin.password = hashedPassword;
        admin.resetPasswordToken = undefined;
        admin.resetPasswordExpires = undefined;

        await admin.save();

        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Server error", error });
    }
};
// Controller to get all vendors
export const getAllVendors = async (req, res) => {
    try {
        const vendors = await Vendor.find().populate('agencies meals orders');
        res.status(200).json(vendors);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vendors', error });
    }
};
// Controller to get all users
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().populate('agency orders');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error });
    }
};
// Controller to get all orders
export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find().populate({
            path: 'user',
            populate:'agency',

        }).populate('meals').populate('vendor');
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error });
    }
};
// Controller to get all agencies
export const getAllAgencies = async (req, res) => {
    try {
        const agencies = await Agency.find().populate({
            path: 'users',
            populate: {
                path: 'orders',
                populate: {
                    path: 'vendor',
                }
        }})

        res.status(200).json(agencies);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching agencies', error });
    }
};

