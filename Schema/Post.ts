import mongoose, { Document, Model, Schema, Types } from 'mongoose';
interface ISubaccount extends Document {
    username: string;
    subaccount_id: number;
    email: string;
    password: string;
    phonenumber: string;
    first_name: string;
    last_name: string;
    api_key: string;
    userId?: Types.ObjectId; // Reference to the parent user (SignModel)
}

const SubaccountSchema: Schema<ISubaccount> = new Schema(
    {
        subaccount_id: { type: Number, required: true, unique: true }, // Unique subaccount ID
        username: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        phonenumber: { type: String, required: true },
        first_name: { type: String, required: true },
        last_name: { type: String, required: true },
        api_key: { type: String, required: true }, // API key for the subaccount
        userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: false } // Reference to the main user
    },
    { timestamps: true }
);

const SubaccountModel: Model<ISubaccount> = mongoose.model<ISubaccount>('Subaccount', SubaccountSchema);

interface ICampaignMessage extends Document {
    userId: Types.ObjectId; // Reference to the User (SignModel)
    sms_campaign_id: string; // Unique identifier for the SMS campaign
    campaign_name: string; // Name of the campaign
    list_id: Types.ObjectId; // Reference to the contact list (ListModel)
    from: string; // Sender's identifier or alpha tag
    body: string; // Content of the message
    schedule?: string; // Scheduled time for sending the campaign
    status: string; // Campaign status (e.g., pending, sent, failed)
    total_count: number; // Total number of recipients in the campaign
}
const CampaignMessageSchema: Schema<ICampaignMessage> = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Foreign key to the Sign (User) model
        sms_campaign_id: { type: String, required: true }, // Unique campaign ID
        campaign_name: { type: String, required: true }, // Campaign name
        list_id: { type: Schema.Types.ObjectId, ref: 'List', required: true }, // Contact list reference
        from: { type: String, required: true }, // Sender's ID or alpha tag
        body: { type: String, required: true }, // Message content
        schedule: { type: String, required: false, default: () => new Date().toISOString() },
        total_count: { type: Number, required: true }, // Total recipients count
    },
    { timestamps: true } // Automatically manage createdAt and updatedAt fields
);

const CampaignMessageModel: Model<ICampaignMessage> = mongoose.model<ICampaignMessage>(
    'CampaignMessage',
    CampaignMessageSchema
);

// Interface and Schema for VerifiedNumber
interface IVerifiedNumber extends Document {
    userId: Types.ObjectId; // Reference to the User (SignModel)
    number: string; // The verified phone number
    own_numberid: string; // Unique identifier for the user's own number
    label?: string; // Optional label for the number (e.g., "Work", "Home")
    country: string; // Country code associated with the phone number
}

const VerifiedNumberSchema: Schema<IVerifiedNumber> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Foreign key to the Sign (User) model
    number: { type: String, required: true }, // Phone number
    own_numberid: { type: String, required: true }, // Identifier for user's phone number
    label: { type: String }, // Optional label for easier identification
    country: { type: String, required: true } // Country code for the number
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

const VerifiedNumberModel: Model<IVerifiedNumber> = mongoose.model<IVerifiedNumber>('VerifiedNumber', VerifiedNumberSchema);

// Interface and Schema for AlphaTag
interface IAlphaTag extends Document {
    pid?: string; // Unique process ID for the alpha tag
    account_id?: string; // Account ID from the ClickSend API
    workspace_id?: string; // Workspace ID from ClickSend
    user_id_clicksend?: string; // ClickSend's User ID associated with the alpha tag
    user_id: Types.ObjectId; // Reference to the User (SignModel)
    alpha_tag: string; // The name of the alpha tag (e.g., Sender ID)
    status: string; // Status of the alpha tag (e.g., pending, approved, rejected)
    reason: string; // Reason for alpha tag request or creation
}

const AlphaTagSchema: Schema<IAlphaTag> = new Schema({
    pid: { type: String, required: false , default: null }, // Unique process ID
    account_id: { type: String, required: false , default: null }, // ClickSend Account ID
    workspace_id: { type: String, required: false , default: null }, // ClickSend Workspace ID
    user_id_clicksend: { type: String, required: false , default: null }, // ClickSend User ID
    user_id: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Reference to User model
    alpha_tag: { type: String, required: true , unique:true }, // Alpha tag name
    status: { type: String, required: true }, // Status of the alpha tag
    reason: { type: String, required: true } // Reason for creating the alpha tag
}, { timestamps: true });

const AlphaTagModel: Model<IAlphaTag> = mongoose.model<IAlphaTag>('AlphaTag', AlphaTagSchema);

// Interface and Schema for Message
interface IMessage extends Document {
    id: string; // Message ID
    u_id: string; // User ID associated with the message
    from?: string; // Sender information (optional)
    to: string; // Recipient's phone number
    message: string; // Text of the message
    m_count: number; // Count of the message (e.g., number of parts)
    cam_id?: string; // Campaign ID (optional)
    m_schedule?: string; // Scheduled time for message sending (optional)
    status: string; // Status of the message (e.g., sent, pending)
    date: string; // Date and time of the message
}

const MessageSchema: Schema<IMessage> = new Schema({
    id: { type: String, required: true }, // Message unique ID
    u_id: { type: String, required: true }, // User ID
    from: { type: String }, // Optional sender info
    to: { type: String, required: true }, // Recipient's phone number
    message: { type: String, required: true }, // Content of the message
    m_count: { type: Number, required: true }, // Number of message parts
    cam_id: { type: String }, // Optional campaign ID
    m_schedule: { type: String }, // Optional scheduled time
    status: { type: String, required: true }, // Message status
    date: { type: String, required: true } // Date and time of the message
}, { timestamps: true });

const MessageModel: Model<IMessage> = mongoose.model<IMessage>('Message', MessageSchema);

// Interface and Schema for User (SignModel)
interface ISign extends Document {
    id?: string;
    Name?: string;
    Email: string;
    Password?: string;
    PhoneNumber?: string;
    Role?: string;
    Organization?: string;
    verificationToken?: string | null;
    verificationTokenExpiry?: Date | null;
    isVerified: boolean;
    Details: {
        PackageName?: string | null;
        PackageExpiry?: Date | null;
        Coins?: number | null;
        Status?: string | null;
    };
    messages: Types.ObjectId[];
    package: Types.ObjectId[];
    lists: Types.ObjectId[];
    verifiedNumbers: Types.ObjectId[];
    alphaTags: Types.ObjectId[];
    campaigns: Types.ObjectId[];
    subaccounts: Types.ObjectId[]; // Reference to SubaccountModel
}

const SignSchema: Schema<ISign> = new Schema(
    {
        id: { type: String },
        Name: { type: String },
        Email: { type: String, required: true, unique: true },
        Password: { type: String },
        PhoneNumber: { type: String },
        Role: { type: String },
        Organization: { type: String },
        verificationToken: { type: String, default: null },
        verificationTokenExpiry: { type: Date, default: null },
        isVerified: { type: Boolean, default: false },
        Details: {
            PackageName: { type: String, default: null },
            PackageExpiry: { type: Date, default: null },
            Coins: { type: Number, default: null },
            Status: { type: String, default: null }
        },
        messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
        package: [{ type: Schema.Types.ObjectId, ref: 'Package' }],
        lists: [{ type: Schema.Types.ObjectId, ref: 'List' }],
        verifiedNumbers: [{ type: Schema.Types.ObjectId, ref: 'VerifiedNumber' }],
        alphaTags: [{ type: Schema.Types.ObjectId, ref: 'AlphaTag' }],
        campaigns: [{ type: Schema.Types.ObjectId, ref: 'CampaignMessage' }],
        subaccounts: [{ type: Schema.Types.ObjectId, ref: 'Subaccount' }] // Reference to subaccounts
    },
    { timestamps: true }
);
const SignModel: Model<ISign> = mongoose.model<ISign>('Sign', SignSchema);

// Interface for Contact
interface IContact {
    firstName: string;
    lastName: string;
    email: string;
    mix: string; // A mixed field (can store phone number or email)
    contactid: number;
}

// Interface and Schema for List
interface IList extends Document {
    listName: string; // Name of the contact list
    createdBy: Types.ObjectId; // Reference to the user who created the list
    listId: number; // Unique list ID
    contacts: IContact[]; // Array of contacts in the list
}

const ListSchema: Schema<IList> = new Schema({
    listName: { type: String, required: true }, // List name is required
    createdBy: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Reference to the user (SignModel)
    listId: { type: Number, required: true, unique: true }, // Unique list ID
    contacts: [
        {
            firstName: { type: String, default: "John" }, // Default first name
            lastName: { type: String, default: "Doe" }, // Default last name
            email: { type: String, default: "demo@gmail.com" }, // Default email
            mix: { type: String, default: "+920000000000" }, // Default phone number
            contactid: { type: Number, default: 0 } // Default contact ID
        }
    ]
}, { timestamps: true });

const ListModel: Model<IList> = mongoose.model<IList>('List', ListSchema);

// Interface and Schema for Token
interface IToken extends Document {
    Token: string; // Unique token value
}

const TokenSchema: Schema<IToken> = new Schema({
    Token: { type: String, required: true, unique: true } // Required and unique token
}, { timestamps: true });

const TokenModel: Model<IToken> = mongoose.model<IToken>('Token', TokenSchema);

// Interface and Schema for File URL
interface IFileUrl extends Document {
    userId: Types.ObjectId; // Reference to the User (SignModel)
    listId: number; // Reference to the List (ListModel)
    fileUrl: string; // The URL of the uploaded file
    createdAt: Date; // Timestamp for when the file was uploaded
}

const FileUrlSchema: Schema<IFileUrl> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Reference to the user (SignModel)
    listId: { type: Number, required: true }, // Reference to the list ID
    fileUrl: { type: String, required: true }, // Required file URL
    createdAt: { type: Date, default: Date.now } // Auto-generated created timestamp
});

const FileUrlModel: Model<IFileUrl> = mongoose.model<IFileUrl>('FileUrl', FileUrlSchema);

// Interface and Schema for Photo URL
interface IPhotoUrl extends Document {
    userId: Types.ObjectId; // Reference to the User (SignModel)
    fileUrl: string; // The URL of the uploaded photo
    createdAt: Date; // Timestamp for when the file was uploaded
}

const PhotoUrlSchema: Schema<IPhotoUrl> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Reference to the user (SignModel)
    fileUrl: { type: String, required: true }, // Required file URL
    createdAt: { type: Date, default: Date.now } // Auto-generated created timestamp
});

const PhotoUrlModel: Model<IPhotoUrl> = mongoose.model<IPhotoUrl>('PhotoUrl', PhotoUrlSchema);

// Export models and interfaces
export {
    IMessage,
    ISign,
    IToken,
    IList,
    IAlphaTag,
    MessageModel,
    SignModel,
    IContact,
    ListModel,
    AlphaTagModel,
    TokenModel,
    IFileUrl,
    FileUrlModel,
    PhotoUrlModel,
    IPhotoUrl,
    IVerifiedNumber,
    VerifiedNumberModel,
    ICampaignMessage,
    CampaignMessageModel,
    SubaccountModel,
    ISubaccount
};


// VerifiedNumberModel: Represents phone numbers that have been verified for a user. Each number has an associated userId, country code, and an optional label for categorization.

// AlphaTagModel: Used for managing alpha tags, which are sender IDs registered with ClickSend. Each alpha tag is linked to a user and includes a status (e.g., pending, approved) and a reason for creation.

// MessageModel: Represents messages sent by users. It stores details like the sender, recipient, content, message status, and scheduling options.

// SignModel: The main user model, representing individuals registered in the system. Each user can have associated messages, verified phone numbers, alpha tags, contact lists, and more. It also includes fields for email verification, role, and organization details.

// ListModel: Represents contact lists created by users, which store multiple contacts (with details like name, email, and phone number) and are linked back to the user who created the list.

// TokenModel: Stores tokens used for actions such as email verification or password reset. Each token is unique and tied to a user.

// FileUrlModel: Stores the URLs of uploaded files, linking them to the user who uploaded them and the contact list they belong to.

// PhotoUrlModel: Similar to FileUrlModel, but specifically for storing URLs of uploaded photos.

// Each schema utilizes Mongoose's timestamps feature, automatically adding createdAt and updatedAt fields to track the creation and modification times of records.