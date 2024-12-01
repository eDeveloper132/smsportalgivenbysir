import express from "express";
import "dotenv/config";
import cors from "cors";
import path from "path";
import bcrypt from "bcrypt";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { SignModel, SubaccountModel } from "./Schema/Post.js";
import MainRoute from "./Routes/Main.js";
import SMSRoute from "./Routes/SMS.js";
import connection from "./DB/db.js";
import PackageDetails from "./Routes/Package.js";
import sendVerificationEmail from "./emailService.js"; // Import the email service
import { lstat } from "fs";
import SessionModel from "./Schema/Session.js";
import cookieParser from "cookie-parser";
import axios from "axios";
import sendTemporaryCode from "./RecoverpassService.js";
const PORT = process.env.PORT || 3437;
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
await connection();
// mongoose.set('debug', true);
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const sessionMiddleware = async (req, res, next) => {
    // Define paths that should be excluded from session verification
    const excludedPaths = [
        "/signin",
        "/signup",
        "/verify-email",
        "/recoverpass",
        "/recaver",
        "/tempassauth",
    ];
    // If the request path is in the excluded paths, skip session check
    if (excludedPaths.includes(req.path.toLowerCase())) {
        return next();
    }
    try {
        // Get sessionId from cookies or headers
        const sessionId = req.cookies.sessionId || req.header("Authorization");
        if (!sessionId) {
            return res.status(401).redirect("/signin");
        }
        // Find the session in the database
        const session = await SessionModel.findOne({ sessionId });
        if (!session) {
            return res.status(401).redirect("/signin");
        }
        // Check if the session is expired
        if (new Date() > session.expiresAt) {
            await SessionModel.findByIdAndDelete(session._id); // Delete expired session
            return res.status(401).redirect("/signin");
        }
        // Attach session data to the request object (e.g., userId)
        res.locals.user = await SignModel.findById(session.userId); // Attach user to request
        // Proceed to the next middleware or route handler
        next();
    }
    catch (error) {
        console.error("Session verification error:", error);
        res.status(500).send("Internal Server Error");
    }
};
app.use(sessionMiddleware);
app.get("/signup", (req, res) => {
    res.sendFile(path.resolve(__dirname, "./Views/signup.html"));
});
app.post("/signup", async (req, res) => {
    const { UserName, Name, Email, Password, Role, Organization, PhoneNumber } = req.body;
    try {
        // Validate required fields
        if (!Name || !Email || !Password || !Role || !Organization || !PhoneNumber) {
            console.error("Error: Missing fields in request body.");
            return res.status(400).send("Error: Missing fields");
        }
        console.log(`Received signup request with the following details:`);
        console.log(`UserName: ${UserName}`);
        console.log(`Name: ${Name}`);
        console.log(`Email: ${Email}`);
        console.log(`Password: ${Password}`);
        console.log(`Role: ${Role}`);
        console.log(`Organization: ${Organization}`);
        console.log(`PhoneNumber: ${PhoneNumber}`);
        // Prepare ClickSend subaccount creation request
        const clickSendData = {
            api_username: UserName,
            password: Password,
            email: Email,
            phone_number: PhoneNumber,
            first_name: Name.split(" ")[0],
            last_name: Name.split(" ")[1] || "", // Assuming Name has first and last
        };
        console.log("Sending request to ClickSend to create a subaccount...");
        const clickSendResponse = await axios.post("https://rest.clicksend.com/v3/subaccounts", clickSendData, {
            auth: {
                username: "bluebirdintegrated@gmail.com",
                password: "EA26A5D0-7AAC-6631-478B-FC155CE94C99",
            },
        });
        console.log("Received response from ClickSend.");
        // Check ClickSend response
        if (clickSendResponse.data.response_code === "SUCCESS") {
            console.log("ClickSend subaccount created successfully:", clickSendResponse.data.data);
            const subaccount_id = clickSendResponse.data.data.subaccount_id;
            const api_key = clickSendResponse.data.data.api_key;
            console.log("API key:", api_key);
            console.log("Subaccount ID:", subaccount_id);
            // Save ClickSend subaccount details in SubaccountModel
            const newSubaccount = new SubaccountModel({
                subaccount_id: subaccount_id,
                username: clickSendResponse.data.data.api_username,
                email: Email,
                password: Password, // Ensure password is populated
                phonenumber: PhoneNumber, // Ensure phone number is populated
                first_name: clickSendResponse.data.data.first_name,
                last_name: clickSendResponse.data.data.last_name,
                api_key: api_key,
                userId: null, // To be updated after user creation
            });
            // Save the subaccount first
            await newSubaccount.save();
            console.log("Subaccount details saved successfully:", newSubaccount);
            // Hash the password for the user
            const hashedPassword = await bcrypt.hash(Password, 10);
            console.log("Password hashed successfully.");
            const token = uuidv4();
            console.log("Generated verification token:", token);
            const hashedToken = await bcrypt.hash(token, 10);
            console.log("Hashed verification token for storage.");
            // Save the user in SignModel
            const newUser = new SignModel({
                id: uuidv4(),
                Name,
                Email,
                Password: hashedPassword,
                PhoneNumber,
                Role,
                Organization,
                verificationToken: hashedToken,
                verificationTokenExpiry: new Date(Date.now() + 3600000),
                isVerified: false,
                subaccounts: [newSubaccount._id], // Link to the saved subaccount
            });
            const savedUser = await newUser.save();
            console.log("User saved successfully:", savedUser);
            // Update the saved subaccount with the userId reference
            newSubaccount.userId = savedUser._id; // Link the user ID
            await newSubaccount.save(); // Save the updated subaccount
            console.log("Subaccount updated with userId reference.");
            // Send verification email
            await sendVerificationEmail(Email, hashedToken);
            console.log("A verification link has been sent to the user's email.");
            res.redirect("/");
        }
        else {
            // Log the complete response for debugging
            console.error("Failed to create ClickSend subaccount:", clickSendResponse.data.response_msg);
            console.error("ClickSend Response:", clickSendResponse.data); // Log full response for analysis
            res.status(400).send("Error: Failed to create ClickSend subaccount");
        }
    }
    catch (error) {
        console.error("Error during signup:", error.response ? error.response.data : error.message);
        res.status(500).send("Internal Server Error");
    }
});
app.get("/signin", (req, res) => {
    res.sendFile(path.resolve(__dirname, "./Views/signin.html"));
});
app.post("/signin", async (req, res) => {
    const { Email, Password } = req.body;
    try {
        if (!Email || !Password) {
            return res.status(400).send("Error: Missing fields");
        }
        const user = await SignModel.findOne({ Email });
        if (!user) {
            return res.status(401).send("Error: Invalid email or password");
        }
        const isMatch = await bcrypt.compare(Password, user.Password);
        if (!isMatch) {
            return res.status(401).send("Error: Invalid password");
        }
        // if (!user.isVerified) {
        //   return res.status(401).send("You are not verified");
        // }
        const sessionId = uuidv4();
        const session = new SessionModel({
            userId: user._id,
            sessionId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000), // 1 hour
        });
        await session.save();
        res.cookie("sessionId", sessionId, { httpOnly: true, secure: true });
        res.redirect("/");
    }
    catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal Server Error");
    }
});
app.post("/reset-Session", async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        await SessionModel.findOneAndDelete({ sessionId });
        res.clearCookie("sessionId");
    }
    res.status(200).send("Session reset");
});
// Example of using req.user in protected routes
app.post("/user", async (req, res) => {
    if (!res.locals.user) {
        return res.status(401).send("Unauthorized");
    }
    const user = res.locals.user;
    const subaccount = await SubaccountModel.findOne({ userId: user._id });
    const subaccountApikey = subaccount?.api_key;
    const subaccountPassword = subaccount?.password;
    const subaccountId = subaccount?._id;
    const subaccountUserName = subaccount?.username;
    const data = {
        id: user._id,
        Name: user.Name,
        Email: user.Email,
        Organization: user.Organization,
        PhoneNumber: user.PhoneNumber,
        PackageName: user.Details?.PackageName,
        Coins: user.Details?.Coins,
        isVerified: user.isVerified,
        messages: user.messages,
        subaccountId: subaccountId,
        subaccountPassword: subaccountPassword,
        subaccountUserName: subaccountUserName,
        subaccountApikey: subaccountApikey
    };
    res.send(data);
});
app.use("/", MainRoute);
app.use("/sms", SMSRoute);
app.use("/buypackage", PackageDetails);
const arrey = [];
app.post("/recoverpass", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await SignModel.findOne({ Email: email });
        if (!user) {
            console.log("User not found");
            return res.status(401).send("Invalid email address. Please try again.");
        }
        const Id = user._id;
        function generateTemporaryPassword(length = 10) {
            const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            let password = "";
            for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * characters.length);
                password += characters[randomIndex];
            }
            return password;
        }
        // Example usage
        const temporaryPassword = generateTemporaryPassword(12);
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        arrey.push(hashedPassword);
        const updatedUser = await SignModel.findByIdAndUpdate(Id, {
            $set: {
                Password: arrey[0],
            },
        }, { new: true, runValidators: true });
        updatedUser?.save();
        await sendTemporaryCode(email, temporaryPassword);
        if (!updatedUser) {
            return res
                .status(500)
                .send("Failed to update the password. Please try again.");
        }
        console.log(`Temporary password for ${email}: ${hashedPassword}`);
        res.send({
            message: `A verification link has been sent to your email. Please copy and save the temporary password provided password: ${temporaryPassword}.`,
        });
    }
    catch (error) {
        console.error("Error in /recoverpass:", error);
        res
            .status(500)
            .send("An internal server error occurred. Please try again later.");
    }
});
app.post("/tempassauth", async (req, res) => {
    const { email, tempPassword } = req.body;
    try {
        if (!email || !tempPassword) {
            return res.status(400).send("Error: Missing fields");
        }
        const user = await SignModel.findOne({ Email: email });
        if (!user) {
            return res.status(401).send("Error: Invalid email or password");
        }
        const isMatch = await bcrypt.compare(tempPassword, user.Password);
        if (!isMatch) {
            return res.status(401).send("Error: Invalid password");
        }
        if (!user.isVerified) {
            return res.status(403).send("Error: Account not verified. Please verify.");
        }
        const sessionId = uuidv4();
        const session = new SessionModel({
            userId: user._id,
            sessionId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000), // 1 hour
        });
        await session.save();
        res.cookie("sessionId", sessionId, { httpOnly: true, secure: true });
        res.redirect("/");
    }
    catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal Server Error");
    }
});
app.get("/verify-email", async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).send(`
      <html>
        <body>
          <h1>Verification token is required.</h1>
        </body>
      </html>
    `);
    }
    try {
        // Find the user with the matching verification token and check if it's still valid
        const user = await SignModel.findOne({
            verificationToken: token,
            verificationTokenExpiry: { $gt: Date.now() },
        });
        if (!user) {
            return res.status(400).send(`
        <html>
          <body>
            <h1>Invalid or expired token.</h1>
          </body>
        </html>
      `);
        }
        // Mark the user as verified
        user.isVerified = true;
        user.verificationToken = "";
        // Clear the token expiry
        await user.save();
        // Send the success message with a redirect after 3 seconds
        res.send(`
      <html>
        <head>
          <meta http-equiv="refresh" content="3;url=https://smsportalgivenbysir.vercel.app" />
        </head>
        <body>
          <h1>Email verified successfully!</h1>
          <p>You will be redirected shortly...</p>
        </body>
      </html>
    `);
    }
    catch (error) {
        console.error("Error verifying email:", error);
        res.status(500).send(`
      <html>
        <body>
          <h1>Server error. Please try again later.</h1>
        </body>
      </html>
    `);
    }
});
app.post("/resend-verification", async (req, res) => {
    console.log(res.locals);
    const usero = res.locals.user;
    console.log(`Usero:${usero}`);
    const email = usero.Email;
    console.log(`Email: ${email}`);
    try {
        const user = await SignModel.findOne({ Email: email });
        if (!user) {
            return res.status(404).send("Error: User not found");
        }
        if (user.isVerified) {
            return res.status(400).send("Error: Email is already verified");
        }
        const token = uuidv4(); // Use UUID or any unique token generator
        const hashed = await bcrypt.hash(token, 10);
        const verificationToken = hashed;
        (user.verificationToken = hashed),
            (user.verificationTokenExpiry = new Date(Date.now() + 3600000));
        user.save();
        await sendVerificationEmail(email, verificationToken);
        res.status(200).send("Verification email sent");
    }
    catch (error) {
        console.error("Error resending verification email:", error.message);
        res.status(500).send("Internal Server Error");
    }
});
app.use("*", (req, res) => {
    res.status(404).sendFile(path.resolve(__dirname, "./Views/page-404.html"));
});
lstat;
export default app;
