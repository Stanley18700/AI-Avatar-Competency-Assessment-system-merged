import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { Case, Department } from '../types';
import { Plus, Edit2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function CasesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [cases, setCases] = useState<Case[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Case | null>(null);
  const [form, setForm] = useState({
    title: '', titleTh: '', descriptionTh: '', descriptionEn: '',
    reasoningIndicators: '', departmentId: ''
  });

  useEffect(() => {
    loadCases();
    api.get('/departments').then(r => setDepartments(r.data));
  }, []);

  const loadCases = () => api.get('/cases').then(r => setCases(r.data));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      reasoningIndicators: form.reasoningIndicators.split('\n').filter(Boolean),
      linkedCriteriaIds: []
    };
    try {
      if (editing) {
        await api.patch(`/cases/${editing.id}`, data);
      } else {
        await api.post('/cases', data);
      }
      loadCases();
      setShowModal(false);
      setEditing(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  const openEdit = (c: Case) => {
    setEditing(c);
    setForm({
      title: c.title, titleTh: c.titleTh || '', descriptionTh: c.descriptionTh, descriptionEn: c.descriptionEn,
      reasoningIndicators: (c.reasoningIndicators || []).join('\n'), departmentId: c.departmentId || ''
    });
    setShowModal(true);
  };

  const toggleActive = async (c: Case) => {
    await api.patch(`/cases/${c.id}`, { active: !c.active });
    loadCases();
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="page-shell space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-900">{t.cases}</h2>
        {isAdmin && (
          <button onClick={() => { setEditing(null); setForm({ title: '', titleTh: '', descriptionTh: '', descriptionEn: '', reasoningIndicators: '', departmentId: '' }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t.create}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cases.map(c => (
          <div key={c.id} className={`card-hover ${!c.active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-surface-800">{c.titleTh || c.title}</h3>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1 hover:bg-surface-100 rounded"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => toggleActive(c)} className="p-1 hover:bg-surface-100 rounded">
                    {c.active ? <EyeOff className="w-4 h-4 text-red-400" /> : <Eye className="w-4 h-4 text-green-400" />}
                  </button>
                </div>
              )}
            </div>
            {c.titleTh && <p className="text-xs text-surface-400 mb-2">{c.title}</p>}
            <p className="text-sm text-surface-600 line-clamp-3 mb-3">{c.descriptionTh}</p>
            <div className="flex items-center justify-between text-xs text-surface-400">
              <span>{c.department?.nameTh || 'ทั่วไป'}</span>
              <span>{(c.reasoningIndicators as string[])?.length || 0} ตัวชี้วัด</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal — full viewport; items-start avoids vertical center clipping when the form is tall */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-6 pb-10 sm:p-6 sm:pt-8 sm:pb-12"
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-modal-title"
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl mb-8 shrink-0 max-h-[calc(100dvh-2.5rem)] overflow-y-auto">
            <h3 id="case-modal-title" className="text-lg font-semibold mb-4">
              {editing ? t.edit : t.create} {t.caseScenario}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Title (EN)</label>
                  <input className="input-field" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
                </div>
                <div>
                  <label className="label">ชื่อ (TH)</label>
                  <input className="input-field" value={form.titleTh} onChange={e => setForm({...form, titleTh: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">รายละเอียด (ภาษาไทย)</label>
                <textarea className="input-field h-32" value={form.descriptionTh} onChange={e => setForm({...form, descriptionTh: e.target.value})} required />
              </div>
              <div>
                <label className="label">Description (English)</label>
                <textarea className="input-field h-32" value={form.descriptionEn} onChange={e => setForm({...form, descriptionEn: e.target.value})} required />
              </div>
              <div>
                <label className="label">ตัวชี้วัดการให้เหตุผล (บรรทัดละข้อ)</label>
                <textarea className="input-field h-24" value={form.reasoningIndicators} onChange={e => setForm({...form, reasoningIndicators: e.target.value})} placeholder="ข้อละบรรทัด" />
              </div>
              <div>
                <label className="label">{t.department}</label>
                <select className="input-field" value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})}>
                  <option value="">-- ทั่วไป --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{t.save}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">{t.cancel}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
