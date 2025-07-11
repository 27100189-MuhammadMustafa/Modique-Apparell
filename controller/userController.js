const User = require('../models/user');
const express = require("express")
const jwt = require("jsonwebtoken")
const {check,validationResult} = require("express-validator");
const bcrypt = require("bcryptjs");
const Product = require('../models/products');
const Order = require('../models/order');
const Discount = require('../models/discounts');


exports.getUsers = async (req, res) => {
    const role = req.query.role;
    if(role && role !== '1' && role !== '2') {
        return res.status(400).send("Invalid role specified");
    }
    const users = await User.find({role: parseInt(role)}).select('-password');
    if(users.length === 0) {
        return res.status(400).send("No users found");
    }
    return res.status(200).send(users);
};
exports.getUserById = async (req,res) => {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if(!user) {
        res.status(400).send("No user found!");
    }
    res.status(200).send(user);
}

exports.postSignUp = [
    check("firstName")
    .trim()
    .isLength({min:2})
    .withMessage("First Name should be at least 2 characters long")
    .matches(/^[A-Za-z\s]+$/)
    .withMessage("First Name should contain only alphabets"),

    check("lastName")
    .matches(/^[A-Za-z\s]*$/)
    .withMessage("Last Name should contain only alphabets"),

    check("email")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

    check("password")
    .isLength({min: 8})
    .trim(),
     async (req,res) =>  {
        const error = validationResult(req)
        if(error.isEmpty()){
            const { firstName , lastName, email, password} = req.body

            const user = await User.findOne({email})
            if(user)
            {
                return res.status(400).send("User exists already go to login page")
            }
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 12)
            const newUser = new User ({
                firstName,
                lastName,
                email,
                password: hashedPassword
            })
            const savedUser = await newUser.save()
            const token = jwt.sign(
                { userId: savedUser._id, email: savedUser.email },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            )
            return res.status(200).send({msg: "User registered Successfully", token: token})
        }
        else
        {
            res.status(400).send("Invalid credentials")
        }
    }
]
exports.postLogin = async (req,res) => {
    const {email, password} = req.body;
    const user = await User.findOne({email})
    if(!user) {
        return res.status(400).send("User does not exist");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch){
        return res.status(400).send("Invalid Password")
    }
    const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
    return res.status(200).send({msg: "User logged in successfully", token: token});
}
exports.postLogout = (req,res) => {
    res.redirect('/login');
}

exports.postAddProduct = async ( req, res) => {
    const {name, description, category, subCategory, price, stock, lowStockThreshold,variants, options, materials} = req.body;
    if (!name || !description || !category || !subCategory || !price || !stock) {
        return res.status(400).send("Please provide all required fields");
    }
    const newProduct = new Product({
        name,
        description,
        category,
        subCategory,
        price,
        stock,
        lowStockThreshold,
        variants,
        options,
        materials,
        isActive: true,
        ratings: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        isDeletedFromCart: false
    });
    const savedProduct = await newProduct.save();
    return res.status(201).send("Product added successfully");
}
exports.getProducts = async (req,res) => {
    const products = await Product.find();
    if(products.length === 0)
    {
        return res.status(400).send("No products found")
    }
    return res.status(200).send(products);
}
exports.getProductById = async (req, res) => {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if(!product) {
        return res.status(400).send("No product found with this ID");
    }
    return res.status(200).json(product);
}
exports.updateProduct = async (req, res) => {
    const productId = req.params.id;
    const {name, description, category, subCategory, price, stock, lowStockThreshold, hashVariants, variants, options, materials} = req.body;
    
    const product = await Product.findById(productId);
    if(!product) {
        return res.status(400).send("No product found with this ID");
    }
    
    product.name = name || product.name;
    product.description = description || product.description;
    product.category = category || product.category;
    product.subCategory = subCategory || product.subCategory;
    product.price = price || product.price;
    product.stock = stock || product.stock;
    product.lowStockThreshold = lowStockThreshold || product.lowStockThreshold;
    product.hashVariants = hashVariants !== undefined ? hashVariants : product.hashVariants;
    product.variants = variants || product.variants;
    product.options = options || product.options;
    product.materials = materials || product.materials;
    
    const updatedProduct = await product.save();
    
    return res.status(200).send({msg:"Product updated successfully"}, {product: updatedProduct});
}
exports.deleteProduct = async (req, res) => {
    const productId = req.params.id;
    const deletedProduct = await Product.findByIdAndDelete(productId);
    if(!deletedProduct) {
        return res.status(400).send("No product found with this ID");
    }
    return res.status(200).send("Product deleted successfully");
}
exports.getFilteredProducts = async (req, res) => {
    const { category, subCategory, minPrice, maxPrice, sizes, colors, sortBy, page = 1, limit = 10} = req.query;
    const filter = {};
    if (category) {
        filter.category = category;
    }
    if (subCategory) {
        filter.subCategory = subCategory;
    }
    if (minPrice) {
        filter.price = { $gte: parseFloat(minPrice) };
    }
    if (maxPrice) {
        filter.price = { ...filter.price, $lte: parseFloat(maxPrice) };
    }
    if (sizes) {
        filter['options.values'] = { $in: sizes.split(',') };
    }
    if (colors) {
        filter['variants.options'] = { $in: colors.split(',') };
    }
    const sort = {};
    if (sortBy) {
        const [field, order] = sortBy.split(':');
        sort[field] = order === 'desc' ? -1 : 1;
    }
    const skip = (page - 1) * limit;
    const products = await Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));
    return res.status(200).json(products);
}
exports.updateStock = async (req,res) => {
    const productId = req.params.id;
    const {action,quantity} = req.body;
    const product = await Product.findById(productId);
    if(!product) {
        return res.status(400).send("No product found with this ID");
    }
    if(action === 'increase') {
        product.stock += quantity;
    }else if(action === 'decrease') {
        if(product.stock < quantity) {
            return res.status(400).send("Insufficient stock to decrease");
        }
        product.stock -= quantity;
    }else {
        return res.status(400).send("Invalid action. Use 'increase' or 'decrease'");
    }
    product.updatedAt = new Date();
    await product.save();
    return res.status(200).send("Stock updated successfully");
}
exports.updatePrice = async (req, res) => {
    const productId = req.params.id;
    const { newPrice } = req.body;
    const product = await Product.findById(productId);
    if(!product) {
        return res.status(400).send("No product found with this ID");
    }
    if(newPrice <= 0) {
        return res.status(400).send("Price must be greater than zero");
    }
    product.price = newPrice;
    product.updatedAt = new Date();
    await product.save();
    return res.status(200).send({msg:"Price updated successfully" , newPrice: product.price});
}
exports.getLowStockProducts = async (req, res) => {
    const lowStockProducts = await Product.find({ 
        $expr: { $lte: ["$stock", "$lowStockThreshold"] }
    });
    if(lowStockProducts.length === 0) {
        return res.status(400).send("No low stock products found");
    }
    return res.status(200).json(lowStockProducts);
}
exports.placeOrder = async (req, res) => {
    console.log("in this middleware");
    const { products, deliveryAddress, deliveryCity, deliveryState, deliveryZip, deliveryCountry, paymentMethod, email, phoneNumber, firstName, lastName } = req.body;
    
    let user = await User.findOne({ email: email });
    let userId = user ? user._id : undefined;
    
    if (!products || products.length === 0) {
        return res.status(400).send("No products in the order");
    }
    
    if (!user) {
        user = new User({
            firstName: firstName || '',
            lastName: lastName || '',
            email: email,
            phoneNumber: phoneNumber || '',
            role: 1,
            orderCount: 0,
            orderReturns: 0
        });
        await user.save();
        userId = user._id;
    }
    
    let total = 0;
    
    for (const product of products) {
        const productDetails = await Product.findById(product.productId);
        if (!productDetails) {
            return res.status(400).send(`Product with ID ${product.productId} not found`);
        }
        const quantity = Number(product.quantity);
        if (isNaN(quantity) || quantity <= 0) {
            return res.status(400).send(`Invalid quantity for product ${productDetails.name}`);
        }
        if (productDetails.stock < quantity) {
            return res.status(400).send(`Insufficient stock for product ${productDetails.name}`);
        }
    
        productDetails.stock -= quantity;
        if (productDetails.stock <= 0) {
            productDetails.isActive = false;
        }
        await productDetails.save();
    
        const amount = productDetails.price * quantity;
        total += amount;
    }
    
    const newOrder = new Order({
        userId: userId,
        products: products,
        totalAmount: total,
        orderStatus: 'Pending',
        paymentStatus: 'Pending',
        paymentMethod: paymentMethod || 'Cash on Delivery',
        deliveryAddress: deliveryAddress,
        deliveryCity: deliveryCity,
        deliveryState: deliveryState,
        deliveryZip: deliveryZip,
        deliveryCountry: deliveryCountry,
        email: email || user.email,
        phoneNumber: phoneNumber || user.phoneNumber,
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        orderDate: new Date()
    });
    
    const savedOrder = await newOrder.save();
    user.orderCount = (user.orderCount || 0) + 1;
    await user.save();
    
    return res.status(201).send({ msg: "Order placed successfully", orderId: savedOrder._id });
}
exports.viewOrders = async (req, res) => {
    const orders = await Order.find();
    if(orders.length === 0) {
        return res.status(400).send("No order found");
    }
    return res.status(200).json(orders);
}
exports.updateOrderStatus = async (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;
    const order = await Order.findById(orderId);
    if(!order) {
        return res.status(400).send("No order found with this ID");
    }
    if(!['Pending', ,'Accepted', 'Shipped', 'Delivered','Not Recieved', 'Cancelled','Returned','Refunded','Return Requested'].includes(status)) {
        return res.status(400).send("Invalid status");
    }
    order.orderStatus = status;
    order.updatedAt = new Date();
    await order.save();
    return res.status(200).send({msg:"Order status updated successfully" , orderStatus: order.orderStatus});
}
exports.getReturnRequests = async (req, res) => {
    const returnRequests = await Order.find({ orderStatus: 'Return Requested'});
    if(returnRequests.length === 0) {
        return res.status(400).send("No return requests found");
    }
    return res.status(200).json(returnRequests);
}
exports.manageReturnRequest = async (req, res) => {
    const orderId = req.params.id;
    const { action } = req.body;
    const order = await Order.findById(orderId);
    if(!order) {
        return res.status(400).send("No order found with this ID");
    }
    if(!['Accept', 'Reject'].includes(action)) {
        return res.status(400).send("Invalid action. Use 'Accept' or 'Reject'");
    }
    if(action === 'Accept') {
        order.orderStatus = 'Returned';
        order.paymentStatus = 'Refunded';
    } else if(action === 'Reject') {
        order.orderStatus = 'Cancelled';
    }
    order.updatedAt = new Date();
    await order.save();
    return res.status(200).send({msg: "Return request managed successfully", orderStatus: order.orderStatus, paymentStatus: order.paymentStatus});
}
exports.addToSale = async (req, res) => {
    const { name, salePrice, discountPercentage, startDate, endDate} = req.body;
    const productId = req.params.id;
    if(!name || !salePrice || !discountPercentage || !startDate || !endDate) {
        return res.status(400).send("Please provide all required fields");
    }
    if(discountPercentage <= 0 || discountPercentage > 100) {
        return res.status(400).send("Discount percentage must be between 1 and 100");
    }
    if(new Date(startDate) >= new Date(endDate)) {
        return res.status(400).send("End date must be after start date");
    }
    const discount = new Discount({
        name,
        productId: productId,
        salePrice,
        discountPercentage,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: true
    });
    const savedDiscount = await discount.save();
    return res.status(201).send({msg: "Sale added successfully", discount: savedDiscount});
}
exports.viewYourProfile = async (req, res) => {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if(!user) {
        return res.status(400).send("No user found with this ID");
    }
    return res.status(200).json({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        orderCount: user.orderCount || 0,
        orderReturns: user.orderReturns || 0,
    })
}
exports.viewProducts = async (req,res) => {
    const products = await Product.find();
    if(products.length === 0) {
        return res.status(400).send("No products found");
    }
    return res.status(200).json(products);
}
exports.detailsOfProduct = async (req, res) => {
    const productId = req.params.id;
    const product =  await Product.findById(productId).select('-createdAt -updatedAt -deletedAt -isDeletedFromCart -hashVariants -stock -lowStockThreshold -isActive -ratings -materials -options -variants');
    if(!product) {
        return res.status(400).send("No product found with this ID");
    }
    return res.status(200).json(product);
}
exports.viewProductReviews = async (req, res) => {
    const productId = req.params.id;
    const product = await Product.findById(productId).select('reviews');
    if(!product) {
        return res.status(400).send("No product found with this ID");
    }
    if(product.reviews.length === 0) {
        return res.status(400).send("No reviews found for this product");
    }
    return res.status(200).json(product.reviews);
}
exports.sendReview = async (req, res) => {
    const productId = req.params.id;
    const { rating, comment, email } = req.body;
    const userId =  await User.findOne({email:email}).select('_id');
    if(!userId) {
        return res.status(400).send("No user found with this email");
    }
    if(!productId) {
        return res.status(400).send("Product ID is required");
    }
    if(!rating) {
        return res.status(400).send("Rating is required");
    }
    if(!rating || rating < 1 || rating > 5) {
        return res.status(400).send("Rating must be between 1 and 5");
    }
    
    const product = await Product.findById(productId);
    if(!product) {
        return res.status(400).send("No product found with this ID");
    }

    const review = {
        userId: userId._id,
        rating: rating,
        comment: comment || ''
    };

    product.reviews.push(review);
    await product.save();

    return res.status(201).send("Review added successfully");
}
exports.getOrdersByTimePeriod = async (req, res) => {
    const {timePeriod} = req.body;
    const currentDate = new Date();
    let startDate;
    switch(timePeriod) {
        case 'today':
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
            break;
        case 'thisWeek':
            const firstDayOfWeek = currentDate.getDate() - currentDate.getDay();
            startDate = new Date(currentDate.setDate(firstDayOfWeek));
            break;
        case 'thisMonth':
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            break;
        case 'thisYear':
            startDate = new Date(currentDate.getFullYear(), 0, 1);
            break;
        default:
            return res.status(400).send("Invalid time period specified");
    }
    const orders = await Order.find({
        orderDate: {
            $gte: startDate,
            $lte: currentDate
        }
    }).populate('userId', 'firstName lastName email');
    if(orders.length === 0) {
        return res.status(400).send("No orders found for the specified time period");
    }
    return res.status(200).json({orders,count: orders.length});
}