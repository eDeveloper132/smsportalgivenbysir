import express from "express";
import "dotenv/config";
import { fileURLToPath } from "url";
import path from "path";
import axios from "axios";
import { MessageModel } from "../Schema/Post.js";
import { v4 as uuidv4 } from "uuid";
import { SignModel } from "../Schema/Post.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();
// Route to serve the HTML file
router.get("/", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../Views/sms.html"));
});
// POST route to handle SMS sending
router.post("/", async (req, res) => {
    const { phonecode, phonenumber, message } = req.body;
    // Check for missing required fields
    if (!phonecode || !phonenumber || !message) {
        console.log("Server Error 400: Missing required fields"); // Log the error
        return res.status(400).json({
            error: "Please fill in all the required fields: phone code, phone number, and message.",
        });
    }
    const user = res.locals.user;
    if (!user) {
        console.log("Server Error 404: User not found"); // Log if user not found
        return res.status(404).send("User not found.");
    }
    const packageName = user?.Details?.PackageName;
    const coins = user?.Details?.Coins;
    // Check for incomplete user package details
    if (!packageName || !coins) {
        console.log("Server Error 403: User package details are incomplete."); // Log the error
        return res
            .status(403)
            .json({ error: "You cannot send SMS. Please buy our package first." });
    }
    const mix = `${phonecode}${phonenumber}`;
    console.log(`We are delivering this message: "${message}" to ${mix}`); // Log the message and recipient
    try {
        // Prepare SMS message for ClickSend API
        const smsMessage = {
            to: mix,
            body: message,
        };
        const apiUrl = "https://rest.clicksend.com/v3/sms/send";
        console.log(`Sending SMS to ClickSend API at: ${apiUrl}`); // Log the API URL
        const response = await axios.post(apiUrl, {
            messages: [smsMessage],
        }, {
            auth: {
                username: "bluebirdintegrated@gmail.com",
                password: "EA26A5D0-7AAC-6631-478B-FC155CE94C99",
            },
        });
        console.log('Response from ClickSend:', response.data); // Log the response from ClickSend API
        const userData = user;
        const userId = userData._id;
        const dbUser = await SignModel.findById(userId);
        // Check if user exists in database
        if (!dbUser) {
            console.log("Server Error 404: User not found in database"); // Log if user not found in DB
            return res.status(404).send("User not found");
        }
        if (!dbUser.Details) {
            console.log("Server Error 400: User details not found"); // Log if user details not found
            return res.status(400).send("User details not found");
        }
        // Deduct one coin from the user's balance
        let coins = dbUser.Details.Coins;
        if (typeof coins === "number") {
            coins -= 1;
            console.log(`User coins after deduction: ${coins}`); // Log the remaining coins
            if (coins < 0) {
                console.log("Server Error 400: Insufficient coins for sending message"); // Log insufficient coins
                return res.status(400).send("Insufficient coins for sending message");
            }
            dbUser.Details.Coins = coins;
        }
        // Create a new message entry in the database
        const newMessage = await MessageModel.create({
            id: uuidv4(),
            u_id: dbUser._id,
            from: "NOT PROVIDED",
            to: mix,
            message: message,
            m_count: response.data.data.total_count,
            m_schedule: "NOT PROVIDED",
            status: response.data.response_code,
        });
        // Cast newMessage._id to ObjectId
        const messageId = newMessage._id;
        // Add the message to the user's messages array and save the user
        dbUser.messages.push(messageId);
        await dbUser.save();
        console.log("Data Updated Successfully:", dbUser); // Log the updated user data
        console.log("Data Added Successfully:", newMessage); // Log the new message data
        // Respond with success
        res.status(200).json({ message: "Message sent successfully!" });
    }
    catch (err) {
        console.error('Error occurred during SMS sending:', err.response ? err.response.data : err.message); // Log detailed error
        res.status(500).json({ error: "Failed to send SMS. Please try again later." });
    }
});
router.get("/messages", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../Views/messageslist.html"));
});
// API endpoint to fetch messages
router.get("/api/messages", async (req, res) => {
    try {
        // Extract the user from the response's local variables (set during authentication)
        const useri = res.locals.user;
        // If user is not found in the local variables, send a 404 error
        if (!useri) {
            console.warn("User not found in res.locals.");
            return res.status(404).send("User not found.");
        }
        console.log("Authenticated User:", useri); // Log the authenticated user for debugging
        // Extract the user ID from the authenticated user object
        const userId = useri._id;
        // If the user ID is not found, send a 401 Unauthorized response
        if (!userId) {
            console.warn("User ID not found.");
            return res.status(401).json({ message: "Unauthorized" });
        }
        // Fetch the user by their ID, and populate their messages
        // `populate()` is used to replace the 'messages' field with actual message data from the 'MessageHandler' model
        const user = await SignModel.findById(userId).populate("messages", null, 'MessageModel').exec();
        // If no user is found with the given ID, send a 404 error
        if (!user) {
            console.warn(`User with ID ${userId} not found.`);
            return res.status(404).json({ message: "User not found" });
        }
        console.log("User Data with Populated Messages:", user); // Log user data with populated messages for debugging
        // If the user has no messages or the 'messages' array is empty, return an empty array with a 200 status
        if (!user.messages || user.messages.length === 0) {
            console.info("No messages found for this user.");
            return res.status(200).json({ messages: [] });
        }
        // Send the user's messages as a successful JSON response
        res.status(200).json({ messages: user.messages });
    }
    catch (error) {
        // Catch any errors that occur during the process, log the error, and return a 500 status with an error message
        console.error("Error fetching messages:", error.message, error.stack);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});
export default router;
