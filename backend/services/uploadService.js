/**
 * Cloudinary Upload Service
 */
'use strict';

const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');

/**
 * Upload a file buffer or base64 to Cloudinary
 * @param {Buffer|string} file - Buffer (from multer) or base64 data URI
 * @param {object} options
 */
const uploadFile = async (file, options = {}) => {
    const {
        folder = 'embassy_ai',
        resourceType = 'auto',
        publicId = null,
        transformation = [],
    } = options;

    const uploadOptions = {
        folder,
        resource_type: resourceType,
        ...(transformation.length > 0 && { transformation }),
        ...(publicId && { public_id: publicId }),
        // Adding access_mode for general visibility
        access_mode: 'public',
    };

    // Handle buffer upload
    const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error) {
                logger.error(`Cloudinary upload_stream error: ${error.message}`);
                return reject(error);
            }
            resolve(result);
        });

        if (Buffer.isBuffer(file)) {
            stream.end(file);
        } else if (typeof file === 'string') {
            cloudinary.uploader.upload(file, uploadOptions)
                .then(resolve)
                .catch(reject);
        }
    });

    return await uploadPromise;
};

/**
 * Upload resume PDF
 */
const uploadResume = async (fileBuffer, userId) => {
    // We use 'image' for PDFs because Cloudinary treats PDFs as images 
    // to allow them to be viewable in the browser instead of forced download.
    const result = await uploadFile(fileBuffer, {
        folder: `embassy_ai/resumes/${userId}`,
        resourceType: 'image',
        publicId: `resume_${Date.now()}`, // Remove manual .pdf, Cloudinary handles it
    });
    
    // Ensure the URL ends in .pdf so browser knows what it is
    let finalUrl = result.secure_url;
    if (!finalUrl.toLowerCase().endsWith('.pdf')) {
        finalUrl += '.pdf';
    }

    return { url: finalUrl, publicId: result.public_id, fileSize: result.bytes };
};

/**
 * Upload profile photo
 */
const uploadProfilePhoto = async (fileBuffer, userId) => {
    const result = await uploadFile(fileBuffer, {
        folder: `embassy_ai/profiles/${userId}`,
        resourceType: 'image',
        publicId: `photo_${Date.now()}`,
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    });
    return { url: result.secure_url, publicId: result.public_id };
};

/**
 * Upload interview recording
 */
const uploadInterviewVideo = async (fileBuffer, userId, sessionId) => {
    const result = await uploadFile(fileBuffer, {
        folder: `embassy_ai/recordings/${userId}`,
        resourceType: 'video',
        publicId: `interview_${sessionId}`,
    });
    return { url: result.secure_url, publicId: result.public_id, duration: result.duration };
};

/**
 * Upload screenshot
 */
const uploadScreenshot = async (base64String, userId) => {
    const result = await cloudinary.uploader.upload(base64String, {
        folder: `embassy_ai/screenshots/${userId}`,
        resource_type: 'image',
    });
    return { url: result.secure_url, publicId: result.public_id };
};

/**
 * Delete file from Cloudinary
 */
const deleteFile = async (publicId, resourceType = 'image') => {
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        logger.info(`Deleted Cloudinary file: ${publicId}`);
    } catch (err) {
        logger.error(`Cloudinary delete error: ${err.message}`);
    }
};

module.exports = { uploadFile, uploadResume, uploadProfilePhoto, uploadInterviewVideo, uploadScreenshot, deleteFile };
