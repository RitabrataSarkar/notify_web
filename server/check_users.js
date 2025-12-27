const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://127.0.0.1:27017/whatschat')
    .then(async () => {
        const users = await User.find({}, { email: 1, name: 1 });
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
