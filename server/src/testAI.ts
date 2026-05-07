import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from server root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TEST_PROMPT = 'Reply with only this JSON, no other text: {"message": "สวัสดีค่ะ ระบบทำงานได้ปกติ", "status": "ok"}';

// ── Test 1: AI Studio ────────────────────────────────────────────────────────
async function testAIStudio(): Promise<void> {
  console.log('\n========== TEST 1: AI Studio ==========');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;

  if (!apiKey) {
    console.error('❌ SKIP: GEMINI_API_KEY not set in .env');
    return;
  }

  console.log(`✅ API Key found: ${apiKey.slice(0, 8)}...`);

  const genAI = new GoogleGenAI({ apiKey });

  const models = (process.env.GEMINI_MODELS || 'gemini-2.0-flash,gemini-2.0-flash-lite')
    .split(',').map(m => m.trim()).filter(Boolean);

  for (const model of models) {
    try {
      console.log(`\n▶ Trying model: ${model}`);
      const response = await genAI.models.generateContent({
        model,
        contents: TEST_PROMPT,
        config: { temperature: 0.1, maxOutputTokens: 128 },
      });
      const text = response.text ?? '';
      console.log(`✅ Response: ${text.trim()}`);
      return; // Stop after first success
    } catch (err: any) {
      console.error(`❌ Model ${model} failed: ${err?.message}`);
    }
  }

  console.error('❌ All AI Studio models failed');
}

// ── Test 2: Vertex AI ────────────────────────────────────────────────────────
async function testVertexAI(): Promise<void> {
  console.log('\n========== TEST 2: Vertex AI ==========');
  const project = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION || 'us-central1';
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!project) {
    console.error('❌ SKIP: VERTEX_PROJECT_ID not set in .env');
    return;
  }

  console.log(`✅ Project: ${project}`);
  console.log(`✅ Location: ${location}`);
  console.log(`✅ Credentials file: ${credentials ?? '(using ADC/default)'}`);

  const vertex = new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });

  const models = (process.env.VERTEX_MODELS || 'gemini-2.0-flash')
    .split(',').map(m => m.trim()).filter(Boolean);

  for (const model of models) {
    try {
      console.log(`\n▶ Trying model: ${model}`);
      const response = await vertex.models.generateContent({
        model,
        contents: TEST_PROMPT,
        config: { temperature: 0.1, maxOutputTokens: 128 },
      });
      const text = response.text ?? '';
      console.log(`✅ Response: ${text.trim()}`);
      return; // Stop after first success
    } catch (err: any) {
      console.error(`❌ Model ${model} failed: ${err?.message}`);
    }
  }

  console.error('❌ All Vertex AI models failed');
}

// ── Run both tests ────────────────────────────────────────────────────────────
(async () => {
  await testAIStudio();
  await testVertexAI();
  console.log('\n========== DONE ==========\n');
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});