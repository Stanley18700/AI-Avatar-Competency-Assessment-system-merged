import type { CompetencyGroup } from '../../types';

interface SelfAssessmentStepProps {
  title: string;
  intro: string;
  allCompetencies: CompetencyGroup[];
  selfScores: Record<string, number>;
  onScoreChange: (criteriaId: string, score: number) => void;
  standardMap: Record<string, number>;
  onSubmit: () => void;
  submitting: boolean;
  loadingLabel: string;
}

export default function SelfAssessmentStep({
  title,
  intro,
  allCompetencies,
  selfScores,
  onScoreChange,
  standardMap,
  onSubmit,
  submitting,
  loadingLabel,
}: SelfAssessmentStepProps) {
  return (
    <div className="card">
      <h3 className="text-base sm:text-lg font-semibold mb-2">{title}</h3>
      <p className="text-xs sm:text-sm text-surface-500 mb-4">{intro}</p>

      {allCompetencies.map((group) => (
        <div key={group.id} className="mb-4 sm:mb-6">
          <h4 className="font-medium text-primary-700 text-sm sm:text-base mb-1">{group.nameTh}</h4>
          {!group.assessedByAI && (
            <p className="text-xs text-amber-600 mb-2">* ประเมินโดยตนเองและหัวหน้างาน (ไม่มีการประเมินจาก AI)</p>
          )}
          <div className="space-y-2">
            {group.criteria.map((c) => (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-3 bg-surface-100 rounded-lg border border-surface-200"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.nameTh}</p>
                  <p className="text-xs text-surface-400 truncate">{c.nameEn}</p>
                  <p className="text-xs text-surface-400">มาตรฐาน: {standardMap[c.id] || '-'}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0 w-full sm:w-auto">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => onScoreChange(c.id, score)}
                      className={`flex-1 sm:flex-none w-auto sm:w-10 h-9 sm:h-10 rounded-lg text-sm font-bold transition-colors
                        ${
                          selfScores[c.id] === score
                            ? 'bg-primary-600 text-white'
                            : 'bg-white border border-surface-300 hover:border-primary-400'
                        }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button type="button" onClick={onSubmit} disabled={submitting} className="btn-primary w-full mt-4">
        {submitting ? loadingLabel : 'ถัดไป: ตอบกรณีศึกษา →'}
      </button>
    </div>
  );
}
