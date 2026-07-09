/*


Summary: The app.js is used run the functions and what it displays.
*/

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const userDB = require('../model/users');
const categoryDB = require('../model/category');
const platformDB = require('../model/platform');
const reviewDB = require('../model/review');
const gameDB = require('../model/game');
var verifyToken = require('../auth/verifyToken.js');
const requireAdmin = require('../auth/requireAdmin');
const cognitoAdmin = require('../auth/cognitoAdmin');
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const securityLog = require('../securityLog');
const s3Storage = require('../services/s3Storage');

function isValidProfilePic(value) {
    if (!value) {
        return true;
    }

    if (/^https?:\/\//i.test(value)) {
        return true;
    }

    return /^[-+/=A-Za-z0-9]+$/.test(value);
}

function resolveProfilePicForStorage(profilePic, ownerKey, callback) {
    if (!profilePic) {
        return callback(null, '');
    }

    if (/^https?:\/\//i.test(profilePic)) {
        return callback(null, profilePic);
    }

    if (s3Storage.isConfigured()) {
        return s3Storage.uploadProfileImageBase64(profilePic, ownerKey, callback);
    }

    return callback(null, profilePic);
}

function resolveGameImageForStorage(gameImage, title, callback) {
    if (!gameImage) {
        return callback(new Error('Game image is required'));
    }

    if (typeof gameImage === 'string' && /^https?:\/\//i.test(gameImage)) {
        return callback(null, gameImage);
    }

    if (s3Storage.isConfigured()) {
        return s3Storage.uploadGameImage(gameImage, title, callback);
    }

    return callback(null, gameImage);
}

/* ==========================================
   Helmet Security Headers
========================================== */

app.use(function(req, res, next) {
    var startedAt = Date.now();

    res.on('finish', function() {
        securityLog.audit('http_request', {
            method: req.method,
            path: req.originalUrl || req.url,
            status: res.statusCode,
            durationMs: Date.now() - startedAt,
            ip: req.ip
        });
    });

    next();
});

app.use(helmet());

app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            imgSrc: ["'self'", "data:"],
            styleSrc: ["'self'", "'unsafe-inline'"]
        }
    })
);

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,                   // Maximum 5 registration attempts
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        Message: "Too many registration attempts. Please try again after 15 minutes."
    }
});

/* ==========================================
   Other Middleware
========================================== */

var cors = require('cors');

const cookieParser = require("cookie-parser");
app.use(cookieParser());


// Define your secure CORS options
const corsOptions = {
    origin: ['http://localhost:3001', 'https://localhost:3001'], // Explicitly allow your frontend
    credentials: true,               // Allows session cookies/tokens to pass through
    optionsSuccessStatus: 200        // Solves legacy browser preflight issues
};

// Apply CORS to preflight OPTIONS requests and all endpoints
app.use(cors({
    origin: function(origin, callback){

        const allowed = [
            "http://localhost:3001",
            "https://localhost:3001"
        ];

        if (process.env.FRONTEND_ORIGINS) {
            process.env.FRONTEND_ORIGINS.split(',').forEach(function (entry) {
                var trimmed = entry.trim();
                if (trimmed) {
                    allowed.push(trimmed);
                }
            });
        }

        if(!origin || allowed.includes(origin)){
            callback(null,true);
        }
        else{
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials:true
}));

app.options('*', cors());


// For handling requirement of image upload
const multer = require('multer');
const storage = multer.memoryStorage();     // Store uploaded image file in memory
const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {

        // Accept only JPG image
        if (file.mimetype === 'image/jpeg') {

            cb(null, true);
        }

        // Reject other file type
        else {

            cb(new Error('Only JPEG images are allowed'));
        }
    }
});




var urlencodedParser = bodyParser.urlencoded({ extended: false, limit: '25mb' });
app.use(urlencodedParser);  //attach body-parser middleware
app.use(bodyParser.json({ limit: '25mb' })); //parse json data


//WebService endpoints
//---------------------


// Verifying user role
app.get('/CheckRole',verifyToken, function (req, res) {

    const userRole = req.type;

    res.status(200);
    res.type("json");
    res.send({ role: userRole });
});

function isCognitoIdentity(userid) {
    return !/^\d+$/.test(String(userid));
}

function resolveCognitoProfile(req, callback) {
    var profileEmail = req.headers['x-profile-email'] || req.cognitoEmail || '';

    userDB.getOrCreateCognitoUser(
        profileEmail,
        req.cognitoUsername,
        req.cognitoSub || req.userid,
        req.type === 'Admin' ? 'Admin' : 'user',
        function (err, user) {
            if (err) {
                return callback(err, null);
            }

            return callback(null, {
                userid: user.userid,
                username: user.username,
                email: user.email,
                type: user.type,
                profile_pic_url: user.profile_pic_url || '',
                profileComplete: !userDB.isPlaceholderUsername(user.username)
            });
        }
    );
}

// GET /users/me/profile — current user's local profile (Cognito or legacy JWT)
app.get('/users/me/profile', verifyToken, function (req, res) {

    if (isCognitoIdentity(req.userid)) {
        return resolveCognitoProfile(req, function (err, profile) {
            if (err) {
                console.log(err);
                res.status(500);
                return res.json({ Message: 'Internal Server Error' });
            }

            res.status(200);
            return res.json(profile);
        });
    }

    userDB.getLegacyUserProfile(req.userid, function (err, profile) {
        if (err) {
            var status = err.statusCode || 500;
            res.status(status);
            return res.json({ Message: err.message || 'Internal Server Error' });
        }

        res.status(200);
        return res.json(profile);
    });
});

// PUT /users/me/profile — set display username and optional profile image after Cognito login
app.put('/users/me/profile', verifyToken, function (req, res) {

    var username = req.body.username ? String(req.body.username).trim() : '';
    var profile_pic_url = req.body.profile_pic_url ? String(req.body.profile_pic_url).trim() : '';
    var usernameRegex = /^[A-Za-z0-9_]{3,30}$/;

    if (!usernameRegex.test(username)) {
        return res.status(400).json({
            Message: 'Username must be 3-30 characters and use only letters, numbers, or underscores.'
        });
    }

    if (profile_pic_url && !isValidProfilePic(profile_pic_url)) {
        return res.status(400).json({
            Message: 'Profile image must be a valid base64-encoded JPEG or an image URL.'
        });
    }

    if (!isCognitoIdentity(req.userid)) {
        return res.status(400).json({
            Message: 'Profile setup is only required for Cognito users.'
        });
    }

    var profileEmail = req.headers['x-profile-email'] || req.cognitoEmail || '';
    var ownerKey = req.cognitoSub || req.userid || profileEmail;

    resolveProfilePicForStorage(profile_pic_url, ownerKey, function (uploadErr, storedProfilePic) {
        if (uploadErr) {
            console.error(uploadErr);
            return res.status(500).json({ Message: 'Could not upload profile image to S3.' });
        }

        userDB.updateCognitoProfile(
            profileEmail,
            req.cognitoSub || req.userid,
            req.cognitoUsername,
            username,
            storedProfilePic,
            function (err, profile) {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(422).json({
                            Message: 'That username is already taken.'
                        });
                    }

                    var status = err.statusCode || 500;
                    res.status(status);
                    return res.json({ Message: err.message || 'Internal Server Error' });
                }

                res.status(200);
                return res.json(profile);
            }
        );
    });
});


function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function getActorEmail(req) {
    return normalizeEmail(req.headers['x-profile-email'] || req.cognitoEmail || '');
}

function syncLocalAdminRole(email, makeAdmin, callback) {
    var nextType = makeAdmin ? 'Admin' : 'user';

    userDB.getUserByEmail(email, function (err, user) {

        if (err) {
            return callback(err);
        }

        if (user) {
            return userDB.setUserTypeByEmail(email, nextType, callback);
        }

        if (!makeAdmin) {
            return callback(null);
        }

        userDB.getOrCreateCognitoUser(email, null, null, 'Admin', function (createErr) {
            if (createErr) {
                return callback(createErr);
            }

            return userDB.setUserTypeByEmail(email, 'Admin', callback);
        });
    });
}

// GET /admin/users — list users for admin management (no passwords)
app.get('/admin/users', verifyToken, requireAdmin, function (req, res) {

    userDB.getUsersForAdmin(function (err, users) {

        if (err) {
            console.log(err);
            return res.status(500).json({ Message: 'Internal Server Error' });
        }

        res.status(200);
        return res.json(users);
    });
});

// POST /admin/users/grant-admin — add a user to the Cognito Admin group
app.post('/admin/users/grant-admin', verifyToken, requireAdmin, function (req, res) {

    var email = normalizeEmail(req.body.email);
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        return res.status(400).json({ Message: 'A valid email address is required.' });
    }

    if (!cognitoAdmin.isCognitoConfigured()) {
        return res.status(503).json({ Message: 'Cognito admin management is not configured.' });
    }

    cognitoAdmin.addUserToAdminGroup(email)
        .then(function () {
            syncLocalAdminRole(email, true, function (err) {
                if (err) {
                    console.log(err);
                    return res.status(500).json({ Message: 'Cognito updated, but local profile sync failed.' });
                }

                res.status(200);
                return res.json({
                    Message: 'Admin access granted. The user must sign out and sign in again to use admin features.',
                    email: email
                });
            });
        })
        .catch(function (err) {
            console.log(err);
            var status = err.statusCode || 500;
            return res.status(status).json({
                Message: err.message || 'Unable to grant admin access.'
            });
        });
});

// POST /admin/users/revoke-admin — remove a user from the Cognito Admin group
app.post('/admin/users/revoke-admin', verifyToken, requireAdmin, function (req, res) {

    var email = normalizeEmail(req.body.email);
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var actorEmail = getActorEmail(req);

    if (!emailRegex.test(email)) {
        return res.status(400).json({ Message: 'A valid email address is required.' });
    }

    if (actorEmail && actorEmail === email) {
        return res.status(400).json({ Message: 'You cannot remove your own admin access.' });
    }

    if (!cognitoAdmin.isCognitoConfigured()) {
        return res.status(503).json({ Message: 'Cognito admin management is not configured.' });
    }

    cognitoAdmin.removeUserFromAdminGroup(email)
        .then(function () {
            syncLocalAdminRole(email, false, function (err) {
                if (err) {
                    console.log(err);
                    return res.status(500).json({ Message: 'Cognito updated, but local profile sync failed.' });
                }

                res.status(200);
                return res.json({
                    Message: 'Admin access removed. The user must sign out and sign in again.',
                    email: email
                });
            });
        })
        .catch(function (err) {
            console.log(err);
            var status = err.statusCode || 500;
            return res.status(status).json({
                Message: err.message || 'Unable to revoke admin access.'
            });
        });
});


// Search Game Details
app.get('/searchgamedetails/:gameID', function (req, res) {

    var gameID = req.params.gameID;

    gameDB.getSearchGameDetail(gameID, function (err, results) {

        if (err) {

            console.log(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"some error encounted!"}`);
        }

        else {

            res.status(200);
            res.type("json");
            res.send(results);
        }
    });
});


// Search Game
app.post('/searchgame', function (req, res) {

    var input = req.body.input;
    var platform = req.body.platID;
    var category = req.body.catID;

    gameDB.getSearchGame(input, platform, category, function (err, results) {

        if (err) {

            console.log(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"some error encounted!"}`);
        }

        else {

            res.status(200);
            res.type("json");
            res.send(results);
        }
    });
});


// User Login
app.post('/users/login',registerLimiter, function (req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var rememberMe = req.body.rememberMe || false;

    userDB.loginUser(email, password, function (err, token, result) {

    console.log("ERROR:",err);
    console.log("TOKEN:",token);
    console.log("RESULT:",result);

        if (!err) {

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            delete result[0]['password'];//clear the password in json data, do not send back to client
            console.log(result);

            // If rememberMe is true, set a cookie with the token for persistent login
            if (rememberMe) {
                const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
                res.cookie('rememberMeToken', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    maxAge
                });
            }

            res.json({ success: true, UserData: JSON.stringify(result), token: token, status: 'You are successfully logged in!' });
            res.send();
        }

else {
    console.log("LOGIN ERROR:", err);

    res.status(401).json({
        success:false,
        message:"Login failed",
        error:err.message || err
    });
}
    });
});



//User Logout
app.post('/users/logout', function (req, res) {
    res.clearCookie('rememberMeToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
    });
    res.json({
        success: true,
        status: 'Log out successful!'
    });
});



//Get all category
app.get('/category', function (req, res) {


    categoryDB.getAllCat(function (err, results) {

        // If Any error occur
        if (err) {

            console.log(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            res.status(200);
            res.type("json");
            res.send(results);
        }
    });
});


//Get all platform
app.get('/platform', function (req, res) {


    platformDB.getAllPlat(function (err, results) {

        // If Any error occur
        if (err) {

            console.log(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            res.status(200);
            res.type("json");
            res.send(results);
        }
    });
});

//ENDPOINT 1
//GET /user/
//Get all users
app.get('/users', function (req, res) {


    userDB.getUser(function (err, results) {

        // If Any error occur
        if (err) {

            console.log(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            res.status(200);
            res.type("json");
            res.send(results);
        }
    });
});


//ENDPOINT 2
//POST /user
//Add a new user
app.post('/users',registerLimiter, function (req, res) {

    // Retrieve and sanitize user input
    var username = req.body.username ? req.body.username.trim() : "";
    var email = req.body.email ? req.body.email.trim().toLowerCase() : "";
    var password = req.body.password;
    var type = "user"; // Server assigns default role
    var profile_pic_url = req.body.profile_pic_url
        ? req.body.profile_pic_url.trim()
        : "";

    // -----------------------------
    // Input Validation
    // -----------------------------

    // Username validation
    if (!username || username.length < 3 || username.length > 30) {
        return res.status(400).json({
            Message: "Username must be between 3 and 30 characters."
        });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        return res.status(400).json({
            Message: "Invalid email address."
        });
    }

    // Password Strength Validation
    const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

    if (!passwordRegex.test(password)) {
        return res.status(400).json({
            Message: "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character."
        });
    }

    if (profile_pic_url && !isValidProfilePic(profile_pic_url)) {
        return res.status(400).json({
            Message: "Profile image must be a valid base64-encoded JPEG or an image URL."
        });
    }

    resolveProfilePicForStorage(profile_pic_url, email || username, function (uploadErr, storedProfilePic) {
        if (uploadErr) {
            console.error(uploadErr);
            return res.status(500).json({
                Message: "Could not upload profile image to S3."
            });
        }

        userDB.insertUser(
            username,
            email,
            password,
            type,
            storedProfilePic,
            function (err, results) {

                if (err) {

                    // Prevent username/email enumeration
                    if (err.code === "ER_DUP_ENTRY") {

                        console.error(err);

                        return res.status(422).json({
                            Message: "The requested resource already exists."
                        });
                    }

                    console.error(err);

                    return res.status(500).json({
                        Message: "Internal Server Error"
                    });
                }

                // Output sanitisation
                return res.status(201).json({
                    userid: results.insertId
                });
            }
        );
    });
});


//ENDPOINT 3
//GET /user/:userid
//Get user by user id
app.get('/users/:userid', function (req, res) {

    //retrieve user input
    var userid = req.params.userid;

    userDB.getUserByUserid(userid, function (err, results) {

        if (err) {

            console.log(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            res.status(200);
            res.type("json");
            res.send(results);
        }
    });
});


//ENDPOINT 4
//POST /category
//Add a new category
app.post('/category',  function (req, res) {

    //retrieve category input
    var catname = req.body.catname;
    var cat_description = req.body.description;


    categoryDB.insertCategory(catname, cat_description, function (err, results) {

        if (err) {

            // Check for Duplication Entry
            if (err.code === "ER_DUP_ENTRY") {

                // Duplicate entry error for the category name 
                if (err.sqlMessage.includes("catname")) {

                    console.log(err);

                    res.status(422);
                    res.type("json");
                    res.send(`{"Message":"The category name provided already exists."}`);
                }
            }

            // Any other error
            else {

                console.log(err);

                res.status(500);
                res.type("json");
                res.send(`{"Message":"Internal Server Error"}`);
            }
        }

        else {

            res.status(201);
            res.type("json");
            res.send(`{"Message":"Rows affected:${results.affectedRows}"}`);

        }
    });
});


//ENDPOINT 5
//POST /platform
//Add a new platform
app.post('/platform',  function (req, res) {

    //retrieve platform input
    var platform_name = req.body.platform_name;
    var platform_description = req.body.description;


    platformDB.insertPlatform(platform_name, platform_description, function (err, results) {

        if (err) {

            // Check for Duplication Entry
            if (err.code === "ER_DUP_ENTRY") {

                // Duplicate entry error for the platform name 
                if (err.sqlMessage.includes("platform_name")) {

                    console.log(err);

                    res.status(422);
                    res.type("json");
                    res.send(`{"Message":"The platform name provided already exists."}`);
                }
            }

            else {

                console.log(err);

                res.status(500);
                res.type("json");
                res.send(`{"Message":"Internal Server Error"}`);
            }
        }

        else {

            res.status(201);
            res.type("json");
            res.send(`{"Message":"Rows affected:${results.affectedRows}"}`);
        }
    });
});


//ENDPOINT 6
//POST /game
//Add a new game
app.post('/game', upload.single('game_image'), function (req, res) {

    var title = req.body.title;
    var game_description = req.body.description;
    var price = req.body.price;
    var platformid = req.body.platformid;
    var categoryid = req.body.categoryid;
    var year = req.body.year;
    var game_image = req.file;
    console.log(price);

    resolveGameImageForStorage(game_image, title, function (uploadErr, storedGameImage) {
        if (uploadErr) {
            console.error(uploadErr);
            res.status(500);
            res.type("json");
            return res.send(`{"Message":"Could not upload game image to S3"}`);
        }

        gameDB.insertGame(title, game_description, year, storedGameImage, function (err, results) {

            if (err) {

                console.log(err);
                res.status(500);
                res.type("json");
                res.send(`{"Message":"Internal Server Error"}`);
            }

            else {

                // Get the gameid
                var gameID = results.insertId;

                console.log(price);
                gameDB.insertGame_Platform(gameID, price, platformid, function (err) {

                    if (err) {

                        console.log(err);
                        res.status(500);
                        res.type("json");
                        res.send(`{"Message":"Internal Server Error with game_platform"}`);
                    }

                    else {

                        gameDB.insertGame_Category(gameID, categoryid, function (err) {

                            if (err) {

                                console.log(err);
                                res.status(500);
                                res.type("json");
                                res.send(`{"Message":"Internal Server Error with game_category"}`);
                            }

                            else {

                                res.status(201);
                                res.type("json");
                                res.send(`{"Message":"gameid: ${gameID}"}`);
                            }
                        });
                    }
                });
            }
        });
    });
});


//ENDPOINT 7
//GET /game/:platform
//Get games based on platform name
app.get('/game_platform/:platform', function (req, res) {

    var platform_name = req.params.platform;

    platformDB.getGameByPlatformName(platform_name, function (err, results) {

        if (err) {

            console.log(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            res.status(200);
            res.type("json");
            res.send(results);
        }
    });
});


//ENDPOINT 8
//DELETE /game/:id
//Delete a game
app.delete('/game/:id', function (req, res) {

    var gameID = req.params.id;

    gameDB.deleteGame(gameID, function (err, results) {

        if (err) {

            console.log(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            res.status(204);
            res.type("json");
            res.send();
        }
    });
});


//ENDPOINT 10
//POST /user/:uid/game/:gid/review
//User add review to game
app.post('/users/:uid/game/:gid/review', verifyToken, function (req, res) {

    var userid = req.params.uid;
    var gameID = req.params.gid;
    var content = req.body.content ? String(req.body.content).trim() : '';
    var rating = req.body.rating;

    if (!content || content.length > 1000 || /[<>]/.test(content)) {
        securityLog.audit('invalid_review_input', {
            reason: 'invalid_content',
            userid: req.params.uid,
            gameID: req.params.gid
        });

        return res.status(400).json({
            Message: 'Invalid review input'
        });
    }

    if (!/^[1-5]$/.test(String(rating))) {
        securityLog.audit('invalid_review_input', {
            reason: 'invalid_rating',
            userid: req.params.uid,
            gameID: req.params.gid
        });

        return res.status(400).json({
            Message: 'Invalid review input'
        });
    }

    function insertWithLocalUser(localUserid) {
        reviewDB.insertReview(localUserid, gameID, content, rating, function (err, results) {

            if (err) {

                console.log(err);

                res.status(500);
                res.type("json");
                return res.send(`{"Message":"Internal Server Error"}`);
            }

            securityLog.audit('review_created', {
                userid: localUserid,
                cognitoSub: req.cognitoSub,
                gameID: gameID,
                reviewid: results.insertId
            });

            res.status(201);
            res.type("json");
            return res.send(`{"reviewid":"${results.insertId}"}`);
        });
    }

    // Legacy JWTs carry numeric local user IDs. Cognito carries a UUID subject,
    // so create/find a local users row first to satisfy review.fk_users.
    if (/^\d+$/.test(String(userid))) {
        return insertWithLocalUser(userid);
    }

    userDB.getOrCreateCognitoUser(
        req.cognitoEmail || req.headers['x-profile-email'],
        req.cognitoUsername || req.cognitoSub || userid,
        req.cognitoSub || userid,
        req.type === 'Admin' ? 'Admin' : 'user',
        function (err, localUser) {
            if (err) {
                console.log(err);
                res.status(500);
                res.type("json");
                return res.send(`{"Message":"Internal Server Error"}`);
            }

            return insertWithLocalUser(localUser.userid);
        }
    );
});


//ENDPOINT 11
//GET /game/:id/review
//Get all reviews of a game
app.get('/game/:id/review', function (req, res) {

    var gameID = req.params.id;


    reviewDB.getReviewByGameID(gameID, function (err, results) {

        if (err) {

            console.log(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            res.status(200);
            res.type("json");
            res.send(results);
        }
    });
});


//ENDPOINT 12
//GET /game/:id
//Get game
app.get('/game/:id', function (req, res) {

    var gameID = req.params.id;

    gameDB.getGameByGameID(gameID, function (err, results) {

        if (err) {

            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            // Check if game exist
            if (results.length === 0) {

                res.status(404);
                res.type("json");
                res.send(`{"Message":"Game not found"}`);
            }

            else {

                res.status(200);
                res.type("json");
                res.send(results);
            }
        }
    });
});


//ENDPOINT 13
//GET /game
//Get all game
app.get('/game', function (req, res) {

    gameDB.getAllGame(function (err, results) {

        if (err) {

            console.log(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"some error encounted!"}`);
        }

        else {

            res.status(200);
            res.type("json");
            res.send(results);
        }
    });
});


//---------------------

module.exports = app;