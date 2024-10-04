import mongoose, { Document, Model, Schema, Types } from 'mongoose';

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
    multiple_message: {
        Phone_Numbers?: string[];
        Name: string[];
    };
    messages: Types.ObjectId[]; // References to MessageModel
    package: Types.ObjectId[];  // References to PackageModel
    lists: Types.ObjectId[];  // References to ListModel
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
    multiple_message: {
        Phone_Numbers: { type: [String], default: [] },
        Name: { type: [String], default: [] }
    },
    messages: [{ type: Schema.Types.ObjectId, ref: MessageModel }],
    package: [{ type: Schema.Types.ObjectId, ref: 'PackageModel' }],
    lists: [{ type: Schema.Types.ObjectId, ref: 'List' }]
}, { timestamps: true });

const SignModel: Model<ISign> = mongoose.model<ISign>('Sign', SignSchema);

// Define the Contact interface and schema
interface IContact {
    firstName: string;
    lastName: string;
    email: string;
    mix: string;
    contactid: number;
}

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
            firstName: { type: String, required: false, default: "John" },
            lastName: { type: String, required: false, default: "Doe" },
            email: { type: String, required: false, default: "demo@gmail.com" },
            mix: { type: String, required: false, default: "+920000000000" },
            contactid: { type: Number, required: false, default: 0 }
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
    fileUrl: string;        // The URL of the uploaded file
    createdAt: Date;        // Timestamp for when the file was uploaded
}

const FileUrlSchema: Schema<IFileUrl> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    listId: { type: Number , required: true },
    fileUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const FileUrlModel: Model<IFileUrl> = mongoose.model<IFileUrl>('FileUrl', FileUrlSchema);

// Export models and interfaces
export {
    IMessage,
    ISign,
    IToken,
    IList,
    MessageModel,
    SignModel,
    IContact,
    ListModel,
    TokenModel,
    IFileUrl,
    FileUrlModel
};
