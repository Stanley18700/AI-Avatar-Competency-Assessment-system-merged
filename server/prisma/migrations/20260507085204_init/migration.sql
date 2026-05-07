-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameTh" TEXT,
    "role" TEXT NOT NULL DEFAULT 'NURSE',
    "departmentId" TEXT,
    "experienceLevel" TEXT NOT NULL DEFAULT 'LEVEL_1',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyGroup" (
    "id" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "assessedByAI" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyCriteria" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardLevel" (
    "id" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "standardScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentClinicalIssue" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentClinicalIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleTh" TEXT,
    "descriptionTh" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "reasoningIndicators" TEXT NOT NULL DEFAULT '[]',
    "linkedCriteriaIds" TEXT NOT NULL DEFAULT '[]',
    "departmentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSession" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "rubricVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "encryptedText" TEXT,
    "audioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfScore" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIScore" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "criteriaScores" TEXT NOT NULL DEFAULT '[]',
    "categoryScores" TEXT,
    "weightedTotal" DOUBLE PRECISION,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "recommendations" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "rawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewerScore" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "criteriaScores" TEXT NOT NULL DEFAULT '[]',
    "feedbackText" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewerScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalScore" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "gap" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreVersionHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "previousValues" TEXT,
    "newValues" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreVersionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "pdfData" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualDevelopmentPlan" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "items" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndividualDevelopmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StandardLevel_experienceLevel_criteriaId_key" ON "StandardLevel"("experienceLevel", "criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_sessionId_key" ON "Transcript"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SelfScore_sessionId_criteriaId_key" ON "SelfScore"("sessionId", "criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "AIScore_sessionId_key" ON "AIScore"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerScore_sessionId_key" ON "ReviewerScore"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalScore_sessionId_criteriaId_key" ON "FinalScore"("sessionId", "criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_sessionId_key" ON "Report"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "IndividualDevelopmentPlan_sessionId_key" ON "IndividualDevelopmentPlan"("sessionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyCriteria" ADD CONSTRAINT "CompetencyCriteria_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CompetencyGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardLevel" ADD CONSTRAINT "StandardLevel_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "CompetencyCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentClinicalIssue" ADD CONSTRAINT "DepartmentClinicalIssue_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentClinicalIssue" ADD CONSTRAINT "DepartmentClinicalIssue_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "CompetencyCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfScore" ADD CONSTRAINT "SelfScore_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfScore" ADD CONSTRAINT "SelfScore_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "CompetencyCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIScore" ADD CONSTRAINT "AIScore_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerScore" ADD CONSTRAINT "ReviewerScore_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerScore" ADD CONSTRAINT "ReviewerScore_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalScore" ADD CONSTRAINT "FinalScore_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalScore" ADD CONSTRAINT "FinalScore_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "CompetencyCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreVersionHistory" ADD CONSTRAINT "ScoreVersionHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreVersionHistory" ADD CONSTRAINT "ScoreVersionHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualDevelopmentPlan" ADD CONSTRAINT "IndividualDevelopmentPlan_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
