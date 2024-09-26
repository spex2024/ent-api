import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
export const authAdmin = (req, res, next) => {
    const token = req.cookies.admin || req.headers.authorization?.split(' ')[1]; // Check if token is in cookies or in Authorization header

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        // Verify the token using JWT secret
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach decoded payload (e.g., user id) to request object
        next(); // Proceed to the next middleware/route
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};
