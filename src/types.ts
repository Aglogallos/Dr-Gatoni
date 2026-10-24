export type Subject = 'biology' | 'biochemistry' | 'physics';

export interface StudentProfile {
  uid: string;
  name: string;
  email: string;
  role: 'student' | 'instructor';
  createdAt: string;
  lastSignInAt?: string;
  lastActiveAt?: string;
  currentSessionId?: string;
  totalStudyMinutes?: number;
  adminNotes?: string;
  subscriptionPaymentDate?: string;
  subscriptionDuration?: string;
  subscriptionExpiresAt?: string;
  inactive?: boolean;
  passwordPlain?: string;
}

export interface ExamQuestion {
  id: string;
  subject: Subject;
  chapterId?: string;
  unitId?: string;
  text: string;
  options: string[]; // typically 4 options: a, b, g, d
  correctOptionIndex: number; // 0 to 3
  explanation: string;
  imageUrl?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface QuestionProgress {
  questionId: string;
  studentId: string;
  subject: Subject;
  state: 'new' | 'learning' | 'review';
  ease: number; // default 2.5
  interval: number; // in days
  nextReviewDate: string; // ISO date string
  lastReviewed?: string; // ISO date string
  wrongCount: number;
  correctCount: number;
  lastWrongAnswerIndex?: number;
  lastWrongTime?: string;
}

export interface AnswerLog {
  questionId: string;
  selectedOptionIndex: number;
  isCorrect: boolean;
  timestamp: string;
}
