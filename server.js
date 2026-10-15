import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Parse json and urlencoded with generous body limits for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enable CORS and security-friendly headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
let ai = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.warn('[Himalayan Realms] GEMINI_API_KEY not found in environment. Veo video generation will require key.');
}

// Veo Video Generation API
// 1. Start generation
app.post('/api/generate-video', async (req, res) => {
  try {
    if (!ai) {
      if (process.env.GEMINI_API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      } else {
        return res.status(400).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }
    }

    const { imageBase64, mimeType = 'image/jpeg', prompt = '', aspectRatio = '16:9' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required.' });
    }

    const validAspectRatio = (aspectRatio === '9:16') ? '9:16' : '16:9';
    // Clean base64 string if it contains data URI prefix
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || 'Cinematic fantasy realm sequence with subtle environmental motion and natural lighting',
      image: {
        imageBytes: cleanBase64,
        mimeType: mimeType || 'image/jpeg'
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: validAspectRatio
      }
    });

    console.log('[Veo] Video generation started:', operation.name);
    return res.json({ operationName: operation.name });
  } catch (error) {
    console.error('[Veo] Error starting video generation:', error);
    return res.status(500).json({ error: error.message || 'Failed to start video generation' });
  }
});

// 2. Poll generation status
app.post('/api/video-status', async (req, res) => {
  try {
    if (!ai) {
      return res.status(400).json({ error: 'Gemini AI not initialized' });
    }
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required' });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    return res.json({ done: !!updated.done, error: updated.error || null });
  } catch (error) {
    console.error('[Veo] Error checking status:', error);
    return res.status(500).json({ error: error.message || 'Failed to check status' });
  }
});

// 3. Download generated video
app.post('/api/video-download', async (req, res) => {
  try {
    if (!ai) {
      return res.status(400).json({ error: 'Gemini AI not initialized' });
    }
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required' });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    const videoUri = updated.response?.generatedVideos?.[0]?.video?.uri;

    if (!videoUri) {
      return res.status(404).json({ error: 'Video URI not ready or generation failed' });
    }

    const key = process.env.GEMINI_API_KEY;
    const videoRes = await fetch(videoUri, {
      headers: { 'x-goog-api-key': key }
    });

    if (!videoRes.ok) {
      throw new Error(`Failed to fetch video stream from Google servers: ${videoRes.statusText}`);
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="himalayan_realm_animated.mp4"');

    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.end(buffer);
  } catch (error) {
    console.error('[Veo] Error downloading video:', error);
    return res.status(500).json({ error: error.message || 'Failed to download video' });
  }
});

// Image Generation & Editing API using gemini-nano-banana-2.1
app.post('/api/generate-image', async (req, res) => {
  try {
    if (!ai) {
      if (process.env.GEMINI_API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      } else {
        return res.status(400).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }
    }

    const { prompt, imageBase64, mimeType = 'image/jpeg', aspectRatio = '1:1', imageSize = '1K' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required.' });
    }

    const parts = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/jpeg'
        }
      });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-nano-banana-2.1',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio || '1:1',
          imageSize: imageSize || '1K'
        }
      }
    });

    let resultImageUrl = null;
    let resultText = '';
    const candidateParts = response.candidates?.[0]?.content?.parts || [];
    for (const part of candidateParts) {
      if (part.inlineData) {
        resultImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      } else if (part.text) {
        resultText += part.text;
      }
    }

    if (!resultImageUrl) {
      return res.status(500).json({ error: 'Model did not return an image part.', text: resultText });
    }

    return res.json({ imageUrl: resultImageUrl, text: resultText });
  } catch (error) {
    console.error('[ImageStudio] Error generating image:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
});

const gameDir = path.join(__dirname, 'nepalese_fantasy_web_game');

const staticOptions = {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.glb')) {
      res.setHeader('Content-Type', 'model/gltf-binary');
    }
  }
};

// Serve static assets
app.use(express.static(gameDir, staticOptions));
app.use('/nepalese_fantasy_web_game', express.static(gameDir, staticOptions));
app.use(express.static(__dirname, staticOptions));

// Single-page fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(gameDir, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Himalayan Realms server running at http://${HOST}:${PORT}/`);
});
