import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { statusColors } from '../../lib/i18n';
import { formatDateTime } from '../../lib/utils';
import type { AssessmentSession } from '../../types';

interface AssessmentHeaderProps {
  session: AssessmentSession;
  experienceLevelLabels: Record<string, string>;
  statusLabels: Record<string, string>;
}

export default function AssessmentHeader({ session, experienceLevelLabels, statusLabels }: AssessmentHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
      <button
        type="button"
        onClick={() => navigate('/my-assessments')}
        className="p-1 hover:bg-surface-200 rounded flex-shrink-0"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg sm:text-xl font-bold text-surface-900 truncate">
          {session.case?.titleTh || session.case?.title}
        </h2>
        <p className="text-xs sm:text-sm text-surface-500 flex flex-wrap items-center gap-1 sm:gap-2">
          <span>{experienceLevelLabels[session.experienceLevel]}</span>
          <span>·</span>
          <span className="hidden sm:inline">{formatDateTime(session.createdAt)}</span>
          <span className={`badge ${statusColors[session.status]} text-xs`}>{statusLabels[session.status]}</span>
        </p>
      </div>
    </div>
  );
}
