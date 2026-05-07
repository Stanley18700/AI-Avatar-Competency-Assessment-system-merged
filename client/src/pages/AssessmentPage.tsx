import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import VoiceChatPanel from '../components/VoiceChatPanel';
import VoiceChatErrorBoundary from '../components/VoiceChatErrorBoundary';
import AssessmentHeader from '../components/assessment/AssessmentHeader';
import SelfAssessmentStep from '../components/assessment/SelfAssessmentStep';
import RespondStep from '../components/assessment/RespondStep';
import EvaluatingStep from '../components/assessment/EvaluatingStep';
import ResultsStep from '../components/assessment/ResultsStep';
import { AssessmentSession, CompetencyGroup, StandardLevel } from '../types';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';

interface AIFailureNotice {
  code?: string;
  correlationId?: string;
  message: string;
}

export default function AssessmentPage() {
  const { t, experienceLevelLabels, statusLabels } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [, setCompetencies] = useState<CompetencyGroup[]>([]);
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const [responseText, setResponseText] = useState('');
  const [step, setStep] = useState<'loading' | 'self-assess' | 'respond' | 'evaluating' | 'results'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [useVoiceMode, setUseVoiceMode] = useState(true);
  const [allCompetencies, setAllCompetencies] = useState<CompetencyGroup[]>([]);
  const [aiFailureNotice, setAiFailureNotice] = useState<AIFailureNotice | null>(null);

  useEffect(() => {
    loadData();
    api.get('/competencies').then((r) => {
      const all: CompetencyGroup[] = r.data;
      setAllCompetencies(all);
      setCompetencies(all.filter((g) => g.assessedByAI));
    });
  }, [id]);

  const loadData = async () => {
    try {
      const res = await api.get(`/assessments/${id}`);
      const s = res.data;
      setSession(s);

      if (s.selfScores && s.selfScores.length > 0) {
        const scores: Record<string, number> = {};
        s.selfScores.forEach((ss: { criteriaId: string; score: number }) => {
          scores[ss.criteriaId] = ss.score;
        });
        setSelfScores(scores);
      }

      if (s.status === 'IN_PROGRESS') setStep('self-assess');
      else if (s.status === 'SELF_ASSESSED') setStep('respond');
      else if (s.status === 'AI_SCORED' || s.status === 'REVIEWED' || s.status === 'APPROVED') setStep('results');
      else if (s.status === 'AI_FAILED') setStep('respond');
      else setStep('self-assess');
    } catch {
      navigate('/my-assessments');
    }
  };

  const submitSelfScores = async () => {
    setSubmitting(true);
    try {
      const scores = Object.entries(selfScores).map(([criteriaId, score]) => ({ criteriaId, score }));
      await api.post(`/assessments/${id}/self-score`, { scores });
      setStep('respond');
      await loadData();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      alert(ax.response?.data?.error || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const showAIFailureNotice = (payload: unknown, fallbackMessage: string) => {
    const p = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};
    setAiFailureNotice({
      code: typeof p.code === 'string' ? p.code : undefined,
      correlationId: typeof p.correlationId === 'string' ? p.correlationId : undefined,
      message:
        (typeof p.userMessage === 'string' && p.userMessage) ||
        (typeof p.message === 'string' && p.message) ||
        fallbackMessage
    });
  };

  const submitResponse = async () => {
    if (!responseText.trim()) {
      alert('กรุณาตอบคำถาม');
      return;
    }
    setSubmitting(true);
    setStep('evaluating');
    setAiFailureNotice(null);
    try {
      const res = await api.post(`/assessments/${id}/submit`, { text: responseText, inputType: 'TEXT' });
      await loadData();
      if (res.data?.status === 'AI_FAILED') {
        showAIFailureNotice(res.data, 'AI ไม่สามารถประเมินได้ กรุณาลองส่งคำตอบอีกครั้ง');
        setStep('respond');
      } else {
        setAiFailureNotice(null);
        setStep('results');
      }
    } catch (err: unknown) {
      console.error('Submit response error:', err);
      const ax = err as { response?: { data?: { error?: string; message?: string } } };
      showAIFailureNotice(ax.response?.data, ax.response?.data?.error || ax.response?.data?.message || 'เกิดข้อผิดพลาด');
      setStep('respond');
    } finally {
      setSubmitting(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        alert(
          'บันทึกเสียงเสร็จสิ้น กรุณาพิมพ์คำตอบแทน (Speech-to-text จะเปิดใช้เมื่อตั้งค่า Google Cloud)'
        );
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch {
      alert('ไม่สามารถเข้าถึงไมโครโฟนได้');
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
  };

  if (step === 'loading' || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const standardMap: Record<string, number> = {};
  (session.standardLevels || []).forEach((sl: StandardLevel) => {
    standardMap[sl.criteriaId] = sl.standardScore;
  });

  return (
    <div className="page-shell">
      <AssessmentHeader session={session} experienceLevelLabels={experienceLevelLabels} statusLabels={statusLabels} />

      {step === 'self-assess' && (
        <SelfAssessmentStep
          title={t.selfAssessment}
          intro="ให้คะแนนตัวเอง 1-5 ในแต่ละสมรรถนะ (1=มือใหม่, 5=เชี่ยวชาญ)"
          allCompetencies={allCompetencies}
          selfScores={selfScores}
          onScoreChange={(criteriaId, score) => setSelfScores({ ...selfScores, [criteriaId]: score })}
          standardMap={standardMap}
          onSubmit={submitSelfScores}
          submitting={submitting}
          loadingLabel={t.loading}
        />
      )}

      {step === 'respond' && (
        <>
          {aiFailureNotice && (
            <div className="card border border-amber-200 bg-amber-50 text-amber-900">
              <p className="font-semibold">AI ประเมินไม่สำเร็จ</p>
              <p className="text-sm mt-1">{aiFailureNotice.message}</p>
              {(aiFailureNotice.code || aiFailureNotice.correlationId) && (
                <p className="text-xs mt-2 text-amber-700">
                  {aiFailureNotice.code ? `รหัส: ${aiFailureNotice.code}` : ''}
                  {aiFailureNotice.code && aiFailureNotice.correlationId ? ' | ' : ''}
                  {aiFailureNotice.correlationId ? `อ้างอิง: ${aiFailureNotice.correlationId}` : ''}
                </p>
              )}
            </div>
          )}
          <RespondStep
            useVoiceMode={useVoiceMode}
            onVoiceModeChange={setUseVoiceMode}
            voiceChat={
              <VoiceChatErrorBoundary>
                <VoiceChatPanel
                  sessionId={id!}
                  onConversationComplete={async (history) => {
                    setStep('evaluating');
                    setSubmitting(true);
                    setAiFailureNotice(null);
                    try {
                      const res = await api.post(`/assessments/${id}/submit-conversation`, { history });
                      await loadData();
                      if (res.data?.status === 'AI_FAILED') {
                        showAIFailureNotice(res.data, 'AI ไม่สามารถประเมินได้ กรุณาลองสนทนา/ส่งคำตอบอีกครั้ง');
                        setStep('respond');
                      } else {
                        setAiFailureNotice(null);
                        setStep('results');
                      }
                    } catch (err: unknown) {
                      console.error('Submit conversation error:', err);
                      const ax = err as { response?: { data?: { error?: string; message?: string } } };
                      showAIFailureNotice(ax.response?.data, ax.response?.data?.error || ax.response?.data?.message || 'เกิดข้อผิดพลาด');
                      setStep('respond');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                />
              </VoiceChatErrorBoundary>
            }
            textMode={
              <>
                <div className="card">
                  <h3 className="text-lg font-semibold mb-2">{t.caseScenario}</h3>
                  <div className="prose prose-sm max-w-none bg-blue-50 p-4 rounded-lg whitespace-pre-wrap">
                    {session.case?.descriptionTh}
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold mb-2">{t.yourResponse}</h3>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={recording ? stopRecording : startRecording}
                      className={`btn-secondary flex items-center gap-2 ${recording ? 'text-red-600 border-red-300' : ''}`}
                    >
                      {recording ? (
                        <span>
                          <MicOff className="w-4 h-4 inline" /> {t.stopRecording}
                        </span>
                      ) : (
                        <span>
                          <Mic className="w-4 h-4 inline" /> {t.voiceInput}
                        </span>
                      )}
                    </button>
                  </div>
                  <textarea
                    className="input-field h-64 text-sm"
                    placeholder="พิมพ์คำตอบของคุณที่นี่... อธิบายวิธีจัดการสถานการณ์ตามกรณีศึกษาข้างต้น"
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                  />
                  <div className="flex justify-between items-center mt-3">
                    <p className="text-xs text-surface-400">{responseText.length} ตัวอักษร</p>
                    <button
                      type="button"
                      onClick={submitResponse}
                      disabled={submitting || !responseText.trim()}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" /> {t.submitResponse}
                    </button>
                  </div>
                </div>
              </>
            }
          />
        </>
      )}

      {step === 'evaluating' && (
        <EvaluatingStep title={t.aiEvaluating} subtitle="กรุณารอสักครู่ ระบบ AI กำลังวิเคราะห์คำตอบของคุณ" />
      )}

      {step === 'results' && session && (
        <ResultsStep
          session={session}
          allCompetencies={allCompetencies}
          standardMap={standardMap}
          navigate={navigate}
          t={t}
        />
      )}
    </div>
  );
}
