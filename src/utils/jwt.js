// src/utils/jwt.js
require('dotenv').config();
const jwt = require('jsonwebtoken');

exports.generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined. Please add it to your .env file.');
  }

  const payload = { userId: user._id, email: user.email };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
};


exports.verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
