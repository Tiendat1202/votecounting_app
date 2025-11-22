import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import FileType from 'file-type';
import { uploadFile, getUploads, deleteUpload, deleteAllUploads } from '../controllers/uploadController';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import { uploadLimiter, apiLimiter } from '../middleware/rateLimiter';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../', config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Basic MIME type check (first layer of validation)
  if (config.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter,
});

// Additional file validation middleware using file-type library
const validateFileType = async (req: any, res: any, next: any) => {
  if (req.file) {
    try {
      // Verify file content using magic bytes
      const fileType = await FileType.fromFile(req.file.path);
      
      if (!fileType || !['image/jpeg', 'image/png', 'image/gif'].includes(fileType.mime)) {
        // Delete the uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Invalid file type. File content does not match image format.' });
      }
    } catch (error) {
      console.error('File validation error:', error);
      // Delete the uploaded file if it exists
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'File validation failed.' });
    }
  }
  next();
};

router.post('/:sessionId', uploadLimiter, authenticate, upload.single('file'), validateFileType, uploadFile);
router.get('/:sessionId', apiLimiter, authenticate, getUploads);
router.delete('/:sessionId/:filename', apiLimiter, authenticate, deleteUpload);
router.delete('/:sessionId', apiLimiter, authenticate, deleteAllUploads);

export default router;
