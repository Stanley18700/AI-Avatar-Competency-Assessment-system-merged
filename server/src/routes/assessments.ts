import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { encrypt } from '../services/encryptionService';
import { AIEvaluationError, AIEvaluationErrorCode, evaluateWithGemini } from '../services/geminiService';
import { generateChatResponse } from '../services/voiceChatService';
import { calculateCategoryAverage, calculateWeightedTotal, calculateGap } from '../utils/scoreCalculator';
import { parseJsonFields } from '../utils/jsonParser';

const router = Router();
router.use(authenticate);

const SCORABLE_STATUSES = ['SELF_ASSESSED', 'AI_FAILED'] as const;
type AIScoringFailureCode = AIEvaluationErrorCode | 'AI_PERSIST_ERROR';

interface AIScoringFailurePayload {
  status: 'AI_FAILED';
  code: AIScoringFailureCode;
  userMessage: string;
  correlationId: string;
}

function canAccessSession(req: AuthRequest, nurseId: string): boolean {
  return req.user!.role === 'ADMIN' || req.user!.role === 'REVIEWER' || req.user!.id === nurseId;
}

function canSubmitForScoring(status: string): boolean {
  return (SCORABLE_STATUSES as readonly string[]).includes(status);
}

function createCorrelationId(sessionId: string): string {
  return `${sessionId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toAIEvaluationError(err: unknown): AIEvaluationError {
  if (err instanceof AIEvaluationError) return err;
  if (err instanceof Error) {
    return new AIEvaluationError('AI_PROVIDER_ERROR', err.message, err.stack);
  }
  return new AIEvaluationError('AI_PROVIDER_ERROR', String(err));
}

function getUserMessageForCode(code: AIScoringFailureCode): string {
  switch (code) {
    case 'AI_CONFIG_ERROR':
      return 'ระบบ AI ยังไม่ได้ตั้งค่าพร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
    case 'AI_VALIDATION_ERROR':
      return 'ระบบ AI วิเคราะห์ผลได้ไม่ครบตามเกณฑ์ กรุณาลองส่งคำตอบอีกครั้ง';
    case 'AI_PARSE_ERROR':
      return 'ระบบ AI ตอบกลับในรูปแบบที่ประมวลผลไม่ได้ กรุณาลองใหม่อีกครั้ง';
    case 'AI_PERSIST_ERROR':
      return 'ระบบไม่สามารถบันทึกผลการประเมินได้ กรุณาลองใหม่อีกครั้ง';
    case 'AI_PROVIDER_ERROR':
    default:
      return 'ระบบ AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง';
  }
}

function buildAIFailurePayload(code: AIScoringFailureCode, correlationId: string): AIScoringFailurePayload {
  return {
    status: 'AI_FAILED',
    code,
    userMessage: getUserMessageForCode(code),
    correlationId,
  };
}

async function persistAIFailure(
  sessionId: string,
  code: AIScoringFailureCode,
  correlationId: string,
  details: string
): Promise<void> {
  await prisma.assessmentSession.update({
    where: { id: sessionId },
    data: { status: 'AI_FAILED' }
  });

  await prisma.aIScore.upsert({
    where: { sessionId },
    create: {
      sessionId,
      criteriaScores: JSON.stringify([]),
      categoryScores: JSON.stringify([]),
      weightedTotal: null,
      strengths: null,
      weaknesses: null,
      recommendations: null,
      confidenceScore: null,
      valid: false,
      retryCount: 2,
      rawResponse: `[${code}] ${details} | correlationId=${correlationId}`
    },
    update: {
      criteriaScores: JSON.stringify([]),
      categoryScores: JSON.stringify([]),
      weightedTotal: null,
      strengths: null,
      weaknesses: null,
      recommendations: null,
      confidenceScore: null,
      valid: false,
      retryCount: 2,
      rawResponse: `[${code}] ${details} | correlationId=${correlationId}`
    }
  });
}

// GET /api/assessments/my - Nurse's own assessments
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.assessmentSession.findMany({
      where: { nurseId: req.user!.id },
      include: {
        case: true,
        aiScore: true,
        reviewerScore: true,
        selfScores: true
      },
      orderBy: { createdAt: 'desc' }
    });
    const parsed = sessions.map(s => ({
      ...s,
      aiScore: parseJsonFields(s.aiScore, ['criteriaScores', 'categoryScores']),
      reviewerScore: parseJsonFields(s.reviewerScore, ['criteriaScores']),
    }));
    res.json(parsed);
  } catch (error) {
    console.error('Get my assessments error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// GET /api/assessments - All assessments (admin/reviewer)
router.get('/', requireRole('ADMIN', 'REVIEWER'), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.assessmentSession.findMany({
      include: {
        nurse: { select: { id: true, name: true, nameTh: true, department: true, experienceLevel: true } },
        case: true,
        aiScore: true,
        reviewerScore: true
      },
      orderBy: { createdAt: 'desc' }
    });
    const parsed = sessions.map(s => ({
      ...s,
      aiScore: parseJsonFields(s.aiScore, ['criteriaScores', 'categoryScores']),
      reviewerScore: parseJsonFields(s.reviewerScore, ['criteriaScores']),
    }));
    res.json(parsed);
  } catch (error) {
    console.error('Get all assessments error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// GET /api/assessments/:id - Get assessment detail
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.assessmentSession.findUnique({
      where: { id: req.params.id },
      include: {
        nurse: { select: { id: true, name: true, nameTh: true, department: true, experienceLevel: true } },
        case: true,
        transcript: true,
        selfScores: { include: { criteria: { include: { group: true } } } },
        aiScore: true,
        reviewerScore: true,
        finalScores: { include: { criteria: { include: { group: true } } } },
        versionHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }
      }
    });

    if (!session) {
      res.status(404).json({ error: 'ไม่พบการประเมิน' });
      return;
    }

    if (!canAccessSession(req, session.nurseId)) {
      res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงการประเมินนี้' });
      return;
    }

    // Get standard levels for this nurse's experience level
    const standardLevels = await prisma.standardLevel.findMany({
      where: { experienceLevel: session.experienceLevel }
    });

    res.json({
      ...session,
      aiScore: parseJsonFields(session.aiScore, ['criteriaScores', 'categoryScores']),
      reviewerScore: parseJsonFields(session.reviewerScore, ['criteriaScores']),
      standardLevels
    });
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/assessments/start - Start new assessment
router.post('/start', requireRole('NURSE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { caseId } = req.body;
    
    if (!caseId) {
      res.status(400).json({ error: 'กรุณาเลือกกรณีศึกษา' });
      return;
    }

    const nurse = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!nurse) {
      res.status(404).json({ error: 'ไม่พบผู้ใช้' });
      return;
    }

    const session = await prisma.assessmentSession.create({
      data: {
        nurseId: req.user!.id,
        caseId,
        experienceLevel: nurse.experienceLevel,
        status: 'IN_PROGRESS'
      },
      include: { case: true }
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Start assessment error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/assessments/:id/self-score - Submit self-assessment scores
router.post('/:id/self-score', requireRole('NURSE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { scores } = req.body; // [{criteriaId, score}]

    if (!Array.isArray(scores) || scores.length === 0) {
      res.status(400).json({ error: 'กรุณาระบุคะแนนประเมินตนเอง' });
      return;
    }

    const session = await prisma.assessmentSession.findUnique({ where: { id } });
    if (!session || session.nurseId !== req.user!.id) {
      res.status(404).json({ error: 'ไม่พบการประเมิน' });
      return;
    }

    if (session.status !== 'IN_PROGRESS' && session.status !== 'SELF_ASSESSED') {
      res.status(409).json({ error: 'ไม่สามารถแก้ไขคะแนนประเมินตนเองหลังส่งให้ AI แล้ว' });
      return;
    }

    let appliedScores = 0;

    // Upsert self scores
    for (const s of scores) {
      if (!s || typeof s.criteriaId !== 'string') {
        continue;
      }

      const numericScore = Number(s.score);
      if (!Number.isFinite(numericScore) || numericScore < 1 || numericScore > 5) {
        continue;
      }

      await prisma.selfScore.upsert({
        where: { sessionId_criteriaId: { sessionId: id, criteriaId: s.criteriaId } },
        create: { sessionId: id, criteriaId: s.criteriaId, score: numericScore },
        update: { score: numericScore }
      });

      appliedScores += 1;
    }

    if (appliedScores === 0) {
      res.status(400).json({ error: 'ไม่พบคะแนนที่ถูกต้องสำหรับบันทึก' });
      return;
    }

    await prisma.assessmentSession.update({
      where: { id },
      data: { status: 'SELF_ASSESSED' }
    });

    res.json({ message: 'บันทึกการประเมินตนเองเรียบร้อย' });
  } catch (error) {
    console.error('Self score error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/assessments/:id/submit - Submit response + trigger AI evaluation
router.post('/:id/submit', requireRole('NURSE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { text, inputType } = req.body; // inputType: 'TEXT' | 'VOICE'

    const session = await prisma.assessmentSession.findUnique({
      where: { id },
      include: { case: true }
    });

    if (!session || session.nurseId !== req.user!.id) {
      res.status(404).json({ error: 'ไม่พบการประเมิน' });
      return;
    }

    if (!canSubmitForScoring(session.status)) {
      res.status(409).json({ error: 'กรุณาทำแบบประเมินตนเองก่อน หรือเริ่มแบบประเมินใหม่หากส่งผลแล้ว' });
      return;
    }

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: 'กรุณาตอบคำถาม' });
      return;
    }

    // Store transcript
    const encryptedText = encrypt(text);
    await prisma.transcript.upsert({
      where: { sessionId: id },
      create: {
        sessionId: id,
        inputType: inputType || 'TEXT',
        rawText: text,
        encryptedText
      },
      update: {
        rawText: text,
        encryptedText,
        inputType: inputType || 'TEXT'
      }
    });

    // Get AI-assessed criteria
    const aiGroups = await prisma.competencyGroup.findMany({
      where: { assessedByAI: true, active: true },
      include: {
        criteria: { where: { active: true }, orderBy: { sortOrder: 'asc' } }
      },
      orderBy: { sortOrder: 'asc' }
    });

    const allCriteria = aiGroups.flatMap(g => 
      g.criteria.map(c => ({
        id: c.id,
        nameTh: c.nameTh,
        nameEn: c.nameEn,
        groupNameEn: g.nameEn,
        groupId: g.id
      }))
    );

    console.log(`[Assessment ${id}] Found ${allCriteria.length} AI-assessed criteria`);

    if (allCriteria.length === 0) {
      res.status(500).json({ error: 'ไม่พบเกณฑ์การประเมิน กรุณาติดต่อผู้ดูแลระบบ' });
      return;
    }

    const criteriaToGroupMap: Record<string, string> = {};
    allCriteria.forEach(c => { criteriaToGroupMap[c.id] = c.groupId; });

    // Parse reasoning indicators safely
    let reasoningIndicators: string[] = [];
    try {
      const rawIndicators = session.case.reasoningIndicators;
      if (typeof rawIndicators === 'string') {
        reasoningIndicators = JSON.parse(rawIndicators);
      } else if (Array.isArray(rawIndicators)) {
        reasoningIndicators = rawIndicators;
      }
    } catch (parseErr) {
      console.error('Failed to parse reasoning indicators:', parseErr);
      reasoningIndicators = [];
    }

    console.log(`[Assessment ${id}] Starting AI evaluation with ${reasoningIndicators.length} reasoning indicators`);
    let output: Awaited<ReturnType<typeof evaluateWithGemini>>['output'];
    let rawResponse = '';
    let retryCount = 0;

    try {
      const evaluation = await evaluateWithGemini(
        allCriteria,
        {
          title: session.case.title,
          descriptionTh: session.case.descriptionTh,
          descriptionEn: session.case.descriptionEn,
          reasoningIndicators
        },
        text
      );
      output = evaluation.output;
      rawResponse = evaluation.rawResponse;
      retryCount = evaluation.retryCount;
    } catch (evaluationErr) {
      const aiErr = toAIEvaluationError(evaluationErr);
      const correlationId = createCorrelationId(id);
      const failurePayload = buildAIFailurePayload(aiErr.code, correlationId);
      console.error(
        `[Assessment ${id}] AI evaluation failed (${aiErr.code}) [${correlationId}]:`,
        aiErr.details || aiErr.message
      );
      await persistAIFailure(id, aiErr.code, correlationId, aiErr.details || aiErr.message);
      res.status(200).json({
        ...failurePayload,
        message: failurePayload.userMessage
      });
      return;
    }

    try {
      console.log(`[Assessment ${id}] AI evaluation successful. Scored ${output.criteriaScores.length} criteria`);

      // Calculate category averages and weighted total
      const criteriaScoresTyped = output.criteriaScores as Array<{ criteriaId: string; score: number; reasoning?: string }>;
      const categoryScores = calculateCategoryAverage(criteriaScoresTyped, criteriaToGroupMap);
      const weightedTotal = calculateWeightedTotal(criteriaScoresTyped);

      // Store AI score
      await prisma.aIScore.upsert({
        where: { sessionId: id },
        create: {
          sessionId: id,
          criteriaScores: JSON.stringify(output.criteriaScores),
          categoryScores: JSON.stringify(categoryScores),
          weightedTotal,
          strengths: output.strengths,
          weaknesses: output.weaknesses,
          recommendations: output.recommendations,
          confidenceScore: output.confidenceScore,
          valid: true,
          retryCount,
          rawResponse
        },
        update: {
          criteriaScores: JSON.stringify(output.criteriaScores),
          categoryScores: JSON.stringify(categoryScores),
          weightedTotal,
          strengths: output.strengths,
          weaknesses: output.weaknesses,
          recommendations: output.recommendations,
          confidenceScore: output.confidenceScore,
          valid: true,
          retryCount,
          rawResponse
        }
      });

      // Calculate GAP and store final scores (AI as initial source)
      const standardLevels = await prisma.standardLevel.findMany({
        where: { experienceLevel: session.experienceLevel }
      });
      const standardMap: Record<string, number> = {};
      standardLevels.forEach(s => { standardMap[s.criteriaId] = s.standardScore; });

      for (const cs of output.criteriaScores) {
        const standard = standardMap[cs.criteriaId] || 1;
        const gap = calculateGap(cs.score, standard);
        await prisma.finalScore.upsert({
          where: { sessionId_criteriaId: { sessionId: id, criteriaId: cs.criteriaId } },
          create: { sessionId: id, criteriaId: cs.criteriaId, score: cs.score, gap, source: 'AI' },
          update: { score: cs.score, gap, source: 'AI' }
        });
      }

      // Update session status
      await prisma.assessmentSession.update({
        where: { id },
        data: { status: 'AI_SCORED' }
      });

      // Log version history
      await prisma.scoreVersionHistory.create({
        data: {
          sessionId: id,
          changedById: req.user!.id,
          changeType: 'AI_SCORE',
          newValues: JSON.stringify(output)
        }
      });

      console.log(`[Assessment ${id}] Successfully completed AI evaluation and stored results`);
      res.json({ message: 'ส่งคำตอบและประเมินโดย AI เสร็จสิ้น', status: 'AI_SCORED' });
    } catch (persistErr) {
      const correlationId = createCorrelationId(id);
      console.error(`[Assessment ${id}] AI persistence error [${correlationId}]:`, persistErr);
      res.status(500).json({
        error: getUserMessageForCode('AI_PERSIST_ERROR'),
        code: 'AI_PERSIST_ERROR',
        correlationId
      });
    }
  } catch (error) {
    console.error('Submit assessment error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/assessments/:id/chat - Multi-turn voice conversation with AI Avatar
router.post('/:id/chat', requireRole('NURSE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { history } = req.body; // Array of { role: 'ai' | 'nurse', text: string }

    const session = await prisma.assessmentSession.findUnique({
      where: { id },
      include: { case: true }
    });

    if (!session || session.nurseId !== req.user!.id) {
      res.status(404).json({ error: 'ไม่พบการประเมิน' });
      return;
    }

    if (!canSubmitForScoring(session.status)) {
      res.status(409).json({ error: 'กรุณาทำแบบประเมินตนเองก่อน หรือเริ่มแบบประเมินใหม่หากส่งผลแล้ว' });
      return;
    }

    // Get AI-assessed criteria for conversation context
    const aiGroups = await prisma.competencyGroup.findMany({
      where: { assessedByAI: true, active: true },
      include: {
        criteria: { where: { active: true }, orderBy: { sortOrder: 'asc' } }
      },
      orderBy: { sortOrder: 'asc' }
    });

    const allCriteria = aiGroups.flatMap(g =>
      g.criteria.map(c => ({
        id: c.id,
        nameTh: c.nameTh,
        nameEn: c.nameEn,
        groupNameEn: g.nameEn,
      }))
    );

    // Parse reasoning indicators
    let reasoningIndicators: string[] = [];
    try {
      const raw = session.case.reasoningIndicators;
      if (typeof raw === 'string') reasoningIndicators = JSON.parse(raw);
      else if (Array.isArray(raw)) reasoningIndicators = raw;
    } catch { reasoningIndicators = []; }

    const caseInfo = {
      title: session.case.title,
      descriptionTh: session.case.descriptionTh,
      descriptionEn: session.case.descriptionEn || session.case.title,
      reasoningIndicators
    };

    const experienceLevel = session.experienceLevel || 'LEVEL_1';

    const chatResponse = await generateChatResponse(
      caseInfo,
      allCriteria,
      history || [],
      experienceLevel
    );

    res.json(chatResponse);
  } catch (error: any) {
    console.error('Voice chat error:', error);
    res.status(500).json({ error: 'ระบบสนทนาขัดข้องชั่วคราว กรุณาลองอีกครั้ง' });
  }
});

// POST /api/assessments/:id/submit-conversation - Submit full conversation transcript for AI evaluation
router.post('/:id/submit-conversation', requireRole('NURSE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { history } = req.body; // Full conversation history

    const conversationHistory: Array<{ role: 'ai' | 'nurse'; text: string }> = Array.isArray(history) ? history : [];
    const nurseMessages = conversationHistory
      .filter((m) => m && m.role === 'nurse' && typeof m.text === 'string' && m.text.trim())
      .map((m) => m.text.trim());

    if (nurseMessages.length === 0) {
      res.status(400).json({ error: 'ไม่พบคำตอบของพยาบาลสำหรับการประเมิน' });
      return;
    }

    const session = await prisma.assessmentSession.findUnique({
      where: { id },
      include: { case: true }
    });

    if (!session || session.nurseId !== req.user!.id) {
      res.status(404).json({ error: 'ไม่พบการประเมิน' });
      return;
    }

    if (!canSubmitForScoring(session.status)) {
      res.status(409).json({ error: 'กรุณาทำแบบประเมินตนเองก่อน หรือเริ่มแบบประเมินใหม่หากส่งผลแล้ว' });
      return;
    }

    // Build transcript from conversation
    const transcriptText = conversationHistory
      .map((m: { role: string; text: string }) =>
        `${m.role === 'ai' ? 'AI Avatar' : 'พยาบาล'}: ${m.text}`
      )
      .join('\n\n');

    const nurseTranscriptText = nurseMessages
      .map((text, idx) => `คำตอบพยาบาลครั้งที่ ${idx + 1}: ${text}`)
      .join('\n\n');

    // Store transcript
    const encryptedText = encrypt(transcriptText);
    await prisma.transcript.upsert({
      where: { sessionId: id },
      create: {
        sessionId: id,
        inputType: 'VOICE',
        rawText: transcriptText,
        encryptedText
      },
      update: {
        rawText: transcriptText,
        encryptedText,
        inputType: 'VOICE'
      }
    });

    // Now trigger AI evaluation (reuse existing logic)
    const aiGroups = await prisma.competencyGroup.findMany({
      where: { assessedByAI: true, active: true },
      include: {
        criteria: { where: { active: true }, orderBy: { sortOrder: 'asc' } }
      },
      orderBy: { sortOrder: 'asc' }
    });

    const allCriteria = aiGroups.flatMap(g =>
      g.criteria.map(c => ({
        id: c.id,
        nameTh: c.nameTh,
        nameEn: c.nameEn,
        groupNameEn: g.nameEn,
        groupId: g.id
      }))
    );

    if (allCriteria.length === 0) {
      res.status(500).json({ error: 'ไม่พบเกณฑ์การประเมิน' });
      return;
    }

    const criteriaToGroupMap: Record<string, string> = {};
    allCriteria.forEach(c => { criteriaToGroupMap[c.id] = c.groupId; });

    let reasoningIndicators: string[] = [];
    try {
      const raw = session.case.reasoningIndicators;
      if (typeof raw === 'string') reasoningIndicators = JSON.parse(raw);
      else if (Array.isArray(raw)) reasoningIndicators = raw;
    } catch { reasoningIndicators = []; }

    const caseInfo = {
      title: session.case.title,
      descriptionTh: session.case.descriptionTh,
      descriptionEn: session.case.descriptionEn || session.case.title,
      reasoningIndicators
    };

    let output: Awaited<ReturnType<typeof evaluateWithGemini>>['output'];
    let rawResponse = '';
    let retryCount = 0;

    try {
      const evaluation = await evaluateWithGemini(
        allCriteria,
        caseInfo,
        nurseTranscriptText
      );
      output = evaluation.output;
      rawResponse = evaluation.rawResponse;
      retryCount = evaluation.retryCount;
    } catch (evaluationErr) {
      const aiErr = toAIEvaluationError(evaluationErr);
      const correlationId = createCorrelationId(id);
      const failurePayload = buildAIFailurePayload(aiErr.code, correlationId);
      console.error(
        `[Assessment ${id}] Voice-chat AI evaluation failed (${aiErr.code}) [${correlationId}]:`,
        aiErr.details || aiErr.message
      );
      await persistAIFailure(id, aiErr.code, correlationId, aiErr.details || aiErr.message);
      res.status(200).json({
        ...failurePayload,
        message: failurePayload.userMessage
      });
      return;
    }

    try {
      // Store AI scores (same logic as submit endpoint)
      const criteriaScoresTyped = output.criteriaScores as Array<{ criteriaId: string; score: number; reasoning?: string }>;
      const categoryScores = calculateCategoryAverage(criteriaScoresTyped, criteriaToGroupMap);
      const weightedTotal = calculateWeightedTotal(criteriaScoresTyped);

      await prisma.aIScore.upsert({
        where: { sessionId: id },
        create: {
          sessionId: id,
          criteriaScores: JSON.stringify(output.criteriaScores),
          categoryScores: JSON.stringify(categoryScores),
          weightedTotal,
          strengths: output.strengths,
          weaknesses: output.weaknesses,
          recommendations: output.recommendations,
          confidenceScore: output.confidenceScore,
          valid: true,
          retryCount,
          rawResponse
        },
        update: {
          criteriaScores: JSON.stringify(output.criteriaScores),
          categoryScores: JSON.stringify(categoryScores),
          weightedTotal,
          strengths: output.strengths,
          weaknesses: output.weaknesses,
          recommendations: output.recommendations,
          confidenceScore: output.confidenceScore,
          valid: true,
          retryCount,
          rawResponse
        }
      });

      // Create final scores
      const standardLevels = await prisma.standardLevel.findMany({
        where: { experienceLevel: session.experienceLevel }
      });
      const standardMap: Record<string, number> = {};
      standardLevels.forEach(sl => { standardMap[sl.criteriaId] = sl.standardScore; });

      for (const cs of output.criteriaScores) {
        const standard = standardMap[cs.criteriaId] || 1;
        await prisma.finalScore.upsert({
          where: { sessionId_criteriaId: { sessionId: id, criteriaId: cs.criteriaId } },
          create: {
            sessionId: id,
            criteriaId: cs.criteriaId,
            score: cs.score,
            gap: calculateGap(cs.score, standard),
            source: 'AI'
          },
          update: {
            score: cs.score,
            gap: calculateGap(cs.score, standard),
            source: 'AI'
          }
        });
      }

      await prisma.assessmentSession.update({
        where: { id },
        data: { status: 'AI_SCORED' }
      });

      await prisma.scoreVersionHistory.create({
        data: {
          sessionId: id,
          changedById: req.user!.id,
          changeType: 'AI_SCORE',
          newValues: JSON.stringify(output)
        }
      });

      res.json({ message: 'สนทนาเสร็จสิ้น AI ประเมินเรียบร้อย', status: 'AI_SCORED' });
    } catch (persistErr) {
      const correlationId = createCorrelationId(id);
      console.error(`[Assessment ${id}] Voice-chat AI persistence error [${correlationId}]:`, persistErr);
      res.status(500).json({
        error: getUserMessageForCode('AI_PERSIST_ERROR'),
        code: 'AI_PERSIST_ERROR',
        correlationId
      });
    }
  } catch (error) {
    console.error('Submit conversation error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

export default router;
