require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('OpenAI API key is missing in the environment variables.');
  process.exit(1);
}

// Configure CORS
const corsOptions = {
  origin: '*',
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// File filter for audio types
const audioFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'audio/wav', 
    'audio/mp3', 
    'audio/mpeg', 
    'audio/webm', 
    'audio/ogg', 
    'audio/x-m4a'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Please upload an audio file.'), false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: audioFileFilter,
  limits: { 
    fileSize: 25 * 1024 * 1024 // 25MB max file size
  }
});

// Transcription route
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No audio file uploaded',
        details: 'Please upload a valid audio file'
      });
    }

    // Create FormData to send to OpenAI
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path));
    formData.append('model', 'whisper-1');

    // Send transcription request
    const transcriptionResponse = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions', 
      formData, 
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    // Delete the uploaded file after transcription
    fs.unlinkSync(req.file.path);

    // Send transcription result
    res.json({ 
      text: transcriptionResponse.data.text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (deleteError) {
        console.error('Error deleting file:', deleteError);
      }
    }

    // Send detailed error response
    console.error('Transcription Error:', error.response ? error.response.data : error.message);
    res.status(500).json({
      error: 'Transcription failed',
      details: error.response ? JSON.stringify(error.response.data) : error.message
    });
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong',
    details: err.message
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;