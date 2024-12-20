// src/models/Role.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const roleSchema = new Schema({
  name: { type: String, required: true, unique: true },
  permissions: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
