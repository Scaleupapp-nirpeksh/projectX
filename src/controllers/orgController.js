// src/controllers/orgController.js
const mongoose = require('mongoose');

const Organization = require('../models/Organization');
const AccessRequest = require('../models/AccessRequest');
const User = require('../models/User');
const Component = require('../models/Component');

// Reuse the isAdmin function from previous code
function isAdmin(user, orgId) {
  const membership = user.organizations.find(m => m.orgId.toString() === orgId);
  return membership && membership.role === 'admin';
}

// Helper function to validate ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.createOrganization = async (req, res) => {
  try {
    const { name, address, contactNumber,description, email, registrationId, industry, website } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Organization name is required' });
    }

    const org = new Organization({
      name,
      address,
      contactNumber,
      email,
      description,
      registrationId,
      industry,
      website,
      creatorUserId: req.user._id
    });
    const savedOrg = await org.save();

    // Add user as admin of the newly created organization
    req.user.organizations.push({ orgId: savedOrg._id, role: 'admin' });
    await req.user.save();

    res.status(201).json({ organization: savedOrg });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUserOrganizations = async (req, res) => {
  try {
    const userOrgIds = req.user.organizations.map(o => o.orgId);
    const orgs = await Organization.find({ _id: { $in: userOrgIds } });
    res.json({ organizations: orgs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Search organizations by name
exports.searchOrganizations = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ message: 'Query parameter "name" is required.' });
    }

    const orgs = await Organization.find({ 
      name: { $regex: name, $options: 'i' } // case-insensitive partial match
    });

    res.json({ organizations: orgs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// src/controllers/orgController.js
exports.requestAccess = async (req, res) => {
  try {
    const { orgId } = req.params;

    // Check if user is already a member of the org
    const membership = req.user.organizations.find((m) => m.orgId.toString() === orgId);
    if (membership) {
      return res.status(400).json({ message: 'You are already a member of this organization.' });
    }

    // Check if the user already requested access
    const existingRequest = await AccessRequest.findOne({ userId: req.user._id, orgId });
    if (existingRequest && existingRequest.status === 'pending') {
      return res.status(400).json({ message: 'Access request is already pending.' });
    }

    // Create a new access request
    const newRequest = new AccessRequest({
      userId: req.user._id,
      orgId,
      status: 'pending',
    });
    await newRequest.save();

    res.status(201).json({ message: 'Access request submitted successfully.', request: newRequest });
  } catch (error) {
    console.error('Error submitting access request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// List all pending access requests for an org (admin only)
exports.getAccessRequests = async (req, res) => {
  try {
    const { orgId } = req.params;

    const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
    

    // Check if current user is admin of the org
    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can view access requests.' });
    }

    const requests = await AccessRequest.find({ orgId, status: 'pending' }).populate('userId', 'email firstName lastName');
    res.json({ requests });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve an access request
exports.approveAccessRequest = async (req, res) => {
  try {
    const { orgId, requestId } = req.params;

    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can approve access requests.' });
    }

    const request = await AccessRequest.findOne({ _id: requestId, orgId });
    if (!request) {
      return res.status(404).json({ message: 'Access request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Cannot approve a ${request.status} request.` });
    }

    // Add the user as a member of the org
    const userToAdd = await User.findById(request.userId);
    userToAdd.organizations.push({ orgId: request.orgId, role: 'member' });
    await userToAdd.save();

    request.status = 'approved';
    await request.save();

    res.json({ message: 'Access request approved.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reject an access request
exports.rejectAccessRequest = async (req, res) => {
  try {
    const { orgId, requestId } = req.params;

    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can reject access requests.' });
    }

    const request = await AccessRequest.findOne({ _id: requestId, orgId });
    if (!request) {
      return res.status(404).json({ message: 'Access request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Cannot reject a ${request.status} request.` });
    }

    request.status = 'rejected';
    await request.save();

    res.json({ message: 'Access request rejected.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users in an organization (admin only)
exports.getOrgUsers = async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!isAdmin(req.user, orgId)) {
        return res.status(403).json({ message: 'Only admins can view organization users.' });
      }
  
      // Find the organization and populate it to get component data
      const org = await Organization.findById(orgId);
      if (!org) {
        return res.status(404).json({ message: 'Organization not found.' });
      }
  
      // Find all users that have membership in this org
      // We only need basic user info + organizations array
      const users = await User.find({ 'organizations.orgId': orgId }, 'email firstName lastName organizations');
  
      // Now enhance each user with role and component access info
      const enhancedUsers = users.map(user => {
        // Find this user's membership for the given org
        const membership = user.organizations.find(m => m.orgId.toString() === orgId);
        const role = membership ? membership.role : null;
  
        // For component access, loop through org.components
        // For each component, check if the user has a userAccess entry
        const componentAccess = org.components.map(comp => {
          const accessEntry = comp.userAccess.find(u => u.userId.toString() === user._id.toString());
          return {
            componentName: comp.componentName,
            hasAccess: accessEntry ? accessEntry.hasAccess : false
          };
        });
  
        return {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: role,
          componentAccess: componentAccess
        };
      });
  
      res.json({ users: enhancedUsers });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };

// Change a user’s role in the organization
exports.changeUserRole = async (req, res) => {
    try {
      const { orgId, userId } = req.params;
      const { role } = req.body;
  
      if (!isAdmin(req.user, orgId)) {
        return res.status(403).json({ message: 'Only admins can change user roles.' });
      }
  
      if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role.' });
      }
  
      const userToUpdate = await User.findById(userId);
      if (!userToUpdate) {
        return res.status(404).json({ message: 'User not found.' });
      }
  
      const membership = userToUpdate.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(400).json({ message: 'User is not a member of this organization.' });
      }
  
      membership.role = role;
      await userToUpdate.save();
  
      // If the user is now an admin, ensure they have access to all enabled components.
      if (role === 'admin') {
        const org = await Organization.findById(orgId);
        for (const component of org.components) {
          if (component.enabled) {
            const userAccessEntry = component.userAccess.find(u => u.userId.toString() === userId);
            if (userAccessEntry) {
              userAccessEntry.hasAccess = true;
            } else {
              component.userAccess.push({ userId: userId, hasAccess: true });
            }
          }
        }
        await org.save();
      }
  
      res.json({ message: 'User role updated.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };

// Remove a user from the organization
exports.removeUserFromOrg = async (req, res) => {
    try {
      const { orgId, userId } = req.params;
  
      if (!isAdmin(req.user, orgId)) {
        return res.status(403).json({ message: 'Only admins can remove users.' });
      }
  
      const userToRemove = await User.findById(userId);
      if (!userToRemove) {
        return res.status(404).json({ message: 'User not found.' });
      }
  
      const orgIndex = userToRemove.organizations.findIndex(m => m.orgId.toString() === orgId);
      if (orgIndex === -1) {
        return res.status(400).json({ message: 'User not part of this organization.' });
      }
  
      userToRemove.organizations.splice(orgIndex, 1);
      await userToRemove.save();
  
      // Optionally, remove their component access entries from the org
      const org = await Organization.findById(orgId);
      for (const component of org.components) {
        const idx = component.userAccess.findIndex(u => u.userId.toString() === userId);
        if (idx > -1) {
          component.userAccess.splice(idx, 1);
        }
      }
      await org.save();
  
      res.json({ message: 'User removed from organization.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };


exports.enableComponent = async (req, res) => {
    try {
      const { orgId, componentName } = req.params;
      if (!isAdmin(req.user, orgId)) {
        return res.status(403).json({ message: 'Only admins can enable components.' });
      }
  
      // Check if component exists
      const comp = await Component.findOne({ name: componentName });
      if (!comp) {
        return res.status(404).json({ message: 'Component not found.' });
      }
  
      const org = await Organization.findById(orgId);
      let orgComponent = org.components.find(c => c.componentName === componentName);
      if (orgComponent) {
        orgComponent.enabled = true;
      } else {
        org.components.push({ componentName: componentName, enabled: true, userAccess: [] });
        orgComponent = org.components.find(c => c.componentName === componentName);
      }
  
      // Give all admins in this org access to the newly enabled component
      const orgUsers = await User.find({ 'organizations.orgId': orgId });
      const adminIds = orgUsers.filter(u => u.organizations.some(m => m.orgId.toString() === orgId && m.role === 'admin'))
                               .map(u => u._id.toString());
  
      for (const adminId of adminIds) {
        const userAccessEntry = orgComponent.userAccess.find(u => u.userId.toString() === adminId);
        if (userAccessEntry) {
          userAccessEntry.hasAccess = true;
        } else {
          orgComponent.userAccess.push({ userId: adminId, hasAccess: true });
        }
      }
  
      await org.save();
      res.json({ message: 'Component enabled for the organization and admin(s) granted access.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  exports.disableComponent = async (req, res) => {
    try {
      const { orgId, componentName } = req.params;
      if (!isAdmin(req.user, orgId)) {
        return res.status(403).json({ message: 'Only admins can disable components.' });
      }
  
      const org = await Organization.findById(orgId);
      const orgComponent = org.components.find(c => c.componentName === componentName);
      if (!orgComponent || !orgComponent.enabled) {
        return res.status(400).json({ message: 'Component is not enabled.' });
      }
      orgComponent.enabled = false;
      await org.save();
      res.json({ message: 'Component disabled for the organization.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  exports.assignUserToComponent = async (req, res) => {
    try {
      const { orgId, componentName, userId } = req.params;
      const { hasAccess } = req.body;
  
      if (!isAdmin(req.user, orgId)) {
        return res.status(403).json({ message: 'Only admins can manage component access.' });
      }
  
      const org = await Organization.findById(orgId);
      const orgComponent = org.components.find(c => c.componentName === componentName && c.enabled);
      if (!orgComponent) {
        return res.status(400).json({ message: 'Component is not enabled or not found.' });
      }
  
      const userToAssign = await User.findById(userId);
      if (!userToAssign) {
        return res.status(404).json({ message: 'User not found.' });
      }
  
      // Check if user is part of the org
      const membership = userToAssign.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(400).json({ message: 'User is not a member of this organization.' });
      }
  
      // Update or add user access entry
      const userAccessEntry = orgComponent.userAccess.find(u => u.userId.toString() === userId);
      if (userAccessEntry) {
        userAccessEntry.hasAccess = hasAccess;
      } else {
        orgComponent.userAccess.push({ userId: userId, hasAccess: hasAccess });
      }
  
      await org.save();
      res.json({ message: `User access ${hasAccess ? 'granted' : 'revoked'} for component.` });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  exports.getOrgComponents = async (req, res) => {
    try {
      const { orgId } = req.params;
      // User must be at least a member of the org
      const membership = req.user.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(403).json({ message: 'Not a member of this organization.' });
      }
  
      const org = await Organization.findById(orgId).populate('components.userAccess.userId', 'email firstName lastName');
      res.json({ components: org.components });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };


 // Get all access requests made by the authenticated user
exports.getUserAccessRequests = async (req, res) => {
  try {
    const requests = await AccessRequest.find({ userId: req.user._id })
      .populate('orgId', 'name _id') // Populate orgId with name and _id
      .sort({ createdAt: -1 }); // Optional: sort by latest

    res.json({ requests });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
  
// Get Organization Details
exports.getOrganizationDetails = async (req, res) => {
  try {
    const { orgId } = req.params;

    // Validate orgId
    if (!isValidObjectId(orgId)) {
      return res.status(400).json({ message: 'Invalid organization ID.' });
    }

    // Find the organization by ID and populate creatorUserId and userAccess.userId
    const organization = await Organization.findById(orgId)
      .populate("creatorUserId", "email firstName lastName")
      .populate("components.userAccess.userId", "email firstName lastName");

    if (!organization) {
      return res.status(404).json({ message: "Organization not found." });
    }

    // Check if the user is a member of the organization
    const isMember = req.user.organizations.some(
      (org) => org.orgId.toString() === orgId
    );

    if (!isMember) {
      return res.status(403).json({ message: "Access denied. You are not a member of this organization." });
    }

    // Include user's role in the organization
    const membership = req.user.organizations.find(
      (org) => org.orgId.toString() === orgId
    );
    const role = membership ? membership.role : null;

    res.json({
      organization,
      role,
    });
  } catch (error) {
    console.error("Error fetching organization details:", error);
    res.status(500).json({ message: "Server error." });
  }
};


exports.updateOrganizationDetails = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, address, contactNumber, description, email, industry, website } = req.body;

    if (!isAdmin(req.user, orgId)) {
      return res.status(403).json({ message: 'Only admins can update organization details.' });
    }

    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ message: 'Organization not found.' });

    if (name !== undefined) org.name = name;
    if (address !== undefined) org.address = address;
    if (contactNumber !== undefined) org.contactNumber = contactNumber;
    if (description !== undefined) org.description = description;
    if (email !== undefined) org.email = email;
    if (industry !== undefined) org.industry = industry;
    if (website !== undefined) org.website = website;

    await org.save();
    res.json({ message: 'Organization details updated.', organization: org });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Fetch user-specific details, roles, and enabled components
exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.user._id; // Extract user ID from the authenticated request

    // Find the user's organizations with populated organization and component details
    const user = await User.findById(userId)
      .populate({
        path: "organizations.orgId",
        populate: {
          path: "components.userAccess.userId",
          select: "email firstName lastName",
        },
      })
      .select("organizations");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const userDetails = user.organizations.map((org) => {
      const orgData = org.orgId;
      if (!orgData) return null;

      const components = orgData.components.map((component) => {
        const hasAccess = component.userAccess.some(
          (access) => access.userId.toString() === userId.toString() && access.hasAccess
        );
        return {
          componentName: component.componentName,
          enabled: component.enabled,
          hasAccess,
        };
      });

      return {
        organizationId: orgData._id,
        organizationName: orgData.name,
        role: org.role,
        components,
      };
    });

    res.json({ userDetails });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Server error." });
  }
};
