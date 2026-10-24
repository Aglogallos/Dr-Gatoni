import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { StudentProfile } from '../types';
import { motion } from 'motion/react';
import { Lock, Mail, ShieldAlert } from 'lucide-react';
import { DrGatoniLogo } from './DrGatoniLogo';

interface AuthProps {
  onAuthSuccess: (profile: StudentProfile) => void;
  sessionConflictMessage?: string | null;
  onClearSessionConflict?: () => void;
}

export default function Auth({ onAuthSuccess, sessionConflictMessage, onClearSessionConflict }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateSessionId = () => {
    const sid = typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID 
      ? window.crypto.randomUUID() 
      : `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('app_session_id', sid);
    return sid;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const targetEmail = email.trim().toLowerCase();
    const targetPassword = password;

    try {
      // Sign In
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, targetEmail, targetPassword);
      } catch (signInErr: any) {
        // Automatically provision the admin account if it's the requested email and password
        if (
          targetEmail === 't.aglogallos@gmail.com' && 
          targetPassword === 'Rubia4ever@med!' && 
          (signInErr.code === 'auth/user-not-found' || 
           signInErr.code === 'auth/invalid-credential' || 
           signInErr.code === 'auth/user-disabled' ||
           signInErr.code === 'auth/wrong-password')
        ) {
          console.log("Admin account not found. Provisioning admin credentials...");
          try {
            userCredential = await createUserWithEmailAndPassword(auth, targetEmail, targetPassword);
            const user = userCredential.user;
            const newSessionId = generateSessionId();
            const now = new Date().toISOString();
            const adminProfile: StudentProfile = {
              uid: user.uid,
              name: 'Διαχειριστής',
              email: targetEmail,
              role: 'instructor',
              createdAt: now,
              lastSignInAt: now,
              lastActiveAt: now,
              currentSessionId: newSessionId
            };
            await setDoc(doc(db, 'students', user.uid), adminProfile);
            onAuthSuccess(adminProfile);
            return;
          } catch (createErr: any) {
            if (createErr.code === 'auth/email-already-in-use') {
              const adminErr = new Error('ADMIN_EXISTS_IN_AUTH');
              (adminErr as any).code = 'ADMIN_EXISTS_IN_AUTH';
              throw adminErr;
            }
            throw createErr;
          }
        }
        throw signInErr;
      }

      const user = userCredential.user;
      const newSessionId = generateSessionId();
      const now = new Date().toISOString();

      // Fetch profile
      const profileDoc = await getDoc(doc(db, 'students', user.uid));
      if (profileDoc.exists()) {
        const uProfile = profileDoc.data() as StudentProfile;
        
        // Prevent inactive students from logging in
        if (uProfile.inactive && targetEmail !== 't.aglogallos@gmail.com') {
          await auth.signOut();
          const inactiveErr = new Error('ACCOUNT_INACTIVE');
          (inactiveErr as any).code = 'ACCOUNT_INACTIVE';
          throw inactiveErr;
        }
        
        // Hard enforcement that t.aglogallos@gmail.com is ALWAYS the instructor/admin
        let updatedProfile: StudentProfile = {
          ...uProfile,
          currentSessionId: newSessionId,
          lastSignInAt: now,
          lastActiveAt: now
        };

        if (targetEmail === 't.aglogallos@gmail.com' && uProfile.role !== 'instructor') {
          updatedProfile = {
            ...updatedProfile,
            role: 'instructor' as const,
            name: 'Διαχειριστής'
          };
        }

        await setDoc(doc(db, 'students', user.uid), updatedProfile, { merge: true });
        onAuthSuccess(updatedProfile);
      } else {
        // Create default profile ONLY if the user is the admin
        if (targetEmail === 't.aglogallos@gmail.com') {
          const defaultProfile: StudentProfile = {
            uid: user.uid,
            name: 'Διαχειριστής',
            email: user.email || '',
            role: 'instructor',
            createdAt: now,
            lastSignInAt: now,
            lastActiveAt: now,
            currentSessionId: newSessionId
          };
          await setDoc(doc(db, 'students', user.uid), defaultProfile);
          onAuthSuccess(defaultProfile);
        } else {
          // If it is a student whose Firestore document was deleted, deny login and sign out immediately
          await auth.signOut();
          const inactiveErr = new Error('ACCOUNT_INACTIVE');
          (inactiveErr as any).code = 'ACCOUNT_INACTIVE';
          throw inactiveErr;
        }
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Παρουσιάστηκε σφάλμα κατά την αυθεντικοποίηση.';
      if (err.code === 'ACCOUNT_INACTIVE') {
        errMsg = 'Ο λογαριασμός σας δεν είναι πλέον ενεργός ή έχει διαγραφεί. Παρακαλώ επικοινωνήστε με τον διαχειριστή.';
      } else if (err.code === 'ADMIN_EXISTS_IN_AUTH') {
        errMsg = 'Το email σας (t.aglogallos@gmail.com) υπάρχει ήδη στο Firebase Authentication (πιθανότατα από προηγούμενη σύνδεση "Σύνδεση με Google") αλλά χωρίς τον σωστό κωδικό πρόσβασης.\n\nΓια να συνδεθείτε επιτυχώς:\n1. Συνδεθείτε στο Firebase Console του έργου σας.\n2. Πηγαίνετε στο μενού Authentication -> Users.\n3. Βρείτε τον χρήστη t.aglogallos@gmail.com, κάντε κλικ στις 3 τελείες (Δεξιά) και επιλέξτε "Delete account" (Διαγραφή).\n4. Επιστρέψτε εδώ και δοκιμάστε ξανά με τον κωδικό σας. Ο λογαριασμός θα δημιουργηθεί αυτόματα με τον σωστό κωδικό!';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = 'Λανθασμένο email ή κωδικός πρόσβασης.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'Αυτό το email χρησιμοποιείται ήδη.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Ο κωδικός πρόσβασης πρέπει να είναι τουλάχιστον 6 χαρακτήρες.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Μη έγκυρη διεύθυνση email.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'Η είσοδος με Email/Password δεν είναι ενεργοποιημένη στο Firebase Console.';
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-container" className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-800 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center justify-center mb-2"
        >
          <DrGatoniLogo className="h-28 w-28 drop-shadow-md hover:rotate-6 transition-transform cursor-pointer duration-300" />
        </motion.div>
        
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 flex items-center justify-center gap-1">
          drgatoni<span className="text-amber-500 font-medium">.gr</span> 🐱🩺
        </h2>
        <p className="mt-2 text-sm text-slate-600 max-w-xs mx-auto font-medium leading-relaxed">
          Ο έξυπνος τρόπος για να γίνεις Γιατρός!
          <br />
          <span className="text-xs text-amber-600 italic block mt-1.5">
            Περιέχει tips & tricks από ιατρούς γάτους καθώς και παλιά θέματα κατατακτηρίων και τμηματικών
          </span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-amber-150"
        >
          {sessionConflictMessage && (
            <div className="mb-5 bg-amber-50 border-2 border-amber-300 text-amber-950 p-4 rounded-xl text-xs flex flex-col gap-2 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 animate-bounce" />
                <span>Αποσύνδεση Λόγω Ταυτόχρονης Εισόδου</span>
              </div>
              <p className="leading-relaxed font-medium text-amber-900">
                {sessionConflictMessage}
              </p>
              {onClearSessionConflict && (
                <button 
                  type="button"
                  onClick={onClearSessionConflict}
                  className="mt-1 self-end px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Κατάλαβα
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-500 animate-pulse" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleAuth}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Διεύθυνση Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
                  placeholder="student@drgatoni.gr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Κωδικός Πρόσβασης
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50 cursor-pointer text-center"
              >
                {loading ? 'Παρακαλώ περιμένετε...' : 'Είσοδος στην Κλινική 🐾'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
            Η εγγραφή νέων λογαριασμών γίνεται αποκλειστικά από τον <strong>Διαχειριστή (Admin)</strong>.
            <br />
            Εάν είστε συνδρομητής και δεν έχετε λάβει τα στοιχεία εισόδου σας, επικοινωνήστε με τον υπεύθυνο.
          </div>
        </motion.div>
      </div>
    </div>
  );
}

