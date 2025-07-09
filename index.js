const express = require('express');
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');


require('dotenv').config();
const app = express();
const PORT = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(userRoutes);


mongoose.connect(process.env.MONGO_URI).then(()=> {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
        console.log(`Server running on adress http://localhost:${PORT}`)
    });
}).catch(err => {
    console.error('Error connecting to MongoDB: ',err);
});