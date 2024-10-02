import mongoose, { Schema } from 'mongoose';
const MessageSchema = new Schema({
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
const MessageModel = mongoose.model('Message', MessageSchema);
const SignSchema = new Schema({
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
    lists: [{ type: Schema.Types.ObjectId, ref: 'List' }] // Reference to the List model
}, { timestamps: true });
const SignModel = mongoose.model('Sign', SignSchema);
const ListSchema = new Schema({
    listName: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    listId: { type: Number, required: true, unique: true },
    contacts: [
        {
            firstName: { type: String, required: false, default: "John" },
            lastName: { type: String, required: false, default: "Doe" },
            email: { type: String, required: false, default: "demo@gmail.com" },
            mix: { type: String, required: false, default: "+920000000000" }
        }
    ]
}, { timestamps: true });
const ListModel = mongoose.model('List', ListSchema);
const TokenSchema = new Schema({
    Token: { type: String, required: true, unique: true }
}, { timestamps: true });
const TokenModel = mongoose.model('Token', TokenSchema);
// Export models and interfaces
export { MessageModel, SignModel, ListModel, TokenModel };
