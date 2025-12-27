const router = require('express').Router();
const Community = require('../models/Community');
const Message = require('../models/Message');
const User = require('../models/User');

// CREATE COMMUNITY
router.post('/create', async (req, res, next) => {
    try {
        const { name, description, admin, avatar } = req.body;
        const community = await Community.create({
            name,
            description: description || '',
            members: [{ user: admin, joinedAt: new Date() }],
            admin,
            avatar,
            lastSeen: [{ user: admin, timestamp: new Date() }]
        });
        if (community) return res.json({ status: true, community });
        else return res.json({ status: false, msg: "Failed to create community" });
    } catch (ex) {
        next(ex);
    }
});

// GET COMMUNITIES (JOINED & DISCOVER)
router.get('/get-all/:userId', async (req, res, next) => {
    try {
        const userId = req.params.userId;
        const communities = await Community.find().sort({ name: 1 });

        const formattedCommunities = await Promise.all(communities.map(async (community) => {
            const isMember = community.members.some(m => m.user.toString() === userId);

            let lastMessage = null;
            let unreadCount = 0;

            if (isMember) {
                const memberInfo = community.members.find(m => m.user.toString() === userId);
                const joinDate = memberInfo.joinedAt;

                lastMessage = await Message.findOne({
                    communityId: community._id,
                    createdAt: { $gte: joinDate }
                }).sort({ createdAt: -1 }).populate('sender', 'name');

                const userLastSeen = community.lastSeen?.find(ls => ls.user.toString() === userId);
                const lastSeenTime = userLastSeen ? userLastSeen.timestamp : new Date(0);

                unreadCount = await Message.countDocuments({
                    communityId: community._id,
                    sender: { $ne: userId },
                    createdAt: { $gt: lastSeenTime, $gte: joinDate }
                });
            }

            return {
                _id: community._id,
                name: community.name,
                description: community.description,
                avatar: community.avatar,
                admin: community.admin,
                isMember,
                memberCount: community.members.length,
                isCommunity: true,
                lastMessage: lastMessage ? lastMessage.content : null,
                lastMessageTime: lastMessage ? lastMessage.createdAt : null,
                lastMessageSenderName: lastMessage ? lastMessage.sender.name : null,
                unreadCount
            };
        }));

        res.json(formattedCommunities);
    } catch (ex) {
        next(ex);
    }
});

// JOIN COMMUNITY
router.post('/join', async (req, res, next) => {
    try {
        const { communityId, userId } = req.body;
        const community = await Community.findByIdAndUpdate(communityId, {
            $addToSet: {
                members: { user: userId, joinedAt: new Date() },
                lastSeen: { user: userId, timestamp: new Date() }
            }
        }, { new: true });
        if (community) return res.json({ status: true, community });
        else return res.json({ status: false, msg: "Failed to join community" });
    } catch (ex) {
        next(ex);
    }
});

// LEAVE COMMUNITY
router.post('/leave', async (req, res, next) => {
    try {
        const { communityId, userId } = req.body;
        const community = await Community.findByIdAndUpdate(communityId, {
            $pull: {
                members: { user: userId },
                lastSeen: { user: userId }
            }
        }, { new: true });
        if (community) return res.json({ status: true, community });
        else return res.json({ status: false, msg: "Failed to leave community" });
    } catch (ex) {
        next(ex);
    }
});

// ADD COMMUNITIES MESSAGE
router.post('/add-msg', async (req, res, next) => {
    try {
        const { from, communityId, message, messageType, fileUrl, fileName } = req.body;

        const community = await Community.findById(communityId);
        if (!community || !community.members.some(m => m.user.toString() === from)) {
            return res.json({ status: false, msg: "You are not a member of this community." });
        }

        const data = await Message.create({
            sender: from,
            communityId: communityId,
            content: message,
            messageType: messageType || 'text',
            fileUrl,
            fileName
        });

        if (data) return res.json({ status: true, msg: "Message added successfully." });
        else return res.json({ status: false, msg: "Failed to add message" });
    } catch (ex) {
        next(ex);
    }
});

// GET COMMUNITIES MESSAGES
router.post('/get-msg', async (req, res, next) => {
    try {
        const { communityId, userId } = req.body;
        const community = await Community.findById(communityId);
        if (!community) return res.json({ status: false, msg: "Community not found" });

        const member = community.members.find(m => m.user.toString() === userId);
        if (!member) return res.json({ status: false, msg: "You are not a member of this community" });

        const messages = await Message.find({
            communityId: communityId,
            createdAt: { $gte: member.joinedAt }
        }).populate('sender', 'name avatar').sort({ updatedAt: 1 });

        const projectedMessages = messages.map(msg => ({
            fromSelf: (msg.sender._id || msg.sender).toString() === userId,
            senderId: msg.sender._id,
            senderName: msg.sender.name,
            senderAvatar: msg.sender.avatar,
            message: msg.content,
            messageType: msg.messageType,
            fileUrl: msg.fileUrl,
            fileName: msg.fileName,
            createdAt: msg.createdAt
        }));

        res.json(projectedMessages);
    } catch (ex) {
        next(ex);
    }
});

// MARK COMMUNITY AS READ
router.post('/mark-read', async (req, res, next) => {
    try {
        const { communityId, userId } = req.body;
        await Community.updateOne(
            { _id: communityId, "lastSeen.user": userId },
            { $set: { "lastSeen.$.timestamp": new Date() } }
        );
        await Community.updateOne(
            { _id: communityId, "lastSeen.user": { $ne: userId } },
            { $push: { lastSeen: { user: userId, timestamp: new Date() } } }
        );
        res.json({ status: true });
    } catch (ex) {
        next(ex);
    }
});

// GET COMMUNITY DETAILS
router.get('/details/:communityId', async (req, res, next) => {
    try {
        const community = await Community.findById(req.params.communityId)
            .populate('members.user', 'name email avatar isOnline')
            .populate('admin', 'name email avatar');

        if (community) {
            const formattedCommunity = community.toObject();
            formattedCommunity.members = formattedCommunity.members.map(m => ({
                ...m.user,
                joinedAt: m.joinedAt
            }));
            return res.json({ status: true, community: formattedCommunity });
        }
        else return res.json({ status: false, msg: "Community not found" });
    } catch (ex) {
        next(ex);
    }
});

// UPDATE COMMUNITY INFO
router.post('/update-info', async (req, res, next) => {
    try {
        const { communityId, name, description, avatar } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (avatar !== undefined) updateData.avatar = avatar;

        const community = await Community.findByIdAndUpdate(communityId, updateData, { new: true });
        if (community) return res.json({ status: true, community });
        else return res.json({ status: false, msg: "Failed to update community info" });
    } catch (ex) {
        next(ex);
    }
});

module.exports = router;
