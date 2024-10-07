import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import axios from "axios";
import { SignModel , ListModel , IList , IContact , MessageModel , FileUrlModel , PhotoUrlModel , VerifiedNumberModel , AlphaTagModel } from "../Schema/Post.js";
import { ContactListApi , ContactList , ContactApi , Contact} from "clicksend";
import SessionModel from '../Schema/Session.js'
import {v4 as uuidv4} from 'uuid';
import { AppRes } from "../index.js";
import multer,{ FileFilterCallback } from 'multer';
import XLSX from 'xlsx';
import fs from 'fs';
import csvParser from 'csv-parser';
import mongoose from 'mongoose'
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

router.get("/alllists", (req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, "../Views/alllists.html"));
});

router.post("/list", async (req: Request, res: Response) => {
  console.log(req.body); // Log the request body
  const { listName } = req.body; // Get the list name from the request body

  const user = res.locals.user; // Modify as needed
  const userId = user._id;

  console.log(userId);

  // Create an instance of the ContactListApi
  const contactListApi = new ContactListApi(`bluebirdintegrated@gmail.com`, `EA26A5D0-7AAC-6631-478B-FC155CE94C99`);

  // Create a new ContactList object
  const contactList = new ContactList();
  contactList.listName = listName; // Set the list name

  try {
      // Call the API to create the contact list
      const response = await contactListApi.listsPost(contactList);
      
      // Ensure that the response body is treated as a JSON object, not as a string
      const responseBody = response.body as any; // Use appropriate type or `any` if not known

      console.log('ClickSend API Response:', responseBody); // Log the response

      // Check if the response contains the expected data
      if (responseBody && responseBody.data && responseBody.data.list_id) {
          // Create a new List document
          const newList = new ListModel({
              listName: listName,
              createdBy: userId, // Ensure you pass the correct user ID
              listId: responseBody.data.list_id, // Use responseBody.data.list_id
              contacts: [] // Initialize contacts as an empty array or with actual contacts if needed
          });

          await newList.save(); // Save the new list to the database
          console.log('List saved to database:', newList);
          return res.status(200).json({ success: true, message: 'Contact list created and saved successfully!', data: responseBody });
      } else {
          return res.status(400).json({ success: false, message: 'Failed to create contact list in ClickSend.' });
      }
  } catch (err: any) {
      console.error('Error creating contact list:', err.message || err.body);
      res.status(500).json({ success: false, message: 'Failed to create contact list: ' + (err.message || 'Internal Server Error') });
  }
});

const upload1 = multer({ dest: 'uploads/' });

// Function to send contacts to ClickSend
const sendContactsToClickSend = async (listId: any, fileUrl: string) => {
    const url = `https://rest.clicksend.com/v3/lists/${listId}/import`;

    // Adjust fieldOrder to match your actual data
    const fieldOrder = ['phone', 'first_name', 'last_name', 'email'];

    // Prepare the request body
    const fileData = {
        file_url: fileUrl, // Send file URL instead of contacts
        field_order: fieldOrder, // Specify the order of fields
    };
    console.log('File data being sent:', fileData);

    try {
        // Sending the POST request to ClickSend
        const response = await axios.post(url, fileData, {
            headers: {
                'Content-Type': 'application/json', // Ensure Content-Type is JSON
                'Authorization': 'Basic ' + Buffer.from('bluebirdintegrated@gmail.com:EA26A5D0-7AAC-6631-478B-FC155CE94C99').toString('base64'), // Your credentials
            },
        });

        console.log('Contacts successfully imported to ClickSend:', response.data);
        return response.data;

    } catch (error: any) {
        console.error('Error importing contacts to ClickSend:', error.response?.data || error.message);
        throw new Error('Failed to import contacts to ClickSend.');
    }
};

// Route for importing contacts
// Route for importing contacts
router.post('/importContacts', upload1.single('file'), async (req: Request, res: Response) => {
  const { listId } = req.body;
  const user = res.locals.user;
  const userId = user._id; // Assuming this gets the authenticated user's ID
  const file = req.file;

  if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
  }

  const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
  if (!fileExtension || fileExtension !== 'csv') {
      return res.status(400).json({ error: 'Invalid file type. Please upload a .csv file.' });
  }

  try {
      // Read the content of the uploaded file
      fs.readFile(file.path, 'utf8', async (err, data) => {
          if (err) {
              console.error('Error reading file:', err);
              return res.status(500).json({ error: 'Error reading the file.' });
          }

          console.log('File content:', data); // Log the content of the file

          // Parse the CSV data
          const lines = data.split('\n').filter(line => line.trim() !== ''); // Split by line and filter out empty lines
          const contacts: IContact[] = lines.slice(1).map(line => { // Skip the header line
              const [phone, first_name, last_name, email] = line.split(',').map(item => item.trim());
              return { 
                  firstName: first_name,
                  lastName: last_name,
                  email,
                  mix: phone, // Assuming phone is used as 'mix' based on the previous discussions
                  contactid: 0 // Generate a random contact ID or handle it accordingly
              };
          });

          // Find the corresponding ListModel and update contacts
          const list = await ListModel.findOne({ listId: listId });
          if (!list) {
              return res.status(404).json({ error: 'List not found' });
          }

          // Log the existing contacts before updating
          console.log('Existing contacts before update:', list.contacts);

          // Add new contacts to the existing contacts array
          list.contacts.push(...contacts); // Assuming contacts is an array in your ListModel

          // Attempt to save the updated list
          try {
              await list.save();
              console.log('Updated contacts:', list.contacts); // Log updated contacts
          } catch (saveError) {
              console.error('Error saving contacts:', saveError);
              return res.status(500).json({ error: 'Failed to save contacts to the list.' });
          }

          // Create the file URL
          const fileUrl = `https://c1ea-203-101-187-89.ngrok-free.app/${file.path.replace(/\\/g, '/')}`;

          // Save the file URL in the FileUrlModel
          const fileUrlEntry = new FileUrlModel({
              userId: userId, // Use the user ID from the request context
              listId: listId, // Use the listId provided in the request
              fileUrl: fileUrl // The URL of the uploaded file
          });

          try {
              await fileUrlEntry.save();
              console.log('File URL saved successfully:', fileUrlEntry);
          } catch (saveError) {
              console.error('Error saving file URL:', saveError);
              return res.status(500).json({ error: 'Failed to save file URL.' });
          }

          // Send contacts to ClickSend
          await sendContactsToClickSend(listId, fileUrl); // Call the function to send contacts

          res.status(200).json({ message: 'Contacts imported successfully', contacts });
      });
  } catch (error) {
      console.error('Error processing file:', error);
      return res.status(500).json({ error: 'Error processing the file.' });
  }
});

router.get('/api/credentials', (req:Request, res:Response) => {
  res.json({
      username: process.env.USERNAME,
      apiKey: process.env.API_KEY
  });
});

router.post("/getlist", async (req: Request, res: Response) => {
  const user = res.locals.user; // Modify as needed
  const userId = user._id;

  // Create an instance of the ContactListApi
  const contactListApi = new ContactListApi(`bluebirdintegrated@gmail.com`, `EA26A5D0-7AAC-6631-478B-FC155CE94C99`);

  try {
      // Fetch lists from ClickSend
      const page = 1; // Page number
      const limit = 10; // Limit of results per page
      const clickSendResponse = await contactListApi.listsGet(page, limit);
      const clickSendLists = clickSendResponse.body; // Extract lists from ClickSend response
      console.log(clickSendLists);
      

      
      // Optionally, fetch user-specific lists from your database
      const userLists = await ListModel.find({ createdBy: userId });
      console.log(userLists);
      

      // Combine both lists if necessary, or send them separately
      res.json({ clickSendLists, userLists });
  } catch (error: any) {
      console.error('Error fetching lists:', error.body || error.message);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/listview', async (req: Request, res: Response) => {
  const { listId } = req.body;
  console.log(listId);
  
  if (!listId) {
    console.error('No listId provided.');
    return res.status(400).send({ error: true, message: 'Invalid Request: listId is missing.' });
  }

  try {
    // Check if the list exists in the local database
    const list = await ListModel.findOne({ listId: listId });
    if (!list) {
      console.log('List not found in database.');
      return res.status(404).send({ error: true, message: 'List not found in the database.' });
    }
    
    console.log(list.contacts); // This will log the contacts array to the console

    // If the list exists, return the list and its contacts
    return res.status(200).send({ success: true, list });

  } catch (error: any) {
    console.error('Error occurred during fetching the list:', error.message);
    return res.status(500).send({ error: true, message: 'Server error occurred during fetching the list.' });
  }
});



router.put('/listupdate', async (req: Request, res: Response) => {
  const { listId , newListName } = req.body;

  if (!listId && !newListName) {
    console.log('Server Error 400: Missing listId');
    return res.status(400).json({ error: 'Missing listId' });
  }

  try {
    // Step 1: Check and update the list in MongoDB
    const updatedList = await ListModel.findOneAndUpdate(
      { listId: listId },
      { listName: newListName }, // Update the name in your MongoDB schema
      { new: true }
    );

    if (!updatedList) {
      console.log('List not found in database, checking ClickSend.');

      // Step 2: Update the list in ClickSend if not found in MongoDB
      const clickSendResponse = await axios.put(
        `https://rest.clicksend.com/v3/lists/${listId}`,
        {
          list_name: newListName, // Send the new list name to ClickSend
        },
        {
          auth: {
            username: 'bluebirdintegrated@gmail.com', // Your ClickSend credentials
            password: 'EA26A5D0-7AAC-6631-478B-FC155CE94C99', // Your ClickSend API key
          },
        }
      );

      if (clickSendResponse.status === 200) {
        console.log('List successfully updated in ClickSend.');
        return res.status(200).send({ success: true, message: 'List updated successfully in ClickSend.' });
      } else {
        console.error(`ClickSend update failed: ${clickSendResponse.statusText}`);
        return res.status(500).send({ error: true, message: 'Failed to update list in ClickSend.' });
      }
    }

    // If the list was updated in MongoDB, also update it in ClickSend
    const clickSendResponse = await axios.put(
      `https://rest.clicksend.com/v3/lists/${listId}`,
      {
        list_name: newListName, // Update the list name on ClickSend
      },
      {
        auth: {
          username: 'bluebirdintegrated@gmail.com', // Your ClickSend credentials
          password: 'EA26A5D0-7AAC-6631-478B-FC155CE94C99', // Your ClickSend API key
        },
      }
    );

    if (clickSendResponse.status === 200) {
      console.log('List successfully updated in both MongoDB and ClickSend.');
      return res.status(200).send({ success: true, message: 'List updated successfully in both MongoDB and ClickSend.' });
    } else {
      console.error(`ClickSend update failed: ${clickSendResponse.statusText}`);
      return res.status(500).send({ error: true, message: 'Failed to update list in ClickSend.' });
    }
  } catch (error: any) {
    console.error('Error occurred during the update process:', error.message);
    return res.status(500).send({ error: true, message: 'Server error occurred during the update process.' });
  }
});


router.delete('/listdel', async (req: Request, res: Response) => {
  const listId = req.body.listId;

  if (!listId) {
    console.error('No listId provided.');
    return res.status(400).send({ error: true, message: 'Invalid Request: listId is missing.' });
  }

  try {
    // Check if the list exists in the local database
    const list = await ListModel.findOne({ listId });
    if (!list) {
      console.log('List not found in database, checking ClickSend.');

      // Attempt to delete from ClickSend if it's not in the database
      const response = await axios.delete(`https://rest.clicksend.com/v3/lists/${listId}`, {
        auth: {
          username: 'bluebirdintegrated@gmail.com',
          password: 'EA26A5D0-7AAC-6631-478B-FC155CE94C99',
        },
      });

      if (response.status === 200) {
        console.log('List successfully deleted from ClickSend.');
        return res.status(200).send({ success: true, message: 'List deleted successfully from ClickSend.' });
      } else {
        console.error(`ClickSend deletion failed: ${response.statusText}`);
        return res.status(500).send({ error: true, message: 'Failed to delete list from ClickSend.' });
      }
    }

    // If the list exists, attempt deletion from both ClickSend and local database
    const response = await axios.delete(`https://rest.clicksend.com/v3/lists/${listId}`, {
      auth: {
        username: 'bluebirdintegrated@gmail.com',
        password: 'EA26A5D0-7AAC-6631-478B-FC155CE94C99',
      },
    });

    if (response.status === 200) {
      console.log('List successfully deleted from ClickSend.');

      // Delete from local database
      const deleteResult = await ListModel.findOneAndDelete({ listId });
      if (deleteResult) {
        console.log('List deleted from local database.');
        return res.status(200).send({ success: true, message: 'List deleted successfully from both ClickSend and database.' });
      } else {
        console.error('Failed to delete list from MongoDB.');
        return res.status(500).send({ error: true, message: 'Failed to delete list from MongoDB.' });
      }
    } else {
      console.error(`ClickSend deletion failed: ${response.statusText}`);
      return res.status(500).send({ error: true, message: 'Failed to delete list from ClickSend.' });
    }
  } catch (error: any) {
    console.error('Error occurred during deletion:', error.message);
    return res.status(500).send({ error: true, message: 'Server error occurred during the deletion process.' });
  }
});


router.post("/addcontact", async (req: Request, res: Response) => {
  const user = res.locals.user;
  const userId = user._id;

  console.log('Request Body:', req.body);

  const { firstName, lastName, email, phone, code, userid } = req.body;
  const formattedPhone = `${code}${phone}`;  // E.164 formatted phone number
  console.log('Formatted Phone Number:', formattedPhone);
  console.log('List ID:', userid);

  try {
    const username = 'bluebirdintegrated@gmail.com';
    const apiKey = 'EA26A5D0-7AAC-6631-478B-FC155CE94C99';

    const contactData = {
      first_name: firstName || '',  // Optional
      last_name: lastName || '',     // Optional
      email: email || '',
      phone_number: `${code}${phone}`
    };

    console.log('ClickSend Request Body:', JSON.stringify(contactData, null, 2));

    const clickSendUrl = `https://rest.clicksend.com/v3/lists/${userid}/contacts`;

    const clickSendResponse = await axios.post(clickSendUrl, contactData, {
      auth: {
        username: username,
        password: apiKey,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('ClickSend API Response:', clickSendResponse.data);

    if (clickSendResponse.data.response_code === 'SUCCESS') {
      const contactObject = {
        firstName,
        lastName,
        email,
        mix: formattedPhone,
        contactid: clickSendResponse.data.data.contact_id
      };
      console.log('Contact Object to be added to MongoDB:', contactObject);

      const list = await ListModel.findOne({ listId: userid });
      if (!list) {
        return res.status(404).json({ success: false, message: 'List not found.' });
      }

      const existingContactIndex = list.contacts.findIndex(contact => contact.email === email);
      
      if (existingContactIndex !== -1) {
        list.contacts[existingContactIndex] = {
          ...list.contacts[existingContactIndex],
          ...contactObject
        };
      } else {
        list.contacts.push(contactObject);
      }

      await list.save();
      console.log('Contact added to MongoDB list');

      return res.status(200).json({
        success: true,
        message: 'Contact added successfully to MongoDB and ClickSend!',
        clickSendData: clickSendResponse.data,
      });
    } else {
      console.error('ClickSend failed:', clickSendResponse.data);
      return res.status(400).json({ success: false, message: 'Failed to add contact to ClickSend.', error: clickSendResponse.data });
    }
  } catch (clickSendError:any) {
    console.error('ClickSend API Error:', clickSendError.response?.data || clickSendError.message);
    return res.status(500).json({ success: false, message: 'Failed to add contact to ClickSend.', error: clickSendError });
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

router.get('/bulksms',(req: Request , res: Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/bulksms.html'));
})

router.get('/purchaseno',(req:Request , res:Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/purchasenumber.html'))
})

interface SmsMessage {
  to: string;
  status: string;
}

router.post('/bulksms', async (req: Request, res: Response) => {
  const { listId, message } = req.body;
  console.log('Request body:', req.body);

  if (!message) {
    console.log('Server Error 400: Missing required fields');
    return res.status(400).json({ error: 'Please provide a message to send.' });
  }

  const user = res.locals.user;
  const userId = user._id;
  const packageName = user?.Details?.PackageName;
  const coins = user?.Details?.Coins;

  console.log(`User ID: ${userId}, Package Name: ${packageName}, Coins Available: ${coins}`);

  if (!packageName || typeof coins !== 'number') {
    console.log('Server Error 403: User package details are incomplete.');
    return res.status(403).json({ error: 'You cannot send SMS. Please buy our package first.' });
  }

  const listNumbers = await ListModel.findOne({ listId: listId });

  // Ensure listNumbers is found and contacts are available
  if (!listNumbers || !listNumbers.contacts || listNumbers.contacts.length === 0) {
    console.log('Server Error 400: No phone numbers found');
    return res.status(400).json({ error: 'No phone numbers available to send the message.' });
  }

  const phoneNumbers = listNumbers.contacts.map(contact => contact.mix); // Assuming mix contains the phone numbers

  console.log('Phone Numbers Retrieved:', phoneNumbers);

  if (coins < phoneNumbers.length) {
    return res.status(400).send('Insufficient coins for sending all messages');
  }

  try {
    const dbUser = await SignModel.findById(userId);

    if (!dbUser) {
      return res.status(404).send('User not found');
    }

    if (!dbUser.Details || typeof dbUser.Details.Coins !== 'number') {
      console.log('User details or coins are missing or invalid:', dbUser.Details);
      return res.status(400).send('User details not found or coins are not valid');
    }

    // Set up the message for ClickSend
    const messages = phoneNumbers.map(phoneNumber => ({
      to: phoneNumber,
      body: message
    }));

    const apiUrl = "https://rest.clicksend.com/v3/sms/send";
    const response = await axios.post(
      apiUrl,
      { messages },
      {
        auth: {
          username: "bluebirdintegrated@gmail.com",
          password: "EA26A5D0-7AAC-6631-478B-FC155CE94C99"
        }
      }
    );

    console.log('Response from ClickSend:', response.data);

    const messagesDetails = response.data.data.messages;
    messagesDetails.forEach((msg: SmsMessage, index: number) => {
      console.log(`Message ${index + 1}:`, msg);
    });

    const successfulMessages = messagesDetails.filter((sms: SmsMessage) => sms.status === 'SUCCESS');

    // Deduct coins for each successful message sent
    if (successfulMessages.length > 0) {
      dbUser.Details.Coins -= successfulMessages.length; // Deduct only for successful messages
      await dbUser.save();
      console.log('Coins deducted successfully. Remaining Coins:', dbUser.Details.Coins);
    } else {
      console.log('No successful messages to deduct coins for.');
    }

    // Log and respond
    console.log('Data Updated Successfully:', dbUser);
    res.status(200).json({ message: 'Messages sent successfully to all numbers!', successfulMessages });

  } catch (err: any) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Failed to send SMS. Please try again later.' });
  }
});


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      // Specify the directory to save uploaded files
      cb(null, 'profilephoto/'); // Ensure this directory exists
  },
  filename: (req, file, cb) => {
      // Specify the filename (you can customize it here)
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname); // Get the file extension
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const photo = multer({ storage: storage });

router.post('/uploadProfilePic', photo.single('profilePic'), async (req, res) => {
  const user = res.locals.user; // Get the user from middleware
  const userId = user._id;

  console.log(req.file); // Log the uploaded file info
  console.log(req.body); // Log the body of the request (should be empty for file uploads)

  // Check if the file is uploaded
  if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
  }

  // File successfully uploaded, extract the URL
  const fileUrl = req.file.path; // Adjust this based on your storage setup

  try {
      // Update or create the photo URL entry in the database
      const updatedPhotoUrl = await PhotoUrlModel.findOneAndUpdate(
          { userId: userId }, // Find the entry for the current user
          { 
              $set: { fileUrl: fileUrl, createdAt: new Date() } // Use $set to update the fields
          },
          { new: true, upsert: true } // Create a new document if it doesn't exist
      );

      // Send success response
      return res.status(200).json({
          message: 'Profile picture uploaded successfully',
          file: req.file,
          photoUrl: updatedPhotoUrl // Include the updated entry in the response
      });
  } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to save profile picture URL', error });
  }
});

router.post('/update-user', async (req: Request, res: Response) => {
  const user = res.locals.user; // Get the user from middleware
  const userId = user._id; // Get the userId from the authenticated user

  // Destructure the incoming data (lowercase 'name' and 'email')
  const { name, email } = req.body;

  // Object to hold fields that need updating
  let updates: { [key: string]: any } = {};

  // Check if name is provided and add it to the updates object
  if (name) {
      updates.Name = name; // Ensure 'Name' matches the schema field
  }

  // Check if email is provided and add it to the updates object
  if (email) {
      updates.Email = email; // Ensure 'Email' matches the schema field
      updates.isVerified = false; // Set isVerified to false if email is being updated
  }

  // If there are no updates, return a bad request
  if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
  }

  try {
      // Find the user by their userId and update the necessary fields
      const updatedUser = await SignModel.findOneAndUpdate(
          { _id: userId },
          { $set: updates },
          { new: true } // Return the updated user object
      );

      if (!updatedUser) {
          return res.status(404).json({ message: 'User not found' });
      }

      // If email was updated, send a request to /reset-session
      if (email) {
          try {
              // Just hit the /reset-session route without sending any data
              const sessionId = req.cookies.sessionId;
              if (sessionId) {
                await SessionModel.findOneAndDelete({ sessionId });
                res.clearCookie("sessionId");
              }
          } catch (resetError) {
              console.error('Error hitting /reset-session route:', resetError);
              return res.status(500).json({ message: 'Error hitting /reset-session route' });
          }
      }

      // Respond with the updated user details
      return res.status(200).json({
          message: 'User updated successfully',
          user: updatedUser
      });

  } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ message: 'Failed to update user', error });
  }
});

router.post('/purchaseno', async (req: Request, res: Response) => {
  console.log(req.body); // This Console Is Received On req.body: { dedicated_number: '+436703094546' }
  
  const dedicatedNumber = req.body.dedicated_number; // Extract the dedicated number from the request body
  const username = 'bluebirdintegrated@gmail.com'; // Replace with your ClickSend username
  const apiKey = 'EA26A5D0-7AAC-6631-478B-FC155CE94C99'; // Replace with your ClickSend API key
  const encodedAuth = Buffer.from(`${username}:${apiKey}`).toString('base64');

  try {
      // Log the encoded auth for debugging
      console.log('Encoded Auth:', encodedAuth);
      
      // Make the purchase request to ClickSend
      const response = await axios.post(`https://rest.clicksend.com/v3/numbers/buy/${encodeURIComponent(dedicatedNumber)}`, {}, {
          headers: {
              'Authorization': `Basic ${encodedAuth}`,
              'Content-Type': 'application/json'
          }
      });

      // Handle the response from ClickSend
      if (response.status === 200) {
          // Successful purchase
          res.status(200).json({ message: 'Purchase successful!', data: response.data });
      } else {
          // Handle unexpected status
          res.status(response.status).json({ message: 'Purchase failed!', error: response.data });
      }
  } catch (error: any) {
    // Handle errors
    console.error('Error purchasing number:', error.message);
    
    // Log the entire error response for better debugging
    if (error.response) {
        console.error('Error Response Data:', error.response.data);
        console.error('Error Response Status:', error.response.status);
        
        // Check for insufficient balance error
        if (error.response.data.response_msg === 'Insufficient Balance.') {
            return res.status(400).json({ 
                message: 'Purchase failed due to insufficient balance. Please top up your account.',
                error: error.response.data 
            });
        } else {
            return res.status(error.response.status).json({ 
                message: 'Error processing purchase.', 
                error: error.response.data 
            });
        }
    } else {
        return res.status(500).json({ message: 'Error processing purchase.', error: error.message });
    }
}
});

router.get('/verifyownnumber',(req:Request , res:Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/verifynumber.html'));
})

router.post('/verifyownnumber', async (req: Request, res: Response) => {
  const { phone_number, label, country, verification_code } = req.body; // Extract phone number, label, and country from request body
  console.log('Request body:', req.body);
  const user = res.locals.user; // Get the user from middleware

  if (!user) {
      console.error('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id; 
  // Replace with your ClickSend credentials
  const username = 'bluebirdintegrated@gmail.com'; 
  const apiKey = 'EA26A5D0-7AAC-6631-478B-FC155CE94C99';

  if (phone_number && label && country) {
      try {
          // Call the ClickSend API
          const apiResponse = await fetch('https://rest.clicksend.com/v3/own-numbers/verifications', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64') // Basic Auth
              },
              body: JSON.stringify({
                  phone_number: phone_number, // Required field
                  label: label || 'Default Label', // Optional, set default if not provided
                  country: country
              })
          });

          // Parse the response from ClickSend API
          const result = await apiResponse.json();
          console.log('Response from ClickSend API:', result);
          
          // If successful, save the verified number and update the user's verifiedNumbers
          if (apiResponse.ok) {
              const verifiedNumber = await VerifiedNumberModel.create({
                  userId: userId,
                  number: phone_number,
                  own_numberid: result.id,
                  label: label,
                  country: country
              });

              // Update the Sign model to include the verified number reference
              await SignModel.findByIdAndUpdate(userId, {
                  $push: { verifiedNumbers: verifiedNumber._id } // Add the verified number ID to the user's verifiedNumbers array
              });

              // Set a timeout to delete the verified number after 1 minute
              setTimeout(async () => {
                  await VerifiedNumberModel.findByIdAndDelete(verifiedNumber._id); // Delete the verified number
                  await SignModel.findByIdAndUpdate(userId, {
                      $pull: { verifiedNumbers: verifiedNumber._id } // Remove the verified number ID from the user's verifiedNumbers array
                  });
                  console.log(`Deleted verified number for user ${userId}:`, verifiedNumber._id);
              }, 60 * 1000); // 60 seconds in milliseconds

              res.status(200).json({ success: true, data: result, verifiedNumber }); // Respond with the verified number
          } else {
              // Handle error response from ClickSend API
              console.error('Error from ClickSend API:', result);
              res.status(apiResponse.status).json({
                  success: false,
                  error: result.message || 'Error verifying phone number'
              });
          }
      } catch (error) {
          console.error('Error fetching from ClickSend API:', error);
          res.status(500).json({
              success: false,
              message: 'Server error occurred while verifying phone number'
          });
      }
  } else if (verification_code) {
      const find = await VerifiedNumberModel.findOne({ userId: userId });
      if (!find) {
          console.warn('No verified number record found for user:', userId);
          return res.status(404).json({ message: 'Verification Code Expired' });
      }

      const numberId = find.own_numberid;
      const phonr = find.number;
      const countrye = find.country;

      try {
          // Call the ClickSend API
          const apiResponse = await fetch(`https://rest.clicksend.com/v3/own-numbers/verifications/${numberId}/verify`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64') // Basic Auth
              },
              body: JSON.stringify({
                  country: countrye,
                  phone_number: phonr, // Required field
                  code: verification_code
              })
          });

          if (apiResponse.ok) {
              const verificationResult = await apiResponse.json();
              console.log('Phone number verified successfully:', verificationResult);
              res.status(200).json({ success: true, message: 'Phone number verified successfully!', data: verificationResult });
          } else {
              console.error('Error verifying the verification code:', apiResponse);
              const errorResult = await apiResponse.json();
              res.status(apiResponse.status).json({
                  success: false,
                  error: errorResult.message || 'Error verifying the verification code'
              });
          }
      } catch (error) {
          console.error('Error verifying the code:', error);
          res.status(500).json({
              success: false,
              message: 'Server error occurred while verifying the code'
          });
      }
  } else {
      console.log('Invalid request, no phone number or verification code provided');
      res.status(400).json({ message: 'Invalid request. Please provide phone number, label, country, or verification code.' });
  }
});




router.get('/broughtnumbers',(req:Request,res:Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/broughtnumber.html'));
})

router.post('/broughtnumbers', async (req: Request, res: Response) => {
  const apiUrl = 'https://rest.clicksend.com/v3/numbers';  // ClickSend API URL
  const username = 'bluebirdintegrated@gmail.com';  // Replace with your ClickSend username
  const apiKey = 'EA26A5D0-7AAC-6631-478B-FC155CE94C99';    // Replace with your ClickSend API key

  try {
    // Make API request to ClickSend
    const response = await axios.get(apiUrl, {
      auth: {
        username: username,
        password: apiKey,  // ClickSend API key as password
      }
    });

    // Handle response from API
    const broughtNumbers = response.data;  // Data from ClickSend API
    res.json(broughtNumbers);              // Send data back to client
  } catch (error) {
    console.error('Error fetching ClickSend API:', error);
    res.status(500).json({ error: 'Failed to fetch brought numbers' });
  }
});

router.get('/ownnumbers',(req:Request,res:Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/ownnumbers.html'));
})
router.post('/ownnumbers', async (req: Request, res: Response) => {
  try {
      // Set up your API credentials
      const apiUser = 'bluebirdintegrated@gmail.com';
      const apiKey = 'EA26A5D0-7AAC-6631-478B-FC155CE94C99';

      // Make the request to the ClickSend API
      const response = await axios.get('https://rest.clicksend.com/v3/own-numbers', {
          auth: {
              username: apiUser,
              password: apiKey,
          },
      });

      // Send the response data back to the client
      res.status(200).json(response.data);
  } catch (error:any) {
      console.error('Error fetching own numbers:', error);
      // Handle errors gracefully
      if (error.response) {
          // If the error is from the response
          res.status(error.response.status).json({ error: error.response.data });
      } else {
          // Other errors
          res.status(500).json({ error: 'An error occurred while fetching own numbers.' });
      }
  }
});

router.get('/alphatag',(req:Request,res:Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/alphatag.html'));
})
router.post('/getalpha', async (req: Request, res: Response) => {
  const username = 'bluebirdintegrated@gmail.com';
const apiKey = 'EA26A5D0-7AAC-6631-478B-FC155CE94C99';
  try {
    // Prepare the API call to ClickSend Alpha Tags API
    const apiResponse = await fetch('https://rest.clicksend.com/v3/alpha-tags', {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64') // Basic Auth
      }
    });

    // Parse the response from ClickSend
    const result = await apiResponse.json();

    if (apiResponse.ok) {
      // Respond with the result if the request is successful
      res.status(200).json({
        success: true,
        message: 'Alpha tags fetched successfully',
        data: result
      });
    } else {
      // Handle error response from ClickSend API
      res.status(apiResponse.status).json({
        success: false,
        error: result.message || 'Failed to fetch alpha tags',
        details: result
      });
    }
  } catch (error) {
    console.error('Error fetching alpha tags:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while fetching alpha tags'
    });
  }
});
router.post('/alphatag', async (req: Request, res: Response) => {
  const { alpha_tag, reason } = req.body; // Extract the alpha_tag and reason from request body
  console.log(req.body); // Log the request body to verify data is being received correctly
  const user = res.locals.user; // Get the user from middleware

  if (!user) {
      console.error('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id;

  // Your ClickSend credentials
  const username = 'bluebirdintegrated@gmail.com';
  const apiKey = 'EA26A5D0-7AAC-6631-478B-FC155CE94C99';
  
  // Validate alpha_tag
  if (!alpha_tag || alpha_tag.length < 3 || alpha_tag.length > 11 || !/[A-Za-z]+/.test(alpha_tag)) {
    return res.status(400).json({ message: 'Invalid alpha tag. Must be between 3-11 characters and contain at least one letter.' });
  }

  try {
    console.log('Attempting to send alpha tag request to ClickSend...');
    const apiResponse = await fetch('https://rest.clicksend.com/v3/alpha-tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64')
      },
      body: JSON.stringify({
        alpha_tag: alpha_tag,
        reason: reason || ''
      })
    });
    
    const result = await apiResponse.json();
    console.log('API Response:', result);  // Log the result here
  
    if (apiResponse.ok) {
      const saver = await AlphaTagModel.create({
        pid: result.id,
        account_id: result.account_id,
        workspace_id: result.workspace_id,
        user_id_clicksend: result.user_id,
        user_id: userId,
        alpha_tag: result.alpha_tag,
        status: result.status,
        reason: result.reason
      })
      await saver.save();
      console.log(saver);
      res.status(200).json({
        success: true,
        message: 'Alpha tag created successfully',
        data: result
      });
    } else {
      console.error('Error from ClickSend:', result); // Log any errors from the API
      res.status(apiResponse.status).json({
        success: false,
        error: result.message || 'Failed to create alpha tag',
        details: result
      });
    }
  } catch (error:any) {
    console.error('Error creating alpha tag:', error.message || error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while creating alpha tag'
    });
  }
});

router.get('/profilepage',(req:Request , res:Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/profile.html'));
})
// Route to get the user's profile picture
router.get('/profile-pic', async (req: Request, res: Response) => {
  const user = res.locals.user; // Get the user from middleware

  if (!user) {
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id; // Ensure userId exists
  console.log('User ID:', userId);

  try {
      const photoUrlEntry = await PhotoUrlModel.findOne({ userId: userId });

      if (!photoUrlEntry) {
          return res.status(404).json({ message: 'Profile picture not found' });
      }

      // Send the file URL in the response
      return res.status(200).json({ fileUrl: photoUrlEntry.fileUrl });
  } catch (error) {
      console.error('Error retrieving profile picture:', error);
      return res.status(500).json({ message: 'Failed to retrieve profile picture', error });
  }
});




export default router;