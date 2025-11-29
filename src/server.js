import express from 'express';
import cors from 'cors';
import { createNewsTemplate, createNewsTemplateFromUrl } from './image-template.js';
import { readFileSync } from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(cors());

// Load template image once on startup
let templateBuffer;
try {
  templateBuffer = readFileSync('./template.png');
} catch (e) {
  console.warn('[Server] Template image not found, will use URL-based templates only');
}

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LK NEWS Image Template Generator',
    uptime: process.uptime(),
    endpoints: ['/api/template', '/api/template-from-url']
  });
});

// Create template from base64 images
app.post('/api/template', async (req, res) => {
  try {
    const { imageBase64, headline, date, templateBase64 } = req.body;

    if (!imageBase64 || !headline) {
      return res.status(400).json({
        error: 'Missing required fields: imageBase64, headline'
      });
    }

    const dateStr = date || new Date().toLocaleDateString();
    const template = templateBase64
      ? Buffer.from(templateBase64, 'base64')
      : templateBuffer;

    if (!template) {
      return res.status(400).json({
        error: 'Template not available. Provide templateBase64 or ensure template.png exists.'
      });
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const result = await createNewsTemplate(imageBuffer, headline, dateStr, template);

    res.json({
      success: true,
      template: result.toString('base64'),
      contentType: 'image/png',
      message: 'Template created successfully'
    });
  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

// Create template from URLs
app.post('/api/template-from-url', async (req, res) => {
  try {
    const { imageUrl, headline, date, templateUrl } = req.body;

    if (!imageUrl || !headline || !templateUrl) {
      return res.status(400).json({
        error: 'Missing required fields: imageUrl, headline, templateUrl'
      });
    }

    const dateStr = date || new Date().toLocaleDateString();
    const result = await createNewsTemplateFromUrl(imageUrl, headline, dateStr, templateUrl);

    res.json({
      success: true,
      template: result.toString('base64'),
      contentType: 'image/png',
      message: 'Template created successfully'
    });
  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

// Download template as PNG file
app.post('/api/template/download', async (req, res) => {
  try {
    const { imageBase64, headline, date, templateBase64 } = req.body;

    if (!imageBase64 || !headline) {
      return res.status(400).json({ error: 'Missing imageBase64 or headline' });
    }

    const dateStr = date || new Date().toLocaleDateString();
    const template = templateBase64
      ? Buffer.from(templateBase64, 'base64')
      : templateBuffer;

    if (!template) {
      return res.status(400).json({ error: 'Template not available' });
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const result = await createNewsTemplate(imageBuffer, headline, dateStr, template);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="news-template-${Date.now()}.png"`);
    res.send(result);
  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Image Template Server running on http://0.0.0.0:${PORT}`);
  console.log(`📝 Template Image: ${templateBuffer ? 'Loaded from ./template.png' : 'Not found (use URL-based templates)'}`);
  console.log(`📍 API Endpoints:`);
  console.log(`   POST /api/template - Create from base64`);
  console.log(`   POST /api/template-from-url - Create from URLs`);
  console.log(`   POST /api/template/download - Download as file`);
});
