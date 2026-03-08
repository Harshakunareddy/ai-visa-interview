/**
 * 404 Not Found Middleware
 */
'use strict';

const notFound = (req, res, next) => {
    const isApiRoute = req.path.startsWith('/api') || req.xhr;
    if (isApiRoute) {
        return res.status(404).json({
            success: false,
            message: `Route ${req.originalUrl} not found`,
            errorCode: 'NOT_FOUND',
            data: null,
        });
    }
    res.status(404).render('pages/error', {
        title: '404 — Page Not Found',
        statusCode: 404,
        message: 'The page you are looking for does not exist.',
        layout: false,
    });
};

module.exports = { notFound };
