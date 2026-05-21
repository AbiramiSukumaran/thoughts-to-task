/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  CheckSquare,
  Mic,
  Square,
  Sparkles,
  Calendar,
  Clock,
  ArrowUpRight,
  CheckSquare2,
  Trash2,
  Edit3,
  Plus,
  Search,
  ChevronRight,
  TrendingUp,
  LogOut,
  Sliders,
  Check,
  RotateCcw,
  Zap,
  Tag,
  Lightbulb,
  CornerDownRight,
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { Thought, Task, TaskSubtask } from './types';

// Web Speech Recognition Definition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Thought Input states
  const [rawText, setRawText] = useState('');
  const [inputType, setInputType] = useState<'text' | 'voice' | 'template'>('text');
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Conversion process states
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Application Data lists
  const [tasks, setTasks] = useState<Task[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // App Filtering/Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active');

  // Editing Task modal state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editCategory, setEditCategory] = useState('');
  const [editDuration, setEditDuration] = useState<number>(30);
  const [editDueDate, setEditDueDate] = useState('');

  // Setup standard list triggers
  useEffect(() => {
    // Check Speech Recognition capability
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setRawText((prev) => (prev + ' ' + finalTranscript).trim());
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech Recognition Error: ', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access blocked. Please enable mic permissions in your browser bar.');
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }

    // Monitor Firebase Auth status
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        // Create user doc if not exists
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userDocRef);
          if (!snap.exists()) {
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              createdAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error("User registration error: ", e);
        }
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Sync real-time thoughts and tasks lists when user login changes
  useEffect(() => {
    if (!user) {
      setTasks([]);
      setThoughts([]);
      return;
    }

    setDataLoading(true);

    // List thoughts query
    const thoughtsQuery = query(
      collection(db, 'users', user.uid, 'thoughts'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeThoughts = onSnapshot(thoughtsQuery, (snapshot) => {
      const thoughtsList: Thought[] = [];
      snapshot.forEach((doc) => {
        thoughtsList.push({ id: doc.id, ...doc.data() } as Thought);
      });
      setThoughts(thoughtsList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/thoughts`);
    });

    // List tasks query
    const tasksQuery = query(
      collection(db, 'users', user.uid, 'tasks'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasksList: Task[] = [];
      snapshot.forEach((doc) => {
        tasksList.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(tasksList);
      setDataLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/tasks`);
      setDataLoading(false);
    });

    return () => {
      unsubscribeThoughts();
      unsubscribeTasks();
    };
  }, [user]);

  // Handle Login pop up
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Auth Login failed: ', err);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Auth Logout failed: ', err);
    }
  };

  // Switch Voice Record Capture
  const toggleRecording = () => {
    if (!speechSupported) {
      // Simulate Voice Capture for demonstration
      if (isRecording) {
        setIsRecording(false);
      } else {
        setIsRecording(true);
        setInputType('voice');
        // Transcribe simulated typical thought dump after a 3s animation
        setTimeout(() => {
          setRawText((prev) => {
            const presetText = "Buy organic groceries on Friday evening, prepare high caloric prep meals, and coordinate workout calendar. Set urgency to high.";
            return prev ? `${prev} ${presetText}`.trim() : presetText;
          });
          setIsRecording(false);
        }, 3200);
      }
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setInputType('voice');
      setRawText('');
      setIsRecording(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Speech trigger failed: ", e);
      }
    }
  };

  // Preset Template loader
  const loadTemplate = (templateText: string) => {
    setInputType('template');
    setRawText(templateText);
  };

  // Trigger Gemini AI Thoughts-to-Task Conversion via Server side post route
  const handleConvert = async () => {
    if (!user || !rawText.trim()) return;

    setIsConverting(true);
    setConversionError(null);

    const thoughtId = `thought-${Date.now()}`;
    const taskId = `task-${Date.now()}`;

    try {
      // Call express back-end conversion route
      const response = await fetch('/api/thoughts/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, inputType })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Cognitive task converter encountered an error');
      }

      const generatedTask = await response.json();

      // Write raw thought entry block into Firestore with user correlation
      const thoughtRef = doc(db, 'users', user.uid, 'thoughts', thoughtId);
      await setDoc(thoughtRef, {
        id: thoughtId,
        userId: user.uid,
        rawText: rawText,
        inputType: inputType,
        processed: true,
        convertedTaskId: taskId,
        createdAt: serverTimestamp()
      });

      // Write parsed tasks elements from Gemini response into tasks collection
      const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
      await setDoc(taskRef, {
        id: taskId,
        userId: user.uid,
        title: generatedTask.title || 'Actionable Task',
        description: generatedTask.description || '',
        priority: generatedTask.priority || 'medium',
        status: 'pending',
        subtasks: (generatedTask.subtasks || []).map((text: string, idx: number) => ({
          id: `${taskId}-sub-${idx}`,
          text,
          completed: false
        })),
        category: generatedTask.category || 'Personal',
        tags: generatedTask.tags || [],
        dueDate: generatedTask.dueDateRecommendation || null,
        durationMinutes: generatedTask.durationMinutes || 30,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        sourceThoughtId: thoughtId
      });

      // Clear capturing inputs upon success
      setRawText('');
    } catch (err: any) {
      console.error(err);
      setConversionError(err.message || 'Analysis failed. Please try typing your thought directly.');
    } finally {
      setIsConverting(false);
    }
  };

  // Toggle checks on subtasks list
  const toggleSubtask = async (task: Task, subId: string) => {
    if (!user) return;

    const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
    const updatedSubtasks = task.subtasks.map((sub) => {
      if (sub.id === subId) {
        return { ...sub, completed: !sub.completed };
      }
      return sub;
    });

    try {
      await updateDoc(taskRef, {
        subtasks: updatedSubtasks,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/tasks/${task.id}`);
    }
  };

  // Modify Task status (Complete / Archive)
  const toggleTaskStatus = async (task: Task, currentStatus: string) => {
    if (!user) return;

    const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';

    try {
      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/tasks/${task.id}`);
    }
  };

  // Process Task deletion
  const handleDeleteTask = async (taskId: string) => {
    if (!user || !confirm('Are you sure you want to delete this actionable task?')) return;

    const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
    try {
      await deleteDoc(taskRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/tasks/${taskId}`);
    }
  };

  // Open Task Editing modal
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditPriority(task.priority);
    setEditCategory(task.category || 'General');
    setEditDuration(task.durationMinutes || 30);
    setEditDueDate(task.dueDate || '');
  };

  // Save Task edits
  const saveTaskEdits = async () => {
    if (!user || !editingTask) return;

    const taskRef = doc(db, 'users', user.uid, 'tasks', editingTask.id);
    try {
      await updateDoc(taskRef, {
        title: editTitle,
        description: editDesc,
        priority: editPriority,
        category: editCategory,
        durationMinutes: Number(editDuration),
        dueDate: editDueDate || null,
        updatedAt: serverTimestamp()
      });
      setEditingTask(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/tasks/${editingTask.id}`);
    }
  };

  // Calculate dynamic stats
  const statistics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const pending = total - completed;
    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const totalDurationMinutes = tasks.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
    const completedDuration = tasks
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + (t.durationMinutes || 0), 0);

    const categoriesMap = new Map<string, number>();
    tasks.forEach(t => {
      const cat = t.category || 'General';
      categoriesMap.set(cat, (categoriesMap.get(cat) || 0) + 1);
    });

    const categoryList = Array.from(categoriesMap.keys());

    return {
      total,
      completed,
      pending,
      completionPercent,
      totalDurationMinutes,
      completedDuration,
      categoryList
    };
  }, [tasks]);

  // Clean formatted timestamp loader
  const displayTime = (ts: any) => {
    if (!ts) return 'Just now';
    if (ts.seconds) {
      return new Date(ts.seconds * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return new Date(ts).toLocaleString();
  };

  // Filter and search computation list
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;

      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'active' && t.status === 'pending') ||
        (activeTab === 'completed' && t.status === 'completed');

      return matchesSearch && matchesCategory && matchesTab;
    });
  }, [tasks, searchTerm, selectedCategory, activeTab]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] flex flex-col justify-center items-center font-sans select-none">
        <Loader2 className="w-10 h-10 text-[#3B82F6] animate-spin mb-4" />
        <p className="text-white/40 font-display text-xs uppercase tracking-widest font-bold">Validating Secure Workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans antialiased selection:bg-[#3B82F6]/20 selection:text-[#3B82F6]">
      
      {/* HEADER NAVIGATION */}
      <nav className="flex justify-between items-center px-6 sm:px-10 py-6 sm:py-8 border-b border-white/10 bg-[#0A0A0A]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#3B82F6] rounded-full"></div>
          <span className="text-xl font-bold tracking-tighter uppercase font-display">Thoughts to Task</span>
        </div>
        <div className="flex gap-4 sm:gap-8 items-center">
          {user ? (
            <>
              <span className="hidden sm:inline text-xs uppercase tracking-widest text-white/50 font-semibold font-display">Workspace Active</span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center overflow-hidden bg-white/5">
                  <img
                    src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop'}
                    alt={user.displayName || 'u'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 sm:px-4 sm:py-2 text-[10px] uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded font-bold cursor-pointer transition-colors"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleLogin}
              className="px-5 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold text-xs uppercase tracking-widest rounded transition-all cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* BODY WORKSPACE AREA */}
      <main className="max-w-7xl mx-auto min-h-[calc(100vh-100px)] flex flex-col">
        
        {/* LANDING PAGE FOR GUEST / UNAUTHORIZED USER */}
        {!user ? (
          <div className="flex-1 flex flex-col justify-center items-center py-16 sm:py-24 px-6 text-center max-w-4xl mx-auto">
            <span className="text-[#3B82F6] font-mono text-sm uppercase tracking-widest mb-4 block">Capturing & Structure Engine</span>
            <h1 className="text-[44px] sm:text-[100px] leading-[0.9] font-black tracking-tighter uppercase mb-8 font-display">
              Turn chaos into <br/> <span className="text-white/20">action items.</span>
            </h1>
            
            <p className="text-white/40 text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed font-sans">
              Dump unorganized thoughts, checklists, templates or voice recordings. Our Gemini cognitive parser will extract implicit priority, deadlines, and dynamic structural subtasks instantly.
            </p>

            <button
              onClick={handleLogin}
              className="px-8 py-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-black rounded uppercase tracking-widest text-sm flex items-center gap-3 transition-colors shadow-lg shadow-[#3B82F6]/10 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-3.3-4.53-6.16-4.53z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Authorize</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            {/* Feature lists in bold styling style */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-16 text-left">
              <div className="p-8 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-[#3B82F6] font-mono text-xs uppercase tracking-widest mb-1.5 block">Step 01</span>
                <h3 className="font-display font-black text-xl uppercase mb-2">Speech / Text Intake</h3>
                <p className="text-white/40 text-xs leading-relaxed">Speak voice streams or dump chaotic brain notes in any raw format seamlessly.</p>
              </div>
              <div className="p-8 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-[#3B82F6] font-mono text-xs uppercase tracking-widest mb-1.5 block">Step 02</span>
                <h3 className="font-display font-black text-xl uppercase mb-2">Gemini Analysis</h3>
                <p className="text-white/40 text-xs leading-relaxed">Implicit schedules are parsed, urgencies prioritized, and bite-sized checklists organized.</p>
              </div>
              <div className="p-8 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-[#3B82F6] font-mono text-xs uppercase tracking-widest mb-1.5 block">Step 03</span>
                <h3 className="font-display font-black text-xl uppercase mb-2">Secure Cloud Sync</h3>
                <p className="text-white/40 text-xs leading-relaxed">Your tasks are synchronized instantly in the cloud, allowing secure, real-time access across all devices.</p>
              </div>
            </div>
          </div>
        ) : (
          
          /* AUTHORIZED GRID CONTROLLERS */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden w-full border-x border-b border-white/10">
            
            {/* LEFT COLUMN: PRIMARY INPUT STATIONS (7 OF 12 COLS) */}
            <section className="col-span-12 lg:col-span-7 flex flex-col p-6 sm:p-12 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#0A0A0A]">
              <div className="mb-auto">
                <span className="text-[#3B82F6] font-mono text-xs sm:text-sm uppercase tracking-widest mb-4 block">Thought Capture System</span>
                <h1 className="text-4xl sm:text-[100px] leading-[0.9] font-black tracking-tighter uppercase mb-8 font-display">
                  What's on <br/> <span className="text-white/20">your mind?</span>
                </h1>
                
                {/* Visual rich input card wrapper */}
                <div className="relative group bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 mb-8 focus-within:border-[#3B82F6] transition-all">
                  
                  {/* Internal tabs selectors */}
                  <div className="flex gap-2 bg-white/5 p-1 rounded-lg border border-white/10 mb-4 inline-flex">
                    <button
                      onClick={() => { setInputType('text'); setRawText(''); }}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                        inputType === 'text' ? 'bg-[#3B82F6] text-white' : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      Text Desk
                    </button>
                    <button
                      onClick={() => { setInputType('voice'); setRawText(''); }}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center space-x-1 cursor-pointer ${
                        inputType === 'voice' ? 'bg-[#3B82F6] text-white' : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      <Mic className="w-3 h-3" />
                      <span>Voice Stream</span>
                    </button>
                    <button
                      onClick={() => { setInputType('template'); setRawText(''); }}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                        inputType === 'template' ? 'bg-[#3B82F6] text-white' : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      Brainstorm Presets
                    </button>
                  </div>

                  <textarea
                    rows={inputType === 'voice' ? 3 : 5}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    disabled={isRecording || isConverting}
                    placeholder={
                      inputType === 'voice'
                        ? "Speech transcription feeds directly here..."
                        : inputType === 'template'
                        ? "Select a brainstorm framework pattern below to edit..."
                        : "Thinking about the Q4 marketing push—we need a 3-day event in Austin and a landing page update by Friday."
                    }
                    className="w-full bg-transparent border-none text-xl sm:text-2xl py-2 focus:outline-none placeholder-white/10 resize-none focus:ring-0 text-white font-sans scrollbar-thin"
                  />

                  {/* Character stats count mapping */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-white/30 pt-4 border-t border-white/5">
                    <span>{rawText.length} characters written</span>
                    <span>UTC: 2026-05-20</span>
                  </div>

                  {/* Actions buttons shelf */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mt-6 pt-4 border-t border-white/5">
                    
                    {/* Recording view widgets for speech triggers */}
                    {inputType === 'voice' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleRecording}
                          className={`p-3 rounded-full hover:scale-105 transition-transform cursor-pointer ${
                            isRecording ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 hover:bg-white/10 text-white'
                          }`}
                        >
                          <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
                        </button>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-white/40">
                          {isRecording ? "Listening stream acts..." : "Start Intake"}
                        </span>
                      </div>
                    )}

                    <div className="w-full sm:w-auto flex justify-end">
                      <button
                        onClick={handleConvert}
                        disabled={isConverting || !rawText.trim()}
                        className="px-6 py-3.5 bg-[#3B82F6] disabled:bg-zinc-800 disabled:text-white/30 hover:bg-[#2563EB] text-white font-black rounded uppercase tracking-widest text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer w-full sm:w-auto"
                      >
                        {isConverting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Translating thoughts...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 fill-white" />
                            <span>Convert to Action</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>

                </div>

                {/* Error messages banner */}
                {conversionError && (
                  <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-red-300 leading-normal">{conversionError}</span>
                  </div>
                )}

                {/* MATRIX PRESETS DOCK */}
                {inputType === 'template' && (
                  <div className="space-y-2 mb-8 animate-fade-in">
                    <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest pl-1 block">Quick Brainstorm Templates</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => loadTemplate("Plan high urgency bug fix session. I must schedule server-side updates by tomorrow night, write database migration drafts, audit rules safety, then run unit tests.")}
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-left transition-all group cursor-pointer"
                      >
                        <div className="text-[10px] tracking-wider uppercase font-bold text-[#3B82F6] mb-1 font-mono">Infrastructure</div>
                        <h4 className="font-display font-bold text-xs uppercase text-white leading-snug">💻 Critical Bug Fix Setup</h4>
                      </button>
                      <button
                        onClick={() => loadTemplate("Weekly groceries checkout. Buy fresh organic produce, broccoli, spinach, avocados, complex carbs, brown rice, planning healthy meal prepping on Sunday afternoon.")}
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-left transition-all group cursor-pointer"
                      >
                        <div className="text-[10px] tracking-wider uppercase font-bold text-[#3B82F6] mb-1 font-mono">Personal Life</div>
                        <h4 className="font-display font-bold text-xs uppercase text-white leading-snug">🛒 Weekly Clean Meal Prep</h4>
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* CONTEXT ENGINE METADATA & STREAM CHANNELS STATS */}
              <div className="flex flex-col sm:flex-row gap-4 mt-auto pt-6 border-t border-white/10">
                <div className="flex-1 p-6 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="text-[10px] uppercase tracking-tighter text-white/30 mb-2 font-mono">Source Priorities</div>
                  <div className="text-lg font-bold uppercase tracking-tight text-white font-display">Completed Cycles</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1 font-display">{statistics.completed} Tasks</div>
                </div>
                <div className="flex-1 p-6 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="text-[10px] uppercase tracking-tighter text-white/30 mb-2 font-mono">Context Engine</div>
                  <div className="text-lg font-bold uppercase tracking-tight text-white font-display">Active Time budget</div>
                  <div className="text-2xl font-black text-[#3B82F6] mt-1 font-display">{statistics.totalDurationMinutes} Minutes</div>
                </div>
              </div>

              {/* SAVED TRANSCRIPTIONS AND IDEAS TIMELINE */}
              <div className="mt-8 border-t border-white/10 pt-6">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest pl-1 mb-3 block">Captured Thought History ({thoughts.length})</span>
                
                <div className="max-h-[220px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                  {thoughts.length === 0 ? (
                    <div className="p-6 border border-white/10 border-dashed rounded-xl text-center text-xs text-white/30 uppercase tracking-widest font-mono">
                      No registered thought dumps.
                    </div>
                  ) : (
                    thoughts.map((thought) => (
                      <div
                        key={thought.id}
                        className="p-4 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl transition-all"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 px-2 py-0.5 rounded font-black uppercase font-mono tracking-wider">
                            Intake: {thought.inputType}
                          </span>
                          <span className="text-[9px] font-mono text-white/40">
                            {displayTime(thought.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-white/80 line-clamp-2 leading-relaxed">
                          "{thought.rawText}"
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </section>

            {/* RIGHT COLUMN: ACTIONABLE TASKS RESULT (5 OF 12 COLS) */}
            <section className="col-span-12 lg:col-span-5 flex flex-col bg-white/[0.02]">
              
              <div className="p-6 sm:p-12 pb-6">
                <h2 className="text-4xl font-black uppercase tracking-tighter text-white mb-2 font-display">Extracted Tasks</h2>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest font-mono">Analysis via Firestore Logic</p>
              </div>

              {/* SEARCH, CATEGORY AND VIEW MANAGERS */}
              <div className="px-6 sm:px-12 pb-6 space-y-4">
                
                {/* Search query box */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search priorities, tags, titles..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all font-sans"
                  />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider font-bold text-white/70 rounded-lg py-2 px-3 focus:outline-none focus:border-white/20 transition-colors cursor-pointer"
                  >
                    <option value="All" className="bg-[#0A0A0A]">All Domains</option>
                    {statistics.categoryList.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#0A0A0A]">{cat.toUpperCase()}</option>
                    ))}
                  </select>

                  <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                    <button
                      onClick={() => setActiveTab('active')}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                        activeTab === 'active' ? 'bg-[#3B82F6] text-white' : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => setActiveTab('completed')}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                        activeTab === 'completed' ? 'bg-[#3B82F6] text-white' : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      Done
                    </button>
                  </div>
                </div>

              </div>

              {/* Extracted list cards containers */}
              <div className="px-6 sm:px-12 flex-1 overflow-y-auto space-y-4 max-h-[500px] lg:max-h-[620px] scrollbar-thin">
                {dataLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin mb-3" />
                    <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">Synchronizing rows...</p>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="py-16 border border-white/10 border-dashed rounded-xl text-center space-y-3 p-6">
                    <CheckSquare className="w-8 h-8 text-white/10 mx-auto" />
                    <p className="font-display font-black uppercase text-sm tracking-tight text-white/30">No operational tasks</p>
                    <p className="text-white/40 font-mono text-[10px] uppercase tracking-wider max-w-[200px] mx-auto">Convert thoughts to display actionable tasks list</p>
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const completeCount = task.subtasks.filter((s) => s.completed).length;
                    const taskProgress = task.subtasks.length > 0 ? Math.round((completeCount / task.subtasks.length) * 100) : 0;

                    // Compute bold category tag
                    const priorityColor =
                      task.priority === 'high'
                        ? 'border-[#3B82F6]'
                        : task.priority === 'medium'
                        ? 'border-amber-500'
                        : 'border-emerald-500';

                    const priorityBg =
                      task.priority === 'high'
                        ? 'bg-[#3B82F6]'
                        : task.priority === 'medium'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500';

                    return (
                      <motion.div
                        layout
                        key={task.id}
                        className={`group p-6 bg-white/5 border-l-4 ${priorityColor} rounded-r-xl relative transition-all ${
                          task.status === 'completed' ? 'opacity-40' : ''
                        }`}
                      >
                        {/* Task priority card top bar */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleTaskStatus(task, task.status)}
                              className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                                task.status === 'completed'
                                  ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                                  : 'border-white/25 hover:border-[#3B82F6]'
                              }`}
                            >
                              {task.status === 'completed' && <Check className="w-3.5 h-3.5 text-white" />}
                            </button>
                            <span className={`text-[9px] ${priorityBg} px-2 py-0.5 rounded font-bold uppercase text-white`}>
                              {task.priority} Priority
                            </span>
                            {task.category && (
                              <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded font-mono uppercase text-white/60">
                                {task.category}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => openEditModal(task)}
                              className="text-white/40 hover:text-[#3B82F6] transition-colors cursor-pointer"
                              title="Modify info"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete task row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title & Desc */}
                        <p className={`text-lg font-bold tracking-tight mb-2 text-white font-display ${
                          task.status === 'completed' ? 'line-through text-white/30' : ''
                        }`}>
                          {task.title}
                        </p>
                        
                        <p className="text-white/50 text-xs font-medium mb-4 leading-relaxed line-clamp-2">
                          {task.description}
                        </p>

                        {/* Action Steps checklist sub list */}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="space-y-2 border-t border-white/10 pt-3.5 mb-4">
                            <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest block">
                              Action Steps Progress ({taskProgress}%)
                            </span>
                            <div className="space-y-1.5 pl-1">
                              {task.subtasks.map((sub) => (
                                <div
                                  key={sub.id}
                                  onClick={() => toggleSubtask(task, sub.id)}
                                  className="flex items-center space-x-2.5 py-1.5 px-2 hover:bg-white/5 rounded transition-colors cursor-pointer"
                                >
                                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                    sub.completed ? 'bg-white/10 border-white/20 text-[#3B82F6]' : 'border-white/20'
                                  }`}>
                                    {sub.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </div>
                                  <span className={`text-[11px] ${sub.completed ? 'line-through text-white/30 font-medium' : 'text-white/80'}`}>
                                    {sub.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-[10px] text-white/40 font-mono border-t border-white/5 pt-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-white/30" />
                            <span>DUE: {task.dueDate || "UNCERTAIN"}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-white/30" />
                            <span>BUDGET: {task.durationMinutes || 30}m</span>
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Status Footer section from Design HTML */}
              <div className="mt-auto p-6 sm:p-12 py-8 bg-black border-t border-white/10 flex justify-between items-center overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Firestore Connected</span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/20">{tasks.length} Tasks Processed</span>
              </div>

            </section>

          </div>
        )}

      </main>

      {/* EDIT MODAL DESIGN */}
      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="font-display font-black text-lg uppercase text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#3B82F6]" />
                  <span>Customize Task Options</span>
                </h3>
                <button
                  onClick={() => setEditingTask(null)}
                  className="p-1 hover:bg-white/5 border border-white/10 rounded-lg text-white/65 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 font-sans text-xs">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Task Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest font-bold">Context Guidance</label>
                  <textarea
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-white/20 rounded-lg p-4 text-white focus:outline-none resize-none"
                  />
                </div>

                {/* Priority / Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Priority Rating</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as any)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none cursor-pointer"
                    >
                      <option value="low" className="bg-[#0A0A0A]">Low Urgency</option>
                      <option value="medium" className="bg-[#0A0A0A]">Medium Urgency</option>
                      <option value="high" className="bg-[#0A0A0A]">High Urgency</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Primary Domain</label>
                     <input
                      type="text"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Duration / Calendar */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Duration Budget (mins)</label>
                    <input
                      type="number"
                      value={editDuration}
                      onChange={(e) => setEditDuration(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Schedule Deadline</label>
                     <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Save triggers */}
              <div className="flex justify-end items-center space-x-3 pt-4 border-t border-white/10">
                <button
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 text-xs font-semibold hover:bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTaskEdits}
                  className="px-6 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-black text-xs uppercase tracking-widest rounded transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
