const router = require('express').Router();
const Message = require('../models/Message');

// ADD MESSAGE
router.post('/addmsg', async (req, res, next) => {
    try {
        const { from, to, message, messageType, fileUrl, fileName } = req.body;
        const data = await Message.create({
            sender: from,
            recipient: to,
            content: message,
            messageType: messageType || 'text',
            fileUrl,
            fileName
        });

        if (data) return res.json({ msg: "Message added successfully." });
        else return res.json({ msg: "Failed to add message to the database" });
    } catch (ex) {
        next(ex);
    }
});

// GET MESSAGES
router.post('/getmsg', async (req, res, next) => {
    try {
        const { from, to } = req.body;

        const messages = await Message.find({
            $or: [
                { sender: from, recipient: to },
                { sender: to, recipient: from }
            ]
        }).sort({ updatedAt: 1 });

        const projectedMessages = messages.map((msg) => {
            return {
                fromSelf: msg.sender.toString() === from,
                message: msg.content,
                messageType: msg.messageType,
                fileUrl: msg.fileUrl,
                fileName: msg.fileName,
                createdAt: msg.createdAt,
                read: msg.read
            };
        });
        res.json(projectedMessages);
    } catch (ex) {
        next(ex);
    }
});

// GET UNIQUE CONTACTS WITH LAST MSG & UNREAD COUNT
router.get('/get-contacts/:id', async (req, res, next) => {
    try {
        const userId = req.params.id;
        const messages = await Message.find({
            $and: [
                {
                    $or: [{ sender: userId }, { recipient: userId }]
                },
                {
                    groupId: { $exists: false }
                }
            ]
        }).populate('sender recipient', 'name email avatar _id').sort({ createdAt: -1 });

        const contactsMap = new Map();

        messages.forEach(msg => {
            const otherUser = msg.sender._id.toString() === userId ? msg.recipient : msg.sender;
            if (!otherUser) return;
            const otherUserId = otherUser._id.toString();

            if (!contactsMap.has(otherUserId)) {
                contactsMap.set(otherUserId, {
                    _id: otherUser._id,
                    name: otherUser.name,
                    email: otherUser.email,
                    avatar: otherUser.avatar,
                    lastMessage: msg.content,
                    lastMessageTime: msg.createdAt,
                    lastMessageSender: msg.sender._id.toString(),
                    lastMessageRead: msg.read,
                    unreadCount: 0
                });
            }

            const contact = contactsMap.get(otherUserId);
            if (msg.sender._id.toString() === otherUserId && !msg.read) {
                contact.unreadCount += 1;
            }
        });

        res.json(Array.from(contactsMap.values()));
    } catch (ex) {
        next(ex);
    }
});

// MARK MESSAGES AS READ
router.post('/mark-read', async (req, res, next) => {
    try {
        const { from, to } = req.body;
        await Message.updateMany(
            { sender: from, recipient: to, read: false },
            { $set: { read: true } }
        );
        res.json({ msg: "Messages marked as read" });
    } catch (ex) {
        next(ex);
    }
});

module.exports = router;
