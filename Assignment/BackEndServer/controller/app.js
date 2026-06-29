/*


Summary: The app.js is used run the functions and what it displays.
*/

const express = require('express');
const bodyParser = require('body-parser');
const userDB = require('../model/users');
const categoryDB = require('../model/category');
const platformDB = require('../model/platform');
const reviewDB = require('../model/review');
const gameDB = require('../model/game');
var verifyToken = require('../auth/verifyToken.js');
var requireAdmin = require('../auth/requireAdmin.js');
var { audit, safeError } = require('../securityLog.js');

var DUPLICATE_MSG = '{"Message":"The requested resource already exists."}';

const app = express();

var cors = require('cors');

app.options('*', cors());
app.use(cors());

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




var urlencodedParser = bodyParser.urlencoded({ extended: false });
app.use(urlencodedParser);  //attach body-parser middleware
app.use(bodyParser.json()); //parse json data

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function sanitizeText(value, maxLength) {
    return normalizeText(value)
        .replace(/\u0000/g, '')
        .replace(/<[^>]*>/g, '')
        .slice(0, maxLength);
}

function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value));
}

function isPositiveInteger(value) {
    return /^[1-9]\d*$/.test(normalizeText(String(value)));
}

function isYear(value) {
    if (!/^[1-9]\d{3}$/.test(normalizeText(String(value)))) {
        return false;
    }

    var year = Number(value);
    return year >= 1950 && year <= new Date().getFullYear() + 1;
}

function isRating(value) {
    return /^[1-5]$/.test(normalizeText(String(value)));
}

function isMoney(value) {
    return /^(?:\d+)(?:\.\d{1,2})?$/.test(normalizeText(String(value)));
}

function normalizeCsv(value, validator) {
    if (typeof value !== 'string') {
        return null;
    }

    var items = value.split(',').map(function (part) {
        return normalizeText(part);
    }).filter(Boolean);

    if (items.length === 0 || !items.every(validator)) {
        return null;
    }

    return items.join(',');
}

function rejectBadRequest(res, message) {
    res.status(400);
    res.type('json');
    return res.send({ Message: message });
}

app.use(function (req, res, next) {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' data: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self' http://localhost:8081; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});


//WebService endpoints
//---------------------


// Verifying user role
app.get('/CheckRole',verifyToken, function (req, res) {

    const userRole = req.type;

    res.status(200);
    res.type("json");
    res.send({ role: userRole });
});



// Search Game Details
app.get('/searchgamedetails/:gameID', function (req, res) {

    var gameID = req.params.gameID;

    if (!isPositiveInteger(gameID)) {
        return rejectBadRequest(res, 'Invalid game ID');
    }

    gameDB.getSearchGameDetail(gameID, function (err, results) {

        if (err) {

            safeError(err);

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

    var input = sanitizeText(req.body.input, 100);
    var platform = sanitizeText(req.body.platID, 100);
    var category = sanitizeText(req.body.catID, 100);

    gameDB.getSearchGame(input, platform, category, function (err, results) {

        if (err) {

            safeError(err);

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


//User Login
app.post('/users/login', function (req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var rememberMe = req.body.rememberMe || false;

    userDB.loginUser(email, password, function (err, token, result) {

        if (!err) {

            audit('login_success', { userid: result[0].userid, email: email, type: result[0].type });

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            delete result[0]['password'];//clear the password in json data, do not send back to client

            // If rememberMe is true, set a cookie with the token for persistent login
            if (rememberMe) {
                const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
                res.cookie('rememberMeToken', token, { httpOnly: true, maxAge });
            }

            res.json({ success: true, UserData: JSON.stringify(result), token: token, status: 'You are successfully logged in!' });
            res.send();
        }

        else {

            audit('login_failed', { email: email });
            res.status(500);
            res.json({ success: false, message: 'Login failed' });
        }
    });
});


//User Logout
app.post('/users/logout', function (req, res) {
    audit('logout', {});
    res.clearCookie('rememberMeToken'); //clears the cookie in the response
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, status: 'Log out successful!' });
});


//Get all category
app.get('/category', function (req, res) {


    categoryDB.getAllCat(function (err, results) {

        // If Any error occur
        if (err) {

            safeError(err);

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

            safeError(err);

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
app.get('/users', verifyToken, requireAdmin, function (req, res) {


    userDB.getUser(function (err, results) {

        // If Any error occur
        if (err) {

            safeError(err);

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
app.post('/users', verifyToken, requireAdmin, function (req, res) {

    //retrieve user input
    var username = sanitizeText(req.body.username, 100);
    var email = normalizeText(req.body.email).toLowerCase();
    var password = normalizeText(req.body.password);
    var type = 'user';
    var profile_pic_url = sanitizeText(req.body.profile_pic_url, 1000);

    if (!username || !email || !password || !isEmail(email)) {
        return rejectBadRequest(res, 'Invalid user input');
    }


    userDB.insertUser(username, email, password, type, profile_pic_url, function (err, results) {

        if (err) {

            // Check for Duplication Entry
            if (err.code === "ER_DUP_ENTRY") {

                safeError(err);

                res.status(422);
                res.type("json");
                res.send(DUPLICATE_MSG);
            }

            else {

                safeError(err);

                res.status(500);
                res.type("json");
                res.send(`{"Message":"Internal Server Error"}`);
            }
        }

        else {

            audit('user_registered', { userid: results.insertId, username: username, by: req.userid });

            res.status(201);
            res.type("json");
            res.send(`{"userid":"${results.insertId}"}`);
        }
    });
});


//ENDPOINT 3
//GET /user/:userid
//Get user by user id
app.get('/users/:userid', verifyToken, requireAdmin, function (req, res) {

    //retrieve user input
    var userid = req.params.userid;

    if (!isPositiveInteger(userid)) {
        return rejectBadRequest(res, 'Invalid user ID');
    }

    userDB.getUserByUserid(userid, function (err, results) {

        if (err) {

            safeError(err);

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
app.post('/category', verifyToken, requireAdmin, function (req, res) {

    //retrieve category input
    var catname = sanitizeText(req.body.catname, 100);
    var cat_description = sanitizeText(req.body.description, 1000);

    if (!catname || !cat_description) {
        return rejectBadRequest(res, 'Invalid category input');
    }


    categoryDB.insertCategory(catname, cat_description, function (err, results) {

        if (err) {

            // Check for Duplication Entry
            if (err.code === "ER_DUP_ENTRY") {

                safeError(err);

                res.status(422);
                res.type("json");
                res.send(DUPLICATE_MSG);
            }

            // Any other error
            else {

                safeError(err);

                res.status(500);
                res.type("json");
                res.send(`{"Message":"Internal Server Error"}`);
            }
        }

        else {

            audit('category_created', { catname: catname, by: req.userid });

            res.status(201);
            res.type("json");
            res.send(`{"Message":"Rows affected:${results.affectedRows}"}`);

        }
    });
});


//ENDPOINT 5
//POST /platform
//Add a new platform
app.post('/platform', verifyToken, requireAdmin, function (req, res) {

    //retrieve platform input
    var platform_name = sanitizeText(req.body.platform_name, 100);
    var platform_description = sanitizeText(req.body.description, 1000);

    if (!platform_name || !platform_description) {
        return rejectBadRequest(res, 'Invalid platform input');
    }


    platformDB.insertPlatform(platform_name, platform_description, function (err, results) {

        if (err) {

            // Check for Duplication Entry
            if (err.code === "ER_DUP_ENTRY") {

                safeError(err);

                res.status(422);
                res.type("json");
                res.send(DUPLICATE_MSG);
            }

            else {

                safeError(err);

                res.status(500);
                res.type("json");
                res.send(`{"Message":"Internal Server Error"}`);
            }
        }

        else {

            audit('platform_created', { platform_name: platform_name, by: req.userid });

            res.status(201);
            res.type("json");
            res.send(`{"Message":"Rows affected:${results.affectedRows}"}`);
        }
    });
});


//ENDPOINT 6
//POST /game
//Add a new game
app.post('/game', verifyToken, requireAdmin, upload.single('game_image'), function (req, res) {

    var title = sanitizeText(req.body.title, 200);
    var game_description = sanitizeText(req.body.description, 4000);
    var price = normalizeCsv(req.body.price, isMoney);
    var platformid = normalizeCsv(req.body.platformid, isPositiveInteger);
    var categoryid = normalizeCsv(req.body.categoryid, isPositiveInteger);
    var year = normalizeText(req.body.year);
    var game_image = req.file;

    if (!title || !game_description || !price || !platformid || !categoryid || !year || !game_image || !isYear(year)) {
        return rejectBadRequest(res, 'Invalid game input');
    }

    if (price.split(',').length !== platformid.split(',').length) {
        return rejectBadRequest(res, 'Price and platform counts must match');
    }

    gameDB.insertGame(title, game_description, year, game_image, function (err, results) {

        if (err) {

            safeError(err);
            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            // Get the gameid
            var gameID = results.insertId;

            gameDB.insertGame_Platform(gameID, price, platformid, function (err) {

                if (err) {

                    safeError(err);
                    res.status(500);
                    res.type("json");
                    res.send(`{"Message":"Internal Server Error with game_platform"}`);
                }

                else {

                    gameDB.insertGame_Category(gameID, categoryid, function (err) {

                        if (err) {

                            safeError(err);
                            res.status(500);
                            res.type("json");
                            res.send(`{"Message":"Internal Server Error with game_category"}`);
                        }

                        else {

                            audit('game_created', { gameID: gameID, title: title, by: req.userid });

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


//ENDPOINT 7
//GET /game/:platform
//Get games based on platform name
app.get('/game_platform/:platform', function (req, res) {

    var platform_name = sanitizeText(req.params.platform, 100);

    if (!platform_name) {
        return rejectBadRequest(res, 'Invalid platform input');
    }

    platformDB.getGameByPlatformName(platform_name, function (err, results) {

        if (err) {

            safeError(err);

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
app.delete('/game/:id', verifyToken, requireAdmin, function (req, res) {

    var gameID = req.params.id;

    if (!isPositiveInteger(gameID)) {
        return rejectBadRequest(res, 'Invalid game ID');
    }

    gameDB.deleteGame(gameID, function (err, results) {

        if (err) {

            safeError(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            audit('game_deleted', { gameID: gameID, by: req.userid });

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
    var content = sanitizeText(req.body.content, 2000);
    var rating = normalizeText(req.body.rating);

    if (!isPositiveInteger(userid) || !isPositiveInteger(gameID) || !content || !isRating(rating)) {
        return rejectBadRequest(res, 'Invalid review input');
    }

    if (String(req.userid) !== String(userid)) {
        audit('review_denied', { actor: req.userid, target: userid, gameID: gameID });
        res.status(403);
        return res.json({ auth: false, message: 'Not authorized!' });
    }

    reviewDB.insertReview(userid, gameID, content, rating, function (err, results) {

        if (err) {

            safeError(err);

            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        }

        else {

            audit('review_created', { userid: userid, gameID: gameID, reviewid: results.insertId });

            res.status(201);
            res.type("json");
            res.send(`{"reviewid":"${results.insertId}"}`);
        }
    });
});


//ENDPOINT 11
//GET /game/:id/review
//Get all reviews of a game
app.get('/game/:id/review', function (req, res) {

    var gameID = req.params.id;

    if (!isPositiveInteger(gameID)) {
        return rejectBadRequest(res, 'Invalid game ID');
    }


    reviewDB.getReviewByGameID(gameID, function (err, results) {

        if (err) {

            safeError(err);

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

    if (!isPositiveInteger(gameID)) {
        return rejectBadRequest(res, 'Invalid game ID');
    }

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

            safeError(err);

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
