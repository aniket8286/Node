const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

//signup page
exports.signup = async (req, res) => {
    try {
        //data fetch
        const { username, Password, Email, FullName } = req.body;
        
        //validate - Fixed the logical AND operator
        if (!username || !Password || !Email || !FullName) {
            return res.status(400)
                .json({
                    success: false,
                    message: 'All fields are required',
                });
        }
        
        //check if user already exists - Fixed field name and logic
        const checkUserPresent = await User.findOne({ Email });
        if (checkUserPresent) {
            return res.status(409)
                .json({
                    success: false,
                    message: "User already exists, please log in",
                });
        }
        
        //hash password
        const passwordhash = await bcrypt.hash(Password, 10);
        
        //save user in db
        const user = await User.create({
            Email,
            Password: passwordhash,
            FullName,
            username,
        });
        
        return res.status(201)
            .json({
                success: true,
                message: "User successfully registered",
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.Email,
                    fullName: user.FullName
                }
            });
    }
    catch (error) {
        console.error("Signup error:", error);
        return res.status(500)
            .json({
                success: false,
                message: "Internal server error during signup",
            });
    }
}

//login 
exports.login = async (req, res) => {
    try {
        const { username, Password } = req.body;
        
        if (!username || !Password) {
            return res.status(400)
                .json({
                    success: false,
                    message: "All fields are required",
                });
        }
        
        //check if user exists - Fixed query method
        const checkUser = await User.findOne({ username });
        if (!checkUser) {
            return res.status(404)
                .json({
                    success: false,
                    message: 'User is not registered, please signup first',
                });
        }
        
        //compare passwords - Fixed variable names and logic
        if (await bcrypt.compare(Password, checkUser.Password)) {
            const payload = {
                email: checkUser.Email,
                id: checkUser._id,
                username: checkUser.username
            }
            
            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: "24h",
            });
            
            console.log("Generated JWT Token is:", token);
            
            // Create user object without password
            const userResponse = {
                id: checkUser._id,
                username: checkUser.username,
                email: checkUser.Email,
                fullName: checkUser.FullName
            };
            
            //set cookie for token and return success response
            const options = {
                expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                httpOnly: true,
            }
            
            res.cookie("token", token, options).status(200)
                .json({
                    success: true,
                    token,
                    user: userResponse,
                    message: "Login successful",
                });
        }
        //when password doesn't match
        else {
            return res.status(401)
                .json({
                    success: false,
                    message: 'Invalid credentials',
                });
        }
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500)
            .json({
                success: false,
                message: 'Login failed - internal server error',
            });
    }
}
