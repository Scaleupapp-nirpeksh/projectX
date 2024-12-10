const mongoose = require("mongoose");

const FinanceCategorySchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  name: { type: String, required: true },
  description: { type: String },
  parentCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "FinanceCategory" },
  subCategories: { type: [String], default: [] }, // Add this line
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FinanceCategory", FinanceCategorySchema);
