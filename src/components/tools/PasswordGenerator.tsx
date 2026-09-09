import React, { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Key, Eye, EyeOff, Sparkles, ListPlus, History, Trash2 } from 'lucide-react';
import { copyText, randomInt, shuffled } from '../../lib/utils';

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

  const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
  const NUMBERS = '0123456789';
  const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  // Ambiguous glyphs, both cases - the old list dropped uppercase I and L.
  const SIMILAR = /[iIlL1oO0]/g;

  const pick = (pool: string) => pool[randomInt(pool.length)];

  const buildPassphrase = () => {
    const words = Array.from({ length: wordCount }, () => {
      const word = WORDS_POOL[randomInt(WORDS_POOL.length)];
      return capitalizeWords ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    });
    const phrase = words.join(separator);
    return includeNumberPass ? phrase + randomInt(10) + randomInt(10) : phrase;
  };

  const buildRandomKey = () => {
    const trim = (pool: string) => (excludeSimilar ? pool.replace(SIMILAR, '') : pool);
    const pools = [
      useUppercase && trim(UPPERCASE),
      useLowercase && trim(LOWERCASE),
      useNumbers && trim(NUMBERS),
      useSymbols && SYMBOLS,
    ].filter((pool): pool is string => Boolean(pool) && (pool as string).length > 0);

    if (pools.length === 0) return '';

    const allowed = pools.join('');
    // One guaranteed character per selected class, then fill. Truncated rather
    // than padded when length < class count, so `length` is always honoured.
    const mandatory = pools.map(pick).slice(0, length);
    const rest = Array.from({ length: Math.max(0, length - mandatory.length) }, () => pick(allowed));
    return shuffled([...mandatory, ...rest]).join('');
  };

  const generatePassword = () => {
    const next = passwordMode === 'passphrase' ? buildPassphrase() : buildRandomKey();
    setPassword(next);
    if (next) setHistory(prev => [next, ...prev.slice(0, 19)]);
  };

  const generateBatch = () => {
    const build = passwordMode === 'passphrase' ? buildPassphrase : buildRandomKey;
    setBatchPasswords(Array.from({ length: batchCount }, build).filter(Boolean));
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
    
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSymbols = /[^A-Za-z0-9]/.test(pass);
    
    const diversityCount = [hasUpper, hasLower, hasNumbers, hasSymbols].filter(Boolean).length;
    score += Math.floor(diversityCount / 2);

    if (pass.length < 8) {
      return { score: 1, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-600' };
    }

    if (score <= 2) {
      return { score: 2, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-600' };
    } else if (score === 3) {
      return { score: 3, label: 'Good', color: 'bg-yellow-500', text: 'text-yellow-600' };
    } else if (score === 4) {
      return { score: 4, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' };
    } else {
      return { score: 5, label: 'Very Strong', color: 'bg-slate-900', text: 'text-slate-900' };
    }
  };

  const strength = getPasswordStrength(password);

  const copyToClipboard = (text: string) => {
    copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-slate-900">
      
      {/* Control Configuration Panel */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">

        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Key Generator</h2>
              <p className="text-xs text-slate-500 font-medium">Secure Cryptographic Generator</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-md border border-slate-200/80">
            {(['random', 'passphrase'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setPasswordMode(mode)}
                className={`px-2.5 py-1 text-xs font-medium capitalize rounded transition-all cursor-pointer ${
                  passwordMode === mode
                    ? 'bg-white shadow-xs text-slate-900 font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Display Generated Area */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 block">Generated Key</label>
          <div className="relative bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <input
                type={showPassword ? 'text' : 'password'}
                readOnly
                value={password}
                className="w-full bg-transparent font-mono text-base font-bold text-slate-900 outline-none select-all"
                placeholder="Select requirements to generate..."
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-md shadow-xs cursor-pointer transition-colors"
                title={showPassword ? 'Hide Key' : 'Display Key'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={generatePassword}
                className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-md shadow-xs cursor-pointer transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(password)}
                className="p-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-md shadow-xs cursor-pointer transition-colors"
                title="Copy Signature"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Strength visualization */}
          {password && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-500">Security Score:</span>
                <span className={`${strength.text} font-semibold`}>{strength.label}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 transition-all duration-300 ${
                      i < strength.score ? strength.color : 'bg-slate-200'
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
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Character Length</span>
                <span className="font-mono text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-semibold">
                  {length} characters
                </span>
              </div>
              <input
                type="range"
                min={8}
                max={64}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
              />
            </div>

            {/* Checklist options */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 block">Character Types</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { state: useUppercase, set: setUseUppercase, label: 'Capital Letters (A-Z)', desc: 'Include uppercase' },
                  { state: useLowercase, set: setUseLowercase, label: 'Small Letters (a-z)', desc: 'Include lowercase' },
                  { state: useNumbers, set: setUseNumbers, label: 'Numbers (0-9)', desc: 'Include digits' },
                  { state: useSymbols, set: setUseSymbols, label: 'Symbols (!@#$...)', desc: 'Include special characters' }
                ].map((opt, i) => (
                  <div
                    key={i}
                    onClick={() => opt.set(!opt.state)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all flex items-start gap-3 select-none ${
                      opt.state
                        ? 'bg-blue-50 border-blue-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={opt.state}
                      onChange={() => {}}
                      className="mt-0.5 accent-blue-600 h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 leading-tight">{opt.label}</h4>
                      <p className="text-[11px] text-slate-500 font-normal">{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div 
              onClick={() => setExcludeSimilar(!excludeSimilar)}
              className={`p-3 border rounded-lg cursor-pointer transition-all flex items-start gap-3 select-none ${
                excludeSimilar
                  ? 'bg-blue-50 border-blue-500 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={excludeSimilar}
                onChange={() => {}}
                className="mt-0.5 accent-blue-600 h-4 w-4 shrink-0 rounded border-slate-300"
              />
              <div>
                <h4 className="text-xs font-semibold text-slate-900 leading-tight">Exclude Similar Characters</h4>
                <p className="text-[11px] text-slate-500 font-normal">Omit ambiguous characters like <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">i, I, l, L, 1, o, O, 0</code></p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Number of Words</span>
                <span className="font-mono text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-semibold">
                  {wordCount} words
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={9}
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 block">Separator Token</label>
                <input
                  type="text"
                  maxLength={1}
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white font-mono text-center outline-none focus:ring-2 focus:ring-blue-500/50 shadow-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 block">Capitalization</label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-md border border-slate-200 h-[34px] items-center">
                  <button
                    onClick={() => setCapitalizeWords(true)}
                    className={`py-0.5 text-xs font-medium rounded cursor-pointer ${
                      capitalizeWords ? 'bg-white shadow-xs text-slate-900 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    Title
                  </button>
                  <button
                    onClick={() => setCapitalizeWords(false)}
                    className={`py-0.5 text-xs font-medium rounded cursor-pointer ${
                      !capitalizeWords ? 'bg-white shadow-xs text-slate-900 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    Lower
                  </button>
                </div>
              </div>
            </div>

            <div 
              onClick={() => setIncludeNumberPass(!includeNumberPass)}
              className={`p-3 border rounded-lg cursor-pointer transition-all flex items-start gap-3 select-none ${
                includeNumberPass
                  ? 'bg-blue-50 border-blue-500 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={includeNumberPass}
                onChange={() => {}}
                className="mt-0.5 accent-blue-600 h-4 w-4 shrink-0 rounded border-slate-300"
              />
              <div>
                <h4 className="text-xs font-semibold text-slate-900 leading-tight">Append Random Digits</h4>
                <p className="text-[11px] text-slate-500 font-normal">Appends random numbers to the tail (e.g. <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">Apple-Honey74</code>)</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Multi Generator & History Panel */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Bulk Area */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListPlus className="h-4 w-4 text-slate-700" />
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Bulk Generation
              </span>
            </div>
            
            <select
              value={batchCount}
              onChange={(e) => setBatchCount(Number(e.target.value))}
              className="text-xs font-medium rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-900 outline-none shadow-xs"
            >
              <option value={5}>5 keys</option>
              <option value={10}>10 keys</option>
              <option value={15}>15 keys</option>
            </select>
          </div>

          <button
            onClick={generateBatch}
            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-200" />
            <span>Generate Batch Keys</span>
          </button>

          {batchPasswords.length > 0 && (
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1 p-1 bg-slate-50 border border-slate-200 rounded-lg">
              {batchPasswords.map((pass, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 p-2 bg-white border border-slate-200 rounded-md hover:border-slate-300 transition-colors"
                >
                  <code className="text-xs font-mono font-medium text-slate-800 truncate select-all">{pass}</code>
                  <button
                    onClick={() => copyToClipboard(pass)}
                    className="p-1 hover:text-slate-900 text-slate-400 transition-colors shrink-0 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History Area */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-700" />
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Session Audit History
              </span>
            </div>

            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                className="text-xs font-medium text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 font-normal">No signatures generated in this session yet.</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1 p-1 bg-slate-50 border border-slate-200 rounded-lg">
              {history.map((pass, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 p-2 bg-white border border-slate-200 rounded-md hover:border-slate-300 transition-colors"
                >
                  <code className="text-xs font-mono font-medium text-slate-600 truncate select-all">{pass}</code>
                  <button
                    onClick={() => copyToClipboard(pass)}
                    className="p-1 hover:text-slate-900 text-slate-400 transition-colors shrink-0 cursor-pointer"
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
