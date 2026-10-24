import React, { useState, useEffect, useRef } from 'react';
import { Subject, ExamQuestion, QuestionProgress, StudentProfile } from '../types';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  X, 
  ChevronRight, 
  BookOpen, 
  AlertCircle, 
  RotateCcw, 
  CheckCircle2, 
  ArrowLeft,
  Award
} from 'lucide-react';

interface AnkiSessionProps {
  profile: StudentProfile;
  subject: Subject | 'mixed' | 'wrong';
  questions: ExamQuestion[];
  progressList: QuestionProgress[];
  onFinish: () => void;
  onUpdateProgress: (newProgress: QuestionProgress) => void;
}

export default function AnkiSession({
  profile,
  subject,
  questions,
  progressList,
  onFinish,
  onUpdateProgress
}: AnkiSessionProps) {
  const [sessionQuestions, setSessionQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Stats for current session
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [wrongAnswersCount, setWrongAnswersCount] = useState(0);

  // Keep progressList in a ref to prevent re-initializing session questions when progress updates
  const progressListRef = useRef<QuestionProgress[]>(progressList);
  useEffect(() => {
    progressListRef.current = progressList;
  }, [progressList]);

  // Initialize session questions
  useEffect(() => {
    let filtered = [...questions];

    // Filter by subject
    if (subject !== 'mixed' && subject !== 'wrong') {
      filtered = filtered.filter(q => q.subject === subject);
    } else if (subject === 'wrong') {
      // Study only wrong questions
      const wrongIds = new Set(
        progressListRef.current.filter(p => p.wrongCount > 0).map(p => p.questionId)
      );
      filtered = filtered.filter(q => wrongIds.has(q.id));
    }

    // Sort to show due questions first, then new questions, then others
    const now = new Date();
    const progressMap = new Map<string, QuestionProgress>(
      progressListRef.current.map(p => [p.questionId, p])
    );

    filtered.sort((a, b) => {
      const progA = progressMap.get(a.id);
      const progB = progressMap.get(b.id);

      const dueA = progA ? new Date(progA.nextReviewDate) <= now : true;
      const dueB = progB ? new Date(progB.nextReviewDate) <= now : true;

      // Unstudied (New) or Due questions first
      if (dueA && !dueB) return -1;
      if (!dueA && dueB) return 1;

      // Shuffled slightly or order by ID
      return a.id.localeCompare(b.id);
    });

    // Limit to 10 questions per active session for Anki focus
    setSessionQuestions(filtered.slice(0, 10));
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setSessionCompleted(false);
    setCorrectAnswersCount(0);
    setWrongAnswersCount(0);
  }, [subject, questions]);

  const currentQuestion = sessionQuestions[currentIndex];

  const handleOptionSelect = (optionIndex: number) => {
    if (answered) return;
    setSelectedOption(optionIndex);
    const correct = optionIndex === currentQuestion.correctOptionIndex;
    setIsCorrect(correct);
    setAnswered(true);

    if (correct) {
      setCorrectAnswersCount(prev => prev + 1);
    } else {
      setWrongAnswersCount(prev => prev + 1);
    }
  };

  const handleAnkiRate = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (saving || !currentQuestion) return;
    setSaving(true);

    try {
      // Find existing progress or set default
      const existingProg = progressList.find(p => p.questionId === currentQuestion.id);
      
      let state: 'new' | 'learning' | 'review' = existingProg?.state || 'new';
      let ease = existingProg?.ease || 2.5;
      let interval = existingProg?.interval || 1;
      let wrongCount = existingProg?.wrongCount || 0;
      let correctCount = existingProg?.correctCount || 0;
      let lastWrongAnswerIndex = existingProg?.lastWrongAnswerIndex;
      let lastWrongTime = existingProg?.lastWrongTime;

      if (!isCorrect) {
        wrongCount += 1;
        state = 'learning';
        interval = 1; // repeat tomorrow/soon
        ease = Math.max(1.3, ease - 0.2); // reduce ease
        if (selectedOption !== null) {
          lastWrongAnswerIndex = selectedOption;
        }
        lastWrongTime = new Date().toISOString();
      } else {
        correctCount += 1;
        // Schedule based on rating
        if (rating === 'again') {
          state = 'learning';
          interval = 1;
          ease = Math.max(1.3, ease - 0.15);
        } else if (rating === 'hard') {
          state = 'learning';
          interval = Math.max(1, Math.round(interval * 1.2));
          ease = Math.max(1.3, ease - 0.1);
        } else if (rating === 'good') {
          state = 'review';
          interval = Math.round(interval * ease);
          // If first study session, set standard 3 days
          if (interval <= 1) interval = 3;
        } else if (rating === 'easy') {
          state = 'review';
          ease = ease + 0.15;
          interval = Math.round(interval * ease * 1.3);
          // If first study session, set standard 5 days
          if (interval <= 1) interval = 5;
        }
      }

      // Calculate next review date
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + interval);

      const updatedProgress: QuestionProgress = {
        questionId: currentQuestion.id,
        studentId: profile.uid,
        subject: currentQuestion.subject,
        state,
        ease,
        interval,
        nextReviewDate: nextReview.toISOString(),
        lastReviewed: new Date().toISOString(),
        wrongCount,
        correctCount,
        ...(lastWrongAnswerIndex !== undefined ? { lastWrongAnswerIndex } : {}),
        ...(lastWrongTime !== undefined ? { lastWrongTime } : {})
      };

      // Write progress to Firestore or localStorage
      if (profile.uid.startsWith('local-demo-')) {
        const localProgressStr = localStorage.getItem(`progress_${profile.uid}`);
        let localProgress: QuestionProgress[] = localProgressStr ? JSON.parse(localProgressStr) : [];
        localProgress = localProgress.filter(p => p.questionId !== currentQuestion.id);
        localProgress.push(updatedProgress);
        localStorage.setItem(`progress_${profile.uid}`, JSON.stringify(localProgress));
      } else {
        const progressDocRef = doc(db, 'students', profile.uid, 'progress', currentQuestion.id);
        await setDoc(progressDocRef, updatedProgress);
      }
      onUpdateProgress(updatedProgress);

      // Advance to next question or complete session
      if (currentIndex < sessionQuestions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setAnswered(false);
      } else {
        setSessionCompleted(true);
      }
    } catch (err) {
      console.error("Error saving Anki progress: ", err);
    } finally {
      setSaving(false);
    }
  };

  if (sessionQuestions.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center font-sans">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-sky-50 text-sky-600 mb-6 border border-sky-100 shadow-sm"
        >
          <CheckCircle2 className="h-8 w-8" />
        </motion.div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Όλα έτοιμα!</h2>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          {subject === 'wrong' 
            ? 'Δεν έχετε καταγεγραμμένες λανθασμένες απαντήσεις για μελέτη. Συγχαρητήρια!'
            : 'Δεν υπάρχουν ερωτήσεις για επανάληψη αυτή τη στιγμή. Μπορείτε να επιστρέψετε αργότερα ή να επιλέξετε άλλο μάθημα!'}
        </p>
        <button
          onClick={onFinish}
          className="mt-6 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-sm"
        >
          Επιστροφή στην Αρχική
        </button>
      </div>
    );
  }

  if (sessionCompleted) {
    const successRate = Math.round((correctAnswersCount / sessionQuestions.length) * 100);
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center font-sans">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 mb-6 border border-emerald-100 shadow-sm"
        >
          <Award className="h-8 w-8" />
        </motion.div>
        
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Ολοκλήρωση Μελέτης!</h2>
        <p className="text-slate-500 text-sm mt-1">
          Συγχαρητήρια, ολοκληρώσατε την επανάληψη {sessionQuestions.length} καρτών.
        </p>

        {/* Mini scorecard */}
        <div className="grid grid-cols-3 gap-3 my-8">
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm">
            <span className="block text-xl font-bold text-emerald-600">{correctAnswersCount}</span>
            <span className="text-xs text-slate-400 font-semibold">Σωστές</span>
          </div>
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm">
            <span className="block text-xl font-bold text-rose-600">{wrongAnswersCount}</span>
            <span className="text-xs text-slate-400 font-semibold">Λάθος</span>
          </div>
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm">
            <span className="block text-xl font-bold text-sky-600">{successRate}%</span>
            <span className="text-xs text-slate-400 font-semibold">Ακρίβεια</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              // Reload session
              setSessionCompleted(false);
              setCurrentIndex(0);
              setSelectedOption(null);
              setAnswered(false);
              setCorrectAnswersCount(0);
              setWrongAnswersCount(0);
            }}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-extrabold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <RotateCcw className="h-4 w-4" />
            Μελέτη Ξανά
          </button>
          <button
            onClick={onFinish}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-750 font-semibold text-sm rounded-xl transition-all cursor-pointer"
          >
            Επιστροφή στην Αρχική
          </button>
        </div>
      </div>
    );
  }

  const subjectNames: Record<Subject, string> = {
    biology: 'Βιολογία',
    biochemistry: 'Βιοχημεία',
    physics: 'Ιατρική Φυσική'
  };

  const optionLabels = ['α', 'β', 'γ', 'δ'];

  return (
    <div id="anki-session" className="max-w-2xl mx-auto px-4 py-8 font-sans">
      {/* Session Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onFinish}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-850 cursor-pointer transition-colors font-bold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Επιστροφή
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-600 shadow-sm">
            {subjectNames[currentQuestion.subject]}
          </span>
          <span className="text-xs text-slate-400 font-bold">
            {currentIndex + 1} / {sessionQuestions.length}
          </span>
        </div>
      </div>

      {/* Progress line */}
      <div className="w-full bg-slate-100 h-1.5 rounded-full mb-8 overflow-hidden border border-slate-200 shadow-inner">
        <div 
          className="bg-amber-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + (answered ? 1 : 0)) / sessionQuestions.length) * 100}%` }}
        />
      </div>

      {/* Card Body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -30, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-xl text-slate-900"
        >
          {/* Question Text */}
          <h3 className="text-lg md:text-xl font-bold text-slate-850 leading-relaxed mb-8">
            {currentQuestion.text}
          </h3>

          {/* Question illustration if chaperone question */}
          {currentQuestion.id === 'bio_q3' && (
            <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center shadow-inner">
              <div className="w-full max-w-sm flex flex-col gap-2 items-center text-center">
                <div className="relative w-full h-24 bg-white rounded-lg flex items-center justify-center border border-slate-200 overflow-hidden shadow-sm">
                  <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:16px_16px]" />
                  {/* Styled chaperone illustration using clean CSS shapes */}
                  <div className="flex gap-4 items-center relative z-10">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-12 h-10 rounded-xl bg-sky-50 border-2 border-sky-300 flex items-center justify-center text-[10px] text-sky-700 font-bold px-1 text-center shadow-sm">
                        Chaperone
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold">Συνοδός</span>
                    </div>
                    <div className="text-sky-500 text-lg font-bold animate-pulse">&rarr;</div>
                    <div className="flex flex-col items-center">
                      <svg className="w-10 h-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 3a9 9 0 0 1 9 9c0 5-4 9-9 9s-9-4-9-9 4-9 9-9z" />
                        <path d="M12 8v8M8 12h8" />
                      </svg>
                      <span className="text-[9px] text-slate-400 font-bold mt-1">Αναδιπλωμένη Πρωτεΐνη</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-450 italic font-medium">Σχηματική αναπαράσταση ορθής αναδίπλωσης παρουσία πρωτεΐνης-συνοδού (Chaperone)</span>
              </div>
            </div>
          )}

          {/* Multiple Choice Options */}
          {currentQuestion.imageUrl && (
            <div className="mb-6 p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center overflow-hidden shadow-inner max-w-full">
              <img 
                src={currentQuestion.imageUrl} 
                alt="Σχήμα Ερώτησης" 
                className="max-h-64 object-contain rounded-lg border border-slate-200 bg-white shadow-sm" 
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const optionNumber = optionLabels[index];
              const isSelected = selectedOption === index;
              const isCorrectOption = index === currentQuestion.correctOptionIndex;
              
              let optionStyle = "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:border-sky-500 hover:text-slate-900";
              
              if (answered) {
                if (isCorrectOption) {
                  optionStyle = "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm";
                } else if (isSelected) {
                  optionStyle = "border-rose-300 bg-rose-50 text-rose-800 shadow-sm";
                } else {
                  optionStyle = "border-slate-100 bg-slate-50/50 text-slate-400 opacity-60";
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(index)}
                  disabled={answered}
                  className={`w-full text-left p-4 rounded-xl border font-medium text-sm transition-all flex items-start gap-3 cursor-pointer shadow-sm ${optionStyle}`}
                >
                  <span className={`h-5 w-5 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                    answered && isCorrectOption
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : answered && isSelected
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}>
                    {optionNumber}
                  </span>
                  <div className="flex-1">{option.replace(/^[α-δ]\)\s*/, '')}</div>
                  
                  {answered && isCorrectOption && (
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 self-center" />
                  )}
                  {answered && isSelected && !isCorrectOption && (
                    <X className="h-4 w-4 text-rose-600 shrink-0 self-center" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation Section */}
          <AnimatePresence>
            {answered && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="mt-6 pt-6 border-t border-slate-200"
              >
                {/* Dr. Gatoni's instant clinical feedback! */}
                <div className={`mb-4 p-3.5 rounded-xl border flex gap-3 items-center ${
                  isCorrect 
                    ? 'bg-emerald-50/80 border-emerald-150 text-emerald-950' 
                    : 'bg-amber-50/80 border-amber-150 text-amber-950'
                }`}>
                  <span className="text-2xl shrink-0">{isCorrect ? '😻' : '😾'}</span>
                  <div className="text-xs font-medium">
                    <strong className="block font-bold mb-0.5 text-[11px] uppercase tracking-wider">
                      {isCorrect ? 'Γνωμάτευση: ΣΩΣΤΟ! 🎉' : 'Γνωμάτευση: ΛΑΘΟΣ! 🐾'}
                    </strong>
                    {isCorrect ? (
                      <span><strong>Dr. Gatoni:</strong> «Νιάου! Το μυαλό σου δουλεύει σαν καλοκουρδισμένο γατόνι! Συνέχισε έτσι!»</span>
                    ) : (
                      <span><strong>Dr. Gatoni:</strong> «Μια μικρή γρατζουνιά στην πορεία! Ακόμη και τα πιο έξυπνα γατόνια γλιστρούν στα κεραμίδια. Μάθε από αυτό!»</span>
                    )}
                  </div>
                </div>

                <div className="bg-amber-50/30 rounded-xl p-4 border border-amber-100 mb-6 shadow-sm">
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    Επεξήγηση Απάντησης
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {currentQuestion.explanation}
                  </p>
                </div>

                {/* Rating selection - Anki algorithm */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">
                    {!isCorrect ? 'Παρουσιάστηκε λάθος. Η κάρτα θα επαναληφθεί σύντομα:' : 'Πώς κρίνετε αυτή την ερώτηση;'}
                  </h4>

                  <div className="flex justify-center gap-2">
                    {!isCorrect ? (
                      // If wrong, they must click Again
                      <button
                        onClick={() => handleAnkiRate('again')}
                        disabled={saving}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-500/10"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Ξανά (Repeat)
                      </button>
                    ) : (
                      // If correct, they choose rating
                      <div className="grid grid-cols-3 gap-2 w-full max-w-md">
                        <button
                          onClick={() => handleAnkiRate('hard')}
                          disabled={saving}
                          className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 hover:text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          Δύσκολο
                          <span className="block text-[9px] text-slate-400 font-semibold mt-0.5">Επανάληψη: 1ημ</span>
                        </button>
                        <button
                          onClick={() => handleAnkiRate('good')}
                          disabled={saving}
                          className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                        >
                          Καλό
                          <span className="block text-[9px] text-slate-900/80 font-semibold mt-0.5">Επανάληψη: 3ημ</span>
                        </button>
                        <button
                          onClick={() => handleAnkiRate('easy')}
                          disabled={saving}
                          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                        >
                          Εύκολο
                          <span className="block text-[9px] text-white/80 font-medium mt-0.5">Επανάληψη: 5ημ</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
