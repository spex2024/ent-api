// Import Vendor and Meal models
import { Meal, Vendor } from "../model/vendor.js";
import upload from "../middleware/multer-upload.js";
import { v2 as cloudinary } from 'cloudinary';

export const createMeal = async (req, res) => {
    upload.single('image')(req, res, async function (err) {
        if (err) {
            return res.status(500).json({ message: 'Image upload failed', error: err.message });
        }

        try {
            const vendorId = req.vendor.id; // Assuming vendor ID is available from authenticated user

            // Parse meal data from the request body
            const { mealName, description, daysAvailable, price, protein, sauce, extras } = req.body;

            // Validate required fields
            if (!mealName || !description || !daysAvailable || !price) {
                return res.status(400).json({ message: 'Meal name, description, days available, and price are required' });
            }

            let daysArray = daysAvailable;
            let proteinArray = protein;
            let sauceArray = sauce;
            let extrasArray = extras;

            // Parse any string-formatted arrays into proper arrays
            const parseArray = (value) => {
                if (typeof value === 'string') {
                    try {
                        return JSON.parse(value);
                    } catch (error) {
                        throw new Error('Invalid format');
                    }
                }
                return value;
            };

            try {
                daysArray = parseArray(daysArray);
                proteinArray = parseArray(proteinArray);
                sauceArray = parseArray(sauceArray);
                extrasArray = parseArray(extrasArray);
            } catch (error) {
                return res.status(400).json({ message: 'Invalid format for one or more fields' });
            }

            // Ensure daysAvailable is an array and not empty
            if (!Array.isArray(daysArray) || daysArray.length === 0) {
                return res.status(400).json({ message: 'Days available must be a non-empty array' });
            }

            // Trim any extra spaces from each day and other array fields
            daysArray = daysArray.map(day => day.trim());
            proteinArray = proteinArray?.map(protein => protein.trim()) || [];
            sauceArray = sauceArray?.map(sauce => sauce.trim()) || [];
            extrasArray = extrasArray?.map(extra => extra.trim()) || [];

            // Upload image to Cloudinary
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
                        if (error) return reject(error);
                        resolve(result);
                    }
                ).end(req.file.buffer);
            });

            // Create a new meal instance
            const newMeal = await Meal.create({
                vendor: vendorId,
                mealName,
                description,
                daysAvailable: daysArray,
                price,
                protein: proteinArray,
                sauce: sauceArray,
                extra: extrasArray,
                imageUrl: uploadedPhoto.secure_url,
                imagePublicId: uploadedPhoto.public_id
            });

            // Associate this meal with the vendor
            await Vendor.findByIdAndUpdate(
                vendorId,
                { $push: { meals: newMeal._id } },
                { new: true }
            );

            res.status(201).json({ message: 'Meal created successfully', meal: newMeal });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: err.message });
        }
    });
};

export const updateMeal = async (req, res) => {
    upload.single('image')(req, res, async function (err) {
        if (err) {
            return res.status(500).json({ message: 'Image upload failed', error: err.message });
        }

        try {
            const mealId = req.params.id;
            const meal = await Meal.findById(mealId);

            if (!meal) {
                return res.status(404).json({ message: 'Meal not found' });
            }

            const updatedData = {};

            // Validate and update meal fields
            if (req.body.mealName) updatedData.mealName = req.body.mealName;
            if (req.body.description) updatedData.description = req.body.description;

            // Handle daysAvailable update
            if (req.body.daysAvailable) {
                const days = JSON.parse(req.body.daysAvailable); // Assuming the client sends daysAvailable as a JSON string
                const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                if (Array.isArray(days) && days.every(day => validDays.includes(day))) {
                    updatedData.daysAvailable = days;
                } else {
                    return res.status(400).json({ message: 'Days available must be a valid array of weekdays' });
                }
            }

            if (req.body.price) updatedData.price = parseFloat(req.body.price);

            // Handle image update if present
            if (req.file) {
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
                    ).end(req.file.buffer);
                });

                updatedData.imageUrl = uploadedPhoto.secure_url;
                updatedData.imagePublicId = uploadedPhoto.public_id;

                // Optionally delete the old image from Cloudinary if it exists
                if (meal.imagePublicId) {
                    await cloudinary.uploader.destroy(meal.imagePublicId);
                }
            }

            // Update the meal with the new data
            const updatedMeal = await Meal.findByIdAndUpdate(mealId, updatedData, { new: true });

            res.status(200).json({ message: 'Meal updated successfully', meal: updatedMeal });
        } catch (err) {
            console.error('Error updating meal:', err);
            res.status(500).json({ message: err.message });
        }
    });
};

export const getMealById = async (req, res) => {
    try {
        const mealId = req.params.id;
        // Fetch the meal from the database by its ID and populate vendor details
        const meal = await Meal.findById(mealId).populate('vendor');

        if (!meal) {
            return res.status(404).json({ message: 'Meal not found' });
        }

        res.status(200).json(meal); // Send the meal as JSON response
    } catch (err) {
        console.error('Error fetching meal:', err);
        res.status(500).json({ message: err.message });
    }
};

export const getAllMeals = async (req, res) => {
    try {
        const mealId = req.params.id;
        // Fetch the meal from the database by its ID and populate vendor details
        const meal = await Meal.find().populate('vendor');

        if (!meal) {
            return res.status(404).json({ message: 'Meal not found' });
        }

        res.status(200).json(meal); // Send the meal as JSON response
    } catch (err) {
        console.error('Error fetching meal:', err);
        res.status(500).json({ message: err.message });
    }
};

export const deleteMealById = async (req, res) => {
    try {
        const mealId = req.params.id;

        // Find the meal by ID
        const meal = await Meal.findById(mealId);
        if (!meal) {
            return res.status(404).json({ message: 'Meal not found' });
        }

        // Remove the meal from the associated vendor's meal list
        const vendorId = meal.vendor;
        if (vendorId) {
            await Vendor.findByIdAndUpdate(vendorId, { $pull: { meals: mealId } });
        }

        // Delete the meal from the database
        await Meal.findByIdAndDelete(mealId);

        res.status(200).json({ message: 'Meal deleted successfully' });
    } catch (err) {
        console.error('Error deleting meal:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
