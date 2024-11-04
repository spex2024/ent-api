import Agency from "../model/agency.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import jwt, {decode} from "jsonwebtoken";
import { v2 as cloudinary } from 'cloudinary';
import upload from "../middleware/multer-upload.js";
import Admin from "../model/admin.js";
import User from "../model/user.js";
import {Meal, Vendor} from "../model/vendor.js";
import {sendMail} from "../helper/mail.js";
import Payment from "../model/payment.js";
import checkAgencySubscriptions from "../helper/check-installment.js";
dotenv.config();
const URL = "https://enterprise.spexafrica.app";
const verify = "https://api.spexafrica.app";



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
const sendVerificationEmail = async (agency, emailToken) => {
    const url = `${verify}/api/enterprise/verify/${emailToken}`;
    // transporter.sendMail({
    //     to: agency.email,
    //     subject: 'Verify your email',
    //     html: `Thanks for signing up on spex platform , Company Name: ${agency.company}, Account ID: ${agency.code}. Click <a href="${url}">here</a> to verify your email.`
    // });

    await sendMail({
        to: agency.email,
        subject: 'Verify your email',
        html: `Thanks for signing up on spex platform , Company Name: ${agency.company}, Account ID: ${agency.code}. Click <a href="${url}">here</a> to verify your email.`
    });

};
const sendResetEmail = async (agency, resetToken) => {
    const url = `${URL}/reset/password-reset?token=${resetToken}`;
    // transporter.sendMail({
    //     to: agency.email,
    //     subject: 'Password Reset Request',
    //     html: `Click <a href="${url}">here</a> to reset your password.`,
    // });
    await sendMail({
        to: agency.email,
        subject: 'Password Reset Request',
        html: `Click <a href="${url}">here</a> to reset your password.`,
    });
};
// Function to generate initials from company and branch
const generateInitials = (company, branch) => {
    const companyParts = company.split(' '); // Split company into parts by spaces
    const branchParts = branch.split(' '); // Split branch into parts by spaces
    let initials = '';

    // Get the first letter of each part and concatenate
    companyParts.forEach(part => {
        initials += part.charAt(0).toUpperCase(); // First letter of each part of company
    });

    branchParts.forEach(part => {
        initials += part.charAt(0).toUpperCase(); // First letter of each part of branch
    });

    return initials;
};
const generateUniqueCode = async (company, branch) => {
    const initials = generateInitials(company, branch);
    let code;
    const randomCounter = Math.floor(Math.random() * 900) + 100; // Generates a random number between 100 and 999
    const paddedCounter = String(randomCounter).padStart(3, '0');
    code = `${initials}${paddedCounter}`;
    return code;
};
const updateAgencyCode = (agencyCode, company, branch) => {
    // Length of the numeric part (assumed to be 3 digits)
    const numericPartLength = 3;
    const initials = generateInitials(company, branch);
    // Extract the numeric part from the vendorCode
    const numericPart = agencyCode.slice(-numericPartLength); // Last 3 digits

    // Reconstruct the updated vendor code
    const updatedAgencyCode = `${initials}${numericPart}`;

    return updatedAgencyCode;
};
const generateToken = (payload, expiresIn) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};
export const agencySignUp = async (req, res) => {
    const uploadSingle = upload.single('profilePhoto');
    uploadSingle(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: "Multer error", error: err.message });
        }

        const { company, branch, email, password , phone , location} = req.body;
        const profilePhoto = req.file;

        if (!company || !branch || !email || !password ) {
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

            const hashedPassword = await bcrypt.hash(password, 10);
            const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '2m' }); // Sign JWT token with email, set to expire in 2 minutes
            const initials = generateInitials(company, branch);
            const code = await generateUniqueCode(company, branch);

            // Upload profile photo to Cloudinary
            const uploadedPhoto = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    {
                        folder: 'agency',
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

           const  agency = await Agency.create({
                company,
                branch,
                email,
                phone,
                location,
                code,
                initials,
                password: hashedPassword, // Remember to hash the password
                isVerified: false,
                imageUrl: uploadedPhoto.secure_url,
                imagePublicId: uploadedPhoto.public_id
            });

            await sendVerificationEmail(agency, token); // Send verification email with JWT token

            setTimeout(async () => {
                const agencyToDelete = await Agency.findOne({ email, token });
                if (agencyToDelete && agencyToDelete.isVerified === false) {
                    await Agency.deleteOne({ email });
                    res.json(`Deleted agency ${email} due to expired verification token.`);
                }
            }, 2 * 60 * 1000); // Delete agency after 2 minutes if not verified

            res.status(200).json({ status: "Sign up successful, please check your email to verify your account." });
        } catch (error) {
            console.error(error.message);
            res.status(500).send('Server Error');
        }
    });
};
export const verifyAgencyEmail = async (req, res) => {
    const token = req.params.token;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify JWT token
        const user = await Agency.findOne({ email: decoded.email });

        // Check if the user exists
        if (!user) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        // Check if the user is already verified
        if (user.isVerified) {
            return res.redirect(`${URL}/verify?status=verified`);
        }

        const agencyEmail = decoded.email;

        const agency = await Agency.findOneAndUpdate({ email: agencyEmail }, { isVerified: true });

        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        res.redirect(`${URL}/verify?status=success`); // Redirect on successful verification

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.redirect(`${URL}/verify?status=expired`);
        }
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
export const resendVerificationEmail = async (req, res) => {
    const { email } = req.body;

    try {
        // Find agency by email
        const agency = await Agency.findOne({ email });
        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        // Check if the agency is already verified
        if (agency.isVerified) {
            return res.status(400).json({ message: 'Agency already verified' });
        }

        // Check if agency

        // Generate a new verification token
        const token = jwt.sign({ email: agency.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        await sendVerificationEmail(agency, token);

        res.status(200).json({ message: 'Verification email sent successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
export const agencySignIn = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the agency and populate both 'users' and 'payment' collections
        const agency = await Agency.findOne({ email }).populate('users').populate('payment');
        if (!agency) {
            return res.status(400).json({ message: 'Account does not exist or token has expired. Please create an account.' });
        }

        if (!agency.isVerified) {
            return res.status(400).json({ message: 'Please verify your email first' });
        }
        const totalPaid = agency.payment.reduce((accum, payment) => {
            if (payment.plan === "Silver" && payment.paymentType === 'installment') {
                return accum + payment.amountPaid; // Assuming the amountPaid field exists in the Payment model
            }
            return accum;
        }, 0);

        console.log(totalPaid);

// // Activate agency if it is not active but has a valid subscription
//         if (agency.subscription && !agency.isActive ) {
//             agency.isActive = true;
//             await agency.save();
//         }


        // Continue with the password check and other operations
        const match = await bcrypt.compare(password, agency.password);
        if (!match) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        // Count how many users have activePack = 1
        const activePackCount = agency.users.filter(user => user.activePack === 1).length;

        // Set the agency's activePack to the total count of these users
        agency.activePack = activePackCount;

        // Aggregate points, gramPoints, emissionSaved, and moneyBalance from users
        const points = agency.users.reduce((total, user) => total + (user.points || 0), 0);
        const gramPoints = agency.users.reduce((total, user) => total + (user.gramPoints || 0), 0);
        const emissionSaved = agency.users.reduce((total, user) => total + (user.emissionSaved || 0), 0);
        const moneyBalance = agency.users.reduce((total, user) => total + (user.moneyBalance || 0), 0);

        // Update the agency's values
        agency.points = points;
        agency.gramPoints = gramPoints.toFixed(2);
        agency.emissionSaved = emissionSaved;
        agency.moneyBalance = moneyBalance.toFixed(2);

        await agency.save(); // Save the updated agency document
         await checkAgencySubscriptions()
        // Generate a token for the session
        const payload = {
            agency: {
                id: agency._id,
                email: agency.email,
            },
        };

        const token = generateToken(payload, '1d');
        agency.token = token;
        await agency.save();

        const cookieOptions = {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
        };

        // Set cookie for spexafrica.app and its subdomains
        res.cookie('token', token, { ...cookieOptions, domain: '.spexafrica.app' });
        // Set cookie for spexafrica.site and its subdomains
        res.cookie('token', token, { ...cookieOptions, domain: '.spexafrica.site' });


        res.json({ message: 'Login successful' });

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

export const signOut = (req, res) => {
    try {
        // res.clearCookie('token', {
        //     domain: '.spexafrica.app',
        //     httpOnly: true,
        //     secure: process.env.NODE_ENV === 'production',
        //
        // });


        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        };

        // Set cookie for spexafrica.app and its subdomains
        res.clearCookie('token', token, { ...cookieOptions, domain: '.spexafrica.app' });
        // Set cookie for spexafrica.site and its subdomains
        res.clearCookie('token', token, { ...cookieOptions, domain: '.spexafrica.site' });
        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
export const getAllAgencies = async (req, res) => {
    try {
        // Fetch only verified agencies
        const agencies = await Agency.find({ isVerified: true })
            .populate({
                path: 'users',
                populate: {
                    path: 'orders',
                    populate: {
                        path: 'vendor',
                    }
                }
            });

        res.status(200).json(agencies);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
export const getCurrentAgency = async (req, res) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized access' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const agency = await Agency.findById(decoded.agency.id).populate({
            path: 'users',
            populate: {
                path: 'orders',
                populate: [
                    {
                        path: 'user' // Populate user in orders
                    },
                    {
                        path: 'vendor', // Populate vendor in orders

                    }
                ]
            }
        }).populate({
            path:'vendors',
            populate : 'orders'
        }).populate({
            path:'subscription'
        });

        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        res.status(200).json(agency);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
export const forgotAgencyPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const agency = await Agency.findOne({ email });

        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        if (!agency.isVerified) {
            return res.status(400).json({ message: 'Check your email and verify your account.' });
        }

        const resetToken = generateToken({ email: agency.email }, '1h'); // Token expires in 1 hour
        agency.resetToken = resetToken;
        await agency.save();

        await sendResetEmail(agency, resetToken);

        res.status(200).json({ message: 'Password reset email sent' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
export const resetAgencyPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const agency = await Agency.findOne({ email: decoded.email });

        if (!agency) {
            return res.status(404).json({ message: 'Invalid token or agency not found' });
        }

        const isSamePassword = await bcrypt.compare(newPassword, agency.password);
        if (isSamePassword) {
            return res.status(400).json({ message: 'New password must be different from the old password.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        agency.password = hashedPassword;
        agency.resetToken = null;
        await agency.save();

        res.status(200).json({ message: 'Password reset successful. You can now log in with your new password.' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
export const updateAgencyProfile = async (req, res) => {
    const uploadSingle = upload.single('profilePhoto');
    uploadSingle(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: "Multer error", error: err.message });
        }

        const { company, email, phone, location  ,branch} = req.body;
        const profilePhoto = req.file;
        const agencyId = req.params.entId;
        try {
            // Find the vendor by ID
            const agency = await Agency.findById(agencyId);
            if (!agency) return res.status(404).json({ message: "Vendor not found" });

            // Check if email or phone already exists for another vendor, agency, or admin
            const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
            const existingVendor = await Vendor.findOne({ $or: [{ email }, { phone }] });
            const existingAdmin = await Admin.findOne({ $or: [{ email }, { phone }] });

            if (existingUser || existingVendor || existingAdmin ) {
                return res.status(400).json({ message: "Email or phone already in use by another account" });
            }

            if (company || branch|| phone || email || location) {
                agency.company= company|| agency.company;
                agency.location = location|| agency.location;
                agency.phone = phone || agency.phone;
                agency.email = email || agency.email;
                agency.branch = branch || agency.branch;
            }

            // Update vendor code based on the new first and last names
            agency.code = updateAgencyCode(agency.code, company, branch);

            // Handle profile photo update
            if (profilePhoto) {
                // Delete old image from Cloudinary if it exists
                if (agency.imagePublicId) {
                    await cloudinary.uploader.destroy(agency.imagePublicId);
                }

                // Upload new image to Cloudinary
                const uploadedPhoto = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        { folder: 'vendors', transformation: [{ crop: 'fill', width: 500, height: 600 }] },
                        (error, result) => {
                            if (error) {
                                return reject(error);
                            }
                            resolve(result);
                        }
                    ).end(profilePhoto.buffer);
                });

                // Update vendor with new image details
                agency.imageUrl = uploadedPhoto.secure_url;
                agency.imagePublicId = uploadedPhoto.public_id;
            }

            // Save updated vendor
            await agency.save();
            res.status(200).json({ message: "Agency updated successfully" });

        } catch (error) {
            console.error(error.message);
            res.status(500).json({ message: error.message });
        }
    });
};
export const deleteAgency = async (req, res) => {
    const { entId } = req.params;

    try {
        // Find the agency by ID
        const agency = await Agency.findById(entId).populate('vendors').populate('users');

        if (!agency) {
            return res.status(404).json({ message: 'Agency not found' });
        }

        // 1. Disconnect users associated with the agency
        await User.updateMany(
            { agency: entId },
            { $unset: { agency: "" } } // Remove the reference to the agency
        );

        // 2. Disconnect vendors associated with the agency
        await Vendor.updateMany(
            { agencies: entId },
            { $pull: { agencies: entId } } // Remove the agency from vendors
        );

        // 4. Optionally, delete the agency's profile photo from Cloudinary (if it exists)
        if (agency.imagePublicId) {
            await cloudinary.uploader.destroy(agency.imagePublicId);
        }

        // 5. Finally, delete the agency itself
        await Agency.findByIdAndDelete(entId);

        res.status(200).json({ message: 'Enterprise and its associations deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const addVendor = async (req, res) => {
    const vendors = req.body; // Extract vendor IDs from request body
    const token = req.cookies.token; // Assuming token is stored in cookies
    const decode = jwt.decode(token, process.env.JWT_SECRET);
    const agencyId = decode.agency.id;

    // Ensure agencyId and vendorIds are provided
    if (!agencyId || !Array.isArray(vendors) || vendors.length === 0) {
        return res.status(400).json({ message: 'Enterprise ID or vendor IDs not provided or invalid' });
    }

    try {
        // Fetch the current list of vendors for the agency
        const agency = await Agency.findById(agencyId).select('vendors');
        if (!agency) {
            return res.status(404).json({ message: 'Enterprise not found' });
        }

        // Check the number of existing vendors for the agency
        const existingVendorCount = agency.vendors.length;
        if (existingVendorCount + vendors.length > 3) {
            return res.status(400).json({ message: 'Cannot add more than two vendors to the enterprise' });
        }

        // Check if all provided vendors exist
        const existingVendors = await Vendor.find({ _id: { $in: vendors } }).select('_id');
        const existingVendorIds = existingVendors.map(vendor => vendor._id.toString());
        const nonExistentVendors = vendors.filter(vendorId => !existingVendorIds.includes(vendorId));
        if (nonExistentVendors.length > 0) {
            return res.status(400).json({ message: `The following vendor(s) do not exist: ${nonExistentVendors.join(', ')}` });
        }

        // Check if any vendors are already associated with the agency
        const alreadyAssociatedVendors = await Vendor.find({ _id: { $in: vendors }, agencies: agencyId }).select('_id');
        const alreadyAssociatedVendorIds = alreadyAssociatedVendors.map(vendor => vendor._id.toString());
        const notAssociatedVendors = vendors.filter(vendorId => !alreadyAssociatedVendorIds.includes(vendorId));
        if (notAssociatedVendors.length === 0) {
            return res.status(400).json({ message: 'Vendor(s) are already associated with this enterprise' });
        }

        // Update the Agency by adding the vendorIds to the agency's `vendors` array
        await Agency.findByIdAndUpdate(
            agencyId,
            { $addToSet: { vendors: { $each: notAssociatedVendors } } }, // $addToSet with $each ensures no duplicates
            { new: true }
        );

        // Update each Vendor by adding the agencyId to their `agencies` array
        await Vendor.updateMany(
            { _id: { $in: notAssociatedVendors } },
            { $addToSet: { agencies: agencyId } }, // $addToSet ensures no duplicates
            { new: true }
        );

        return res.status(200).json({ message: 'Vendor associated with the enterprise successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Error updating vendors and enterprise', error });
    }
};
export const disconnectVendor = async (req, res) => {
    const { userId, vendorId } = req.body; // Extract agency ID (userId) and vendor ID from request body

    // Ensure both userId (agencyId) and vendorId are provided
    if (!userId || !vendorId) {
        return res.status(400).json({ message: 'Enterprise ID or Vendor ID not provided or invalid' });
    }

    try {
        // Fetch the agency to ensure it exists and has the specified vendor
        const agency = await Agency.findById(userId).select('vendors');
        if (!agency) {
            return res.status(404).json({ message: 'Enterprise not found' });
        }

        // Check if the vendor is associated with the agency
        if (!agency.vendors.includes(vendorId)) {
            return res.status(400).json({ message: 'Vendor is not associated with this agency' });
        }

        // Remove the vendor from the agency's `vendors` array
        await Agency.findByIdAndUpdate(
            userId,
            { $pull: { vendors: vendorId } }, // $pull removes the vendor from the array
            { new: true }
        );

        // Remove the agency from the vendor's `agencies` array
        await Vendor.findByIdAndUpdate(
            vendorId,
            { $pull: { agencies: userId } }, // $pull removes the agency from the vendor's agencies array
            { new: true }
        );

        return res.status(200).json({ message: 'Vendor successfully disconnected from the enterprise' });
    } catch (error) {
        return res.status(500).json({ message: 'Error disconnecting vendor from agency', error });
    }
};
export const disconnectUser = async (req, res) => {
    const { entId, userId } = req.body
    console.log(entId,userId); // Extract agency ID (userId) and user ID (employeeId) from request body

    // Ensure both userId (agencyId) and employeeId are provided
    if (!userId || !entId) {
        return res.status(400).json({ message: 'Enterprise ID or User ID not provided or invalid' });
    }

    try {
        // Fetch the agency to ensure it exists and has the specified user
        const agency = await Agency.findById(entId).select('users');
        if (!agency) {
            return res.status(404).json({ message: 'Enterprise not found' });
        }
        console.log(agency)
        // Check if the user is associated with the agency
        if (!agency.users.includes(userId)) {
            return res.status(400).json({ message: 'User is not associated with this enterprise' });
        }

        // Remove the user from the agency's `users` array
        await Agency.findByIdAndUpdate(
            entId,
            { $pull: { users: userId } }, // $pull removes the user from the array
            { new: true }
        );

        // Set the user's `agency` field to null (or undefined) to disconnect from the agency
        await User.findByIdAndUpdate(
            userId,
            { $set: { agency: null } }, // Clear the agency field
            { new: true }
        );

        return res.status(200).json({ message: 'User successfully disconnected from the enterprise' });
    } catch (error) {
        return res.status(500).json({ message: 'Error disconnecting user from enterprise', error });
    }
};


