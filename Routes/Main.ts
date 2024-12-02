import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import axios from "axios";
import { SignModel , ListModel , IList , IContact , MessageModel , FileUrlModel , PhotoUrlModel , VerifiedNumberModel , AlphaTagModel , CampaignMessageModel, SubaccountModel } from "../Schema/Post.js";
import SessionModel from '../Schema/Session.js'
import { AppRes } from "../index.js";
import multer,{ FileFilterCallback } from 'multer';
import * as fs from 'fs';
import FormData from 'form-data';
import "dotenv/config";

interface CampaignPayload {
  campaignName?: string;
  senderId?: string;
  message?: string;
  sendOption: string;
  scheduleDateTime?: string;
  selectedListId?: string; // Optional
}

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
router.get("/", async (req: Request, res: Response) => {
  try {
    res.sendFile(path.resolve(__dirname, "../Views/index.html"));
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).send("Failed to load user data.");
  }
});

router.get("/alllists", (req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, "../Views/alllists.html"));
});

router.post("/list", async (req: Request, res: Response) => {
  console.log(req.body); // Log the request body for debugging
  const { listName } = req.body; // Get the list name from the request body

  // Get the user from res.locals (should be set in a prior middleware)
  const user = res.locals.user;
  if (!user) {
      return res.status(401).send("Unauthorized");
  }

  const userId = user._id;
  console.log("UserId:", userId); // Log userId for debugging

  try {
      // Find the user's subaccount details
      const subaccount = await SubaccountModel.findOne({ userId });
      if (!subaccount) {
          return res.status(404).json({ success: false, message: "Subaccount not found." });
      }

      // Correctly assign API credentials
      const subaccountUsername = subaccount?.username;
      const subaccountApiKey = subaccount?.api_key;

      if (!subaccountUsername || !subaccountApiKey) {
          console.error("Missing username or API key");
          return res.status(400).json({ message: 'Username or API key missing' });
      }

      // Construct the ClickSend API URL and authorization header
      const clickSendUrl = 'https://rest.clicksend.com/v3/lists';
      const authHeader = `Basic ${Buffer.from(`${subaccountUsername}:${subaccountApiKey}`).toString('base64')}`;

      // Make a POST request to ClickSend API to create a contact list
      const clickSendResponse = await axios.post(
          clickSendUrl,
          { list_name: listName }, // Payload for creating a list
          {
              headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json'
              }
          }
      );

      const responseBody = clickSendResponse.data;
      console.log('ClickSend API Response:', responseBody);

      // Check if the response contains the expected data (list_id)
      if (responseBody && responseBody.data && responseBody.data.list_id) {
          // Create a new List document in the database
          const newList = new ListModel({
              listName: listName,
              createdBy: userId,
              listId: responseBody.data.list_id,
              contacts: [] // Initialize contacts as an empty array
          });

          await newList.save();
          console.log('List saved to database:', newList);

          return res.status(200).json({
              success: true,
              message: 'Contact list created and saved successfully!',
              data: responseBody
          });
      } else {
          // Handle cases where the ClickSend API response is missing the list_id
          return res.status(400).json({ success: false, message: 'Failed to create contact list in ClickSend.' });
      }

  } catch (err: any) {
      console.error('Error creating contact list:', err.response?.data || err.message);
      res.status(500).json({
          success: false,
          message: 'Failed to create contact list: ' + (err.message || 'Internal Server Error')
      });
  }
});



const upload1 = multer({ dest: 'uploads/' });

// Function to send contacts to ClickSend
const sendSingleContactToClickSend = async (
  listId: any,
  contact: any,
  subaccountUsername: any,
  subaccountApiKey:any
) => {
  const url = `https://rest.clicksend.com/v3/lists/${listId}/contacts`;

  try {
    const payload = {
      phone_number: contact.mix,
      email: contact.email,
      first_name: contact.firstName,
      last_name: contact.lastName,
      custom_1: contact.contactid.toString(), // Assuming `contactid` is required
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${subaccountUsername}:${subaccountApiKey}`).toString('base64'),
      },
    });

    if (response.data.http_code !== 200) {
      console.error('Failed to send contact to ClickSend:', response.data);
      return { success: false, contact, error: response.data.response_msg };
    }

    console.log('Contact successfully sent to ClickSend:', response.data);
    return { success: true, contact, contactId: response.data.data.contact_id }; // Assuming `contact_id` is returned
  } catch (error: any) {
    console.error('Error sending contact to ClickSend:', error.response?.data || error.message);
    return { success: false, contact, error: error.message };
  }
};



router.delete('/deletecontact', async (req: Request, res: Response) => {
  const contactId = req.body; // Assuming the contactId is passed directly in the body

  const user = res.locals.user; // Get the user from middleware

  // Check for authenticated user
  if (!user) {
    console.error('User not authenticated');
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id;
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: 'Subaccount not found.' });
  }

  // Extract ClickSend API credentials
  const { username: subaccountUsername, api_key: subaccountApiKey } = subaccount;

  console.log('Received delete request for contact:', req.body);
  console.log('User ID:', userId);

  try {
    // Check if contactId is an object and extract its value
    const parsedContactId = typeof contactId === 'object' && contactId.contactId 
      ? parseInt(contactId.contactId) 
      : parseInt(contactId);

    console.log('Parsed contactId:', parsedContactId);

    if (isNaN(parsedContactId)) {
      console.error('Parsed contactId is NaN, invalid contactId:', contactId);
      return res.status(400).json({ message: 'Invalid contactId provided.' });
    }

    // Find the list that contains the contact created by the user
    const list = await ListModel.findOne({
      createdBy: userId,
      'contacts.contactid': parsedContactId // Use parsed contactId
    });

    console.log('List found:', list);

    if (!list) {
      console.log('Contact not found in any list.');
      return res.status(404).json({ message: 'Contact not found in any list.' });
    }

    // Find the index of the contact in the contacts array
    const contactIndex = list.contacts.findIndex((contact: any) => contact.contactid === parsedContactId);
    console.log('Contact index found:', contactIndex);

    if (contactIndex === -1) {
      console.log('Contact not found in the list.');
      return res.status(404).json({ message: 'Contact not found.' });
    }

    const contactToDelete = list.contacts[contactIndex];
    console.log('Contact to delete:', contactToDelete);

    // Prepare ClickSend API endpoint with list_id and contact_id
    const clickSendUrl = `https://rest.clicksend.com/v3/lists/${list.listId}/contacts/${contactToDelete.contactid}`;
    console.log('ClickSend URL:', clickSendUrl);

    // Make a request to ClickSend API to delete the contact
    const response = await axios.delete(clickSendUrl, {
      auth: {
        username: subaccountUsername,
        password: subaccountApiKey
      }
    });

    console.log('Response from ClickSend API:', response.status);

    if (response.status === 200) {
      // Remove the contact from your local database list
      list.contacts.splice(contactIndex, 1);

      // Save the updated list in your database
      await list.save();
      console.log('Contact deleted successfully from both ClickSend and your database.');

      return res.status(200).json({ message: 'Contact deleted successfully from both ClickSend and your database.' });
    } else {
      console.log(`Failed to delete contact from ClickSend. Status: ${response.status}`);
      return res.status(response.status).json({ message: `Failed to delete contact from ClickSend. Status: ${response.status}` });
    }
  } catch (error) {
    console.error('Error deleting contact:', error);
    return res.status(500).json({ message: 'Failed to delete contact.' });
  }
});

router.put('/updatecontactnumber', async (req: Request, res: Response) => {
  const user = res.locals.user; // Get the user from middleware

  // Check for authenticated user
  if (!user) {
    console.error('User not authenticated');
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id;
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: 'Subaccount not found.' });
  }

  // Extract ClickSend API credentials
  const { username: subaccountUsername, api_key: subaccountApiKey } = subaccount;

  const contactId = req.body.contactId;
  const newNumber = req.body.newPhoneNumber;
  console.log(contactId, newNumber);

  try {
    // Parse the contactId
    const parsedContactId = typeof contactId === 'object' && contactId.contactId
      ? parseInt(contactId.contactId)
      : parseInt(contactId);

    if (isNaN(parsedContactId)) {
      console.error('Parsed contactId is NaN, invalid contactId:', contactId);
      return res.status(400).json({ message: 'Invalid contactId provided.' });
    }

    // Find the list containing the contact
    const list = await ListModel.findOne({
      createdBy: userId,
      'contacts.contactid': parsedContactId
    });

    if (!list) {
      console.log('Contact not found in any list.');
      return res.status(404).json({ message: 'Contact not found in any list.' });
    }

    // Get the listId
    const listId = list.listId; // Adjust according to your actual field name for list ID

    // Find the index of the contact in the contacts array
    const contactIndex = list.contacts.findIndex((contact: any) => contact.contactid === parsedContactId);

    if (contactIndex === -1) {
      console.log('Contact not found in the list.');
      return res.status(404).json({ message: 'Contact not found.' });
    }

    // Update the contact in ClickSend
    const clickSendUrl = `https://rest.clicksend.com/v3/lists/${listId}/contacts/${parsedContactId}`;
    
    const clickSendResponse = await axios.put(clickSendUrl, {
      phone_number: newNumber,
      custom_1: 'updated' // Adjust if you need other fields
    }, {
      auth: {
        username: subaccountUsername,
        password: subaccountApiKey,
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (clickSendResponse.status !== 200) {
      console.error('Error updating contact in ClickSend:', clickSendResponse.data);
      return res.status(clickSendResponse.status).json({ message: clickSendResponse.data.message || 'Failed to update contact in ClickSend.' });
    }

    // Update the local database
    list.contacts[contactIndex].mix = newNumber; // Update the phone number locally
    await list.save(); // Save changes to your database

    console.log('Contact updated successfully in ClickSend and locally');
    return res.status(200).json({ message: 'Contact updated successfully!' });

  } catch (error) {
    console.error('Error updating contact:', error);
    return res.status(500).json({ message: 'An error occurred while updating the contact.' });
  }
});
router.post('/removeduplicate', async (req: Request, res: Response) => {
  const { listId } = req.body;
  console.log('Received request to remove duplicates for listId:', listId);
  const user = res.locals.user; // Get the user from middleware

  if (!user) {
      console.error('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id; 
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: "Subaccount not found." });
  }

  // Extract subaccount ClickSend API credentials
  const subaccountUsername = subaccount?.username;
  const subaccountApiKey = subaccount?.api_key;

  try {
      // Find the list by listId in your database
      const listFound = await ListModel.findOne({ listId: listId });
      console.log('List found:', listFound);

      if (!listFound) {
          console.log('List not found for listId:', listId);
          return res.status(404).json({ message: 'List not found.' });
      }

      const { contacts } = listFound;
      console.log('Number of contacts in list:', contacts.length);

      // Create a Set to track unique phone numbers
      const uniqueNumbers = new Set();
      const uniqueContacts = [];

      for (const contact of contacts) {
          const phoneNumber = contact.mix;
          console.log('Processing contact with phone number:', phoneNumber);

          // Check if the number is already in the Set
          if (!uniqueNumbers.has(phoneNumber)) {
              uniqueNumbers.add(phoneNumber); // Add the phone number to the Set
              uniqueContacts.push(contact);   // Add the contact to the unique contacts list
          } else {
              console.log('Duplicate phone number found:', phoneNumber);
          }
      }

      // Call ClickSend API to remove duplicates
      const clickSendUrl = `https://rest.clicksend.com/v3/lists/${listId}/remove-duplicates/`;
      console.log('Sending request to ClickSend API:', clickSendUrl);

      const clickSendResponse = await fetch(clickSendUrl, {
          method: 'PUT',
          headers: {
              'Authorization': `Basic ${Buffer.from(`${subaccountUsername}:${subaccountApiKey}`).toString('base64')}`, // Replace with your ClickSend credentials
              'Content-Type': 'application/json',
          }
      });

      // Handle ClickSend API response
      if (!clickSendResponse.ok) {
          const errorData = await clickSendResponse.json();
          console.error('Error from ClickSend API:', errorData);
          return res.status(clickSendResponse.status).json({ message: errorData.message || 'Failed to remove duplicates in ClickSend.' });
      }

      console.log('ClickSend duplicates removed successfully.');

      // If ClickSend response is ok, update the contacts in the local database
      listFound.contacts = uniqueContacts;
      await listFound.save(); // Save changes to the database
      console.log('Duplicate contacts removed and list updated successfully in the database.');

      res.status(200).json({ message: 'Duplicate contacts removed successfully.', contacts: uniqueContacts });
  } catch (error) {
      console.error('Error during the duplicate removal process:', error);
      res.status(500).json({ message: 'An error occurred while removing duplicates.' });
  }
});

router.post('/deleteownnumber', async (req: Request, res: Response) => {
  const { id } = req.body; // Extract the number ID from the request body

  console.log('Received request to delete own number:', req.body); // Log incoming request

  if (!id) {
    console.log('Number ID is missing in the request.');
    return res.status(400).json({ success: false, message: 'Number ID is required.' });
  }
  const user = res.locals.user; // Get the user from middleware

  if (!user) {
      console.error('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id; 
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: "Subaccount not found." });
  }

  // Extract subaccount ClickSend API credentials
  const subaccountApiKey = subaccount?.username;
  const subaccountUsername = subaccount?.api_key;

  try {
    // Replace with your ClickSend credentials
    const clickSendAuth = {
      username: `${subaccountApiKey}`,
      apiKey: `${subaccountUsername}`
    };

    console.log(`Sending DELETE request to ClickSend for number ID: ${id}`);

    // Make DELETE request to ClickSend API
    const response = await axios.delete(`https://rest.clicksend.com/v3/own-numbers/${id}`, {
      auth: {
        username: clickSendAuth.username,
        password: clickSendAuth.apiKey // Use the API key as the password
      }
    });

    console.log('Response from ClickSend API:', response); // Log API response

    // Check if the delete was successful
    if (response) {
      console.log('Number deleted successfully.');
      return res.status(200).json({ success: true, message: 'Number deleted successfully.' });
    } else {
      console.log('Failed to delete number, API response:', response);
      return res.status(400).json({ success: false, message: 'Failed to delete the number.' });
    }
  } catch (error: any) {
    console.error('Error deleting own number:', error.response || error.message);
    res.status(500).json({ success: false, message: 'Error occurred while deleting the number.' });
  }
});

router.post('/deletetag', async (req: Request, res: Response) => {
  const { id } = req.body; 
  console.log('Request Body:', req.body); 

  if (!id) {
    console.error('No ID provided'); 
    return res.status(400).json({ success: false, message: 'Alpha tag ID is required.' });
  }
  const user = res.locals.user; // Get the user from middleware

  if (!user) {
      console.error('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id; 
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: "Subaccount not found." });
  }

  // Extract subaccount ClickSend API credentials
  const subaccountUsername = subaccount?.username;
  const subaccountApiKey = subaccount?.api_key;

  try {
    // Find the alpha tag by _id
    console.log(`Searching for alpha tag associated with _id: ${id}`);
    const findout = await AlphaTagModel.findOne({ _id: id });
    console.log('Alpha tag found:', findout);

    if (!findout) {
      console.warn('No alpha tag found for the provided _id');
      return res.status(404).json({ success: false, message: 'Alpha tag not found.' });
    }

    const extract_tagid = findout?.pid;
    const extract_alpha_tag = findout?.alpha_tag;
    console.log('Extracted tag ID (pid):', extract_tagid);
    console.log('Extracted alpha tag:', extract_alpha_tag);

    if (extract_tagid != null) {
      console.log(`Attempting to delete alpha tag with ClickSend ID: ${extract_tagid}`);
      
      const clickSendAuth = {
        username: `${subaccountUsername}`,
        apiKey: `${subaccountApiKey}`
      };

      try {
        const response = await axios.delete(`https://rest.clicksend.com/v3/alpha-tags/${extract_tagid}`, {
          auth: {
            username: clickSendAuth.username,
            password: clickSendAuth.apiKey
          }
        });

        console.log('ClickSend API Response Status:', response.status);
        if (response.status >= 200 && response.status < 300) {
          const deletedTag = await AlphaTagModel.findOneAndDelete({ _id: id });
          console.log('Alpha tag deleted from MongoDB:', deletedTag);
          return res.status(200).json({ success: true, message: 'Alpha tag deleted successfully.' });
        } else {
          console.warn('Failed to delete alpha tag from ClickSend');
        }
      } catch {
        console.error('Error from ClickSend API while deleting alpha tag');
        return res.status(500).json({ success: false, message: 'Failed to delete alpha tag in ClickSend.' });
      }
    }

    console.log('No ClickSend ID, deleting alpha tag from MongoDB only...');
    const deletedTag = await AlphaTagModel.findOneAndDelete({ _id: id });
    console.log('Alpha tag deleted successfully from MongoDB:', deletedTag);

    // No need to query the document again after deletion
    return res.status(200).json({ success: true, message: 'Alpha tag deleted successfully from MongoDB.' });

  } catch (error: any) {
    console.error('Error occurred while deleting the alpha tag:', error.message || error);
    return res.status(500).json({ success: false, message: 'Error occurred while deleting the alpha tag.' });
  }
});






router.post('/updateownnumber', async (req: Request, res: Response) => {
  const { id, label } = req.body; // Extract id and label from the request body

  console.log('Request body:', req.body); // Log the request body for debugging
  const user = res.locals.user; // Get the user from middleware

  if (!user) {
      console.error('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id; 
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: "Subaccount not found." });
  }

  // Extract subaccount ClickSend API credentials
  const subaccountUsername = subaccount?.username;
  const subaccountApiKey = subaccount?.api_key;

  // ClickSend API credentials
  const username = `${subaccountUsername}`;
  const apiKey = `${subaccountApiKey}`;
  const clickSendUrl = `https://rest.clicksend.com/v3/own-numbers/${id}`; // Use id in the URL

  try {
    // Make a PATCH request to ClickSend API to update the own number label
    const clickSendResponse = await axios.patch(
      clickSendUrl, 
      {
        label: label // Payload for updating the label
      }, 
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const responseBody = clickSendResponse.data; // Extract response data
    console.log('ClickSend API Response:', responseBody); // Log the response

    // Check if the response contains expected data
    if (responseBody && responseBody.data) {
      return res.status(200).json({ success: true, message: 'Own number updated successfully!', data: responseBody });
    } else {
      return res.status(400).json({ success: false, message: 'Failed to update own number in ClickSend.' });
    }
  } catch (err: any) {
    console.error('Error updating own number:', err.response?.data || err.message); // Log error details
    res.status(500).json({ success: false, message: 'Failed to update own number: ' + (err.message || 'Internal Server Error') });
  }
});




// Route for importing contacts
// Route for importing contacts
router.post('/importContacts', upload1.single('file'), async (req, res) => {
  const { listId } = req.body;
  const user = res.locals.user;
  const userId = user._id;
  const file = req.file;

  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount || !subaccount.username || !subaccount.api_key) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No subaccount or credentials found.' });
  }

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
  if (fileExtension !== 'csv') {
    return res.status(400).json({ error: 'Invalid file type. Please upload a .csv file.' });
  }

  try {
    const fileContent = fs.readFileSync(file.path, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const contacts = lines.slice(1).map(line => {
      const [phone, first_name, last_name, email] = line.split(',').map(item => item.trim());
      return { 
        firstName: first_name,
        lastName: last_name,
        email,
        mix: phone,
        contactid: 0,
      };
    });
    
const fileUrl = `https://smsportalgivenbysir.vercel.app/${file.path.replace(/\\/g, '/')}`;
const fileUrlEntry = new FileUrlModel({
  userId,
  listId,
  fileUrl,
});
await fileUrlEntry.save();
console.log('File URL saved successfully:', fileUrlEntry);

    const uploadPromises = contacts.map(contact =>
      sendSingleContactToClickSend(listId, contact, subaccount.username, subaccount.api_key)
    );

    const results = await Promise.all(uploadPromises);

    // Save successful contacts with `contactId` to MongoDB
    const successfulContacts = results.filter(result => result.success).map(result => ({
      ...result.contact,
      contactid: result.contactId,
    }));

    const list = await ListModel.findOne({ listId });
    if (!list) {
      return res.status(404).json({ error: 'List not found.' });
    }

    list.contacts.push(...successfulContacts);
    await list.save();
    console.log('Updated contacts with ClickSend contact IDs saved to MongoDB:', list.contacts);

    res.status(200).json({ message: 'Contacts processed successfully.', results });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'Error processing the file.' });
  }
});



router.get('/api/credentials', (req:Request, res:Response) => {
  res.json({
      username: process.env.USERNAME,
      apiKey: process.env.API_KEY
  });
});
router.post("/getlist", async (req: Request, res: Response) => {
  const user = res.locals.user;

  if (!user) {
      console.error('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id;
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
      return res.status(404).json({ success: false, message: "Subaccount not found." });
  }

  const subaccountUsername = subaccount?.username;
  const subaccountApiKey = subaccount?.api_key;

  if (!subaccountUsername || !subaccountApiKey) {
      console.error("Missing username or API key");
      return res.status(400).json({ message: 'Username or API key missing' });
  }
  const clickSendUrl = 'https://rest.clicksend.com/v3/lists';
 
  const auth = `Basic ${Buffer.from(`${subaccountUsername}:${subaccountApiKey}`).toString('base64')}`;
  console.log("Authorization Header:", auth);

  try {
      const clickSendResponse = await axios.get(clickSendUrl, {
          headers: {
              'Authorization': auth,
              'Content-Type': 'application/json'
          },
          params: {
              page: 1,
              limit: 10
          }
      });

      const clickSendLists = clickSendResponse.data;
      console.log(clickSendLists);

      const userLists = await ListModel.find({ createdBy: userId });
      console.log(userLists);

      res.json({ clickSendLists, userLists });

  } catch (error: any) {
      console.error('Error fetching lists:', error);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
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
  const { listId, newListName } = req.body;
  const user = res.locals.user; // Get the user from middleware

  // Check for authenticated user
  if (!user) {
    console.error('User not authenticated');
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id;
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: 'Subaccount not found.' });
  }

  // Extract ClickSend credentials from subaccount
  const { username: subaccountUsername, api_key: subaccountApiKey } = subaccount;

  // Validate required fields
  if (!listId || !newListName) {
    console.log('Missing required fields: listId or newListName');
    return res.status(400).json({ error: 'Missing required fields: listId or newListName' });
  }

  try {
    // Step 1: Update list in MongoDB
    const updatedList = await ListModel.findOneAndUpdate(
      { listId },
      { listName: newListName },
      { new: true }
    );

    // If list is not found in MongoDB, try updating in ClickSend
    if (!updatedList) {
      console.log('List not found in database, checking ClickSend.');

      try {
        const clickSendResponse = await axios.put(
          `https://rest.clicksend.com/v3/lists/${listId}`,
          { list_name: newListName },
          {
            auth: {
              username: subaccountUsername,
              password: subaccountApiKey,
            },
          }
        );

        if (clickSendResponse.status === 200) {
          console.log('List successfully updated in ClickSend.');
          return res.status(200).json({ success: true, message: 'List updated successfully in ClickSend.' });
        } else {
          console.error(`ClickSend update failed: ${clickSendResponse.statusText}`);
          return res.status(500).json({ error: true, message: 'Failed to update list in ClickSend.' });
        }
      } catch (error: any) {
        console.error('Error updating list in ClickSend:', error.message);
        return res.status(500).json({ error: true, message: 'Error updating list in ClickSend.' });
      }
    }

    // If list is updated in MongoDB, also update in ClickSend
    try {
      const clickSendResponse = await axios.put(
        `https://rest.clicksend.com/v3/lists/${listId}`,
        { list_name: newListName },
        {
          auth: {
            username: subaccountUsername,
            password: subaccountApiKey,
          },
        }
      );

      if (clickSendResponse.status === 200) {
        console.log('List successfully updated in both MongoDB and ClickSend.');
        return res.status(200).json({ success: true, message: 'List updated successfully in both MongoDB and ClickSend.' });
      } else {
        console.error(`ClickSend update failed: ${clickSendResponse.statusText}`);
        return res.status(500).json({ error: true, message: 'Failed to update list in ClickSend.' });
      }
    } catch (error: any) {
      console.error('Error updating list in ClickSend:', error.message);
      return res.status(500).json({ error: true, message: 'Error updating list in ClickSend.' });
    }

  } catch (error: any) {
    console.error('Error occurred during the update process:', error.message);
    return res.status(500).json({ error: true, message: 'Server error occurred during the update process.' });
  }
});


router.delete('/listdel', async (req: Request, res: Response) => {
  const listId = req.body.listId;
  const user = res.locals.user; // Get the user from middleware

  // Check for authenticated user
  if (!user) {
    console.error('User not authenticated');
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id;
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: 'Subaccount not found.' });
  }

  // Extract ClickSend API credentials from subaccount
  const { username: subaccountUsername, api_key: subaccountApiKey } = subaccount;

  // Validate listId
  if (!listId) {
    console.error('No listId provided.');
    return res.status(400).send({ error: true, message: 'Invalid Request: listId is missing.' });
  }

  try {
    // Step 1: Check if the list exists in the local database
    const list = await ListModel.findOne({ listId });
    if (!list) {
      console.log('List not found in database, checking ClickSend.');

      // Attempt to delete from ClickSend if not found in the database
      const response = await axios.delete(`https://rest.clicksend.com/v3/lists/${listId}`, {
        auth: {
          username: subaccountUsername,
          password: subaccountApiKey,
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

    // Step 2: If the list exists, attempt deletion from both ClickSend and the local database
    const response = await axios.delete(`https://rest.clicksend.com/v3/lists/${listId}`, {
      auth: {
        username: subaccountUsername,
        password: subaccountApiKey,
      },
    });

    if (response.status === 200) {
      console.log('List successfully deleted from ClickSend.');

      // Delete from the local database
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
  const user = res.locals.user; // Get the user from middleware

  if (!user) {
      console.error('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id; 
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: "Subaccount not found." });
  }

  // Extract subaccount ClickSend API credentials
const subaccountUsername = subaccount?.username;
const subaccountApiKey = subaccount?.api_key;

  if (!subaccountUsername || !subaccountApiKey) {
    console.error("Missing username or API key");
    return res.status(400).json({ message: 'Username or API key missing' });
}

  console.log('Request Body:', req.body);

  const { firstName, lastName, email, phone, code, userid } = req.body;
  const formattedPhone = `${code}${phone}`;  // E.164 formatted phone number
  console.log('Formatted Phone Number:', formattedPhone);
  console.log('List ID:', userid);

  try {
    const username = `${subaccountUsername}`;
    const apiKey = `${subaccountApiKey}`;

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
  console.log(req.body);

  // Basic validation checks
  if (!current_password || !new_password || !confirm_password) {
    return res.status(400).send("All fields are required.");
  }

  // Validate that new_password and confirm_password match
  if (new_password !== confirm_password) {
    return res.status(400).send("New passwords do not match.");
  }

  // Define the password pattern
  const passwordPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,12}$/;

  // Validate new password against the pattern
  if (!passwordPattern.test(new_password)) {
    return res.status(400).send("New password must be 8-12 characters long and include at least one uppercase letter, one lowercase letter, one digit, and one special character.");
  }

  // Fetch user details
  const user = res.locals.user; // Ensure this is set by middleware beforehand

  try {
    // Verify current password
    const match = await bcrypt.compare(current_password, user?.Password!);
    if (!match) {
      return res.status(400).send("Current password is incorrect.");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);
    const updated_data = {
      Password: hashedPassword,
    };

    // Update user password
    await findAndUpdateUserById(user?._id as string, updated_data);

    // Update password in SubaccountModel if necessary
    let updatedPass = await SubaccountModel.findOne({ userId: user?._id });
    if (updatedPass) {
      updatedPass.password = new_password; // Update with plain new password
      await updatedPass.save();
    }

    res.send("Password changed successfully.");
  } catch (error: any) {
    console.error("Error changing password:", error);
    res.status(500).send({ error: "Error changing password: " + error.message });
  }
})

router.get('/bulksms',(req: Request , res: Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/bulksms.html'));
})

router.get('/purchaseno',(req:Request , res:Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/purchasenumber.html'))
})
router.post('/bulksms', async (req: Request, res: Response) => {
  console.log('Incoming bulk SMS request');

  const { campaignName, senderId, message, sendOption, scheduleDateTime, selectedListId } = req.body;
  console.log('Request body:', req.body);

  // Check for missing required fields
  if (!campaignName || !senderId || !message || !sendOption || !selectedListId) {
    console.log('Server Error 400: Missing required fields');
    return res.status(400).json({
      error: 'Please provide all required fields: campaignName, senderId, message, sendOption, and selectedListId.'
    });
  }

  const user = res.locals.user; // Get the user from middleware

  if (!user) {
      console.error('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id;
  
  try {
    const subaccount = await SubaccountModel.findOne({ userId });
    if (!subaccount) {
      return res.status(404).json({ success: false, message: "Subaccount not found." });
    }

    const subaccountUsername = subaccount.username;
    const subaccountApiKey = subaccount.api_key;

    const { PackageName, Coins } = user.Details || {};
    console.log('User package and coins:', { PackageName, Coins });

    if (!PackageName || typeof Coins !== 'number') {
      console.log('Server Error 403: No package or invalid coins');
      return res.status(403).json({
        error: 'You cannot send SMS. Please buy a package first.'
      });
    }

    console.log('Fetching list of numbers for list_id:', selectedListId);
    const dbUser = await SignModel.findById(userId);

    if (!dbUser || typeof dbUser.Details?.Coins !== 'number') {
      console.log('Server Error 400: User details not found or invalid');
      return res.status(400).send('User details not found or invalid.');
    }

    const campaignPayload = {
      list_id: selectedListId,
      name: campaignName,
      from: senderId,
      body: message,
      schedule: scheduleDateTime,
    };

    const apiUrl = 'https://rest.clicksend.com/v3/sms-campaigns/send';
    console.log('Sending campaign to ClickSend API at:', apiUrl);

    const response = await axios.post(apiUrl, campaignPayload, {
      auth: {
        username: subaccountUsername,
        password: subaccountApiKey,
      },
    });

    console.log('ClickSend API response:', response.data);

    const { http_code, response_code, response_msg, data } = response.data;

    if (http_code === 200 && response_code === 'SUCCESS') {
      console.log('Campaign sent successfully');
      const { total_count } = data;
      const {sms_campaign_id, name, from, body, status} = data.sms_campaign
      console.log('Deducting coins:', total_count);
// Validate if Coins is a valid number
const { Coins } = dbUser.Details || {};

// Check if Coins is a valid number, otherwise set it to 0 or handle as required
if (typeof Coins !== 'number' || isNaN(Coins)) {
  console.log('Coins value is invalid or NaN, resetting to 0');
} else {
  console.log('Coins before deduction:', Coins);
}

// Now deduct coins after validation
dbUser.Details.Coins -= total_count;
await dbUser.save();
console.log('Updated user coins:', dbUser.Details.Coins);
      const list = await ListModel.findOne({ listId: selectedListId });
      console.log('Updated user coins:', dbUser.Details.Coins);
      const Campaign = new CampaignMessageModel({
        userId: userId,
        sms_campaign_id: sms_campaign_id,
        campaign_name: name,
        list_id: list?._id,
        from: from,
        body: body,
        schedule: scheduleDateTime,
        status: status,
        total_count: total_count
      })

      const savedCampaign = await Campaign.save();
      console.log('Campaign saved successfully:', savedCampaign);

      const find = await CampaignMessageModel.findOne({ userId })
      const finded = await SignModel.findByIdAndUpdate(userId, {
        $push: { campaigns: { $each: [find?._id] } } // Wrap _id in an array
      });
      
      const saved = await finded?.save()
      console.log('Campaign saved successfully:', saved);
      res.status(200).json({
        message: response_msg,
      })
    } else {
      console.log('Server Error 500: Failed to send campaign');
      res.status(500).json({
        error: 'Failed to send the campaign. Please try again later.',
      });
    }
  } catch (err: any) {
    console.error('Error occurred while sending SMS campaign:', err.response?.data || err.message);
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
  const user = res.locals.user; // Get the user from middleware

  if (!user) {
      console.error('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id; 
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: "Subaccount not found." });
  }

  // Extract subaccount ClickSend API credentials
  const subaccountUsername = subaccount?.username;
  const subaccountApiKey = subaccount?.api_key;
 // Replace with your ClickSend API key
  const encodedAuth = Buffer.from(`${subaccountUsername}:${subaccountApiKey}`).toString('base64');

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
  const { phone_number, label, country, verification_code } = req.body; // Extract fields from request body
  console.log('Request body:', req.body);

  const user = res.locals.user; // Get the user from middleware
  if (!user) {
    console.error('User not authenticated');
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id; 
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: "Subaccount not found." });
  }

  // Extract ClickSend API credentials
  const subaccountUsername = subaccount?.username;
  const subaccountApiKey = subaccount?.api_key;
  
    if (!subaccountUsername || !subaccountApiKey) {
      console.error("Missing username or API key");
      return res.status(400).json({ message: 'Username or API key missing' });
  }
  if (phone_number && label && country) {
    try {
      // Call the ClickSend API to send verification
      const apiResponse = await fetch('https://rest.clicksend.com/v3/own-numbers/verifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${subaccountUsername}:${subaccountApiKey}`).toString('base64') // Basic Auth
        },
        body: JSON.stringify({
          phone_number,
          label: label || 'Default Label', // Default label if not provided
          country
        })
      });

      // Parse response from ClickSend API
      const result = await apiResponse.json();
      console.log('Response from ClickSend API:', result);

      if (apiResponse.ok) {
        // Save verified number to the database
        const verifiedNumber = await VerifiedNumberModel.create({
          userId,
          number: phone_number,
          own_numberid: result.id,
          label,
          country
        });

        // Update user's verified numbers
        await SignModel.findByIdAndUpdate(userId, {
          $push: { verifiedNumbers: verifiedNumber._id } // Add verified number ID to user's verifiedNumbers array
        });

        // Set a timeout to delete the verified number after 1 minute
        setTimeout(async () => {
          await VerifiedNumberModel.findByIdAndDelete(verifiedNumber._id); // Delete the verified number
          await SignModel.findByIdAndUpdate(userId, {
            $pull: { verifiedNumbers: verifiedNumber._id } // Remove verified number ID from user's verifiedNumbers array
          });
          console.log(`Deleted verified number for user ${userId}:`, verifiedNumber._id);
        }, 60 * 1000); // 60 seconds in milliseconds

        res.status(200).json({ success: true, data: result, verifiedNumber }); // Respond with verified number
      } else {
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
    const find = await VerifiedNumberModel.findOne({ userId });
    if (!find) {
      console.warn('No verified number record found for user:', userId);
      return res.status(404).json({ message: 'Verification Code Expired' });
    }

    const numberId = find.own_numberid;
    const phone = find.number;
    const countryCode = find.country;

    try {
      // Call ClickSend API to verify the number with the code
      const apiResponse = await fetch(`https://rest.clicksend.com/v3/own-numbers/verifications/${numberId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${subaccountUsername}:${subaccountApiKey}`).toString('base64') // Basic Auth
        },
        body: JSON.stringify({
          country: countryCode,
          phone_number: phone, // Required field
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

router.post('/broughtnumbers', async (req: Request, res: Response) => {
  const apiUrl = 'https://rest.clicksend.com/v3/numbers';  // ClickSend API URL
  const userId = res.locals.user._id;
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: "Subaccount not found." });
  }

  // Extract subaccount ClickSend API credentials
  const subaccountUsername = subaccount?.username;
  const subaccountApiKey = subaccount?.api_key;
  try {
    // Make API request to ClickSend
    const response = await axios.get(apiUrl, {
      auth: {
        username: subaccountUsername,
        password: subaccountApiKey,  // ClickSend API key as password
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

router.post('/ownnumbers', async (req: Request, res: Response) => {
  try {

    const userId = res.locals.user._id;
    const subaccount = await SubaccountModel.findOne({ userId });
    if (!subaccount) {
      return res.status(404).json({ success: false, message: "Subaccount not found." });
    }

    // Extract subaccount ClickSend API credentials
    const subaccountApiKey = subaccount?.username;
    const subaccountUsername = subaccount?.api_key;
    console.log(subaccountApiKey, subaccountUsername);
    if (!subaccountUsername || !subaccountApiKey) {
      console.error("Missing username or API key");
      return res.status(400).json({ message: 'Username or API key missing' });
  }
  
      // Make the request to the ClickSend API
      const response = await axios.get('https://rest.clicksend.com/v3/own-numbers', {
          auth: {
              username: subaccountApiKey,
              password: subaccountUsername,
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
  console.log('Received request to fetch all alpha tags for user:', res.locals.user._id); // Log user ID

  try {
    const userId = res.locals.user._id;

    // Find the subaccount associated with the user
    const subaccount = await SubaccountModel.findOne({ userId });
    if (!subaccount) {
      console.warn('Subaccount not found for user:', userId);
      return res.status(404).json({ success: false, message: "Subaccount not found." });
    }

    const subaccountUsername = subaccount.username;
    const subaccountApiKey = subaccount.api_key;

    console.log('Subaccount credentials:', {
      username: subaccountUsername,
      apiKey: subaccountApiKey ? "Provided" : "Not Provided",
    });

    if (!subaccountUsername || !subaccountApiKey) {
      console.error("Missing username or API key");
      return res.status(400).json({ success: false, message: 'Username or API key missing' });
    }

    // Find all alpha tags for the user
    const results = await AlphaTagModel.find({ user_id: userId });
    console.log('Alpha tag query results:', results);

    // Filter out tags without `user_id_clicksend`
    const filteredResults = results.filter(tag => tag.user_id_clicksend);
    console.log('Filtered results with user_id_clicksend:', filteredResults);

    if (filteredResults.length > 0) {
      // Fetch details from ClickSend and update statuses in the database
      for (const tag of filteredResults) {
        console.log("Fetching alpha tag with PID:", tag.pid);

        try {
          const response = await axios.get(`https://rest.clicksend.com/v3/alpha-tags/${tag.pid}`, {
            auth: {
              username: subaccountUsername,
              password: subaccountApiKey,
            },
          });

          console.log(`ClickSend response for alpha tag ${tag.alpha_tag}:`, response.data);

          // Update the alpha tag status in the database
          await AlphaTagModel.findOneAndUpdate(
            { pid: response.data.id },
            { $set: { status: response.data.status } }
          );
        } catch (fetchError: any) {
          console.error(`Error fetching details for alpha tag ${tag.alpha_tag}:`, fetchError.message || fetchError);
        }
      }

      console.log('Alpha tags successfully fetched and updated.');
      return res.status(200).json({
        success: true,
        message: 'Alpha tags fetched successfully',
        data: filteredResults,
      });
    } else {
      console.warn('No alpha tags found for user:', userId);
      return res.json({
        success: false,
        error: 'No alpha tags found for this user',
        details: [],
      });
    }
  } catch (error: any) {
    console.error('Error fetching alpha tags:', error.message || error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while fetching alpha tags',
    });
  }
});


router.post('/alphatag', async (req: Request, res: Response) => {
  const { alpha_tag, reason } = req.body; // Extract alpha_tag and reason from the request body
  console.log(req.body); // Log the request body to verify data is being received correctly
  
  const user = res.locals.user; // Get the user from middleware
  if (!user) {
    console.error('User not authenticated');
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id;

  // Validate alpha_tag
  if (!alpha_tag || alpha_tag.length < 3 || alpha_tag.length > 11 || !/[A-Za-z]+/.test(alpha_tag)) {
    return res.status(400).json({ message: 'Invalid alpha tag. Must be between 3-11 characters and contain at least one letter.' });
  }

  try {
    // Save the alpha tag data to MongoDB
    const newAlphaTag = new AlphaTagModel({
      user_id: userId,
      alpha_tag: alpha_tag,
      status: 'PENDING', // Example status
      reason: reason
    });

    const savedAlphaTag = await newAlphaTag.save(); // Save and await for the operation

    console.log('Saved Alpha Tag:', savedAlphaTag);
    res.status(200).json({
      success: true,
      message: 'Alpha tag created and saved successfully',
      data: savedAlphaTag,
      user: user // Return current user's data in response
    });
  } catch (error: any) {
    console.error('Error saving alpha tag:', error.message || error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while saving alpha tag'
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

router.get('/alphatags', async (req: Request, res: Response) => {
  try {
    // Fetch all AlphaTags from the database for the current user
    const alphaTags = await AlphaTagModel.find({ user_id: res.locals.user._id }); // Fetch all alpha tags

    // Check if any alpha tags are found
    if (!alphaTags || alphaTags.length === 0) {
      return res.status(404).json({ error: 'No AlphaTags found for the user.' });
    }

    // Map the alphaTags to get an array of relevant data
    const formattedAlphaTags = alphaTags.map(tag => ({
      senderId: tag.user_id_clicksend,
      tagname: tag.alpha_tag
    }));
    console.log(alphaTags)
    // Send the AlphaTags data as JSON
    res.json(formattedAlphaTags);
  } catch (error) {
    console.error('Error fetching AlphaTags:', error);
    res.status(500).json({ error: 'Failed to fetch AlphaTags' });
  }
});

router.post('/view_campaigns', async (req: Request, res: Response) => {
  const user = res.locals.user; // Get the user from middleware

  if (!user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id; 
  const subaccount = await SubaccountModel.findOne({ userId });
  if (!subaccount) {
    return res.status(404).json({ success: false, message: "Subaccount not found." });
  }

  // Extract ClickSend API credentials from subaccount
  const subaccountApiKey = subaccount.api_key; // This should be the API Key
  const subaccountUsername = subaccount.username; // This should be the Username
  const apiUrl = 'https://rest.clicksend.com/v3/sms-campaigns';

  try {
    console.log('Sending GET request to ClickSend API to fetch SMS campaigns...');
    console.log('Subaccount Username:', subaccountUsername);
    console.log('Subaccount API Key:', subaccountApiKey); // Be cautious with sensitive data

    const response = await axios.get(apiUrl, {
      auth: {
        username: `${subaccountUsername}`, // Use the correct username
        password: `${subaccountApiKey}` // Use the correct API Key
      }
    });

    console.log('API response data:', response.data);
    console.log('Campaigns:', response.data.data); // Log the entire campaign data

    const campaigns = response.data.data.data || []; // Access the campaigns list safely

    if (campaigns.length === 0) {
      return res.status(200).json({
        http_code: 200,
        response_code: 'SUCCESS',
        response_msg: 'No SMS campaigns found.',
        data: []
      });
    }
    console.log('Campaigns by ClickSend API:', campaigns);
    const savedCampaigns = await CampaignMessageModel.find({ userId });
    console.log('Saved Campaigns:', savedCampaigns);

    res.status(200).json({
      http_code: 200,
      response_code: 'SUCCESS',
      response_msg: 'Here are your SMS campaigns.',
      data: campaigns
    });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to retrieve campaigns. Please try again later.' });
  }
});



router.get('/campaigns',(req:Request , res:Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/campaign.html'));
})

router.get('/recaver',(req:Request , res:Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/recover.html'));
})


router.post('/cancelcampaign', async (req: Request, res: Response) => {
  const { sms_campaign_id } = req.body;
  console.log('Received request to cancel campaign:', sms_campaign_id);

  const user = res.locals.user; // Get the user from middleware

  if (!user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const userId = user._id;
  const subaccount = await SubaccountModel.findOne({ userId });

  if (!subaccount) {
    return res.status(404).json({ success: false, message: 'Subaccount not found.' });
  }

  // Extract ClickSend API credentials from subaccount
  const subaccountApiKey = subaccount.api_key;
  const subaccountUsername = subaccount.username;

  const apiUrl = `https://rest.clicksend.com/v3/sms-campaigns/${sms_campaign_id}/cancel`;

  try {
    // Make the axios request to ClickSend API
    const response = await axios.post(
      apiUrl,
      {},
      {
        auth: {
          username: subaccountUsername,
          password: subaccountApiKey,
        },
      }
    );

    if (response.status === 200) {
      console.log('Campaign cancellation successful:', response.data);
      return res.status(200).json({
        success: true,
        message: 'Campaign canceled successfully.',
        data: response.data,
      });
    } else {
      console.error('Unexpected response from ClickSend API:', response.data);
      return res.status(response.status).json({
        success: false,
        message: 'Failed to cancel the campaign.',
        data: response.data,
      });
    }
  } catch (error: any) {
    console.error('Error canceling campaign:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || 'An error occurred while canceling the campaign.',
    });
  }
});


export default router;