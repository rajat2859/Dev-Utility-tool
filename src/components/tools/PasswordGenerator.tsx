import React, { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Shield, Key, Eye, EyeOff, Sparkles, Clipboard, CheckCircle, List, ListPlus, History, Trash2 } from 'lucide-react';

const WORDS_POOL = [
  'apple', 'banana', 'cherry', 'durian', 'elder', 'fig', 'grape', 'honey', 'iron', 'joker',
  'kiwi', 'lemon', 'melon', 'node', 'orange', 'peach', 'queen', 'rose', 'sun', 'tiger',
  'unite', 'vivid', 'wolf', 'xenon', 'yarn', 'zebra', 'alpha', 'bravo', 'cable', 'delta',
  'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november',
  'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
  'yankee', 'zulu', 'bold', 'bright', 'calm', 'dark', 'eager', 'free', 'gentle', 'happy',
  'icon', 'jolly', 'kind', 'lucky', 'magic', 'noble', 'open', 'pure', 'quick', 'rare',
  'silent', 'tall', 'ultra', 'vocal', 'wild', 'young', 'zealous', 'stone', 'river', 'forest'
];

export default function PasswordGenerator() {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [excludeSimilar, setExcludeSimilar] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'random' | 'passphrase'>('random');
  
  // Passphrase settings
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState('-');
  const [capitalizeWords, setCapitalizeWords] = useState(true);
  const [includeNumberPass, setIncludeNumberPass] = useState(true);

  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [batchCount, setBatchCount] = useState(5);
  const [batchPasswords, setBatchPasswords] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  // Password Generator Core function
  const generatePassword = () => {
    if (passwordMode === 'passphrase') {
      let selectedWords = [];
      for (let i = 0; i < wordCount; i++) {
        const randomIndex = Math.floor(Math.random() * WORDS_POOL.length);
        let word = WORDS_POOL[randomIndex];
        if (capitalizeWords) {
          word = word.charAt(0).toUpperCase() + word.slice(1);
        }
        selectedWords.push(word);
      }
      let finalPass = selectedWords.join(separator);
      if (includeNumberPass) {
        finalPass += Math.floor(Math.random() * 10).toString() + Math.floor(Math.random() * 10).toString();
      }
      setPassword(finalPass);
      setHistory(prev => [finalPass, ...prev.slice(0, 19)]);
      return;
    }

    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let allowedChars = '';
    if (useUppercase) allowedChars += uppercaseChars;
    if (useLowercase) allowedChars += lowercaseChars;
    if (useNumbers) allowedChars += numberChars;
    if (useSymbols) allowedChars += symbolChars;

    if (excludeSimilar) {
      // Exclude i, l, 1, o, 0, O
      allowedChars = allowedChars.replace(/[il1o0O]/g, '');
    }

    if (!allowedChars) {
      setPassword('');
      return;
    }

    let generated = '';
    // Ensure at least one character from each selected set is included
    const mandatoryChars: string[] = [];
    if (useUppercase) {
      let pool = excludeSimilar ? uppercaseChars.replace(/[O]/g, '') : uppercaseChars;
      mandatoryChars.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    if (useLowercase) {
      let pool = excludeSimilar ? lowercaseChars.replace(/[il]/g, '') : lowercaseChars;
      mandatoryChars.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    if (useNumbers) {
      let pool = excludeSimilar ? numberChars.replace(/[01]/g, '') : numberChars;
      mandatoryChars.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    if (useSymbols) {
      mandatoryChars.push(symbolChars[Math.floor(Math.random() * symbolChars.length)]);
    }

    for (let i = generated.length; i < length; i++) {
      if (mandatoryChars.length > 0 && i < mandatoryChars.length) {
        generated += mandatoryChars[i];
      } else {
        const randomIndex = Math.floor(Math.random() * allowedChars.length);
        generated += allowedChars[randomIndex];
      }
    }

    // Shuffle the generated password
    const shuffled = generated.split('').sort(() => Math.random() - 0.5).join('');
    setPassword(shuffled);
    setHistory(prev => [shuffled, ...prev.slice(0, 19)]);
  };

  const generateBatch = () => {
    const list: string[] = [];
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    for (let count = 0; count < batchCount; count++) {
      if (passwordMode === 'passphrase') {
        let selectedWords = [];
        for (let i = 0; i < wordCount; i++) {
          const randomIndex = Math.floor(Math.random() * WORDS_POOL.length);
          let word = WORDS_POOL[randomIndex];
          if (capitalizeWords) {
            word = word.charAt(0).toUpperCase() + word.slice(1);
          }
          selectedWords.push(word);
        }
        let finalPass = selectedWords.join(separator);
        if (includeNumberPass) {
          finalPass += Math.floor(Math.random() * 10).toString() + Math.floor(Math.random() * 10).toString();
        }
        list.push(finalPass);
      } else {
        let allowedChars = '';
        if (useUppercase) allowedChars += uppercaseChars;
        if (useLowercase) allowedChars += lowercaseChars;
        if (useNumbers) allowedChars += numberChars;
        if (useSymbols) allowedChars += symbolChars;

        if (excludeSimilar) {
          allowedChars = allowedChars.replace(/[il1o0O]/g, '');
        }

        if (!allowedChars) continue;

        let generated = '';
        const mandatory: string[] = [];
        if (useUppercase) {
          let pool = excludeSimilar ? uppercaseChars.replace(/[O]/g, '') : uppercaseChars;
          mandatory.push(pool[Math.floor(Math.random() * pool.length)]);
        }
        if (useLowercase) {
          let pool = excludeSimilar ? lowercaseChars.replace(/[il]/g, '') : lowercaseChars;
          mandatory.push(pool[Math.floor(Math.random() * pool.length)]);
        }
        if (useNumbers) {
          let pool = excludeSimilar ? numberChars.replace(/[01]/g, '') : numberChars;
          mandatory.push(pool[Math.floor(Math.random() * pool.length)]);
        }
        if (useSymbols) {
          mandatory.push(symbolChars[Math.floor(Math.random() * symbolChars.length)]);
        }

        for (let i = 0; i < length; i++) {
          if (mandatory.length > 0 && i < mandatory.length) {
            generated += mandatory[i];
          } else {
            const randomIndex = Math.floor(Math.random() * allowedChars.length);
            generated += allowedChars[randomIndex];
          }
        }
        list.push(generated.split('').sort(() => Math.random() - 0.5).join(''));
      }
    }
    setBatchPasswords(list);
  };

  useEffect(() => {
    generatePassword();
  }, [length, useUppercase, useLowercase, useNumbers, useSymbols, excludeSimilar, passwordMode, wordCount, separator, capitalizeWords, includeNumberPass]);

  // Strength check metrics
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-slate-200', text: 'text-slate-400' };
    
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 14) score += 1;
    if (pass.length >= 20) score += 1;
    
    // Check entropy/diversity
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSymbols = /[^A-Za-z0-9]/.test(pass);
    
    const diversityCount = [hasUpper, hasLower, hasNumbers, hasSymbols].filter(Boolean).length;
    score += Math.floor(diversityCount / 2);

    if (pass.length < 8) {
      return { score: 1, label: 'Critical / Weak', color: 'bg-rose-500', text: 'text-rose-500' };
    }

    if (score <= 2) {
      return { score: 2, label: 'Weak', color: 'bg-amber-500', text: 'text-amber-500' };
    } else if (score === 3) {
      return { score: 3, label: 'Moderate', color: 'bg-yellow-500', text: 'text-yellow-500' };
    } else if (score === 4) {
      return { score: 4, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-500' };
    } else {
      return { score: 5, label: 'Military & Epic Shield', color: 'bg-indigo-600', text: 'text-indigo-600' };
    }
  };

  const strength = getPasswordStrength(password);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in text-slate-800 dark:text-slate-100">
      
      {/* Control Configuration Panel */}
      <div className="lg:col-span-7 bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
        
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-elegant-border/70 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Key Generator</h1>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Secure Cryptographic Generator</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-1 bg-slate-50 dark:bg-elegant-bg p-1 rounded-xl border border-slate-150 dark:border-elegant-border/80">
            {(['random', 'passphrase'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setPasswordMode(mode)}
                className={`px-3 py-1 text-[10px] uppercase font-bold rounded-lg cursor-pointer transition-all ${
                  passwordMode === mode
                    ? 'bg-white dark:bg-elegant-card shadow-sm text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Display Generated Area */}
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Active Signature</label>
          <div className="relative group bg-slate-50 dark:bg-elegant-bg border border-slate-200 dark:border-elegant-border rounded-2xl p-4 flex items-center justify-between gap-4 transition-all hover:bg-slate-100/50 dark:hover:bg-elegant-bg-hover">
            <div className="flex-1 min-w-0">
              <input
                type={showPassword ? 'text' : 'password'}
                readOnly
                value={password}
                className="w-full bg-transparent font-mono text-base md:text-lg font-bold text-indigo-600 dark:text-indigo-400 outline-none select-all"
                placeholder="Select requirements to generate..."
              />
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 bg-white dark:bg-elegant-card border border-slate-200 dark:border-elegant-border text-slate-550 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl cursor-pointer"
                title={showPassword ? 'Hide Key' : 'Display Key'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={generatePassword}
                className="p-2 bg-white dark:bg-elegant-card border border-slate-200 dark:border-elegant-border text-slate-555 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl cursor-pointer"
                title="Regenerate"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(password)}
                className="p-2 bg-white dark:bg-elegant-card border border-slate-200 dark:border-elegant-border text-slate-555 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl cursor-pointer"
                title="Copy Signature"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500 animate-pulse" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Strength visualization */}
          {password && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase">
                <span className="text-slate-400 dark:text-slate-500">Defense Strength:</span>
                <span className={`${strength.text} tracking-wider font-extrabold`}>{strength.label}</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 transition-all duration-300 ${
                      i < strength.score ? strength.color : 'bg-slate-205 dark:bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {passwordMode === 'random' ? (
          <div className="space-y-5">
            {/* Length Configuration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1">
                <span>Character Length</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-950/30 px-2 py-0.5 rounded-lg font-bold">
                  {length} characters
                </span>
              </div>
              <input
                type="range"
                min={8}
                max={64}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg cursor-pointer"
              />
            </div>

            {/* Checklist options */}
            <div className="space-y-3 pt-1">
              <label className="text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block">Allowed Elements</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  { state: useUppercase, set: setUseUppercase, label: 'Capital Letters (A-Z)', desc: 'Include alphabetical uppercase' },
                  { state: useLowercase, set: setUseLowercase, label: 'Small Letters (a-z)', desc: 'Include alphabetical lowercase' },
                  { state: useNumbers, set: setUseNumbers, label: 'Numbers (0-9)', desc: 'Include decimal figures' },
                  { state: useSymbols, set: setUseSymbols, label: 'Symbols (!@#$...)', desc: 'Include strong custom glyphs' }
                ].map((opt, i) => (
                  <div
                    key={i}
                    onClick={() => opt.set(!opt.state)}
                    className={`p-3.5 border rounded-2xl cursor-pointer transition-all flex items-start gap-3.5 select-none ${
                      opt.state
                        ? 'bg-indigo-50/40 border-indigo-200 dark:bg-indigo-950/15 dark:border-indigo-900/60'
                        : 'bg-white dark:bg-elegant-bg border-slate-200 dark:border-elegant-border hover:bg-slate-50 dark:hover:bg-elegant-bg-hover'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={opt.state}
                      onChange={() => {}} // handled by div click
                      className="mt-0.5 accent-indigo-550 h-4 w-4 shrink-0 rounded"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-neutral-100 leading-tight">{opt.label}</h4>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold">{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div 
              onClick={() => setExcludeSimilar(!excludeSimilar)}
              className={`p-3.5 border rounded-2xl cursor-pointer transition-all flex items-start gap-3.5 select-none ${
                excludeSimilar
                  ? 'bg-indigo-50/40 border-indigo-200 dark:bg-indigo-950/15 dark:border-indigo-900/60'
                  : 'bg-white dark:bg-elegant-bg border-slate-200 dark:border-elegant-border hover:bg-slate-50 dark:hover:bg-elegant-bg-hover'
              }`}
            >
              <input
                type="checkbox"
                checked={excludeSimilar}
                onChange={() => {}}
                className="mt-0.5 accent-indigo-550 h-4 w-4 shrink-0 rounded"
              />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-neutral-100 leading-tight">Exclude Mimic Characters</h4>
                <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold">Disable ambiguous figures such as <code className="font-mono bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded">i, l, 1, o, 0, O</code></p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Word Count */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
                <span>Number of Words</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-950/30 px-2 py-0.5 rounded-lg font-bold">
                  {wordCount} words
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={9}
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block">Separator Token</label>
                <input
                  type="text"
                  maxLength={1}
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border font-mono text-center outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block">Capitalization</label>
                <div className="grid grid-cols-2 gap-1 bg-slate-50 dark:bg-elegant-bg p-1 rounded-xl border border-slate-150 dark:border-elegant-border/80 h-[38px] items-center">
                  <button
                    onClick={() => setCapitalizeWords(true)}
                    className={`py-1 text-[10px] font-bold rounded-lg cursor-pointer ${
                      capitalizeWords ? 'bg-white dark:bg-elegant-card shadow-xs text-indigo-600 dark:text-indigo-400' : 'text-slate-500'
                    }`}
                  >
                    Camel
                  </button>
                  <button
                    onClick={() => setCapitalizeWords(false)}
                    className={`py-1 text-[10px] font-bold rounded-lg cursor-pointer ${
                      !capitalizeWords ? 'bg-white dark:bg-elegant-card shadow-xs text-indigo-600 dark:text-indigo-400' : 'text-slate-500'
                    }`}
                  >
                    Lower
                  </button>
                </div>
              </div>
            </div>

            <div 
              onClick={() => setIncludeNumberPass(!includeNumberPass)}
              className={`p-3.5 border rounded-2xl cursor-pointer transition-all flex items-start gap-3.5 select-none ${
                includeNumberPass
                  ? 'bg-indigo-50/40 border-indigo-200 dark:bg-indigo-950/15 dark:border-indigo-900/60'
                  : 'bg-white dark:bg-elegant-bg border-slate-200 dark:border-elegant-border hover:bg-slate-50 dark:hover:bg-elegant-bg-hover'
              }`}
            >
              <input
                type="checkbox"
                checked={includeNumberPass}
                onChange={() => {}}
                className="mt-0.5 accent-indigo-550 h-4 w-4 shrink-0 rounded"
              />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-neutral-100 leading-tight">Append Random Cipher Digits</h4>
                <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold font-sans">Appends two randomized digit blocks to the tail (e.g. <code className="font-mono bg-slate-100 dark:bg-slate-905 px-1 py-0.5 rounded">Apple-Honey74</code>)</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Multi Generator & History Panel */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Bulk Area */}
        <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ListPlus className="h-4.5 w-4.5 text-indigo-500" />
              <span className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
                Bulk Generation
              </span>
            </div>
            
            <select
              value={batchCount}
              onChange={(e) => setBatchCount(Number(e.target.value))}
              className="text-[10px] font-extrabold rounded-lg border border-slate-200 dark:border-elegant-border bg-slate-50 dark:bg-elegant-bg px-2.5 py-1 text-slate-755 dark:text-neutral-200 outline-none"
            >
              <option value={5}>5 keys</option>
              <option value={10}>10 keys</option>
              <option value={15}>15 keys</option>
            </select>
          </div>

          <button
            onClick={generateBatch}
            className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generate Random Pool</span>
          </button>

          {batchPasswords.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 p-1 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-150 dark:border-elegant-border/50 rounded-2xl">
              {batchPasswords.map((pass, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-elegant-card border border-slate-150 dark:border-elegant-border/80 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-900 transition-colors"
                >
                  <code className="text-xs font-mono font-bold text-slate-705 dark:text-neutral-200 truncate select-all">{pass}</code>
                  <button
                    onClick={() => copyToClipboard(pass)}
                    className="p-1 px-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-400 transition-colors shrink-0 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History Area */}
        <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <History className="h-4.5 w-4.5 text-indigo-500" />
              <span className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
                Session Audit History
              </span>
            </div>

            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                className="text-[10px] font-extrabold text-rose-500 hover:text-rose-600 uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span>Flush</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 font-semibold font-sans">No signatures generated in this session yet.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 p-1 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-150 dark:border-elegant-border/50 rounded-2xl">
              {history.map((pass, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-elegant-card border border-slate-155 dark:border-elegant-border/80 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-900 transition-colors"
                >
                  <code className="text-xs font-mono font-bold text-slate-455 dark:text-neutral-400 truncate select-all">{pass}</code>
                  <button
                    onClick={() => copyToClipboard(pass)}
                    className="p-1 px-1.5 hover:text-indigo-650 dark:hover:text-indigo-400 text-slate-400 transition-colors shrink-0 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
