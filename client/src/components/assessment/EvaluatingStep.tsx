import { Loader2 } from 'lucide-react';

interface EvaluatingStepProps {
  title: string;
  subtitle: string;
}

export default function EvaluatingStep({ title, subtitle }: EvaluatingStepProps) {
  return (
    <div className="card text-center py-16">
      <Loader2 className="w-16 h-16 animate-spin text-primary-600 mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-surface-600">{subtitle}</p>
    </div>
  );
}
