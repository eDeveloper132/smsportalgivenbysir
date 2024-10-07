import mongoose, { Schema } from 'mongoose';
const VerifiedNumberSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    number: { type: String, required: true },
    own_numberid: { type: String, required: true },
    label: { type: String },
    country: { type: String, required: true }
}, { timestamps: true });
const VerifiedNumberModel = mongoose.model('VerifiedNumber', VerifiedNumberSchema);
const AlphaTagSchema = new Schema({
    pid: { type: String, required: true },
    account_id: { type: String, required: true },
    workspace_id: { type: String, required: true },
    user_id_clicksend: { type: String, required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    alpha_tag: { type: String, required: true },
    status: { type: String, required: true },
    reason: { type: String, required: true }
}, { timestamps: true });
const AlphaTagModel = mongoose.model('AlphaTag', AlphaTagSchema);
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
    messages: [{ type: Schema.Types.ObjectId, ref: MessageModel }],
    package: [{ type: Schema.Types.ObjectId, ref: 'PackageModel' }],
    lists: [{ type: Schema.Types.ObjectId, ref: 'List' }],
    verifiedNumbers: [{ type: Schema.Types.ObjectId, ref: VerifiedNumberModel }], // Reference to VerifiedNumberModel
    alphaTags: [{ type: Schema.Types.ObjectId, ref: AlphaTagModel }] // Reference to AlphaTagModel
}, { timestamps: true });
const SignModel = mongoose.model('Sign', SignSchema);
const ListSchema = new Schema({
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
const ListModel = mongoose.model('List', ListSchema);
const TokenSchema = new Schema({
    Token: { type: String, required: true, unique: true }
}, { timestamps: true });
const TokenModel = mongoose.model('Token', TokenSchema);
const FileUrlSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    listId: { type: Number, required: true },
    fileUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const FileUrlModel = mongoose.model('FileUrl', FileUrlSchema);
const PhotoUrlSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'Sign', required: true },
    fileUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const PhotoUrlModel = mongoose.model('PhotoUrl', PhotoUrlSchema);
// Export models and interfaces
export { MessageModel, SignModel, ListModel, AlphaTagModel, TokenModel, FileUrlModel, PhotoUrlModel, VerifiedNumberModel };
