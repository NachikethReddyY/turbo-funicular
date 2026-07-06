/*


Summary: The users.js is used create functions and what it does to the Users database.
*/

const db = require('./databaseConfig');
var config = require('../config.js');
var jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const saltRounds = 10;


var userDB = {

    //ENDPOINT 1
    //Get all users
    getUser: function (callback) {
        var dbConn = db.getConnection();

        // Connect to MySQL DB
        dbConn.connect(function (err) {
            if (err) {

                return callback(err, null);
            }

            else {

                var getUserSql = `select userid, username, email, password, type, profile_pic_url,
                                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;

                dbConn.query(getUserSql, [], function (err, results) {

                    if (err) {

                        dbConn.end();
                        return callback(err, null);
                    }

                    else {

                        dbConn.end();
                        return callback(null, results);
                    }
                });
            }
        });
    },


    //ENDPOINT 2
    //Add a new user
   insertUser: function (username, email, password, type, profile_pic_url, callback) {

    var dbConn = db.getConnection();

    dbConn.connect(function (err) {

        if (err) {
            return callback(err, null);
        }

        bcrypt.hash(password, saltRounds, function(err, hashedPassword) {

            if (err) {
                dbConn.end();
                return callback(err, null);
            }

            var insertUserSql = `
                INSERT INTO users(username, email, password, type, profile_pic_url)
                VALUES(?,?,?,?,?)
            `;

            dbConn.query(
                insertUserSql,
                [username, email, hashedPassword, type, profile_pic_url],
                function (err, results) {

                    dbConn.end();

                    if (err) {
                        return callback(err, null);
                    }

                    return callback(null, results);
                }
            );
        });
    });
},


    //ENDPOINT 3
    //Get user by user id
    getUserByUserid: function (userid, callback) {

    var dbConn = db.getConnection();

    dbConn.connect(function (err) {

        if (err) {
            return callback(err, null);
        }

        var sql = `
            SELECT userid,
                   username,
                   email,
                   password,
                   type,
                   profile_pic_url,
                   DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at
            FROM users
            WHERE userid = ?;
        `;

        dbConn.query(sql, [userid], function (err, results) {

            dbConn.end();

            if (err) {
                return callback(err, null);
            }

            return callback(null, results);
        });

    });

},


    //Login user by email and password
loginUser: function (email, password, callback) {

    var dbConn = db.getConnection();

    dbConn.connect(function (err) {

        if (err) {
            console.log("Database Connection Error:", err);
            return callback(err, null, null);
        }

        var sql = "SELECT * FROM users WHERE email = ?";

        dbConn.query(sql, [email], function (err, result) {

            dbConn.end();

            if (err) {
                console.log("SQL Error:", err);
                return callback(err, null, null);
            }

            console.log("========================");
            console.log("Email Entered:", email);
            console.log("Password Entered:", password);
            console.log("Database Result:", result);
            console.log("========================");

            // User not found
            if (result.length !== 1) {
                console.log("User not found.");
                var err2 = new Error("Email or password is incorrect.");
                err2.statusCode = 401;
                return callback(err2, null, null);
            }

            console.log("User Found:");
            console.log("User ID:", result[0].userid);
            console.log("Stored Password Hash:", result[0].password);

            bcrypt.compare(password, result[0].password, function(err, isMatch) {

                if (err) {
                    console.log("bcrypt Error:", err);
                    return callback(err, null, null);
                }

                console.log("Password Match:", isMatch);

                if (!isMatch) {
                    console.log("Password does not match.");

                    var err3 = new Error("Email or password is incorrect.");
                    err3.statusCode = 401;
                    return callback(err3, null, null);
                }

                console.log("Password Verified!");

const payload = {
    userid: result[0].userid,
    type: result[0].type
};

const token = jwt.sign(
    payload,
    process.env.JWT_SECRET
);

                console.log("Generated JWT:");
                console.log(token);

                return callback(null, token, result);

            });

        });

    });
},

}
module.exports = userDB;