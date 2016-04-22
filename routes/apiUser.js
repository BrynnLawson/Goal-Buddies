﻿var express = require('express');
var router = express.Router();
var url = require('url');
var HttpStatus = require('http-status-codes');
var bcrypt = require('bcrypt-nodejs');
var config = require('../config');
var jwt = require('jsonwebtoken');
var middle = require('./commonMiddleware');
var errorHandler = require('../lib/errorHandler');

var UserModel = require('../models/userModel');
var GoalModel = require('../models/goalModel');

// Auxiliary function to remove a username from an array
function removeUsername(targetArray, username) {
    var i = 0;
    for(; i < targetArray.length; i++) {
        if(targetArray[i] == username) break;
    }
    
    targetArray.splice(i, 1);
}

/*
 * Login function
 * Parameters:
 *      username : Your username
 *      password : Your password
 * Returns:
 *      statusCode : OK (200) if successful, Unauthorized (401) on failure
 *      token : A unique token (application specific) required for
 *              other functions
 *      user : A JSONObject representing your user details
 */
router.post('/login', function (req, res, next) {
    var username = req.body.username;
    var password = req.body.password;
    
    if (typeof username == 'undefined' || typeof password == 'undefined' ||
        username == "" || password == "") {
        // Some parameters are missing
        errorHandler.missingParameters(res);
    }
    else {
        UserModel.findOne({ 'username': username }, function (err, user) {
            if (err || !user || !bcrypt.compareSync(password, user.password)) {
                // Invalid credentials
                res.status(HttpStatus.UNAUTHORIZED);
                return res.json(
                    {
                        statusCode : HttpStatus.UNAUTHORIZED,
                        devError : "An invalid username/password combination " +
                        "was provided. Please prompt the user again.",
                        error : "Invalid username/password combination.",
                    }
                );
            }
            else {
                // Success! Build a JSON web token and give it to the client
                var trimmedUser = {
                    _id : user._id,
                    username : username
                };
                res.status(HttpStatus.OK);
                return res.json(
                    {
                        token : jwt.sign(
                            trimmedUser,
                            config.tokenSecret,
                            { expiresInMinutes: 1440 * 30 }  // expires in 1 month
                        ),
                        // This is used in any apps that need to save the credentials
                        // such as the Android app
                        user : trimmedUser,
                        expires : new Date().getTime() + 30 * 24 * 3600000   // Send expiration time as well
                    }
                );
            }
        });
    }
});

/*
 * Register function
 * Parameters:
 *      username : Your username
 *      password : Your password
 *      firstname : Your first name
 *      lastname : Your last name
 *      city : Your current city of residence
 * Returns:
 *      statusCode : Created (201) if successful, Conflict (409) on failure
 *      token : A unique token (application specific) required for
 *              other functions
 *      user : A JSONObject representing your user details
 */
router.post('/', function (req, res, next) {
    var username = req.body.username;
    var password = req.body.password;
    var firstName = req.body.firstName;
    var lastName = req.body.lastName;
    var city = req.body.city;

    if (typeof username == 'undefined' || typeof password == 'undefined' || 
        typeof firstName == 'undefined' || typeof lastName == 'undefined' || 
        typeof city == 'undefined' ||
        username == '' || password == '' || 
        firstName == '' || lastName == '' || 
        city == '') {

        // Not all fields were entered
        console.log("Attempted registration, missing fields.");
        errorHandler.missingParameters(res);
    }
    else {
        var newUser = new UserModel();
        newUser.username = username;
        newUser.password = bcrypt.hashSync(password);
        newUser.firstName = firstName;
        newUser.lastName = lastName;
        newUser.city = city;

        newUser.save(function (err) {
            if (err) {
                if (err.code == "11000") {
                    console.log("Attempted registration, duplicate username: " + username + ".");

                    // Duplicate key
                    res.status(HttpStatus.CONFLICT);
                    return res.json(
                        {
                            statusCode : HttpStatus.CONFLICT,
                            devError : "Username conflict with requested username.",
                            error : "This username has already been taken."
                        }
                    );
                }
                else {
                    // Something weird happened
                    errorHandler.logError(err, res);
                }
            }
            
            else {
                var newGoal = new GoalModel();
                newGoal.userId = newUser._id;
                newGoal.description = "Create a goal and get at it using Goal Buddies!";
                newGoal.type = 1;
                
                newGoal.save(function (gerr) {
                    console.log(gerr);
                    if (!gerr) {
                        var trimmedUser = {
                            _id : newUser._id,
                            username : username
                        };
                        // Success
                        console.log("Successfully registered user: " + username + ".");
                        res.status(HttpStatus.CREATED);
                        return res.json(
                            {
                                token : jwt.sign(
                                    trimmedUser,
                                    config.tokenSecret,
                                    { expiresInMinutes: 1440 }  // expires in 24 hours
                                ),
                                user : trimmedUser,
                                expires : new Date().getTime() + 24 * 3600000   // Send expiration time as well
                            }
                        );
                    }
                    else {
                        // Something weird happened
                        errorHandler.logError(err, res);
                    }
                });
            }
        });
    }
});

/*
 * Get a user's details function
 * Parameters:
 *      username : The target user's username
 *      token : Your personal access token
 * Returns:
 *      statusCode : Created (201) if successful, Unauthorized (401) on failure
 *      user : A JSONObject representing the user's available details
 */
router.get('/search/:username', middle.verifyToken, function (req, res, next) {
    var userMatchObject = {
        username : req.params.username
    }
    
    UserModel.findOne(userMatchObject, function(err, user) {
        if(err) {
            errorHandler.logError(err, res);
        } else {
            if(user && user.blocked.indexOf(req.user.username) > -1) {
                user = null;
            }
            return res.json({user: user});
        }
    });
});

/*
 * Request a friendship with another user
 * Parameters:
 *      username : The target user's username
 *      token : Your personal access token
 * Returns:
 *      statusCode : No Content (204) if successful, Unauthorized (401),
 *                   Bad Request (400), or Not Found (404) on failure
 */
router.get('/request/:username', middle.verifyToken, function (req, res, next) {
    // Find both users
    UserModel.findOne({username: req.user.username}, function(err, you) {
        if(err) {
            errorHandler.logError(err, res);
        } else {
            UserModel.findOne({username: req.params.username}, function(err, them) {
                if(err) {
                    errorHandler.logError(err, res);
                } else {
                    foundBoth(you, them);
                }
            }
        }
    });
    
    function foundBoth(you, them) {
        var yourUsername = you.username;
        var theirUsername = them.username;
        
        if(you.blocked.indexOf(theirUsername) > -1 || them.blocked.indexOf(yourUsername)) {
            // Someone blocked someone
            errorHandler.targetUserNotFound(err, res);
        } else if (you.incoming.indexOf(theirUsername) > -1 || them.incoming.indexOf(yourUsername) ||
                   you.outgoing.indexOf(theirUsername) > -1 || them.outgoing.indexOf(yourUsername)}){
            // You can't request when a request is already in progress
            errorHandler.relationFunctionInProgress(err, res);
        } else if (you.friends.indexOf(theirUsername) > -1 || them.friends.indexOf(yourUsername)){
            // You can't request when you're already friends
            errorHandler.relationFunctionInProgress(err, res);
        } else {
            // Everything is fine, update and save
            you.outgoing.push(theirUsername);
            you.save(function(err) {
                if(err) {
                    errorHandler.logError(err, res);
                } else {
                    them.incoming.push(yourUsername);
                    them.save(function(err) {
                        if(err) {
                            // Undo your outgoing array because it was pushed
                            removeUsername(you.outgoing, theirUsername);
                            you.save(function(yourErr) {
                                if(yourErr) {
                                    errorHandler.logError(yourErr, res);
                                } else {
                                    errorHandler.logError(err, res);
                                }
                            }
                        } else {
                            res.status(HttpStatus.NO_CONTENT);
                            return res.send('');
                        }
                    });
                }
            });
        }
    }
});



module.exports = router;