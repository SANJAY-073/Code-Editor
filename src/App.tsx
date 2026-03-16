import React, { useState, useEffect } from 'react';
import { 
  Code2, 
  Play, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Zap, 
  BookOpen, 
  Clock,
  Terminal,
  ChevronRight,
  Copy,
  Trash2,
  Github,
  History,
  User as UserIcon,
  LogOut,
  Folder,
  FileCode,
  Search,
  Save
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'python', name: 'Python' },
  { id: 'java', name: 'Java' },
  { id: 'cpp', name: 'C++' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'go', name: 'Go' },
  { id: 'swift', name: 'Swift' },
  { id: 'php', name: 'PHP' },
];

const DEFAULT_CODE: Record<string, string> = {
  javascript: `function findSum(arr) {\n  let sum = 0;\n  for (let i = 0; i < arr.length; i++) {\n    for (let j = 0; j < arr.length; j++) {\n      if (i === j) sum += arr[i];\n    }\n  }\n  return sum;\n}`,
  typescript: `interface User {\n  name: string;\n  age: number;\n}\n\nconst greet = (user: any) => {\n  console.log("Hello " + user.name);\n};`,
  python: `def calculate_factorial(n):\n    if n == 0:\n        return 1\n    else:\n        return n * calculate_factorial(n-1)\n\nprint(calculate_factorial(5))`,
  java: `public class Main {\n    public static void main(String[] args) {\n        int[] numbers = {1, 2, 3, 4, 5};\n        for(int i=0; i<=numbers.length; i++) {\n            System.out.println(numbers[i]);\n        }\n    }\n}`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int* ptr = new int(10);\n    cout << *ptr << endl;\n    return 0;\n}`,
  ruby: `def hello(name)\n  puts "Hello #{name}"\nend\n\nhello("World")`,
  go: `package main\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
  swift: `import Foundation\n\nlet name = "Swift"\nprint("Hello, \\(name)!")`,
  php: `<?php\nfunction greet($name) {\n    echo "Hello, " . $name;\n}\ngreet("PHP");\n?>`,
};

interface User {
  id: number;
  username: string;
}

interface Review {
  id: number;
  code: string;
  language: string;
  analysis: string;
  created_at: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'editor' | 'github' | 'history'>('editor');
  const [code, setCode] = useState(DEFAULT_CODE.javascript);
  const [language, setLanguage] = useState('javascript');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isStatic, setIsStatic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  // GitHub state
  const [githubUrl, setGithubUrl] = useState('');
  const [repoContents, setRepoContents] = useState<any[]>([]);
  const [isFetchingRepo, setIsFetchingRepo] = useState(false);

  // History state
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (token) {
      fetchReviews();
      // In a real app, we'd verify the token and get user info here
      const savedUser = localStorage.getItem('user');
      if (savedUser) setUser(JSON.parse(savedUser));
    }
  }, [token]);

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/reviews', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {}
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setShowAuthModal(false);
        setAuthForm({ username: '', password: '' });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Authentication failed");
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setReviews([]);
    setActiveTab('editor');
  };

  const handleAnalyze = async (save: boolean = false) => {
    if (!code.trim()) {
      setError("Please enter some code to analyze.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setIsStatic(false);

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, language, saveReview: save && !!token }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setIsStatic(!!data.isStatic);
      if (save && token) fetchReviews();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRepo = async () => {
    if (!githubUrl) return;
    setIsFetchingRepo(true);
    setError(null);
    try {
      const res = await fetch('/api/github/repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: githubUrl })
      });
      const data = await res.json();
      if (res.ok) {
        setRepoContents(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to fetch repository");
    } finally {
      setIsFetchingRepo(false);
    }
  };

  const selectFile = async (file: any) => {
    if (file.type === 'dir') return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/github/file?url=${encodeURIComponent(file.url)}`);
      const data = await res.json();
      if (res.ok) {
        setCode(data.content);
        // Try to guess language from extension
        const ext = file.name.split('.').pop();
        const langMap: any = { js: 'javascript', ts: 'typescript', py: 'python', java: 'java', cpp: 'cpp', rb: 'ruby', go: 'go', swift: 'swift', php: 'php' };
        if (langMap[ext]) setLanguage(langMap[ext]);
        setActiveTab('editor');
      }
    } catch (err) {
      setError("Failed to fetch file content");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-[#0A0A0B]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">AI Code Reviewer</h1>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">v2.0.0 // Gemini Pro</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-1 bg-zinc-900/50 rounded-lg p-1 border border-zinc-800">
              <button 
                onClick={() => setActiveTab('editor')}
                className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2", activeTab === 'editor' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
              >
                <Terminal className="w-4 h-4" /> Editor
              </button>
              <button 
                onClick={() => setActiveTab('github')}
                className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2", activeTab === 'github' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
              >
                <Github className="w-4 h-4" /> GitHub
              </button>
              {token && (
                <button 
                  onClick={() => setActiveTab('history')}
                  className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2", activeTab === 'history' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
                >
                  <History className="w-4 h-4" /> History
                </button>
              )}
            </nav>

            <div className="h-6 w-px bg-zinc-800" />

            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-indigo-400" />
                  </div>
                  <span className="hidden sm:inline">{user.username}</span>
                </div>
                <button onClick={logout} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-red-400 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 h-[calc(100vh-4rem)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
          {/* Left Side: Input (Editor or GitHub or History) */}
          <div className="flex flex-col gap-4 h-full overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'editor' && (
                <motion.div 
                  key="editor"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col gap-4 h-full"
                >
                  <div className="flex items-center justify-between">
                    <select 
                      value={language}
                      onChange={(e) => { setLanguage(e.target.value); setCode(DEFAULT_CODE[e.target.value] || ''); }}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    >
                      {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCode('')} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-red-400 transition-colors" title="Clear"><Trash2 className="w-4 h-4" /></button>
                      <button onClick={() => handleAnalyze(true)} disabled={isLoading} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/25">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        {token ? 'Analyze & Save' : 'Analyze'}
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden relative">
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      spellCheck={false}
                      className="w-full h-full p-6 bg-transparent text-zinc-300 font-mono text-sm resize-none focus:outline-none"
                      placeholder="Paste your code here..."
                    />
                  </div>
                </motion.div>
              )}

              {activeTab === 'github' && (
                <motion.div 
                  key="github"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col gap-4 h-full"
                >
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="GitHub Repository URL (e.g., owner/repo)"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      />
                    </div>
                    <button 
                      onClick={fetchRepo}
                      disabled={isFetchingRepo}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    >
                      {isFetchingRepo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
                    </button>
                  </div>

                  <div className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-y-auto custom-scrollbar p-4">
                    {repoContents.length > 0 ? (
                      <div className="space-y-1">
                        {repoContents.map((file, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectFile(file)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 text-left transition-colors group"
                          >
                            {file.type === 'dir' ? <Folder className="w-4 h-4 text-indigo-400" /> : <FileCode className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />}
                            <span className="text-sm text-zinc-400 group-hover:text-zinc-200 truncate">{file.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                        <Github className="w-12 h-12 mb-4" />
                        <p className="text-sm">Enter a GitHub URL to browse files</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div 
                  key="history"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col gap-4 h-full overflow-hidden"
                >
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-mono uppercase tracking-wider text-zinc-400">Past Reviews</h3>
                    <span className="text-xs text-zinc-600">{reviews.length} saved</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {reviews.map((review) => (
                      <button
                        key={review.id}
                        onClick={() => { setCode(review.code); setLanguage(review.language); setAnalysis(review.analysis); setActiveTab('editor'); }}
                        className="w-full p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 text-left transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-indigo-400 uppercase">{review.language}</span>
                          <span className="text-[10px] text-zinc-600">{new Date(review.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-zinc-400 line-clamp-2 group-hover:text-zinc-200 transition-colors">
                          {review.code.substring(0, 100)}...
                        </p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Side: Analysis Output */}
          <div className="flex flex-col gap-4 h-full overflow-hidden">
            <div className="flex items-center gap-2 text-zinc-400 px-1">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-mono uppercase tracking-wider">Analysis Report</span>
              {isStatic && (
                <span className="ml-auto text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  Static Analysis (Offline)
                </span>
              )}
            </div>

            <div className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-y-auto custom-scrollbar relative">
              <AnimatePresence mode="wait">
                {!analysis && !isLoading && !error && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center p-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                      <ChevronRight className="w-8 h-8 text-zinc-600" />
                    </div>
                    <h3 className="text-zinc-400 font-medium mb-2">Ready for Review</h3>
                    <p className="text-zinc-500 text-sm max-w-xs">
                      Analyze code from the editor or GitHub to see AI-powered feedback.
                    </p>
                  </motion.div>
                )}

                {isLoading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center p-8"
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin mb-4" />
                    <p className="text-zinc-400 font-mono text-xs uppercase tracking-[0.2em]">Processing Code...</p>
                  </motion.div>
                )}

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-6"
                  >
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-sm">Error</h4>
                        <p className="text-sm opacity-80 mt-1">{error}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {analysis && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 prose prose-invert prose-sm max-w-none"
                  >
                    <div className="markdown-body">
                      <Markdown>{analysis}</Markdown>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                    <p className="text-sm text-zinc-500">Access history and save reviews</p>
                  </div>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-1.5">Username</label>
                    <input 
                      type="text" 
                      required
                      value={authForm.username}
                      onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-1.5">Password</label>
                    <input 
                      type="password" 
                      required
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]">
                    {authMode === 'login' ? 'Sign In' : 'Sign Up'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button 
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                    className="text-sm text-zinc-500 hover:text-indigo-400 transition-colors"
                  >
                    {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #f4f4f5; margin-top: 1.5rem; margin-bottom: 0.75rem; font-weight: 600; }
        .markdown-body p { color: #a1a1aa; line-height: 1.6; margin-bottom: 1rem; }
        .markdown-body ul { list-style-type: disc; padding-left: 1.25rem; margin-bottom: 1rem; color: #a1a1aa; }
        .markdown-body code { background: #27272a; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-family: monospace; color: #e4e4e7; }
      `}</style>
    </div>
  );
}
