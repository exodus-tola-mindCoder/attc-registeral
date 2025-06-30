const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated (verifyToken should run before this)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Authentication required.'
        });
      }

      // Check if user role is in allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`
        });
      }

      next();

    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization check failed.',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  };
};

export default checkRole;