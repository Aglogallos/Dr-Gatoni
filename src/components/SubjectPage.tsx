import React, { useState, useEffect } from 'react';
import { Subject, ExamQuestion, QuestionProgress, StudentProfile } from '../types';
import { CURRICULUM } from '../data/curriculum';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Play, 
  CheckSquare, 
  Square, 
  ChevronDown, 
  ChevronUp,
  BookOpen, 
  GraduationCap, 
  AlertCircle, 
  Sparkles, 
  Image, 
  FileText,
  BookmarkCheck,
  Check,
  X,
  PlayCircle
} from 'lucide-react';

interface SubjectPageProps {
  subject: Subject;
  questions: ExamQuestion[];
  progressList: QuestionProgress[];
  profile: StudentProfile;
  completedTheoryUnits: string[];
  onToggleTheoryUnit: (unitId: string, subject: Subject) => void;
  onBack: () => void;
  onStartCustomQuiz: (filteredQuestions: ExamQuestion[], customTitle: string) => void;
  initialReadingUnitId?: string | null;
  onUnitRead?: (unitId: string, subject: Subject) => void;
}

export default function SubjectPage({
  subject,
  questions,
  progressList,
  profile,
  completedTheoryUnits,
  onToggleTheoryUnit,
  onBack,
  onStartCustomQuiz,
  initialReadingUnitId = null,
  onUnitRead
}: SubjectPageProps) {
  const cur = CURRICULUM[subject];
  
  // States for checkbox selection of chapters/units for custom test scope
  const [selectedUnits, setSelectedUnits] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (cur) {
      cur.chapters.forEach(ch => {
        ch.units.forEach(un => {
          initial[un.id] = true; // Select all by default
        });
      });
    }
    return initial;
  });

  // State for expanded chapters in the theory accordion column
  const [expandedTheoryChapters, setExpandedTheoryChapters] = useState<Record<string, boolean>>(() => {
    // If there is an initial reading unit, expand its parent chapter!
    if (cur && initialReadingUnitId) {
      const parentCh = cur.chapters.find(ch => ch.units.some(un => un.id === initialReadingUnitId));
      if (parentCh) {
        return { [parentCh.id]: true };
      }
    }
    const firstId = cur?.chapters[0]?.id;
    return firstId ? { [firstId]: true } : {};
  });

  // Active reading unit for the immersive wide Reader mode
  const [readingUnitId, setReadingUnitId] = useState<string | null>(initialReadingUnitId || null);

  // Sync reading unit and expand chapter if initialReadingUnitId changes
  useEffect(() => {
    if (initialReadingUnitId) {
      setReadingUnitId(initialReadingUnitId);
      if (cur) {
        const parentCh = cur.chapters.find(ch => ch.units.some(un => un.id === initialReadingUnitId));
        if (parentCh) {
          setExpandedTheoryChapters(prev => ({ ...prev, [parentCh.id]: true }));
        }
      }
    }
  }, [initialReadingUnitId, cur]);

  // Call onUnitRead when readingUnitId changes
  useEffect(() => {
    if (readingUnitId && onUnitRead) {
      onUnitRead(readingUnitId, subject);
    }
  }, [readingUnitId, subject, onUnitRead]);

  // State for showing the theory readiness check confirmation alert
  const [theoryConfirmData, setTheoryConfirmData] = useState<{
    questions: ExamQuestion[];
    title: string;
    unitIds: string[];
  } | null>(null);

  if (!cur) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500 font-sans">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Το μάθημα δεν βρέθηκε</h3>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold">
          Επιστροφή στο Dashboard
        </button>
      </div>
    );
  }

  // Get total questions for this subject
  const subjectQuestions = questions.filter(q => q.subject === subject);

  // Toggle single unit selection
  const handleToggleUnit = (unitId: string) => {
    setSelectedUnits(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  // Toggle entire chapter selection
  const handleToggleChapter = (chapterId: string, isAllSelected: boolean) => {
    const chapter = cur.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;

    setSelectedUnits(prev => {
      const next = { ...prev };
      chapter.units.forEach(un => {
        next[un.id] = !isAllSelected;
      });
      return next;
    });
  };

  // Check if a chapter's units are fully selected
  const getChapterSelectionState = (chapterId: string) => {
    const chapter = cur.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return { all: false, some: false };

    const total = chapter.units.length;
    const selectedCount = chapter.units.filter(un => selectedUnits[un.id]).length;

    return {
      all: selectedCount === total,
      some: selectedCount > 0 && selectedCount < total
    };
  };

  // Count questions for a given unit
  const getUnitQuestionCount = (unitId: string) => {
    return subjectQuestions.filter(q => q.unitId === unitId).length;
  };

  // Questions matching active checked filters
  const getFilteredQuestions = () => {
    return subjectQuestions.filter(q => q.unitId && selectedUnits[q.unitId]);
  };

  const filteredQs = getFilteredQuestions();

  // Trigger custom exam with theory safety check first
  const handleStartCustomExam = () => {
    if (filteredQs.length === 0) {
      alert('Παρακαλώ επιλέξτε τουλάχιστον μία ενότητα με διαθέσιμες ερωτήσεις.');
      return;
    }

    const activeSelectedUnitIds = cur.chapters
      .flatMap(ch => ch.units)
      .filter(un => selectedUnits[un.id])
      .map(un => un.id);

    let examTitle = '';
    if (activeSelectedUnitIds.length === cur.chapters.flatMap(ch => ch.units).length) {
      examTitle = `Γενικό Διαγώνισμα: ${cur.name}`;
    } else if (activeSelectedUnitIds.length === 1) {
      // Find unit name
      const un = cur.chapters.flatMap(ch => ch.units).find(u => u.id === activeSelectedUnitIds[0]);
      examTitle = `Διαγώνισμα: ${un?.name || ''}`;
    } else {
      examTitle = `Διαγώνισμα Ύλης (${activeSelectedUnitIds.length} Ενοτήτων)`;
    }

    // Launch readiness check modal
    setTheoryConfirmData({
      questions: filteredQs,
      title: examTitle,
      unitIds: activeSelectedUnitIds
    });
  };

  // Trigger test specifically for single unit questions with theory check
  const handleTestSpecificUnit = (unitId: string, unitName: string) => {
    const unitQs = subjectQuestions.filter(q => q.unitId === unitId);
    if (unitQs.length === 0) {
      alert('Δεν υπάρχουν ακόμη ερωτήσεις για αυτήν την ενότητα. Προσθέστε ερωτήσεις από το πάνελ του Καθηγητή!');
      return;
    }

    setTheoryConfirmData({
      questions: unitQs,
      title: `Διαγώνισμα: ${unitName}`,
      unitIds: [unitId]
    });
  };

  const toggleTheoryChapterAccordion = (chapterId: string) => {
    setExpandedTheoryChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }));
  };

  const readingUnit = cur.chapters
    .flatMap(ch => ch.units)
    .find(un => un.id === readingUnitId);

  // Compute overall theory completion
  const totalUnits = cur.chapters.flatMap(ch => ch.units).length;
  const completedCount = cur.chapters.flatMap(ch => ch.units).filter(un => completedTheoryUnits.includes(un.id)).length;
  const theoryPercentage = totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;

  return (
    <div id="subject-workspace" className="max-w-6xl mx-auto px-4 py-8 font-sans">
      {/* Subject Header Navigation */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-850 cursor-pointer transition-colors font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          Επιστροφή στο Dashboard
        </button>
        <span className="text-xs font-bold tracking-wider uppercase bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100">
          Σελίδα Μαθήματος
        </span>
      </div>

      {/* Main Subject Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 shadow-sm shrink-0">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {cur.name}
            </h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              Διαμορφώστε την ύλη εξέτασης, μελετήστε τη θεωρία, και εξεταστείτε σε επιλεγμένα κεφάλαια.
            </p>
          </div>
        </div>
        
        {/* Dynamic statistics box */}
        <div className="flex gap-4">
          <div className="bg-slate-50 px-5 py-3 rounded-xl border border-slate-200/60 text-center sm:text-right shrink-0">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Σύνολο Ερωτήσεων</span>
            <span className="text-2xl font-black text-slate-800">{subjectQuestions.length}</span>
            <span className="text-xs text-amber-600 font-bold block">διαθέσιμες</span>
          </div>

          <div className="bg-emerald-50/40 px-5 py-3 rounded-xl border border-emerald-100 text-center sm:text-right shrink-0">
            <span className="block text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Πρόοδος Θεωρίας</span>
            <span className="text-2xl font-black text-emerald-700">{completedCount} / {totalUnits}</span>
            <span className="text-xs text-emerald-600 font-bold block">Μελετήθηκαν ({theoryPercentage}%)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* RIGHT COLUMN - CHAPTER & UNIT SELECTOR (5 cols) */}
        <div className="lg:col-span-5 order-last lg:order-last space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BookmarkCheck className="h-5 w-5 text-sky-600" />
              <span>Επιλογή Εξεταστέας Ύλης</span>
            </h2>
            <p className="text-slate-400 text-xs mb-6 font-medium leading-relaxed">
              Επιλέξτε τα κεφάλαια και τις ενότητες που επιθυμείτε να συμπεριληφθούν στο custom διαγώνισμά σας.
            </p>

            <div className="space-y-4">
              {cur.chapters.map(ch => {
                const { all, some } = getChapterSelectionState(ch.id);
                return (
                  <div key={ch.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                    {/* Chapter Row */}
                    <div className="flex items-center justify-between border-b border-slate-150/60 pb-2 mb-2">
                      <button
                        onClick={() => handleToggleChapter(ch.id, all)}
                        className="flex items-center gap-2 text-left font-bold text-xs text-slate-800 cursor-pointer"
                      >
                        {all ? (
                          <CheckSquare className="h-4.5 w-4.5 text-sky-600 shrink-0" />
                        ) : (
                          <Square className={`h-4.5 w-4.5 text-slate-300 shrink-0 ${some ? 'opacity-70' : ''}`} />
                        )}
                        <span>{ch.name}</span>
                      </button>
                    </div>

                    {/* Units Rows */}
                    <div className="pl-4 space-y-2">
                      {ch.units.map(un => {
                        const isSelected = !!selectedUnits[un.id];
                        const unitCount = getUnitQuestionCount(un.id);
                        return (
                          <div key={un.id} className="flex items-center justify-between text-xs font-medium text-slate-650">
                            <button
                              onClick={() => handleToggleUnit(un.id)}
                              className="flex items-center gap-2 text-left cursor-pointer hover:text-slate-900 transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-sky-500 shrink-0" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-200 shrink-0" />
                              )}
                              <span className={isSelected ? 'text-slate-800 font-semibold' : ''}>{un.name}</span>
                            </button>
                            <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-400 font-bold shrink-0">
                              {unitCount} ερωτ.
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Exam Launch Box */}
            <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Επιλεγμένες Ερωτήσεις:</span>
                <span className="font-bold text-sky-600 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-lg">
                  {filteredQs.length} ερωτήσεις
                </span>
              </div>
              
              <button
                onClick={handleStartCustomExam}
                disabled={filteredQs.length === 0}
                className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs rounded-xl tracking-wider uppercase transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current text-white" />
                Έναρξη Διαγωνίσματος Ύλης
              </button>
              
              {filteredQs.length === 0 && (
                <div className="flex items-start gap-1.5 text-[10px] text-amber-600 bg-amber-50/50 border border-amber-100 p-2.5 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Παρακαλώ επιλέξτε τουλάχιστον μία ενότητα που περιέχει ερωτήσεις για να ξεκινήσει η εξέταση.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LEFT COLUMN - NEW COMPACT THEORY LIBRARY & CHAPTER CARDS (7 cols) */}
        <div className="lg:col-span-7 order-first lg:order-first space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-500" />
                  <span>Βιβλιοθήκη Θεωρίας & Ενότητες</span>
                </h2>
                <p className="text-slate-400 text-xs mt-1 font-medium leading-relaxed">
                  Μελετήστε οργανωμένα τη θεωρία κάθε κεφαλαίου. Ο Dr. Gatoni υπενθυμίζει να μελετάτε ΠΑΝΤΑ τη θεωρία πριν τις ερωτήσεις!
                </p>
              </div>
            </div>

            {/* Compact Theory Progress Ring/Bar */}
            <div className="mb-6 p-4 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <BookmarkCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-slate-800 block">Πρόοδος Καταγραφής Μελέτης</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Μαρκάρετε τις ενότητες ως "Μελετήθηκαν" για να παρακολουθείτε την εξέλιξή σας.</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-emerald-600">{theoryPercentage}%</span>
                <div className="w-24 bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${theoryPercentage}%` }} />
                </div>
              </div>
            </div>

            {/* Chapters Accordions Loop */}
            <div className="space-y-4">
              {cur.chapters.map(ch => {
                const isExpanded = !!expandedTheoryChapters[ch.id];
                const readUnitsInChapter = ch.units.filter(un => completedTheoryUnits.includes(un.id)).length;
                const totalUnitsInChapter = ch.units.length;
                const isChapterFullyRead = readUnitsInChapter === totalUnitsInChapter;

                return (
                  <div 
                    key={ch.id} 
                    className={`border rounded-2xl overflow-hidden transition-all shadow-sm bg-white ${
                      isExpanded ? 'border-indigo-150 ring-1 ring-indigo-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Chapter Accordion Trigger */}
                    <div 
                      onClick={() => toggleTheoryChapterAccordion(ch.id)}
                      className="p-4 bg-slate-50/50 hover:bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isChapterFullyRead ? 'bg-emerald-500' : readUnitsInChapter > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} />
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 block">{ch.name}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            Μελετήθηκαν: {readUnitsInChapter} / {totalUnitsInChapter} ενότητες
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isChapterFullyRead && (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md border border-emerald-100">
                            Ολοκληρώθηκε ✅
                          </span>
                        )}
                        <span className="p-1 text-slate-400">
                          {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                        </span>
                      </div>
                    </div>

                    {/* Compact list of units inside this chapter */}
                    {isExpanded && (
                      <div className="p-3 bg-white divide-y divide-slate-100">
                        {ch.units.map(un => {
                          const isRead = completedTheoryUnits.includes(un.id);
                          const unitQCount = getUnitQuestionCount(un.id);

                          return (
                            <div 
                              key={un.id} 
                              className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-start gap-2.5">
                                {/* Track study toggle */}
                                <button
                                  onClick={() => onToggleTheoryUnit(un.id, subject)}
                                  className={`p-1 rounded-md border transition-all mt-0.5 cursor-pointer ${
                                    isRead 
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-300'
                                  }`}
                                  title={isRead ? "Μαρκαρισμένο ως Μελετημένο" : "Μαρκάρισμα ως Μελετημένο"}
                                >
                                  <Check className="h-3.5 w-3.5 stroke-[3px]" />
                                </button>
                                <div>
                                  <span className="font-extrabold text-slate-850 block leading-tight">{un.name}</span>
                                  <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                                    {unitQCount} ερωτήσεις στη βάση
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center">
                                {/* Mark read badge */}
                                {isRead && (
                                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 px-2 py-0.5 rounded">
                                    Μελετήθηκε 📖
                                  </span>
                                )}

                                {/* Main Study button triggers big immersive reader modal */}
                                <button
                                  onClick={() => setReadingUnitId(un.id)}
                                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] rounded-xl border border-indigo-150 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <BookOpen className="h-3.5 w-3.5" />
                                  Μελέτη Θεωρίας
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------- IMMERSIVE FULLSCREEN-LIKE THEORY READER MODAL -------------------- */}
      <AnimatePresence>
        {readingUnitId && readingUnit && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl relative overflow-hidden font-sans"
            >
              {/* Dynamic decorative top bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

              {/* Reader Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
                    <BookOpen className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-wider block">Κέντρο Μελέτης & Θεωρίας</span>
                    <h3 className="text-base font-black text-slate-900 tracking-tight leading-tight">{readingUnit.name}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Mark Read/Unread State in Reader header */}
                  <button
                    onClick={() => onToggleTheoryUnit(readingUnit.id, subject)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      completedTheoryUnits.includes(readingUnit.id)
                        ? 'bg-emerald-500 hover:bg-emerald-600 border-transparent text-white shadow-md'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-650'
                    }`}
                  >
                    <Check className="h-4 w-4 stroke-[3px]" />
                    {completedTheoryUnits.includes(readingUnit.id) ? 'Μελετήθηκε ✅' : 'Μαρκάρισμα ως Διαβασμένο'}
                  </button>

                  <button
                    onClick={() => setReadingUnitId(null)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-750 rounded-xl transition-colors cursor-pointer"
                    title="Κλείσιμο"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Reader Body (2 column spacious layout: Left text, Right visual media) */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                {/* Left Side: Rich text reading section (7 cols) */}
                <div className="lg:col-span-7 overflow-y-auto p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                      Κείμενο Θεωρίας
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {getUnitQuestionCount(readingUnit.id)} ερωτήσεις συνδεδεμένες
                    </span>
                  </div>

                  {/* High quality typography and reading layout */}
                  <div className="text-slate-800 text-sm md:text-base leading-relaxed space-y-4 whitespace-pre-line font-medium pr-2 select-text selection:bg-indigo-100">
                    {readingUnit.theory}
                  </div>
                </div>

                {/* Right Side: Media, Videos and Illustrations panel (5 cols) */}
                <div className="lg:col-span-5 overflow-y-auto p-6 bg-slate-50/50 border-t lg:border-t-0 lg:border-l border-slate-100 space-y-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-450 block">
                    Συνοδευτικό Υλικό Μελέτης
                  </span>

                  {/* Video Lesson Slot */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                    <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider flex items-center gap-1.5">
                      <PlayCircle className="h-4 w-4 text-indigo-500" />
                      Βίντεο-Παράδοση Ενότητας
                    </span>
                    
                    <div className="bg-slate-900 rounded-xl overflow-hidden aspect-video relative group border border-slate-800 shadow-inner flex flex-col items-center justify-center text-center p-4">
                      {/* Dark overlay graphic */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/90 to-indigo-950 opacity-90" />
                      
                      {/* Play Action Trigger */}
                      <div className="z-10 flex flex-col items-center justify-center cursor-pointer">
                        <div className="w-12 h-12 bg-amber-500 hover:bg-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                          <Play className="h-5 w-5 text-slate-950 fill-current ml-0.5" />
                        </div>
                        <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest mt-3">
                          Dr. Gatoni Video Class 🎥
                        </span>
                        <span className="text-white font-bold text-xs mt-1 px-3">
                          {readingUnit.name}
                        </span>
                        <span className="text-slate-400 text-[9px] mt-2 font-bold bg-slate-950/60 px-2.5 py-1 rounded-full border border-slate-800">
                          Διάρκεια: 15:20 | 4K UHD
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Medical Illustration Slot */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Image className="h-4 w-4 text-slate-400" />
                      Συνοδευτικό Ιατρικό Σχεδιάγραμμα
                    </span>

                    <div className="bg-slate-50 rounded-xl border border-dashed border-slate-250 p-4 flex flex-col items-center justify-center text-center space-y-2 h-44">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-200 shadow-sm text-slate-400">
                        <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                      </div>
                      <span className="text-xs font-extrabold text-slate-700">Ανατομικό Διάγραμμα Κεφαλαίου</span>
                      <p className="text-[9px] text-slate-400 max-w-[240px] font-semibold leading-normal">
                        Σχηματική και φωτογραφική απεικόνιση των βιολογικών δομών, κυτταρικών οργανιδίων ή φυσικών εννοιών της ενότητας.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reader Footer Control bar */}
              <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white shrink-0">
                <span className="text-xs text-slate-500 font-bold">
                  Ενότητα:{' '}
                  <span className="text-indigo-600 font-extrabold">
                    {completedTheoryUnits.includes(readingUnit.id) ? 'Μελετήθηκε (Καταγράφηκε) ✅' : 'Δεν έχει καταγραφεί ακόμη ως μελετημένη'}
                  </span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReadingUnitId(null)}
                    className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Κλείσιμο Αναγνώστη
                  </button>

                  <button
                    onClick={() => {
                      // Trigger unit quiz with safety check
                      handleTestSpecificUnit(readingUnit.id, readingUnit.name);
                    }}
                    disabled={getUnitQuestionCount(readingUnit.id) === 0}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-550 active:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Έναρξη Τεστ Ενότητας 🚀
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- THEORY READINESS CHECK CONFIRMATION DIALOG -------------------- */}
      <AnimatePresence>
        {theoryConfirmData && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-rose-100 max-w-md w-full shadow-2xl relative overflow-hidden p-6 font-sans text-center"
            >
              {/* Doctor theme header icon */}
              <div className="mx-auto w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center border border-amber-100 shadow-sm mb-4">
                <GraduationCap className="h-9 w-9" />
              </div>

              <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug px-2">
                Έχεις διαβάσει οπωσδήποτε τη θεωρία;
              </h3>
              <p className="text-slate-500 text-xs mt-2.5 mb-6 leading-relaxed font-semibold px-4">
                Ο <span className="text-amber-600 font-extrabold">Dr. Gatoni</span> συνιστά να μην ξεκινάς τις ερωτήσεις χωρίς διάβασμα.
              </p>

              {/* Units Reading Checklist */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 text-left max-h-[180px] overflow-y-auto space-y-2 mb-6">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Έλεγχος ενοτήτων:</span>
                {theoryConfirmData.unitIds.map(unitId => {
                  const isRead = completedTheoryUnits.includes(unitId);
                  // Find unit name
                  let name = '';
                  cur.chapters.forEach(ch => {
                    ch.units.forEach(un => {
                      if (un.id === unitId) name = un.name;
                    });
                  });

                  return (
                    <div key={unitId} className="flex items-center justify-between text-xs font-semibold py-1 border-b border-slate-100/60 last:border-0">
                      <span className="text-slate-700 truncate mr-2">{name}</span>
                      {isRead ? (
                        <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg shrink-0">
                          Διαβάστηκε ✅
                        </span>
                      ) : (
                        <span className="text-amber-600 font-bold text-[10px] bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg shrink-0">
                          Μη Μελετημένο ⚠️
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Choices Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    const qs = theoryConfirmData.questions;
                    const title = theoryConfirmData.title;
                    setTheoryConfirmData(null);
                    setReadingUnitId(null); // Close reader if open
                    onStartCustomQuiz(qs, title);
                  }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-550 active:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Ναι, τη διάβασα 👍
                </button>
                <button
                  onClick={() => {
                    // Close check
                    setTheoryConfirmData(null);
                    // Open the first uncompleted unit reader automatically to guide them!
                    const unreadId = theoryConfirmData.unitIds.find(id => !completedTheoryUnits.includes(id));
                    if (unreadId) {
                      setReadingUnitId(unreadId);
                    }
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Όχι, να πάω στη θεωρία 📖
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
