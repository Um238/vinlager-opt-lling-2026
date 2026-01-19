const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/images');

// Opret upload mappe hvis den ikke findes
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `wine-${uniqueSuffix}${ext}`);
  }
});

// Separeret upload for billeder
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Kun billedfiler er tilladt'), false);
  }
};

// Upload for billeder
const imageUpload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: imageFileFilter
});

// Upload for import filer (CSV/Excel)
const importFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream' // Nogle Excel filer sendes som dette
  ];
  
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  const ext = require('path').extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Kun CSV eller Excel filer er tilladt'), false);
  }
};

// Storage for import filer (temp)
const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = require('path').join(__dirname, '../../uploads/temp');
    const fs = require('fs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = require('path').extname(file.originalname);
    cb(null, `import-${uniqueSuffix}${ext}`);
  }
});

const importUpload = multer({
  storage: importStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max for import filer
  fileFilter: importFileFilter
});

// Standard upload (for billeder)
const upload = imageUpload;

module.exports = upload;
module.exports.importUpload = importUpload;
