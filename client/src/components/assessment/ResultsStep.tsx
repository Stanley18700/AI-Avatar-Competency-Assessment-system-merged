import { CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import type { Translation } from '../../lib/i18n';
import { getGapClass, getGapDisplay, getScoreColor } from '../../lib/utils';
import type { AssessmentSession, CompetencyGroup } from '../../types';

interface ResultsStepProps {
  session: AssessmentSession;
  allCompetencies: CompetencyGroup[];
  standardMap: Record<string, number>;
  navigate: NavigateFunction;
  t: Translation;
}

export default function ResultsStep({ session, allCompetencies, standardMap, navigate, t }: ResultsStepProps) {
  return (
    <div className="space-y-4">
      {session.status === 'AI_FAILED' && (
        <div className="card bg-red-50 border-red-200 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <div>
            <p className="font-medium text-red-700">{t.aiFailed}</p>
            <p className="text-sm text-red-600">กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>
        </div>
      )}

      {session.status === 'APPROVED' && (
        <div className="card bg-green-50 border-green-200 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-500" />
          <div>
            <p className="font-medium text-green-700">{t.approved}</p>
            <p className="text-sm text-green-600">ผลประเมินได้รับการอนุมัติแล้ว</p>
          </div>
        </div>
      )}

      {(session.aiScore || session.finalScores?.length) && (
        <div className="card">
          <h3 className="text-base sm:text-lg font-semibold mb-1">{t.evaluationResults}</h3>
          <p className="text-xs text-surface-500 mb-4">ผลการประเมินสมรรถนะ ตามเกณฑ์สภาการพยาบาล</p>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b text-left bg-surface-100">
                      <th className="py-2 px-2">สมรรถนะ</th>
                      <th className="py-2 px-2 text-center">
                        {t.standardLevel}
                        <br />
                        <span className="text-xs font-normal">(ระดับมาตรฐาน)</span>
                      </th>
                      <th className="py-2 px-2 text-center">
                        {t.selfScore}
                        <br />
                        <span className="text-xs font-normal">(ตนเอง)</span>
                      </th>
                      <th className="py-2 px-2 text-center">
                        {t.aiScore}
                        <br />
                        <span className="text-xs font-normal">(AI)</span>
                      </th>
                      {session.reviewerScore && (
                        <th className="py-2 px-2 text-center">
                          {t.reviewerScore}
                          <br />
                          <span className="text-xs font-normal">(หัวหน้า)</span>
                        </th>
                      )}
                      <th className="py-2 px-2 text-center">
                        {t.finalScore}
                        <br />
                        <span className="text-xs font-normal">(คะแนนที่ได้)</span>
                      </th>
                      <th className="py-2 px-2 text-center">
                        {t.gap}
                        <br />
                        <span className="text-xs font-normal">(ส่วนต่าง)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allCompetencies.flatMap((group) => {
                      const groupColor =
                        group.type === 'CORE'
                          ? 'bg-amber-50 text-amber-800'
                          : group.type === 'FUNCTIONAL'
                            ? 'bg-orange-50 text-orange-800'
                            : group.type === 'SPECIFIC'
                              ? 'bg-pink-50 text-pink-800'
                              : 'bg-blue-50 text-blue-800';

                      const rows = [
                        <tr key={`group-${group.id}`} className={groupColor}>
                          <td colSpan={7} className="py-2 px-2 font-semibold">
                            {group.nameTh}
                            <span className="text-xs font-normal ml-2">({group.nameEn})</span>
                            {!group.assessedByAI && <span className="text-xs ml-2">[ไม่ประเมินโดย AI]</span>}
                          </td>
                        </tr>,
                      ];

                      group.criteria.forEach((c) => {
                        const standard = standardMap[c.id] || 1;
                        const selfS = session.selfScores?.find((s) => s.criteriaId === c.id)?.score;
                        const aiS = group.assessedByAI
                          ? (session.aiScore?.criteriaScores as { criteriaId: string; score: number }[])?.find(
                              (s) => s.criteriaId === c.id
                            )
                          : null;
                        const reviewerS = (
                          session.reviewerScore?.criteriaScores as { criteriaId: string; score: number }[]
                        )?.find((s) => s.criteriaId === c.id);
                        const finalS = session.finalScores?.find((s) => s.criteriaId === c.id);
                        const displayScore = finalS?.score || reviewerS?.score || aiS?.score;
                        const displayGap = finalS ? finalS.gap : displayScore ? displayScore - standard : null;

                        rows.push(
                          <tr key={`criteria-${group.id}-${c.id}`} className="border-b hover:bg-surface-100">
                            <td className="py-2 px-2">
                              <p>{c.nameTh}</p>
                              <p className="text-xs text-surface-400">{c.nameEn}</p>
                            </td>
                            <td className="py-2 px-2 text-center font-semibold text-primary-700">{standard}</td>
                            <td className="py-2 px-2 text-center">{selfS || '-'}</td>
                            <td
                              className={`py-2 px-2 text-center font-semibold ${aiS ? getScoreColor(aiS.score) : 'text-surface-300'}`}
                            >
                              {group.assessedByAI ? aiS?.score || '-' : <span className="text-surface-300">—</span>}
                            </td>
                            {session.reviewerScore && (
                              <td
                                className={`py-2 px-2 text-center font-semibold ${reviewerS ? getScoreColor(reviewerS.score) : ''}`}
                              >
                                {reviewerS?.score || '-'}
                              </td>
                            )}
                            <td className={`py-2 px-2 text-center font-bold ${displayScore ? getScoreColor(displayScore) : ''}`}>
                              {displayScore || '-'}
                            </td>
                            <td className={`py-2 px-2 text-center font-bold ${displayGap !== null ? getGapClass(displayGap) : ''}`}>
                              {displayGap !== null ? getGapDisplay(displayGap) : '-'}
                            </td>
                          </tr>
                        );
                      });

                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {session.aiScore?.weightedTotal && (
            <div className="mt-4 p-3 bg-primary-50 rounded-lg text-center">
              <p className="text-sm text-surface-600">คะแนนเฉลี่ยรวม (AI Assessed)</p>
              <p className="text-3xl font-bold text-primary-700">{session.aiScore.weightedTotal?.toFixed(2)}/5.00</p>
              {session.aiScore.confidenceScore && (
                <p className="text-xs text-surface-400 mt-1">
                  {t.confidence}: {(session.aiScore.confidenceScore * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {session.aiScore && session.aiScore.valid && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="card border-l-4 border-green-400">
            <h4 className="font-semibold text-green-700 text-sm sm:text-base mb-2">{t.strengths}</h4>
            <p className="text-xs sm:text-sm whitespace-pre-wrap">{session.aiScore.strengths || '-'}</p>
          </div>
          <div className="card border-l-4 border-red-400">
            <h4 className="font-semibold text-red-700 text-sm sm:text-base mb-2">{t.weaknesses}</h4>
            <p className="text-xs sm:text-sm whitespace-pre-wrap">{session.aiScore.weaknesses || '-'}</p>
          </div>
          <div className="card border-l-4 border-blue-400">
            <h4 className="font-semibold text-blue-700 text-sm sm:text-base mb-2">{t.recommendations}</h4>
            <p className="text-xs sm:text-sm whitespace-pre-wrap">{session.aiScore.recommendations || '-'}</p>
          </div>
        </div>
      )}

      {session.reviewerScore?.feedbackText && (
        <div className="card border-l-4 border-purple-400">
          <h4 className="font-semibold text-purple-700 mb-2">{t.feedback}</h4>
          <p className="text-sm whitespace-pre-wrap">{session.reviewerScore.feedbackText}</p>
        </div>
      )}

      {session.status === 'APPROVED' && (
        <div className="card bg-primary-50 border-primary-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary-600" />
              <div>
                <p className="font-semibold text-primary-700">แผนพัฒนารายบุคคล (IDP)</p>
                <p className="text-sm text-primary-600">ดูแผนพัฒนาสมรรถนะตามผลการประเมิน</p>
              </div>
            </div>
            <button type="button" onClick={() => navigate(`/idp/${session.id}`)} className="btn-primary text-sm">
              ดู IDP →
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-surface-800">ดูผลวิเคราะห์เรียบร้อยแล้ว</p>
            <p className="text-sm text-surface-500">เลือกขั้นตอนถัดไปเพื่อดำเนินการต่อ</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate('/my-assessments')} className="btn-secondary">
              กลับไปหน้ารายการประเมิน
            </button>
            <button type="button" onClick={() => navigate('/dashboard')} className="btn-primary">
              ไปที่แดชบอร์ด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
