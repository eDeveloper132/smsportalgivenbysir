import mongoose, { Schema } from 'mongoose';
const CampaignMessageSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Foreign key to the Sign (User) model
    sms_campaign_id: { type: String, required: true }, // Unique campaign ID
    campaign_name: { type: String, required: true }, // Campaign name
    list_id: { type: Schema.Types.ObjectId, ref: 'List', required: true }, // Contact list reference
    from: { type: String, required: true }, // Sender's ID or alpha tag
    body: { type: String, required: true }, // Message content
    schedule: { type: Date, required: true }, // Scheduled time
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' }, // Status of the campaign
    total_count: { type: Number, required: true }, // Total recipients count
}, { timestamps: true } // Automatically manage createdAt and updatedAt fields
);
const CampaignMessageModel = mongoose.model('CampaignMessage', CampaignMessageSchema);
const VerifiedNumberSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Foreign key to the Sign (User) model
    number: { type: String, required: true }, // Phone number
    own_numberid: { type: String, required: true }, // Identifier for user's phone number
    label: { type: String }, // Optional label for easier identification
    country: { type: String, required: true } // Country code for the number
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields
const VerifiedNumberModel = mongoose.model('VerifiedNumber', VerifiedNumberSchema);
const AlphaTagSchema = new Schema({
    pid: { type: String, required: false, default: null }, // Unique process ID
    account_id: { type: String, required: false, default: null }, // ClickSend Account ID
    workspace_id: { type: String, required: false, default: null }, // ClickSend Workspace ID
    user_id_clicksend: { type: String, required: false, default: null }, // ClickSend User ID
    user_id: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Reference to User model
    alpha_tag: { type: String, required: true, unique: true }, // Alpha tag name
    status: { type: String, required: true }, // Status of the alpha tag
    reason: { type: String, required: true } // Reason for creating the alpha tag
}, { timestamps: true });
const AlphaTagModel = mongoose.model('AlphaTag', AlphaTagSchema);
const MessageSchema = new Schema({
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
const MessageModel = mongoose.model('Message', MessageSchema);
const SignSchema = new Schema({
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
    alphaTags: [{ type: Schema.Types.ObjectId, ref: AlphaTagModel }], // Array of alpha tag references
    campaigns: [{ type: Schema.Types.ObjectId, ref: CampaignMessageModel }] // Array of campaign references
}, { timestamps: true });
const SignModel = mongoose.model('Sign', SignSchema);
const ListSchema = new Schema({
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
const ListModel = mongoose.model('List', ListSchema);
const TokenSchema = new Schema({
    Token: { type: String, required: true, unique: true } // Required and unique token
}, { timestamps: true });
const TokenModel = mongoose.model('Token', TokenSchema);
const FileUrlSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Reference to the user (SignModel)
    listId: { type: Number, required: true }, // Reference to the list ID
    fileUrl: { type: String, required: true }, // Required file URL
    createdAt: { type: Date, default: Date.now } // Auto-generated created timestamp
});
const FileUrlModel = mongoose.model('FileUrl', FileUrlSchema);
const PhotoUrlSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true }, // Reference to the user (SignModel)
    fileUrl: { type: String, required: true }, // Required file URL
    createdAt: { type: Date, default: Date.now } // Auto-generated created timestamp
});
const PhotoUrlModel = mongoose.model('PhotoUrl', PhotoUrlSchema);
// Export models and interfaces
export { MessageModel, SignModel, ListModel, AlphaTagModel, TokenModel, FileUrlModel, PhotoUrlModel, VerifiedNumberModel, CampaignMessageModel };
// VerifiedNumberModel: Represents phone numbers that have been verified for a user. Each number has an associated userId, country code, and an optional label for categorization.
// AlphaTagModel: Used for managing alpha tags, which are sender IDs registered with ClickSend. Each alpha tag is linked to a user and includes a status (e.g., pending, approved) and a reason for creation.
// MessageModel: Represents messages sent by users. It stores details like the sender, recipient, content, message status, and scheduling options.
// SignModel: The main user model, representing individuals registered in the system. Each user can have associated messages, verified phone numbers, alpha tags, contact lists, and more. It also includes fields for email verification, role, and organization details.
// ListModel: Represents contact lists created by users, which store multiple contacts (with details like name, email, and phone number) and are linked back to the user who created the list.
// TokenModel: Stores tokens used for actions such as email verification or password reset. Each token is unique and tied to a user.
// FileUrlModel: Stores the URLs of uploaded files, linking them to the user who uploaded them and the contact list they belong to.
// PhotoUrlModel: Similar to FileUrlModel, but specifically for storing URLs of uploaded photos.
// Each schema utilizes Mongoose's timestamps feature, automatically adding createdAt and updatedAt fields to track the creation and modification times of records.
