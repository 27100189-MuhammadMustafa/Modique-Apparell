const mongoose= require('mongoose');
const discountSchema = new mongoose.Schema({
    name: {
        type: String,
        required:true,
    },
    displayName: {
        type: String,
        required: true
    },
    products: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
    }],
    discountPercentage: {
        type: Number,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
});
module.exports = mongoose.model('Discount', discountSchema);