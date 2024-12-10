const Organization = require('../models/Organization');

const componentAccessMiddleware = (componentName) => {
  return async (req, res, next) => {
    try {
      const { orgId } = req.params;
      const user = req.user;

      const membership = user.organizations.find(m => m.orgId.toString() === orgId);
      if (!membership) {
        return res.status(403).json({ message: "Not a member of this organization." });
      }

      const org = await Organization.findById(orgId);
      const component = org.components.find(c => c.componentName === componentName && c.enabled);
      if (!component) {
        return res.status(403).json({ message: "Component not enabled for this organization." });
      }

      const userAccess = component.userAccess.find(u => u.userId.toString() === user._id.toString());
      if (!userAccess || !userAccess.hasAccess) {
        // If user is admin and component is enabled, allow by default:
        if (membership.role === 'admin') {
          return next();
        }
        return res.status(403).json({ message: "You do not have access to this component." });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = componentAccessMiddleware;
