import React, { useState } from 'react';
import { Subject, ExamQuestion, QuestionProgress } from '../types';
import { motion } from 'motion/react';
import { 
  XCircle, 
  Trash2, 
  BookOpen, 
  Dna, 
  FlaskConical, 
  Activity, 
  CheckCircle,
  Play,
  RotateCcw,
  ArrowLeft,
  ArrowUpDown,
  Clock
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface WrongLogProps {
  progressList: QuestionProgress[];
  questions: ExamQuestion[];
  studentId: string;
  onStartWrongStudy: () => void;
  onBack: () => void;
  onUpdateProgress: (newProgress: QuestionProgress) => void;
}

export default function WrongLog({
  progressList,
  questions,
  studentId,
  onStartWrongStudy,
  onBack,
  onUpdateProgress
}: WrongLogProps) {
  const [selectedSubject, setSelectedSubject] = useState<Subject | 'all'>('all');
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'count' | 'recent'>('count');

  // Filter progress entries with wrongCount > 0
  const wrongProgressList = progressList.filter(p => p.wrongCount > 0);
  
  // Map progress to include actual questions
  const wrongEntries = wrongProgressList.map(prog => {
    const question = questions.find(q => q.id === prog.questionId);
    return {
      progress: prog,
      question
    };
  }).filter(entry => entry.question !== undefined) as { progress: QuestionProgress; question: ExamQuestion }[];

  // Filter entries by subject
  const filteredEntries = selectedSubject === 'all' 
    ? wrongEntries 
    : wrongEntries.filter(entry => entry.question.subject === selectedSubject);

  // Sort entries based on selection
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortBy === 'count') {
      return (b.progress.wrongCount || 0) - (a.progress.wrongCount || 0);
    } else {
      const dateA = new Date(a.progress.lastWrongTime || a.progress.lastReviewed || 0).getTime();
      const dateB = new Date(b.progress.lastWrongTime || b.progress.lastReviewed || 0).getTime();
      return dateB - dateA;
    }
  });

  const subjectNames: Record<Subject, string> = {
    biology: 'Βιολογία',
    biochemistry: 'Βιοχημεία',
    physics: 'Ιατρική Φυσική'
  };

  const subjectIcons: Record<Subject, React.ComponentType<any>> = {
    biology: Dna,
    biochemistry: FlaskConical,
    physics: Activity
  };

  const subjectColors: Record<Subject, string> = {
    biology: 'text-teal-700 border-teal-200 bg-teal-50',
    biochemistry: 'text-sky-700 border-sky-200 bg-sky-50',
    physics: 'text-amber-700 border-amber-200 bg-amber-50'
  };

  const formatGreekDate = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    
    const day = date.getDate();
    const months = [
      'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 
      'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  const handleResetProgress = async (questionId: string) => {
    if (resettingId) return;
    setResettingId(questionId);
    
    try {
      const existingProg = progressList.find(p => p.questionId === questionId);
      if (!existingProg) return;

      const updatedProgress: QuestionProgress = {
        ...existingProg,
        wrongCount: 0,
        state: 'new', // reset back to new
        interval: 1,
        nextReviewDate: new Date().toISOString()
      };

      const progressDocRef = doc(db, 'students', studentId, 'progress', questionId);
      await setDoc(progressDocRef, updatedProgress);
      onUpdateProgress(updatedProgress);
    } catch (err) {
      console.error("Error resetting wrong question progress: ", err);
    } finally {
      setResettingId(null);
    }
  };

  const optionLabels = ['α', 'β', 'γ', 'δ'];

  return (
    <div id="wrong-log-container" className="max-w-4xl mx-auto px-4 py-8 text-slate-700 font-sans">
      {/* Back Button and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-850 cursor-pointer transition-colors mb-2 font-bold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Επιστροφή στο Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <XCircle className="h-6 w-6 text-rose-500" />
            Αρχείο Λανθασμένων Απαντήσεων
          </h1>
          <p className="text-slate-500 text-sm mt-1 leading-relaxed">
            Εδώ βλέπετε τις ερωτήσεις που απαντήσατε λάθος, ώστε να εστιάσετε στη μελέτη τους.
          </p>
        </div>

        {wrongEntries.length > 0 && (
          <button
            onClick={onStartWrongStudy}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-rose-600/15 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            Μελέτη Λανθασμένων ({wrongEntries.length})
          </button>
        )}
      </div>

      {wrongEntries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Κανένα σφάλμα προς το παρόν!</h3>
          <p className="text-slate-500 text-xs mt-2 max-w-sm mx-auto leading-relaxed">
            Δεν υπάρχουν καταγεγραμμένες λανθασμένες απαντήσεις. Συνεχίστε την εξαιρετική δουλειά και την επανάληψη των μαθημάτων σας!
          </p>
          <button
            onClick={onBack}
            className="mt-6 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
          >
            Επιστροφή στο Dashboard
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filters and Sorting Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            {/* Subject Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Φίλτρο:</span>
              <button
                onClick={() => setSelectedSubject('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedSubject === 'all' 
                    ? 'bg-sky-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50 border border-transparent'
                }`}
              >
                Όλα ({wrongEntries.length})
              </button>
              {(['biology', 'biochemistry', 'physics'] as Subject[]).map(sub => {
                const count = wrongEntries.filter(e => e.question.subject === sub).length;
                return (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedSubject === sub 
                        ? 'bg-sky-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    {subjectNames[sub]} ({count})
                  </button>
                );
              })}
            </div>

            {/* Sorting buttons */}
            <div className="flex items-center gap-1.5 border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Ταξινόμηση:</span>
              <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200/60">
                <button
                  onClick={() => setSortBy('count')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    sortBy === 'count' 
                      ? 'bg-white text-slate-850 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Φορές Λάθους
                </button>
                <button
                  onClick={() => setSortBy('recent')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    sortBy === 'recent' 
                      ? 'bg-white text-slate-850 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Πρόσφατα
                </button>
              </div>
            </div>
          </div>

          {/* List of wrong questions */}
          <div className="space-y-4">
            {sortedEntries.map(({ progress, question }) => {
              const Icon = subjectIcons[question.subject];
              const colorClass = subjectColors[question.subject];
              const lastWrongDateStr = progress.lastWrongTime || progress.lastReviewed;

              return (
                <motion.div
                  key={question.id}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all shadow-sm"
                >
                  {/* Card top bar */}
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${colorClass}`}>
                        <Icon className="h-3 w-3" />
                        {subjectNames[question.subject]}
                      </span>
                      {lastWrongDateStr && (
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-300" />
                          {formatGreekDate(lastWrongDateStr)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-rose-700 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
                        {progress.wrongCount} {progress.wrongCount === 1 ? 'Λάθος' : 'Λάθη'}
                      </span>
                      <button
                        onClick={() => handleResetProgress(question.id)}
                        disabled={resettingId === question.id}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
                        title="Εκκαθάριση από τα λανθασμένα"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question Title */}
                  <h3 className="text-sm font-bold text-slate-850 leading-relaxed mb-4">
                    {question.text}
                  </h3>

                  {/* Question Options mini grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                    {question.options.map((option, index) => {
                      const isStudentWrongChoice = progress.lastWrongAnswerIndex !== undefined && index === progress.lastWrongAnswerIndex;
                      
                      return (
                        <div 
                          key={index} 
                          className={`p-2.5 rounded-lg border text-xs font-medium flex items-start gap-2 shadow-sm transition-all ${
                            isStudentWrongChoice 
                              ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold' 
                              : 'bg-slate-50/80 border-slate-100 text-slate-600'
                          }`}
                        >
                          <span className={`h-4.5 w-4.5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 ${
                            isStudentWrongChoice 
                              ? 'bg-rose-500 text-white border-transparent shadow-sm' 
                              : 'bg-white text-slate-400 border border-slate-200'
                          }`}>
                            {optionLabels[index]}
                          </span>
                          <div className="flex-1 flex flex-wrap items-center justify-between gap-1.5">
                            <span>{option.replace(/^[α-δ]\)\s*/, '')}</span>
                            {isStudentWrongChoice && (
                              <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ml-auto shrink-0">
                                Η επιλογή σας
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation sub-box */}
                  <div className="bg-sky-50/50 rounded-lg p-3.5 border border-sky-100 shadow-inner">
                    <h4 className="text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      Επεξήγηση
                    </h4>
                    <p className="text-xs text-slate-650 leading-relaxed font-medium">
                      {question.explanation}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
