import React, { useState, useEffect, useRef } from 'react';
import { Subject, ExamQuestion, QuestionProgress, StudentProfile } from '../types';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { 
  Award, 
  Clock, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  X, 
  Check, 
  BookOpen 
} from 'lucide-react';

interface MockExamProps {
  profile: StudentProfile;
  questions: ExamQuestion[];
  progressList: QuestionProgress[];
  onFinish: () => void;
  onUpdateProgress: (newProgress: QuestionProgress) => void;
  preselectedQuestions?: ExamQuestion[];
  examTitle?: string;
}

export default function MockExam({
  profile,
  questions,
  progressList,
  onFinish,
  onUpdateProgress,
  preselectedQuestions,
  examTitle
}: MockExamProps) {
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({}); // questionId -> selectedOptionIndex
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and select questions for exam
  useEffect(() => {
    let selected: ExamQuestion[] = [];

    if (preselectedQuestions && preselectedQuestions.length > 0) {
      selected = [...preselectedQuestions];
    } else {
      // Pick a balanced set of 10 questions:
      // Try to get 4 biology, 3 biochemistry, 3 physics. If not enough, pick what is available.
      const bioQ = questions.filter(q => q.subject === 'biology');
      const biochemQ = questions.filter(q => q.subject === 'biochemistry');
      const physicsQ = questions.filter(q => q.subject === 'physics');

      const shuffledBio = [...bioQ].sort(() => 0.5 - Math.random());
      const shuffledBiochem = [...biochemQ].sort(() => 0.5 - Math.random());
      const shuffledPhysics = [...physicsQ].sort(() => 0.5 - Math.random());

      selected = [
        ...shuffledBio.slice(0, 4),
        ...shuffledBiochem.slice(0, 3),
        ...shuffledPhysics.slice(0, 3)
      ];

      // If still less than 10, fill with remaining questions
      if (selected.length < 10) {
        const selectedIds = new Set(selected.map(q => q.id));
        const remaining = questions.filter(q => !selectedIds.has(q.id));
        const shuffledRemaining = [...remaining].sort(() => 0.5 - Math.random());
        selected.push(...shuffledRemaining.slice(0, 10 - selected.length));
      }
      selected = selected.slice(0, 10);
    }

    setExamQuestions(selected);
    setAnswers({});
    setCurrentIdx(0);
    setTimeRemaining(selected.length * 60); // 60 seconds per question
    setExamSubmitted(false);

    // Start countdown
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto submit
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [questions, preselectedQuestions]);

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (examSubmitted) return;
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionIdx
    }));
  };

  const handleSubmitExam = async () => {
    if (examSubmitted) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setExamSubmitted(true);
    setSaving(true);

    // Save results to Firestore as student progress
    try {
      const now = new Date();
      for (const q of examQuestions) {
        const selectedIdx = answers[q.id];
        if (selectedIdx === undefined) continue; // skipped question

        const isCorrect = selectedIdx === q.correctOptionIndex;
        const existingProg = progressList.find(p => p.questionId === q.id);

        let state: 'new' | 'learning' | 'review' = existingProg?.state || 'new';
        let ease = existingProg?.ease || 2.5;
        let interval = existingProg?.interval || 1;
        let wrongCount = existingProg?.wrongCount || 0;
        let correctCount = existingProg?.correctCount || 0;
        let lastWrongAnswerIndex = existingProg?.lastWrongAnswerIndex;
        let lastWrongTime = existingProg?.lastWrongTime;

        if (isCorrect) {
          correctCount += 1;
          state = 'review';
          interval = existingProg ? Math.round(interval * ease) : 3;
        } else {
          wrongCount += 1;
          state = 'learning';
          interval = 1;
          ease = Math.max(1.3, ease - 0.25);
          lastWrongAnswerIndex = selectedIdx;
          lastWrongTime = now.toISOString();
        }

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);

        const updated: QuestionProgress = {
          questionId: q.id,
          studentId: profile.uid,
          subject: q.subject,
          state,
          ease,
          interval,
          nextReviewDate: nextReview.toISOString(),
          lastReviewed: now.toISOString(),
          wrongCount,
          correctCount,
          ...(lastWrongAnswerIndex !== undefined ? { lastWrongAnswerIndex } : {}),
          ...(lastWrongTime !== undefined ? { lastWrongTime } : {})
        };

        if (profile.uid.startsWith('local-demo-')) {
          const localProgressStr = localStorage.getItem(`progress_${profile.uid}`);
          let localProgress: QuestionProgress[] = localProgressStr ? JSON.parse(localProgressStr) : [];
          localProgress = localProgress.filter(p => p.questionId !== q.id);
          localProgress.push(updated);
          localStorage.setItem(`progress_${profile.uid}`, JSON.stringify(localProgress));
        } else {
          const progressDocRef = doc(db, 'students', profile.uid, 'progress', q.id);
          await setDoc(progressDocRef, updated);
        }
        onUpdateProgress(updated);
      }
    } catch (err) {
      console.error("Error writing exam results progress: ", err);
    } finally {
      setSaving(false);
    }
  };

  // Timer format Helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (examQuestions.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center text-slate-500 font-sans">
        <Clock className="h-10 w-10 text-sky-600 mx-auto animate-spin mb-4" />
        <p className="text-sm font-semibold">Προετοιμασία διαγωνίσματος...</p>
      </div>
    );
  }

  const currentQ = examQuestions[currentIdx];
  const selectedAns = answers[currentQ.id];
  const optionLabels = ['α', 'β', 'γ', 'δ'];

  // Score Calculations
  const totalAnswered = Object.keys(answers).length;
  let correctScore = 0;
  examQuestions.forEach(q => {
    if (answers[q.id] === q.correctOptionIndex) correctScore++;
  });

  return (
    <div id="mock-exam-container" className="max-w-3xl mx-auto px-4 py-8 text-slate-700 font-sans">
      {/* Timer / Progress Bar */}
      <div className="flex items-center justify-between gap-4 mb-6 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
        <button
          onClick={onFinish}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-850 cursor-pointer transition-colors font-bold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Έξοδος
        </button>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 font-bold">
            Ερώτηση {currentIdx + 1} από {examQuestions.length}
          </span>
          {!examSubmitted && (
            <div className="flex items-center gap-1.5 text-sky-700 font-mono text-sm bg-sky-50 border border-sky-100 px-3 py-1 rounded-lg shadow-inner font-bold animate-pulse">
              <Clock className="h-4 w-4" />
              {formatTime(timeRemaining)}
            </div>
          )}
        </div>
      </div>

      {!examSubmitted ? (
        // ACTIVE EXAM VIEW
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold tracking-wider uppercase bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full border border-sky-100">
              {currentQ.subject === 'biology' ? 'Βιολογία' : currentQ.subject === 'biochemistry' ? 'Βιοχημεία' : 'Ιατρική Φυσική'}
            </span>
          </div>

          <h3 className="text-lg font-bold text-slate-900 leading-relaxed mb-6">
            {currentQ.text}
          </h3>

          {currentQ.imageUrl && (
            <div className="mb-6 p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center overflow-hidden shadow-inner max-w-full">
              <img 
                src={currentQ.imageUrl} 
                alt="Σχήμα Ερώτησης" 
                className="max-h-64 object-contain rounded-lg border border-slate-200 bg-white shadow-sm" 
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div className="space-y-3 mb-8">
            {currentQ.options.map((option, index) => {
              const label = optionLabels[index];
              const isSelected = selectedAns === index;

              return (
                <button
                  key={index}
                  onClick={() => handleSelectOption(currentQ.id, index)}
                  className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all flex items-start gap-3 cursor-pointer shadow-sm ${
                    isSelected 
                      ? 'border-sky-500 bg-sky-50/70 text-sky-800 font-semibold shadow-inner' 
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className={`h-5 w-5 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                    isSelected 
                      ? 'bg-sky-600 text-white shadow-sm' 
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}>
                    {label}
                  </span>
                  <div>{option.replace(/^[α-δ]\)\s*/, '')}</div>
                </button>
              );
            })}
          </div>

          {/* Exam Navigation Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            <button
              onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-40 transition-all cursor-pointer shadow-sm"
            >
              Προηγούμενη
            </button>

            {currentIdx < examQuestions.length - 1 ? (
              <button
                onClick={() => setCurrentIdx(prev => Math.min(examQuestions.length - 1, prev + 1))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm"
              >
                Επόμενη
              </button>
            ) : (
              <button
                onClick={handleSubmitExam}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-505 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-lg shadow-sky-600/10"
              >
                Υποβολή Διαγωνίσματος
              </button>
            )}
          </div>

          {/* Questions Grid Selector */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Επισκόπηση Ερωτήσεων</h4>
            <div className="flex flex-wrap gap-2">
              {examQuestions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-8 w-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center border cursor-pointer ${
                      currentIdx === idx 
                        ? 'border-sky-500 bg-sky-50 text-sky-600 shadow-sm' 
                        : isAnswered 
                        ? 'border-slate-200 bg-slate-100 text-slate-750 shadow-sm font-bold' 
                        : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // EXAM SCORE / RESULTS VIEW
        <div className="space-y-6">
          {/* Main scoreboard card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 text-center shadow-md">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 mb-4 border border-emerald-100 shadow-sm">
              <Award className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {examTitle ? `Αποτελέσματα: ${examTitle}` : 'Αποτελέσματα Διαγωνίσματος'}
            </h2>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">Η βαθμολογία σας καταγράφηκε και οι ερωτήσεις ενημέρωσαν το σύστημα έξυπνης επανάληψης.</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-8 max-w-lg mx-auto">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="block text-2xl font-bold text-slate-900">{correctScore} / {examQuestions.length}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Βαθμός</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="block text-2xl font-bold text-emerald-600">
                  {examQuestions.length > 0 ? Math.round((correctScore / examQuestions.length) * 100) : 0}%
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Ακρίβεια</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="block text-2xl font-bold text-sky-600">{totalAnswered} / {examQuestions.length}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Απαντήθηκαν</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="block text-2xl font-bold text-slate-700">
                  {formatTime((examQuestions.length * 60) - timeRemaining)}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Χρόνος</span>
              </div>
            </div>

            <button
              onClick={onFinish}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Επιστροφή στο Dashboard
            </button>
          </div>

          {/* Exam Details Question review list */}
          <h3 className="text-lg font-bold text-slate-900 tracking-tight pt-4">Λεπτομερής Ανασκόπηση</h3>
          
          <div className="space-y-4">
            {examQuestions.map((q, idx) => {
              const selectedIdx = answers[q.id];
              const isCorrect = selectedIdx === q.correctOptionIndex;
              const skipped = selectedIdx === undefined;

              return (
                <div key={q.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <span className="text-xs font-bold text-slate-400 font-mono">Ερώτηση {idx + 1}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      skipped 
                        ? 'bg-slate-50 text-slate-400 border-slate-200' 
                        : isCorrect 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {skipped ? 'Παραλείφθηκε' : isCorrect ? 'Σωστό' : 'Λάθος'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-850 leading-relaxed mb-4">{q.text}</h4>

                  {q.imageUrl && (
                    <div className="mb-4 p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center overflow-hidden shadow-inner max-w-full">
                      <img 
                        src={q.imageUrl} 
                        alt="Σχήμα Ερώτησης" 
                        className="max-h-48 object-contain rounded-lg border border-slate-200 bg-white shadow-sm" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {/* Question Options mini grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {q.options.map((option, oIdx) => {
                      const isCorrectOpt = oIdx === q.correctOptionIndex;
                      const isSelectedOpt = oIdx === selectedIdx;

                      let optStyle = "border-slate-100 bg-slate-50/50 text-slate-400 opacity-60";
                      if (isCorrectOpt) {
                        optStyle = "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm";
                      } else if (isSelectedOpt) {
                        optStyle = "border-rose-200 bg-rose-50 text-rose-800 shadow-sm";
                      }

                      return (
                        <div key={oIdx} className={`p-2.5 rounded-lg border text-xs font-medium flex items-start gap-2 ${optStyle}`}>
                          <span className={`h-4.5 w-4.5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 ${
                            isCorrectOpt 
                              ? 'bg-emerald-500 text-white shadow-sm' 
                              : isSelectedOpt 
                              ? 'bg-rose-500 text-white shadow-sm' 
                              : 'bg-white text-slate-400 border border-slate-200'
                          }`}>
                            {optionLabels[oIdx]}
                          </span>
                          <span>{option.replace(/^[α-δ]\)\s*/, '')}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-sky-50/50 rounded-lg p-3.5 border border-sky-100 shadow-inner">
                    <h5 className="text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      Επεξήγηση
                    </h5>
                    <p className="text-xs text-slate-650 leading-relaxed font-medium">
                      {q.explanation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
