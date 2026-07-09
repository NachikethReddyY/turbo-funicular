/*


Summary: The databaseConfig.js is used to create the connection with the server.
*/


var mysql = require('mysql2');

var dbconnect = {

    getConnection: function () {

        var conn = mysql.createConnection({

            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "nr",
            password: process.env.DB_PASSWORD || "Nachiketh1",
            database: process.env.DB_NAME || "sp_games"
        });

        return conn;
    }
};

module.exports = dbconnect