// src/models/FinanceFieldDefinition.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const financeFieldDefinitionSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true, trim: true }, // e.g. "invoiceNumber", "paymentMethod"
  label: { type: String, trim: true },
  type: { 
    type: String, 
    enum: ['string', 'number', 'date', 'dropdown', 'formula', 'boolean'], 
    required: true 
  },
  options: [{ type: String }], // for dropdown fields
  expression: { type: String }, // for formula fields
  // applicableTo: specify which record types this field is used for: 'expense', 'revenue', or both
  applicableTo: {
    type: [String],
    enum: ['expense', 'revenue', 'both'],
    default: ['expense','revenue']
  },
  config: { 
    type: Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true, index: { orgId: 1, name: 1 } });

module.exports = mongoose.model('FinanceFieldDefinition', financeFieldDefinitionSchema);
