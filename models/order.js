const mongoose = require('mongoose');
const User = require('./user');
const Product = require('./products');
const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    products:[{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref:"Product",
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            default: 1
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    orderStatus: {
        type: String,
        enum: ['Pending', 'Accepted', 'Shipped', 'Delievered', 'Not Recieved', 'Cancelled', 'Returned','Refunded','Return Requested'],
        default: 'Pending'
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed','Refunded'],
        default: 'Pending'
    },
    paymentMethod: {
        type: String,
        enum: ['Cash on Delivery', 'Online Payment'],
        default: 'Cash on Delivery'
    },
    deliveryAddress: {
        type: String,
        required: true
    },
    deliveryCity: {
        type: String,
        required: true
    },
    deliveryState: {
        type: String,
        required: true
    },
    deliveryZip: {
        type: String,
        required: true
    },
    deliveryCountry: {
        type: String,
        required: true
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    isDeletedFromCart: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
})
module.exports = mongoose.model('Order', orderSchema);