import React, { useState, useEffect } from "react";
import { 
  Plus, 
  FileText, 
  Database as DbIcon, 
  Settings, 
  ChevronRight, 
  Search, 
  Trash2, 
  Save,
  Mail,
  Eye,
  Download, 
  Printer,
  LayoutDashboard,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Subject, Question, Difficulty, Paper, DifficultyProfile, DifficultyTemplate, AIPaper, AIPaperTemplate } from "./types";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from "react-markdown";

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active 
        ? "bg-zinc-900 text-white shadow-lg" 
        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
    }`}
  >
    <Icon size={20} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "success" | "warning" | "danger" }) => {
  const variants = {
    default: "bg-zinc-100 text-zinc-800 border-zinc-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    danger: "bg-rose-50 text-rose-700 border-rose-100"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${variants[variant]}`}>
      {children}
    </span>
  );
};

// --- Main App ---

const matchBooleanQuery = (text: string, query: string): boolean => {
  if (!query.trim()) return true;
  const textLower = text.toLowerCase();
  
  if (/\b(OR|AND|NOT)\b/i.test(query)) {
    const orParts = query.split(/\s+OR\s+/i);
    return orParts.some(orPart => {
      const andParts = orPart.split(/\s+AND\s+/i);
      return andParts.every(part => {
        let term = part.trim();
        let negate = false;
        if (term.toUpperCase().startsWith('NOT ')) {
          negate = true;
          term = term.substring(4).trim();
        }
        return negate ? !textLower.includes(term.toLowerCase()) : textLower.includes(term.toLowerCase());
      });
    });
  } else {
    // Default implicit AND for space-separated terms
    const terms = query.toLowerCase().split(/\s+/);
    return terms.every(term => textLower.includes(term));
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "questions" | "papers" | "ai-papers">("dashboard");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [aiPapers, setAiPapers] = useState<AIPaper[]>([]);
  const [aiPaperTemplates, setAiPaperTemplates] = useState<AIPaperTemplate[]>([]);
  const [templates, setTemplates] = useState<DifficultyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showGeneratePaper, setShowGeneratePaper] = useState(false);
  const [showGenerateAIPaper, setShowGenerateAIPaper] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [selectedAIPaper, setSelectedAIPaper] = useState<AIPaper | null>(null);
  const [isEditingAIPaper, setIsEditingAIPaper] = useState(false);
  const [editedAIPaperContent, setEditedAIPaperContent] = useState("");
  const [formattingAnalysis, setFormattingAnalysis] = useState<{analysis: string, correctedContent: string} | null>(null);
  const [profile, setProfile] = useState<DifficultyProfile>({ Easy: 20, Medium: 50, Hard: 30 });
  const [searchQuery, setSearchQuery] = useState("");
  const paperRef = React.useRef<HTMLDivElement>(null);
  const aiPaperRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [subs, quests, paps, temps, aiPaps, aiPapsTemps] = await Promise.all([
        fetch("/api/subjects").then(r => r.json()),
        fetch("/api/questions").then(r => r.json()),
        fetch("/api/papers").then(r => r.json()),
        fetch("/api/templates").then(r => r.json()),
        fetch("/api/ai-papers").then(r => r.json()),
        fetch("/api/ai-paper-templates").then(r => r.json())
      ]);
      setSubjects(subs);
      setQuestions(quests);
      setPapers(paps);
      setTemplates(temps);
      setAiPapers(aiPaps);
      setAiPaperTemplates(aiPapsTemps);
    } catch (err) {
      setError("Failed to load data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async (name: string) => {
    const res = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      const newSub = await res.json();
      setSubjects([...subjects, newSub]);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      subject_id: parseInt(formData.get("subject_id") as string),
      chapter: formData.get("chapter"),
      content: formData.get("content"),
      marks: parseInt(formData.get("marks") as string),
      difficulty: formData.get("difficulty")
    };

    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      const newQuest = await res.json();
      setQuestions([...questions, newQuest]);
      setShowAddQuestion(false);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setQuestions(questions.filter(q => q.id !== id));
    }
  };

  const handleGeneratePaper = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const total = profile.Easy + profile.Medium + profile.Hard;
    if (total !== 100) {
      alert("Total weightage must sum to 100 marks.");
      return;
    }

    const data = {
      subject_id: parseInt(formData.get("subject_id") as string),
      title: formData.get("title"),
      profile
    };

    setLoading(true);
    const res = await fetch("/api/generate-paper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      const newPaper = await res.json();
      setPapers([newPaper, ...papers]);
      setShowGeneratePaper(false);
      setActiveTab("papers");
    } else {
      const err = await res.json();
      alert(err.error || "Failed to generate paper.");
    }
    setLoading(false);
  };

  const viewPaperDetails = async (id: number) => {
    setLoading(true);
    const res = await fetch(`/api/papers/${id}`);
    if (res.ok) {
      const details = await res.json();
      setSelectedPaper(details);
    }
    setLoading(false);
  };

  const handleSaveTemplate = async () => {
    const name = prompt("Enter a name for this difficulty template:");
    if (!name) return;

    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...profile })
    });

    if (res.ok) {
      const newTemp = await res.json();
      setTemplates([...templates, newTemp]);
      alert("Template saved successfully!");
    } else {
      const err = await res.json();
      alert(err.error || "Failed to save template.");
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates(templates.filter(t => t.id !== id));
    }
  };

  const [aiPaperForm, setAiPaperForm] = useState({
    courseNameCode: "",
    dateDuration: "",
    testType: "Test 1",
    syllabusText: "",
    modelPaperText: ""
  });

  const handleSaveAIPaperTemplate = async () => {
    const name = prompt("Enter a name for this template:");
    if (!name) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ai-paper-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...aiPaperForm })
      });
      if (res.ok) {
        const newTemp = await res.json();
        setAiPaperTemplates([newTemp, ...aiPaperTemplates]);
        alert("Template saved successfully!");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save template.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save template.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAIPaperTemplate = (template: AIPaperTemplate) => {
    setAiPaperForm({
      courseNameCode: template.course_name_code || "",
      dateDuration: template.date_duration || "",
      testType: template.test_type || "Test 1",
      syllabusText: template.syllabus_text || "",
      modelPaperText: template.model_paper_text || ""
    });
  };

  const handleDeleteAIPaperTemplate = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await fetch(`/api/ai-paper-templates/${id}`, { method: "DELETE" });
      setAiPaperTemplates(aiPaperTemplates.filter(t => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const [questionPreview, setQuestionPreview] = useState<string | null>(null);

  const handlePreviewQuestion = async () => {
    const { courseNameCode, syllabusText, modelPaperText } = aiPaperForm;
    if (!courseNameCode || !syllabusText) {
      alert("Please fill in Course Name and Syllabus Text first.");
      return;
    }

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      const prompt = `
Role: You are an expert Paper Setter. Generate ONE sample question based on the following context.
Course: ${courseNameCode}
Syllabus: ${syllabusText}
Model Paper Style: ${modelPaperText}

Instructions:
- Generate ONE high-quality question.
- It should be relevant to the syllabus.
- Follow the style of the model paper.
- Return ONLY the question text.
`;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setQuestionPreview(response.text || "Failed to generate preview.");
    } catch (err) {
      console.error(err);
      alert("Failed to generate question preview.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAIPaper = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { courseNameCode, dateDuration, testType, syllabusText, modelPaperText } = aiPaperForm;

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      const prompt = `
Role: You are the "ExamGenius" Academic Assistant, an expert Paper Setter for the Department of Computer Science at National College (Autonomous), Trichy. Your goal is to generate high-quality, syllabus-aligned internal examination papers.

Input Context:
Course Name & Code: ${courseNameCode}
Date & Duration: ${dateDuration}
Test Type: ${testType}

Syllabus Text:
${syllabusText}

Model Paper Text:
${modelPaperText}

Core Instructions:
Syllabus Mapping: Only generate questions from the topics present in the provided syllabus text.
Formatting: Follow the standard academic English used in the Model Paper. Avoid local language terminology (e.g., use "Database" instead of local equivalents).
Institutional Header: Every paper must begin with:
NATIONAL COLLEGE (AUTONOMOUS), TIRUCHIRAPPALLI - 1.
DEPARTMENT OF COMPUTER SCIENCE.
${courseNameCode}
${dateDuration}

Logic for Test 1 (Total: 50 Marks):
Section A: 10 Questions x 1 Mark (Multiple Choice Questions).
Section B: 4 Questions x 5 Marks. Provide a total of 6 questions; student must answer any 4.
Section C: 2 Questions x 10 Marks. Provide a total of 3 questions; student must answer any 2.

Logic for Test 2 (Total: 75 Marks):
Section A: 20 Questions x 1 Mark (Objective/Short answer).
Section B: 5 Questions x 5 Marks. Use "Either/Or" (Internal Choice) pattern for each of the 5 questions (10 questions total).
Section C: 3 Questions x 10 Marks. Provide a total of 5 questions; student must answer any 3.

Quality Control:
- Ensure no two questions are identical.
- Maintain a balance: 40% Knowledge, 40% Understanding, 20% Application.
- Do not include answers in the final output unless specifically requested.

Generate the question paper now. Output ONLY the question paper text.
`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });
      
      const content = response.text || "";
      
      const newPreviewPaper: AIPaper = {
        course_name_code: courseNameCode,
        date_duration: dateDuration,
        test_type: testType,
        content,
        model_paper_text: modelPaperText,
        is_draft: true
      };
      
      setShowGenerateAIPaper(false);
      setActiveTab("ai-papers");
      setSelectedAIPaper(newPreviewPaper);
    } catch (err) {
      console.error(err);
      alert("Failed to generate AI paper.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAIPaper = async (asDraft: boolean = false) => {
    if (!selectedAIPaper) return;
    
    setLoading(true);
    try {
      const paperData = { ...selectedAIPaper, is_draft: asDraft };
      
      let res;
      if (selectedAIPaper.id) {
        // Update existing
        res = await fetch(`/api/ai-papers/${selectedAIPaper.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: selectedAIPaper.content, is_draft: asDraft })
        });
      } else {
        // Create new
        res = await fetch("/api/ai-papers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paperData)
        });
      }
      
      if (res.ok) {
        if (selectedAIPaper.id) {
          const updatedPapers = aiPapers.map(p => p.id === selectedAIPaper.id ? { ...p, content: selectedAIPaper.content, is_draft: asDraft } : p);
          setAiPapers(updatedPapers);
          setSelectedAIPaper({ ...selectedAIPaper, is_draft: asDraft });
          alert(asDraft ? "Draft updated successfully!" : "AI Paper finalized successfully!");
        } else {
          const newPaper = await res.json();
          setAiPapers([newPaper, ...aiPapers]);
          setSelectedAIPaper(newPaper);
          alert(asDraft ? "Draft saved successfully!" : "AI Paper saved successfully!");
        }
        setIsEditingAIPaper(false);
      } else {
        alert("Failed to save AI paper.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save AI paper.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeFormatting = async () => {
    if (!selectedAIPaper || !selectedAIPaper.model_paper_text) {
      console.error("Model paper text is not available for this paper. Formatting analysis cannot be performed.");
      return;
    }
    
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      const prompt = `
Role: You are an expert academic formatting reviewer.
Task: Analyze the generated AI paper content and identify any formatting inconsistencies with the provided model paper.
Provide suggestions for improvement, and then output the automatically corrected version of the paper.

Model Paper Text:
${selectedAIPaper.model_paper_text}

Generated AI Paper Text:
${selectedAIPaper.content}

Instructions:
1. Briefly list the formatting inconsistencies found.
2. Provide the fully corrected paper text below a separator "---CORRECTED PAPER---".
`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });
      
      const result = response.text || "";
      const parts = result.split("---CORRECTED PAPER---");
      
      if (parts.length > 1) {
        setFormattingAnalysis({
          analysis: parts[0].trim(),
          correctedContent: parts[1].trim()
        });
      } else {
        setFormattingAnalysis({
          analysis: "Could not parse the corrected paper. Here is the analysis:\n\n" + result,
          correctedContent: ""
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyFormattingCorrection = async () => {
    if (!selectedAIPaper || !formattingAnalysis || !formattingAnalysis.correctedContent) return;
    
    const updatedPaper = { ...selectedAIPaper, content: formattingAnalysis.correctedContent };
    setSelectedAIPaper(updatedPaper);
    
    if (updatedPaper.id) {
      await fetch(`/api/ai-papers/${updatedPaper.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: formattingAnalysis.correctedContent })
      });
      setAiPapers(aiPapers.map(p => p.id === updatedPaper.id ? updatedPaper : p));
    }
    setFormattingAnalysis(null);
  };

  const handleDownloadPDF = async () => {
    if (!paperRef.current || !selectedPaper) return;
    
    const element = paperRef.current;
    const canvas = await html2canvas(element, {
      scale: 2, // Higher resolution
      useCORS: true,
      logging: false
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    pdf.save(`${selectedPaper.title.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDownloadAIPDF = async () => {
    if (!aiPaperRef.current || !selectedAIPaper) return;
    
    const element = aiPaperRef.current;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    pdf.save(`${selectedAIPaper.course_name_code.replace(/\s+/g, '_')}_${selectedAIPaper.test_type.replace(/\s+/g, '_')}.pdf`);
  };

  if (loading && subjects.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-zinc-400" size={40} />
          <p className="text-zinc-500 font-medium font-mono text-sm uppercase tracking-widest">Initializing ExamGenius...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-200 bg-white flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">ExamGenius</h1>
            <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-tighter">Paper Generator v1.0</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === "dashboard"} 
            onClick={() => setActiveTab("dashboard")} 
          />
          <SidebarItem 
            icon={DbIcon} 
            label="Question Bank" 
            active={activeTab === "questions"} 
            onClick={() => setActiveTab("questions")} 
          />
          <SidebarItem 
            icon={BookOpen} 
            label="Generated Papers" 
            active={activeTab === "papers"} 
            onClick={() => setActiveTab("papers")} 
          />
          <SidebarItem 
            icon={Sparkles} 
            label="AI Generator" 
            active={activeTab === "ai-papers"} 
            onClick={() => setActiveTab("ai-papers")} 
          />
        </nav>

        <div className="pt-6 border-t border-zinc-100">
          <SidebarItem icon={Settings} label="Settings" active={false} onClick={() => {}} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto"
            >
              <header className="mb-10 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2">System Overview</h2>
                  <p className="text-zinc-500">Manage your subjects and monitor question bank health.</p>
                </div>
                <button 
                  onClick={() => setShowGeneratePaper(true)}
                  className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg hover:shadow-zinc-200"
                >
                  <Plus size={20} />
                  Generate New Paper
                </button>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Total Subjects</p>
                  <p className="text-4xl font-bold">{subjects.length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Total Questions</p>
                  <p className="text-4xl font-bold">{questions.length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Papers Generated</p>
                  <p className="text-4xl font-bold">{papers.length}</p>
                </div>
              </div>

              <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg">Subjects</h3>
                  <button 
                    onClick={() => {
                      const name = prompt("Enter subject name:");
                      if (name) handleAddSubject(name);
                    }}
                    className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1 text-sm font-semibold"
                  >
                    <Plus size={16} /> Add Subject
                  </button>
                </div>
                <div className="divide-y divide-zinc-100">
                  {subjects.map(sub => (
                    <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 font-bold">
                          {sub.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold">{sub.name}</p>
                          <p className="text-xs text-zinc-400 font-mono">
                            {questions.filter(q => q.subject_id === sub.id).length} Questions
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-zinc-300" />
                    </div>
                  ))}
                  {subjects.length === 0 && (
                    <div className="p-10 text-center text-zinc-400 italic">No subjects added yet.</div>
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === "questions" && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto"
            >
              <header className="mb-10 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2">Question Bank</h2>
                  <p className="text-zinc-500">Maintain a diverse set of questions for your exams.</p>
                </div>
                <button 
                  onClick={() => setShowAddQuestion(true)}
                  className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg"
                >
                  <Plus size={20} />
                  Add Question
                </button>
              </header>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search (e.g., 'database AND normal OR NOT sql')..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 text-sm"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 text-zinc-400 text-[10px] font-bold uppercase tracking-widest border-b border-zinc-100">
                        <th className="px-6 py-4">Subject</th>
                        <th className="px-6 py-4">Chapter</th>
                        <th className="px-6 py-4">Question</th>
                        <th className="px-6 py-4">Marks</th>
                        <th className="px-6 py-4">Difficulty</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {questions
                        .filter(q => {
                          const combinedText = `${q.content} ${q.chapter} ${q.subject_name || ""} ${q.difficulty}`;
                          return matchBooleanQuery(combinedText, searchQuery);
                        })
                        .map(q => (
                        <tr key={q.id} className="hover:bg-zinc-50 transition-colors group">
                          <td className="px-6 py-4 text-sm font-medium">{q.subject_name}</td>
                          <td className="px-6 py-4 text-sm text-zinc-500">{q.chapter}</td>
                          <td className="px-6 py-4 text-sm max-w-md truncate">{q.content}</td>
                          <td className="px-6 py-4 text-sm font-mono font-bold">{q.marks}</td>
                          <td className="px-6 py-4">
                            <Badge variant={q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Medium' ? 'warning' : 'danger'}>
                              {q.difficulty}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="text-zinc-300 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {questions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center text-zinc-400 italic">No questions found. Add some to get started.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "papers" && (
            <motion.div
              key="papers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto"
            >
              <header className="mb-10 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2">Generated Papers</h2>
                  <p className="text-zinc-500">Access and download previously generated examination papers.</p>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {papers.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => viewPaperDetails(p.id)}
                    className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-900">
                        <FileText size={24} />
                      </div>
                      <Badge>{p.subject_name}</Badge>
                    </div>
                    <h4 className="font-bold text-lg mb-1 group-hover:text-zinc-700 transition-colors">{p.title}</h4>
                    <p className="text-xs text-zinc-400 mb-6 font-mono">
                      {new Date(p.created_at).toLocaleDateString()} • {p.total_marks} Marks
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          viewPaperDetails(p.id);
                        }}
                        className="flex-1 bg-zinc-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors"
                      >
                        View Paper
                      </button>
                      <button 
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {papers.length === 0 && (
                  <div className="col-span-full py-20 text-center text-zinc-400 italic bg-white rounded-2xl border border-dashed border-zinc-200">
                    No papers generated yet.
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === "ai-papers" && (
            <motion.div
              key="ai-papers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto"
            >
              <header className="mb-10 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2">AI Paper Generator</h2>
                  <p className="text-zinc-500">Generate syllabus-aligned papers using ExamGenius AI.</p>
                </div>
                <button 
                  onClick={() => setShowGenerateAIPaper(true)}
                  className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg"
                >
                  <Sparkles size={20} />
                  Generate New AI Paper
                </button>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {aiPapers.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedAIPaper(p)}
                    className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <Sparkles size={24} />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="success">{p.test_type}</Badge>
                        {p.is_draft && <Badge variant="warning">Draft</Badge>}
                      </div>
                    </div>
                    <h4 className="font-bold text-lg mb-1 group-hover:text-indigo-600 transition-colors">{p.course_name_code}</h4>
                    <p className="text-xs text-zinc-400 mb-6 font-mono">
                      {new Date(p.created_at).toLocaleDateString()} • {p.date_duration}
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAIPaper(p);
                        }}
                        className="flex-1 bg-zinc-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors"
                      >
                        View Paper
                      </button>
                    </div>
                  </div>
                ))}
                
                {aiPapers.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-zinc-200 border-dashed">
                    <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
                      <Sparkles size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-800 mb-2">No AI Papers Generated</h3>
                    <p className="text-zinc-500 max-w-md mx-auto mb-6">
                      Click the button above to generate a new examination paper using ExamGenius AI.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showAddQuestion && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                <h3 className="font-bold text-xl">Add New Question</h3>
                <button onClick={() => setShowAddQuestion(false)} className="text-zinc-400 hover:text-zinc-900">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddQuestion} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Subject</label>
                    <select name="subject_id" required className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10">
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Difficulty</label>
                    <select name="difficulty" required className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10">
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Chapter</label>
                  <input name="chapter" required placeholder="e.g. Thermodynamics" className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Marks</label>
                  <input name="marks" type="number" required defaultValue={5} className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Question Content</label>
                  <textarea name="content" required rows={4} placeholder="Type the question here..." className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none" />
                </div>
                <button type="submit" className="w-full bg-zinc-900 text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg">
                  Save Question
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showGeneratePaper && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                <h3 className="font-bold text-xl">Generate Question Paper</h3>
                <button onClick={() => setShowGeneratePaper(false)} className="text-zinc-400 hover:text-zinc-900">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleGeneratePaper} className="p-6 space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Paper Title</label>
                  <input name="title" required placeholder="e.g. Mid-Term Examination 2024" className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Subject</label>
                  <select name="subject_id" required className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10">
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Difficulty Profile (Total 100 Marks)</label>
                    <button 
                      type="button"
                      onClick={handleSaveTemplate}
                      className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 hover:underline"
                    >
                      Save as Template
                    </button>
                  </div>

                  {templates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {templates.map(t => (
                        <div key={t.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => setProfile({ Easy: t.Easy, Medium: t.Medium, Hard: t.Hard })}
                            className="px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-full text-[10px] font-bold text-zinc-600 hover:bg-zinc-900 hover:text-white transition-all"
                          >
                            {t.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Plus size={10} className="rotate-45" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-zinc-500">Easy (Marks)</label>
                      <input 
                        name="easy" 
                        type="number" 
                        required 
                        value={profile.Easy} 
                        onChange={e => setProfile({ ...profile, Easy: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-zinc-500">Medium (Marks)</label>
                      <input 
                        name="medium" 
                        type="number" 
                        required 
                        value={profile.Medium} 
                        onChange={e => setProfile({ ...profile, Medium: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-zinc-500">Hard (Marks)</label>
                      <input 
                        name="hard" 
                        type="number" 
                        required 
                        value={profile.Hard} 
                        onChange={e => setProfile({ ...profile, Hard: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10" 
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-50 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="text-zinc-400 shrink-0" size={20} />
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    The system will attempt to pick questions that sum exactly to 100 marks while maximizing chapter coverage.
                  </p>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-zinc-900 text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "Generate Paper"}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {selectedPaper && (
          <div className="fixed inset-0 bg-white z-[60] overflow-y-auto">
            <div className="max-w-4xl mx-auto p-10">
              <div className="flex justify-between items-center mb-10 no-print">
                <button 
                  onClick={() => setSelectedPaper(null)}
                  className="text-zinc-500 hover:text-zinc-900 flex items-center gap-2 font-semibold"
                >
                  <ChevronRight className="rotate-180" size={20} /> Back to Dashboard
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={async () => {
                      const email = prompt("Enter recipient email:");
                      if (!email) return;
                      setLoading(true);
                      try {
                        const res = await fetch(`/api/papers/${selectedPaper.id}/email`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          alert(data.message);
                        }
                      } catch (err) {
                        console.error(err);
                        alert("Failed to send email.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="bg-white text-zinc-900 border border-zinc-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />} Email
                  </button>
                  <button 
                    onClick={handleDownloadPDF}
                    className="bg-white text-zinc-900 border border-zinc-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-zinc-50"
                  >
                    <FileText size={18} /> PDF
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-zinc-800"
                  >
                    <Printer size={18} /> Print
                  </button>
                </div>
              </div>

              <div ref={paperRef} className="border-4 border-zinc-900 p-10 bg-white shadow-2xl print:shadow-none print:border-2">
                <div className="text-center mb-10 border-b-2 border-zinc-900 pb-8">
                  <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">University of Technology</h1>
                  <h2 className="text-xl font-bold text-zinc-600 mb-4">{selectedPaper.title}</h2>
                  <div className="flex justify-between text-sm font-mono font-bold uppercase">
                    <span>Subject: {selectedPaper.subject_name}</span>
                    <span>Total Marks: 100</span>
                    <span>Time: 3 Hours</span>
                  </div>
                </div>

                <div className="space-y-8">
                  {selectedPaper.questions?.map((q, idx) => (
                    <div key={q.id} className="flex gap-6">
                      <span className="font-bold text-lg min-w-[2rem]">Q{idx + 1}.</span>
                      <div className="flex-1">
                        <p className="text-lg leading-relaxed mb-2">{q.content}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-zinc-400 font-mono uppercase">Chapter: {q.chapter}</span>
                          <span className="font-bold font-mono">[{q.marks} Marks]</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-20 pt-10 border-t border-zinc-200 text-center text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                  End of Question Paper • Generated by ExamGenius
                </div>
              </div>
            </div>
          </div>
        )}

        {showGenerateAIPaper && (
          <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-indigo-900">Generate AI Paper</h3>
                    <p className="text-xs text-indigo-600/70 font-medium">National College (Autonomous) Format</p>
                  </div>
                </div>
                <button onClick={() => setShowGenerateAIPaper(false)} className="text-zinc-400 hover:text-zinc-900 p-2 rounded-full hover:bg-white transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleGenerateAIPaper} className="p-8 space-y-6">
                {aiPaperTemplates.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-700">Load Template</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {aiPaperTemplates.map(t => (
                        <div key={t.id} className="flex-shrink-0 flex items-center gap-1 bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200 group">
                          <button 
                            type="button"
                            onClick={() => handleLoadAIPaperTemplate(t)}
                            className="text-xs font-semibold text-zinc-600 hover:text-indigo-600 transition-colors"
                          >
                            {t.name}
                          </button>
                          <button 
                            type="button"
                            onClick={() => t.id && handleDeleteAIPaperTemplate(t.id)}
                            className="text-zinc-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-700">Course Name & Code</label>
                    <input 
                      name="courseNameCode" 
                      required 
                      placeholder="e.g., Data Structures - CS101" 
                      value={aiPaperForm.courseNameCode}
                      onChange={(e) => setAiPaperForm({ ...aiPaperForm, courseNameCode: e.target.value })}
                      className="w-full p-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-700">Date & Duration</label>
                    <input 
                      name="dateDuration" 
                      required 
                      placeholder="e.g., 10-Mar-2026, 2 Hours" 
                      value={aiPaperForm.dateDuration}
                      onChange={(e) => setAiPaperForm({ ...aiPaperForm, dateDuration: e.target.value })}
                      className="w-full p-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700">Test Type</label>
                  <select 
                    name="testType" 
                    required 
                    value={aiPaperForm.testType}
                    onChange={(e) => setAiPaperForm({ ...aiPaperForm, testType: e.target.value })}
                    className="w-full p-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  >
                    <option value="Test 1">Test 1 (50 Marks)</option>
                    <option value="Test 2">Test 2 (75 Marks)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700">Syllabus Text</label>
                  <textarea 
                    name="syllabusText" 
                    required 
                    rows={4} 
                    placeholder="Paste the syllabus text here..." 
                    value={aiPaperForm.syllabusText}
                    onChange={(e) => setAiPaperForm({ ...aiPaperForm, syllabusText: e.target.value })}
                    className="w-full p-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-mono text-sm" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700">Model Paper Text</label>
                  <textarea 
                    name="modelPaperText" 
                    required 
                    rows={4} 
                    placeholder="Paste the model paper text here..." 
                    value={aiPaperForm.modelPaperText}
                    onChange={(e) => setAiPaperForm({ ...aiPaperForm, modelPaperText: e.target.value })}
                    className="w-full p-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-mono text-sm" 
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={handlePreviewQuestion}
                    disabled={loading}
                    className="flex-1 bg-zinc-100 text-zinc-900 py-4 rounded-xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <><Eye size={20} /> Preview Question</>}
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveAIPaperTemplate}
                    disabled={loading}
                    className="flex-1 bg-zinc-100 text-zinc-900 py-4 rounded-xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={20} /> Save Template
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-[2] bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <><Sparkles size={20} /> Generate AI Paper</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {questionPreview && (
          <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-indigo-900">Question Preview</h3>
                    <p className="text-xs text-indigo-600/70 font-medium">Sample generated question</p>
                  </div>
                </div>
                <button 
                  onClick={() => setQuestionPreview(null)}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <ChevronRight className="rotate-90" size={24} />
                </button>
              </div>
              <div className="p-8">
                <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 font-medium text-zinc-800 leading-relaxed">
                  {questionPreview}
                </div>
              </div>
              <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end">
                <button 
                  onClick={() => setQuestionPreview(null)}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {selectedAIPaper && (
          <div className="fixed inset-0 bg-white z-[60] overflow-y-auto">
            <div className="max-w-4xl mx-auto p-10">
              <div className="flex justify-between items-center mb-10 no-print">
                <button 
                  onClick={() => setSelectedAIPaper(null)}
                  className="text-zinc-500 hover:text-zinc-900 flex items-center gap-2 font-semibold"
                >
                  <ChevronRight className="rotate-180" size={20} /> Back to AI Papers
                </button>
                <div className="flex gap-3">
                  {selectedAIPaper.model_paper_text && !isEditingAIPaper && (
                    <button 
                      onClick={handleAnalyzeFormatting}
                      disabled={loading}
                      className="bg-amber-100 text-amber-900 border border-amber-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-amber-200 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                      Analyze Formatting
                    </button>
                  )}
                  {selectedAIPaper.is_draft && !isEditingAIPaper && (
                    <button 
                      onClick={() => {
                        setEditedAIPaperContent(selectedAIPaper.content);
                        setIsEditingAIPaper(true);
                      }}
                      className="bg-zinc-100 text-zinc-900 border border-zinc-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-zinc-200"
                    >
                      <Plus size={18} /> Edit Draft
                    </button>
                  )}
                  {isEditingAIPaper && (
                    <button 
                      onClick={() => {
                        setSelectedAIPaper({ ...selectedAIPaper, content: editedAIPaperContent });
                        setIsEditingAIPaper(false);
                      }}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={18} /> Done Editing
                    </button>
                  )}
                  {(selectedAIPaper.is_draft || !selectedAIPaper.id) && !isEditingAIPaper && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleSaveAIPaper(true)}
                        disabled={loading}
                        className="bg-zinc-100 text-zinc-900 border border-zinc-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Save Draft
                      </button>
                      <button 
                        onClick={() => handleSaveAIPaper(false)}
                        disabled={loading}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        Finalize Paper
                      </button>
                    </div>
                  )}
                  {!isEditingAIPaper && (
                    <>
                      <button 
                        onClick={async () => {
                          const email = prompt("Enter recipient email:");
                          if (!email) return;
                          setLoading(true);
                          try {
                            const res = await fetch(`/api/ai-papers/${selectedAIPaper.id}/email`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ email })
                            });
                            if (res.ok) {
                              const data = await res.json();
                              alert(data.message);
                            }
                          } catch (err) {
                            console.error(err);
                            alert("Failed to send email.");
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading || !selectedAIPaper.id || selectedAIPaper.is_draft}
                        title={!selectedAIPaper.id ? "Save the paper first to email it" : selectedAIPaper.is_draft ? "Finalize the paper first to email it" : ""}
                        className="bg-white text-zinc-900 border border-zinc-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />} Email
                      </button>
                      <button 
                        onClick={handleDownloadAIPDF}
                        className="bg-white text-indigo-900 border border-indigo-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-indigo-50"
                      >
                        <FileText size={18} /> PDF
                      </button>
                      <button 
                        onClick={() => window.print()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-indigo-700"
                      >
                        <Printer size={18} /> Print
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div ref={aiPaperRef} className="border-4 border-zinc-900 p-10 bg-white shadow-2xl print:shadow-none print:border-2">
                {isEditingAIPaper ? (
                  <textarea
                    value={editedAIPaperContent}
                    onChange={(e) => setEditedAIPaperContent(e.target.value)}
                    className="w-full h-[600px] p-4 font-mono text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                ) : (
                  <div className="markdown-body prose prose-zinc max-w-none">
                    <ReactMarkdown>{selectedAIPaper.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {formattingAnalysis && (
          <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-amber-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-amber-900">Formatting Analysis</h3>
                    <p className="text-xs text-amber-600/70 font-medium">Comparison with Model Paper</p>
                  </div>
                </div>
                <button onClick={() => setFormattingAnalysis(null)} className="text-zinc-400 hover:text-zinc-900 p-2 rounded-full hover:bg-white transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                <div className="prose prose-zinc max-w-none">
                  <ReactMarkdown>{formattingAnalysis.analysis}</ReactMarkdown>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3">
                <button 
                  onClick={() => setFormattingAnalysis(null)}
                  className="px-6 py-3 rounded-xl font-bold text-zinc-600 hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                {formattingAnalysis.correctedContent && (
                  <button 
                    onClick={applyFormattingCorrection}
                    className="bg-amber-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 flex items-center gap-2"
                  >
                    <CheckCircle2 size={20} /> Apply Corrections
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          main { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
