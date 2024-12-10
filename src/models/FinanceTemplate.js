const mongoose = require('mongoose');
const { Schema } = mongoose;

const financeTemplateSchema = new Schema({
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['expense', 'revenue'], required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'FinanceCategory' },
    defaultFields: { type: Map, of: Schema.Types.Mixed }, 
    // same structure as FinanceRecord fields, but these are defaults.
  
    // Possibly store default recurrence settings, default status, or any other defaults.
  }, { timestamps: true, index: { orgId: 1, name: 1 } });
  
  module.exports = mongoose.model('FinanceTemplate', financeTemplateSchema);
  