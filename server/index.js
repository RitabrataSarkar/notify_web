const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const communityRoutes = require('./routes/communities');
const User = require('./models/User');
const Group = require('./models/Group');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

app.set('socketio', io);
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/whatschat')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/communities', communityRoutes);

// Socket.io
global.onlineUsers = new Map();

io.on('connection', (socket) => {
    global.chatSocket = socket;

    socket.on('add-user', async (userId) => {
        onlineUsers.set(userId, socket.id);
        await User.findByIdAndUpdate(userId, { isOnline: true });
        socket.broadcast.emit('user-online', userId);
    });

    socket.on('join-group', (groupId) => {
        socket.join(groupId.toString());
    });

    socket.on('send-group-msg', async (data) => {
        const Group = require('./models/Group');
        const group = await Group.findById(data.groupId);
        if (group && group.members.some(m => m.user.toString() === data.from)) {
            socket.to(data.groupId.toString()).emit('group-msg-recieve', data);
        }
    });

    socket.on('join-community', (communityId) => {
        socket.join(communityId.toString());
    });

    socket.on('send-community-msg', async (data) => {
        const Community = require('./models/Community');
        const community = await Community.findById(data.communityId);
        if (community && community.members.some(m => m.user.toString() === data.from)) {
            socket.to(data.communityId.toString()).emit('community-msg-recieve', data);
        }
    });

    socket.on('leave-group', (groupId) => {
        socket.leave(groupId.toString());
    });

    socket.on('send-msg', (data) => {
        const sendUserSocket = onlineUsers.get(data.to);
        if (sendUserSocket) {
            socket.to(sendUserSocket).emit('msg-recieve', data);
        }
    });

    socket.on('disconnect', async () => {
        // Find user by socket id and set offline
        for (let [id, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(id);
                await User.findByIdAndUpdate(id, { isOnline: false });
                socket.broadcast.emit('user-offline', id);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
