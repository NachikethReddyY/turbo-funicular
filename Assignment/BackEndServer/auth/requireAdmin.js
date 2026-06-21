function requireAdmin(req, res, next) {
    if (String(req.type || '').toLowerCase() !== 'admin') {
        res.status(403);
        return res.json({ auth: false, message: 'Admin access required!' });
    }
    next();
}

module.exports = requireAdmin;
