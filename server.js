import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Path to db.json
const dbPath = path.join(__dirname, 'db.json');

// Ensure assets/uploads directory exists
const uploadDir = path.join(__dirname, 'public', 'assets', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// API Endpoints
app.get('/api/scenes', (req, res) => {
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  res.json(data.scenes);
});

app.post('/api/scenes', (req, res) => {
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  data.scenes = req.body;
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  // Return the path relative to 'public' so Vite can serve it
  const filePath = `assets/uploads/${req.file.filename}`;
  res.json({ filePath: filePath });
});

app.listen(port, () => {
  console.log(`Admin API server running at http://localhost:${port}`);
});
