import React, { useState, useEffect } from 'react';
import { Subject, StudentProfile, QuestionProgress, ExamQuestion } from '../types';
import { db, firebaseConfig } from '../firebase';
import { CURRICULUM } from '../data/curriculum';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut as firebaseSignOut } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Users, 
  BookOpen, 
  Check, 
  X, 
  BarChart, 
  PlusCircle, 
  GraduationCap, 
  Dna, 
  FlaskConical, 
  Activity, 
  ChevronRight,
  UserCheck,
  UserX,
  Search,
  Filter,
  Image,
  KeyRound,
  Mail,
  User,
  ShieldCheck,
  Calendar,
  ArrowUpDown,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  Eye,
  EyeOff,
  Lock
} from 'lucide-react';

interface InstructorViewProps {
  instructorProfile: StudentProfile;
  questions: ExamQuestion[];
  onQuestionsUpdated: (updatedQuestions: ExamQuestion[]) => void;
  onLogout: () => void;
}

export default function InstructorView({
  instructorProfile,
  questions,
  onQuestionsUpdated,
  onLogout
}: InstructorViewProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'questions'>('students');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [studentsProgress, setStudentsProgress] = useState<Record<string, QuestionProgress[]>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Question editing / adding form state
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);
  const [formSubject, setFormSubject] = useState<Subject>('biology');
  const [formChapterId, setFormChapterId] = useState('');
  const [formUnitId, setFormUnitId] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formText, setFormText] = useState('');
  const [formOptions, setFormOptions] = useState<string[]>(['', '', '', '']);
  const [formCorrectIndex, setFormCorrectIndex] = useState(0);
  const [formExplanation, setFormExplanation] = useState('');
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Student account creation state
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  // Student sorting and editing states
  const [studentSortBy, setStudentSortBy] = useState<'createdAt' | 'expiresAt' | 'name'>('createdAt');
  const [studentStatusTab, setStudentStatusTab] = useState<'active' | 'inactive'>('active');
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [editSubPaymentDate, setEditSubPaymentDate] = useState('');
  const [editSubDuration, setEditSubDuration] = useState('');
  const [editSubExpiresAt, setEditSubExpiresAt] = useState('');
  const [editStudentPassword, setEditStudentPassword] = useState('');
  const [savingStudentData, setSavingStudentData] = useState(false);

  // Custom confirmation/alert dialog state
  const [dialogConfig, setDialogConfig] = useState<{
    type: 'confirm' | 'alert';
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);

  const showCustomConfirm = (title: string, message: string, onConfirm: () => void) => {
    setDialogConfig({
      type: 'confirm',
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setDialogConfig(null);
      },
      onCancel: () => setDialogConfig(null)
    });
  };

  const showCustomAlert = (title: string, message: string) => {
    setDialogConfig({
      type: 'alert',
      title,
      message,
      onConfirm: () => setDialogConfig(null)
    });
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<'all' | Subject>('all');
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');

  // Automatically update chapter & unit when formSubject changes, but only if NOT editing an existing question!
  useEffect(() => {
    if (editingQuestion) return; // Do not overwrite if we are editing!
    const curSubj = CURRICULUM[formSubject];
    if (curSubj && curSubj.chapters.length > 0) {
      setFormChapterId(curSubj.chapters[0].id);
      if (curSubj.chapters[0].units.length > 0) {
        setFormUnitId(curSubj.chapters[0].units[0].id);
      } else {
        setFormUnitId('');
      }
    } else {
      setFormChapterId('');
      setFormUnitId('');
    }
  }, [formSubject, editingQuestion]);

  // Load students and progress when the tab is active
  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudentsAndProgress();
    }
  }, [activeTab]);

  const fetchStudentsAndProgress = async () => {
    setLoadingStudents(true);
    try {
      if (instructorProfile.uid.startsWith('local-demo-')) {
        // Load mock student list and mock progress so the demo is interactive and realistic
        const mockStudents: StudentProfile[] = [
          {
            uid: 'local-demo-student-1',
            name: 'Κωνσταντίνος Γεωργίου',
            email: 'konstantinos@example.gr',
            role: 'student',
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            adminNotes: 'Πολύ επιμελής φοιτητής, χρειάζεται λίγη προσοχή στην Φυσική.',
            subscriptionPaymentDate: '2026-07-01',
            subscriptionDuration: '1 μήνας',
            subscriptionExpiresAt: '2026-08-01'
          },
          {
            uid: 'local-demo-student-2',
            name: 'Μαρία Βασιλείου',
            email: 'maria@example.gr',
            role: 'student',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            adminNotes: 'Λήξη συνδρομής. Επικοινώνησε ότι θα πληρώσει αύριο.',
            subscriptionPaymentDate: '2026-06-10',
            subscriptionDuration: '1 μήνας',
            subscriptionExpiresAt: '2026-07-10'
          }
        ];
        setStudents(mockStudents);

        const mockProgressRecord: Record<string, QuestionProgress[]> = {
          'local-demo-student-1': [
            {
              questionId: 'q_bio_1',
              studentId: 'local-demo-student-1',
              subject: 'biology',
              state: 'review',
              ease: 2.5,
              interval: 4,
              nextReviewDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              lastReviewed: new Date().toISOString(),
              wrongCount: 1,
              correctCount: 3
            },
            {
              questionId: 'q_phys_1',
              studentId: 'local-demo-student-1',
              subject: 'physics',
              state: 'learning',
              ease: 1.8,
              interval: 1,
              nextReviewDate: new Date().toISOString(),
              lastReviewed: new Date().toISOString(),
              wrongCount: 2,
              correctCount: 1
            }
          ],
          'local-demo-student-2': [
            {
              questionId: 'q_bio_2',
              studentId: 'local-demo-student-2',
              subject: 'biology',
              state: 'review',
              ease: 2.7,
              interval: 6,
              nextReviewDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
              lastReviewed: new Date().toISOString(),
              wrongCount: 0,
              correctCount: 4
            }
          ]
        };
        setStudentsProgress(mockProgressRecord);
      } else {
        // 1. Fetch all student profiles
        const studentsSnap = await getDocs(collection(db, 'students'));
        const studentProfiles: StudentProfile[] = [];
        studentsSnap.docs.forEach(d => {
          const data = d.data() as StudentProfile;
          if (data.role === 'student' || !data.role) {
            studentProfiles.push(data);
          }
        });
        setStudents(studentProfiles);

        // 2. Fetch progress for all students
        const progressRecord: Record<string, QuestionProgress[]> = {};
        for (const student of studentProfiles) {
          const progressSnap = await getDocs(collection(db, 'students', student.uid, 'progress'));
          const list: QuestionProgress[] = [];
          progressSnap.docs.forEach(pDoc => {
            list.push(pDoc.data() as QuestionProgress);
          });
          progressRecord[student.uid] = list;
        }
        setStudentsProgress(progressRecord);
      }
    } catch (err) {
      console.error("Error fetching students progress: ", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFirstName.trim() || !studentLastName.trim() || !studentEmail.trim() || !studentPassword.trim()) {
      setStudentError('Παρακαλώ συμπληρώστε όλα τα πεδία.');
      return;
    }
    if (studentPassword.length < 6) {
      setStudentError('Ο κωδικός πρόσβασης πρέπει να είναι τουλάχιστον 6 χαρακτήρες.');
      return;
    }

    setCreatingStudent(true);
    setStudentError(null);

    const fullName = `${studentFirstName.trim()} ${studentLastName.trim()}`;

    try {
      // Real registration using secondary App context to avoid logging out active Admin!
      let tempApp;
      try {
        tempApp = initializeApp(firebaseConfig, `temp_admin_app_${Date.now()}`);
        const tempAuth = getAuth(tempApp);
        
        // Create user in Auth
        const userCred = await createUserWithEmailAndPassword(tempAuth, studentEmail.trim(), studentPassword);
        const newUser = userCred.user;
        
        // Sign out of temp auth immediately
        await firebaseSignOut(tempAuth);

        const newProfile: StudentProfile = {
          uid: newUser.uid,
          name: fullName,
          email: studentEmail.trim().toLowerCase(),
          role: 'student',
          createdAt: new Date().toISOString(),
          passwordPlain: studentPassword
        };

        // Save to firestore
        await setDoc(doc(db, 'students', newUser.uid), newProfile);
        
        // Update local state
        setStudents(prev => [newProfile, ...prev]);
        setStudentsProgress(prev => ({
          ...prev,
          [newUser.uid]: []
        }));
        
        setShowStudentModal(false);
        alert(`Ο λογαριασμός δημιουργήθηκε με επιτυχία!\n\nEmail: ${studentEmail}\nΚωδικός: ${studentPassword}\n\nΜπορείτε να δώσετε αυτά τα στοιχεία στο φοιτητή.`);
      } finally {
        if (tempApp) {
          await deleteApp(tempApp);
        }
      }
    } catch (err: any) {
      console.error("Error creating student account: ", err);
      let errorMsg = 'Αποτυχία δημιουργίας λογαριασμού. ';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg += 'Το email χρησιμοποιείται ήδη από άλλον χρήστη.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg += 'Η διεύθυνση email δεν είναι έγκυρη.';
      } else if (err.message) {
        errorMsg += err.message;
      }
      setStudentError(errorMsg);
    } finally {
      setCreatingStudent(false);
    }
  };

  const handleOpenAddForm = () => {
    setEditingQuestion(null);
    setFormSubject('biology');
    setFormChapterId('');
    setFormUnitId('');
    setFormImageUrl('');
    setFormText('');
    setFormOptions(['', '', '', '']);
    setFormCorrectIndex(0);
    setFormExplanation('');
    setShowForm(true);
  };

  const handleOpenEditForm = (q: ExamQuestion) => {
    setEditingQuestion(q);
    setFormSubject(q.subject);
    setFormChapterId(q.chapterId || '');
    setFormUnitId(q.unitId || '');
    setFormImageUrl(q.imageUrl || '');
    setFormText(q.text);
    // Clean option prefix if it is there (e.g. "α) ") so it is clean to edit
    const prefixes = ['α) ', 'β) ', 'γ) ', 'δ) '];
    const cleanedOptions = q.options.map((opt, i) => {
      if (opt.startsWith(prefixes[i])) {
        return opt.substring(prefixes[i].length);
      }
      return opt;
    });
    setFormOptions(cleanedOptions);
    setFormCorrectIndex(q.correctOptionIndex);
    setFormExplanation(q.explanation);
    setShowForm(true);
  };

  const handleOptionChange = (idx: number, val: string) => {
    setFormOptions(prev => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim() || formOptions.some(o => !o.trim()) || !formExplanation.trim()) {
      showCustomAlert("Ελλιπή Στοιχεία", "Παρακαλώ συμπληρώστε όλα τα πεδία της ερώτησης.");
      return;
    }

    setSavingQuestion(true);
    try {
      const id = editingQuestion ? editingQuestion.id : `q_${Date.now()}`;
      
      // Enforce the Greek prefixes (α) , β) etc) before saving to database for Anki display consistency
      const prefixes = ['α) ', 'β) ', 'γ) ', 'δ) '];
      const finalizedOptions = formOptions.map((opt, i) => {
        const trimmed = opt.trim();
        if (trimmed.startsWith(prefixes[i])) {
          return trimmed;
        }
        return `${prefixes[i]}${trimmed}`;
      });

      const questionData: ExamQuestion = {
        id,
        subject: formSubject,
        chapterId: formChapterId || undefined,
        unitId: formUnitId || undefined,
        imageUrl: formImageUrl.trim() || undefined,
        text: formText.trim(),
        options: finalizedOptions,
        correctOptionIndex: formCorrectIndex,
        explanation: formExplanation.trim(),
        createdBy: instructorProfile.uid,
        createdAt: editingQuestion?.createdAt || new Date().toISOString()
      };

      // Write to Firestore
      if (!instructorProfile.uid.startsWith('local-demo-')) {
        await setDoc(doc(db, 'questions', id), questionData);
      }

      // Update parent component state
      let updatedQuestionsList = [...questions];
      if (editingQuestion) {
        updatedQuestionsList = updatedQuestionsList.map(q => q.id === id ? questionData : q);
      } else {
        updatedQuestionsList.push(questionData);
      }
      onQuestionsUpdated(updatedQuestionsList);

      setShowForm(false);
    } catch (err) {
      console.error("Error saving question: ", err);
      showCustomAlert("Σφάλμα", "Αποτυχία αποθήκευσης ερώτησης.");
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = (id: string) => {
    showCustomConfirm(
      "Διαγραφή Ερώτησης",
      "Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την ερώτηση; Η ενέργεια αυτή είναι οριστική και δεν μπορεί να αναιρεθεί.",
      async () => {
        try {
          if (!instructorProfile.uid.startsWith('local-demo-')) {
            await deleteDoc(doc(db, 'questions', id));
          }
          const filtered = questions.filter(q => q.id !== id);
          onQuestionsUpdated(filtered);
          showCustomAlert("Επιτυχία", "Η ερώτηση διαγράφηκε επιτυχώς.");
        } catch (err) {
          console.error("Error deleting question: ", err);
          showCustomAlert("Σφάλμα", "Αποτυχία διαγραφής ερώτησης. Missing or insufficient permissions.");
        }
      }
    );
  };

  // Student activation status toggle handler
  const handleToggleStudentStatus = (studentId: string, currentInactive: boolean) => {
    const titleText = currentInactive ? "Ενεργοποίηση Λογαριασμού" : "Απενεργοποίηση Λογαριασμού";
    const messageText = currentInactive
      ? "Είστε σίγουροι ότι θέλετε να ενεργοποιήσετε ξανά αυτόν τον φοιτητή; Θα αποκτήσει ξανά άμεση πρόσβαση στην εφαρμογή."
      : "Είστε σίγουροι ότι θέλετε να απενεργοποιήσετε αυτόν τον φοιτητή; Ο λογαριασμός του θα παραμείνει αποθηκευμένος μαζί με την πρόοδό του, αλλά δεν θα έχει πλέον πρόσβαση στην εφαρμογή.";

    showCustomConfirm(
      titleText,
      messageText,
      async () => {
        try {
          const newInactiveState = !currentInactive;
          if (!instructorProfile.uid.startsWith('local-demo-')) {
            await updateDoc(doc(db, 'students', studentId), {
              inactive: newInactiveState
            });
          }
          setStudents(prev => prev.map(s => s.uid === studentId ? { ...s, inactive: newInactiveState } : s));
          showCustomAlert("Επιτυχία", `Ο λογαριασμός του φοιτητή ${newInactiveState ? "απενεργοποιήθηκε" : "ενεργοποιήθηκε"} με επιτυχία.`);
        } catch (err) {
          console.error("Error toggling student status: ", err);
          showCustomAlert("Σφάλμα", "Αποτυχία αλλαγής κατάστασης του φοιτητή. Missing or insufficient permissions.");
        }
      }
    );
  };

  // Student subscription/notes editing handlers
  const handleOpenEditStudentModal = (student: StudentProfile) => {
    setEditingStudent(student);
    setEditAdminNotes(student.adminNotes || '');
    setEditSubPaymentDate(student.subscriptionPaymentDate || '');
    setEditSubDuration(student.subscriptionDuration || '');
    setEditSubExpiresAt(student.subscriptionExpiresAt || '');
    setEditStudentPassword('');
  };

  const handleSaveStudentData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setSavingStudentData(true);
    try {
      let passwordToSave = editingStudent.passwordPlain || '';

      if (editStudentPassword.trim()) {
        const newPassword = editStudentPassword.trim();
        if (newPassword.length < 6) {
          showCustomAlert("Σφάλμα", "Ο νέος κωδικός πρέπει να είναι τουλάχιστον 6 χαρακτήρες.");
          setSavingStudentData(false);
          return;
        }

        if (!instructorProfile.uid.startsWith('local-demo-')) {
          if (!editingStudent.passwordPlain) {
            showCustomAlert("Σφάλμα", "Δεν είναι δυνατή η αυτόματη αλλαγή του κωδικού καθώς ο τρέχων κωδικός δεν είναι αποθηκευμένος στη βάση.");
            setSavingStudentData(false);
            return;
          }

          let tempApp;
          try {
            tempApp = initializeApp(firebaseConfig, `temp_admin_app_pwd_${Date.now()}`);
            const tempAuth = getAuth(tempApp);
            
            // Sign in as the student using their current email and plain text password
            const userCred = await signInWithEmailAndPassword(tempAuth, editingStudent.email, editingStudent.passwordPlain);
            const user = userCred.user;
            
            // Change their password in Firebase Auth
            await updatePassword(user, newPassword);
            
            // Sign out of temp auth
            await firebaseSignOut(tempAuth);
            
            passwordToSave = newPassword;
          } catch (pwdErr: any) {
            console.error("Error updating password in Auth: ", pwdErr);
            let errorMsg = "Αποτυχία ενημέρωσης κωδικού στο Firebase Auth. ";
            if (pwdErr.code === 'auth/wrong-password') {
              errorMsg += "Ο αποθηκευμένος κωδικός στη βάση δεν ταιριάζει με τον πραγματικό κωδικό του χρήστη.";
            } else if (pwdErr.message) {
              errorMsg += pwdErr.message;
            }
            showCustomAlert("Σφάλμα", errorMsg);
            setSavingStudentData(false);
            return;
          } finally {
            if (tempApp) {
              await deleteApp(tempApp);
            }
          }
        } else {
          passwordToSave = newPassword;
        }
      }

      const updatedProfile: StudentProfile = {
        ...editingStudent,
        adminNotes: editAdminNotes.trim(),
        subscriptionPaymentDate: editSubPaymentDate.trim(),
        subscriptionDuration: editSubDuration.trim(),
        subscriptionExpiresAt: editSubExpiresAt.trim() || undefined,
        passwordPlain: passwordToSave
      };

      if (!instructorProfile.uid.startsWith('local-demo-')) {
        await setDoc(doc(db, 'students', editingStudent.uid), updatedProfile);
      }

      setStudents(prev => prev.map(s => s.uid === editingStudent.uid ? updatedProfile : s));
      setEditingStudent(null);
      showCustomAlert("Επιτυχία", "Τα στοιχεία του φοιτητή ενημερώθηκαν επιτυχώς.");
    } catch (err) {
      console.error("Error saving student data: ", err);
      showCustomAlert("Σφάλμα", "Αποτυχία αποθήκευσης στοιχείων φοιτητή.");
    } finally {
      setSavingStudentData(false);
    }
  };

  // Check if subscription has expired
  const isSubscriptionExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const expiryDate = new Date(expiresAt);
    const today = new Date();
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return expiryDate < today;
  };

  // Helper to resolve chapter and unit names
  const getChapterAndUnitNames = (subject: Subject, chapterId?: string, unitId?: string) => {
    if (!chapterId) return null;
    const subjCur = CURRICULUM[subject];
    const ch = subjCur?.chapters.find(c => c.id === chapterId);
    if (!ch) return null;
    
    const un = ch.units.find(u => u.id === unitId);
    return {
      chapterName: ch.name,
      unitName: un ? un.name : undefined
    };
  };

  // Filter questions list with chapter and unit support
  const filteredQuestions = questions.filter(q => {
    const matchesSubject = subjectFilter === 'all' || q.subject === subjectFilter;
    const matchesChapter = chapterFilter === 'all' || q.chapterId === chapterFilter;
    const matchesUnit = unitFilter === 'all' || q.unitId === unitFilter;
    const matchesSearch = q.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          q.explanation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesChapter && matchesUnit && matchesSearch;
  });

  const subjectNames: Record<Subject, string> = {
    biology: 'Βιολογία',
    biochemistry: 'Βιοχημεία',
    physics: 'Ιατρική Φυσική'
  };

  const optionLabels = ['α', 'β', 'γ', 'δ'];

  // Calculate high-level student performance analytics
  const totalStudents = students.length;
  let overallTotalCorrect = 0;
  let overallTotalWrong = 0;
  
  Object.keys(studentsProgress).forEach(uid => {
    const pList = studentsProgress[uid];
    if (pList) {
      pList.forEach(p => {
        overallTotalCorrect += p.correctCount || 0;
        overallTotalWrong += p.wrongCount || 0;
      });
    }
  });

  const totalReviews = overallTotalCorrect + overallTotalWrong;
  const classAccuracy = totalReviews > 0 ? Math.round((overallTotalCorrect / totalReviews) * 100) : 100;

  return (
    <div id="instructor-view-container" className="max-w-6xl mx-auto px-4 py-8 text-slate-700 font-sans">
      {/* Welcome & Stats Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div>
          <span className="text-[10px] bg-sky-55 text-sky-700 border border-sky-100 font-bold px-3 py-1 rounded-full tracking-wider uppercase shadow-sm">
            Χώρος Εργασίας Καθηγητή
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
            Καλώς ήρθατε, {instructorProfile.name}!
          </h1>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed font-medium">
            Παρακολουθήστε την πρόοδο των μαθητών σας και διαχειριστείτε την ύλη των ερωτήσεων.
          </p>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg border border-slate-200 transition-all cursor-pointer text-slate-750 self-start md:self-center shadow-sm"
        >
          Αποσύνδεση
        </button>
      </div>

      {/* Stats Bento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 p-4.5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2 font-bold">
            <span className="text-[10px] tracking-wider uppercase">Εγγεγρ. Φοιτητές</span>
            <Users className="h-4.5 w-4.5 text-sky-600" />
          </div>
          <span className="text-2xl font-bold text-slate-900">{totalStudents}</span>
        </div>

        <div className="bg-white border border-slate-200 p-4.5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2 font-bold">
            <span className="text-[10px] tracking-wider uppercase">Ερωτήσεις Τράπεζας</span>
            <BookOpen className="h-4.5 w-4.5 text-sky-600" />
          </div>
          <span className="text-2xl font-bold text-slate-900">{questions.length}</span>
        </div>

        <div className="bg-white border border-slate-200 p-4.5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2 font-bold">
            <span className="text-[10px] tracking-wider uppercase">Μέσος Βαθμός Τάξης</span>
            <BarChart className="h-4.5 w-4.5 text-emerald-500" />
          </div>
          <span className="text-2xl font-bold text-emerald-600">{classAccuracy}%</span>
        </div>

        <div className="bg-white border border-slate-200 p-4.5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2 font-bold">
            <span className="text-[10px] tracking-wider uppercase">Συνολικές Επαναλ.</span>
            <UserCheck className="h-4.5 w-4.5 text-sky-600" />
          </div>
          <span className="text-2xl font-bold text-slate-900">{totalReviews}</span>
        </div>
      </div>

      {/* Tabs Switch */}
      <div className="flex border-b border-slate-200 mb-6 font-semibold">
        <button
          onClick={() => setActiveTab('students')}
          className={`py-3 px-6 text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'students' 
              ? 'border-sky-600 text-sky-600 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4.5 w-4.5" />
          Επίδοση Φοιτητών
        </button>
        <button
          onClick={() => setActiveTab('questions')}
          className={`py-3 px-6 text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'questions' 
              ? 'border-sky-600 text-sky-600 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="h-4.5 w-4.5" />
          Τράπεζα Ερωτήσεων ({questions.length})
        </button>
      </div>

      {/* STUDENTS PROGRESS REPORT TAB */}
      {activeTab === 'students' && (() => {
        const sortedStudents = [...students].sort((a, b) => {
          if (studentSortBy === 'createdAt') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          } else if (studentSortBy === 'expiresAt') {
            const dateA = a.subscriptionExpiresAt ? new Date(a.subscriptionExpiresAt).getTime() : Infinity;
            const dateB = b.subscriptionExpiresAt ? new Date(b.subscriptionExpiresAt).getTime() : Infinity;
            return dateA - dateB;
          } else if (studentSortBy === 'name') {
            return a.name.localeCompare(b.name, 'el-GR');
          }
          return 0;
        });

        const activeStudents = sortedStudents.filter(s => !s.inactive);
        const inactiveStudents = sortedStudents.filter(s => s.inactive);
        const currentStudentsToShow = studentStatusTab === 'active' ? activeStudents : inactiveStudents;

        return (
          <div id="students-tab-content" className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {studentStatusTab === 'active' ? 'Διαχείριση Ενεργών Λογαριασμών' : 'Διαχείριση Απενεργοποιημένων Λογαριασμών'}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">
                  {studentStatusTab === 'active'
                    ? 'Δημιουργήστε credentials για νέους συνδρομητές, διαχειριστείτε τις συνδρομές τους ή ελέγξτε τις επιδόσεις τους.'
                    : 'Δείτε τους απενεργοποιημένους φοιτητές. Μπορείτε να τους ενεργοποιήσετε ξανά ανά πάσα στιγμή χωρίς να χαθεί η πρόοδός τους.'
                  }
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* Sorting Select */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-slate-500 font-bold">Ταξινόμηση:</span>
                  <select
                    value={studentSortBy}
                    onChange={(e) => setStudentSortBy(e.target.value as any)}
                    className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="createdAt">Ημ. Εγγραφής</option>
                    <option value="expiresAt">Προθεσμία Λήξης (Πλησιέστερη)</option>
                    <option value="name">Όνομα</option>
                  </select>
                </div>

                <button 
                  onClick={fetchStudentsAndProgress}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Ανανέωση
                </button>
                <button
                  onClick={() => {
                    setStudentFirstName('');
                    setStudentLastName('');
                    setStudentEmail('');
                    setStudentPassword('');
                    setStudentError(null);
                    setShowStudentModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Νέος Λογαριασμός
                </button>
              </div>
            </div>

            {/* Sub Tabs for Active vs Inactive Students */}
            <div className="flex border-b border-slate-200 gap-2">
              <button
                onClick={() => setStudentStatusTab('active')}
                className={`py-3 px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  studentStatusTab === 'active'
                    ? 'border-indigo-600 text-indigo-600 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserCheck className="h-4.5 w-4.5 text-emerald-600" />
                Ενεργοί Φοιτητές ({activeStudents.length})
              </button>
              <button
                onClick={() => setStudentStatusTab('inactive')}
                className={`py-3 px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  studentStatusTab === 'inactive'
                    ? 'border-rose-500 text-rose-500 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserX className="h-4.5 w-4.5 text-rose-500" />
                Απενεργοποιημένοι Φοιτητές ({inactiveStudents.length})
              </button>
            </div>

            {loadingStudents ? (
              <div className="text-center py-12 text-slate-500">
                <span className="animate-pulse font-semibold text-sm">Φόρτωση αναφορών προόδου...</span>
              </div>
            ) : currentStudentsToShow.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs shadow-sm">
                {studentStatusTab === 'active'
                  ? 'Δεν υπάρχουν ακόμη ενεργοί εγγεγραμμένοι φοιτητές στο σύστημα.'
                  : 'Δεν υπάρχουν απενεργοποιημένοι φοιτητές στο σύστημα.'
                }
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentStudentsToShow.map(student => {
                  const sProgress = studentsProgress[student.uid] || [];
                  const studied = sProgress.length;
                  const wrongAnswersCount = sProgress.filter(p => p.wrongCount > 0).length;
                  
                  let sCorrect = 0;
                  let sWrong = 0;
                  sProgress.forEach(p => {
                    sCorrect += p.correctCount || 0;
                    sWrong += p.wrongCount || 0;
                  });
                  const totalSReviews = sCorrect + sWrong;
                  const sAccuracy = totalSReviews > 0 ? Math.round((sCorrect / totalSReviews) * 100) : 100;
                  
                  const expired = isSubscriptionExpired(student.subscriptionExpiresAt);
                  const isInactive = student.inactive;

                  return (
                    <div 
                      key={student.uid} 
                      className={`bg-white border p-5 rounded-xl flex flex-col justify-between shadow-sm transition-all relative ${
                        isInactive
                          ? 'border-slate-200 bg-slate-50/50 opacity-90'
                          : expired 
                            ? 'border-red-500 ring-2 ring-red-100 bg-red-50/10' 
                            : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        {isInactive ? (
                          <div className="absolute top-3 right-24 bg-slate-500 text-white font-extrabold text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            🚫 Απενεργοποιημένος
                          </div>
                        ) : expired ? (
                          <div className="absolute top-3 right-24 bg-red-600 text-white font-extrabold text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                            ⚠️ Εκπρόθεσμος
                          </div>
                        ) : null}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                              {student.name}
                            </h3>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[11px] text-slate-500 font-medium">{student.email}</span>
                              {(() => {
                                const isOnline = student.lastActiveAt && (Date.now() - new Date(student.lastActiveAt).getTime()) < 5 * 60 * 1000;
                                return (
                                  <div className="flex items-center gap-1.5 text-[10px] font-medium mt-0.5">
                                    {isOnline ? (
                                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                        <span>Ενεργός Τώρα</span>
                                      </span>
                                    ) : student.lastActiveAt ? (
                                      <span className="text-slate-400">
                                        Τελευταία δραστηριότητα: {new Date(student.lastActiveAt).toLocaleDateString('el-GR')} {new Date(student.lastActiveAt).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    ) : null}
                                  </div>
                                );
                              })()}
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-1">
                                <span className="text-slate-400">Κωδικός:</span>
                                {student.passwordPlain ? (
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                      {visiblePasswords[student.uid] ? student.passwordPlain : '••••••••'}
                                    </span>
                                    <button
                                      onClick={() => setVisiblePasswords(prev => ({ ...prev, [student.uid]: !prev[student.uid] }))}
                                      className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer flex items-center justify-center"
                                      title={visiblePasswords[student.uid] ? "Απόκρυψη" : "Εμφάνιση"}
                                    >
                                      {visiblePasswords[student.uid] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[10px]">Δεν έχει καταγραφεί</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditStudentModal(student)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Επεξεργασία Σχολίων & Συνδρομής"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            {isInactive ? (
                              <button
                                onClick={() => handleToggleStudentStatus(student.uid, true)}
                                className="p-1.5 text-slate-450 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Ενεργοποίηση Φοιτητή"
                              >
                                <UserCheck className="h-4 w-4 text-emerald-600" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleStudentStatus(student.uid, false)}
                                className="p-1.5 text-slate-450 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Απενεργοποίηση Φοιτητή"
                              >
                                <UserX className="h-4 w-4 text-rose-500" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs mt-4">
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 shadow-inner">
                            <span className="block font-bold text-sky-700">{studied} / {questions.length}</span>
                            <span className="text-[9px] text-slate-400 font-bold">Μελετημένα</span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 shadow-inner">
                            <span className="block font-bold text-emerald-700">{sAccuracy}%</span>
                            <span className="text-[9px] text-slate-400 font-bold">Επιτυχία</span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 shadow-inner">
                            <span className="block font-bold text-rose-700">{wrongAnswersCount}</span>
                            <span className="text-[9px] text-slate-400 font-bold">Ενεργά Λάθη</span>
                          </div>
                        </div>

                        {/* Subscription details and admin comments */}
                        <div className="mt-4 pt-3.5 border-t border-dashed border-slate-200 space-y-2">
                          <div className="flex flex-col gap-1 text-[11px]">
                            {student.subscriptionPaymentDate && (
                              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                                <CreditCard className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>Πληρωμή: <strong>{new Date(student.subscriptionPaymentDate).toLocaleDateString('el-GR')}</strong> {student.subscriptionDuration ? `(${student.subscriptionDuration})` : ''}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>
                                Λήξη Συνδρομής: {' '}
                                {student.subscriptionExpiresAt ? (
                                  <strong className={expired && !isInactive ? 'text-red-600 font-bold' : 'text-slate-800'}>
                                    {new Date(student.subscriptionExpiresAt).toLocaleDateString('el-GR')}
                                    {expired && !isInactive && ' (Εκπρόθεμη)'}
                                  </strong>
                                ) : (
                                  <span className="text-slate-400 italic">Δεν έχει οριστεί</span>
                                )}
                              </span>
                            </div>
                          </div>

                          {student.adminNotes && (
                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-[11px] text-slate-600 flex gap-1.5 leading-relaxed font-medium">
                              <MessageSquare className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                              <div className="w-full">
                                <span className="block text-[9px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">Σχόλια Διαχειριστή</span>
                                <div className="max-h-12 overflow-y-auto whitespace-pre-wrap">{student.adminNotes}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-150 text-[11px] text-slate-400 flex items-center justify-between font-medium">
                        <span>Εγγραφή: {new Date(student.createdAt).toLocaleDateString('el-GR')}</span>
                        <span>{totalSReviews} συνολικές προσπάθειες</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* QUESTION MANAGER TAB */}
      {activeTab === 'questions' && (
        <div id="questions-tab-content" className="space-y-6">
          {/* Top filter and actions bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative rounded-xl max-w-xs shrink-0 shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Αναζήτηση ερώτησης..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-lg shadow-sm">
                <button
                  onClick={() => {
                    setSubjectFilter('all');
                    setChapterFilter('all');
                    setUnitFilter('all');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    subjectFilter === 'all' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Όλα
                </button>
                {(['biology', 'biochemistry', 'physics'] as Subject[]).map(sub => (
                  <button
                    key={sub}
                    onClick={() => {
                      setSubjectFilter(sub);
                      setChapterFilter('all');
                      setUnitFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      subjectFilter === sub ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {subjectNames[sub]}
                  </button>
                ))}
              </div>

              {/* Dynamic Chapter & Unit Filters */}
              {subjectFilter !== 'all' && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-xs shadow-sm">
                    <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Κεφάλαιο:</span>
                    <select
                      value={chapterFilter}
                      onChange={(e) => {
                        setChapterFilter(e.target.value);
                        setUnitFilter('all');
                      }}
                      className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer max-w-xs text-[11px]"
                    >
                      <option value="all">Όλα τα Κεφάλαια</option>
                      {CURRICULUM[subjectFilter]?.chapters.map(ch => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))}
                    </select>
                  </div>

                  {chapterFilter !== 'all' && (
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-xs shadow-sm">
                      <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Ενότητα:</span>
                      <select
                        value={unitFilter}
                        onChange={(e) => setUnitFilter(e.target.value)}
                        className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer max-w-xs text-[11px]"
                      >
                        <option value="all">Όλες οι Ενότητες</option>
                        {CURRICULUM[subjectFilter]?.chapters
                          .find(c => c.id === chapterFilter)
                          ?.units.map(un => (
                            <option key={un.id} value={un.id}>{un.name}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleOpenAddForm}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-sky-600/10 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              Νέα Ερώτηση
            </button>
          </div>

          {/* ADD / EDIT QUESTION FORM */}
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-white border-2 border-sky-100 p-6 rounded-xl shadow-xl space-y-4"
            >
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-sky-600" />
                {editingQuestion ? 'Επεξεργασία Ερώτησης' : 'Δημιουργία Νέας Ερώτησης'}
              </h3>

              <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Μάθημα / Κατηγορία
                    </label>
                    <select
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value as Subject)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-sky-500"
                    >
                      <option value="biology">Βιολογία</option>
                      <option value="biochemistry">Βιοχημεία</option>
                      <option value="physics">Ιατρική Φυσική</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Κεφάλαιο
                    </label>
                    <select
                      value={formChapterId}
                      onChange={(e) => {
                        const nextChId = e.target.value;
                        setFormChapterId(nextChId);
                        // Automatically update to the first unit of this selected chapter
                        const ch = CURRICULUM[formSubject]?.chapters.find(c => c.id === nextChId);
                        if (ch && ch.units.length > 0) {
                          setFormUnitId(ch.units[0].id);
                        } else {
                          setFormUnitId('');
                        }
                      }}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-sky-500"
                    >
                      {CURRICULUM[formSubject]?.chapters.map(ch => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Ενότητα
                    </label>
                    <select
                      value={formUnitId}
                      onChange={(e) => setFormUnitId(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-sky-500"
                    >
                      {CURRICULUM[formSubject]?.chapters
                        .find(c => c.id === formChapterId)
                        ?.units.map(un => (
                          <option key={un.id} value={un.id}>{un.name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Σωστή Επιλογή
                    </label>
                    <select
                      value={formCorrectIndex}
                      onChange={(e) => setFormCorrectIndex(Number(e.target.value))}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-sky-500"
                    >
                      <option value={0}>α) Πρώτη επιλογή</option>
                      <option value={1}>β) Δεύτερη επιλογή</option>
                      <option value={2}>γ) Τρίτη επιλογή</option>
                      <option value={3}>δ) Τέταρτη επιλογή</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Διεύθυνση Εικόνας (URL - Προαιρετικά)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={formImageUrl}
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        placeholder="https://example.com/diagram.png"
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-sky-500 text-xs"
                      />
                      {formImageUrl && (
                        <button
                          type="button"
                          onClick={() => setFormImageUrl('')}
                          className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg border border-slate-200 cursor-pointer text-[10px] font-bold"
                        >
                          Καθαρισμός
                        </button>
                      )}
                    </div>
                    {formImageUrl && (
                      <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center">
                        <span className="text-[10px] text-slate-400 font-bold mb-1">Προεπισκόπηση Εικόνας:</span>
                        <img 
                          src={formImageUrl} 
                          alt="Προεπισκόπηση" 
                          className="max-h-32 object-contain rounded border border-slate-200 bg-white" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/300x150?text=%CE%A3%CF%86%CE%AC%CE%BB%CE%BC%CE%B1+%CE%A6%CF%8C%CF%81%CF%84%CF%89%CF%83%CE%B7%CF%82';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Κείμενο Ερώτησης
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-sky-500 placeholder-slate-400 leading-relaxed text-xs"
                    placeholder="Ποια είναι η λειτουργία..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {formOptions.map((opt, i) => (
                    <div key={i}>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        Επιλογή {optionLabels[i]}
                      </label>
                      <input
                        type="text"
                        required
                        value={opt}
                        onChange={(e) => handleOptionChange(i, e.target.value)}
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-sky-500 leading-normal text-xs"
                        placeholder={`Περιγραφή επιλογής ${optionLabels[i]}...`}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Επεξήγηση / Λύση Ερώτησης
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formExplanation}
                    onChange={(e) => setFormExplanation(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-sky-500 placeholder-slate-400 leading-relaxed text-xs"
                    placeholder="Η σωστή επιλογή είναι... επειδή..."
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-850 transition-all cursor-pointer font-semibold shadow-sm"
                  >
                    Ακύρωση
                  </button>
                  <button
                    type="submit"
                    disabled={savingQuestion}
                    className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-500 active:bg-sky-700 font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {savingQuestion ? 'Αποθήκευση...' : 'Αποθήκευση Ερώτησης'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* List of active questions in bank */}
          <div className="space-y-4">
            {filteredQuestions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-450 text-xs shadow-sm">
                Δεν βρέθηκαν ερωτήσεις με τα συγκεκριμένα κριτήρια.
              </div>
            ) : (
              filteredQuestions.map(q => (
                <div key={q.id} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-slate-300 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full">
                        {subjectNames[q.subject]}
                      </span>
                      {(() => {
                        const info = getChapterAndUnitNames(q.subject, q.chapterId, q.unitId);
                        if (!info) return null;
                        return (
                          <>
                            <span className="text-[10px] font-semibold bg-indigo-55 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full truncate max-w-[180px]" title={info.chapterName}>
                              {info.chapterName}
                            </span>
                            {info.unitName && (
                              <span className="text-[10px] font-semibold bg-sky-55 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-full truncate max-w-[180px]" title={info.unitName}>
                                {info.unitName}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditForm(q)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                        title="Επεξεργασία"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                        title="Διαγραφή"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-slate-850 leading-relaxed mb-4">
                    {q.text}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4 text-xs font-medium">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = oIdx === q.correctOptionIndex;
                      return (
                        <div 
                          key={oIdx} 
                          className={`p-2.5 rounded-lg border flex items-start gap-2 shadow-sm ${
                            isCorrect 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                              : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                          }`}
                        >
                          <span className={`h-4.5 w-4.5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 ${
                            isCorrect 
                              ? 'bg-emerald-500 text-white border-transparent' 
                              : 'bg-white text-slate-400 border border-slate-200'
                          }`}>
                            {optionLabels[oIdx]}
                          </span>
                          <span>{opt.replace(/^[α-δ]\)\s*/, '')}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-sky-50/50 rounded-lg p-3 border border-sky-100 shadow-inner">
                    <span className="block text-[9px] font-bold text-sky-700 uppercase tracking-wider mb-0.5">Επεξήγηση</span>
                    <p className="text-xs text-slate-650 leading-relaxed font-medium">{q.explanation}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* NEW STUDENT ACCOUNT CREATION MODAL OVERLAY */}
      <AnimatePresence>
        {showStudentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600" />
              
              <button
                onClick={() => setShowStudentModal(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-5 flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Νέος Λογαριασμός Φοιτητή</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Εισάγετε τα στοιχεία του νέου συνδρομητή.</p>
                </div>
              </div>

              <form onSubmit={handleCreateStudent} className="space-y-4 text-xs font-medium">
                {studentError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-[11px] leading-normal font-semibold flex items-start gap-2">
                    <X className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{studentError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Όνομα
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={studentFirstName}
                        onChange={(e) => setStudentFirstName(e.target.value)}
                        placeholder="π.χ. Ιωάννης"
                        className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Επώνυμο
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={studentLastName}
                        onChange={(e) => setStudentLastName(e.target.value)}
                        placeholder="π.χ. Παπαδόπουλος"
                        className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Διεύθυνση Email
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="student@example.gr"
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Κωδικός Πρόσβασης (Password)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      minLength={6}
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      placeholder="Ελάχιστο 6 χαρακτήρες"
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 text-xs font-medium"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold block mt-1">Σημειώστε αυτόν τον κωδικό για να τον δώσετε στο φοιτητή.</span>
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowStudentModal(false)}
                    className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-850 transition-all cursor-pointer font-bold"
                  >
                    Ακύρωση
                  </button>
                  <button
                    type="submit"
                    disabled={creatingStudent}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 active:bg-indigo-700 font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    {creatingStudent ? 'Δημιουργία...' : 'Δημιουργία Λογαριασμού'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative overflow-hidden text-slate-700 font-sans"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600" />
              
              <button
                onClick={() => setEditingStudent(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-4 flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Διαχείριση Φοιτητή</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Ενημερώστε τα σχόλια και τις πληροφορίες συνδρομής για τον/την {editingStudent.name}.</p>
                </div>
              </div>

              <form onSubmit={handleSaveStudentData} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Φοιτητής (Email)
                  </label>
                  <p className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 font-bold">
                    {editingStudent.name} ({editingStudent.email})
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Ημ. Πληρωμής
                    </label>
                    <input
                      type="date"
                      value={editSubPaymentDate}
                      onChange={(e) => setEditSubPaymentDate(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Διάρκεια
                    </label>
                    <input
                      type="text"
                      placeholder="π.χ. 1 μήνας"
                      value={editSubDuration}
                      onChange={(e) => setEditSubDuration(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Ημερομηνία Λήξης Συνδρομής (Ορίζεται από εσάς)
                  </label>
                  <input
                    type="date"
                    value={editSubExpiresAt}
                    onChange={(e) => setEditSubExpiresAt(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 text-xs font-semibold"
                  />
                  <span className="text-[9px] text-slate-400 font-bold mt-1 block">Προσοχή: Αν η ημερομηνία λήξης παρέλθει, ο φοιτητής θα εμφανίζεται με κόκκινο πλαίσιο.</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Σχόλια / Σημειώσεις Διαχειριστή
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Προσθέστε σημειώσεις ή σχόλια για τον φοιτητή..."
                    value={editAdminNotes}
                    onChange={(e) => setEditAdminNotes(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 text-xs font-medium resize-none"
                  />
                </div>

                <div className="border-t border-dashed border-slate-200 pt-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Αλλαγή Κωδικού Πρόσβασης (Προαιρετικά)
                  </label>
                  <div className="relative mb-2">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Εισάγετε νέο κωδικό για αλλαγή (ελάχ. 6 χαρακτήρες)"
                      value={editStudentPassword}
                      onChange={(e) => setEditStudentPassword(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 text-xs font-semibold"
                    />
                  </div>
                  {editingStudent.passwordPlain && (
                    <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 mt-1.5">
                      <span>Τρέχων αποθηκευμένος κωδικός:</span>
                      <span className="font-mono bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 text-indigo-700 font-bold">{editingStudent.passwordPlain}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-850 transition-all cursor-pointer font-bold"
                  >
                    Ακύρωση
                  </button>
                  <button
                    type="submit"
                    disabled={savingStudentData}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 active:bg-indigo-700 font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    {savingStudentData ? 'Αποθήκευση...' : 'Αποθήκευση'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {dialogConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 relative overflow-hidden text-slate-700 font-sans"
            >
              {/* Colored top-border accent depending on alert or confirm */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                dialogConfig.type === 'confirm' ? 'bg-rose-500' : 'bg-indigo-600'
              }`} />
              
              <div className="mb-4 flex items-start gap-3">
                <div className={`p-2.5 rounded-xl border shrink-0 ${
                  dialogConfig.type === 'confirm' 
                    ? 'bg-rose-50 text-rose-600 border-rose-100' 
                    : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                }`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{dialogConfig.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1 font-medium">{dialogConfig.message}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {dialogConfig.type === 'confirm' && (
                  <button
                    type="button"
                    onClick={dialogConfig.onCancel}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Ακύρωση
                  </button>
                )}
                <button
                  type="button"
                  onClick={dialogConfig.onConfirm}
                  className={`px-3.5 py-1.5 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm ${
                    dialogConfig.type === 'confirm' 
                      ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700' 
                      : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
                  }`}
                >
                  {dialogConfig.type === 'confirm' ? 'Διαγραφή' : 'Εντάξει'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
