// utils/generateInvoiceNumber.js
const generateInvoiceNumber = () => {
    const randomNumber = Math.floor(Math.random() * 1000000); // Generate a random number between 0 and 999999
    const invoiceNumber = `INV-${randomNumber.toString().padStart(6, '0')}`; // Prefix with 'INV-' and pad with zeros
    return invoiceNumber;
};

export default generateInvoiceNumber;
