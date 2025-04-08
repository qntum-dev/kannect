import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import nodemailer from "nodemailer";
const user = secret("USER_MAIL")
const app_password = secret("APP_PASSWORD")
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for port 465, false for other ports
    auth: {
        user: user(),
        pass: app_password(),
    },
});

interface mailStructure {
    mail_addr: string
    subject: string
    mail_body: string
    html?:string
}

export const send = api({
    auth:false
}, async ({mail_addr,mail_body,subject,html}:mailStructure) => {
    const info = await transporter.sendMail({
        from: {
            name: "Kannect",
            address: user()
        }, // sender address
        to: [mail_addr], // list of receivers
        subject, // Subject line
        text: mail_body, // plain text body
        // html: "<b>Hello world?</b>", // html body
    });

    console.log("Email sent: %s", info.messageId);
})