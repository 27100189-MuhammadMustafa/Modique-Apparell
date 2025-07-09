const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: false
    },
    lastName: {
        type: String,  
    },
    email: {
        type: String,
        required: false
    },
    password: {
        type: String,
        required: false
    },
    role: {
        type: Number,
        enum: [1, 2],
        default: 2
    },
    orderCount: {
        type: Number,
        default: 0
    },
    orderReturns: {
        type: Number,
        default: 0
    }
})

module.exports = mongoose.model('User', userSchema);