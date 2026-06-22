var jwt = require('jsonwebtoken');

var config = require('../config');

function verifyToken(req, res, next) {

    console.log(req.headers);

    var token = req.headers['authorization'];
    console.log(token);

    if (!token || !token.includes('Bearer')) {

        res.status(403);
        return res.send({
            auth: false,
            message: 'Not authorized!'
        });
    }

    token = token.split('Bearer ')[1];

    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {

        if (err) {

            res.status(403);

            return res.send({
                auth: false,
                message: 'Not authorized!'
            });
        }

        req.userid = decoded.userid;
        req.type = decoded.type;

        next();
    });
}

module.exports = verifyToken;