import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { SEED_QUESTIONS } from './data/seedQuestions';
import { StudentProfile, ExamQuestion, QuestionProgress, Subject } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import AnkiSession from './components/AnkiSession';
import WrongLog from './components/WrongLog';
import MockExam from './components/MockExam';
import SubjectPage from './components/SubjectPage';
import InstructorView from './components/InstructorView';
import { motion } from 'motion/react';
import { GraduationCap, LogOut, BookOpen, User, HelpCircle, Loader, ShieldAlert } from 'lucide-react';
import { DrGatoniLogo } from './components/DrGatoniLogo';

const isSubscriptionExpired = (expiresAt?: string) => {
  if (!expiresAt) return false;
  const expiryDate = new Date(expiresAt);
  const today = new Date();
  expiryDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return expiryDate < today;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [progressList, setProgressList] = useState<QuestionProgress[]>([]);
  const [completedTheoryUnits, setCompletedTheoryUnits] = useState<string[]>([]);
  
  // App navigation state
  const [screen, setScreen] = useState<'dashboard' | 'study' | 'wrong_log' | 'mock_exam' | 'subject_page'>('dashboard');
  const [studySubject, setStudySubject] = useState<Subject | 'mixed' | 'wrong'>('mixed');
  const [selectedSubjectPage, setSelectedSubjectPage] = useState<Subject | null>(null);
  const [customExamQuestions, setCustomExamQuestions] = useState<ExamQuestion[] | undefined>(undefined);
  const [customExamTitle, setCustomExamTitle] = useState<string | undefined>(undefined);
  
  const [lastReadUnitId, setLastReadUnitId] = useState<string | null>(() => {
    return localStorage.getItem('lastReadUnitId');
  });
  const [lastReadSubject, setLastReadSubject] = useState<Subject | null>(() => {
    return localStorage.getItem('lastReadSubject') as Subject | null;
  });
  
  // High-level loading state
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Session conflict message for Anti-Password Sharing
  const [sessionConflictMessage, setSessionConflictMessage] = useState<string | null>(null);

  const getOrCreateLocalSessionId = (): string => {
    let sid = sessionStorage.getItem('app_session_id');
    if (!sid) {
      sid = typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID 
        ? window.crypto.randomUUID() 
        : `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('app_session_id', sid);
    }
    return sid;
  };

  // Real-time listener on user profile to enforce single session (Anti-Password Sharing)
  useEffect(() => {
    if (!currentUser?.uid) return;

    const userDocRef = doc(db, 'students', currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as StudentProfile;
        const localSid = sessionStorage.getItem('app_session_id');

        // Check if currentSessionId in Firestore has changed to another session
        if (data.currentSessionId && localSid && data.currentSessionId !== localSid) {
          console.warn("Session conflict detected! Another session logged in with this account.");
          signOut(auth);
          sessionStorage.removeItem('app_session_id');
          setCurrentUser(null);
          setProfile(null);
          setQuestions([]);
          setProgressList([]);
          setCompletedTheoryUnits([]);
          setScreen('dashboard');
          setLoading(false);
          setSessionConflictMessage(
            'Αποσυνδεθήκατε αυτόματα διότι πραγματοποιήθηκε νέα σύνδεση στον λογαριασμό σας από άλλη συσκευή/παράθυρο. Δεν επιτρέπεται η ταυτόχρονη χρήση του ίδιου λογαριασμού (Password Sharing).'
          );
        }
      }
    }, (err) => {
      console.error("Error watching user session snapshot:", err);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Heartbeat to update lastActiveAt timestamp in Firestore
  useEffect(() => {
    if (!currentUser?.uid) return;

    const interval = setInterval(() => {
      const userDocRef = doc(db, 'students', currentUser.uid);
      setDoc(userDocRef, { lastActiveAt: new Date().toISOString() }, { merge: true }).catch(console.error);
    }, 2 * 60 * 1000); // Every 2 minutes

    return () => clearInterval(interval);
  }, [currentUser?.uid]);

  // 1. Listen for Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await fetchUserProfile(user.uid);
      } else {
        setCurrentUser(null);
        setProfile(null);
        setQuestions([]);
        setProgressList([]);
        setScreen('dashboard');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch User Profile
  const fetchUserProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'students', uid);
      const docSnap = await getDoc(docRef);
      const currentEmail = auth.currentUser?.email?.toLowerCase() || '';
      const localSid = getOrCreateLocalSessionId();
      const now = new Date().toISOString();

      if (docSnap.exists()) {
        const uProfile = docSnap.data() as StudentProfile;
        
        // Register current session if missing or updating active time
        if (uProfile.currentSessionId !== localSid) {
          await setDoc(docRef, {
            currentSessionId: localSid,
            lastActiveAt: now
          }, { merge: true });
          uProfile.currentSessionId = localSid;
          uProfile.lastActiveAt = now;
        }

        // Enforce t.aglogallos@gmail.com as instructor/admin
        if (currentEmail === 't.aglogallos@gmail.com' && uProfile.role !== 'instructor') {
          const updatedProfile = { ...uProfile, role: 'instructor' as const, name: 'Διαχειριστής' };
          await setDoc(docRef, updatedProfile);
          setProfile(updatedProfile);
          await loadCoreData(updatedProfile);
        } else if (uProfile.inactive && currentEmail !== 't.aglogallos@gmail.com') {
          // If a student's profile is deactivated, sign them out immediately
          await signOut(auth);
          setCurrentUser(null);
          setProfile(null);
          setQuestions([]);
          setProgressList([]);
          setScreen('dashboard');
          setLoading(false);
        } else {
          setProfile(uProfile);
          await loadCoreData(uProfile);
        }
      } else {
        // Fallback profile if none exists yet (ONLY for the Admin/Instructor)
        if (currentEmail === 't.aglogallos@gmail.com') {
          const defaultProfile: StudentProfile = {
            uid: uid,
            name: 'Διαχειριστής',
            email: auth.currentUser?.email || '',
            role: 'instructor',
            createdAt: now,
            lastSignInAt: now,
            lastActiveAt: now,
            currentSessionId: localSid
          };
          await setDoc(docRef, defaultProfile);
          setProfile(defaultProfile);
          await loadCoreData(defaultProfile);
        } else {
          // If a student's Firestore profile is deleted, sign them out immediately
          await signOut(auth);
          setCurrentUser(null);
          setProfile(null);
          setQuestions([]);
          setProgressList([]);
          setScreen('dashboard');
          setLoading(false);
        }
      }
    } catch (err) {
      console.error("Error loading user profile: ", err);
      setLoading(false);
    }
  };

  // 3. Load Questions & Student Progress
  const loadCoreData = async (userProfile: StudentProfile) => {
    try {
      let loadedQuestions: ExamQuestion[] = [];

      // A. Load Questions
      const questionsSnap = await getDocs(collection(db, 'questions'));
      questionsSnap.forEach((d) => {
        loadedQuestions.push(d.data() as ExamQuestion);
      });

      // B. If zero questions in Firestore, automatically seed database / load SEED_QUESTIONS
      if (loadedQuestions.length === 0) {
        setSeeding(true);
        console.log("Seeding initial questions to Firestore database...");
        for (const q of SEED_QUESTIONS) {
          await setDoc(doc(db, 'questions', q.id), q);
        }
        setSeeding(false);
        loadedQuestions = [...SEED_QUESTIONS];
      }
      setQuestions(loadedQuestions);

      // C. Load Progress (Only if the logged-in user is a student)
      if (userProfile.role === 'student') {
        const loadedProgress: QuestionProgress[] = [];
        const progressSnap = await getDocs(collection(db, 'students', userProfile.uid, 'progress'));
        progressSnap.forEach((d) => {
          loadedProgress.push(d.data() as QuestionProgress);
        });
        setProgressList(loadedProgress);

        // Load Theory Progress
        const theoryProgress: string[] = [];
        const theorySnap = await getDocs(collection(db, 'students', userProfile.uid, 'theoryProgress'));
        theorySnap.forEach((d) => {
          if (d.data().completed) {
            theoryProgress.push(d.id);
          }
        });
        setCompletedTheoryUnits(theoryProgress);
      }
    } catch (err) {
      console.error("Error loading core data: ", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (newProfile: StudentProfile) => {
    setProfile(newProfile);
    // Trigger core loading
    setLoading(true);
    loadCoreData(newProfile);
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      sessionStorage.removeItem('app_session_id');
      setSessionConflictMessage(null);
      await signOut(auth);
      // Reset state immediately
      setCurrentUser(null);
      setProfile(null);
      setQuestions([]);
      setProgressList([]);
      setCompletedTheoryUnits([]);
      setScreen('dashboard');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Callback to update student progress locally when an Anki review is completed
  const handleUpdateProgress = (newProgress: QuestionProgress) => {
    setProgressList((prev) => {
      const exists = prev.some(p => p.questionId === newProgress.questionId);
      if (exists) {
        return prev.map(p => p.questionId === newProgress.questionId ? newProgress : p);
      }
      return [...prev, newProgress];
    });
  };

  const handleToggleTheoryUnit = async (unitId: string, subject: Subject) => {
    if (!profile) return;
    const isCompleted = completedTheoryUnits.includes(unitId);
    const updated = isCompleted
      ? completedTheoryUnits.filter(id => id !== unitId)
      : [...completedTheoryUnits, unitId];
    
    setCompletedTheoryUnits(updated);
    
    try {
      const docRef = doc(db, 'students', profile.uid, 'theoryProgress', unitId);
      await setDoc(docRef, {
        unitId,
        subject,
        completed: !isCompleted,
        completedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating theory progress: ", err);
    }
  };

  const handleUnitRead = (unitId: string, subject: Subject) => {
    setLastReadUnitId(unitId);
    setLastReadSubject(subject);
    localStorage.setItem('lastReadUnitId', unitId);
    localStorage.setItem('lastReadSubject', subject);
  };

  const handleContinueStudy = () => {
    if (lastReadUnitId && lastReadSubject) {
      setSelectedSubjectPage(lastReadSubject);
      setScreen('subject_page');
    } else {
      setSelectedSubjectPage('biology');
      setScreen('subject_page');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-700 font-sans">
        <Loader className="h-10 w-10 text-sky-600 animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">
          {seeding ? "Προετοιμασία Τράπεζας Ερωτήσεων..." : "Φόρτωση συστήματος μελέτης..."}
        </p>
      </div>
    );
  }

  // If not logged in, show Auth
  if (!currentUser || !profile) {
    return (
      <Auth 
        onAuthSuccess={handleAuthSuccess}
        sessionConflictMessage={sessionConflictMessage}
        onClearSessionConflict={() => setSessionConflictMessage(null)}
      />
    );
  }

  // INSTRUCTOR WORKSPACE LAYOUT
  if (profile.role === 'instructor') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        {/* Custom Header Navigation */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DrGatoniLogo className="h-9 w-9 drop-shadow-sm hover:scale-105 transition-transform" />
              <span className="font-extrabold text-slate-800 text-lg tracking-tight">
                drgatoni<span className="text-amber-500">.gr</span> <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full ml-1">Καθηγητής</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-bold text-slate-800 leading-none">{profile.name}</span>
                <span className="text-xs text-amber-600 font-semibold mt-0.5">Διευθυντής Κλινικής 🩺</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 transition-all cursor-pointer"
                title="Αποσύνδεση"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <InstructorView 
            instructorProfile={profile}
            questions={questions}
            onQuestionsUpdated={(updated) => setQuestions(updated)}
            onLogout={handleLogout}
          />
        </main>
      </div>
    );
  }

  // STUDENT LAYOUT
  const isExpired = profile && profile.role === 'student' && isSubscriptionExpired(profile.subscriptionExpiresAt);

  if (isExpired) {
    return (
      <div id="expired-subscription-container" className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-800 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-rose-50 text-rose-600 mb-4 border border-rose-100 shadow-sm"
          >
            <ShieldAlert className="h-9 w-9" />
          </motion.div>
          
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Λήξη Συνδρομής
          </h2>
          <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto italic">
            Η πρόσβασή σας έχει απενεργοποιηθεί προσωρινά
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-rose-200"
          >
            <div className="bg-rose-50/50 rounded-xl p-4 border border-rose-100 text-xs text-rose-800 space-y-3 leading-relaxed font-medium mb-6">
              <p>
                ⚠️ <strong>Προσοχή:</strong> Η συνδρομή σας στο σύστημα προετοιμασίας έληξε στις{' '}
                <strong className="underline">
                  {new Date(profile!.subscriptionExpiresAt!).toLocaleDateString('el-GR')}
                </strong>
                .
              </p>
              <p>
                Για να ανανεώσετε τη συνδρομή σας και να αποκτήσετε ξανά άμεση πρόσβαση στην ύλη, την τράπεζα ερωτήσεων και τις αναφορές προόδου, παρακαλούμε επικοινωνήστε με τον καθηγητή σας.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Στοιχεία Επικοινωνίας Καθηγητή</span>
                <a href="mailto:t.aglogallos@gmail.com" className="text-sm font-extrabold text-sky-600 hover:underline">
                  t.aglogallos@gmail.com
                </a>
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer text-center"
              >
                Αποσύνδεση
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // STUDENT LAYOUT
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Student Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setScreen('dashboard')}
          >
            <DrGatoniLogo className="h-9 w-9 drop-shadow-sm hover:scale-105 transition-transform" />
            <span className="font-extrabold text-slate-800 text-lg tracking-tight">
              drgatoni<span className="text-amber-500">.gr</span> <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full ml-1">Φοιτητής</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick stats on bar */}
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex flex-col text-right">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Πρόοδος</span>
                <span className="text-xs text-amber-600 font-bold">
                  {progressList.length} / {questions.length} ερωτ.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex flex-col text-right font-sans">
                <span className="text-sm font-bold text-slate-800 leading-none">{profile.name}</span>
                <span className="text-xs text-amber-500 font-semibold mt-0.5">Ειδικευόμενος 🩺</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 transition-all cursor-pointer"
                title="Αποσύνδεση"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Screen Router */}
      <main className="flex-1 pb-16">
        {screen === 'dashboard' && (
          <Dashboard
            profile={profile}
            questions={questions}
            progressList={progressList}
            completedTheoryUnits={completedTheoryUnits}
            onStartSubjectStudy={(subj) => {
              setSelectedSubjectPage(subj);
              setScreen('subject_page');
            }}
            onStartMixedStudy={() => {
              setStudySubject('mixed');
              setScreen('study');
            }}
            onViewWrongLog={() => setScreen('wrong_log')}
            onContinueStudy={handleContinueStudy}
            onStartCustomQuiz={(filteredQs, customTitle) => {
              setCustomExamQuestions(filteredQs);
              setCustomExamTitle(customTitle);
              setScreen('mock_exam');
            }}
          />
        )}

        {screen === 'subject_page' && selectedSubjectPage && (
          <SubjectPage
            subject={selectedSubjectPage}
            questions={questions}
            progressList={progressList}
            profile={profile}
            completedTheoryUnits={completedTheoryUnits}
            onToggleTheoryUnit={handleToggleTheoryUnit}
            onBack={() => setScreen('dashboard')}
            initialReadingUnitId={selectedSubjectPage === lastReadSubject ? lastReadUnitId : null}
            onUnitRead={handleUnitRead}
            onStartCustomQuiz={(filteredQs, customTitle) => {
              setCustomExamQuestions(filteredQs);
              setCustomExamTitle(customTitle);
              setScreen('mock_exam');
            }}
          />
        )}

        {screen === 'study' && (
          <AnkiSession
            profile={profile}
            subject={studySubject}
            questions={questions}
            progressList={progressList}
            onFinish={() => setScreen('dashboard')}
            onUpdateProgress={handleUpdateProgress}
          />
        )}

        {screen === 'wrong_log' && (
          <WrongLog
            progressList={progressList}
            questions={questions}
            studentId={profile.uid}
            onStartWrongStudy={() => {
              setStudySubject('wrong');
              setScreen('study');
            }}
            onBack={() => setScreen('dashboard')}
            onUpdateProgress={handleUpdateProgress}
          />
        )}

        {screen === 'mock_exam' && (
          <MockExam
            profile={profile}
            questions={questions}
            progressList={progressList}
            preselectedQuestions={customExamQuestions}
            examTitle={customExamTitle}
            onFinish={() => {
              setCustomExamQuestions(undefined);
              setCustomExamTitle(undefined);
              setScreen('dashboard');
            }}
            onUpdateProgress={handleUpdateProgress}
          />
        )}
      </main>
    </div>
  );
}
