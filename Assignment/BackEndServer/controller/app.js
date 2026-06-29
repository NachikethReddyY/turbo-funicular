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

    var input = req.body.input;
    var platform = req.body.platID;
    var category = req.body.catID;

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
    audit('legacy_login_blocked', {});
    res.status(410);
    res.json({
        success: false,
        message: 'Local password login has been replaced by AWS Cognito hosted login.'
    });
});


//User Logout
app.post('/users/logout', function (req, res) {
    audit('logout', {});
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, status: 'Use the Cognito hosted logout endpoint from the frontend.' });
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
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;
    var type = 'user';
    var profile_pic_url = req.body.profile_pic_url;


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
    var catname = req.body.catname;
    var cat_description = req.body.description;


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
    var platform_name = req.body.platform_name;
    var platform_description = req.body.description;


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

    var title = req.body.title;
    var game_description = req.body.description;
    var price = req.body.price;
    var platformid = req.body.platformid;
    var categoryid = req.body.categoryid;
    var year = req.body.year;
    var game_image = req.file;

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

    var platform_name = req.params.platform;

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
    var content = req.body.content;
    var rating = req.body.rating;

    if (String(req.userid) !== String(userid)) {
        audit('review_denied', { actor: req.userid, target: userid, gameID: gameID });
        res.status(403);
        return res.json({ auth: false, message: 'Not authorized!' });
    }

    function insertReviewForUser(appUserid) {
        reviewDB.insertReview(appUserid, gameID, content, rating, function (err, results) {

            if (err) {

                safeError(err);

                res.status(500);
                res.type("json");
                res.send(`{"Message":"Internal Server Error"}`);
            }

            else {

                audit('review_created', { userid: appUserid, gameID: gameID, reviewid: results.insertId });

                res.status(201);
                res.type("json");
                res.send(`{"reviewid":"${results.insertId}"}`);
            }
        });
    }

    if (/^\d+$/.test(String(userid))) {
        return insertReviewForUser(userid);
    }

    var email = req.cognitoEmail || req.body.email;

    if (!email) {
        res.status(422);
        res.type("json");
        return res.send(`{"Message":"User email is required to link Cognito user to local profile."}`);
    }

    userDB.getUserByEmail(email, function (err, results) {
        if (err) {
            safeError(err);
            res.status(500);
            res.type("json");
            return res.send(`{"Message":"Internal Server Error"}`);
        }

        if (!results || results.length === 0) {
            var usernameBase = email.split('@')[0] || req.cognitoUsername || 'cognito_user';
            var usernameSuffix = req.cognitoSub ? String(req.cognitoSub).slice(0, 8) : Date.now();
            var username = usernameBase + '_' + usernameSuffix;
            var type = req.type || 'user';

            return userDB.insertCognitoUser(username, email, type, function (insertErr, insertResults) {
                if (insertErr) {
                    safeError(insertErr);
                    res.status(500);
                    res.type("json");
                    return res.send(`{"Message":"Internal Server Error"}`);
                }

                audit('user_registered', { userid: insertResults.insertId, username: username, by: req.userid, source: 'cognito_review' });
                insertReviewForUser(insertResults.insertId);
            });
        }

        insertReviewForUser(results[0].userid);
    });
});


//ENDPOINT 11
//GET /game/:id/review
//Get all reviews of a game
app.get('/game/:id/review', function (req, res) {

    var gameID = req.params.id;


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
