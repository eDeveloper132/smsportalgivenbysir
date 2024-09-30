import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import axios from "axios";
import { SignModel , ListModel } from "../Schema/Post.js";
import { ContactListApi , ContactList } from "clicksend";
import { AppRes } from "../index.js";
import "dotenv/config";

// Resolve file and directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const findAndUpdateUserById = async (id: string, updateData: any) => {
  try {
    // Find the user by id
    const responseFind = await axios.post(
      "https://ap-southeast-1.aws.data.mongodb-api.com/app/data-mdipydh/endpoint/data/v1/action/findOne",
      {
        collection: "signhandlers", // Replace with your actual collection name
        database: "test", // Replace with your actual database name
        dataSource: "SMSCluster", // Replace with your actual data source name
        filter: { _id: { $oid: id } }, // Filter to find the user by id
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.MongoDB_API_KEY, // Ensure this is set in your environment variables
        },
      }
    );

    // Check if the user exists
    const user = responseFind.data.document;
    if (!user) {
      return { error: "User not found." };
    }

    // Update the user with the new data
    const responseUpdate = await axios.post(
      "https://ap-southeast-1.aws.data.mongodb-api.com/app/data-mdipydh/endpoint/data/v1/action/updateOne",
      {
        collection: "signhandlers", // Replace with your actual collection name
        database: "test", // Replace with your actual database name
        dataSource: "SMSCluster", // Replace with your actual data source name
        filter: { _id: { $oid: id } }, // Filter to find the user by id
        update: {
          $set: updateData, // Update with the new data
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.MongoDB_API_KEY, // Ensure this is set in your environment variables
        },
      }
    );

    return responseUpdate.data; // Return the result of the update operation
  } catch (error: any) {
    console.error(
      "Error finding and updating user by id:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Failed to find and update user by id.");
  }
};
// Route to serve the HTML page
router.get("/", (req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, "../Views/index.html"));
});

router.get("/list", (req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, "../Views/list.html"));
});

router.post("/list", async (req: Request, res: AppRes) => {
  try {
    const { listName, contacts } = req.body;
    const userId = res.locals.user?._id;

    // Validate request body
    if (!listName || !userId || !contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Retrieve API credentials from environment variables
    const username = process.env.USERNAME;
    const apiKey = process.env.API_KEY;

    if (!username || !apiKey) {
      throw new Error("API credentials are missing.");
    }

    // Create a new contact list using the ClickSend API
    const contactListApi = new ContactListApi(username, apiKey);
    const contactList = new ContactList();
    contactList.listName = listName;

    // Send the request to create a new list
    const apiResponse = await contactListApi.listsPost(contactList);
    const parsedBody = typeof apiResponse.body === 'string' ? JSON.parse(apiResponse.body) : apiResponse.body;

    // Check if the response from the ClickSend API is valid and contains the expected data
    if (!parsedBody || parsedBody.http_code !== 200 || !parsedBody.data) {
      throw new Error(parsedBody.response_msg || "Failed to create list on external API");
    }

    // Extract list information from the response
    const { list_id, list_name } = parsedBody.data;

    // Save the new list to your database
    const newList = new ListModel({
      listName: list_name, // Use the name returned from the external API if needed
      createdBy: userId,
      contacts, // Array of contacts
    });

    await newList.save();

    // Associate the newly created list with the user in SignModel
    await SignModel.findByIdAndUpdate(userId, {
      $push: { lists: newList._id },
    });

    // Respond with success, including the external API response and the new list details
    res.status(200).json({
      message: "List created successfully",
      externalApiResponse: parsedBody,
      list: newList,
    });
  } catch (err: any) {
    // Error handling for unexpected issues during the process
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});


router.get("/changepass", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../Views/changePass.html"));
});

router.post("/changepass", async (req: Request, res: AppRes) => {
  const { current_password, new_password, confirm_password } = req.body;

  if (!current_password || !new_password || !confirm_password) {
    return res.status(400).send("All fields are required.");
  }

  // Fetch user details from FetchUserDetails
  const user = res.locals.user; // Modify as needed
  if (!user) {
    return res.status(404).send("User not found.");
  }

  try {
    // Verify current password
    const match = await bcrypt.compare(current_password, user.Password!);
    if (!match) {
      return res.status(400).send("Current password is incorrect.");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);
    const updated_data = {
      Password: hashedPassword,
    };

    // Update user password
    await findAndUpdateUserById(user._id as string, updated_data);

    res.send("Password changed successfully.");
  } catch (error: any) {
    console.error("Error changing password:", error);
    res
      .status(500)
      .send({ error: "Error changing password: " + error.message });
  }
});

export default router;
