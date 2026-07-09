/*


Summary: The users.js is used create functions and what it does to the Users database.
*/

const db = require('./databaseConfig');
var config = require('../config.js');
var jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const COGNITO_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlaceholderUsername(username) {
    if (!username || typeof username !== 'string') {
        return true;
    }

    var trimmed = username.trim();

    if (!trimmed) {
        return true;
    }

    if (/^pending_/i.test(trimmed)) {
        return true;
    }

    if (COGNITO_UUID_RE.test(trimmed)) {
        return true;
    }

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9a-f]+$/i.test(trimmed)) {
        return true;
    }

    return false;
}

function buildPendingUsername(sub) {
    return ('pending_' + String(sub || '').replace(/-/g, '')).slice(0, 100);
}

function sanitizeProfile(user) {
    if (!user) {
        return null;
    }

    return {
        userid: user.userid,
        username: user.username,
        email: user.email,
        type: user.type,
        profile_pic_url: user.profile_pic_url || '',
        profileComplete: !isPlaceholderUsername(user.username)
    };
}


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

    isPlaceholderUsername: isPlaceholderUsername,

    findCognitoUser: function (email, cognitoSub, cognitoUsername, callback) {

        var dbConn = db.getConnection();

        dbConn.connect(function (err) {

            if (err) {
                return callback(err, null);
            }

            var conditions = [];
            var values = [];

            if (email) {
                conditions.push('email = ?');
                values.push(email);
            }

            var usernames = [];

            if (cognitoSub) {
                usernames.push(cognitoSub);
            }

            if (cognitoUsername && cognitoUsername !== cognitoSub) {
                usernames.push(cognitoUsername);
            }

            if (cognitoSub) {
                usernames.push(buildPendingUsername(cognitoSub));
            }

            if (usernames.length > 0) {
                conditions.push('username IN (' + usernames.map(function () {
                    return '?';
                }).join(', ') + ')');
                values = values.concat(usernames);
            }

            if (conditions.length === 0) {
                dbConn.end();
                return callback(null, null);
            }

            var lookupSql = 'SELECT userid, username, email, type, profile_pic_url FROM users WHERE ' +
                conditions.join(' OR ') + ' LIMIT 1';

            dbConn.query(lookupSql, values, function (err, results) {

                dbConn.end();

                if (err) {
                    return callback(err, null);
                }

                if (results && results.length > 0) {
                    return callback(null, results[0]);
                }

                return callback(null, null);
            });
        });
    },

    getOrCreateCognitoUser: function (email, username, cognitoSub, type, callback) {

        var dbConn = db.getConnection();
        var safeType = type || 'user';

        userDB.findCognitoUser(email, cognitoSub, username, function (err, existingUser) {

            if (err) {
                return callback(err, null);
            }

            if (existingUser) {
                return callback(null, existingUser);
            }

            dbConn.connect(function (err) {

                if (err) {
                    return callback(err, null);
                }

                var safeEmail = email || ((cognitoSub || username || 'user') + '@cognito.local');
                var safeUsername = buildPendingUsername(cognitoSub || username);

                bcrypt.hash('COGNITO_USER_NO_LOCAL_PASSWORD_' + Date.now(), saltRounds, function (err, hashedPassword) {

                    if (err) {
                        dbConn.end();
                        return callback(err, null);
                    }

                    var insertSql = 'INSERT INTO users(username, email, password, type, profile_pic_url) VALUES(?,?,?,?,?)';
                    dbConn.query(insertSql, [safeUsername, safeEmail, hashedPassword, safeType, ''], function (err, insertResult) {

                        dbConn.end();

                        if (err) {
                            return callback(err, null);
                        }

                        return callback(null, {
                            userid: insertResult.insertId,
                            username: safeUsername,
                            email: safeEmail,
                            type: safeType,
                            profile_pic_url: ''
                        });
                    });
                });
            });
        });
    },

    updateCognitoProfile: function (email, cognitoSub, cognitoUsername, username, profile_pic_url, callback) {

        userDB.findCognitoUser(email, cognitoSub, cognitoUsername, function (err, user) {

            if (err) {
                return callback(err, null);
            }

            if (!user) {
                var notFound = new Error('User profile not found.');
                notFound.statusCode = 404;
                return callback(notFound, null);
            }

            var dbConn = db.getConnection();

            dbConn.connect(function (err) {

                if (err) {
                    return callback(err, null);
                }

                var updateSql = 'UPDATE users SET username = ?, profile_pic_url = ? WHERE userid = ?';
                dbConn.query(updateSql, [username, profile_pic_url || '', user.userid], function (err) {

                    dbConn.end();

                    if (err) {
                        return callback(err, null);
                    }

                    return callback(null, sanitizeProfile({
                        userid: user.userid,
                        username: username,
                        email: user.email,
                        type: user.type,
                        profile_pic_url: profile_pic_url || ''
                    }));
                });
            });
        });
    },

    getLegacyUserProfile: function (userid, callback) {

        userDB.getUserByUserid(userid, function (err, results) {

            if (err) {
                return callback(err, null);
            }

            if (!results || results.length === 0) {
                var notFound = new Error('User profile not found.');
                notFound.statusCode = 404;
                return callback(notFound, null);
            }

            return callback(null, sanitizeProfile(results[0]));
        });
    },

    getUsersForAdmin: function (callback) {

        var dbConn = db.getConnection();

        dbConn.connect(function (err) {

            if (err) {
                return callback(err, null);
            }

            var sql = `SELECT userid, username, email, type,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
                FROM users
                ORDER BY type DESC, username ASC`;

            dbConn.query(sql, [], function (err, results) {

                dbConn.end();

                if (err) {
                    return callback(err, null);
                }

                var users = (results || []).map(function (user) {
                    return {
                        userid: user.userid,
                        username: user.username,
                        email: user.email,
                        type: user.type,
                        isAdmin: String(user.type || '').toLowerCase() === 'admin',
                        created_at: user.created_at
                    };
                });

                return callback(null, users);
            });
        });
    },

    getUserByEmail: function (email, callback) {

        var dbConn = db.getConnection();

        dbConn.connect(function (err) {

            if (err) {
                return callback(err, null);
            }

            dbConn.query(
                'SELECT userid, username, email, type, profile_pic_url FROM users WHERE email = ? LIMIT 1',
                [email],
                function (err, results) {

                    dbConn.end();

                    if (err) {
                        return callback(err, null);
                    }

                    if (!results || results.length === 0) {
                        return callback(null, null);
                    }

                    return callback(null, results[0]);
                }
            );
        });
    },

    setUserTypeByEmail: function (email, type, callback) {

        var dbConn = db.getConnection();

        dbConn.connect(function (err) {

            if (err) {
                return callback(err, null);
            }

            dbConn.query(
                'UPDATE users SET type = ? WHERE email = ?',
                [type, email],
                function (err, results) {

                    dbConn.end();

                    if (err) {
                        return callback(err, null);
                    }

                    return callback(null, results);
                }
            );
        });
    },

}
module.exports = userDB;