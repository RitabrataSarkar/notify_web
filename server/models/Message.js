const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
    },
    communityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community'
    },
    content: {
        type: String,
        required: true
    },
    messageType: {
        type: String,
        default: 'text',
        enum: ['text', 'image', 'video', 'document', 'system']
    },
    fileUrl: {
        type: String
    },
    fileName: {
        type: String
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
