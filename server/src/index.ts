import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import departmentRoutes from './routes/departments';
import competencyRoutes from './routes/competencies';
import caseRoutes from './routes/cases';
import assessmentRoutes from './routes/assessments';
import reviewRoutes from './routes/reviews';
import reportRoutes from './routes/reports';
import analyticsRoutes from './routes/analytics';
import idpRoutes from './routes/idp';
import audioRoutes from './routes/audio';
import azureRoutes from './routes/azure';
import prisma from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

function getConfiguredGeminiModels(): string[] {
  return (process.env.GEMINI_MODELS || 'gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

async function runGeminiLiveCheck(): Promise<{ ok: boolean; model?: string; reason?: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'missing_api_key' };
  }

  const models = getConfiguredGeminiModels();
  if (models.length === 0) {
    return { ok: false, reason: 'no_models_configured' };
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: models[0],
      contents: 'Reply with only: OK',
      config: { temperature: 0, maxOutputTokens: 8 },
    });
    const text = (response.text ?? '').trim();
    return { ok: text.length > 0, model: models[0], reason: text.length > 0 ? undefined : 'empty_response' };
  } catch (err) {
    return { ok: false, model: models[0], reason: err instanceof Error ? err.message : String(err) };
  }
}

async function buildDependencyChecks(includeGeminiLive: boolean): Promise<{
  database: boolean;
  geminiConfigured: boolean;
  jwtConfigured: boolean;
  encryptionConfigured: boolean;
  geminiLive?: { ok: boolean; model?: string; reason?: string };
}> {
  const checks: {
    database: boolean;
    geminiConfigured: boolean;
    jwtConfigured: boolean;
    encryptionConfigured: boolean;
    geminiLive?: { ok: boolean; model?: string; reason?: string };
  } = {
    database: false,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY),
    jwtConfigured: Boolean(process.env.JWT_SECRET),
    encryptionConfigured: Boolean(process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_IV),
  };

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.database = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  if (includeGeminiLive) {
    checks.geminiLive = await runGeminiLiveCheck();
  }

  return checks;
}

const allowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || '').split(',').map((origin) => origin.trim()),
].filter((origin): origin is string => Boolean(origin));

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/competencies', competencyRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/idp', idpRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/azure', azureRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/dependencies', async (req, res) => {
  const includeGeminiLive = req.query.geminiLive === '1';
  const checks = await buildDependencyChecks(includeGeminiLive);
  const ok = checks.database && checks.geminiConfigured && checks.jwtConfigured && checks.encryptionConfigured
    && (checks.geminiLive ? checks.geminiLive.ok : true);
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

app.get('/api/health/dependencies', async (req, res) => {
  const includeGeminiLive = req.query.geminiLive === '1';
  const checks = await buildDependencyChecks(includeGeminiLive);
  const ok = checks.database && checks.geminiConfigured && checks.jwtConfigured && checks.encryptionConfigured
    && (checks.geminiLive ? checks.geminiLive.ok : true);
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

app.get('/', (_req, res) => {
  res.json({
    service: 'NurseMind AI API',
    status: 'running',
    health: '/health',
    apiHealth: '/api/health',
    dependencyHealth: '/health/dependencies',
    apiDependencyHealth: '/api/health/dependencies',
  });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 NurseMind AI server running on port ${PORT}`);
});

export default app;
