// emailService.js
import transporter from './emailconfig.js';
async function sendTemporaryCode(Email, temporaryPassword) {
    if (!Email) {
        console.error("No recipient email defined");
        return;
    }
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: Email, // Ensure this is correctly defined
        subject: 'Verify Your Email',
        text: `To access your account your temporary accessable password is ${temporaryPassword}`,
        html: `<p>Your Temporary Code Is : ${temporaryPassword}</p>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log("Verification email sent successfully");
    }
    catch (error) {
        console.error("Failed to send verification email:", error);
    }
}
export default sendTemporaryCode;
