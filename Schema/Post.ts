import mongoose, { Document, Model, Schema, Types } from 'mongoose';

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
    pid: string; // Unique process ID for the alpha tag
    account_id: string; // Account ID from the ClickSend API
    workspace_id: string; // Workspace ID from ClickSend
    user_id_clicksend: string; // ClickSend's User ID associated with the alpha tag
    user_id: Types.ObjectId; // Reference to the User (SignModel)
    alpha_tag: string; // The name of the alpha tag (e.g., Sender ID)
    status: string; // Status of the alpha tag (e.g., pending, approved, rejected)
    reason: string; // Reason for alpha tag request or creation
}

const AlphaTagSchema: Schema<IAlphaTag> = new Schema({
    pid: { type: String, required: true }, // Unique process ID
    account_id: { type: String, required: true }, // ClickSend Account ID
    workspace_id: { type: String, required: true }, // ClickSend Workspace ID
    user_id_clicksend: { type: String, required: true }, // ClickSend User ID
    user_id: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Reference to User model
    alpha_tag: { type: String, required: true }, // Alpha tag name
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
    status: { type: String, required: true } // Message status
}, { timestamps: true });

const MessageModel: Model<IMessage> = mongoose.model<IMessage>('Message', MessageSchema);

// Interface and Schema for User (SignModel)
interface ISign extends Document {
    id?: string;
    Name?: string; // User's name
    Email: string; // User's email (required, unique)
    Password?: string; // User's hashed password
    PhoneNumber?: string; // User's phone number
    Role?: string; // User role (e.g., admin, user)
    Organization?: string; // User's organization (if applicable)
    verificationToken?: string | null; // Token for email verification
    verificationTokenExpiry?: Date | null; // Expiry date for verification token
    isVerified: boolean; // Whether the user's email is verified
    Details: {
        PackageName?: string | null; // Name of the package the user subscribed to
        PackageExpiry?: Date | null; // Package expiry date
        Coins?: number | null; // Number of coins in user's account
        Status?: string | null; // Additional status info
    };
    messages: Types.ObjectId[]; // Reference to MessageModel
    package: Types.ObjectId[];  // Reference to PackageModel (if applicable)
    lists: Types.ObjectId[];  // Reference to ListModel
    verifiedNumbers: Types.ObjectId[]; // Reference to VerifiedNumberModel
    alphaTags: Types.ObjectId[]; // Reference to AlphaTagModel
}

const SignSchema: Schema<ISign> = new Schema({
    id: { type: String },
    Name: { type: String }, // Optional user name
    Email: { type: String, required: true, unique: true }, // Required and unique email
    Password: { type: String }, // Hashed password
    PhoneNumber: { type: String }, // Optional phone number
    Role: { type: String }, // Optional role
    Organization: { type: String }, // Optional organization field
    verificationToken: { type: String, default: null }, // Default to null if not present
    verificationTokenExpiry: { type: Date, default: null }, // Expiry date of token
    isVerified: { type: Boolean, default: false }, // Default to unverified
    Details: {
        PackageName: { type: String, default: null }, // Default to null
        PackageExpiry: { type: Date, default: null }, // Default to null
        Coins: { type: Number, default: null }, // Default to null
        Status: { type: String, default: null } // Default to null
    },
    messages: [{ type: Schema.Types.ObjectId, ref: MessageModel }], // Array of message references
    package: [{ type: Schema.Types.ObjectId, ref: 'PackageModel' }], // Array of package references
    lists: [{ type: Schema.Types.ObjectId, ref: 'List' }], // Array of list references
    verifiedNumbers: [{ type: Schema.Types.ObjectId, ref: VerifiedNumberModel }], // Array of verified number references
    alphaTags: [{ type: Schema.Types.ObjectId, ref: AlphaTagModel }] // Array of alpha tag references
}, { timestamps: true });

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
    VerifiedNumberModel
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