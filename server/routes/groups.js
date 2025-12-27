const router = require('express').Router();
const Group = require('../models/Group');
const Message = require('../models/Message');
const User = require('../models/User');

// CREATE GROUP
router.post('/create-group', async (req, res, next) => {
    try {
        const { name, members, admin, avatar, description } = req.body;
        const allMembers = Array.from(new Set([...members, admin]));

        const group = await Group.create({
            name,
            description: description || '',
            members: allMembers.map(m => ({ user: m, joinedAt: new Date() })),
            admins: [admin],
            avatar,
            lastSeen: [{ user: admin, timestamp: new Date() }]
        });

        if (group) {
            const systemMsg = await Message.create({
                sender: admin,
                groupId: group._id,
                content: "created this group",
                messageType: "system"
            });

            const populatedMsg = await systemMsg.populate('sender', 'name avatar');
            const io = req.app.get('socketio');
            io.to(group._id.toString()).emit('group-msg-recieve', {
                groupId: group._id,
                from: admin,
                senderName: populatedMsg.sender.name,
                senderAvatar: populatedMsg.sender.avatar,
                msg: "created this group",
                messageType: "system",
                createdAt: populatedMsg.createdAt
            });

            return res.json({ status: true, group });
        }
        else return res.json({ status: false, msg: "Failed to create group" });
    } catch (ex) {
        next(ex);
    }
});

// GET USER GROUPS
router.get('/get-groups/:id', async (req, res, next) => {
    try {
        const userId = req.params.id;
        const groups = await Group.find({ "members.user": userId }).sort({ updatedAt: -1 });

        const groupsWithLastMessage = await Promise.all(groups.map(async (group) => {
            const memberInfo = group.members.find(m => m.user.toString() === userId);
            const joinDate = memberInfo ? memberInfo.joinedAt : new Date(0);

            const lastMessage = await Message.findOne({
                groupId: group._id,
                createdAt: { $gte: joinDate }
            })
                .sort({ createdAt: -1 })
                .populate('sender', 'name');

            // UNREAD COUNT
            const userLastSeen = group.lastSeen?.find(ls => ls.user.toString() === userId);
            const lastSeenTime = userLastSeen ? userLastSeen.timestamp : new Date(0);
            const unreadCount = await Message.countDocuments({
                groupId: group._id,
                sender: { $ne: userId },
                createdAt: { $gt: lastSeenTime, $gte: joinDate }
            });

            let content = lastMessage ? lastMessage.content : null;
            if (lastMessage && lastMessage.messageType === 'system') {
                const senderName = lastMessage.sender._id.toString() === userId ? "You" : lastMessage.sender.name;
                content = `${senderName} ${lastMessage.content}`;
            }

            return {
                _id: group._id,
                name: group.name,
                description: group.description,
                avatar: group.avatar,
                admins: group.admins,
                members: group.members.map(m => m.user),
                isGroup: true,
                lastMessage: content,
                lastMessageTime: lastMessage ? lastMessage.createdAt : null,
                lastMessageSender: lastMessage ? lastMessage.sender._id.toString() : null,
                lastMessageSenderName: lastMessage ? lastMessage.sender.name : null,
                unreadCount: unreadCount
            };
        }));

        res.json(groupsWithLastMessage);
    } catch (ex) {
        next(ex);
    }
});

// GET GROUP DETAILS
router.get('/details/:groupId', async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId)
            .populate('members.user', 'name email avatar isOnline')
            .populate('admins', 'name email avatar');

        if (group) {
            // Flatten members for consistency if needed, though frontend might expect User objects
            const flattenedGroup = group.toObject();
            flattenedGroup.members = flattenedGroup.members.map(m => ({
                ...m.user,
                joinedAt: m.joinedAt
            }));
            return res.json({ status: true, group: flattenedGroup });
        }
        else return res.json({ status: false, msg: "Group not found" });
    } catch (ex) {
        next(ex);
    }
});

// UPDATE GROUP INFO
router.post('/update-info', async (req, res, next) => {
    try {
        const { groupId, name, description, avatar } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (avatar !== undefined) updateData.avatar = avatar;

        const group = await Group.findByIdAndUpdate(groupId, updateData, { new: true });
        if (group) return res.json({ status: true, group });
        else return res.json({ status: false, msg: "Failed to update group info" });
    } catch (ex) {
        next(ex);
    }
});

// ADD MEMBERS
router.post('/add-members', async (req, res, next) => {
    try {
        const { groupId, members } = req.body; // members is an array of IDs
        const membersToAdd = members.map(m => ({ user: m, joinedAt: new Date() }));
        const group = await Group.findById(groupId);

        if (group) {
            // Filter out existing members
            const existingMemberIds = group.members.map(m => m.user.toString());
            const filteredMembers = members.filter(m => !existingMemberIds.includes(m.toString()));

            if (filteredMembers.length === 0) {
                return res.json({ status: false, msg: "All users are already members." });
            }

            const updatedGroup = await Group.findByIdAndUpdate(groupId, {
                $addToSet: {
                    members: { $each: filteredMembers.map(m => ({ user: m, joinedAt: new Date() })) }
                }
            }, { new: true });

            const addedUsers = await User.find({ _id: { $in: filteredMembers } });
            const addedNames = addedUsers.map(u => u.name).join(", ");
            const { operatorId } = req.body;
            const systemMsg = await Message.create({
                sender: operatorId || (Array.isArray(members) ? members[0] : members),
                groupId: groupId,
                content: `added ${addedNames}`,
                messageType: "system"
            });

            const populatedMsg = await systemMsg.populate('sender', 'name avatar');
            const io = req.app.get('socketio');
            if (io) {
                io.to(groupId.toString()).emit('group-msg-recieve', {
                    groupId: groupId,
                    from: (operatorId || (Array.isArray(members) ? members[0] : members)).toString(),
                    senderName: populatedMsg.sender.name,
                    senderAvatar: populatedMsg.sender.avatar,
                    msg: `added ${addedNames}`,
                    messageType: "system",
                    createdAt: populatedMsg.createdAt
                });
            }

            return res.json({ status: true, group });
        }
        else return res.json({ status: false, msg: "Failed to add members" });
    } catch (ex) {
        next(ex);
    }
});

// REMOVE MEMBER
router.post('/remove-member', async (req, res, next) => {
    try {
        const { groupId, userId } = req.body;
        const group = await Group.findByIdAndUpdate(groupId, {
            $pull: {
                members: { user: userId },
                admins: userId,
                lastSeen: { user: userId }
            }
        }, { new: true });
        if (group) {
            const removedUser = await User.findById(userId);
            const { operatorId } = req.body;
            const content = (operatorId && operatorId.toString() === userId.toString()) ? "left the group" : `removed ${removedUser.name}`;
            const systemMsg = await Message.create({
                sender: operatorId || userId,
                groupId: groupId,
                content: content,
                messageType: "system"
            });

            const populatedMsg = await systemMsg.populate('sender', 'name avatar');
            const io = req.app.get('socketio');
            if (io) {
                io.to(groupId.toString()).emit('group-msg-recieve', {
                    groupId: groupId,
                    from: (operatorId || userId).toString(),
                    senderName: populatedMsg.sender.name,
                    senderAvatar: populatedMsg.sender.avatar,
                    msg: content,
                    messageType: "system",
                    createdAt: populatedMsg.createdAt
                });
            }

            // AUTO-ADMIN: If no admins left, assign a random member
            if (group.admins.length === 0 && group.members.length > 0) {
                const randomIndex = Math.floor(Math.random() * group.members.length);
                const newAdminId = group.members[randomIndex].user;

                const finalGroup = await Group.findByIdAndUpdate(groupId, {
                    $addToSet: { admins: newAdminId }
                }, { new: true });

                const newAdmin = await User.findById(newAdminId);
                const autoAdminMsg = await Message.create({
                    sender: newAdminId,
                    groupId: groupId,
                    content: `was automatically assigned as the new admin`,
                    messageType: "system"
                });

                const populatedAutoMsg = await autoAdminMsg.populate('sender', 'name avatar');
                if (io) {
                    io.to(groupId.toString()).emit('group-msg-recieve', {
                        groupId: groupId,
                        from: newAdminId.toString(),
                        senderName: populatedAutoMsg.sender.name,
                        senderAvatar: populatedAutoMsg.sender.avatar,
                        msg: `was automatically assigned as the new admin`,
                        messageType: "system",
                        createdAt: populatedAutoMsg.createdAt
                    });
                }
                return res.json({ status: true, group: finalGroup });
            }

            return res.json({ status: true, group });
        }
        else return res.json({ status: false, msg: "Failed to remove member" });
    } catch (ex) {
        next(ex);
    }
});

// ASSIGN ADMIN
router.post('/assign-admin', async (req, res, next) => {
    try {
        const { groupId, userId } = req.body;
        const group = await Group.findByIdAndUpdate(groupId, {
            $addToSet: { admins: userId }
        }, { new: true });
        if (group) {
            const user = await User.findById(userId);
            const { operatorId } = req.body;
            const content = `made ${user.name} an admin`;
            const systemMsg = await Message.create({
                sender: operatorId || userId,
                groupId: groupId,
                content: content,
                messageType: "system"
            });

            const populatedMsg = await systemMsg.populate('sender', 'name avatar');
            const io = req.app.get('socketio');
            if (io) {
                io.to(groupId.toString()).emit('group-msg-recieve', {
                    groupId: groupId,
                    from: (operatorId || userId).toString(),
                    senderName: populatedMsg.sender.name,
                    senderAvatar: populatedMsg.sender.avatar,
                    msg: content,
                    messageType: "system",
                    createdAt: populatedMsg.createdAt
                });
            }

            return res.json({ status: true, group });
        }
        else return res.json({ status: false, msg: "Failed to assign admin" });
    } catch (ex) {
        next(ex);
    }
});

// REMOVE ADMIN
router.post('/remove-admin', async (req, res, next) => {
    try {
        const { groupId, userId } = req.body;
        const group = await Group.findByIdAndUpdate(groupId, {
            $pull: { admins: userId }
        }, { new: true });
        if (group) {
            const user = await User.findById(userId);
            const { operatorId } = req.body;
            const content = `dismissed ${user.name} as admin`;
            const systemMsg = await Message.create({
                sender: operatorId || userId,
                groupId: groupId,
                content: content,
                messageType: "system"
            });

            const populatedMsg = await systemMsg.populate('sender', 'name avatar');
            const io = req.app.get('socketio');
            if (io) {
                io.to(groupId.toString()).emit('group-msg-recieve', {
                    groupId: groupId,
                    from: (operatorId || userId).toString(),
                    senderName: populatedMsg.sender.name,
                    senderAvatar: populatedMsg.sender.avatar,
                    msg: content,
                    messageType: "system",
                    createdAt: populatedMsg.createdAt
                });
            }

            // AUTO-ADMIN: If no admins left, assign a random member
            if (group.admins.length === 0 && group.members.length > 0) {
                const randomIndex = Math.floor(Math.random() * group.members.length);
                const newAdminId = group.members[randomIndex].user;

                const finalGroup = await Group.findByIdAndUpdate(groupId, {
                    $addToSet: { admins: newAdminId }
                }, { new: true });

                const newAdmin = await User.findById(newAdminId);
                const autoAdminMsg = await Message.create({
                    sender: newAdminId,
                    groupId: groupId,
                    content: `was automatically assigned as the new admin`,
                    messageType: "system"
                });

                const populatedAutoMsg = await autoAdminMsg.populate('sender', 'name avatar');
                if (io) {
                    io.to(groupId.toString()).emit('group-msg-recieve', {
                        groupId: groupId,
                        from: newAdminId.toString(),
                        senderName: populatedAutoMsg.sender.name,
                        senderAvatar: populatedAutoMsg.sender.avatar,
                        msg: `was automatically assigned as the new admin`,
                        messageType: "system",
                        createdAt: populatedAutoMsg.createdAt
                    });
                }
                return res.json({ status: true, group: finalGroup });
            }

            return res.json({ status: true, group });
        }
        else return res.json({ status: false, msg: "Failed to remove admin" });
    } catch (ex) {
        next(ex);
    }
});

// ADD GROUP MESSAGE
router.post('/add-group-msg', async (req, res, next) => {
    try {
        const { from, groupId, message, messageType, fileUrl, fileName } = req.body;

        // CHECK IF USER IS MEMBER
        const group = await Group.findById(groupId);
        if (!group || !group.members.some(m => m.toString() === from)) {
            return res.json({ status: false, msg: "You are not a member of this group." });
        }

        const data = await Message.create({
            sender: from,
            groupId: groupId,
            content: message,
            messageType: messageType || 'text',
            fileUrl,
            fileName
        });

        if (data) return res.json({ status: true, msg: "Message added successfully." });
        else return res.json({ status: false, msg: "Failed to add message to the database" });
    } catch (ex) {
        next(ex);
    }
});

// GET GROUP MESSAGES
router.post('/get-group-msg', async (req, res, next) => {
    try {
        const { groupId, userId } = req.body;

        const group = await Group.findById(groupId);
        if (!group) return res.json({ status: false, msg: "Group not found" });

        const member = group.members.find(m => m.user.toString() === userId);
        if (!member) return res.json({ status: false, msg: "You are not a member of this group" });

        const messages = await Message.find({
            groupId: groupId,
            createdAt: { $gte: member.joinedAt }
        })
            .populate('sender', 'name avatar')
            .sort({ updatedAt: 1 });

        const projectedMessages = messages.map((msg) => {
            return {
                fromSelf: false,
                senderId: msg.sender._id,
                senderName: msg.sender.name,
                senderAvatar: msg.sender.avatar,
                message: msg.content,
                messageType: msg.messageType,
                fileUrl: msg.fileUrl,
                fileName: msg.fileName,
                createdAt: msg.createdAt
            };
        });
        res.json(projectedMessages);
    } catch (ex) {
        next(ex);
    }
});

// MARK GROUP AS READ
router.post('/mark-read', async (req, res, next) => {
    try {
        const { groupId, userId } = req.body;
        await Group.updateOne(
            { _id: groupId, "lastSeen.user": userId },
            { $set: { "lastSeen.$.timestamp": new Date() } }
        );
        // If not exists in lastSeen, push it
        await Group.updateOne(
            { _id: groupId, "lastSeen.user": { $ne: userId } },
            { $push: { lastSeen: { user: userId, timestamp: new Date() } } }
        );
        res.json({ status: true });
    } catch (ex) {
        next(ex);
    }
});

module.exports = router;
