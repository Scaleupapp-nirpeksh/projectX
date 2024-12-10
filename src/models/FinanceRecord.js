// src/models/FinanceRecord.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const FinanceCategory = require('./FinanceCategory');
const FinanceFieldDefinition = require('./FinanceFieldDefinition');

const financeRecordSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  type: { type: String, enum: ['expense', 'revenue'], required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'FinanceCategory', required: true },
  status: { 
    type: String, 
    enum: ['draft', 'pending_approval', 'approved', 'paid', 'completed'],
    default: 'draft' 
  },
  fields: { type: Map, of: Schema.Types.Mixed },
  recurrence: {
    frequency: { type: String, enum: ['none', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'], default: 'none' },
    nextOccurrence: { type: Date },
    endDate: { type: Date }
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  approvalsRequired: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  approvalsGiven: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  paidOn: { type: Date }
}, { timestamps: true });

async function validateReferences(record) {
  const category = await FinanceCategory.findById(record.categoryId).lean();
  if (!category) throw new Error('Category not found.');
  if (category.orgId.toString() !== record.orgId.toString()) {
    throw new Error('Category does not belong to the same organization.');
  }

  if (record.fields && record.fields.size > 0) {
    const fieldDefinitionIds = Array.from(record.fields.keys()).map(id => mongoose.Types.ObjectId(id));
    const fieldDefs = await FinanceFieldDefinition.find({ 
      _id: { $in: fieldDefinitionIds }, 
      orgId: record.orgId 
    }).lean();

    if (fieldDefs.length !== fieldDefinitionIds.length) {
      throw new Error('Invalid field definition references.');
    }

    return fieldDefs;
  }

  return [];
}

function evaluateFormulas(record, fieldDefs) {
  // Build a map from fieldId -> fieldValue and fieldId -> fieldName
  const fieldIdToName = {};
  const fieldIdToDef = {};
  for (const fd of fieldDefs) {
    fieldIdToName[fd._id.toString()] = fd.name;
    fieldIdToDef[fd._id.toString()] = fd;
  }

  // Build a name -> value map for evaluation
  const nameToValue = {};
  for (const [fieldId, value] of record.fields) {
    const fd = fieldIdToDef[fieldId];
    if (!fd) continue;
    nameToValue[fd.name] = value; 
  }

  // Evaluate each formula field
  for (const fd of fieldDefs) {
    if (fd.type === 'formula') {
      const expr = fd.expression;
      if (!expr) continue;

      // Simple parser: replace field names in expr with their values from nameToValue
      // e.g., expr: "amount * 0.05"
      // If amount=1000, expr after replacement: "1000 * 0.05"
      // Evaluate using a safe eval or a small math parser
      const safeExpr = expr.replace(/\b[a-zA-Z_]\w*\b/g, match => {
        // match might be a field name, replace with value
        if (match in nameToValue) {
          const val = nameToValue[match];
          if (typeof val !== 'number') {
            throw new Error(`Formula field ${fd.name} references a non-numeric field: ${match}`);
          }
          return val;
        }
        return '0'; // or throw error if undefined field
      });

      let result;
      try {
        // Evaluate the expression safely:
        // In a production system, consider a safer evaluation method, such as a small math parser.
        result = Function('"use strict";return (' + safeExpr + ')')();
      } catch (e) {
        throw new Error(`Error evaluating formula for field ${fd.name}: ${e.message}`);
      }

      // Store the result back
      record.fields.set(fd._id.toString(), result);
    }
  }
}

financeRecordSchema.pre('save', async function(next) {
  try {
    const record = this;
    const fieldDefs = await validateReferences(record);
    if (fieldDefs.length > 0) {
      evaluateFormulas(record, fieldDefs);
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('FinanceRecord', financeRecordSchema);
