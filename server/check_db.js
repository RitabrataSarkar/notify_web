const mongoose = require('mongoose');
const Message = require('./models/Message');

mongoose.connect('mongodb://127.0.0.1:27017/whatschat')
    .then(async () => {
        try {
            const countNoGroup = await Message.countDocuments({ groupId: { $exists: false } });
            console.log('Messages without groupId:', countNoGroup);

            const countNullGroup = await Message.countDocuments({ groupId: null });
            console.log('Messages with groupId null:', countNullGroup);

            const all = await Message.countDocuments({});
            console.log('Total messages:', all);

            const messages = await Message.find({ groupId: { $exists: false } }).limit(5);
            console.log('Sample messages without groupId:', messages);
        } catch (err) {
            console.error(err);
        } finally {
            process.exit();
        }
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
