import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory cache for Quran API responses to guarantee instantaneous page flips
const pageCache = new Map<number, any>();
const chapterCache = new Map<number, any>();
const tafsirCache = new Map<string, any>();

// Helper to add auth headers if configured in environment
function getQuranHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'ZadAlRouh-App/1.0',
  };
  if (process.env.QURAN_API_KEY) {
    headers['x-api-key'] = process.env.QURAN_API_KEY;
  }
  return headers;
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Download Project ZIP endpoint
app.get('/api/download-zip', (_req: Request, res: Response) => {
  const zipPath = path.join(process.cwd(), 'public', 'zad-alrouh.zip');
  res.download(zipPath, 'zad-alrouh.zip', (err) => {
    if (err) {
      console.error('Error sending zip file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download zip file' });
      }
    }
  });
});

// 1. Get Verses by Page (1 - 604)
app.get('/api/quran/verses/page/:page', async (req: Request, res: Response) => {
  const pageNum = parseInt(req.params.page, 10);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > 604) {
    return res.status(400).json({ error: 'Invalid page number. Must be between 1 and 604.' });
  }

  if (pageCache.has(pageNum)) {
    return res.json(pageCache.get(pageNum));
  }

  try {
    const url = `https://api.quran.com/api/v4/verses/by_page/${pageNum}?language=ar&words=false&fields=text_uthmani,chapter_id,verse_key,verse_number,page_number,juz_number,hizb_number`;
    const response = await fetch(url, { headers: getQuranHeaders() });
    if (!response.ok) {
      throw new Error(`Quran.com API responded with status ${response.status}`);
    }
    const data = await response.json();
    pageCache.set(pageNum, data);
    return res.json(data);
  } catch (error: any) {
    console.error(`Error fetching page ${pageNum}:`, error.message);
    return res.status(502).json({
      error: 'تعذر تحميل محتوى الصفحة من خادم المصحف. تحقق من اتصال الإنترنت وحاول مرة أخرى.',
      details: error.message,
    });
  }
});

// 2. Get Verses by Chapter / Surah (1 - 114)
app.get('/api/quran/verses/chapter/:id', async (req: Request, res: Response) => {
  const chapterId = parseInt(req.params.id, 10);
  if (isNaN(chapterId) || chapterId < 1 || chapterId > 114) {
    return res.status(400).json({ error: 'Invalid chapter id. Must be between 1 and 114.' });
  }

  if (chapterCache.has(chapterId)) {
    return res.json(chapterCache.get(chapterId));
  }

  try {
    const url = `https://api.quran.com/api/v4/verses/by_chapter/${chapterId}?language=ar&words=false&fields=text_uthmani,chapter_id,verse_key,verse_number,page_number,juz_number,hizb_number&per_page=300`;
    const response = await fetch(url, { headers: getQuranHeaders() });
    if (!response.ok) {
      throw new Error(`Quran.com API responded with status ${response.status}`);
    }
    const data = await response.json();
    chapterCache.set(chapterId, data);
    return res.json(data);
  } catch (error: any) {
    console.error(`Error fetching chapter ${chapterId}:`, error.message);
    return res.status(502).json({
      error: 'تعذر تحميل محتوى السورة من خادم المصحف. تحقق من اتصال الإنترنت وحاول مرة أخرى.',
      details: error.message,
    });
  }
});

// 3. Get Tafsir by Ayah (verse_key e.g. "1:1" or "2:255")
app.get('/api/quran/tafsir/:tafsirId/:verseKey', async (req: Request, res: Response) => {
  const { tafsirId, verseKey } = req.params;
  const cacheKey = `${tafsirId}:${verseKey}`;

  if (tafsirCache.has(cacheKey)) {
    return res.json(tafsirCache.get(cacheKey));
  }

  try {
    const url = `https://api.quran.com/api/v4/tafsirs/${tafsirId}/by_ayah/${encodeURIComponent(verseKey)}`;
    const response = await fetch(url, { headers: getQuranHeaders() });
    if (!response.ok) {
      throw new Error(`Quran.com Tafsir API responded with status ${response.status}`);
    }
    const data = await response.json();
    tafsirCache.set(cacheKey, data);
    return res.json(data);
  } catch (error: any) {
    console.error(`Error fetching tafsir for ${verseKey}:`, error.message);
    return res.status(502).json({
      error: 'تعذر تحميل التفسير. تحقق من اتصال الإنترنت وحاول مرة أخرى.',
      details: error.message,
    });
  }
});

// 4. Search in Quran
app.get('/api/quran/search', async (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query || query.trim().length === 0) {
    return res.json({ search: { results: [], total_results: 0 } });
  }

  try {
    const url = `https://api.quran.com/api/v4/search?q=${encodeURIComponent(query.trim())}&language=ar&size=20`;
    const response = await fetch(url, { headers: getQuranHeaders() });
    if (response.status === 204) {
      return res.json({ search: { results: [], total_results: 0 } });
    }
    if (!response.ok) {
      throw new Error(`Search API responded with status ${response.status}`);
    }
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error(`Error searching "${query}":`, error.message);
    return res.status(502).json({
      error: 'تعذر إتمام البحث في المصحف. تحقق من اتصال الإنترنت وحاول مرة أخرى.',
      details: error.message,
    });
  }
});

// Cache for reciters and radios
let recitersCache: any = null;
let radiosCache: any = null;
let quranComRecitationsCache: any = null;

// 5. Get Reciters list from MP3Quran API
app.get('/api/quran/reciters', async (_req: Request, res: Response) => {
  if (recitersCache) {
    return res.json(recitersCache);
  }

  try {
    const response = await fetch('https://www.mp3quran.net/api/v3/reciters?language=ar');
    if (!response.ok) {
      throw new Error(`MP3Quran Reciters API status ${response.status}`);
    }
    const data = await response.json();
    recitersCache = data;
    return res.json(data);
  } catch (error: any) {
    console.error('Error fetching reciters:', error.message);
    return res.status(502).json({
      error: 'تعذر تحميل قائمة القراء من المصدر. يرجى التحقق من الاتصال بالإنترنت.',
      details: error.message,
    });
  }
});

// 6. Get Live Quran Radio stations from MP3Quran API
app.get('/api/quran/radios', async (_req: Request, res: Response) => {
  if (radiosCache) {
    return res.json(radiosCache);
  }

  try {
    const response = await fetch('https://mp3quran.net/api/v3/radios?language=ar');
    if (!response.ok) {
      throw new Error(`MP3Quran Radios API status ${response.status}`);
    }
    const data = await response.json();
    radiosCache = data;
    return res.json(data);
  } catch (error: any) {
    console.error('Error fetching radios:', error.message);
    return res.status(502).json({
      error: 'تعذر تحميل محطات إذاعة القرآن. يرجى التحقق من الاتصال بالإنترنت.',
      details: error.message,
    });
  }
});

// 7. Get Quran.com Recitations (Alternative reliable Quran Foundation recitations)
app.get('/api/quran/recitations', async (_req: Request, res: Response) => {
  if (quranComRecitationsCache) {
    return res.json(quranComRecitationsCache);
  }

  try {
    const response = await fetch('https://api.quran.com/api/v4/resources/recitations?language=ar', {
      headers: getQuranHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Quran.com Recitations status ${response.status}`);
    }
    const data = await response.json();
    quranComRecitationsCache = data;
    return res.json(data);
  } catch (error: any) {
    console.error('Error fetching Quran.com recitations:', error.message);
    return res.status(502).json({
      error: 'تعذر تحميل تلاوات المصحف.',
      details: error.message,
    });
  }
});

// 8. Get chapter audio from Quran.com
app.get('/api/quran/chapter-recitation/:reciterId/:chapterId', async (req: Request, res: Response) => {
  const { reciterId, chapterId } = req.params;
  try {
    const response = await fetch(
      `https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${chapterId}`,
      { headers: getQuranHeaders() }
    );
    if (!response.ok) {
      throw new Error(`Quran.com chapter audio status ${response.status}`);
    }
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error(`Error fetching audio for reciter ${reciterId} chapter ${chapterId}:`, error.message);
    return res.status(502).json({
      error: 'تعذر تشغيل التلاوة، يرجى المحاولة مرة أخرى.',
      details: error.message,
    });
  }
});

// 9. Audio Streaming Proxy with Byte Range support (for audio buffering & fallback)
app.get('/api/quran/audio-stream', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    return res.status(400).send('Invalid audio URL');
  }

  try {
    const range = req.headers.range;
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
    };
    if (range) {
      fetchHeaders['Range'] = range;
    }

    const audioRes = await fetch(targetUrl, {
      headers: fetchHeaders,
      redirect: 'follow',
    });

    if (!audioRes.ok && audioRes.status !== 206) {
      return res.status(audioRes.status).send('Upstream audio error');
    }

    res.status(audioRes.status);
    const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
    passHeaders.forEach((header) => {
      const val = audioRes.headers.get(header);
      if (val) {
        res.setHeader(header, val);
      }
    });

    if (!res.getHeader('content-type')) {
      res.setHeader('content-type', 'audio/mpeg');
    }

    if (audioRes.body) {
      const { Readable } = await import('stream');
      // @ts-ignore
      Readable.fromWeb(audioRes.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error: any) {
    console.error('Audio stream proxy error:', error.message);
    if (!res.headersSent) {
      return res.status(502).send('Audio streaming failed');
    }
  }
});

// Serve static assets from public directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Vite middleware & Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
