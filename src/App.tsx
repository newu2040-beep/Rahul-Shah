/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { 
  Wand2, PenTool, Sparkles, Hash, MousePointerClick, 
  Lightbulb, Users, FileText, MessageSquare, Search, 
  Mail, ArrowUpRight, AlignLeft, Image as ImageIcon, 
  UserCircle, Twitter, Megaphone, Sun, Moon, LogOut, 
  Menu, X, Copy, Download, RefreshCw, Check,
  Linkedin, Video, ShieldAlert, Mic, Newspaper, Loader2, Settings2, Palette,
  Undo2, Redo2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, signInWithPopup, googleProvider, signOut, onAuthStateChanged, collection, addDoc, serverTimestamp } from './lib/firebase';
import { generateScript } from './lib/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Tool Definitions ---
const TOOLS = [
  { id: 'script-generator', name: 'Script Generator', icon: Wand2, description: 'Generate high-quality scripts for any platform.' },
  { id: 'rewrite-humanizer', name: 'Rewrite & Humanizer', icon: PenTool, description: 'Convert robotic text into natural human tone.' },
  { id: 'hook-generator', name: 'Hook Generator', icon: Sparkles, description: 'Viral opening lines for your videos.' },
  { id: 'title-generator', name: 'Title Generator', icon: FileText, description: 'SEO click-worthy titles.' },
  { id: 'hashtag-generator', name: 'Hashtag Generator', icon: Hash, description: 'Trending hashtags for maximum reach.' },
  { id: 'cta-generator', name: 'CTA Generator', icon: MousePointerClick, description: 'High-converting calls-to-action.' },
  { id: 'story-ideas', name: 'Story Ideas', icon: Lightbulb, description: 'Fresh content concepts and ideas.' },
  { id: 'outline-builder', name: 'Outline Builder', icon: AlignLeft, description: 'Structured content outlines.' },
  { id: 'dialogue-writer', name: 'Dialogue Writer', icon: MessageSquare, description: 'Character-based conversations.' },
  { id: 'seo-description', name: 'SEO Description', icon: Search, description: 'Optimized video descriptions.' },
  { id: 'email-writer', name: 'Email Writer', icon: Mail, description: 'Professional & marketing emails.' },
  { id: 'script-improver', name: 'Script Improver', icon: ArrowUpRight, description: 'Enhance scripts 10x quality.' },
  { id: 'summarizer', name: 'Summarizer', icon: AlignLeft, description: 'Convert long content into short summaries.' },
  { id: 'thumbnail-ideas', name: 'Thumbnail Ideas', icon: ImageIcon, description: 'High CTR thumbnail concepts.' },
  { id: 'bio-generator', name: 'Bio Generator', icon: UserCircle, description: 'Engaging social media bios.' },
  { id: 'tweet-writer', name: 'Tweet Writer', icon: Twitter, description: 'Viral tweets & threads.' },
  { id: 'linkedin-post', name: 'LinkedIn Post', icon: Linkedin, description: 'Viral professional posts & stories.' },
  { id: 'video-concept', name: 'Video Concept', icon: Video, description: 'Unique video ideas with visual cues.' },
  { id: 'objection-handler', name: 'Objection Handler', icon: ShieldAlert, description: 'Overcome sales & marketing objections.' },
  { id: 'interview-questions', name: 'Interview Qs', icon: Mic, description: 'Deep podcast interview questions.' },
  { id: 'newsletter-writer', name: 'Newsletter', icon: Newspaper, description: 'Engaging email newsletters.' },
  { id: 'ad-copy', name: 'Ad Copy Writer', icon: Megaphone, description: 'High-converting ad scripts.' },
];

const PLATFORMS = ['YouTube Long', 'YouTube Shorts', 'TikTok', 'Instagram Reels', 'Facebook', 'LinkedIn', 'Twitter Thread', 'Blog Post', 'Podcast', 'Storytelling', 'Ads', 'Webinar', 'Sales Pitch', 'Custom'];
const TONES = ['Emotional', 'Cinematic', 'Casual', 'Professional', 'Storytelling', 'Humorous', 'Inspirational', 'Witty', 'Sarcastic', 'Empathetic', 'Authoritative', 'Controversial', 'Educational', 'Custom'];
const LENGTHS = ['Micro (15s)', 'Short (30s-1m)', 'Medium (1m-3m)', 'Long (3m-10m)', 'Epic (10m+)', 'Custom'];

const COLOR_THEMES = [
  { id: 'lavender', name: 'Lavender', color: 'bg-violet-500' },
  { id: 'mint', name: 'Mint', color: 'bg-emerald-500' },
  { id: 'peach', name: 'Peach', color: 'bg-orange-500' },
  { id: 'rose', name: 'Rose', color: 'bg-rose-500' },
  { id: 'sky', name: 'Sky', color: 'bg-sky-500' },
];

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [colorTheme, setColorTheme] = useState('lavender');
  const [activeTool, setActiveTool] = useState(TOOLS[0].id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // Tool State
  const [inputData, setInputData] = useState<Record<string, any>>({});
  const [customPlatform, setCustomPlatform] = useState('');
  const [customTone, setCustomTone] = useState('');
  const [customLength, setCustomLength] = useState('');
  
  const [past, setPast] = useState<Record<string, any>[]>([]);
  const [future, setFuture] = useState<Record<string, any>[]>([]);
  const saveHistoryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateInputData = (newData: Record<string, any>) => {
    if (saveHistoryTimeoutRef.current) {
      clearTimeout(saveHistoryTimeoutRef.current);
    } else {
      setPast(p => [...p.slice(-49), inputData]);
      setFuture([]);
    }
    
    setInputData(newData);

    saveHistoryTimeoutRef.current = setTimeout(() => {
      saveHistoryTimeoutRef.current = null;
    }, 800);
  };

  const undo = () => {
    if (past.length === 0) return;
    if (saveHistoryTimeoutRef.current) {
      clearTimeout(saveHistoryTimeoutRef.current);
      saveHistoryTimeoutRef.current = null;
    }
    
    const previous = past[past.length - 1];
    setPast(p => p.slice(0, p.length - 1));
    setFuture(f => [inputData, ...f]);
    setInputData(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    if (saveHistoryTimeoutRef.current) {
      clearTimeout(saveHistoryTimeoutRef.current);
      saveHistoryTimeoutRef.current = null;
    }
    
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p, inputData]);
    setInputData(next);
  };

  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const savedColorTheme = localStorage.getItem('colorTheme') || 'lavender';
    
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }

    setColorTheme(savedColorTheme);
    document.documentElement.setAttribute('data-theme', savedColorTheme);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const changeColorTheme = (newTheme: string) => {
    setColorTheme(newTheme);
    localStorage.setItem('colorTheme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    setIsThemeMenuOpen(false);
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Successfully logged in!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to log in.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully.');
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) {
      toast.error('Please log in to use the tools.');
      return;
    }

    const tool = TOOLS.find(t => t.id === activeTool);
    if (!tool) return;

    setIsGenerating(true);
    setOutput('');

    try {
      let prompt = '';
      let systemInstruction = 'You are an expert, human-like AI copywriter and scriptwriter. Your writing must be 100% natural, emotional, engaging, and avoid robotic or repetitive patterns. Always provide unique, fresh content. Use formatting like bolding, bullet points, and paragraphs to make it readable.';

      switch (activeTool) {
        case 'script-generator':
          const { topic, instructions } = inputData;
          if (!topic) throw new Error('Topic is required.');
          
          const actualPlatform = inputData.platform === 'Custom' ? customPlatform : (inputData.platform || PLATFORMS[0]);
          const actualTone = inputData.tone === 'Custom' ? customTone : (inputData.tone || TONES[0]);
          const actualLength = inputData.length === 'Custom' ? customLength : (inputData.length || LENGTHS[2]);

          if (inputData.platform === 'Custom' && !customPlatform) throw new Error('Custom platform is required.');
          if (inputData.tone === 'Custom' && !customTone) throw new Error('Custom tone is required.');
          if (inputData.length === 'Custom' && !customLength) throw new Error('Custom length is required.');

          prompt = `Write a ${actualLength} script for ${actualPlatform} about "${topic}". Tone: ${actualTone}. Additional instructions: ${instructions || 'None'}. Make it engaging with a strong hook, build-up, and CTA.`;
          break;
        case 'rewrite-humanizer':
          if (!inputData.text) throw new Error('Text is required.');
          prompt = `Rewrite the following text to sound completely human, natural, and engaging. Remove any robotic AI patterns, cliches (like "In today's fast-paced world"), and make it flow beautifully:\n\n${inputData.text}`;
          break;
        case 'hook-generator':
          if (!inputData.topic) throw new Error('Topic is required.');
          prompt = `Generate 7 highly engaging, viral opening hooks for a video/post about: "${inputData.topic}". Make them irresistible to scroll past. Include a mix of curiosity gaps, bold statements, and questions.`;
          break;
        case 'linkedin-post':
          if (!inputData.topic) throw new Error('Topic is required.');
          prompt = `Write a viral, engaging LinkedIn post about "${inputData.topic}". Use a strong hook, short readable paragraphs (broetry style but natural), and end with a question to drive comments.`;
          break;
        default:
          const input = inputData.text || inputData.topic;
          if (!input) throw new Error('Input is required.');
          prompt = `Task: ${tool.name}. Input: "${input}". Generate high-quality, human-like output optimized for engagement.`;
      }

      const result = await generateScript(prompt, systemInstruction);
      setOutput(result);

      // Save to Firestore
      try {
        await addDoc(collection(db, 'generations'), {
          userId: user.uid,
          toolName: tool.name,
          promptData: JSON.stringify({ ...inputData, customPlatform, customTone, customLength }),
          output: result,
          createdAt: serverTimestamp()
        });
      } catch (dbError) {
        console.error("Failed to save history:", dbError);
      }

      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

    } catch (error: any) {
      toast.error(error.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTool}-output.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded successfully!');
  };

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleGenerate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputData, activeTool, user, customPlatform, customTone, customLength]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary w-12 h-12" />
      </div>
    );
  }

  const activeToolData = TOOLS.find(t => t.id === activeTool);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 relative z-0 overflow-x-hidden">
      {/* Animated Background Blobs for Smooth Glassmorphism */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div 
          animate={{ 
            rotate: 360, 
            scale: [1, 1.1, 1],
            x: [0, 30, 0],
            y: [0, -30, 0]
          }} 
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            rotate: -360, 
            scale: [1, 1.2, 1],
            x: [0, -40, 0],
            y: [0, 40, 0]
          }} 
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/30 blur-[120px]" 
        />
      </div>

      <Toaster position="top-center" theme={theme} />
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/20">
                B
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent-foreground">
                Brilliantlabs
              </span>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)} 
                  className="p-2 rounded-full hover:bg-muted transition-colors flex items-center gap-2"
                  title="Color Theme"
                >
                  <Palette size={20} />
                </button>
                <AnimatePresence>
                  {isThemeMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 glass-panel p-2 z-50 shadow-xl"
                    >
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2 pt-1">Color Theme</div>
                      {COLOR_THEMES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => changeColorTheme(t.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            colorTheme === t.id ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                          )}
                        >
                          <div className={cn("w-4 h-4 rounded-full shadow-sm", t.color)} />
                          {t.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-muted transition-colors" title="Toggle Dark Mode">
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-muted/50 pl-2 pr-4 py-1.5 rounded-full border border-border/50">
                    <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="User" className="w-7 h-7 rounded-full border border-border" referrerPolicy="no-referrer" />
                    <span className="text-sm font-medium hidden lg:block">{user.displayName || user.email}</span>
                  </div>
                  <button onClick={handleLogout} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Logout">
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <button onClick={handleLogin} className="glass-button px-5 py-2 rounded-full font-medium text-sm flex items-center gap-2">
                  <UserCircle size={18} />
                  Sign In
                </button>
              )}
            </div>

            <div className="md:hidden flex items-center gap-2">
              <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-muted transition-colors">
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden fixed inset-x-0 top-16 z-40 glass border-b border-border/50 p-4 shadow-xl flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {COLOR_THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => changeColorTheme(t.id)}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                    colorTheme === t.id ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-card text-muted-foreground"
                  )}
                >
                  <div className={cn("w-3 h-3 rounded-full", t.color)} />
                  {t.name}
                </button>
              ))}
            </div>
            
            {user ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="User" className="w-12 h-12 rounded-full shadow-sm" referrerPolicy="no-referrer" />
                  <div className="flex flex-col">
                    <span className="font-medium">{user.displayName}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full py-3 text-center text-red-500 font-medium flex items-center justify-center gap-2 rounded-xl hover:bg-red-500/10 transition-colors">
                  <LogOut size={18} /> Logout
                </button>
              </div>
            ) : (
              <button onClick={handleLogin} className="w-full glass-button py-3 rounded-xl font-medium flex items-center justify-center gap-2">
                <UserCircle size={20} /> Sign In with Google
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Sidebar / Tools List */}
        <aside className="lg:w-64 flex-shrink-0">
          <div className="lg:sticky lg:top-24">
            <div className="flex items-center gap-2 mb-4 px-2">
              <Settings2 size={16} className="text-muted-foreground hidden lg:block" />
              <h2 className="hidden lg:block text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Tools Suite</h2>
            </div>
            <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto pb-4 lg:pb-10 lg:h-[calc(100vh-12rem)] snap-x hide-scrollbar">
              {TOOLS.map((tool, index) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    key={tool.id}
                    onClick={() => { setActiveTool(tool.id); setOutput(''); setInputData({}); }}
                    className={cn(
                      "flex-shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-4 py-3 lg:px-3 lg:py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 text-left snap-start",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                        : "glass hover:bg-white/40 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon size={18} className={isActive ? "text-primary-foreground" : "text-primary"} />
                    <span className="whitespace-nowrap lg:whitespace-normal lg:truncate">{tool.name}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 max-w-3xl w-full">
          {!user ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[60vh]"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mb-8 shadow-inner border border-white/10">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">Welcome to Brilliantlabs</h1>
              <p className="text-muted-foreground mb-10 max-w-md text-lg">
                Your advanced AI Script Writer Platform. Generate high-quality, human-like scripts for any platform instantly.
              </p>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogin} 
                className="glass-button px-8 py-4 rounded-full font-medium text-lg flex items-center gap-3"
              >
                <UserCircle size={24} />
                Sign In to Start Creating
              </motion.button>
            </motion.div>
          ) : (
            <motion.div 
              key={activeTool}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* Tool Header */}
              <div className="mb-8 px-2 sm:px-0">
                <h1 className="text-3xl font-bold flex items-center gap-3 mb-3 tracking-tight">
                  {activeToolData?.icon && React.createElement(activeToolData.icon, { className: "text-primary", size: 32 })}
                  {activeToolData?.name}
                </h1>
                <p className="text-muted-foreground text-lg">{activeToolData?.description}</p>
              </div>

              {/* Input Form */}
              <motion.div layout className="glass-panel p-5 sm:p-8">
                <form onSubmit={handleGenerate} className="space-y-6">
                  
                  {activeTool === 'script-generator' ? (
                    <motion.div layout className="space-y-6">
                      <motion.div layout>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-semibold text-foreground/80">Topic or Idea</label>
                          <div className="flex items-center gap-1">
                            <button 
                              type="button"
                              onClick={undo}
                              disabled={past.length === 0}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                              title="Undo"
                            >
                              <Undo2 size={16} />
                            </button>
                            <button 
                              type="button"
                              onClick={redo}
                              disabled={future.length === 0}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                              title="Redo"
                            >
                              <Redo2 size={16} />
                            </button>
                          </div>
                        </div>
                        <textarea 
                          required
                          value={inputData.topic || ''}
                          onChange={(e) => updateInputData({...inputData, topic: e.target.value})}
                          placeholder="e.g., The hidden psychology of why we procrastinate..."
                          className="w-full glass-input rounded-xl p-4 min-h-[120px] resize-y"
                        />
                      </motion.div>
                      
                      <motion.div layout className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Platform Select */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-foreground/80">Platform</label>
                          <select 
                            value={inputData.platform || PLATFORMS[0]}
                            onChange={(e) => updateInputData({...inputData, platform: e.target.value})}
                            className="w-full glass-input rounded-xl p-3 appearance-none font-medium"
                          >
                            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <AnimatePresence>
                            {inputData.platform === 'Custom' && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                <input 
                                  type="text" required placeholder="Enter platform..." 
                                  value={customPlatform} onChange={e => setCustomPlatform(e.target.value)}
                                  className="w-full glass-input rounded-xl p-3 mt-2 text-sm"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Tone Select */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-foreground/80">Tone</label>
                          <select 
                            value={inputData.tone || TONES[0]}
                            onChange={(e) => updateInputData({...inputData, tone: e.target.value})}
                            className="w-full glass-input rounded-xl p-3 appearance-none font-medium"
                          >
                            {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <AnimatePresence>
                            {inputData.tone === 'Custom' && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                <input 
                                  type="text" required placeholder="Enter tone..." 
                                  value={customTone} onChange={e => setCustomTone(e.target.value)}
                                  className="w-full glass-input rounded-xl p-3 mt-2 text-sm"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Length Select */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-foreground/80">Length</label>
                          <select 
                            value={inputData.length || LENGTHS[2]}
                            onChange={(e) => updateInputData({...inputData, length: e.target.value})}
                            className="w-full glass-input rounded-xl p-3 appearance-none font-medium"
                          >
                            {LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <AnimatePresence>
                            {inputData.length === 'Custom' && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                <input 
                                  type="text" required placeholder="e.g., 500 words" 
                                  value={customLength} onChange={e => setCustomLength(e.target.value)}
                                  className="w-full glass-input rounded-xl p-3 mt-2 text-sm"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>

                      <motion.div layout>
                        <label className="block text-sm font-semibold mb-2 text-foreground/80">Custom Instructions <span className="text-muted-foreground font-normal">(Optional)</span></label>
                        <input 
                          type="text"
                          value={inputData.instructions || ''}
                          onChange={(e) => updateInputData({...inputData, instructions: e.target.value})}
                          placeholder="e.g., Include a call to action to subscribe at the end"
                          className="w-full glass-input rounded-xl p-3"
                        />
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div layout>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-foreground/80">
                          {activeTool.includes('rewrite') || activeTool.includes('improver') || activeTool.includes('summarizer') ? 'Text to process' : 'Topic or Idea'}
                        </label>
                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={undo}
                            disabled={past.length === 0}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            title="Undo"
                          >
                            <Undo2 size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={redo}
                            disabled={future.length === 0}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            title="Redo"
                          >
                            <Redo2 size={16} />
                          </button>
                        </div>
                      </div>
                      <textarea 
                        required
                        value={inputData.text || inputData.topic || ''}
                        onChange={(e) => updateInputData({...inputData, [activeTool.includes('rewrite') || activeTool.includes('improver') || activeTool.includes('summarizer') ? 'text' : 'topic']: e.target.value})}
                        placeholder={`Enter your ${activeTool.includes('rewrite') ? 'text' : 'topic'} here...`}
                        className="w-full glass-input rounded-xl p-4 min-h-[160px] resize-y"
                      />
                    </motion.div>
                  )}

                  <motion.div layout className="flex items-center justify-between pt-6 border-t border-border/50">
                    <span className="text-xs text-muted-foreground hidden sm:inline-block">Press <kbd className="px-2 py-1 bg-muted rounded-md font-mono border border-border/50">Ctrl</kbd> + <kbd className="px-2 py-1 bg-muted rounded-md font-mono border border-border/50">Enter</kbd> to generate</span>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit" 
                      disabled={isGenerating}
                      className="glass-button px-8 py-3.5 rounded-xl font-semibold flex items-center gap-2 w-full sm:w-auto justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <><Loader2 className="animate-spin" size={18} /> Crafting Magic...</>
                      ) : (
                        <><Sparkles size={18} /> Generate Content</>
                      )}
                    </motion.button>
                  </motion.div>
                </form>
              </motion.div>

              {/* Output Display */}
              <AnimatePresence>
                {output && !isGenerating && (
                  <motion.div 
                    ref={outputRef}
                    initial={{ opacity: 0, y: 20, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="glass-panel overflow-hidden mt-8"
                  >
                    <div className="bg-muted/30 px-6 py-4 border-b border-border/50 flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Sparkles size={16} className="text-primary" /> Generated Result
                      </h3>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button onClick={handleCopy} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground" title="Copy to clipboard">
                          {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                        </button>
                        <button onClick={handleDownload} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground" title="Download as .txt">
                          <Download size={18} />
                        </button>
                        <button onClick={handleGenerate} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground" title="Regenerate">
                          <RefreshCw size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 sm:p-8">
                      <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none whitespace-pre-wrap font-sans leading-relaxed">
                        {output}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-20 py-8 text-center text-sm text-muted-foreground">
        <p>Made with ❤️ by Rahul Shah</p>
      </footer>
    </div>
  );
}
