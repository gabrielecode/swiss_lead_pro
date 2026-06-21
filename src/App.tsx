import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  MapPin, 
  Briefcase, 
  Home, 
  Globe, 
  Sparkles, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  Layers, 
  Building2, 
  Users, 
  Languages, 
  DollarSign, 
  Compass, 
  Info, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  X,
  Mail,
  Phone,
  Download,
  Copy,
  Check,
  FileText,
  Filter,
  Target,
  Award,
  Power
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";

import { CANTONES_DATA } from "./data";
import { Canton } from "./types";
import { translations, Language, t } from "./translations";

export default function App() {
  // Locked to Lead Generator Pro for premium lightweight experience
  const activeTab = "lead-generator";
  
  // Multi-language & Authentication
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('slpLanguage') as Language;
    return saved || 'IT';
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('slpUserEmail') || '';
  });
  const [emailInput, setEmailInput] = useState('');
  const [welcomeLanguage, setWelcomeLanguage] = useState<Language>(language);
  
  // Welcome screen toggle
  const [showWelcome, setShowWelcome] = useState(!userEmail);
  
  // Selected Canton filter (null means all of Switzerland)
  const [selectedCantonCode, setSelectedCantonCode] = useState<string | null>(null);

  // Canton dropdown menu open state
  const [isCantonDropdownOpen, setIsCantonDropdownOpen] = useState(false);

  // Search logic
  const [searchQuery, setSearchQuery] = useState("");

  // Lead Generator Premium States
  const [leadKeyword, setLeadKeyword] = useState("");
  const [leadLocation, setLeadLocation] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [leadsProgress, setLeadsProgress] = useState<string>("");
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [leadsSources, setLeadsSources] = useState<{ title: string; uri: string }[]>([]);
  const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null);
  
  // Scanning Radius for Swiss Business Crawler
  const [searchRadius, setSearchRadius] = useState<number>(15);
  
  // Scoring filters & layout settings
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [onlyWithWebsite, setOnlyWithWebsite] = useState(false);
  const [leadSearchText, setLeadSearchText] = useState("");

  // AI Proposal Automation
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState<any>(null);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [generatedProposal, setGeneratedProposal] = useState<string | null>(null);
  const [proposalTone, setProposalTone] = useState<"formale" | "creativo" | "diretto">("formale");
  const [proposalService, setProposalService] = useState("Funnel & Lead Generation Google Ads");

  // AI Assistant States
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiResponseSources, setAiResponseSources] = useState<{ title: string; uri: string }[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // Chat history for nice contextual helper
  const [chatHistory, setChatHistory] = useState<{ sender: "user" | "ai"; text: string; sources?: { title: string; uri: string }[] }[]>([
    { 
      sender: "ai", 
      text: "👋 Ciao! Sono il tuo assistente intelligente svizzero avanzato. Posso rispondere a qualsiasi domanda su tasse, permessi di lavoro, traslochi, turismo o comuni in qualunque dei 26 cantoni svizzeri. La mia ricerca è potenziata con Google Search in tempo reale per darti dati aggiornati a oggi!" 
    }
  ]);

  // Local clock (Switzerland Europe/Zurich Time approximation)
  const [swissTime, setSwissTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      // Europe/Zurich timezone formatting
      const formatter = new Intl.DateTimeFormat("it-CH", {
        timeZone: "Europe/Zurich",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      setSwissTime(formatter.format(new Date()));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle login
  const handleLogin = (email: string, lang: Language) => {
    if (!email.trim()) return;
    localStorage.setItem('slpUserEmail', email);
    localStorage.setItem('slpLanguage', lang);
    setUserEmail(email);
    setLanguage(lang);
    setShowWelcome(false);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('slpUserEmail');
    setUserEmail('');
    setShowWelcome(true);
    setEmailInput('');
  };

  // Filtered lists based on Canton and Search Query
  const selectedCanton = useMemo(() => {
    if (!selectedCantonCode) return null;
    return CANTONES_DATA.find(c => c.code === selectedCantonCode) || null;
  }, [selectedCantonCode]);

  // Lead Generation Premium handers & computed list
  const handleGenerateLeads = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadKeyword.trim()) return;

    setIsLoadingLeads(true);
    setLeadsError(null);
    setLeadsSources([]);
    
    // Nice status sequence
    setLeadsProgress("Inizializzazione mappatura Google Maps per aziende nel settore " + leadKeyword + "...");
    
    const progressSteps = [
      "Interrogando i database di Google Maps Places per " + leadKeyword + " a " + (leadLocation || "tutta la Svizzera") + "...",
      "Scandagliando i risultati territoriali di Google Maps ed estraendo recapiti di contatto...",
      "Analizzando i siti web ufficiali rilevati da Maps per ricavare indirizzi e-mail e canali social...",
      "Avviando intelligenza artificiale Gemini con Google Search Grounding per verificare l'esistenza...",
      "Generazione b2b premium completata con successo! Strutturazione in corso..."
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < progressSteps.length - 1) {
        setLeadsProgress(progressSteps[currentStep]);
        currentStep++;
      }
    }, 2500);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      const response = await fetch("/api/generate-leads", {
        method: "POST",
        headers,
        body: JSON.stringify({
          keyword: leadKeyword,
          location: leadLocation,
          canton: selectedCantonCode || "",
          radius: searchRadius
        }),
      });

      clearInterval(interval);

      if (!response.ok) {
        let serverErr = "Impossibile connettersi al cantiere dei server per estrarre i lead.";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            serverErr = errData.error;
          }
        } catch (e) {
          // ignore
        }
        throw new Error(serverErr);
      }

      const data = await response.json();
      if (data.success) {
        // Add random uuid / ID to results
        const mappedLeads = data.leads.map((l: any, idx: number) => ({
          ...l,
          id: String(Date.now()) + "-" + idx
        }));
        setLeads(mappedLeads);
        setLeadsSources(data.sources || []);
      } else {
        setLeadsError(data.error || "Errore sconosciuto durante l'acquisizione.");
      }
    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      setLeadsError(err.message || "Errore di rete durante il reperimento dei dati marketing.");
    } finally {
      setIsLoadingLeads(false);
      setLeadsProgress("");
    }
  };

  const handleGenerateProposal = async () => {
    if (!selectedLeadForEmail) return;
    setIsGeneratingProposal(true);
    setGeneratedProposal(null);

    const promptText = `Genera un'email commerciale a freddo personalizzata (cold outreach) di livello premium per l'azienda "${selectedLeadForEmail.company}" operante nel settore "${selectedLeadForEmail.sector}".
Indirizzo di contatto: "${selectedLeadForEmail.address}".
Sito web: "${selectedLeadForEmail.website}".
Telefono: "${selectedLeadForEmail.phone}".
Risultato dell'audit web: "${selectedLeadForEmail.auditResult}".
La nostra strategia consigliata per loro: "${selectedLeadForEmail.customStrategy}".

Il tono dell'email deve essere ${proposalTone} ed elegante, proponendo i nostri servizi di "${proposalService}".
Evidenzia in modo impeccabile e costruttivo i punti vulnerabili emersi dall'audit (ad esempio il marketingScore di ${selectedLeadForEmail.marketingScore}/100, la debolezza del sito, la mancanza di pubblicità mirata o canali social) e offri una consulenza conoscitiva gratuita di 15 minuti.
Aggiungi anche 3 varianti spettacolari per l'oggetto dell'email che massimizzino il tasso di click.
Scrivi l'email interamente in lingua italiana, utilizzando un tono professionale, pulito e adatto alla clientela svizzera.`;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: promptText,
          cantonCode: selectedCantonCode,
          language: "italiana"
        }),
      });

      if (!response.ok) {
        let serverErr = "Errore durante la generazione della proposta commerciale.";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            serverErr = errData.error;
          }
        } catch (e) {
          // ignore
        }
        throw new Error(serverErr);
      }

      const data = await response.json();
      setGeneratedProposal(data.answer);
    } catch (err: any) {
      console.error(err);
      setGeneratedProposal("Errore nella generazione della proposta AI: " + err.message);
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Canton filter matching if active
      let matchesCanton = true;
      if (selectedCantonCode) {
        const addrUpper = lead.address.toUpperCase();
        const codeUpper = selectedCantonCode.toUpperCase();
        matchesCanton = 
          addrUpper.includes(`(${codeUpper})`) ||
          addrUpper.includes(` ${codeUpper} `) ||
          addrUpper.includes(codeUpper) ||
          (selectedCanton && addrUpper.includes(selectedCanton.name.toUpperCase()));
      }
      
      const matchesSearch = 
        lead.company.toLowerCase().includes(leadSearchText.toLowerCase()) ||
        lead.sector.toLowerCase().includes(leadSearchText.toLowerCase()) ||
        lead.address.toLowerCase().includes(leadSearchText.toLowerCase()) ||
        (lead.auditResult && lead.auditResult.toLowerCase().includes(leadSearchText.toLowerCase())) ||
        (lead.customStrategy && lead.customStrategy.toLowerCase().includes(leadSearchText.toLowerCase()));

      const matchesScore = lead.marketingScore >= minScoreFilter;
      const matchesEmail = !onlyWithEmail || (lead.email && lead.email !== "Non disponibile" && lead.email !== "Contatto via Form");
      const matchesWebsite = !onlyWithWebsite || (lead.website && lead.website !== "Non disponibile");

      return matchesCanton && matchesSearch && matchesScore && matchesEmail && matchesWebsite;
    });
  }, [leads, selectedCantonCode, selectedCanton, leadSearchText, minScoreFilter, onlyWithEmail, onlyWithWebsite]);

  const downloadLeadsCSV = () => {
    if (filteredLeads.length === 0) return;
    const headers = ["Azienda", "Settore", "Indirizzo", "Telefono", "Email", "Sito Web", "Social", "Marketing Score", "Audit Presenza Web", "Strategia Consigliata"];
    const rows = filteredLeads.map(lead => [
      `"${lead.company.replace(/"/g, '""')}"`,
      `"${lead.sector.replace(/"/g, '""')}"`,
      `"${lead.address.replace(/"/g, '""')}"`,
      `"${lead.phone.replace(/"/g, '""')}"`,
      `"${lead.email.replace(/"/g, '""')}"`,
      `"${lead.website.replace(/"/g, '""')}"`,
      `"${lead.social.replace(/"/g, '""')}"`,
      lead.marketingScore,
      `"${lead.auditResult.replace(/"/g, '""')}"`,
      `"${lead.customStrategy.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `svizzera_leads_${leadKeyword || "tutti"}_${leadLocation || "intera"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadLeadsJSON = () => {
    if (filteredLeads.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredLeads, null, 2)
    )}`;
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", `svizzera_leads_${leadKeyword || "tutti"}_${leadLocation || "intera"}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased selection:bg-red-50 selection:text-red-900">
      
      {/* Welcome Screen */}
      {showWelcome && (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-red-900 z-50 overflow-y-auto">
          <div className="min-h-screen flex items-center justify-center p-4 py-12">
            <div className="max-w-4xl w-full mx-auto">
              {/* Language Selector */}
              <div className="flex justify-center gap-2 mb-8">
                {(['IT', 'DE', 'FR', 'ENG'] as Language[]).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setWelcomeLanguage(lang)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                      welcomeLanguage === lang
                        ? 'bg-red-600 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              {/* Logo */}
              <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-2">
                  {t('welcome.title', welcomeLanguage)} <span className="text-red-500">{t('welcome.title.highlight', welcomeLanguage)}</span> {t('welcome.title.last', welcomeLanguage)}
                </h1>
                <p className="text-red-300 font-semibold">{t('welcome.subtitle', welcomeLanguage)}</p>
              </div>
              
              {/* WHAT IS SWISS LEAD PRO */}
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8 mb-8">
                <h2 className="text-2xl font-bold text-white mb-4 text-center">{t('welcome.what.title', welcomeLanguage)}</h2>
                <p className="text-white/90 text-lg mb-6 text-center">
                  {t('welcome.what.description', welcomeLanguage)}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-white/80 text-sm">{t('welcome.what.point1', welcomeLanguage)}</div>
                  <div className="text-white/80 text-sm">{t('welcome.what.point2', welcomeLanguage)}</div>
                  <div className="text-white/80 text-sm">{t('welcome.what.point3', welcomeLanguage)}</div>
                </div>
              </div>

              {/* BENEFITS SECTION */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6 text-center">{t('welcome.benefits.title', welcomeLanguage)}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-400/20 backdrop-blur p-6 rounded-lg">
                    <h3 className="font-semibold text-white mb-2 text-lg">{t('welcome.benefit1.title', welcomeLanguage)}</h3>
                    <p className="text-white/70 text-sm">{t('welcome.benefit1.desc', welcomeLanguage)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-400/20 backdrop-blur p-6 rounded-lg">
                    <h3 className="font-semibold text-white mb-2 text-lg">{t('welcome.benefit2.title', welcomeLanguage)}</h3>
                    <p className="text-white/70 text-sm">{t('welcome.benefit2.desc', welcomeLanguage)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-400/20 backdrop-blur p-6 rounded-lg">
                    <h3 className="font-semibold text-white mb-2 text-lg">{t('welcome.benefit3.title', welcomeLanguage)}</h3>
                    <p className="text-white/70 text-sm">{t('welcome.benefit3.desc', welcomeLanguage)}</p>
                  </div>
                </div>
              </div>

              {/* HOW IT WORKS */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-8 text-center">{t('welcome.how.title', welcomeLanguage)}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="relative">
                    <div className="bg-white/10 border border-white/20 backdrop-blur rounded-lg p-6 text-center">
                      <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4 mx-auto">
                        {t('welcome.how.step1.number', welcomeLanguage)}
                      </div>
                      <h3 className="text-white font-semibold mb-2">{t('welcome.how.step1.title', welcomeLanguage)}</h3>
                      <p className="text-white/70 text-sm">{t('welcome.how.step1.desc', welcomeLanguage)}</p>
                    </div>
                    <div className="hidden md:block absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-red-600 rounded-full border-4 border-slate-800"></div>
                  </div>
                  <div className="relative">
                    <div className="bg-white/10 border border-white/20 backdrop-blur rounded-lg p-6 text-center">
                      <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4 mx-auto">
                        {t('welcome.how.step2.number', welcomeLanguage)}
                      </div>
                      <h3 className="text-white font-semibold mb-2">{t('welcome.how.step2.title', welcomeLanguage)}</h3>
                      <p className="text-white/70 text-sm">{t('welcome.how.step2.desc', welcomeLanguage)}</p>
                    </div>
                    <div className="hidden md:block absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-red-600 rounded-full border-4 border-slate-800"></div>
                  </div>
                  <div className="relative">
                    <div className="bg-white/10 border border-white/20 backdrop-blur rounded-lg p-6 text-center">
                      <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4 mx-auto">
                        {t('welcome.how.step3.number', welcomeLanguage)}
                      </div>
                      <h3 className="text-white font-semibold mb-2">{t('welcome.how.step3.title', welcomeLanguage)}</h3>
                      <p className="text-white/70 text-sm">{t('welcome.how.step3.desc', welcomeLanguage)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* LOGIN Form */}
              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-8 max-w-md mx-auto mb-8">
                <h2 className="text-white text-lg font-semibold mb-2 text-center">{t('welcome.cta.title', welcomeLanguage)}</h2>
                <p className="text-white/60 text-xs text-center mb-6">{t('welcome.cta.subtext', welcomeLanguage)}</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLogin(emailInput, welcomeLanguage);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <input
                      type="email"
                      placeholder={t('welcome.login.email', welcomeLanguage)}
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-red-500 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-all duration-300 transform hover:scale-105"
                  >
                    {t('welcome.login.button', welcomeLanguage)}
                  </button>
                </form>
              </div>
              
              <p className="text-slate-400 text-sm text-center mb-4">
                {t('welcome.version', welcomeLanguage)}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Main App - Hidden when Welcome is shown */}
      {!showWelcome && (
      <>
      <div className="bg-[#da291c] h-1.5 w-full flex">
        <div className="bg-white h-full w-1/3"></div>
        <div className="bg-[#da291c] h-full w-1/3 flex items-center justify-center">
          <span className="text-[10px] text-white font-bold tracking-widest leading-none">+</span>
        </div>
        <div className="bg-white h-full w-1/3"></div>
      </div>

      {/* Primary Header styled with Clean Minimalism */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo area */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white font-bold text-lg select-none relative shadow-xs">
                <div className="w-4 h-0.5 bg-white"></div>
                <div className="w-0.5 h-4 bg-white absolute"></div>
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight font-display flex items-center gap-1.5 leading-none">
                  SWISS<span className="text-red-600">LEAD</span>
                  <span className="bg-red-50 text-red-600 text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ml-1 border border-red-100">
                    PRO B2B
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400 font-sans tracking-wide mt-0.5">
                  Estrazione e Qualificazione B2B Intelligente nei 26 Cantoni Svizzeri
                </p>
              </div>
            </div>

            {/* Swiss Standard Time Badge & System Status */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono">{t('app.language', language)}:</span>
              </div>
              <select
                value={language}
                onChange={(e) => {
                  const newLang = e.target.value as Language;
                  setLanguage(newLang);
                  localStorage.setItem('slpLanguage', newLang);
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
              >
                <option value="IT">🇮🇹 Italiano</option>
                <option value="DE">🇩🇪 Deutsch</option>
                <option value="FR">🇫🇷 Français</option>
                <option value="ENG">🇬🇧 English</option>
              </select>
              <div className="h-4 w-px bg-slate-200"></div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-semibold transition-colors"
              >
                <Power className="w-3.5 h-3.5" />
                {t('app.logout', language)}
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 sm:px-8 lg:px-10 py-8 flex flex-col gap-8">
        






        {/* Tab Content Display */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            
            {/* TABS 0: LEAD GENERATOR PREMIUM */}
            {activeTab === "lead-generator" && (
              <motion.div
                key="lead-generator-premium-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex flex-col gap-8"
              >
                {/* Hero section */}
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 text-white relative overflow-hidden shadow-xl">
                  {/* Decorative faint background element */}
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[100px] pointer-events-none" />
                  
                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="max-w-[650px]">
                      <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase mb-3 border border-red-500/20">
                        <Target className="w-3.5 h-3.5" />
                        Lead Generation Svizzera
                      </div>
                      <h2 className="text-3xl sm:text-4xl font-light tracking-tight leading-tight">
                        Estrai contatti di marketing <span className="font-semibold text-red-500">ad alto valore</span>
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                        Sistema intelligente di scraping ed estrazione per aziende elvetiche. Sfrutta la ricerca avanzata e certificata di <strong>Google Maps</strong> e il web per individuare recapiti reali, e-mail, siti web e formulare strategie commerciali personalizzate con AI.
                      </p>
                    </div>

                    <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl shrink-0 text-center flex flex-col items-center justify-center min-w-[200px]">
                      <span className="text-3xl font-mono text-red-500 font-extrabold tracking-tight">Active</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Status Crawler</span>
                      <div className="flex items-center gap-1.5 mt-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs text-slate-300 font-mono">B2B Core Online</span>
                      </div>
                    </div>
                  </div>

                  {/* Upgraded SBC Crawler form section with full geographical + custom API Key parameters */}
                  <form onSubmit={handleGenerateLeads} className="relative z-10 mt-8 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/60 flex flex-col gap-5">
                    
                    {/* Primary parameters row */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Keyword */}
                      <div className="md:col-span-3 flex items-center bg-slate-950/70 rounded-xl px-3 py-1.5 border border-slate-800">
                        <Briefcase className="w-4 h-4 text-emerald-550 shrink-0 mr-2.5 align-middle" />
                        <div className="flex-1 min-w-0">
                          <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-0.5">{t('app.search.keyword', language)}</label>
                          <input
                            type="text"
                            value={leadKeyword}
                            onChange={(e) => setLeadKeyword(e.target.value)}
                            placeholder={t('app.search.keyword', language)}
                            className="bg-transparent text-white text-xs outline-hidden w-full placeholder-slate-600 font-medium"
                            required
                          />
                        </div>
                      </div>

                      {/* City/Location */}
                      <div className="md:col-span-3 flex items-center bg-slate-950/70 rounded-xl px-3 py-1.5 border border-slate-800">
                        <MapPin className="w-4 h-4 text-red-500 shrink-0 mr-2.5 align-middle" />
                        <div className="flex-1 min-w-0">
                          <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-0.5">{t('app.search.location', language)}</label>
                          <input
                            type="text"
                            value={leadLocation}
                            onChange={(e) => setLeadLocation(e.target.value)}
                            placeholder={t('app.search.location', language)}
                            className="bg-transparent text-white text-xs outline-hidden w-full placeholder-slate-600 font-medium"
                          />
                        </div>
                      </div>

                      {/* Canton dropdown */}
                      <div className="md:col-span-3 flex items-center bg-slate-950/70 rounded-xl px-3 py-1.5 border border-slate-800">
                        <Layers className="w-4 h-4 text-sky-500 shrink-0 mr-2.5 align-middle" />
                        <div className="flex-1 min-w-0">
                          <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-0.5 font-sans">Selettore Cantone</label>
                          <select
                            value={selectedCantonCode || ""}
                            onChange={(e) => setSelectedCantonCode(e.target.value || null)}
                            className="bg-transparent text-white text-xs font-mono font-bold outline-hidden w-full cursor-pointer border-none p-0 focus:ring-0 focus:outline-hidden"
                          >
                            <option value="" className="bg-slate-950 text-white font-sans">SVIZZERA INTERA (Tutte)</option>
                            {CANTONES_DATA.map((c) => (
                              <option key={c.code} value={c.code} className="bg-slate-900 text-white font-sans">
                                {c.code} - {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Scope Radius Slider */}
                      <div className="md:col-span-3 flex flex-col justify-center bg-slate-950/70 rounded-xl px-4 py-1.5 border border-slate-800">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block">{t('app.search.radius', language)}</span>
                          <span className="text-[11px] font-mono font-extrabold text-red-500">
                            {searchRadius === 0 ? "Area esatta" : `+${searchRadius} km`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          step="5"
                          value={searchRadius}
                          onChange={(e) => setSearchRadius(Number(e.target.value))}
                          className="w-full accent-red-600 cursor-pointer h-1 bg-slate-800 rounded-lg appearance-none"
                        />
                      </div>
                    </div>

                    {/* Submit Bar with integrated API Key input */}
                    <div className="flex justify-end pt-3 border-t border-slate-800/50">
                        <button
                          type="submit"
                          disabled={isLoadingLeads}
                          className="bg-red-600 hover:bg-red-500 active:scale-95 text-white font-semibold text-xs py-3 px-6 rounded-xl transition-all select-none disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isLoadingLeads ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>{t('app.search.loading', language)}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-red-200 animate-pulse" />
                              <span>{t('app.search.button', language)}</span>
                            </>
                          )}
                        </button>
                    </div>
                  </form>

                  {/* Channel ticks */}
                  <div className="relative z-10 flex flex-wrap gap-4 mt-4 text-xs text-slate-400 px-1">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Canali interrogati:</span>
                    <label className="flex items-center gap-1.5 select-none text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Google Maps Places API
                    </label>
                    <label className="flex items-center gap-1.5 select-none text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Google Search Grounding
                    </label>
                    <label className="flex items-center gap-1.5 select-none text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Web-crawling estrazione e-mail
                    </label>
                  </div>
                </div>

                {/* B2B Crawler Terminal Block when active */}
                {isLoadingLeads && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-slate-950 rounded-2xl border border-slate-800 p-5 font-mono text-xs text-emerald-400 shadow-md overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2.5 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                        <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Scraper Console Term</span>
                      </div>
                      <span className="text-[10px] text-slate-500">SWISS-LEAD-BOT v1.4</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-slate-500">&gt; npm run scrape --service=google-maps --with-search-grounding</div>
                      <div className="text-slate-500">&gt; SEARCH_QUERY: "{leadKeyword}" IN_LOCATION: "{leadLocation || "Tutta la Svizzera"}"</div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 animate-pulse">●</span>
                        <span className="text-slate-200">{leadsProgress}</span>
                      </div>
                      <div className="text-slate-600 italic animate-pulse text-[10px] mt-2">Attendere circa 10-15 secondi per l'interrogazione profonda e l'estrazione contatti...</div>
                    </div>
                  </motion.div>
                )}

                {/* Grounding sources for leads */}
                {!isLoadingLeads && leadsSources.length > 0 && (
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-slate-500 font-mono">Fonti reali verificate da Google Search:</span>
                    <div className="flex flex-wrap gap-2">
                      {leadsSources.map((src, i) => (
                        <a
                          key={i}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white hover:bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-700 hover:text-slate-950 font-medium flex items-center gap-1 text-[11px] transition-all"
                        >
                          <Globe className="w-3 h-3 text-red-500" />
                          <span className="max-w-[125px] truncate">{src.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dashboard Stats Panel */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Leads</span>
                      <Users className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{filteredLeads.length}</div>
                    <p className="text-[10px] text-slate-400 mt-1">Aziende in catalogo marketing</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Market Score</span>
                      <Award className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {filteredLeads.length > 0
                        ? Math.round(filteredLeads.reduce((acc, curr) => acc + curr.marketingScore, 0) / filteredLeads.length)
                        : 0} / 100
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div 
                        className="bg-red-600 h-full rounded-full transition-all" 
                        style={{ 
                          width: `${filteredLeads.length > 0 
                            ? Math.round(filteredLeads.reduce((acc, curr) => acc + curr.marketingScore, 0) / filteredLeads.length)
                            : 0}%` 
                        }} 
                      />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sito Web Integrato</span>
                      <Globe className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {filteredLeads.length > 0
                        ? Math.round((filteredLeads.filter(l => l.website && l.website !== "Non disponibile").length / filteredLeads.length) * 100)
                        : 0}%
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Hanno una presenza web attiva</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Rilevate</span>
                      <Mail className="w-4 h-4 text-sky-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {filteredLeads.length > 0
                        ? Math.round((filteredLeads.filter(l => l.email && l.email !== "Non disponibile" && l.email !== "Contatto via Form").length / filteredLeads.length) * 100)
                        : 0}%
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Disponibili per e-marketing</p>
                  </div>
                </div>

                {/* Advanced Filtering and Export bar */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                    <div className="flex-1 flex flex-wrap items-center gap-3">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={leadSearchText}
                          onChange={(e) => setLeadSearchText(e.target.value)}
                          placeholder={t('app.filter.search', language)}
                          className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 outline-hidden w-full focus:ring-1 focus:ring-slate-300 focus:bg-white transition-all"
                        />
                      </div>

                      {/* Score slider */}
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
                        <span className="text-slate-500 text-[11px]">{t('app.filter.score', language)}: <strong>{minScoreFilter}</strong></span>
                        <input
                          type="range"
                          min="0"
                          max="95"
                          step="5"
                          value={minScoreFilter}
                          onChange={(e) => setMinScoreFilter(Number(e.target.value))}
                          className="w-24 accent-red-650"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={downloadLeadsCSV}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title={t('app.export.csv', language)}
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        {t('app.export.csv', language)}
                      </button>
                      <button
                        onClick={downloadLeadsJSON}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title={t('app.export.json', language)}
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        {t('app.export.json', language)}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Filtri Rapidi:</span>
                    <label className="flex items-center gap-2 select-none text-slate-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyWithEmail}
                        onChange={(e) => setOnlyWithEmail(e.target.checked)}
                        className="rounded border-slate-300 accent-red-650 w-3.5 h-3.5"
                      />
                      {t('app.filter.withEmail', language)}
                    </label>
                    <label className="flex items-center gap-2 select-none text-slate-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyWithWebsite}
                        onChange={(e) => setOnlyWithWebsite(e.target.checked)}
                        className="rounded border-slate-300 accent-red-650 w-3.5 h-3.5"
                      />
                      {t('app.filter.withWebsite', language)}
                    </label>
                  </div>
                </div>

                {/* Error Banner if any */}
                {leadsError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl flex items-start gap-2.5">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Attenzione durante la lead generation: </span>
                      {leadsError}
                      <p className="mt-1 text-red-600">Questo può capitare se non è attiva una chiave API valida o le connessioni internet svizzere rifiutano il crawling simultaneo. Prova altri termini di ricerca.</p>
                    </div>
                  </div>
                )}

                {/* TWO COLUMN GRID WORKSPACE */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Table B2B spreadsheet */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="border-b border-slate-150 p-4.5 bg-slate-50/50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                        <h3 className="font-bold text-slate-800 text-sm font-display uppercase tracking-wide">Tabella Leads Schweiz ({filteredLeads.length})</h3>
                      </div>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">Fai clic su un'azienda per preparare l'email</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                            <th className="p-4">{t('app.table.company', language)} / {t('app.table.sector', language)}</th>
                            <th className="p-4">Geoloc. / {t('app.table.address', language)}</th>
                            <th className="p-4">{t('app.table.email', language)}</th>
                            <th className="p-4 text-center">{t('app.table.score', language)}</th>
                            <th className="p-4 text-right">{t('app.table.actions', language)}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {filteredLeads.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                {t('app.table.empty', language)}
                              </td>
                            </tr>
                          ) : (
                            filteredLeads.map((lead) => {
                              const isSelected = selectedLeadForEmail?.id === lead.id || selectedLeadForEmail?.company === lead.company;
                              return (
                                <tr
                                  key={lead.id}
                                  onClick={() => {
                                    setSelectedLeadForEmail(lead);
                                    setGeneratedProposal(null);
                                  }}
                                  className={`hover:bg-slate-50/80 transition-all cursor-pointer ${
                                    isSelected ? "bg-red-50/30 font-medium border-l-4 border-l-red-600" : ""
                                  }`}
                                >
                                  <td className="p-4">
                                    <div className="font-semibold text-slate-800 text-sm leading-tight">{lead.company}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                      <Briefcase className="w-3 h-3 text-slate-300 animate-pulse" />
                                      {lead.sector}
                                    </div>
                                  </td>
                                  <td className="p-4 text-slate-600 font-mono leading-tight">
                                    <div className="flex items-start gap-1">
                                      <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                                      <span className="break-all">{lead.address}</span>
                                    </div>
                                  </td>
                                  <td className="p-4 space-y-1 text-slate-650 font-mono">
                                    {lead.phone && lead.phone !== "Non disponibile" && (
                                      <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                                        <Phone className="w-3 h-3 text-slate-400" />
                                        <span>{lead.phone}</span>
                                      </div>
                                    )}
                                    {lead.email && lead.email !== "Non disponibile" && (
                                      <div className="flex items-center gap-1.5 text-[11px] text-red-650 font-semibold break-all">
                                        <Mail className="w-3 h-3 text-red-500 shrink-0" />
                                        <span>{lead.email}</span>
                                      </div>
                                    )}
                                    {lead.website && lead.website !== "Non disponibile" && (
                                      <div className="text-[10px] flex items-center gap-1 text-slate-400 font-sans break-all">
                                        <Globe className="w-3 h-3 text-slate-400" />
                                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-red-600 max-w-[140px] truncate">{lead.website}</a>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-4 text-center">
                                    <span className={`inline-flex px-2 py-1 rounded text-[11px] font-bold font-mono tracking-tight ${
                                      lead.marketingScore >= 80 ? "bg-red-100 text-red-700" :
                                      lead.marketingScore >= 60 ? "bg-amber-100 text-amber-700" :
                                      "bg-slate-100 text-slate-600"
                                    }`}>
                                      {lead.marketingScore}%
                                    </span>
                                  </td>
                                  <td className="p-4 text-right">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedLeadForEmail(lead);
                                        setGeneratedProposal(null);
                                      }}
                                      className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg border border-slate-800 transition-all cursor-pointer whitespace-nowrap"
                                    >
                                      Usa Outreach
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Sidebar - Outreach Generator Drawer */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs relative">
                    <div className="flex items-center justify-between border-b border-slate-150 pb-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-red-500" />
                        <h4 className="font-bold text-slate-800 font-display text-sm uppercase">AI Outreach Svizzera</h4>
                      </div>
                      {selectedLeadForEmail && (
                        <button
                          onClick={() => {
                            setSelectedLeadForEmail(null);
                            setGeneratedProposal(null);
                          }}
                          className="text-slate-400 hover:text-slate-600"
                          title="Chiudi outreach AI"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {!selectedLeadForEmail ? (
                      <div className="text-center py-10 px-4 text-slate-400 italic">
                        <Target className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-xs leading-relaxed">
                          Nessun lead selezionato. Fai click su una riga della tabella a sinistra per caricarla in sessione e generare un'e-mail a freddo personalizzata.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-sans tracking-wide">Azienda Caricata:</span>
                          <h4 className="font-bold text-slate-800 text-lg leading-tight mt-0.5">{selectedLeadForEmail.company}</h4>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-mono inline-block mt-1">
                            {selectedLeadForEmail.sector}
                          </span>
                        </div>

                        {/* Audit summary panel */}
                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 text-xs">
                          <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1">
                            <Info className="w-3.5 h-3.5 text-red-500" />
                            Diagnostic Presenza Digitale:
                          </h5>
                          <p className="text-slate-600 leading-relaxed font-sans">{selectedLeadForEmail.auditResult}</p>
                          
                          <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mt-3.5 mb-1.5 flex items-center gap-1">
                            <Target className="w-3.5 h-3.5 text-teal-600" />
                            Angolo di Attacco Vendita:
                          </h5>
                          <p className="text-slate-600 leading-relaxed font-sans italic">"{selectedLeadForEmail.customStrategy}"</p>
                        </div>

                        {/* Dropdowns for personalization */}
                        <div className="space-y-3 pt-2">
                          <div>
                            <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-1">
                              Servizio da Proporre:
                            </label>
                            <select
                              value={proposalService}
                              onChange={(e) => setProposalService(e.target.value)}
                              className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 px-3 py-2 w-full outline-hidden focus:border-slate-300"
                            >
                              <option value="Sviluppo Sito Web Moderno Alta Conversione & SEO Locale svizzero">Sito Web & SEO Svizzera</option>
                              <option value="Funnel di Acquisizione Clienti e Campagne Google Ads">Google Ads Lead Gen</option>
                              <option value="Social Media Management & Instagram Local Ads">Meta Ads & Instagram</option>
                              <option value="Ottimizzazione Scheda Google My Business & Recensioni">Audit Google Maps & Recensioni</option>
                              <option value="Consulenza di Crescita B2B & CRM Automation">Consulenza Strategica B2B</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-1">
                              Tono Comunicazione:
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                              {(["formale", "creativo", "diretto"] as const).map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setProposalTone(t)}
                                  className={`px-2 py-1.5 rounded-lg text-[11px] capitalize cursor-pointer transition-all border ${
                                    proposalTone === t
                                      ? "bg-slate-900 text-white border-slate-950 font-bold"
                                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-2">
                          {selectedLeadForEmail.email && selectedLeadForEmail.email !== "Non disponibile" && selectedLeadForEmail.email !== "Contatto via Form" && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(selectedLeadForEmail.email);
                                setCopiedLeadId(selectedLeadForEmail.email);
                                setTimeout(() => setCopiedLeadId(null), 2500);
                              }}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
                              title="Copia Email negli appunti"
                            >
                              {copiedLeadId === selectedLeadForEmail.email ? (
                                <Check className="w-4 h-4 text-emerald-650" />
                              ) : (
                                <Copy className="w-4 h-4 text-slate-500" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={handleGenerateProposal}
                            disabled={isGeneratingProposal}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                          >
                            {isGeneratingProposal ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Generazione...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 text-red-200 animate-bounce" />
                                <span>Genera Mail con AI</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Result area */}
                        {generatedProposal && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-950 text-slate-200 border border-slate-800 rounded-xl p-4 text-xs font-mono max-h-[340px] overflow-y-auto mt-2 relative"
                          >
                            <div className="flex justify-between items-center pb-2 border-b border-slate-900 mb-2.5">
                              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Email Pronta (Markdown)</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(generatedProposal);
                                  setCopiedLeadId("outreach-copied");
                                  setTimeout(() => setCopiedLeadId(null), 2500);
                                }}
                                className="text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 border border-slate-850 px-2 py-1 rounded text-[10px]"
                              >
                                {copiedLeadId === "outreach-copied" ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Copiato!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copia Mail</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="whitespace-pre-wrap leading-relaxed select-all text-slate-300 font-sans">
                              {generatedProposal}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}









          </AnimatePresence>
        </div>

        {/* Informative Swiss Guideline Grid */}
        <section className="mt-8 border-t border-slate-200 pt-8">
          <h3 className="text-lg font-bold font-display text-slate-800 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-slate-400" />
            Guida Veloce all'Amministrazione Svizzera
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-650 inline-block bg-[#da291c]" />
                Il Sistema dei Comuni (NPA)
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                In Svizzera, ogni comune gode di ampia autonomia amministrativa e fiscale. I codici di avviamento postale (NPA/PLZ/NPA) identificano precisamente il comune e il Canton di appartenenza, determinando il tasso fiscale applicabile.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-650 inline-block bg-blue-600" />
                Permessi L, B, C e G
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                L è per soggiorni temporanei brevi; B è il permesso di dimora ordinario per chi lavora; C è la dimora permanente (domicilio); G è riservato ai lavoratori frontalieri che rientrano settimanalmente nel proprio Paese d'origine.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-650 inline-block bg-yellow-600" />
                Moltiplicatore d'Imposta
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Le imposte comunali e cantonali sono regolate da un moltiplicatore percentuale applicato sulle imposte federali di base. Cantoni come Zugo (ZG) e Svitto (SZ) sono famosi per avere moltiplicatori estremamente bassi.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16 py-8 text-center text-xs text-slate-400 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row sm:justify-between items-center gap-4">
          <p>© 2026 SWISS LEAD PRO B2B • Swiss Lead Generator Pro Desktop Suite</p>
          <div className="flex space-x-4">
            <span className="hover:text-slate-600 cursor-help">CH - Confederazione Elvetica</span>
            <span>•</span>
            <span className="hover:text-slate-600 cursor-help">Lingue: IT, DE, FR, RM</span>
          </div>
        </div>
      </footer>
      </>
      )}
    </div>
  );
}
