import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { convertMarkdownToHTML } from './converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Upload directory (in-memory / disk tmp)
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'uploads'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (/\.md|markdown$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only Markdown files are accepted'));
    }
  },
});

// Ensure uploads dir exists
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

// Static: serve the built frontend or dev public
const publicDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');

// Serve built assets if dist exists, else fall back to public
const serveDir = fs.existsSync(distDir) ? distDir : publicDir;
app.use(express.static(serveDir));

// Upload a single .md file
app.post('/convert', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const uploadedPath = req.file.path;
  const originalName = req.file.originalname;
  let markdown;

  try {
    markdown = fs.readFileSync(uploadedPath, 'utf-8');
    const html = convertMarkdownToHTML(markdown, originalName);

    // Clean up the uploaded file
    fs.unlinkSync(uploadedPath);

    res.json({
      success: true,
      filename: originalName,
      htmlFilename: originalName.replace(/\.md$/i, '') + '.html',
      html,
      size: Buffer.byteLength(html, 'utf-8'),
    });
  } catch (err) {
    fs.unlinkSync(uploadedPath, () => {});
    console.error('Conversion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`MakerDownToHTML running at http://localhost:${PORT}`);
});
