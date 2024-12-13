// src/controllers/financeController.js
const FinanceCategory = require('../models/FinanceCategory');
const Organization = require('../models/Organization');
const User = require('../models/User'); // if needed
const FinanceFieldDefinition = require('../models/FinanceFieldDefinition');
const FinanceRecord = require('../models/FinanceRecord');
const FinanceApprovalRule = require('../models/FinanceApprovalRule');
const Partner = require('../models/Partner'); 

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

  

/**
 * Create a finance record
 * POST /api/organizations/:orgId/components/finance/records
 */
exports.createRecord = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { type, categoryId, status, fields, recurrence, partnerId } = req.body;

    const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this organization.' });
    }

    // Validate type
    const allowedTypes = ['expense', 'revenue'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid record type.' });
    }

    // Validate categoryId if provided
    if (categoryId) {
      const category = await FinanceCategory.findById(categoryId);
      if (!category || category.orgId.toString() !== orgId) {
        return res.status(400).json({ message: 'Invalid categoryId.' });
      }
    }

    // Validate partnerId if provided
    if (partnerId) {
      const partner = await Partner.findById(partnerId);
      if (!partner || partner.orgId.toString() !== orgId) {
        return res.status(400).json({ message: 'Invalid partnerId.' });
      }

      // **Updated Validation: Map record type to expected partner type**
      const expectedPartnerType = type === 'expense' ? 'vendor' : 'client';
      if (partner.type !== expectedPartnerType) {
        return res.status(400).json({ message: `Partner type (${partner.type}) does not match record type (${type}).` });
      }
    }

    const record = new FinanceRecord({
      orgId,
      type,
      categoryId,
      partnerId: partnerId || null, // Associate Partner if provided
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

  

/**
 * List finance records with filters and partner details
 * GET /api/organizations/:orgId/components/finance/records
 */
exports.listRecords = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { type, categoryId, status, startDate, endDate, partnerId, page = 1, limit = 20 } = req.query;

    const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this organization.' });
    }

    const query = { orgId };
    if (type) query.type = type;
    if (categoryId) query.categoryId = categoryId;
    if (status) query.status = status;
    if (partnerId) query.partnerId = partnerId; // Optional: Filter by Partner

    // Date filtering on 'createdAt' field
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Pagination
    const records = await FinanceRecord.find(query)
      .populate('categoryId', 'name description') // Populate Category with selected fields
      .populate('partnerId', 'name type contactInfo') // Populate Partner with selected fields
      .populate('createdBy', 'name email') // Optional: Populate creator's details
      .populate('approvedBy', 'name email') // Optional: Populate approvers' details
      .sort({ createdAt: -1 }) // Sort by latest
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalRecords = await FinanceRecord.countDocuments(query);

    res.json({ 
      records, 
      totalPages: Math.ceil(totalRecords / limit), 
      currentPage: parseInt(page) 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


/**
 * Get a single finance record with partner details
 * GET /api/organizations/:orgId/components/finance/records/:recordId
 */
exports.getRecord = async (req, res) => {
  try {
    const { orgId, recordId } = req.params;

    const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this organization.' });
    }

    const record = await FinanceRecord.findById(recordId)
      .populate('categoryId', 'name description') // Populate Category with selected fields
      .populate('partnerId', 'name type contactInfo') // Populate Partner with selected fields
      .populate('createdBy', 'name email') // Optional: Populate creator's details
      .populate('approvedBy', 'name email') // Optional: Populate approvers' details
      .lean();

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
  
/**
 * Update a finance record
 * PUT /api/organizations/:orgId/components/finance/records/:recordId
 */
exports.updateRecord = async (req, res) => {
  try {
    const { orgId, recordId } = req.params;
    const { type, categoryId, status, fields, recurrence, partnerId } = req.body;

    const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this organization.' });
    }

    const record = await FinanceRecord.findById(recordId);
    if (!record || record.orgId.toString() !== orgId) {
      return res.status(404).json({ message: 'Record not found.' });
    }

    // Update type if provided
    if (type) {
      const allowedTypes = ['expense', 'revenue'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid record type.' });
      }
      record.type = type;
    }

    // Update categoryId if provided
    if (categoryId !== undefined) {
      if (categoryId) {
        const category = await FinanceCategory.findById(categoryId);
        if (!category || category.orgId.toString() !== orgId) {
          return res.status(400).json({ message: 'Invalid categoryId.' });
        }
        record.categoryId = categoryId;
      } else {
        record.categoryId = null; // Remove category association
      }
    }

    // Update partnerId if provided
    if (partnerId !== undefined) {
      if (partnerId) {
        const partner = await Partner.findById(partnerId);
        if (!partner || partner.orgId.toString() !== orgId) {
          return res.status(400).json({ message: 'Invalid partnerId.' });
        }
        // Ensure the partner type matches the record type
        if (partner.type !== record.type && partner.type !== 'both') { // Adjust if 'both' is applicable
          return res.status(400).json({ message: `Partner type (${partner.type}) does not match record type (${record.type}).` });
        }
        record.partnerId = partnerId;
      } else {
        record.partnerId = null; // Remove partner association
      }
    }

    // Update status if provided
    let statusChangedToPendingApproval = false;
    if (status !== undefined && status !== record.status) {
      if (status === 'pending_approval') {
        statusChangedToPendingApproval = true;
      }
      record.status = status;
    }

    // Update fields if provided
    if (fields !== undefined) {
      record.fields = fields;
    }

    // Update recurrence if provided
    if (recurrence !== undefined) {
      record.recurrence = recurrence;
    }

    // Approval logic: if status changed to pending_approval, check rules
    if (statusChangedToPendingApproval) {
      if (record.status === 'pending_approval') {
        // Evaluate approval rules
        const rules = await FinanceApprovalRule.find({ orgId });

        // Convert record.fields from object to access easily
        const recordDoc = record.toObject();

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

    // **Use findByIdAndDelete() to find and delete in one step**
    const record = await FinanceRecord.findByIdAndDelete(recordId);

    if (!record || record.orgId.toString() !== orgId) {
      return res.status(404).json({ message: 'Record not found or already deleted.' });
    }

    // **Business Logic: Prevent deletion if necessary**
    // Note: Since we've already deleted the record, this logic should be placed before deletion
    // So it's better to check status before deletion as in Option A

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
  


  /**
 * Create a new Partner (Vendor/Client)
 * POST /api/organizations/:orgId/components/finance/partners
 */
exports.createPartner = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, type, contactInfo, categoryId } = req.body;

    // Check admin privileges
    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can create partners.' });
    }

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({ message: 'Partner name and type are required.' });
    }

    // Validate type
    const allowedTypes = ['vendor', 'client'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid partner type.' });
    }

    // If categoryId is provided, validate it
    let category = null;
    if (categoryId) {
      category = await FinanceCategory.findById(categoryId);
      if (!category || category.orgId.toString() !== orgId) {
        return res.status(400).json({ message: 'Invalid categoryId.' });
      }
    }

    const partner = new Partner({
      orgId,
      name,
      type,
      contactInfo: contactInfo || {},
      categoryId: categoryId || null,
    });

    const savedPartner = await partner.save();
    res.status(201).json({ partner: savedPartner });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * List all Partners (Vendors/Clients)
 * GET /api/organizations/:orgId/components/finance/partners
 */
exports.listPartners = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { type, categoryId } = req.query; // Optional filters

    // Check membership
    const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this organization.' });
    }

    // Build query
    const query = { orgId };
    if (type) {
      const allowedTypes = ['vendor', 'client'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid partner type filter.' });
      }
      query.type = type;
    }
    if (categoryId) {
      query.categoryId = categoryId;
    }

    const partners = await Partner.find(query).populate('categoryId').lean();
    res.json({ partners });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a Partner (Vendor/Client)
 * PUT /api/organizations/:orgId/components/finance/partners/:partnerId
 */
exports.updatePartner = async (req, res) => {
  try {
    const { orgId, partnerId } = req.params;
    const { name, type, contactInfo, categoryId } = req.body;

    // Check admin privileges
    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can update partners.' });
    }

    // Find the Partner
    const partner = await Partner.findById(partnerId);
    if (!partner || partner.orgId.toString() !== orgId) {
      return res.status(404).json({ message: 'Partner not found in this organization.' });
    }

    // Update fields if provided
    if (name !== undefined) partner.name = name;
    if (type !== undefined) {
      const allowedTypes = ['vendor', 'client'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid partner type.' });
      }
      partner.type = type;
    }
    if (contactInfo !== undefined) partner.contactInfo = contactInfo;
    if (categoryId !== undefined) {
      if (categoryId) {
        const category = await FinanceCategory.findById(categoryId);
        if (!category || category.orgId.toString() !== orgId) {
          return res.status(400).json({ message: 'Invalid categoryId.' });
        }
        partner.categoryId = categoryId;
      } else {
        partner.categoryId = null; // Remove category association
      }
    }

    const updatedPartner = await partner.save();
    res.json({ partner: updatedPartner });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a Partner (Vendor/Client)
 * DELETE /api/organizations/:orgId/components/finance/partners/:partnerId
 */
exports.deletePartner = async (req, res) => {
  try {
    const { orgId, partnerId } = req.params;

    // Check admin privileges
    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can delete partners.' });
    }

    // Find the Partner
    const partner = await Partner.findById(partnerId);
    if (!partner || partner.orgId.toString() !== orgId) {
      return res.status(404).json({ message: 'Partner not found in this organization.' });
    }

    // Check if the Partner is associated with any records
    const associatedRecordsCount = await FinanceRecord.countDocuments({ orgId, partnerId });
    if (associatedRecordsCount > 0) {
      return res.status(400).json({ message: 'Cannot delete a partner associated with records.' });
    }

    // Delete the Partner
    await Partner.deleteOne({ _id: partnerId });

    res.json({ message: 'Partner deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};