import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

function azureNotConfigured(res: Response): void {
  res.status(503).json({
    success: false,
    message:
      'Azure Speech ไม่ได้ตั้งค่า (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION)',
  });
}

// GET /api/azure/speech-token — short-lived token for browser Speech SDK
router.get('/speech-token', async (_req: AuthRequest, res) => {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;
  if (!speechKey || !speechRegion) {
    azureNotConfigured(res);
    return;
  }

  try {
    const tokenRes = await fetch(
      `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': speechKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    if (!tokenRes.ok) {
      throw new Error(`issueToken failed: ${tokenRes.status}`);
    }
    const token = await tokenRes.text();
    res.json({ success: true, token, region: speechRegion });
  } catch (err) {
    console.error('Azure speech-token error:', err);
    res.status(500).json({ success: false, message: 'ไม่สามารถออก token สำหรับ Azure Speech ได้' });
  }
});

// GET /api/azure/ice-token — WebRTC relay for talking avatar
router.get('/ice-token', async (_req: AuthRequest, res) => {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;
  if (!speechKey || !speechRegion) {
    azureNotConfigured(res);
    return;
  }

  try {
    const iceRes = await fetch(
      `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`,
      {
        method: 'GET',
        headers: { 'Ocp-Apim-Subscription-Key': speechKey },
      }
    );
    if (!iceRes.ok) {
      throw new Error(`ICE token failed: ${iceRes.status}`);
    }
    const iceData = await iceRes.json();
    res.json({ success: true, iceServers: iceData });
  } catch (err) {
    console.error('Azure ice-token error:', err);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึง ICE credentials สำหรับ avatar ได้' });
  }
});

export default router;
