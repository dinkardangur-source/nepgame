import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.warn('[Himalayan Realms] GEMINI_API_KEY not found in environment.');
}

// Veo Video Generation API
app.post('/api/generate-video', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('[Veo] Error starting video generation:', error);
    return res.status(500).json({ error: error?.message || 'Failed to start video generation' });
  }
});

// Video polling
app.post('/api/video-status', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('[Veo] Error checking status:', error);
    return res.status(500).json({ error: error?.message || 'Failed to check status' });
  }
});

// Video download
app.post('/api/video-download', async (req: Request, res: Response) => {
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
      headers: { 'x-goog-api-key': key || '' }
    });
    if (!videoRes.ok) {
      throw new Error(`Failed to fetch video stream from Google servers: ${videoRes.statusText}`);
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="himalayan_realm_animated.mp4"');
    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.end(buffer);
  } catch (error: any) {
    console.error('[Veo] Error downloading video:', error);
    return res.status(500).json({ error: error?.message || 'Failed to download video' });
  }
});

// Image Generation & Editing API using gemini-nano-banana-2.1
app.post('/api/generate-image', async (req: Request, res: Response) => {
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

    const parts: any[] = [];
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

    let resultImageUrl: string | null = null;
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
  } catch (error: any) {
    console.error('[ImageStudio] Error generating image:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate image' });
  }
});

// Static assets route for GLB models & images
const staticOptions = {
  setHeaders: (res: Response, filePath: string) => {
    if (filePath.endsWith('.glb')) {
      res.setHeader('Content-Type', 'model/gltf-binary');
    }
  }
};
app.use('/assets', express.static(path.join(__dirname, 'public/assets'), staticOptions));
app.use('/assets', express.static(path.join(__dirname, 'assets'), staticOptions));

// In development, mount Vite dev server as middleware
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // In production, serve built dist files
  app.use(express.static(path.join(__dirname, 'dist'), staticOptions));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Himalayan Realms server running at http://${HOST}:${PORT}/`);
});
