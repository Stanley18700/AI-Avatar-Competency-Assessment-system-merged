import { GoogleGenAI } from '@google/genai';


interface ConversationMessage {
  role: 'ai' | 'nurse';
  text: string;
}


interface CaseInfo {
  title: string;
  descriptionTh: string;
  descriptionEn: string;
  reasoningIndicators: string[];
}


interface CriteriaInfo {
  id: string;
  nameTh: string;
  nameEn: string;
  groupNameEn: string;
}


interface ChatResponse {
  message: string;
  isComplete: boolean;
  turnNumber: number;
}


const MAX_TURNS = 4;
const MIN_NURSE_TURNS_FOR_COMPLETION = 3;
const HISTORY_WINDOW_MESSAGES = 6;
const COMPLETION_PHRASES = [
  'จบแล้ว',
  'จบค่ะ',
  'จบครับ',
  'ไม่มีเพิ่มเติม',
  'ครบถ้วนแล้ว',
  'เสร็จแล้ว',
  'พอแล้ว',
  'หมดแล้ว',
  'เท่านี้',
];
const THAI_CHAR_REGEX = /[\u0E00-\u0E7F]/;
const LATIN_CHAR_REGEX = /[A-Za-z]/;


function hasThaiText(text: string): boolean {
  return THAI_CHAR_REGEX.test(text);
}


function thaiDominant(text: string): boolean {
  const thaiCount = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;
  if (thaiCount === 0) return false;
  return thaiCount >= Math.max(12, latinCount * 2);
}


const ALLOWED_MEDICAL_TERMS = /\b(SpO2|O2sat|O2|BP|HR|RR|Temp|BUN|Cr|CBC|ABG|IV|IM|SC|PO|PRN|BID|TID|NPO|I\/O|GCS|BMI|HbA1c|INR|PT|aPTT|Na|K|Cl|Ca|Mg|pH|PCO2|PO2|SaO2|FiO2|PEEP|CPAP|BiPAP|EKG|ECG|CT|MRI|CXR|NSS|LRS|RLS|DKA|HHS|DVT|PE|CVA|TIA|MI|CHF|COPD|DM|HT|CKD|AKI|UTI|VAP|CAUTI|CLABSI|SSI|MRSA|VRE|ESBL|Paracetamol|Morphine|Insulin|Heparin|Warfarin|Adrenaline|Dopamine|Norepinephrine|Amiodarone|Atropine|Lidocaine|Metformin|Losartan|Amlodipine|Aspirin|Clopidogrel|Omeprazole|Furosemide|KCl|NaCl|MgSO4)\b/gi;


function sanitizeThaiText(text: string): string {
  const preserved: string[] = [];
  let safeText = text.replace(ALLOWED_MEDICAL_TERMS, (match) => {
    preserved.push(match);
    return `{{MED_${preserved.length - 1}}}`;
  });

  safeText = safeText
    .replace(/[A-Za-z][A-Za-z0-9\-_/().:,;']*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  safeText = safeText.replace(/\{\{MED_(\d+)\}\}/g, (_, idx) => preserved[parseInt(idx)]);
  return safeText;
}


function buildThaiCaseSummary(caseInfo: CaseInfo): string {
  const rawThai = (caseInfo.descriptionTh || '').trim();
  if (rawThai && hasThaiText(rawThai)) {
    const cleaned = sanitizeThaiText(rawThai);
    return cleaned.length > 220 ? `${cleaned.slice(0, 220)}...` : cleaned;
  }

  const normalized = `${caseInfo.title || ''} ${caseInfo.descriptionEn || ''}`.toLowerCase();
  if (normalized.includes('fall')) {
    return 'ผู้ป่วยกลุ่มเสี่ยงต่อการพลัดตกหกล้ม ต้องประเมินความเสี่ยง ปัจจัยแวดล้อม และวางแผนป้องกันอย่างเป็นระบบ';
  }
  if (normalized.includes('sepsis') || normalized.includes('infection')) {
    return 'ผู้ป่วยมีความเสี่ยงภาวะติดเชื้อ ต้องเฝ้าระวังอาการสำคัญ ประเมินสัญญาณชีพ และตอบสนองอย่างทันท่วงที';
  }
  if (normalized.includes('stroke')) {
    return 'ผู้ป่วยมีอาการทางระบบประสาทเฉียบพลัน ต้องประเมินอาการเร่งด่วน วางแผนดูแล และประสานทีมอย่างเหมาะสม';
  }

  return 'ผู้ป่วยต้องได้รับการประเมินอย่างเป็นระบบ วางแผนการพยาบาลตามลำดับความสำคัญ และติดตามอาการอย่างใกล้ชิด';
}


function buildFallbackChatResponse(caseInfo: CaseInfo, history: ConversationMessage[]): ChatResponse {
  const aiTurns = history.filter(m => m.role === 'ai').length;
  const turnNumber = aiTurns + 1;
  const thaiCaseSummary = buildThaiCaseSummary(caseInfo);

  if (aiTurns === 0) {
    return {
      turnNumber,
      isComplete: false,
      message: `สวัสดีค่ะ ดิฉัน AI Avatar ผู้ช่วยประเมินสมรรถนะทางการพยาบาล วันนี้เราจะประเมินจากกรณีศึกษาโดยสรุปคือ ${thaiCaseSummary} ค่ะ คำถามแรก: ในสถานการณ์นี้ คุณจะประเมินอาการและจัดลำดับความเร่งด่วนของผู้ป่วยอย่างไรบ้างคะ?`
    };
  }
  if (aiTurns === 1) {
    return {
      turnNumber,
      isComplete: false,
      message: 'ขอบคุณค่ะ คำถามถัดไป: กรุณาอธิบายแผนการพยาบาลและเหตุผลเชิงวิชาการที่ใช้ตัดสินใจในแต่ละขั้นตอนค่ะ'
    };
  }
  if (aiTurns === 2) {
    return {
      turnNumber,
      isComplete: false,
      message: 'ดีมากค่ะ หากผู้ป่วยมีอาการเปลี่ยนแปลงหรือเกิดภาวะแทรกซ้อน คุณจะเฝ้าระวังอะไร และจะปรับการดูแลอย่างไรคะ?'
    };
  }
  if (aiTurns === 3) {
    return {
      turnNumber,
      isComplete: false,
      message: 'คำถามสุดท้ายค่ะ คุณจะสื่อสารและประสานงานกับทีมสหสาขาวิชาชีพ รวมถึงให้คำแนะนำผู้ป่วยและญาติอย่างไร เพื่อความปลอดภัยและต่อเนื่องในการดูแลคะ?'
    };
  }

  return {
    turnNumber,
    isComplete: true,
    message: 'ขอบคุณสำหรับคำตอบทั้งหมดค่ะ ระบบจะนำบทสนทนานี้ไปประมวลผลเพื่อสรุปผลการประเมินสมรรถนะต่อไป'
  };
}


function detectUserCompletionIntent(text: string): boolean {
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  return COMPLETION_PHRASES.some((phrase) => normalized.includes(phrase.replace(/\s+/g, '').toLowerCase()));
}


function shouldFinishConversation(history: ConversationMessage[]): boolean {
  const aiTurns = history.filter((m) => m.role === 'ai').length;
  const nurseMessages = history.filter((m) => m.role === 'nurse');
  const nurseTurns = nurseMessages.length;
  const latestNurseMessage = nurseMessages[nurseMessages.length - 1]?.text || '';

  if (aiTurns >= MAX_TURNS) return true;
  if (nurseTurns >= MAX_TURNS + 1) return true;

  if (nurseTurns >= MIN_NURSE_TURNS_FOR_COMPLETION && detectUserCompletionIntent(latestNurseMessage)) {
    return true;
  }

  return false;
}


function normalizeChatResponsePayload(payload: unknown, aiTurns: number): ChatResponse {
  const obj = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};
  const rawMessage = obj.message;
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';

  if (!message) {
    throw new Error('Invalid chat payload: missing message');
  }
  if (!hasThaiText(message)) {
    throw new Error('Invalid chat payload: non-Thai message');
  }

  const cleanedMessage = message
    .replace(/[*#_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!thaiDominant(cleanedMessage)) {
    throw new Error('Invalid chat payload: English-heavy message');
  }

  const isComplete = typeof obj.isComplete === 'boolean'
    ? obj.isComplete
    : aiTurns >= MAX_TURNS;

  return {
    message: cleanedMessage,
    isComplete: aiTurns >= MAX_TURNS ? true : isComplete,
    turnNumber: aiTurns + 1,
  };
}


// ── Vertex AI fallback helper (now uses @google/genai) ──────────────────────
async function generateWithVertex(prompt: string, modelName: string): Promise<string> {
  const project = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION || 'us-central1';
  if (!project) throw new Error('VERTEX_PROJECT_ID not configured');

  const vertex = new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });

  const response = await vertex.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 256,
    },
  });

  return response.text ?? '';
}


export async function generateChatResponse(
  caseInfo: CaseInfo,
  criteria: CriteriaInfo[],
  history: ConversationMessage[],
  experienceLevel: string
): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('[VoiceChat] GEMINI_API_KEY is not configured');
  }

  // ── AI Studio client ────────────────────────────────────────────────────
  const genAI = new GoogleGenAI({ apiKey });

  const configuredModels = (process.env.GEMINI_MODELS || 'gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite')
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);

  const aiTurns = history.filter(m => m.role === 'ai').length;
  const nurseTurns = history.filter(m => m.role === 'nurse').length;
  const forceComplete = shouldFinishConversation(history);

  const criteriaList = criteria
    .map(c => `- ${c.nameEn} (${c.nameTh})`)
    .join('\n');
  const thaiCaseSummary = buildThaiCaseSummary(caseInfo);

  const reasoningList = caseInfo.reasoningIndicators.length > 0
    ? caseInfo.reasoningIndicators.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : 'ไม่มีเครื่องชี้วัดเฉพาะ';

  const recentHistory = history.slice(-HISTORY_WINDOW_MESSAGES);
  const historyText = recentHistory.length > 0
    ? recentHistory.map(m => `${m.role === 'ai' ? 'AI Avatar' : 'พยาบาล'}: ${m.text}`).join('\n\n')
    : '(ยังไม่เริ่มบทสนทนา)';

  const prompt = `คุณคือ "AI Avatar พยาบาลผู้ช่วยประเมิน" (AI Nurse Assessor) ที่สถาบันศูนย์การแพทย์มหาวิทยาลัยแม่ฟ้าหลวง
คุณกำลังทำหน้าที่สนทนาด้วยเสียงกับพยาบาลวิชาชีพ เพื่อประเมินสมรรถนะด้าน Cognitive Skills และ Clinical Reasoning


บทบาทและบุคลิกภาพของคุณ:
- พูดจาไพเราะ สุภาพ นุ่มนวล และเป็นมืออาชีพ (Professional & Empathetic)
- ใช้ภาษาไทยที่ **เป็นธรรมชาติสำหรับการพูด** (Spoken Thai) ไม่ใช่ภาษาเขียนทางการจนเกินไป
- หลีกเลี่ยงคำฟุ่มเฟือย ให้กระชับ สั้น และตรงประเด็น เพราะเป็นการสนทนาผ่านเสียง
- แสดงความเข้าใจ (Active Listening) เช่น "ค่ะ" "เข้าใจเลยค่ะ" "ถูกต้องค่ะ" ก่อนจะถามต่อ


ข้อมูลกรณีศึกษา (Case Scenario):
${thaiCaseSummary}


ตัวชี้วัดการใช้เหตุผลทางคลินิก (Clinical Reasoning Indicators):
${reasoningList}


เกณฑ์สมรรถนะที่ต้องประเมิน (Competency Criteria):
${criteriaList}


ระดับประสบการณ์พยาบาล: ${experienceLevel}


ประวัติบทสนทนา (Conversation History):
${historyText}


สถานะปัจจุบัน:
- AI ถามไปแล้ว: ${aiTurns} คำถาม
- พยาบาลตอบไปแล้ว: ${nurseTurns} ครั้ง
- เป้าหมาย: สนทนาให้ครบประมาณ ${MAX_TURNS} รอบ (Request-Response Loops)


คำสั่งสำหรับการตอบกลับรอบนี้:
${aiTurns === 0
      ? `นี่คือ "การเปิดบทสนทนา"
     1. ทักทายพยาบาลอย่างเป็นกันเองและแนะนำตัวสั้นๆ
     2. เกริ่นถึงกรณีศึกษาโดยย่อ (สรุปเฉพาะประเด็นสำคัญ ไม่ต้องอ่านยาว) "คนไข้รายนี้..."
     3. เริ่มต้นด้วย "คำถามปลายเปิด" เพื่อประเมินการประเมินสภาพผู้ป่วย (Assessment) หรือการตัดสินใจแรกรับ`
      : forceComplete
        ? `นี่คือ "การปิดบทสนทนา"
     1. กล่าวขอบคุณพยาบาลสำหรับข้อมูล
     2. แจ้งว่าระบบจะทำการประมวลผลผลการประเมินสักครู่
     3. ตั้งค่า 'isComplete': true`
        : `นี่คือ "การดำเนินบทสนทนาต่อเนื่อง"
     1. ตอบรับคำตอบล่าสุดของพยาบาลสั้นๆ (Acknowledge) เพื่อให้รู้ว่าฟังอยู่
     2. ถามคำถามเจาะลึก (Probing Question) หรือคำถามใหม่ ที่เชื่อมโยงกับ "Clinical Reasoning Indicators" หรือ "Competency Criteria" ที่ยังไม่ได้ถูกประเมิน
     3. ถ้าพยาบาลตอบได้ดีแล้ว ให้ขยับไปประเด็นถัดไป เช่น การวางแผนจำหน่าย หรือ ภาวะแทรกซ้อน`
    }


ข้อปฏิบัติสำคัญ (Strict Rules):
1. **ภาษาไทยเท่านั้น**: ห้ามพูดภาษาอังกฤษ ยกเว้นชื่อยาหรือศัพท์เฉพาะทางที่ไม่มีคำไทยที่นิยมใช้
2. **ห้ามอ่าน JSON หรือ Markdown**: ห้ามมีตัวอักษรพิเศษ เช่น * หรือ # ในข้อความที่จะพูด
3. **Format**: ต้องส่งคืนเป็น JSON เท่านั้น
4. **ความยาว**: คำพูดของ AI ไม่ควรยาวเกิน 1-2 ประโยคหลัก เพื่อให้การสนทนาลื่นไหล


รูปแบบการตอบกลับ (JSON Response Format):
{
  "message": "ข้อความภาษาไทยที่ AI จะพูดออกมา (String)",
  "isComplete": ${forceComplete ? 'true' : 'false'} (Boolean),
  "turnNumber": ${aiTurns + 1} (Number)
}`;

  let lastError = '';

  // ── AI Studio model loop ────────────────────────────────────────────────
  for (const modelName of configuredModels) {
    try {
      const responseText = await generateWithVertex(prompt, modelName);
      if (!responseText) throw new Error('Empty Vertex AI response');

      let jsonStr = responseText.trim();

      const fenceMatch = jsonStr.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/s);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }

      if (!jsonStr.startsWith('{')) {
        const braceStart = jsonStr.indexOf('{');
        const braceEnd = jsonStr.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
          jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
        }
      }

      const parsed = normalizeChatResponsePayload(JSON.parse(jsonStr), aiTurns);
      if (forceComplete) parsed.isComplete = true;
      console.log(`[Vertex] VoiceChat success with model ${modelName}`);
      return parsed;
    } catch (err: any) {
      console.error(`[Vertex] VoiceChat model ${modelName} failed:`, err.message);
    }
  }


  // ── Vertex AI fallback ──────────────────────────────────────────
  const vertexProject = process.env.VERTEX_PROJECT_ID;
  const vertexModels = (process.env.VERTEX_MODELS || 'gemini-2.5-flash')
    .split(',').map(m => m.trim()).filter(Boolean);

  if (vertexProject && vertexModels.length > 0) {
    console.warn('[VoiceChat] All AI Studio models failed. Switching to Vertex AI fallback...');
    for (const modelName of vertexModels) {
      try {
        const responseText = await generateWithVertex(prompt, modelName);
        if (!responseText) throw new Error('Empty Vertex AI response');

        let jsonStr = responseText.trim();
        // Strip markdown fences (```json ... ``` or ``` ... ```)
        const fenceMatch = jsonStr.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/s);
        if (fenceMatch) {
          jsonStr = fenceMatch[1].trim();
        } else if (!jsonStr.startsWith('{')) {
          // Extract first complete JSON object
          const braceStart = jsonStr.indexOf('{');
          const braceEnd = jsonStr.lastIndexOf('}');
          if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
            jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
          }
        }

        const parsed = normalizeChatResponsePayload(JSON.parse(jsonStr), aiTurns);
        if (forceComplete) parsed.isComplete = true;
        console.log(`[Vertex] VoiceChat success with model ${modelName}`);
        return parsed;
      } catch (err: any) {
        console.error(`[Vertex] VoiceChat model ${modelName} failed:`, err.message);
      }
    }
  }
  // ── End Vertex AI fallback ───────────────────────────────────────

  console.warn('[VoiceChat] All models (AI Studio + Vertex) failed, using hardcoded fallback. Last error: ' + lastError);
  return buildFallbackChatResponse(caseInfo, history);
}
