import mongoose, { Document, Model, Schema, Types } from 'mongoose';

interface IVerifiedNumber extends Document {
    userId: Types.ObjectId; // Reference to the User (SignModel)
    number: string; // The verified phone number
    own_numberid: string; // The unique identifier for the own number
    label?: string; // Optional label for the number
    country: string; // The country code
}

const VerifiedNumberSchema: Schema<IVerifiedNumber> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    number: { type: String, required: true },
    own_numberid: { type: String, required: true },
    label: { type: String },
    country: { type: String, required: true }
}, { timestamps: true });

const VerifiedNumberModel: Model<IVerifiedNumber> = mongoose.model<IVerifiedNumber>('VerifiedNumber', VerifiedNumberSchema);

// Define the Alpha Tag interface and schema
interface IAlphaTag extends Document {
    pid: string;
    account_id: string; // ClickSend Account ID
    workspace_id: string; // ClickSend Workspace ID
    user_id_clicksend: string; // ClickSend User ID
    user_id: Types.ObjectId; // Reference to the User (SignModel)
    alpha_tag: string; // The alpha tag name
    status: string; // The status of the alpha tag
    reason: string; // The reason for creating the alpha tag
}

const AlphaTagSchema: Schema<IAlphaTag> = new Schema({
    pid: { type: String, required: true },
    account_id: { type: String, required: true },
    workspace_id: { type: String, required: true },
    user_id_clicksend: { type: String, required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    alpha_tag: { type: String, required: true },
    status: { type: String, required: true },
    reason: { type: String, required: true }
}, { timestamps: true });

const AlphaTagModel: Model<IAlphaTag> = mongoose.model<IAlphaTag>('AlphaTag', AlphaTagSchema);
// Define the Message interface and schema
interface IMessage extends Document {
    id: string;
    u_id: string;
    from?: string;
    to: string;
    message: string;
    m_count: number;
    cam_id?: string;
    m_schedule?: string;
    status: string;
}

const MessageSchema: Schema<IMessage> = new Schema({
    id: { type: String, required: true },
    u_id: { type: String, required: true },
    from: { type: String },
    to: { type: String, required: true },
    message: { type: String, required: true },
    m_count: { type: Number, required: true },
    cam_id: { type: String },
    m_schedule: { type: String },
    status: { type: String, required: true }
}, { timestamps: true });

const MessageModel: Model<IMessage> = mongoose.model<IMessage>('Message', MessageSchema);

// Define the Sign interface and schema
// Update the ISign interface to include alphaTags
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
    messages: Types.ObjectId[]; // References to MessageModel
    package: Types.ObjectId[];  // References to PackageModel
    lists: Types.ObjectId[];  // References to ListModel
    verifiedNumbers: Types.ObjectId[]; // References to VerifiedNumberModel
    alphaTags: Types.ObjectId[]; // References to AlphaTagModel
}

const SignSchema: Schema<ISign> = new Schema({
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
    messages: [{ type: Schema.Types.ObjectId, ref: MessageModel }],
    package: [{ type: Schema.Types.ObjectId, ref: 'PackageModel' }],
    lists: [{ type: Schema.Types.ObjectId, ref: 'List' }],
    verifiedNumbers: [{ type: Schema.Types.ObjectId, ref: VerifiedNumberModel }], // Reference to VerifiedNumberModel
    alphaTags: [{ type: Schema.Types.ObjectId, ref: AlphaTagModel }] // Reference to AlphaTagModel
}, { timestamps: true });
const SignModel: Model<ISign> = mongoose.model<ISign>('Sign', SignSchema);

// Define the Contact interface
interface IContact {
    firstName: string;
    lastName: string;
    email: string;
    mix: string;
    contactid: number;
}

// Define the List interface and schema
interface IList extends Document {
    listName: string;
    createdBy: Types.ObjectId;
    listId: number;
    contacts: IContact[];
}

const ListSchema: Schema<IList> = new Schema({
    listName: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    listId: { type: Number, required: true, unique: true },
    contacts: [
        {
            firstName: { type: String, default: "John" },
            lastName: { type: String, default: "Doe" },
            email: { type: String, default: "demo@gmail.com" },
            mix: { type: String, default: "+920000000000" },
            contactid: { type: Number, default: 0 }
        }
    ]
}, { timestamps: true });

const ListModel: Model<IList> = mongoose.model<IList>('List', ListSchema);

// Define the Token interface and schema
interface IToken extends Document {
    Token: string;
}

const TokenSchema: Schema<IToken> = new Schema({
    Token: { type: String, required: true, unique: true }
}, { timestamps: true });

const TokenModel: Model<IToken> = mongoose.model<IToken>('Token', TokenSchema);

// Define the File URL schema and interface
interface IFileUrl extends Document {
    userId: Types.ObjectId; // Reference to the User (SignModel)
    listId: number; // Reference to the List (ListModel)
    fileUrl: string; // The URL of the uploaded file
    createdAt: Date; // Timestamp for when the file was uploaded
}

const FileUrlSchema: Schema<IFileUrl> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    listId: { type: Number, required: true },
    fileUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const FileUrlModel: Model<IFileUrl> = mongoose.model<IFileUrl>('FileUrl', FileUrlSchema);

// Define the Photo URL schema and interface
interface IPhotoUrl extends Document {
    userId: Types.ObjectId; // Reference to the User (SignModel)
    fileUrl: string; // The URL of the uploaded file
    createdAt: Date; // Timestamp for when the file was uploaded
}

const PhotoUrlSchema: Schema<IPhotoUrl> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    fileUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
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