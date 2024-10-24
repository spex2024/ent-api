import checkAgencySubscriptions from "../helper/check-installment.js";


export const checkPaymentPlan = async (req , res) => {

    try{
    await checkAgencySubscriptions()
     return res.status(200).json({message:"Checking Installment Payment "})

    }
    catch(err){
        console.log(err);
        return res.status(500).json({ error: err.message });
    }
}