// src/routes/financeRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const componentAccessMiddleware = require('../middlewares/componentAccessMiddleware');
const financeController = require('../controllers/financeController');

router.use(authMiddleware);
router.use('/:orgId/components/finance', componentAccessMiddleware('finance'));


// Category Routes
router.post('/:orgId/components/finance/categories', financeController.createCategory);
router.get('/:orgId/components/finance/categories', financeController.listCategories);
router.put('/:orgId/components/finance/categories/:categoryId', financeController.updateCategory);
router.delete('/:orgId/components/finance/categories/:categoryId', financeController.deleteCategory);

// Field Definition Routes
router.post('/:orgId/components/finance/fields', financeController.createFieldDefinition);
router.get('/:orgId/components/finance/fields', financeController.listFieldDefinitions);
router.put('/:orgId/components/finance/fields/:fieldId', financeController.updateFieldDefinition);
router.delete('/:orgId/components/finance/fields/:fieldId', financeController.deleteFieldDefinition);

// Record Routes
router.post('/:orgId/components/finance/records', financeController.createRecord);
router.get('/:orgId/components/finance/records', financeController.listRecords);
router.get('/:orgId/components/finance/records/:recordId', financeController.getRecord);
router.put('/:orgId/components/finance/records/:recordId', financeController.updateRecord);
router.delete('/:orgId/components/finance/records/:recordId', financeController.deleteRecord);
router.post('/:orgId/components/finance/records/:recordId/approve', financeController.approveRecord);

// **Partner Routes**
router.post('/:orgId/components/finance/partners', financeController.createPartner);
router.get('/:orgId/components/finance/partners', financeController.listPartners);
router.put('/:orgId/components/finance/partners/:partnerId', financeController.updatePartner);
router.delete('/:orgId/components/finance/partners/:partnerId', financeController.deletePartner);



module.exports = router;
