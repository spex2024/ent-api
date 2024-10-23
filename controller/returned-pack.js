// Submit a pack request
import User from "../model/user.js";
import PackRequest from "../model/return-pack.js";
import Pack from "../model/pack.js";

export const submitPackRequest = async (req, res) => {
    const { code } = req.body;
    const userId = req.user.id; // Assuming you have middleware that sets req.user

    try {
        const user = await User.findById(userId);
        if (!user || user.code !== code) {
            return res.status(400).json({ message: 'Invalid code' });
        }

        // Create a new pack request
        const packRequest = await PackRequest.create({
            user: userId,
            code,
        });


        const pack = await Pack.findOne({ userCode: user.code});
        pack.status = "pending";




        res.status(200).json({ message: 'Pack request submitted successfully', packRequest });
    } catch (error) {
        res.status(500).json({ message: 'Error submitting pack request', error });
    }
};

// Approve a pack request
// Approve a pack request
// Approve or Reject a pack request

export const handlePackRequest = async (req, res) => {
    const { id, action } = req.body; // action can be 'approve' or 'reject'

    if (!id || !action) {
        return res.status(400).json({ message: 'id and action are required' });
    }

    try {
        // Find the pack request by its ID
        const packRequest = await PackRequest.findById(id).populate({
            path: 'user',
            populate: { path: 'agency' },
        });
        if (!packRequest || (packRequest.status !== 'Pending' && action === 'approve')) {
            return res.status(400).json({ message: 'Invalid or already processed request' });
        }

        const user = packRequest.user;
        const agency = packRequest.user.agency;

        if (action === 'approve') {
            // Approve the pack request
            packRequest.status = 'Approved';
            await packRequest.save();

            // Update the user's returnedPack count, emissionSaved, and points
            user.returnedPack = (user.returnedPack || 0) + 1; // Increment returnedPack
            user.emissionSaved = (user.emissionSaved || 0) + 4; // Increment emissions saved by 4 per pack
            user.points = (user.points || 0) + 0.07; // Increment points by 0.07 kg per pack
            user.gramPoints = (user.gramPoints || 0) + 0.07; // Increment points by 0.07 kg per pack
            agency.returnedPack += 1; // Increment agency's returnedPack count

            // Calculate money based on emissions saved: 60 emissions saved = 1kg = 1 GHS
            const totalKgSaved = user.emissionSaved / 60; // 60 emissions = 1 kg
            user.moneyBalance = (totalKgSaved).toFixed(2); // Round up to the nearest GHS

            // Decrease the user's active pack number
            if (user.activePack > 0) {
                user.activePack -= 1;
                agency.activePack -= 1;
            }

            await user.save();
            await agency.save();

            // Find and update the corresponding pack
            const pack = await Pack.findOne({ userCode: user.code });

            if (pack) {
                // Update the pack status to 'returned'
                pack.status = 'returned';
                await pack.save();
            } else {
                console.error('Pack not found for the user on the current date');
            }

            res.status(200).json({ message: 'Pack request approved, user rewarded, and pack updated', packRequest });
        } else if (action === 'reject') {
            // Reject the pack request
            packRequest.status = 'Rejected';
            await packRequest.save();

            const pack = await Pack.findOne({ userCode: user.code });

            if (pack) {
                // Update the pack status based on its current status
                if (pack.status === 'active') {
                    pack.status = 'cancelled';
                }
                await pack.save();
            }

            res.status(200).json({ message: 'Pack request rejected', packRequest });
        } else {
            return res.status(400).json({ message: 'Invalid action' });
        }
    } catch (error) {
        console.error('Error handling pack request:', error);
        res.status(500).json({ message: 'Error handling pack request', error });
    }
};





// Get all returned packs
export const getAllReturnedPacks = async (req, res) => {
    try {
        // Find all pack requests
        const packRequests = await PackRequest.find().populate({
            path : 'user',
            populate : {
                path:'agency'
            }
        });

        res.status(200).json({ packRequests });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching returned packs', error });
    }
};


// Get all returned packs for the authenticated user
export const getReturnedPacks = async (req, res) => {
    try {
        const userId = req.user.id; // Get userId from the middleware

        // Find all pack requests for the authenticated user and populate user details
        const packRequests = await PackRequest.find({ user: userId }).populate({
            path : 'user',
            populate : {
                path:'agency'
            }
        });

        res.status(200).json({ packRequests });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching returned packs', error });
    }
};
