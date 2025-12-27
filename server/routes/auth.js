const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// REGISTER
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const usernameCheck = await User.findOne({ name: username });
        if (usernameCheck)
            return res.json({ msg: "Username already used", status: false });
        const emailCheck = await User.findOne({ email });
        if (emailCheck)
            return res.json({ msg: "Email already used", status: false });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            email,
            name: username,
            password: hashedPassword,
        });
        delete user.password;
        return res.json({ status: true, user });
    } catch (ex) {
        next(ex);
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user)
            return res.json({ msg: "Incorrect Username or Password", status: false });
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid)
            return res.json({ msg: "Incorrect Username or Password", status: false });
        delete user.password;

        return res.json({ status: true, user });
    } catch (ex) {
        next(ex);
    }
});

// GET ALL USERS (for contacts list)
router.get('/allusers/:id', async (req, res, next) => {
    try {
        const users = await User.find({ _id: { $ne: req.params.id } }).select([
            "email",
            "name",
            "avatar",
            "_id",
        ]);
        return res.json(users);
    } catch (ex) {
        next(ex);
    }
});

// SEARCH USER BY EMAIL
router.get('/search/:email', async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.params.email }).select([
            "email",
            "name",
            "avatar",
            "_id",
        ]);
        if (user) {
            return res.json({ status: true, user });
        } else {
            return res.json({ status: false, msg: "User does not exist" });
        }
    } catch (ex) {
        next(ex);
    }
});

// SET AVATAR
router.post('/setavatar/:id', async (req, res, next) => {
    try {
        const userId = req.params.id;
        const avatarImage = req.body.image;
        const userData = await User.findByIdAndUpdate(
            userId,
            {
                avatar: avatarImage,
            },
            { new: true }
        );
        return res.json({
            isSet: true,
            image: userData.avatar,
        });
    } catch (ex) {
        next(ex);
    }
});

module.exports = router;
