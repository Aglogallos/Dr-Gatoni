import React from 'react';
import { Subject, StudentProfile, QuestionProgress, ExamQuestion } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Dna, 
  FlaskConical, 
  Activity, 
  Award, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Play,
  Heart,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  X,
  GraduationCap
} from 'lucide-react';
import { DrGatoniLogo, getDrGatoniQuote, getGatometroStatus } from './DrGatoniLogo';
import { CURRICULUM } from '../data/curriculum';

export function formatGreekWelcomeName(nameStr: string): string {
  if (!nameStr) return '';
  const firstName = nameStr.trim().split(/\s+/)[0];
  if (firstName.endsWith('ς') || firstName.endsWith('Σ')) {
    const lower = firstName.toLowerCase();
    if (lower.endsWith('ης') || lower.endsWith('ας') || lower.endsWith('ος') || lower.endsWith('υς')) {
      return firstName.slice(0, -1);
    }
  }
  return firstName;
}

interface DashboardProps {
  profile: StudentProfile;
  questions: ExamQuestion[];
  progressList: QuestionProgress[];
  completedTheoryUnits?: string[];
  onStartSubjectStudy: (subject: Subject) => void;
  onStartMixedStudy: () => void;
  onViewWrongLog: () => void;
  onContinueStudy: () => void;
  onStartCustomQuiz?: (filteredQuestions: ExamQuestion[], customTitle: string) => void;
}

export default function Dashboard({
  profile,
  questions,
  progressList,
  completedTheoryUnits = [],
  onStartSubjectStudy,
  onStartMixedStudy,
  onViewWrongLog,
  onContinueStudy,
  onStartCustomQuiz
}: DashboardProps) {

  const [gatoniQuote, setGatoniQuote] = React.useState(() => getDrGatoniQuote());

  // General Revision Modal States
  const [showRevisionModal, setShowRevisionModal] = React.useState(false);
  const [selectedUnits, setSelectedUnits] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.values(CURRICULUM).forEach(cur => {
      cur.chapters.forEach(ch => {
        ch.units.forEach(un => {
          initial[un.id] = true; // All selected by default
        });
      });
    });
    return initial;
  });

  const [expandedSubjects, setExpandedSubjects] = React.useState<Record<string, boolean>>({
    biology: true,
    biochemistry: false,
    physics: false
  });

  // Theory Confirmation Dialog state
  const [theoryConfirmData, setTheoryConfirmData] = React.useState<{
    questions: ExamQuestion[];
    title: string;
    unitIds: string[];
  } | null>(null);

  // Helper functions for Custom Revision setup
  const handleToggleRevisionUnit = (unitId: string) => {
    setSelectedUnits(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  const handleToggleRevisionSubject = (subjKey: string, isAllSelected: boolean) => {
    const cur = CURRICULUM[subjKey];
    if (!cur) return;
    setSelectedUnits(prev => {
      const next = { ...prev };
      cur.chapters.forEach(ch => {
        ch.units.forEach(un => {
          next[un.id] = !isAllSelected;
        });
      });
      return next;
    });
  };

  const getSubjectSelectionState = (subjKey: string) => {
    const cur = CURRICULUM[subjKey];
    if (!cur) return { all: false, some: false, count: 0, total: 0 };
    const units = cur.chapters.flatMap(ch => ch.units);
    const total = units.length;
    const selectedCount = units.filter(un => selectedUnits[un.id]).length;
    return {
      all: selectedCount === total,
      some: selectedCount > 0 && selectedCount < total,
      count: selectedCount,
      total
    };
  };

  const handleStartFilteredRevision = () => {
    // Filter questions based on selected units
    const activeUnitIds = Object.keys(selectedUnits).filter(id => selectedUnits[id]);
    const filteredQuestions = questions.filter(q => q.unitId && selectedUnits[q.unitId]);
    
    if (filteredQuestions.length === 0) {
      alert('Παρακαλώ επιλέξτε τουλάχιστον μία ενότητα με ερωτήσεις για επανάληψη.');
      return;
    }

    const totalAvailableUnits = Object.values(CURRICULUM).flatMap(cur => cur.chapters.flatMap(ch => ch.units)).length;
    let examTitle = '';
    if (activeUnitIds.length === totalAvailableUnits) {
      examTitle = 'Γενική Επανάληψη (Όλη η Ύλη)';
    } else {
      examTitle = `Επανάληψη Ύλης (${activeUnitIds.length} Ενοτήτων)`;
    }

    // Open Theory Confirmation Dialog
    setTheoryConfirmData({
      questions: filteredQuestions,
      title: examTitle,
      unitIds: activeUnitIds
    });
  };

  const handleRefreshQuote = () => {
    setGatoniQuote(getDrGatoniQuote());
  };

  // Group questions by subject
  const subjectsInfo = {
    biology: {
      title: 'Βιολογία',
      desc: 'Γενετική, κυτταρική δομή, μίτωση, οργανίδια, και μοριακή βιολογία.',
      icon: Dna,
      color: 'from-emerald-500 to-teal-600',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50/50 border-emerald-100'
    },
    biochemistry: {
      title: 'Βιοχημεία',
      desc: 'Πρωτεΐνες, ένζυμα, μεταβολικές οδοί, γλυκόλυση, και αμινοξέα.',
      icon: FlaskConical,
      color: 'from-sky-500 to-indigo-600',
      textColor: 'text-sky-600',
      bgColor: 'bg-sky-50/50 border-sky-100'
    },
    physics: {
      title: 'Ιατρική Φυσική',
      desc: 'Ιοντίζουσες ακτινοβολίες, υπέρηχοι, ακουστική εμπέδηση, και ραδιενέργεια.',
      icon: Activity,
      color: 'from-amber-500 to-orange-600',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50/50 border-amber-100'
    }
  };

  // Compute stats
  const totalQuestions = questions.length;
  
  // Progress status counts
  const progressMap = new Map(progressList.map(p => [p.questionId, p]));
  const studiedCount = progressList.length;
  const newCount = totalQuestions - studiedCount;
  
  const learningCount = progressList.filter(p => p.state === 'learning').length;
  const reviewCount = progressList.filter(p => p.state === 'review').length;
  
  // Wrong answers log (wrongCount > 0)
  const wrongAnswersCount = progressList.filter(p => p.wrongCount > 0).length;

  // Calculate success rate
  let totalCorrect = 0;
  let totalWrong = 0;
  progressList.forEach(p => {
    totalCorrect += p.correctCount || 0;
    totalWrong += p.wrongCount || 0;
  });
  const totalAnswers = totalCorrect + totalWrong;
  const successRate = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 100;

  const gatometro = getGatometroStatus(successRate, studiedCount);

  // Compute subject statistics
  const getSubjectStats = (subject: Subject) => {
    const subjectQuestions = questions.filter(q => q.subject === subject);
    const subTotal = subjectQuestions.length;
    const subStudied = progressList.filter(p => p.subject === subject).length;
    const subWrong = progressList.filter(p => p.subject === subject && p.wrongCount > 0).length;
    return {
      total: subTotal,
      studied: subStudied,
      wrong: subWrong,
      remaining: subTotal - subStudied
    };
  };

  return (
    <div id="student-dashboard" className="max-w-6xl mx-auto px-4 py-8 font-sans">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden">
        {/* Subtle orange/amber visual accent strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
            Καλώς ήρθες, {formatGreekWelcomeName((profile as any).firstName || profile.name)}! <span className="animate-bounce">🐾</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Η πορεία της μελέτης σου για τις εισαγωγικές εξετάσεις Ιατρικής με τον <span className="text-amber-600 font-bold">Dr. Gatoni</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 z-10">
          <button
            onClick={onContinueStudy}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current text-slate-950" />
            Συνέχισε τη μελέτη σου
          </button>
          <button
            onClick={() => setShowRevisionModal(true)}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Award className="h-4 w-4 text-amber-500" />
            Γενική Επανάληψη
          </button>
        </div>
      </div>

      {/* Dr. Gatoni's Consultation & Gatometro Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Dr. Gatoni's Consultation Speech bubble */}
        <div className="lg:col-span-2 bg-gradient-to-br from-amber-50/50 to-orange-50/50 border border-amber-200 rounded-3xl p-6 flex flex-col md:flex-row gap-5 items-center relative overflow-hidden shadow-sm">
          {/* Decorative background paw */}
          <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none text-6xl text-amber-500 font-bold">
            🐾
          </div>
          <div className="shrink-0 relative group">
            <DrGatoniLogo className="h-24 w-24 drop-shadow-md group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full text-[8px] font-bold border-2 border-white animate-pulse" title="Dr. Gatoni is Online">
              🟢
            </div>
          </div>
          <div className="space-y-2 flex-1 w-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                🩺 Η Γνωμάτευση του Dr. Gatoni
              </span>
              <button 
                onClick={handleRefreshQuote}
                className="text-[10px] font-extrabold text-amber-600 hover:text-amber-800 hover:bg-amber-100/50 px-2.5 py-1 rounded-lg border border-amber-200/50 transition-all cursor-pointer flex items-center gap-1"
                title="Νέο νιαούρισμα"
              >
                🔄 Νέο Νιαούρισμα
              </button>
            </div>
            <div className="relative bg-white border border-amber-150 p-4 rounded-2xl shadow-sm mt-1">
              {/* Little triangle speech bubble tip */}
              <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 bg-white border-l border-b border-amber-150 rotate-45 hidden md:block" />
              <p className="text-slate-800 text-xs md:text-sm font-semibold leading-relaxed italic">
                "{gatoniQuote}"
              </p>
            </div>
          </div>
        </div>

        {/* Gatometro Card */}
        <div className={`${gatometro.bgColorClass} border rounded-3xl p-6 flex flex-col justify-between shadow-sm relative overflow-hidden`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                📈 ΓΑΤΟΜΕΤΡΟ IQ
              </span>
              <span className="text-xl">{gatometro.emoji}</span>
            </div>
            <h3 className={`text-lg font-black tracking-tight ${gatometro.colorClass}`}>
              {gatometro.level}
            </h3>
            <p className="text-slate-600 text-xs mt-1.5 font-medium leading-relaxed">
              {gatometro.description}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-between items-center text-[11px] font-bold text-slate-500">
            <span>Ακρίβεια Απαντήσεων:</span>
            <span className={gatometro.colorClass}>{successRate}%</span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Πρόοδος Ύλης</span>
            <BookOpen className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-900">{studiedCount}</span>
            <span className="text-xs text-slate-400 ml-1">/ {totalQuestions} ερωτήσεις</span>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${totalQuestions > 0 ? (studiedCount / totalQuestions) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Επιτυχία</span>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-emerald-600">{successRate}%</span>
            <span className="text-xs text-slate-400 ml-1">σωστές απαντήσεις</span>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Λανθασμένες</span>
            <XCircle className="h-5 w-5 text-rose-500" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-slate-900">{wrongAnswersCount}</span>
              <span className="text-xs text-rose-600 block mt-1 hover:underline cursor-pointer font-semibold" onClick={onViewWrongLog}>
                Προβολή λίστας &rarr;
              </span>
            </div>
            {wrongAnswersCount > 0 && (
              <span className="px-2.5 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-100 animate-pulse">
                Χρειάζεται μελέτη
              </span>
            )}
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Πορεία Επανάληψης</span>
            <Calendar className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1 text-center">
            <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <span className="block text-sm font-bold text-slate-700">{newCount}</span>
              <span className="text-[10px] text-slate-400 font-semibold">Νέες</span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <span className="block text-sm font-bold text-rose-600">{learningCount}</span>
              <span className="text-[10px] text-slate-400 font-semibold">Μάθηση</span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <span className="block text-sm font-bold text-sky-600">{reviewCount}</span>
              <span className="text-[10px] text-slate-400 font-semibold">Επαν/ψη</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subject Section Title */}
      <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
        <span>Επιλογή Μαθήματος για Μελέτη</span>
        <span className="h-1.5 w-1.5 bg-sky-500 rounded-full" />
      </h2>

      {/* Subject Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {(Object.keys(subjectsInfo) as Subject[]).map((subjectKey) => {
          const s = subjectsInfo[subjectKey];
          const stats = getSubjectStats(subjectKey);
          const IconComponent = s.icon;
          const completionPercentage = stats.total > 0 ? Math.round((stats.studied / stats.total) * 100) : 0;

          return (
            <motion.div
              key={subjectKey}
              whileHover={{ y: -4 }}
              onClick={() => onStartSubjectStudy(subjectKey)}
              className={`bg-white rounded-2xl p-6 border flex flex-col justify-between hover:border-slate-300 transition-all shadow-sm hover:shadow-md cursor-pointer active:scale-[0.99] ${s.bgColor}`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-white border border-slate-200 shadow-sm ${s.textColor}`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <span className="text-xs bg-white text-slate-500 font-medium px-2.5 py-1 rounded-full border border-slate-200">
                    {stats.total} ερωτήσεις συνολικά
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">{s.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed mb-6 font-medium">{s.desc}</p>
              </div>

              <div className="space-y-4">
                {/* Visual mini graph */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                    <span>Ολοκληρωμένες: {stats.studied}</span>
                    <span>{completionPercentage}%</span>
                  </div>
                  <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${s.color}`}
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="block font-bold text-amber-600">{stats.remaining}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Απομένουν</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className={`block font-bold ${stats.wrong > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{stats.wrong}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Λανθασμένες</span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartSubjectStudy(subjectKey);
                  }}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-transparent rounded-xl font-semibold text-xs text-white tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Play className="h-3 w-3 fill-current text-sky-400" />
                  Έναρξη Μελέτης
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Guide/Info Box */}
      <div className="bg-sky-50 border border-sky-100 p-5 rounded-2xl flex gap-4 items-start shadow-sm">
        <AlertTriangle className="h-6 w-6 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-sky-900">Πώς λειτουργεί το σύστημα Έξυπνης Επανάληψης;</h4>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Κάθε φορά που απαντάς σε μια ερώτηση, το σύστημα αποθηκεύει την απόδοσή σου. Αν απαντήσεις λάθος, η ερώτηση μπαίνει στη λίστα <strong>Λανθασμένων Απαντήσεων</strong> και χαρακτηρίζεται ως «Μάθηση». Θα σου εμφανίζεται συχνότερα μέχρι να την εμπεδώσεις. Αν απαντήσεις σωστά, μπορείς να ορίσεις πόσο εύκολη σου φάνηκε, αυξάνοντας το μεσοδιάστημα επανάληψης της ερώτησης σε 1, 3, ή 5 ημέρες!
          </p>
        </div>
      </div>

      {/* -------------------- GENERAL REVISION SELECTION MODAL -------------------- */}
      <AnimatePresence>
        {showRevisionModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden font-sans"
            >
              {/* Dynamic top gradient line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-indigo-600" />

              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Επιλογή Ύλης Γενικής Επανάληψης</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Επιλέξτε μαθήματα και ενότητες για μια εξατομικευμένη επανάληψη.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRevisionModal(false)}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-650 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
                {/* Theory Reminder Box */}
                <div className="p-3.5 bg-indigo-50 border border-indigo-150 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-900 font-medium shadow-inner">
                  <BookOpen className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span>📚 <strong>Υπενθύμιση του Dr. Gatoni:</strong></span>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                      Μην βιάζεσαι! Η θεωρία είναι το θεμέλιο της επιτυχίας σου. Σιγουρέψου ότι έχεις μελετήσει πρώτα τις αντίστοιχες ενότητες στη βιβλιοθήκη θεωρίας πριν εξεταστείς.
                    </p>
                  </div>
                </div>

                {/* Subject Selector Loop */}
                <div className="space-y-4">
                  {(Object.keys(CURRICULUM) as Subject[]).map(subjectKey => {
                    const subjCur = CURRICULUM[subjectKey];
                    const info = subjectsInfo[subjectKey];
                    const isExpanded = !!expandedSubjects[subjectKey];
                    const { all, some, count, total } = getSubjectSelectionState(subjectKey);

                    return (
                      <div key={subjectKey} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        {/* Subject Header Row */}
                        <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleRevisionSubject(subjectKey, all)}
                              className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                            >
                              {all ? (
                                <CheckSquare className="h-5 w-5 text-indigo-600" />
                              ) : (
                                <Square className={`h-5 w-5 text-slate-300 ${some ? 'opacity-70' : ''}`} />
                              )}
                            </button>
                            <div>
                              <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                                <info.icon className="h-4 w-4 text-slate-500" />
                                {subjCur.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold block">
                                {count} / {total} ενότητες επιλεγμένες
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => setExpandedSubjects(prev => ({ ...prev, [subjectKey]: !isExpanded }))}
                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                          </button>
                        </div>

                        {/* Subject Chapters/Units Expanded View */}
                        {isExpanded && (
                          <div className="p-4 space-y-4 divide-y divide-slate-100">
                            {subjCur.chapters.map(ch => (
                              <div key={ch.id} className="pt-3 first:pt-0">
                                <span className="text-xs font-bold text-slate-700 block mb-2">{ch.name}</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {ch.units.map(un => {
                                    const isSelected = !!selectedUnits[un.id];
                                    const isTheoryRead = completedTheoryUnits.includes(un.id);
                                    return (
                                      <div
                                        key={un.id}
                                        onClick={() => handleToggleRevisionUnit(un.id)}
                                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                                          isSelected 
                                            ? 'bg-indigo-50/40 border-indigo-200 text-slate-800' 
                                            : 'bg-white border-slate-100 text-slate-450 hover:bg-slate-50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {isSelected ? (
                                            <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                                          ) : (
                                            <Square className="h-4 w-4 text-slate-200 shrink-0" />
                                          )}
                                          <span>{un.name}</span>
                                        </div>
                                        {isTheoryRead && (
                                          <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 font-bold shrink-0">
                                            Μελετήθηκε ✅
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white shrink-0">
                <span className="text-xs text-slate-500 font-bold">
                  Επιλέχθηκαν συνολικά: {' '}
                  <span className="text-indigo-600 text-sm font-extrabold">
                    {questions.filter(q => q.unitId && selectedUnits[q.unitId]).length} ερωτήσεις
                  </span>
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowRevisionModal(false)}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Άκυρο
                  </button>
                  <button
                    onClick={handleStartFilteredRevision}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Έναρξη Επανάληψης 🚀
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- THEORY CHECK CONFIRMATION DIALOG -------------------- */}
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

              <h3 className="text-lg font-black text-slate-900 tracking-tight">Έλεγχος Μελέτης Θεωρίας! 📚</h3>
              <p className="text-slate-500 text-xs mt-1.5 mb-6 leading-relaxed font-semibold">
                Ο <span className="text-amber-600 font-bold">Dr. Gatoni</span> σε συμβουλεύει να μην βιάζεσαι! Έχεις μελετήσει τη θεωρία για τις επιλεγμένες ενότητες;
              </p>

              {/* Units Reading Checklist */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 text-left max-h-[180px] overflow-y-auto space-y-2 mb-6">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Έλεγχος ενοτήτων:</span>
                {theoryConfirmData.unitIds.map(unitId => {
                  const isRead = completedTheoryUnits.includes(unitId);
                  // Find unit name
                  let name = '';
                  Object.values(CURRICULUM).forEach(cur => {
                    cur.chapters.forEach(ch => {
                      ch.units.forEach(un => {
                        if (un.id === unitId) name = un.name;
                      });
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
                    setShowRevisionModal(false);
                    if (onStartCustomQuiz) {
                      onStartCustomQuiz(qs, title);
                    } else {
                      // Fallback just in case
                      onStartMixedStudy();
                    }
                  }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-550 active:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Ναι, νιώθω έτοιμος! Έναρξη Εξέτασης 🚀
                </button>
                <button
                  onClick={() => {
                    setTheoryConfirmData(null);
                    setShowRevisionModal(false);
                    // Determine which subject this is to redirect there
                    // Just direct them to general biology page as first step, or keep on dashboard
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Όχι, θέλω να διαβάσω τη θεωρία πρώτα 📖
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
