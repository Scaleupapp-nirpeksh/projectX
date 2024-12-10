const mongoose = require('mongoose');
const { Schema } = mongoose;

const componentSchema = new Schema({
  name: { type: String, unique: true, required: true },  // e.g. "finance", "tasks", "documentation"
  displayName: { type: String, required: true },         // user-friendly name
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Component', componentSchema);
