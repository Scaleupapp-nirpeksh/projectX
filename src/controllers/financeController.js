// src/controllers/financeController.js
const FinanceCategory = require('../models/FinanceCategory');
const Organization = require('../models/Organization');
const User = require('../models/User'); // if needed
const FinanceFieldDefinition = require('../models/FinanceFieldDefinition');
const FinanceRecord = require('../models/FinanceRecord');
const FinanceApprovalRule = require('../models/FinanceApprovalRule');

// Helper to check admin status
function isAdmin(user, orgId) {
  const membership = user.organizations.find(m => m.orgId.toString() === orgId);
  return membership && membership.role === 'admin';
}

/**
 * Create a new finance category
 * POST /api/organizations/:orgId/components/finance/categories
 */
exports.createCategory = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, parentCategoryId, description, subCategories } = req.body;

    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can create categories.' });
    }

    if (!name) {
      return res.status(400).json({ message: 'Category name is required.' });
    }

    // Validate `subCategories` - ensure it's an array
    if (subCategories && !Array.isArray(subCategories)) {
      return res.status(400).json({ message: 'Sub-categories must be an array.' });
    }

    // Optional: validate `parentCategoryId` if provided
    let parentCategory = null;
    if (parentCategoryId) {
      parentCategory = await FinanceCategory.findById(parentCategoryId);
      if (!parentCategory || parentCategory.orgId.toString() !== orgId) {
        return res.status(400).json({ message: 'Invalid parent category.' });
      }
    }

    const category = new FinanceCategory({
      orgId,
      name,
      parentCategoryId,
      description,
      subCategories: subCategories || [], // Default to an empty array if not provided
    });

    const savedCategory = await category.save();
    res.status(201).json({ category: savedCategory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


/**
 * List all finance categories
 * GET /api/organizations/:orgId/components/finance/categories
 */
exports.listCategories = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { parentCategoryId } = req.query; // optional filter

    // User must at least be a member with finance access. Admin check not required here.
    const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this organization.' });
    }

    const query = { orgId };
    if (parentCategoryId) {
      query.parentCategoryId = parentCategoryId;
    }

    const categories = await FinanceCategory.find(query).lean();
    res.json({ categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a finance category
 * PUT /api/organizations/:orgId/components/finance/categories/:categoryId
 */
exports.updateCategory = async (req, res) => {
  try {
    const { orgId, categoryId } = req.params;
    const { name, parentCategoryId, description, subCategories } = req.body;

    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can update categories.' });
    }

    const category = await FinanceCategory.findById(categoryId);
    if (!category || category.orgId.toString() !== orgId) {
      return res.status(404).json({ message: 'Category not found in this organization.' });
    }

    if (name) {
      category.name = name;
    }
    if (description !== undefined) {
      category.description = description;
    }
    if (subCategories !== undefined) {
      if (!Array.isArray(subCategories)) {
        return res.status(400).json({ message: 'Sub-categories must be an array.' });
      }
      category.subCategories = subCategories;
    }

    if (parentCategoryId !== undefined) {
      if (parentCategoryId) {
        const parentCat = await FinanceCategory.findById(parentCategoryId);
        if (!parentCat || parentCat.orgId.toString() !== orgId) {
          return res.status(400).json({ message: 'Invalid parent category.' });
        }
        category.parentCategoryId = parentCategoryId;
      } else {
        // Remove parent category if null
        category.parentCategoryId = null;
      }
    }

    const updatedCategory = await category.save();
    res.json({ category: updatedCategory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


/**
 * Delete a finance category
 * DELETE /api/organizations/:orgId/components/finance/categories/:categoryId
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { orgId, categoryId } = req.params;

    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can delete categories.' });
    }

    // Check if category exists
    const category = await FinanceCategory.findById(categoryId);
    if (!category || category.orgId.toString() !== orgId) {
      return res.status(404).json({ message: 'Category not found in this organization.' });
    }

    // Optional: Delete sub-categories if parent is deleted
    await FinanceCategory.deleteMany({ parentCategoryId: categoryId });

    // Delete the category itself
    await FinanceCategory.deleteOne({ _id: categoryId });

    res.json({ message: 'Category and its sub-categories deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};




// Create a new field definition
exports.createFieldDefinition = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, label, type, options, expression, config, applicableTo } = req.body;

    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can create field definitions.' });
    }

    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required.' });
    }

    const allowedTypes = ['string', 'number', 'date', 'dropdown', 'formula', 'boolean'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid field type.' });
    }

    if (type === 'dropdown' && (!options || !Array.isArray(options) || options.length === 0)) {
      return res.status(400).json({ message: 'Dropdown fields require a non-empty options array.' });
    }

    if (type === 'formula' && (!expression || typeof expression !== 'string')) {
      return res.status(400).json({ message: 'Formula fields require an expression string.' });
    }

    // Validate applicableTo if provided
    let validApplicableTo = ['expense', 'revenue', 'both'];
    let finalApplicableTo = ['expense','revenue']; // default if none provided
    if (applicableTo && Array.isArray(applicableTo) && applicableTo.length > 0) {
      // Ensure applicableTo is a single value array like ['expense'] or ['revenue'] or ['both']
      // If you are only selecting one option at a time, handle that logic. For a radio button, we expect only one value in the array.
      const chosen = applicableTo[0];
      if (validApplicableTo.includes(chosen)) {
        finalApplicableTo = [chosen];
      }
    }

    const fieldDef = new FinanceFieldDefinition({
      orgId,
      name,
      label,
      type,
      options: options || [],
      expression: expression || null,
      config: config || {},
      applicableTo: finalApplicableTo
    });

    const savedField = await fieldDef.save();
    res.status(201).json({ field: savedField });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a field definition
exports.updateFieldDefinition = async (req, res) => {
  try {
    const { orgId, fieldId } = req.params;
    const { label, options, expression, config, applicableTo } = req.body;

    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can update field definitions.' });
    }

    const fieldDef = await FinanceFieldDefinition.findById(fieldId);
    if (!fieldDef || fieldDef.orgId.toString() !== orgId) {
      return res.status(404).json({ message: 'Field definition not found.' });
    }

    if (label !== undefined) fieldDef.label = label;
    if (options !== undefined && fieldDef.type === 'dropdown') {
      if (!Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ message: 'Dropdown fields require a non-empty options array.' });
      }
      fieldDef.options = options;
    }

    if (expression !== undefined && fieldDef.type === 'formula') {
      if (typeof expression !== 'string') {
        return res.status(400).json({ message: 'Formula expression must be a string.' });
      }
      fieldDef.expression = expression;
    }

    if (config !== undefined) {
      fieldDef.config = config;
    }

    // Update applicableTo if provided
    if (applicableTo && Array.isArray(applicableTo) && applicableTo.length > 0) {
      let validApplicableTo = ['expense', 'revenue', 'both'];
      const chosen = applicableTo[0];
      if (validApplicableTo.includes(chosen)) {
        fieldDef.applicableTo = [chosen];
      }
    }

    const updatedField = await fieldDef.save();
    res.json({ field: updatedField });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
  
  // List all field definitions
  exports.listFieldDefinitions = async (req, res) => {
    try {
      const { orgId } = req.params;
      const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(403).json({ message: 'Not a member of this organization.' });
      }
  
      const fields = await FinanceFieldDefinition.find({ orgId }).lean();
      res.json({ fields });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  
 // Delete a field definition
exports.deleteFieldDefinition = async (req, res) => {
  try {
    const { orgId, fieldId } = req.params;

    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can delete field definitions.' });
    }

    const fieldDef = await FinanceFieldDefinition.findById(fieldId);
    if (!fieldDef || fieldDef.orgId.toString() !== orgId) {
      return res.status(404).json({ message: 'Field definition not found.' });
    }

    // Check if used by any records
    const usageCount = await FinanceRecord.countDocuments({ orgId, [`fields.${fieldId}`]: { $exists: true } });
    if (usageCount > 0) {
      return res.status(400).json({ message: 'Cannot delete a field definition in use.' });
    }

    // Use deleteOne() instead of remove()
    await fieldDef.deleteOne();
    res.json({ message: 'Field definition deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

  

  // Create a finance record
exports.createRecord = async (req, res) => {
    try {
      const { orgId } = req.params;
      const { type, categoryId, status, fields, recurrence } = req.body;
  
      const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(403).json({ message: 'Not a member of this organization.' });
      }
  
      // Validate type
      const allowedTypes = ['expense', 'revenue'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid record type.' });
      }
  
      const record = new FinanceRecord({
        orgId,
        type,
        categoryId,
        status: status || 'approved',
        fields: fields || new Map(),
        recurrence: recurrence || {}
      });
  
      // pre-save hook will validate category and fields
      const savedRecord = await record.save();
      res.status(201).json({ record: savedRecord });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  // List finance records with filters
  exports.listRecords = async (req, res) => {
    try {
      const { orgId } = req.params;
      const { type, categoryId, status, startDate, endDate } = req.query;
  
      const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(403).json({ message: 'Not a member of this organization.' });
      }
  
      const query = { orgId };
      if (type) query.type = type; 
      if (categoryId) query.categoryId = categoryId;
      if (status) query.status = status;
  
      // If we have date fields, say records have a createdAt or a custom date field:
      // For simplicity, let's assume filtering by createdAt:
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
  
      const records = await FinanceRecord.find(query).lean();
      res.json({ records });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  // Get a single record
  exports.getRecord = async (req, res) => {
    try {
      const { orgId, recordId } = req.params;
  
      const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(403).json({ message: 'Not a member of this organization.' });
      }
  
      const record = await FinanceRecord.findById(recordId);
      if (!record || record.orgId.toString() !== orgId) {
        return res.status(404).json({ message: 'Record not found.' });
      }
  
      res.json({ record });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  

  function passesCondition(conditions, recordDoc) {
    // A very simplistic condition checker. 
    // conditions: { "fields.amount": { "$gt": 10000 }, ... }
    // recordDoc: the FinanceRecord doc (with recordDoc.fields as a Map or object)
    // In production, consider a more robust solution or jsonlogic library.
  
    for (const [path, cond] of Object.entries(conditions)) {
      // Split path by '.' to navigate doc
      const parts = path.split('.');
      let val = recordDoc;
      for (const p of parts) {
        if (val === undefined || val === null) break;
        // If p is 'fields' and next is a fieldDefinition name, we need name-to-value mapping
        if (p === 'fields' && val.fields instanceof Map) {
          // This assumes you know how to resolve the field by name, 
          // but currently fields keys are fieldDefinitionId. 
          // For simplicity, assume condition uses fieldId directly as a key:
          // E.g., "fields.<fieldId>": { "$gt": 10000 }
          // If conditions refer to fieldDefinitionId keys directly, we can access directly:
          const fieldId = parts[parts.indexOf(p) + 1]; // next part
          val = val.fields.get(fieldId);
          break; // we have the value now, so stop
        } else {
          val = val[p];
        }
      }
  
      // Now val is the value at that path
      for (const [op, cmpVal] of Object.entries(cond)) {
        if (op === '$gt' && !(val > cmpVal)) return false;
        if (op === '$lt' && !(val < cmpVal)) return false;
        if (op === '$eq' && !(val === cmpVal)) return false;
        // Add more operators as needed
      }
    }
  
    return true;
  }
  
  exports.updateRecord = async (req, res) => {
    try {
      const { orgId, recordId } = req.params;
      const { type, categoryId, status, fields, recurrence } = req.body;
  
      const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(403).json({ message: 'Not a member of this organization.' });
      }
  
      const record = await FinanceRecord.findById(recordId);
      if (!record || record.orgId.toString() !== orgId) {
        return res.status(404).json({ message: 'Record not found.' });
      }
  
      // Update fields if provided
      if (type) {
        const allowedTypes = ['expense', 'revenue'];
        if (!allowedTypes.includes(type)) {
          return res.status(400).json({ message: 'Invalid record type.' });
        }
        record.type = type;
      }
  
      if (categoryId !== undefined) {
        record.categoryId = categoryId;
      }
  
      // If status is changing, handle approval logic
      let statusChangedToPendingApproval = false;
      if (status !== undefined && status !== record.status) {
        if (status === 'pending_approval') {
          statusChangedToPendingApproval = true;
        }
        record.status = status;
      }
  
      if (fields !== undefined) {
        record.fields = fields;
      }
  
      if (recurrence !== undefined) {
        record.recurrence = recurrence;
      }
  
      // Approval logic: if status changed to pending_approval, check rules
      if (statusChangedToPendingApproval) {
        if (record.status === 'pending_approval') {
          // Evaluate approval rules
          const rules = await FinanceApprovalRule.find({ orgId });
          
          // Convert record.fields from Map to object for easier condition checks
          const recordDoc = record.toObject();
          // recordDoc.fields is currently a Map in the schema, but toObject() might give an object or we must convert:
          if (recordDoc.fields instanceof Map) {
            // Convert Map to object
            const fieldsObj = {};
            for (const [k,v] of record.fields) {
              fieldsObj[k] = v;
            }
            recordDoc.fields = fieldsObj;
          }
  
          record.approvalsRequired = [];
          record.approvalsGiven = [];
  
          for (const rule of rules) {
            if (passesCondition(rule.conditions, recordDoc)) {
              for (const approverId of rule.requiredApprovers) {
                if (!record.approvalsRequired.some(r => r.toString() === approverId.toString())) {
                  record.approvalsRequired.push(approverId);
                }
              }
            }
          }
  
          // If no approvals required, automatically approve
          if (record.approvalsRequired.length === 0) {
            record.status = 'approved';
          }
        }
      }
  
      const updatedRecord = await record.save();
      res.json({ record: updatedRecord });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  // Delete a finance record
  exports.deleteRecord = async (req, res) => {
    try {
      const { orgId, recordId } = req.params;
  
      const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(403).json({ message: 'Not a member of this organization.' });
      }
  
      const record = await FinanceRecord.findById(recordId);
      if (!record || record.orgId.toString() !== orgId) {
        return res.status(404).json({ message: 'Record not found.' });
      }
  
      // Possibly add logic to disallow deletion if status is 'approved' or 'paid', depending on business rules.
      await record.remove();
      res.json({ message: 'Record deleted successfully.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };


  exports.approveRecord = async (req, res) => {
    try {
      const { orgId, recordId } = req.params;
      const userId = req.user._id;
  
      const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(403).json({ message: 'Not a member of this organization.' });
      }
  
      const record = await FinanceRecord.findById(recordId);
      if (!record || record.orgId.toString() !== orgId) {
        return res.status(404).json({ message: 'Record not found.' });
      }
  
      if (record.status !== 'pending_approval') {
        return res.status(400).json({ message: 'Record is not pending approval.' });
      }
  
      // Check if user is in approvalsRequired
      const requiredIndex = record.approvalsRequired.findIndex(id => id.toString() === userId.toString());
      if (requiredIndex === -1) {
        return res.status(403).json({ message: 'You are not required to approve this record.' });
      }
  
      // Add user to approvalsGiven if not already
      if (!record.approvalsGiven.map(id => id.toString()).includes(userId.toString())) {
        record.approvalsGiven.push(userId);
      }
  
      // If all required approvers have approved:
      const allApproved = record.approvalsRequired.every(r => record.approvalsGiven.map(a => a.toString()).includes(r.toString()));
      if (allApproved) {
        record.status = 'approved';
      }
  
      await record.save();
      res.json({ record });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  