import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
// import { user } from "~encore/clients";

export const getToken = api({
    expose:true,
    auth:true,
    method:"GET",
    path:"/testAuth/getPID"
}, async ():Promise<{pid:string}> => {
    const userData=getAuthData()!;
    console.log(userData.userID);
    
    return {
        pid:`${userData.userID}`
    }
})