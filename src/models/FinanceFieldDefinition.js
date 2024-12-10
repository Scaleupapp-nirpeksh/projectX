const mongoose = require('mongoose');
const { Schema } = mongoose;

const financeFieldDefinitionSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true, trim: true }, // e.g. "invoiceNumber", "paymentMethod"
  label: { type: String, trim: true }, // user-friendly label
  type: { 
    type: String, 
    enum: ['string', 'number', 'date', 'dropdown', 'formula', 'boolean'], 
    required: true 
  },
  options: [{ type: String }], // for dropdown fields
  expression: { type: String }, // for formula fields, e.g. "amount * 0.05"
  config: { type: Schema.Types.Mixed }, // additional validation rules, default values, etc.
}, { timestamps: true, index: { orgId: 1, name: 1 } });

module.exports = mongoose.model('FinanceFieldDefinition', financeFieldDefinitionSchema);
