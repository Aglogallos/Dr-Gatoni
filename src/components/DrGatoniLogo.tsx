import React from 'react';

// Highly polished, inline SVG Vector Mascot of Dr. Gatoni
export function DrGatoniLogo({ className = "h-20 w-20" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Circle Background */}
      <circle cx="50" cy="50" r="48" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2.5"/>
      
      {/* Cat ears */}
      <path d="M28 36 L15 12 L38 25 Z" fill="#F59E0B" stroke="#D97706" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M72 36 L85 12 L62 25 Z" fill="#F59E0B" stroke="#D97706" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M30 33 L21 17 L36 26 Z" fill="#FEE2E2" />
      <path d="M70 33 L79 17 L64 26 Z" fill="#FEE2E2" />
      
      {/* Cat Head */}
      <ellipse cx="50" cy="49" rx="28" ry="23" fill="#FBBF24" stroke="#D97706" strokeWidth="2"/>
      
      {/* Cat Eyes */}
      <circle cx="39" cy="44" r="5" fill="#1E293B"/>
      <circle cx="61" cy="44" r="5" fill="#1E293B"/>
      
      {/* Eye Highlights */}
      <circle cx="37.5" cy="42.5" r="1.5" fill="white"/>
      <circle cx="59.5" cy="42.5" r="1.5" fill="white"/>
      
      {/* Cat Glasses (Smart look) */}
      <circle cx="39" cy="44" r="8" stroke="#1E293B" strokeWidth="2" fill="none"/>
      <circle cx="61" cy="44" r="8" stroke="#1E293B" strokeWidth="2" fill="none"/>
      <line x1="47" y1="44" x2="53" y2="44" stroke="#1E293B" strokeWidth="2"/>
      <line x1="27" y1="42" x2="31" y2="44" stroke="#1E293B" strokeWidth="2"/>
      <line x1="73" y1="42" x2="69" y2="44" stroke="#1E293B" strokeWidth="2"/>
      
      {/* Snout & Nose */}
      <ellipse cx="50" cy="53" rx="6" ry="4" fill="#FEE2E2"/>
      <polygon points="48,51.5 52,51.5 50,54" fill="#EF4444"/>
      
      {/* Cute smile */}
      <path d="M46 55 Q50 58 50 55 C50 58 54 55 54 55" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      
      {/* Whiskers */}
      <line x1="20" y1="51" x2="9" y2="49" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="55" x2="11" y2="56" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="80" y1="51" x2="91" y2="49" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="80" y1="55" x2="89" y2="56" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
      
      {/* Doctor Collar & Coat */}
      <path d="M32 71 C32 65 37 60 42 60 L58 60 C63 60 68 65 68 71 L70 90 L30 90 Z" fill="white" stroke="#CBD5E1" strokeWidth="2"/>
      {/* Collar fold */}
      <path d="M40 60 L48 70 M60 60 L52 70" stroke="#CBD5E1" strokeWidth="1.5"/>
      {/* Red cross on pocket/lapel */}
      <rect x="58" y="68" width="6" height="6" rx="1" fill="#FEF2F2" stroke="#EF4444" strokeWidth="0.5"/>
      <path d="M61 69 L61 73 M59 71 L63 71" stroke="#EF4444" strokeWidth="1" strokeLinecap="round"/>
      
      {/* Stethoscope around neck */}
      <path d="M35 60 Q35 77 50 79 Q65 77 65 60" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <circle cx="50" cy="85" r="4.5" fill="#94A3B8" stroke="#475569" strokeWidth="1.5"/>
      <line x1="50" y1="79" x2="50" y2="85" stroke="#475569" strokeWidth="2"/>
    </svg>
  );
}

export interface GatoniQuote {
  quote: string;
  category: 'biology' | 'biochemistry' | 'physics' | 'general';
}

export const GATONI_QUOTES: GatoniQuote[] = [
  {
    quote: "Η Βιολογία είναι απλή: αν κινείται, είναι Βιολογία. Αν μυρίζει, είναι Βιοχημεία. Αν δεν δουλεύει... είναι Ιατρική Φυσική! 🧪",
    category: 'general'
  },
  {
    quote: "Ο Dr. Gatoni συμβουλεύει: 9 στις 10 γάτες προτείνουν 45 λεπτά διάβασμα και 15 λεπτά ύπνο πάνω στο πληκτρολόγιο του καθηγητή! 😴⌨️",
    category: 'general'
  },
  {
    quote: "Το DNA έχει διπλή έλικα για να μπορεί να τεντώνεται σαν γάτα το πρωί! Νιάου! 🧬🐈",
    category: 'biology'
  },
  {
    quote: "Η γλυκόλυση παράγει ATP. Το ATP είναι το 'γατο-κέρμα' που ξοδεύει το κύτταρο για να κυνηγήσει το λέιζερ της γνώσης! 🪙✨",
    category: 'biochemistry'
  },
  {
    quote: "Η ακουστική εμπέδηση (Z = ρ * c) μας δείχνει πόσο δύσκολο είναι για τον ήχο να περάσει από ένα μέσο. Σαν να προσπαθείς να κάνεις μπάνιο μια γάτα! 🚿😿",
    category: 'physics'
  },
  {
    quote: "Ο ρυθμός διάσπασης των ραδιοϊσοτόπων είναι εκθετικός. Σαν την ταχύτητα που εξαφανίζεται το φαγητό μου όταν ακουστεί το κονσερβοκούτι! 🥫⚡",
    category: 'physics'
  },
  {
    quote: "Οι πρωτεΐνες αναδιπλώνονται σε τρισδιάστατη δομή. Αν αναδιπλωθούν λάθος, έχουμε prion. Αν η γάτα αναδιπλωθεί λάθος, έχουμε απλά μια γάτα που κοιμάται σε παράξενη γωνία! 😹📦",
    category: 'biochemistry'
  },
  {
    quote: "Η μίτωση έχει 4 φάσεις: Πρόφαση, Μετάφαση, Ανάφαση, Τελόφαση. Εγώ έχω 2 φάσεις: Ύπνος και zoomies στις 3:00 π.μ.! 🌙🏃‍♂️",
    category: 'biology'
  },
  {
    quote: "Τα σωματίδια άλφα (α) σταματούν από ένα φύλλο χαρτί. Οι ακτίνες γάμμα (γ) θέλουν μόλυβδο. Το βλέμμα μου όταν η μπολ είναι μισοάδεια... διαπερνά τα πάντα! 🛸💀",
    category: 'physics'
  },
  {
    quote: "Τα ένζυμα είναι βιολογικοί καταλύτες. Μειώνουν την ενέργεια ενεργοποίησης, όπως εγώ μειώνω την ενέργεια που χρειάζεσαι για να γελάσεις! 🧪😻",
    category: 'biochemistry'
  },
  {
    quote: "Gatoni Slang Rule: Αν δεν ξέρεις την απάντηση, μην κάνεις τον 'ψόφιο κοριό', κάνε το 'έξυπνο γατόνι' και αποκλείσε τις 2 προφανώς λάθος επιλογές! 🧠🐾",
    category: 'general'
  },
  {
    quote: "Η μεμβράνη του κυττάρου είναι ημιδιαπερατή: αφήνει να περάσουν μόνο τα εκλεκτά μόρια, όπως εγώ αφήνω μόνο τις εκλεκτές λιχουδιές να μπουν στο στομάχι μου! 🍤🧬",
    category: 'biology'
  }
];

export function getDrGatoniQuote(subject?: string): string {
  const filtered = subject
    ? GATONI_QUOTES.filter(q => q.category === subject || q.category === 'general')
    : GATONI_QUOTES;
  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex].quote;
}

export interface GatometroLevel {
  level: string;
  emoji: string;
  description: string;
  colorClass: string;
  bgColorClass: string;
}

export function getGatometroStatus(successRate: number, studiedCount: number): GatometroLevel {
  if (studiedCount === 0) {
    return {
      level: "Νεογέννητο Γατάκι",
      emoji: "🐱🐣",
      description: "Μόλις άνοιξες τα μάτια σου στον κόσμο της Ιατρικής! Κάνε την πρώτη σου ερώτηση για να ξεκινήσεις το κυνήγι!",
      colorClass: "text-slate-500",
      bgColorClass: "bg-slate-50 border-slate-200"
    };
  }

  if (successRate < 50) {
    return {
      level: "Νυσταγμένο Γατάκι",
      emoji: "🙀💤",
      description: "Μάλλον κοιμάσαι πάνω στο πληκτρολόγιο! Χρειάζεσαι επειγόντως καφεΐνη ή ένα καλό ξύπνημα από τον Dr. Gatoni!",
      colorClass: "text-amber-500 font-bold",
      bgColorClass: "bg-amber-50/50 border-amber-200"
    };
  } else if (successRate >= 50 && successRate < 75) {
    return {
      level: "Γάτος του Δρόμου",
      emoji: "🐈🐾",
      description: "Είσαι σκληρός παίκτης! Ξέρεις να επιβιώνεις στις δύσκολες ερωτήσεις, αλλά χρειάζεσαι λίγο ακόμα ακόνισμα νυχιών!",
      colorClass: "text-blue-500 font-bold",
      bgColorClass: "bg-blue-50/50 border-blue-200"
    };
  } else if (successRate >= 75 && successRate < 90) {
    return {
      level: "Γατόνι της Ιατρικής",
      emoji: "🦁🎓",
      description: "Είσαι επίσημα 'γατόνι' (πανέξυπνος)! Οι καθηγητές σε κοιτάζουν με θαυμασμό. Η Ιατρική Σχολή σε περιμένει!",
      colorClass: "text-emerald-500 font-bold",
      bgColorClass: "bg-emerald-50/50 border-emerald-200"
    };
  } else {
    return {
      level: "Διάδοχος του Dr. Gatoni",
      emoji: "🩺👑🐱",
      description: "Απόλυτος θρύλος! Έχεις 9 ζωές και 100% ιατρικό ένστικτο. Ο Dr. Gatoni σκέφτεται να σου παραδώσει την κλινική του!",
      colorClass: "text-indigo-600 font-extrabold",
      bgColorClass: "bg-indigo-50/50 border-indigo-200"
    };
  }
}
