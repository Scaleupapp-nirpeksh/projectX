// src/models/FinanceApprovalRule.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const financeApprovalRuleSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  conditions: { type: Schema.Types.Mixed, required: true },
  requiredApprovers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('FinanceApprovalRule', financeApprovalRuleSchema);
