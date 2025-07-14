const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
    name: String,
    description: String,
    category: String, // Main category of the product
    subCategory: String, // Sub-category of the product

    price: Number,
    discountedPrice: Number, // Price after discount
    stock: Number,
    lowStockThreshold: Number,

    variants: [
        {
            name: String, // e.g, "Color", "Size"
            options: [String] //e.g, ["Red", "Blue"]
        }
    ],

    options: [
        {
            optionName: String, //e.g "Size"
            values: [String] //e.g ["S","M"]
        }
    ],

    /*images: [
        {
            url: String,
            name: String,
            isPrimary: Boolean // Indicates if this image is the primary image for the product
        }
    ],*/

    materials: [String],

    isActive: Boolean,

    ratings: Number,
    createdAt: Date,
    updatedAt: Date,
    deletedAt: Date,
    isDeletedFromCart: Boolean,
    isOnSale: Boolean,

    reviews: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            rating: {
                type: Number,
                required: true,
                min: 1,
                max: 5
            },
            comment: String,
        }
    ]

})
module.exports = mongoose.model('Product', productSchema);