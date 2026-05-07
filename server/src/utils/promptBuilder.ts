interface CriteriaInfo {
  id: string;
  nameTh: string;
  nameEn: string;
  groupNameEn: string;
}

interface CaseInfo {
  title: string;
  descriptionTh: string;
  descriptionEn: string;
  reasoningIndicators: string[];
}

export function buildEvaluationPrompt(
  criteria: CriteriaInfo[],
  caseInfo: CaseInfo,
  transcript: string
): string {
  const criteriaList = criteria.map(c => 
    `- ID: "${c.id}" | Group: ${c.groupNameEn} | Name: ${c.nameEn} (${c.nameTh})`
  ).join('\n');

  const criteriaIds = criteria.map(c => `"${c.id}"`).join(', ');

  const reasoningList = caseInfo.reasoningIndicators.length > 0
    ? caseInfo.reasoningIndicators.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : 'No specific reasoning indicators provided.';

  return `You are an expert nursing competency evaluator at Mae Fah Luang University Medical Center Hospital (โรงพยาบาลศูนย์การแพทย์มหาวิทยาลัยแม่ฟ้าหลวง).

Your task is to evaluate a nurse's response to a clinical case scenario. Score the nurse on each competency criterion using a 1-5 scale:
  1 = Novice (ระดับเริ่มต้น) - Minimal understanding, requires constant guidance
  2 = Beginner (ระดับเริ่มเรียนรู้) - Basic understanding, requires frequent guidance  
  3 = Competent (ระดับมีความสามารถ) - Adequate understanding, works independently in routine situations
  4 = Proficient (ระดับชำนาญ) - Deep understanding, handles complex situations well
  5 = Expert (ระดับเชี่ยวชาญ) - Exceptional mastery, can teach and lead others

CASE SCENARIO:
Title: ${caseInfo.title}
Description (Thai): ${caseInfo.descriptionTh}
Description (English): ${caseInfo.descriptionEn}

EXPECTED REASONING INDICATORS:
${reasoningList}

COMPETENCY CRITERIA TO EVALUATE:
${criteriaList}

NURSE'S RESPONSE:
"""
${transcript}
"""

INSTRUCTIONS:
1. Evaluate the nurse's response against EACH criterion listed above.
2. Consider the depth and quality of clinical reasoning demonstrated.
3. The response may be in Thai - evaluate the content regardless of language.
4. Score ONLY the criteria provided. Do NOT invent new criteria.
5. Provide clear reasoning for each score.
6. Write strengths, weaknesses, and recommendations in Thai language.
7. Return strictly valid JSON object only, no markdown wrappers.
8. "score" must be an INTEGER only (1,2,3,4,5) - never decimal or string.
9. "criteriaScores" must contain EXACTLY ${criteria.length} items, one per criterion ID listed below.

Return ONLY valid JSON in this exact format (no markdown, no explanation outside JSON):
{
  "criteriaScores": [
    { "criteriaId": "<exact ID from above>", "score": <1-5>, "reasoning": "<brief explanation in Thai>" }
  ],
  "strengths": "<overall strengths in Thai>",
  "weaknesses": "<overall weaknesses in Thai>",
  "recommendations": "<specific improvement recommendations in Thai>",
  "confidenceScore": <0.0-1.0>
}

CRITICAL: You MUST include scores for ALL these criteria IDs: [${criteriaIds}]
Do NOT include any criteria ID not in the list above.
Each score MUST be an integer between 1 and 5.`;
}
