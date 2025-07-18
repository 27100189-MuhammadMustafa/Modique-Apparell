const User = require("../models/user");
const express = require("express");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const Product = require('../models/products');
const Order = require('../models/order');
const Discount = require('../models/discounts');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { BlobServiceClient } = require('@azure/storage-blob');
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME;

async function uploadBase64ToAzureBlob(base64String, productId, fileNamePrefix = "product") {
  const matches = base64String.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid base64 string');
  const ext = matches[1].split('/')[1];
  const data = matches[2];
  const buffer = Buffer.from(data, 'base64');
  const fileName = `${fileNamePrefix}_${productId}_${Date.now()}.${ext}`;
  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: matches[1] }
  });
  return `${blockBlobClient.url}`;
}

exports.uploadProductImageBase64 = async (req, res) => {
  const productId = req.params.id;
  const { base64Image, isPrimary = false } = req.body;
  if (!base64Image) {
    return res.status(400).send("No image provided");
  }
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(400).send("No product found with this ID");
  }
  try {
    const imageUrl = await uploadBase64ToAzureBlob(base64Image, productId);
    for (const attachment of product.attachments) {
      if (attachment.isPrimary && isPrimary) {
        return res.status(400).send("Primary image already exists. Please set another image as primary before setting this one.");
      }
    }
    product.attachments.push({
      imageType: base64Image.split(';')[0].split(':')[1], 
      url: imageUrl,
      fileName: path.basename(imageUrl),
      isPrimary: isPrimary
    });

    await product.save();
    return res.status(200).send({ imageUrl });
  } catch (err) {
    return res.status(500).send({msg:"Failed to save image",error: err.message});
  }
};


exports.getUsers = async (req, res) => {
  const role = req.query.role;
  if (role && role !== "1" && role !== "2") {
    return res.status(400).send("Invalid role specified");
  }
  const users = await User.find({ role: parseInt(role) }).select("-password");
  if (users.length === 0) {
    return res.status(400).send("No users found");
  }
  return res.status(200).send(users);
};
exports.getUserById = async (req, res) => {
  const userId = req.params.id;
  const user = await User.findById(userId);
  if (!user) {
    res.status(400).send("No user found!");
  }
  res.status(200).send(user);
};

exports.postSignUp = [
  check("firstName")
    .trim()
    .isLength({ min: 2 })
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

  check("password").isLength({ min: 8 }).trim(),
  async (req, res) => {
    const error = validationResult(req);
    if (error.isEmpty()) {
      const { firstName, lastName, email, password } = req.body;

      const user = await User.findOne({ email });
      if (user) {
        return res.status(400).send("User exists already go to login page");
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = new User({
        firstName,
        lastName,
        email,
        password: hashedPassword,
      });
      const savedUser = await newUser.save();
      const token = jwt.sign(
        { userId: savedUser._id, email: savedUser.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      return res
        .status(200)
        .send({ msg: "User registered Successfully", token: token });
    } else {
      res.status(400).send("Invalid credentials");
    }
  },
];
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).send("User does not exist");
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).send("Invalid Password");
  }
  const token = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  return res
    .status(200)
    .send({ msg: "User logged in successfully", token: token });
};
exports.postLogout = (req, res) => {
  res.redirect("/login");
};

exports.postAddProduct = async ( req, res) => {
    const {name, description, category, subCategory, price, stock, lowStockThreshold,variants, options, materials,base64Image,isPrimary=false} = req.body;
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
    if (base64Image) {
        try {
            const imageUrl = await uploadBase64ToAzureBlob(base64Image, savedProduct._id, "product");
            savedProduct.attachments.push({
                imageType: base64Image.split(';')[0].split(':')[1], 
                url: imageUrl,
                fileName: path.basename(imageUrl),
                isPrimary: isPrimary
            });
            await savedProduct.save();
        } catch (err) {
            return res.status(500).send({msg:"Failed to save image",error: err.message});
        }
    }
    return res.status(201).send({msg:"Product added successfully", product: savedProduct});
}
exports.getProducts = async (req,res) => {
    const products = await Product.find();
    if(products.length === 0)
    {
        return res.status(400).send("No products found")
    }
    for (let product of products){
        const sale = await Discount.findOne({ 'products.productId': product._id, isActive: true });
        if(sale) {
            const productSale = sale.discountPercentage;
            if(productSale) {
                product.discountedPrice = product.price - (product.price * (productSale/ 100));

            }
        }
    }
    return res.status(200).send(products);
}
exports.getProductById = async (req, res) => {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if(!product) {
        return res.status(400).send("No product found with this ID");
    }
    const sale = await Discount.findOne({ 'products.productId': product._id, isActive: true });
    if(sale) {
        const productSale = sale.discountPercentage;
        if(productSale) {
            product.discountedPrice = product.price - (product.price * (productSale/ 100));
        }
    }
    return res.status(200).json(product);
}
exports.updateProduct = async (req, res) => {
  const productId = req.params.id;
  const {
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
  } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(400).send("No product found with this ID");
  }

  product.name = name;
  product.description = description;
  product.category = category;
  product.subCategory = subCategory;
  product.price = price;
  product.stock = stock;
  product.lowStockThreshold = lowStockThreshold;
  product.variants = variants;
  product.options = options;
  product.materials = materials;

  const updatedProduct = await product.save();

  return res
    .status(200)
    .send({ msg: "Product updated successfully" }, { product: updatedProduct });
};
exports.deleteProduct = async (req, res) => {
  const productId = req.params.id;
  const deletedProduct = await Product.findByIdAndDelete(productId);
  if (!deletedProduct) {
    return res.status(400).send("No product found with this ID");
  }
  return res.status(200).send("Product deleted successfully");
};
exports.getFilteredProducts = async (req, res) => {
  const {
    category,
    subCategory,
    minPrice,
    maxPrice,
    sizes,
    colors,
    sortBy,
    page = 1,
    limit = 10,
  } = req.query;
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
    filter["options.values"] = { $in: sizes.split(",") };
  }
  if (colors) {
    filter["variants.options"] = { $in: colors.split(",") };
  }
  const sort = {};
  if (sortBy) {
    const [field, order] = sortBy.split(":");
    sort[field] = order === "desc" ? -1 : 1;
  }
  const skip = (page - 1) * limit;
  const products = await Product.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));
  return res.status(200).json(products);
};
exports.updateStock = async (req, res) => {
  const productId = req.params.id;
  const { action, quantity } = req.body;
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(400).send("No product found with this ID");
  }
  if (action === "increase") {
    product.stock += quantity;
  } else if (action === "decrease") {
    if (product.stock < quantity) {
      return res.status(400).send("Insufficient stock to decrease");
    }
    product.stock -= quantity;
  } else {
    return res.status(400).send("Invalid action. Use 'increase' or 'decrease'");
  }
  product.updatedAt = new Date();
  await product.save();
  return res.status(200).send("Stock updated successfully");
};
exports.updatePrice = async (req, res) => {
  const productId = req.params.id;
  const { newPrice } = req.body;
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(400).send("No product found with this ID");
  }
  if (newPrice <= 0) {
    return res.status(400).send("Price must be greater than zero");
  }
  product.price = newPrice;
  product.updatedAt = new Date();
  await product.save();
  return res
    .status(200)
    .send({ msg: "Price updated successfully", newPrice: product.price });
};
exports.getLowStockProducts = async (req, res) => {
  const lowStockProducts = await Product.find({
    $expr: { $lte: ["$stock", "$lowStockThreshold"] },
  });
  if (lowStockProducts.length === 0) {
    return res.status(400).send("No low stock products found");
  }
  return res.status(200).json(lowStockProducts);
};
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
    
        productDetails.stock -= quantity;
        if (productDetails.stock < 0) {
            productDetails.stock = 0; 
        }
        if (productDetails.stock === 0) { // <-- fix here
            productDetails.isActive = false; 
        }
        await productDetails.save();
        const sale = await Discount.findOne({'products.productId':product.productId, isActive: true });
        console.log(sale);
        let discountedPrice;
        if(sale) {
            const productSale = sale.discountPercentage;
            
            if(productSale) {
                discountedPrice = productDetails.price - (productDetails.price * (productSale/ 100));
            }
        }
        console.log(discountedPrice);
        const productPrice = Number(productDetails.isOnSale ? discountedPrice : productDetails.price);
        console.log(productPrice);
        if (isNaN(productPrice)) {
            return res.status(400).send(`Invalid price for product ${productDetails.name}`);
        }
        const amount = productPrice * quantity;
        total += amount;
        console.log(total);
    }
    
    if (isNaN(total) || total <= 0) {
        return res.status(400).send("Total amount must be greater than zero and valid");
    }
    const totalOrders = await Order.find();
    const orderId = `ORD-${totalOrders.length + 1}-${new Date().getFullYear()}`;
    if (total <= 0) {
        return res.status(400).send("Total amount must be greater than zero");
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
        orderDate: new Date(),
        orderIdForUser: orderId
    });
    
    const savedOrder = await newOrder.save();
    user.orderCount = (user.orderCount || 0) + 1;
    user.totalSpent = (user.totalSpent || 0) + total;
    await user.save();
    
    return res.status(201).send({ msg: "Order placed successfully", orderId: savedOrder.orderIdForUser, totalAmount: savedOrder.totalAmount });
}
exports.viewOrders = async (req, res) => {
  const orders = await Order.find();
  if (orders.length === 0) {
    return res.status(400).send("No order found");
  }
  return res.status(200).json(orders);
};
exports.updateOrderStatus = async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(400).send("No order found with this ID");
  }
  if (
    ![
      "Pending",
      ,
      "Accepted",
      "Shipped",
      "Delivered",
      "Not Recieved",
      "Cancelled",
      "Returned",
      "Refunded",
      "Return Requested",
    ].includes(status)
  ) {
    return res.status(400).send("Invalid status");
  }
  order.orderStatus = status;
  order.updatedAt = new Date();
  await order.save();
  return res
    .status(200)
    .send({
      msg: "Order status updated successfully",
      orderStatus: order.orderStatus,
    });
};
exports.getReturnRequests = async (req, res) => {
  const returnRequests = await Order.find({ orderStatus: "Return Requested" });
  if (returnRequests.length === 0) {
    return res.status(400).send("No return requests found");
  }
  return res.status(200).json(returnRequests);
};
exports.manageReturnRequest = async (req, res) => {
  const orderId = req.params.id;
  const { action } = req.body;
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(400).send("No order found with this ID");
  }
  if (!["Accept", "Reject"].includes(action)) {
    return res.status(400).send("Invalid action. Use 'Accept' or 'Reject'");
  }
  if (action === "Accept") {
    order.orderStatus = "Returned";
    order.paymentStatus = "Refunded";
  } else if (action === "Reject") {
    order.orderStatus = "Cancelled";
  }
  order.updatedAt = new Date();
  await order.save();
  return res
    .status(200)
    .send({
      msg: "Return request managed successfully",
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
    });
};
exports.addToSale = async (req, res) => {
    const { name,products, discountPercentage, startDate, endDate} = req.body;
    if(!name || !discountPercentage || !startDate || !endDate) {
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
        products : products,
        discountPercentage,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: true
    });
    for (const product of products) {
        const productDetails = await Product.findById(product.productId);
        if (!productDetails) {
            return res.status(400).send(`Product with ID ${product.productId} not found`);
        }
        productDetails.isOnSale = true;
        await productDetails.save();
    }
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
  if(products.length === 0)
  {
      return res.status(400).send("No products found")
  }
  for (let product of products){
      const sale = await Discount.findOne({ 'products.productId': product._id, isActive: true });
      if(sale) {
          const productSale = sale.discountPercentage;
          if(productSale) {
              product.discountedPrice = product.price - (product.price * (productSale/ 100));
          }
      }
  }
  return res.status(200).send(products);
}
exports.detailsOfProduct = async (req, res) => {
  const productId = req.params.id;
  const product = await Product.findById(productId);
  if(!product) {
      return res.status(400).send("No product found with this ID");
  }
  const sale = await Discount.findOne({ 'products.productId': product._id, isActive: true });
  if(sale) {
      const productSale = sale.discountPercentage;
      if(productSale) {
          product.discountedPrice = product.price - (product.price * (productSale/ 100));
      }
  }
  return res.status(200).json(product);
}
exports.viewProductReviews = async (req, res) => {
  const productId = req.params.id;
  const product = await Product.findById(productId).select("reviews");
  if (!product) {
    return res.status(400).send("No product found with this ID");
  }
  if (product.reviews.length === 0) {
    return res.status(400).send("No reviews found for this product");
  }
  return res.status(200).json(product.reviews);
};
exports.sendReview = async (req, res) => {
  const productId = req.params.id;
  const { rating, comment, email } = req.body;
  const userId = await User.findOne({ email: email }).select("_id");
  if (!userId) {
    return res.status(400).send("No user found with this email");
  }
  if (!productId) {
    return res.status(400).send("Product ID is required");
  }
  if (!rating) {
    return res.status(400).send("Rating is required");
  }
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).send("Rating must be between 1 and 5");
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(400).send("No product found with this ID");
  }

  const review = {
    userId: userId._id,
    rating: rating,
    comment: comment || "",
  };

  product.reviews.push(review);
  await product.save();

  return res.status(201).send("Review added successfully");
};
exports.getOrdersByTimePeriod = async (req, res) => {
  const { timePeriod } = req.body;
  const now = new Date();
  const currentDate = new Date();
  let startDate;
  switch (timePeriod) {
    case "today":
      startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate()
      );
      break;
    case "thisWeek":
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(today);
      startDate.setDate(today.getDate() - diff);
      break;
    case "thisMonth":
      startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      break;
    case "thisYear":
      startDate = new Date(currentDate.getFullYear(), 0, 1);
      break;
    default:
      return res.status(400).send("Invalid time period specified");
  }

  console.log(startDate);
  const orders = await Order.find({
    orderDate: {
      $gte: startDate,
      $lte: currentDate,
    },
  }).populate("userId", "firstName lastName email");
  if (orders.length === 0) {
    return res
      .status(400)
      .send("No orders found for the specified time period");
  }
  return res.status(200).json({ orders, count: orders.length });
};
exports.postSubscribe = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).send("Email is required");
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).send("User not found with this email");
  }
  if (user.isSubscribed) {
    return res.status(400).send("User is already subscribed");
  }
  user.isSubscribed = true;
  await user.save();
  return res.status(200).send("User subscribed successfully");
};
exports.postUnsubscribe = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).send("Email is required");
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).send("User not found with this email");
  }
  if (!user.isSubscribed) {
    return res.status(400).send("User is already unsubscribed");
  }
  user.isSubscribed = false;
  await user.save();
  return res.status(200).send("User unsubscribed successfully");
};
exports.getSubscribedUsers = async (req, res) => {
  const subscribedUsers = await User.find({ isSubscribed: true });
  if (subscribedUsers.length === 0) {
    return res.status(400).send("No subscribed users found");
  }
  return res.status(200).json(subscribedUsers);
};
exports.getUserOrders = async (req, res) => {
  const userId = req.params.id;
  const orders = await Order.find({ userId: userId }).populate(
    "userId",
    "firstName lastName email"
  );
  if (orders.length === 0) {
    return res.status(400).send("No orders found for this user");
  }
  return res.status(200).json(orders);
};
exports.returnRequest = async (req, res) => {
    const { orderId, reason } = req.body;
    if (!orderId || !reason) {
        return res.status(400).send("Order ID and reason are required");
    }
    const order = await Order.findById(orderId);
    if (!order) {
        return res.status(400).send("No order found with this ID");
    }
    if (order.orderStatus !== 'Delivered') {
        return res.status(400).send("Order must be delivered to request a return");
    }
    if (order.orderStatus === 'Return Requested') {
        return res.status(400).send("Return request already exists for this order");
    }
    order.orderStatus = 'Return Requested';
    order.returnReason = reason;
    order.updatedAt = new Date();
    await order.save();
    return res.status(200).send("Return request submitted successfully");
}
exports.recentActivity = async (req, res) => {
  const recentUsersAdded = await User.find()
    .sort({ createdAt: -1 })
    .limit(1)
    .select("-password");
  const recentOrdersPlaced = await Order.find()
    .sort({ orderDate: -1 })
    .limit(1)
    .populate("userId", "firstName lastName email");
  const recentProductsAdded = await Product.find()
    .sort({ createdAt: -1 })
    .limit(1);
  const recentDiscountsAdded = await Discount.find()
    .sort({ createdAt: -1 })
    .limit(1);
  const recentProductsUpdated = await Product.find()
    .sort({updatedAt: -1})
    .limit(1)
  const recentOrdersUpdated = await Order.find()
    .sort({ updatedAt: -1 })
    .limit(1)
    .populate("userId", "firstName lastName email");
  return res.status(200).json({
    recentUsersAdded,
    recentOrdersPlaced,
    recentProductsAdded,
    recentDiscountsAdded,
    recentProductsUpdated,
    recentOrdersUpdated
  });
}