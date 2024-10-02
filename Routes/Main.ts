import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import axios from "axios";
import { SignModel , ListModel , IList , IContact , MessageModel } from "../Schema/Post.js";
import { ContactListApi , ContactList , ContactApi , Contact} from "clicksend";
import {v4 as uuidv4} from 'uuid';
import { AppRes } from "../index.js";
import multer from 'multer';
import XLSX from 'xlsx';
import mongoose from 'mongoose'
import "dotenv/config";
mongoose.set('debug', true);

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

const upload = multer({
  dest: 'addnumbersbyexcel/' // Path where uploaded files will be stored
});

router.get('/addnumbersbyexcel',(req:Request , res:Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/multipleexcel.html'))
})
router.post('/addnumbersbyexcel', upload.single('file'), async(req:Request,res:Response)=>{
  try {
      const file = req.file;

      if (!file) {
          return res.status(400).json({ message: 'No file uploaded' });
      }

      // Load the file
      const workbook = XLSX.readFile(path.resolve(file.path));
      const sheetName = workbook.SheetNames[0]; // Read the first sheet
      const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      // Assuming the sheet has 'Name' and 'PhoneNumber' columns
      const extractedData = sheet.map((row: any) => ({
          name: row.Name,
          phoneNumber: row.PhoneNumber
      }));

      // Send extracted data as JSON response
      res.status(200).json({ data: extractedData });
  } catch (error) {
      console.error('Error processing file:', error);
      res.status(500).json({ message: 'Failed to process the file' });
  }
})

router.post('/saveAllNumbers', async (req: Request, res: Response) => {

  const { numbers } = req.body;
  console.log(numbers);
  console.log(req.body);
  
  const user = res.locals.user; // Modify as needed
  const userId = user._id;
  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ success: false, message: 'No numbers provided' });
  }

  try {
      // Find the user by ID
      const user = await SignModel.findById(userId);

      if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Initialize multiple_message and its fields if they are undefined
      user.multiple_message = user.multiple_message || { Name: [], Phone_Numbers: [] };
      user.multiple_message.Name = user.multiple_message.Name || [];
      user.multiple_message.Phone_Numbers = user.multiple_message.Phone_Numbers || [];

      let addedNumbers = [];

      for (const item of numbers) {
          const { name, phoneNumber } = item;

          if (!name || !phoneNumber) {
              continue; // Skip if either name or phone number is missing
          }

          const formattedNumber = `+${phoneNumber}`;
          console.log(formattedNumber);
          console.log(user);
          
          

          // Check if the number or name already exists in the user's record
          if (!user.multiple_message.Phone_Numbers.includes(formattedNumber) && 
              !user.multiple_message.Name.includes(name)) {
              user.multiple_message.Phone_Numbers.push(formattedNumber);
              user.multiple_message.Name.push(name);
              addedNumbers.push({ name, phoneNumber: formattedNumber });
          }
      }

      // Save the user with the new numbers
      await user.save();

      res.json({ success: true, message: `${addedNumbers.length} numbers added successfully`, data: addedNumbers });
  } catch (error) {
      console.error('Error saving numbers:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


router.post('/savenumber', async (req: Request, res: Response) => {
  const { name , phoneNumber } = req.body;
  console.log(req.body);
  

  const user = res.locals.user; // Modify as needed
  const userId = user._id;

  if (!name || !phoneNumber) {
      return res.status(400).json({ success: false, message: 'Invalid input' });
  }
  console.log(name , phoneNumber);
  
  const mix = `+${phoneNumber}`;
  console.log(mix);
  
  try {
      if (!userId) {
          return res.status(404).json({ success: false, message: 'User not found' });
      }

      const user = await SignModel.findById(userId);

      if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Ensure multiple_message and its fields are initialized
      user.multiple_message = user.multiple_message || { Name: [], Phone_Numbers: [] };
      user.multiple_message.Name = user.multiple_message.Name ?? [];
      user.multiple_message.Phone_Numbers = user.multiple_message.Phone_Numbers ?? [];

      // Check if the number already exists
      if (user.multiple_message.Phone_Numbers.includes(mix)) {
          return res.status(400).json({ success: false, message: 'Number already exists' });
      }

      if (user.multiple_message.Name.includes(name)) {
          return res.status(400).json({ success: false, message: 'Name already exists' });
      }

      // Add the name and number to the arrays
      user.multiple_message.Name.push(name);
      user.multiple_message.Phone_Numbers.push(mix);

      // Save the updated user document
      await user.save();

      res.json({ success: true, message: `Number added successfully: ${mix}` });
  } catch (error) {
      console.error('Error adding number:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
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
});router.delete('/listdel', async (req: Request, res: Response) => {
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

  const contactObject = {
    firstName,
    lastName,
    email,
    mix: formattedPhone
  };

  try {
    const username = 'bluebirdintegrated@gmail.com';
    const apiKey = 'EA26A5D0-7AAC-6631-478B-FC155CE94C99';

    const contactData = {
      contacts: [
        {
          first_name: firstName || '',  // Optional
          last_name: lastName || '',     // Optional
          email: email || '',            // Optional
          phone_number: `${code}${phone}`, // Ensure E.164 format
          address_line_1: "Placeholder address", // Ensure this is a valid address
          custom_1: 'CustomField1',      // Required custom_1 field
          // Add more fields if necessary
        }
      ]
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

router.get('/getnumbers',(req: Request , res: Response )=>{
  res.sendFile(path.resolve(__dirname, '../Views/numberDetails.html'));
})


router.post('/getnumbers', async (req: Request, res: Response) => {
  try {
    const user = res.locals.user;
    const userId = user._id;
      // Fetch the sign record for the user by ID
      const signRecord = await SignModel.findById(userId).select('multiple_message.Phone_Numbers multiple_message.Name');

      if (!signRecord) {
          return res.status(404).json({ message: 'Sign record not found' });
      }

      const phoneNumbers = signRecord.multiple_message.Phone_Numbers || [];
      const names = signRecord.multiple_message.Name || [];

      // Ensure both arrays are of the same length
      const maxLength = Math.max(phoneNumbers.length, names.length);

      const extendedPhoneNumbers = phoneNumbers.concat(new Array(maxLength - phoneNumbers.length).fill(''));
      const extendedNames = names.concat(new Array(maxLength - names.length).fill('Unknown'));

      res.json({ phoneNumbers: extendedPhoneNumbers, names: extendedNames });
  } catch (error) {
      res.status(500).json({ message: 'Server error', error });
  }
});


router.delete('/deletenumber', async (req, res) => {
  const user = res.locals.user;
  const userId = user._id;
  try {
      const { phoneNumber, Name } = req.body;
      
      // Log request body to ensure correct data is being sent
      console.log('Request Body:', { phoneNumber, Name });

      // Find the user's sign record
      const signRecord = await SignModel.findOne({ _id: userId });
      
      if (!signRecord) {
          return res.status(404).json({ message: 'User not found.' });
      }

      // Log sign record to check its structure
      console.log('Sign Record:', signRecord);

      // Ensure that multiple_message and Phone_Numbers exist
      if (!signRecord.multiple_message || !signRecord.multiple_message.Phone_Numbers) {
          return res.status(404).json({ message: 'Phone numbers list not found.' });
      }

      // Find the index of the phone number to be deleted
      const index = signRecord.multiple_message.Phone_Numbers.indexOf(phoneNumber);

      // Log the index to check if the number was found
      console.log('Index of number:', index);

      // Check if the phone number and name exist at the same index
      if (index === -1 || signRecord.multiple_message.Name[index] !== Name) {
          return res.status(404).json({ message: 'Phone number and name pair not found.' });
      }

      // Log the phone number and name before deletion
      console.log('Deleting:', {
          phoneNumber: signRecord.multiple_message.Phone_Numbers[index],
          name: signRecord.multiple_message.Name[index],
      });

      // Remove the phone number and name at the same index
      signRecord.multiple_message.Phone_Numbers.splice(index, 1);
      signRecord.multiple_message.Name.splice(index, 1);

      // Save the updated sign record
      await signRecord.save();

      res.status(200).json({ message: 'Phone number and name deleted successfully.' });
  } catch (error) {
      console.error('Error during deletion:', error);
      res.status(500).json({ message: 'Server error', error });
  }
});





router.get('/bulksms',(req: Request , res: Response)=>{
  res.sendFile(path.resolve(__dirname, '../Views/bulksms.html'));
})

router.post('/bulksms', async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message) {
    console.log('Server Error 400: Missing required fields');
    return res.status(400).json({ error: 'Please provide a message to send.' });
  }

  const user = res.locals.user;
  const userId = user._id;
  const packageName = user?.Details?.PackageName;
  const coins = user?.Details?.Coins;

  if (!packageName || typeof coins !== 'number') {
    console.log('Server Error 403: User package details are incomplete.');
    return res.status(403).json({ error: 'You cannot send SMS. Please buy our package first.' });
  }

  const phoneNumbers = user?.multiple_message?.Phone_Numbers;

  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    console.log('Server Error 400: No phone numbers found');
    return res.status(400).json({ error: 'No phone numbers available to send the message.' });
  }

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

    // Deduct coins for each message sent
    dbUser.Details.Coins -= phoneNumbers.length;

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

    if (response.data.data && response.data.data.messages) {
      for (const sms of response.data.data.messages) {
        if (sms.status === 'SUCCESS') {
          const newMessage = await MessageModel.create({
            id: uuidv4(),
            u_id: dbUser._id,
            from: 'Default',
            to: sms.to,
            message: message,
            m_count: 1,
            m_schedule: 'NOT PROVIDED',
            status: "SUCCESS"
          });

          const messageId = newMessage._id as mongoose.Types.ObjectId;
          dbUser.messages.push(messageId);
        }
      }

      await dbUser.save();

      console.log('Data Updated Successfully', dbUser);
      res.status(200).json({ message: 'Messages sent successfully to all numbers!' });
    } else {
      res.status(500).json({ error: 'Failed to send SMS via ClickSend.' });
    }
  } catch (err: any) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Failed to send SMS. Please try again later.' });
  }
});


export default router;