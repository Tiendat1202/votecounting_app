import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadFile, getUploads, deleteUpload, deleteAllUploads } from '../controllers/uploadController';
import { authenticate } from '../middleware/auth';
import { config } from '../config';

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

router.post('/:sessionId', authenticate, upload.single('file'), uploadFile);
router.get('/:sessionId', authenticate, getUploads);
router.delete('/:sessionId/:filename', authenticate, deleteUpload);
router.delete('/:sessionId', authenticate, deleteAllUploads);

export default router;
