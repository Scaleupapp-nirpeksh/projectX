// src/models/FinanceRecord.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const FinanceCategory = require('./FinanceCategory');
const FinanceFieldDefinition = require('./FinanceFieldDefinition');
const Partner = require('./Partner'); // Import Partner model

const financeRecordSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  type: { type: String, enum: ['expense', 'revenue'], required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'FinanceCategory', required: true },
  partnerId: { // New Field
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    required: false,
  },
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

// Pre-save hook for validations
financeRecordSchema.pre('save', async function(next) {
  try {
    const record = this;
    const fieldDefs = await validateReferences(record);
    
    // Validate partnerId if provided
    if (record.partnerId) {
      const partner = await Partner.findById(record.partnerId).lean();
      if (!partner) {
        throw new Error('Partner not found.');
      }
      if (partner.orgId.toString() !== record.orgId.toString()) {
        throw new Error('Partner does not belong to the same organization.');
      }
      if (partner.type !== record.type && partner.type !== 'both') { // Adjust if 'both' is applicable
        throw new Error(`Partner type (${partner.type}) does not match record type (${record.type}).`);
      }
    }

    if (fieldDefs.length > 0) {
      evaluateFormulas(record, fieldDefs);
    }

    // Check for final amount field
    const finalAmountFields = fieldDefs.filter(fd => fd.config && fd.config.isFinalAmount);
    if (finalAmountFields.length !== 1) {
      return next(new Error('Exactly one final amount field (isFinalAmount=true) is required.'));
    }

    const finalFieldName = finalAmountFields[0].name;
    const finalValue = record.fields.get(finalFieldName);
    if (typeof finalValue !== 'number') {
      return next(new Error(`The final amount field "${finalFieldName}" must be a numeric value.`));
    }

    // Partial payment logic
    const isPartialPayment = record.fields.has('total_amount') && record.fields.has('amount_paid');
    if (isPartialPayment) {
      const total = record.fields.get('total_amount');
      const paid = record.fields.get('amount_paid');
      if (typeof total !== 'number' || typeof paid !== 'number') {
        return next(new Error('Total amount and amount paid fields must be numeric.'));
      }
      if (paid > total) {
        return next(new Error('Amount paid cannot exceed total amount.'));
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Helper Functions

// Validate references: category and fields
async function validateReferences(record) {
  const category = await FinanceCategory.findById(record.categoryId).lean();
  if (!category) throw new Error('Category not found.');
  if (category.orgId.toString() !== record.orgId.toString()) {
    throw new Error('Category does not belong to the same organization.');
  }

  if (record.fields && record.fields.size > 0) {
    const fieldNames = Array.from(record.fields.keys());
    const fieldDefs = await FinanceFieldDefinition.find({
      orgId: record.orgId,
      name: { $in: fieldNames }
    }).lean();

    if (fieldDefs.length !== fieldNames.length) {
      throw new Error('Invalid field definition references (some names not found).');
    }

    // Filter by record type
    const allowedFields = [];
    for (const fd of fieldDefs) {
      const typeAllowed = fd.applicableTo.includes(record.type) || fd.applicableTo.includes('both');
      if (!typeAllowed) {
        throw new Error(`Field "${fd.name}" is not applicable to ${record.type} records.`);
      }
      allowedFields.push(fd);
    }

    return allowedFields;
  }

  return [];
}

// Evaluate formula fields
function evaluateFormulas(record, fieldDefs) {
  // Create a name -> definition map
  const nameToDef = {};
  for (const fd of fieldDefs) {
    nameToDef[fd.name] = fd;
  }

  // Build a name -> value map from record.fields
  const nameToValue = {};
  for (const [fieldName, value] of record.fields) {
    const fd = nameToDef[fieldName];
    if (!fd) continue; 
    nameToValue[fieldName] = value;
  }

  // Evaluate each formula field by name
  for (const fd of fieldDefs) {
    if (fd.type === 'formula') {
      const expr = fd.expression;
      if (!expr) continue;

      // Replace field names in the expression with their values
      const safeExpr = expr.replace(/\b[a-zA-Z_]\w*\b/g, match => {
        if (match in nameToValue) {
          const val = nameToValue[match];
          if (typeof val !== 'number') {
            throw new Error(`Formula field ${fd.name} references a non-numeric field: ${match}`);
          }
          return val;
        }
        return '0';
      });

      let result;
      try {
        result = Function('"use strict";return (' + safeExpr + ')')();
      } catch (e) {
        throw new Error(`Error evaluating formula for field ${fd.name}: ${e.message}`);
      }

      // Store the result back into record.fields by name
      record.fields.set(fd.name, result);
    }
  }
}

module.exports = mongoose.model('FinanceRecord', financeRecordSchema);
