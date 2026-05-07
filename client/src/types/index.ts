export interface User {
  id: string;
  email: string;
  name: string;
  nameTh?: string;
  role: 'ADMIN' | 'NURSE' | 'REVIEWER';
  department?: Department;
  departmentId?: string;
  experienceLevel: ExperienceLevel;
  active?: boolean;
  createdAt?: string;
}

export type ExperienceLevel = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5';

export interface Department {
  id: string;
  name: string;
  nameTh: string;
  active: boolean;
  clinicalIssues?: DepartmentClinicalIssue[];
}

export interface DepartmentClinicalIssue {
  id: string;
  departmentId: string;
  criteriaId: string;
  nameTh: string;
  nameEn: string;
  description?: string;
}

export interface CompetencyGroup {
  id: string;
  nameTh: string;
  nameEn: string;
  type: 'CORE' | 'FUNCTIONAL' | 'SPECIFIC' | 'MANAGERIAL';
  assessedByAI: boolean;
  sortOrder: number;
  criteria: CompetencyCriteria[];
}

export interface CompetencyCriteria {
  id: string;
  groupId: string;
  nameTh: string;
  nameEn: string;
  description?: string;
  sortOrder: number;
  standardLevels?: StandardLevel[];
  group?: CompetencyGroup;
}

export interface StandardLevel {
  id: string;
  experienceLevel: ExperienceLevel;
  criteriaId: string;
  standardScore: number;
}

export interface Case {
  id: string;
  title: string;
  titleTh?: string;
  descriptionTh: string;
  descriptionEn: string;
  reasoningIndicators: string[];
  linkedCriteriaIds: string[];
  departmentId?: string;
  department?: Department;
  active: boolean;
}

export interface AssessmentSession {
  id: string;
  nurseId: string;
  caseId: string;
  experienceLevel: ExperienceLevel;
  status: AssessmentStatus;
  createdAt: string;
  updatedAt: string;
  nurse?: User;
  case?: Case;
  transcript?: Transcript;
  selfScores?: SelfScore[];
  aiScore?: AIScore;
  reviewerScore?: ReviewerScore;
  finalScores?: FinalScore[];
  versionHistory?: ScoreVersionHistory[];
  standardLevels?: StandardLevel[];
}

export type AssessmentStatus = 'IN_PROGRESS' | 'SELF_ASSESSED' | 'AI_SCORED' | 'AI_FAILED' | 'REVIEWED' | 'APPROVED';

export interface Transcript {
  id: string;
  sessionId: string;
  inputType: 'VOICE' | 'TEXT';
  rawText: string;
  audioUrl?: string;
}

export interface SelfScore {
  id: string;
  sessionId: string;
  criteriaId: string;
  criteria?: CompetencyCriteria;
  score: number;
}

export interface AIScore {
  id: string;
  sessionId: string;
  criteriaScores: CriteriaScore[];
  categoryScores?: CategoryScore[];
  weightedTotal?: number;
  strengths?: string;
  weaknesses?: string;
  recommendations?: string;
  confidenceScore?: number;
  valid: boolean;
  retryCount?: number;
  rawResponse?: string;
}

export interface CriteriaScore {
  criteriaId: string;
  score: number;
  reasoning?: string;
}

export interface CategoryScore {
  groupId: string;
  averageScore: number;
}

export interface ReviewerScore {
  id: string;
  sessionId: string;
  reviewerId: string;
  criteriaScores: CriteriaScore[];
  feedbackText?: string;
  approved: boolean;
  reviewer?: User;
}

export interface FinalScore {
  id: string;
  sessionId: string;
  criteriaId: string;
  criteria?: CompetencyCriteria;
  score: number;
  gap: number;
  source: 'AI' | 'REVIEWER';
}

export interface ScoreVersionHistory {
  id: string;
  sessionId: string;
  changedById: string;
  changedBy?: { name: string; nameTh?: string };
  changeType: string;
  previousValues?: any;
  newValues: any;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalAssessments: number;
  aiScoredAssessments: number;
  completedAssessments: number;
  aiFailedAssessments: number;
  approvedAssessments: number;
  totalNurses: number;
  totalCases: number;
  totalVoiceAssessments: number;
  avgAIWeightedTotal: number;
  avgAIConfidence: number;
}

export interface CompetencyByCategory {
  groupId: string;
  nameTh: string;
  nameEn: string;
  averageScore: number;
  count: number;
}

export interface WeaknessData {
  criteriaId: string;
  nameTh: string;
  nameEn: string;
  groupNameTh: string;
  averageGap: number;
  count: number;
}

export interface TrendData {
  month: string;
  averageScore: number;
  count: number;
}

export interface DepartmentAnalytics {
  departmentId: string;
  name: string;
  nameTh: string;
  assessmentCount: number;
  averageScore: number;
  averageGap: number;
}

// IDP - Individual Development Plan (per Nursing Council Standards)
export interface IDPItem {
  criteriaId: string;
  criteriaNameTh: string;
  criteriaNameEn: string;
  groupNameTh: string;
  groupType: string;
  standardLevel: number;
  score: number;
  gap: number;
  trainingCourse: boolean;
  shortTermTraining: boolean;
  inHouseTraining: boolean;
  coaching: boolean;
  onTheJob: boolean;
  projectAssignment: boolean;
  selfLearning: boolean;
  otherMethod: string;
  coordinator: string;
}

export interface IndividualDevelopmentPlan {
  id: string | null;
  sessionId: string;
  items: IDPItem[];
  notes: string | null;
  session: {
    id: string;
    status: string;
    experienceLevel: string;
    nurseName: string;
    department: string;
    assessmentDate: string;
    caseTitle: string;
  };
}
