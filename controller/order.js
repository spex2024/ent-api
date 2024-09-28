import { Meal, Vendor } from "../model/vendor.js";
import Order from "../model/order.js";
import User from "../model/user.js";
import jwt from "jsonwebtoken";
import Pack from "../model/pack.js";

// Function to generate a custom order ID
const generateOrderId = () => {
    // Generate a random 5-digit string and prepend "ORD-" to it
    const randomStr = Math.floor(10000 + Math.random() * 90000).toString();
    return `ORD-${randomStr}`;
};


export const placeOrder = async (req, res) => {
    try {
        // Destructure the meal and options from the request body
        const { meal, options } = req.body;


        // Get the user token from cookies and decode it to retrieve user info
        const token = req.cookies.user; // Assuming user token is stored in cookies
        const decoded = jwt.decode(token, process.env.JWT_SECRET);
        const userId = decoded?.user?.id; // Extract user ID
        // Check for existing orders
        const currentTime = new Date();
        const sixAMNextDay = new Date();
        sixAMNextDay.setHours(6, 0, 0, 0); // Set time to 6 AM
        sixAMNextDay.setDate(sixAMNextDay.getDate() + 1); // Move to the next day

        const existingOrders = await Order.find({
            user: userId,
            status: { $in: ['Pending', 'Completed'] },
            createdAt: {
                $gte: new Date(currentTime.setHours(0, 0, 0, 0)), // Today
                $lt: sixAMNextDay, // Until 6 AM the next day
            },
        });

        if (existingOrders.length > 0) {
            return res.json({ message: 'You cannot place a new order until the next day' });
        }


        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Validate meal and options
        if (!meal || !options) {
            return res.status(400).json({ message: 'Meal and options are required.' });
        }

        // Extract vendor ID from the meal object
        const vendorId = meal.vendor;
        if (!vendorId) {
            return res.status(400).json({ message: 'Vendor information is missing.' });
        }




        // Construct the meals array based on the provided meal and options
        const meals = [{
            mealId: meal.id,
            main: meal.main,
            price: meal.price,
            protein: options.protein,
            sauce: options.sauce || '', // Sauce can be optional
            extras: options.extras || '', // Extras can also be optional
        }];

        // Generate a custom order ID
        const customOrderId = generateOrderId();

        // Create the new order in the database
        const order = await Order.create({
            orderId: customOrderId,
            user: userId,
            vendor: vendorId,
            meals,
            imageUrl: meal.imageUrl,
            quantity: meal.quantity, // Assuming default quantity is 1, can be adjusted based on your requirements
        });
       console.log(order)
        // Push the order to the user's orders array
        await User.findByIdAndUpdate(userId, { $push: { orders: order._id } });

        // Push the order to the vendor's orders array
        await Vendor.findByIdAndUpdate(vendorId, { $push: { orders: order._id } });

        // Return the created order
        return res.status(201).json({ message: 'Order successfully placed', order });
    } catch (error) {
        console.error(error);
        return res.json({ message: error.message });
    }
};


export const completeOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        // Find the order by its ID and populate user info
        const order = await Order.findById(orderId).populate('user');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Mark the order as completed
        order.status = 'completed';
        await order.save();

        // Find the vendor associated with the order
        const vendor = await Vendor.findById(order.vendor);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
         const price = order.meals.map(meal => meal.price)

        // Update vendor's completed orders count and sales totals
        vendor.completedOrders += 1;
        vendor.totalSales += price// Assuming vendor schema has totalSales
        vendor.totalAmount += price  // Assuming vendor schema has totalAmount
        await vendor.save();

        // Retrieve the user associated with the order and populate their agency info
        const user = await User.findById(order.user).populate('agency');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Extract user's full name and agency company name
        const packUser = `${user.firstName} ${user.lastName}`;
        const enterprise = user.agency.company;

        // Get the current date in YYYY-MM-DD format
        const currentDate = new Date().toISOString().split('T')[0];

        // Check if the pack already exists for the user; if not, create a new one
        let pack = await Pack.findOne({ userCode: user.code });
        if (!pack) {
            pack = await Pack.create({
                packId: `${user.code}-${currentDate}`,
                userCode: user.code,
                userName: packUser,
                agency: enterprise,
                status: 'active',
                issuedPack: 1,
            });
            user.pack = pack._id;
        } else {
            // If the pack exists, just update its status
            pack.status = 'active';
            await pack.save();
        }

        // Update user's activePack field (initialize if undefined)
        if (user.activePack === undefined) {
            user.activePack = 1;
        } else if (user.activePack === 0) {
            user.activePack += 1;
        }

        // Save the updated user
        await user.save();
        res.status(200).json({ message: 'Order marked as completed, user active pack number updated, and pack created/updated', activePackNumber: user.activePack, pack });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        console.log(orderId)

        // Find the order by its ID
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Mark the order as cancelled
        order.status = 'cancelled';
        await order.save();

        // Find the vendor associated with the order
        const vendor = await Vendor.findById(order.vendor);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Increment the vendor's canceled orders count
        vendor.canceledOrders += 1;  // Assuming vendor schema has a canceledOrders field
        await vendor.save();

        res.status(200).json({ message: 'Order marked as cancelled' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const deleteOrder = async (req, res) => {
    try {
        const orderId  = req.params.id;

        // Find the order by its ID
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check the status of the order
        const { status } = order;

        // Find the vendor associated with the order
        const vendor = await Vendor.findById(order.vendor);
        if (vendor) {
            // Update vendor's completed or canceled orders count based on status
            if (status === 'completed') {
                vendor.completedOrders -= 1; // Decrement completed orders count
            } else if (status === 'cancelled') {
                vendor.canceledOrders -= 1; // Decrement canceled orders count
            }
            await vendor.save(); // Save the vendor updates
        }

        // Find the user associated with the order
        const user = await User.findById(order.user);
        if (user) {
            // Update the user's activePack if the order was completed or canceled
            if (status === 'completed' || status === 'cancelled') {
                user.activePack = Math.max(0, (user.activePack || 0) - 1); // Decrement active pack, ensuring it doesn't go negative
                await user.save(); // Save the user updates
            }
        }

        // Remove the order from the user's orders array
        await User.findByIdAndUpdate(order.user, { $pull: { orders: orderId } });

        // Remove the order from the vendor's orders array
        await Vendor.findByIdAndUpdate(order.vendor, { $pull: { orders: orderId } });

        // Delete the order from the database
        await Order.findByIdAndDelete(orderId);

        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const getOrdersByUserId = async (req, res) => {
    try {
        // Get the user token from cookies and decode it to retrieve user info
        const token = req.cookies.user; // Assuming user token is stored in cookies
        const decoded = jwt.decode(token, process.env.JWT_SECRET);
        const userId = decoded?.user?.id; // Extract user ID

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Find all orders associated with the user
        const orders = await Order.find({ user: userId }).populate('vendor meals'); // Populate vendor and meals if needed

        if (orders.length === 0) {
            return res.status(404).json({ message: 'No orders found for this user' });
        }

        // Return the orders
        return res.status(200).json({ message: 'Orders retrieved successfully', orders });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
};
