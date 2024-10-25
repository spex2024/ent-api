import checkAgencySubscriptions from "../helper/check-installment.js";
import {checkInstallment} from "../helper/update-status.js";


export const checkPaymentPlan = async (req , res) => {

    try{
    await checkInstallment()
     return res.status(200).json({message:"Checking Installment Payment "})

    }
    catch(err){
        console.log(err);
        return res.status(500).json({ error: err.message });
    }
}