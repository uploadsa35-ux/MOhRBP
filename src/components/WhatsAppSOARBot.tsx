import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Check, 
  CheckCheck, 
  MessageSquare, 
  Smartphone, 
  Sparkles, 
  Copy, 
  CheckCircle2, 
  ExternalLink,
  Shield,
  Lock,
  ArrowRight,
  Info
} from 'lucide-react';
import { recordCardToFirestore } from '../firebase';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  receiptId?: string;
}

export const WhatsAppSOARBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'bot',
      text: '👷‍♂️ *Welcome to Rig 50 SOAR Safety Bot!*\n\nYou can submit observations directly from WhatsApp without opening any forms or downloading anything.\n\nType your safety observation below, or try one of the quick templates!',
      time: new Date(Date.now() - 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);
  const [isPendingApproval, setIsPendingApproval] = useState<boolean>(false);
  const [currentDraft, setCurrentDraft] = useState<any | null>(null);
  const [useAiReviewMode, setUseAiReviewMode] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickTemplates = [
    {
      label: 'Safe on Rig Floor',
      text: 'Safe on Rig Floor: Crew members stayed completely outside the marked red zone perimeter during casing run.'
    },
    {
      label: 'Hands-Free on Pipe Deck',
      text: 'Safe on Pipe Deck: Hands-free push sticks used to guide crossover sub. Name: Mohammed Al-Otaibi'
    },
    {
      label: 'Unsafe Housekeeping',
      text: 'Unsafe condition on Main Deck: Power cable left crossing walkway without rubber ramp. Rerouted immediately.'
    },
    {
      label: 'Anonymous SWA at Cranes',
      text: 'Stop Work Authority at Cranes: Lift paused due to wind gusts exceeding limit. Anonymous.'
    },
    {
      label: '🇸🇦 كرت سلامة بالعربي (أرضية الحفر)',
      text: 'اكتب لي كرت سلامة باللغة العربية عن انسكاب زيت على أرضية الحفر بواسطة أحمد'
    },
    {
      label: '🇸🇦 سلوك آمن (الكانتليفر)',
      text: 'ملاحظة سلوك آمن في منطقة الأنابيب: استخدام عصي التوجيه بدون لمس باليدين بواسطة محمد العتيبي'
    }
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputText;
    if (!message.trim() || isSending) return;

    const userMsgId = `user_${Date.now()}`;
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [
      ...prev,
      { id: userMsgId, sender: 'user', text: message, time: userTime }
    ]);

    if (!textToSend) setInputText('');
    setIsSending(true);

    try {
      const response = await fetch('/api/whatsapp-webhook', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client: 'web',
          Body: message,
          From: 'whatsapp:+966500000000',
          ProfileName: 'Rig 50 Crew',
          instant: !useAiReviewMode
        })
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        // Fallback if plain text or XML was returned
        const cleaned = rawText.replace(/<[^>]*>/g, '').trim();
        data = {
          success: true,
          replyMessage: cleaned || 'Observation received.'
        };
      }

      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (data.success || data.replyMessage) {
        setIsPendingApproval(Boolean(data.isPendingApproval));
        setCurrentDraft(data.draft || null);

        setMessages(prev => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            text: (data.replyMessage || '').replace(/\\n/g, '\n'),
            time: botTime,
            receiptId: data.responseId
          }
        ]);

        if (data.status === 'submitted' && data.draft) {
          recordCardToFirestore({
            responseId: String(data.responseId || ''),
            date: new Date().toISOString().split('T')[0],
            time: botTime,
            zone: data.draft.zone || 'Rig Floor',
            role: data.draft.role || 'Floorman',
            observerRole: 'Observer',
            observerName: data.draft.name || '(Anonymous)',
            assessment: data.draft.assessment || 'Safe',
            obsType: data.draft.obsType || 'Behavior Observation',
            observation: data.draft.observation || '',
            action: data.draft.action || '',
            aiPolished: true
          }).catch(fsErr => console.warn('Firestore bot card record notice:', fsErr));
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            text: `❌ Could not submit to Microsoft Forms: ${data.error || 'Server error'}`,
            time: botTime
          }
        ]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: `⚠️ Network error: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.run.app';
  const webhookUrl = `${currentHost}/api/whatsapp-webhook`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title & Overview Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </span>
            <h2 className="text-base sm:text-lg font-bold">
              Submit via WhatsApp to Rig 50
            </h2>
            <span className="bg-emerald-500/30 text-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-400/40">
              Live Webhook Active
            </span>
          </div>
          <p className="text-xs text-emerald-100/90 max-w-xl leading-relaxed">
            Crew members on Rig 50 can send a simple WhatsApp message. The cloud bot parses the text, submits to Microsoft Forms for <strong>50 Bob Palmer</strong>, and texts back an instant confirmation receipt.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-800">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Locked to Rig 50: <strong>50 Bob Palmer (RBP-50A)</strong></span>
        </div>
      </div>

      {/* Main Grid: WhatsApp Phone Mockup on Left, Instructions on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive WhatsApp Chat Simulator */}
        <div className="lg:col-span-6 bg-slate-900 p-3 sm:p-4 rounded-2xl shadow-lg border border-slate-700 max-w-md mx-auto w-full">
          {/* Phone Shell Top Bar */}
          <div className="bg-[#075E54] text-white p-3 rounded-t-xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-400/30">
                SOAR
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                  <span>Rig 50 Safety Bot</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </div>
                <div className="text-[10px] text-emerald-100/80">Online · 50 Bob Palmer</div>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded font-mono">
              Live
            </span>
          </div>

          {/* Chat Messages Body (WhatsApp Chat Wallpaper style) */}
          <div className="h-96 overflow-y-auto p-3 space-y-2.5 bg-[#ECE5DD] rounded-b-none text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-2.5 rounded-lg max-w-[85%] shadow-2xs whitespace-pre-wrap leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#DCF8C6] text-slate-900 rounded-tr-none'
                      : 'bg-white text-slate-900 rounded-tl-none border border-slate-200/60'
                  }`}
                >
                  {m.text}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-500">
                    <span>{m.time}</span>
                    {m.sender === 'user' && <CheckCheck className="w-3 h-3 text-sky-600" />}
                  </div>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/80 p-2 rounded-lg max-w-[60%]">
                <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping"></span>
                <span>Submitting to Microsoft Forms...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Click Prompts */}
          <div className="p-2 bg-slate-800 border-t border-slate-700">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Quick Test Observations:
              </span>
              <button
                type="button"
                onClick={() => setUseAiReviewMode(!useAiReviewMode)}
                className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all ${
                  useAiReviewMode
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-700 text-slate-400'
                }`}
                title="Toggle AI Coach review before submitting"
              >
                {useAiReviewMode ? '🤖 AI Review Mode: ON' : '⚡ 1-Click Direct'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickTemplates.map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(t.text)}
                  disabled={isSending}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] rounded transition-colors disabled:opacity-50 text-left truncate max-w-[200px]"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Draft Review Bar */}
          {isPendingApproval && (
            <div className="p-2.5 bg-emerald-950/90 border-t border-emerald-700/60 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {currentDraft?.language === 'ar' ? 'مسودة الكرت جاهزة — هل توافق عليها؟' : 'Card Draft Ready — Do you agree?'}
                </span>
                <span className="text-[10px] text-emerald-400/80">
                  {currentDraft?.language === 'ar' ? 'أرسل نعم أو اضغط بالأسفل' : 'Reply YES or tap below'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSendMessage(currentDraft?.language === 'ar' ? 'نعم' : 'YES')}
                  disabled={isSending}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-md shadow-xs flex items-center gap-1 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{currentDraft?.language === 'ar' ? 'موافق وإرسال لريج 50 (نعم)' : 'Agree & Submit to Rig 50 (YES)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage(currentDraft?.language === 'ar' ? 'اجعل الحالة غير آمن' : 'Make assessment Unsafe')}
                  disabled={isSending}
                  className="px-2 py-1 bg-amber-600/80 hover:bg-amber-600 text-white text-[11px] font-semibold rounded-md transition-all"
                >
                  <span>{currentDraft?.language === 'ar' ? '⚠️ غير آمن' : '⚠️ Make Unsafe'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage(currentDraft?.language === 'ar' ? 'غير المنطقة إلى منطقة الأنابيب والكانتليفر' : 'Change zone to Cantilever / Pipe Deck')}
                  disabled={isSending}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] rounded-md transition-all"
                >
                  <span>{currentDraft?.language === 'ar' ? '📍 منطقة الأنابيب' : '📍 Pipe Deck'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage(currentDraft?.language === 'ar' ? 'إلغاء' : 'CANCEL')}
                  disabled={isSending}
                  className="px-2 py-1 bg-rose-900/60 hover:bg-rose-900 text-rose-300 text-[11px] rounded-md transition-all"
                >
                  <span>{currentDraft?.language === 'ar' ? '❌ إلغاء' : '❌ Cancel'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Chat Input Field */}
          <div className="p-2.5 bg-slate-800 rounded-b-xl flex items-center gap-2 border-t border-slate-700">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder={isPendingApproval ? "Type 'YES' to send, or type any changes..." : "Type an observation or 'Anonymous'..."}
              disabled={isSending}
              className="flex-1 px-3 py-2 bg-slate-900 text-slate-100 placeholder-slate-500 text-xs rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isSending || !inputText.trim()}
              className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: How to Connect a Real WhatsApp Number */}
        <div className="lg:col-span-6 space-y-4">
          {/* Card: AI Safety Coach Explained */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-xs space-y-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </span>
                <span className="font-bold text-sm text-slate-100">AI Safety Coach (Google Gemini AI)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                gemini-4-hydrogen
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Yes, this is powered by <strong>Google Gemini AI</strong> on the server! Instead of directly dumping raw WhatsApp messages into the database, it acts as a real-time safety coach:
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 flex items-start gap-2">
                <span className="text-emerald-400 font-bold">1.</span>
                <p className="text-slate-300 text-[11px]">
                  <strong>Rewrites into SOAR Terminology:</strong> Takes rough, rushed notes (e.g. <em>"crane hook was swinging near pipe rack"</em>) and rewrites them into structured, professional oilfield safety language with proper zone, role, hazard assessment, and action taken.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 flex items-start gap-2">
                <span className="text-emerald-400 font-bold">2.</span>
                <p className="text-slate-300 text-[11px]">
                  <strong>Reviews with Crew Before Sending:</strong> Sends a preview card to WhatsApp and asks: <em>"Do you agree with this card? Reply YES to submit or tell me changes."</em>
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 flex items-start gap-2">
                <span className="text-emerald-400 font-bold">3.</span>
                <p className="text-slate-300 text-[11px]">
                  <strong>Multi-turn Revisions:</strong> If the person replies with edits (e.g. <em>"Change zone to Shakers"</em> or <em>"Add my name Khalid"</em>), AI updates the card and asks for agreement again. Only when they say <strong>YES</strong> is it submitted to Microsoft Forms.
                </p>
              </div>
            </div>
          </div>

          {/* Card: Connecting Real WhatsApp */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>How to Connect a Real WhatsApp Number</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This app has a pre-built webhook receiver ready for <strong>Twilio WhatsApp</strong> or <strong>Meta WhatsApp Cloud API</strong>. When anyone texts your WhatsApp number, it automatically posts to Microsoft Forms for Rig 50!
            </p>

            {/* Webhook URL Box */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase">
                Your Live WhatsApp Webhook URL:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs text-slate-800 select-all"
                />
                <button
                  type="button"
                  onClick={copyWebhookUrl}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded border border-slate-300 transition-colors"
                >
                  {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* 3 Step Guide */}
            <div className="space-y-2 pt-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Step 1: Open Twilio or Meta WhatsApp Console</span>
                <p className="text-slate-600 text-[11px]">
                  Go to Twilio Console &rarr; Messaging &rarr; Try WhatsApp Sandbox (or WhatsApp Senders).
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Step 2: Paste the Webhook URL</span>
                <p className="text-slate-600 text-[11px]">
                  In "WHEN A MESSAGE COMES IN", paste the URL above with method <strong>HTTP POST</strong>.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Step 3: Text your Number!</span>
                <p className="text-slate-600 text-[11px]">
                  Any crew member who texts the number will get their observation logged in Microsoft Forms and receive the official response ID receipt immediately.
                </p>
              </div>
            </div>
          </div>

          {/* Card: Name Formatting Rules */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-teal-600" />
              <span>WhatsApp Message Smart Formatting</span>
            </h3>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
              <li>
                <strong>To stay Anonymous (Empty Name):</strong> Just text your observation normally, or type <code className="bg-slate-100 px-1 py-0.2 rounded font-mono">Anonymous</code>. The name field is left completely blank!
              </li>
              <li>
                <strong>To include a Name:</strong> Add <code className="bg-slate-100 px-1 py-0.2 rounded font-mono">by: [Your Name]</code> at the end (e.g. <em>"Checked shakers PPE by: Ahmed Al-Ghamdi"</em>).
              </li>
              <li>
                <strong>Target Rig:</strong> Automatically locked to <strong>50 Bob Palmer (RBP-50A)</strong> on every message.
              </li>
              <li>
                <strong>Zones auto-detected:</strong> Rig Floor, Cantilever / Pipe Deck, Main Deck, BOP, Cranes, Derrick, Shakers, Accommodations.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
