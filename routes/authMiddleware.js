const jwt = require('jsonwebtoken');

exports.authenticate = (req,res,next) => {
    const token = req.headers.authorization;

    if(!token) {
        return res.status(400).send("No token provided");
    }

    jwt.verify(token, process.env.JWT_SECRET, (err,decoded)=> {
        if(err) {
            return res.status(400).send("Invalid/expired token")
        }
        req.user = decoded;
        next();
    })
}