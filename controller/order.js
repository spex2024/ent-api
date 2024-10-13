import { Meal, Vendor } from "../model/vendor.js";
import Order from "../model/order.js";
import User from "../model/user.js";
import jwt from "jsonwebtoken";
import Pack from "../model/pack.js";

// Function to generate a custom order ID
const generateOrderId = () => {
    const randomStr = Math.floor(10000 + Math.random() * 90000).toString();
    return `ORD-${randomStr}`;
};

export const placeOrder = async (req, res) => {
    try {
        const { meal, options } = req.body;

        const token = req.cookies.user; // Assuming user token is stored in cookies
        if (!token) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const decoded = jwt.decode(token, process.env.JWT_SECRET);
        const userId = decoded?.user?.id; // Extract user ID

        // Validate meal and options
        if (!meal || !options) {
            return res.status(400).json({ message: 'Meal and options are required.' });
        }

        const vendorId = meal.vendor;
        if (!vendorId) {
            return res.status(400).json({ message: 'Vendor information is missing.' });
        }

        // Get today's date range
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Check for completed orders today
        const existingCompletedOrder = await Order.find({
            user: userId,
            status: 'completed',
            createdAt: { $gte: startOfDay, $lte: endOfDay },
        });

        if (existingCompletedOrder.length > 0) {
            return res.status(400).json({ message: 'You have already placed a completed order today.' });
        }

       // Check for pending orders
        const pendingOrders = await Order.find({
            user: userId,
            status: 'pending',
        });

        if (pendingOrders.length > 0) {
            return res.json({ message: 'You cannot place a new order until pending orders are completed.' });
        }

        const meals = [{
            mealId: meal.id,
            main: meal.main,
            price: meal.price,
            protein: options.protein,
            sauce: options.sauce || '',
            extras: options.extras || '',
        }];

        const customOrderId = generateOrderId();

        // Create the new order
        const order = await Order.create({
            orderId: customOrderId,
            user: userId,
            vendor: vendorId,
            meals,
            status: 'pending',
            imageUrl: meal.imageUrl,
            quantity: meal.quantity || 1,
        });

        // Update user and vendor orders
        await User.findByIdAndUpdate(userId, { $push: { orders: order._id } });
        await Vendor.findByIdAndUpdate(vendorId, { $push: { orders: order._id } });

        return res.status(201).json({ message: 'Order successfully placed', order });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
};

export const completeOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId).populate('user');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Mark the order as completed
        order.status = 'completed';
        await order.save();

        const vendor = await Vendor.findById(order.vendor);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        const totalPrice = order.meals.reduce((sum, meal) => sum + meal.price, 0);
        vendor.completedOrders += 1;
        vendor.totalSales += totalPrice;
        vendor.totalAmount += totalPrice;
        await vendor.save();

        const user = await User.findById(order.user).populate('agency');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        console.log(user)
        let pack = await Pack.findOne({ userCode: user.code });

       pack.status = 'active';
       if(!pack.quantity){
           pack.quantity = 2;
       }
        await pack.save();
        console.log(pack)
        user.activePack = (user.activePack || 0) + 1; // Increment user's active pack
         user.agency.activePack = (user.agency.activePack || 0) + 1; // Increment agency's active pack
        await user.save();

        // Optionally create or update a pack here (not included in the original code)

        return res.status(200).json({ message: 'Order marked as completed and user active pack updated', activePackNumber: user.activePack });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        order.status = 'cancelled';
        await order.save();

        const vendor = await Vendor.findById(order.vendor);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        vendor.canceledOrders += 1;
        await vendor.save();

        return res.status(200).json({ message: 'Order marked as cancelled' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
};

export const deleteOrder = async (req, res) => {
    try {
        const orderId = req.params.id;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const { status } = order;

        const vendor = await Vendor.findById(order.vendor);
        if (vendor) {
            if (status === 'completed') {
                vendor.completedOrders -= 1;
            } else if (status === 'cancelled') {
                vendor.canceledOrders -= 1;
            }
            await vendor.save();
        }

        const user = await User.findById(order.user);
        if (user) {
            if (status === 'completed' || status === 'cancelled') {
                user.activePack = Math.max(0, (user.activePack || 0) - 1);
                user.agency.activePack = Math.max(0, (user.agency.activePack || 0) - 1);
                await user.save();
            }
        }

        await User.findByIdAndUpdate(order.user, { $pull: { orders: orderId } });
        await Vendor.findByIdAndUpdate(order.vendor, { $pull: { orders: orderId } });
        await Order.findByIdAndDelete(orderId);

        return res.status(200).json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
};

export const getOrdersByUserId = async (req, res) => {
    try {
        const token = req.cookies.user;
        if (!token) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const decoded = jwt.decode(token, process.env.JWT_SECRET);
        const userId = decoded?.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const orders = await Order.find({ user: userId }).populate('vendor meals');

        if (orders.length === 0) {
            return res.status(404).json({ message: 'No orders found for this user' });
        }

        return res.status(200).json({ message: 'Orders retrieved successfully', orders });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
};
