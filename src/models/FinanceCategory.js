const mongoose = require('mongoose');
const { Schema } = mongoose;

const financeCategorySchema = new Schema({
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    parentCategoryId: { type: Schema.Types.ObjectId, ref: 'FinanceCategory' }, // null if top-level
    description: { type: String, trim: true }
  }, { timestamps: true, index: { orgId: 1, name: 1 } });
  
  module.exports = mongoose.model('FinanceCategory', financeCategorySchema);
  