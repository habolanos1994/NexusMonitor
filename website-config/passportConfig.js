const passport = require('passport');
const CustomStrategy = require('passport-custom').Strategy;
const fsPromises = require('fs').promises;
const path = require('path');

module.exports = () => {
    passport.use('custom', new CustomStrategy(
        async function (req, done) {
            try {
                // get the NT Login from the request
                const ntLogin = req.body.nt_login;
                //console.log("NT Login:", ntLogin); // Log the NT login

                // Read authorized users from JSON file every time
                let authorizedUsersData = await fsPromises.readFile(path.join(__dirname, 'jsonfiles', 'authorizedusers.json'), 'utf8');
                let authorizedUsers = JSON.parse(authorizedUsersData).Users;

                // Find the user in the authorized users list
                const user = authorizedUsers.find(u => u.ntLogin.toLowerCase() === ntLogin.toLowerCase());

                // if no matching user was found, fail the authentication
                if (!user) {
                    return done(null, false, { message: 'Incorrect NT Login.' });
                }

                // if a matching user was found, pass it to the done callback
                done(null, user);
            } catch (err) {
                done(err);
            }
        }
    ));

    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (user, done) {
        done(null, user);
    });
};
