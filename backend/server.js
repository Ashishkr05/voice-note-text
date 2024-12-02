require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const busboy = require('busboy');
const FormData = require('form-data');

const app = express();

if (!process.env.OPENAI_API_KEY) {
  console.error('OpenAI API key is missing in the environment variables.');
  process.exit(1);
}

const corsOptions = {
  origin: [
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

app.post('/transcribe', (req, res) => {
  const bb = busboy({ 
    headers: req.headers,
    limits: {
      fileSize: 25 * 1024 * 1024
    }
  });

  bb.on('file', async (name, file, info) => {
    // Allow both MP3 and WebM formats
    const allowedMimeTypes = [
      'audio/webm',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/ogg'
    ];

    if (!allowedMimeTypes.includes(info.mimeType)) {
      return res.status(400).json({
        error: 'Invalid file type',
        details: 'Please upload a valid audio file (MP3, WebM, WAV, OGG)',
        success: false
      });
    }

    try {
      // Create FormData for OpenAI API
      const formData = new FormData();
      formData.append('file', file, {
        filename: info.filename || 'audio.mp3',
        contentType: info.mimeType
      });
      formData.append('model', 'whisper-1');

      // Send streaming request to OpenAI
      const transcriptionResponse = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      // Return response matching frontend expectations
      res.json({
        text: transcriptionResponse.data.text,
        success: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Transcription Error:', error.response?.data || error.message);
      
      res.status(error.response?.status || 500).json({
        error: 'Transcription failed',
        details: error.response?.data?.error?.message || error.message,
        success: false
      });
    }
  });

  bb.on('error', (error) => {
    console.error('File upload error:', error);
    res.status(500).json({
      error: 'File upload failed',
      details: error.message,
      success: false
    });
  });

  // Handle file size limit exceeded
  bb.on('limit', () => {
    res.status(413).json({
      error: 'File too large',
      details: 'Maximum file size is 25MB',
      success: false
    });
  });

  req.pipe(bb);
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    success: true
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong',
    details: err.message,
    success: false
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;