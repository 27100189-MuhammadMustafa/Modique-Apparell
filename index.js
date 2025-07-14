const express = require('express');
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');
const cors = require('cors');
const path = require('path');

require('dotenv').config();
const app = express();
const PORT = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(
    {
        origin: '*', // Allow requests from any origin
        methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
        allowedHeaders: ['Content-Type', 'Authorization'] // Allowed headers
    }
));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(userRoutes);


mongoose.connect(process.env.MONGO_URI).then(()=> {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
        console.log(`Server running on adress http://localhost:${PORT}`)
    });
}).catch(err => {
    console.error('Error connecting to MongoDB: ',err);
});