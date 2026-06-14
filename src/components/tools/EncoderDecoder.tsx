import React, { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Clipboard, RefreshCw, Layers, ShieldCheck } from 'lucide-react';

export default function EncoderDecoder() {
  const [mode, setMode] = useState<'base64' | 'url' | 'html' | 'hash'>('base64');
  const [isEncode, setIsEncode] = useState(true);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [hashAlgorithm, setHashAlgorithm] = useState<'SHA-256' | 'SHA-1' | 'MD5'>('SHA-256');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const calculateHash = async (text: string) => {
    if (!text) {
      setOutput('');
      return;
    }

    if (hashAlgorithm === 'MD5') {
      const hash = simpleMD5(text);
      setOutput(hash);
      return;
    }

    try {
      const msgBuffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest(hashAlgorithm, msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setOutput(hashHex);
      setError(null);
    } catch (err) {
      setError('Crypto API failed or is not supported in this frame environment.');
      setOutput('');
    }
  };

  const simpleMD5 = (string: string) => {
    function RotateLeft(lValue: number, iShiftBits: number) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function AddUnsigned(lX: number, lY: number) {
      const lX8 = lX & 0x80000000;
      const lY8 = lY & 0x80000000;
      const lX4 = lX & 0x40000000;
      const lY4 = lY & 0x40000000;
      const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
      if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
        return lResult ^ 0x40000000 ^ lX8 ^ lY8;
      }
      return lResult ^ lX8 ^ lY8;
    }
    function F(x: number, y: number, z: number) { return (x & y) | (~x & z); }
    function G(x: number, y: number, z: number) { return (x & z) | (y & ~z); }
    function H(x: number, y: number, z: number) { return x ^ y ^ z; }
    function I(x: number, y: number, z: number) { return y ^ (x | ~z); }
    function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    function ConvertToWordArray(string: string) {
      let lWordCount;
      const lMessageLength = string.length;
      const lNumberOfWords_temp1 = lMessageLength + 8;
      const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
      const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
      const lWordArray = Array(lNumberOfWords - 1);
      let lBytePosition = 0;
      let lByteCount = 0;
      while (lByteCount < lMessageLength) {
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition);
        lByteCount++;
      }
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
      return lWordArray;
    }
    function WordToHex(lValue: number) {
      let WordToHexValue = '', WordToHexValue_temp = '', lByte, lCount;
      for (lCount = 0; lCount <= 3; lCount++) {
        lByte = (lValue >>> (lCount * 8)) & 255;
        WordToHexValue_temp = '0' + lByte.toString(16);
        WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
      }
      return WordToHexValue;
    }
    function Utf8Encode(string: string) {
      string = string.replace(/\r\n/g, '\n');
      let utftext = '';
      for (let n = 0; n < string.length; n++) {
        const c = string.charCodeAt(n);
        if (c < 128) {
          utftext += String.fromCharCode(c);
        } else if (c > 127 && c < 2048) {
          utftext += String.fromCharCode((c >> 6) | 192);
          utftext += String.fromCharCode((c & 63) | 128);
        } else {
          utftext += String.fromCharCode((c >> 12) | 224);
          utftext += String.fromCharCode(((c >> 6) & 63) | 128);
          utftext += String.fromCharCode((c & 63) | 128);
        }
      }
      return utftext;
    }
    let x = [];
    let k, AA, BB, CC, DD, a, b, c, d;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    string = Utf8Encode(string);
    x = ConvertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
      AA = a; BB = b; CC = c; DD = d;
      a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
      d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
      c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
      b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
      a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
      d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
      c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
      b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
      a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
      d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
      c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
      b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
      a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
      d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
      c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
      b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
      a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
      d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
      c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
      b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
      a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
      d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
      c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
      b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
      a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
      d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
      c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
      b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
      a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
      d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
      c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
      b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
      a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
      d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
      c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
      b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
      a = HH(a, b, c, d, x[k + 11], S31, 0xA4BEEA44);
      d = HH(d, a, b, c, x[k + 2], S32, 0x4BDECFA9);
      c = HH(c, d, a, b, x[k + 5], S33, 0xF6BB4B60);
      b = HH(b, c, d, a, x[k + 8], S34, 0xBEBFBC70);
      a = HH(a, b, c, d, x[k + 11], S31, 0x289B7EC6);
      d = HH(d, a, b, c, x[k + 14], S32, 0xEAA127FA);
      c = HH(c, d, a, b, x[k + 1], S33, 0xD4EF3085);
      b = HH(b, c, d, a, x[k + 4], S34, 0x4881D05);
      a = HH(a, b, c, d, x[k + 7], S31, 0xD9D4D039);
      d = HH(d, a, b, c, x[k + 10], S32, 0xE6DB99E5);
      c = HH(c, d, a, b, x[k + 13], S33, 0x1FA27CF8);
      b = HH(b, c, d, a, x[k + 0], S34, 0xC4AC5665);
      a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
      d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
      c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
      b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
      a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
      d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
      c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
      b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
      a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
      d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
      c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
      b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
      a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
      d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
      c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
      b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
      a = AddUnsigned(a, AA);
      b = AddUnsigned(b, BB);
      c = AddUnsigned(c, CC);
      d = AddUnsigned(d, DD);
    }
    const temp = WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d);
    return temp.toLowerCase();
  };

  const handleProcess = async () => {
    if (!input) {
      setOutput('');
      setError(null);
      return;
    }

    setError(null);

    if (mode === 'hash') {
      await calculateHash(input);
      return;
    }

    try {
      if (mode === 'base64') {
        if (isEncode) {
          setOutput(btoa(unescape(encodeURIComponent(input))));
        } else {
          try {
            setOutput(decodeURIComponent(escape(atob(input))));
          } catch {
            setOutput(atob(input)); // Fallback
          }
        }
      } else if (mode === 'url') {
        if (isEncode) {
          setOutput(encodeURIComponent(input));
        } else {
          setOutput(decodeURIComponent(input));
        }
      } else if (mode === 'html') {
        if (isEncode) {
          const div = document.createElement('div');
          div.textContent = input;
          setOutput(div.innerHTML);
        } else {
          const div = document.createElement('div');
          div.innerHTML = input;
          setOutput(div.textContent || '');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Processing failed. Please check your format.');
      setOutput('');
    }
  };

  useEffect(() => {
    handleProcess();
  }, [input, mode, isEncode, hashAlgorithm]);

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200 dark:border-elegant-border">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Encoder, Decoder & Hashers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Instantly convert and generate Base64, URL codes, HTML tokens, and message digests.</p>
        </div>
        <button
          onClick={handleClear}
          className="self-start sm:self-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:bg-elegant-card dark:border-elegant-border dark:text-slate-300 dark:hover:bg-elegant-card-hover transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Clear Fields
        </button>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-elegant-sidebar rounded-xl max-w-xl">
        <button
          onClick={() => { setMode('base64'); setError(null); }}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            mode === 'base64'
              ? 'bg-white text-slate-800 shadow dark:bg-elegant-card-hover dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Base64
        </button>
        <button
          onClick={() => { setMode('url'); setError(null); }}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            mode === 'url'
              ? 'bg-white text-slate-800 shadow dark:bg-elegant-card-hover dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200'
          }`}
        >
          URL Encode
        </button>
        <button
          onClick={() => { setMode('html'); setError(null); }}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            mode === 'html'
              ? 'bg-white text-slate-800 shadow dark:bg-elegant-card-hover dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          HTML Entity
        </button>
        <button
          onClick={() => { setMode('hash'); setError(null); }}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            mode === 'hash'
              ? 'bg-white text-slate-800 shadow dark:bg-elegant-card-hover dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Hash Generator
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Source Input</span>
            {mode !== 'hash' ? (
              <button
                onClick={() => setIsEncode(!isEncode)}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:opacity-85"
              >
                {isEncode ? (
                  <>
                    <ToggleLeft className="h-4 w-4 text-emerald-500" />
                    <span>Encode Mode</span>
                  </>
                ) : (
                  <>
                    <ToggleRight className="h-4 w-4 text-sky-500" />
                    <span>Decode Mode</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                <select
                  value={hashAlgorithm}
                  onChange={(e) => setHashAlgorithm(e.target.value as any)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs bg-white dark:bg-elegant-card dark:border-elegant-border text-slate-700 dark:text-slate-350 focus:outline-none"
                >
                  <option value="SHA-256">SHA-256</option>
                  <option value="SHA-1">SHA-1</option>
                  <option value="MD5">MD5</option>
                </select>
              </div>
            )}
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Type or paste text to ${mode === 'hash' ? 'hash' : isEncode ? 'encode' : 'decode'}...`}
            className="h-64 w-full rounded-xl border border-slate-200 p-4 font-mono text-sm bg-white text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-elegant-card dark:border-elegant-border dark:text-slate-100 focus:outline-none resize-none"
          />
        </div>

        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Output Result</span>
            {output && (
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                  copied
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-900/30'
                }`}
              >
                <Clipboard className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>

          {error ? (
            <div className="flex h-64 w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-red-600 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-300">
              <span className="text-sm font-mono">{error}</span>
            </div>
          ) : output ? (
            <textarea
              readOnly
              value={output}
              className="h-64 w-full rounded-xl border border-slate-200 p-4 font-mono text-sm bg-slate-50 text-slate-800 dark:bg-elegant-bg dark:border-elegant-border dark:text-slate-100 focus:outline-none resize-none"
            />
          ) : (
            <div className="flex h-64 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30 dark:border-elegant-border dark:bg-elegant-card/40">
              <Layers className="h-8 w-8 text-slate-400 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Converted result will automatically display here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
