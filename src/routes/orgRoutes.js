// src/routes/orgRoutes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { 
  createOrganization, 
  getUserOrganizations,
  searchOrganizations,
  requestAccess,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  getOrgUsers,
  changeUserRole,
  removeUserFromOrg,
  enableComponent,
  disableComponent,
  assignUserToComponent,
  getOrgComponents,
  getUserAccessRequests,
  getOrganizationDetails,
  updateOrganizationDetails,
  getUserDetails
} = require('../controllers/orgController');

// All org routes require authentication
router.use(authMiddleware);

// 1. Define static routes first
router.get('/search', searchOrganizations);
router.get('/access-requests', getUserAccessRequests);

// 2. Define dynamic routes after static routes
router.post('/', createOrganization);
router.get('/', getUserOrganizations);

router.get("/user-details", authMiddleware, getUserDetails);

// Admin functionalities
router.get('/:orgId/access-requests', getAccessRequests);
router.post('/:orgId/access-requests/:requestId/approve', approveAccessRequest);
router.post('/:orgId/access-requests/:requestId/reject', rejectAccessRequest);

// Requesting access to an org
router.post('/:orgId/request-access', requestAccess);

// Fetch organization details
router.get('/:orgId', getOrganizationDetails);
router.put('/:orgId', updateOrganizationDetails);

// Users Routes
router.get('/:orgId/users', getOrgUsers);
router.put('/:orgId/users/:userId/role', changeUserRole);
router.delete('/:orgId/users/:userId', removeUserFromOrg);

// Component Management
router.get('/:orgId/components', getOrgComponents);
router.post('/:orgId/components/:componentName/enable', enableComponent);
router.post('/:orgId/components/:componentName/disable', disableComponent);
router.post('/:orgId/components/:componentName/users/:userId', assignUserToComponent);

module.exports = router;
