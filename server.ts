import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("questions.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    chapter TEXT NOT NULL,
    content TEXT NOT NULL,
    marks INTEGER NOT NULL,
    difficulty TEXT CHECK(difficulty IN ('Easy', 'Medium', 'Hard')) NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_marks INTEGER NOT NULL,
    difficulty_profile TEXT NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS paper_questions (
    paper_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    PRIMARY KEY (paper_id, question_id),
    FOREIGN KEY (paper_id) REFERENCES papers(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS difficulty_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    easy INTEGER NOT NULL,
    medium INTEGER NOT NULL,
    hard INTEGER NOT NULL
  );
`);

// Seed Data
const seedData = () => {
  const subjectCount = db.prepare("SELECT COUNT(*) as count FROM subjects").get() as any;
  if (subjectCount.count === 0) {
    const subjects = ["Computer Science", "Physics", "Mathematics"];
    for (const sub of subjects) {
      db.prepare("INSERT INTO subjects (name) VALUES (?)").run(sub);
    }

    const csId = 1;
    const chapters = ["Data Structures", "Algorithms", "Operating Systems", "Networking"];
    const difficulties: ("Easy" | "Medium" | "Hard")[] = ["Easy", "Medium", "Hard"];
    
    for (const chapter of chapters) {
      for (const diff of difficulties) {
        for (let i = 1; i <= 5; i++) {
          db.prepare(`
            INSERT INTO questions (subject_id, chapter, content, marks, difficulty) 
            VALUES (?, ?, ?, ?, ?)
          `).run(
            csId, 
            chapter, 
            `Sample ${diff} question ${i} from ${chapter} for testing the generation algorithm.`,
            diff === 'Easy' ? 2 : diff === 'Medium' ? 5 : 10,
            diff
          );
        }
      }
    }
    console.log("Database seeded with sample data.");
  }
};
seedData();

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  
  // Subjects
  app.get("/api/subjects", (req, res) => {
    const subjects = db.prepare("SELECT * FROM subjects").all();
    res.json(subjects);
  });

  app.post("/api/subjects", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO subjects (name) VALUES (?)").run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (e) {
      res.status(400).json({ error: "Subject already exists" });
    }
  });

  // Questions
  app.get("/api/questions", (req, res) => {
    const { subject_id } = req.query;
    let query = "SELECT q.*, s.name as subject_name FROM questions q JOIN subjects s ON q.subject_id = s.id";
    const params: any[] = [];
    if (subject_id) {
      query += " WHERE q.subject_id = ?";
      params.push(subject_id);
    }
    const questions = db.prepare(query).all(...params);
    res.json(questions);
  });

  app.post("/api/questions", (req, res) => {
    const { subject_id, chapter, content, marks, difficulty } = req.body;
    const info = db.prepare(
      "INSERT INTO questions (subject_id, chapter, content, marks, difficulty) VALUES (?, ?, ?, ?, ?)"
    ).run(subject_id, chapter, content, marks, difficulty);
    res.json({ id: info.lastInsertRowid, ...req.body });
  });

  app.delete("/api/questions/:id", (req, res) => {
    db.prepare("DELETE FROM questions WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Paper Generation Logic
  app.post("/api/generate-paper", (req, res) => {
    const { subject_id, title, profile } = req.body; // profile: { Easy: 20, Medium: 50, Hard: 30 }
    
    const allQuestions = db.prepare("SELECT * FROM questions WHERE subject_id = ?").all(subject_id) as any[];
    
    const groups = {
      Easy: allQuestions.filter(q => q.difficulty === 'Easy'),
      Medium: allQuestions.filter(q => q.difficulty === 'Medium'),
      Hard: allQuestions.filter(q => q.difficulty === 'Hard')
    };

    const selectedQuestionIds: number[] = [];
    let totalSelectedMarks = 0;

    const selectForDifficulty = (difficulty: 'Easy' | 'Medium' | 'Hard', targetMarks: number) => {
      let currentMarks = 0;
      const selected: any[] = [];
      const pool = [...groups[difficulty]];
      
      // Shuffle pool initially
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      // Simple greedy with randomization and chapter awareness
      // We'll try multiple passes if needed, but for now one pass with weighting
      let attempts = 0;
      while (currentMarks < targetMarks && attempts < 100) {
        attempts++;
        const remaining = targetMarks - currentMarks;
        const candidates = pool.filter(q => q.marks <= remaining && !selected.find(s => s.id === q.id));
        
        if (candidates.length === 0) break;

        // Weight candidates by chapter coverage
        // Prefer chapters not yet in 'selected'
        const usedChapters = new Set(selected.map(q => q.chapter));
        const weightedCandidates = candidates.map(q => ({
          q,
          weight: usedChapters.has(q.chapter) ? 1 : 10
        }));

        const totalWeight = weightedCandidates.reduce((sum, c) => sum + c.weight, 0);
        let random = Math.random() * totalWeight;
        let picked = weightedCandidates[0].q;
        for (const c of weightedCandidates) {
          random -= c.weight;
          if (random <= 0) {
            picked = c.q;
            break;
          }
        }

        selected.push(picked);
        currentMarks += picked.marks;
      }

      return { selected, currentMarks };
    };

    const easyResult = selectForDifficulty('Easy', profile.Easy);
    const mediumResult = selectForDifficulty('Medium', profile.Medium);
    const hardResult = selectForDifficulty('Hard', profile.Hard);

    if (easyResult.currentMarks !== profile.Easy || 
        mediumResult.currentMarks !== profile.Medium || 
        hardResult.currentMarks !== profile.Hard) {
      return res.status(400).json({ 
        error: "Could not satisfy constraints with available questions. Please add more questions or adjust the profile.",
        details: {
          Easy: `${easyResult.currentMarks}/${profile.Easy}`,
          Medium: `${mediumResult.currentMarks}/${profile.Medium}`,
          Hard: `${hardResult.currentMarks}/${profile.Hard}`
        }
      });
    }

    const finalQuestions = [...easyResult.selected, ...mediumResult.selected, ...hardResult.selected];
    
    // Save Paper
    const insertPaper = db.prepare("INSERT INTO papers (subject_id, title, total_marks, difficulty_profile) VALUES (?, ?, ?, ?)");
    const insertPaperQuestion = db.prepare("INSERT INTO paper_questions (paper_id, question_id) VALUES (?, ?)");

    const transaction = db.transaction(() => {
      const info = insertPaper.run(subject_id, title, 100, JSON.stringify(profile));
      const paperId = info.lastInsertRowid;
      for (const q of finalQuestions) {
        insertPaperQuestion.run(paperId, q.id);
      }
      return paperId;
    });

    const paperId = transaction();
    res.json({ id: paperId, title, questions: finalQuestions });
  });

  app.get("/api/papers", (req, res) => {
    const papers = db.prepare(`
      SELECT p.*, s.name as subject_name 
      FROM papers p 
      JOIN subjects s ON p.subject_id = s.id
      ORDER BY p.created_at DESC
    `).all();
    res.json(papers);
  });

  app.get("/api/papers/:id", (req, res) => {
    const paper = db.prepare(`
      SELECT p.*, s.name as subject_name 
      FROM papers p 
      JOIN subjects s ON p.subject_id = s.id
      WHERE p.id = ?
    `).get(req.params.id) as any;

    if (!paper) return res.status(404).json({ error: "Paper not found" });

    const questions = db.prepare(`
      SELECT q.* 
      FROM questions q
      JOIN paper_questions pq ON q.id = pq.question_id
      WHERE pq.paper_id = ?
    `).all(req.params.id);

    res.json({ ...paper, questions });
  });

  // Difficulty Templates
  app.get("/api/templates", (req, res) => {
    const templates = db.prepare("SELECT * FROM difficulty_templates").all();
    res.json(templates);
  });

  app.post("/api/templates", (req, res) => {
    const { name, easy, medium, hard } = req.body;
    try {
      const info = db.prepare(
        "INSERT INTO difficulty_templates (name, easy, medium, hard) VALUES (?, ?, ?, ?)"
      ).run(name, easy, medium, hard);
      res.json({ id: info.lastInsertRowid, name, easy, medium, hard });
    } catch (e) {
      res.status(400).json({ error: "Template name already exists" });
    }
  });

  app.delete("/api/templates/:id", (req, res) => {
    db.prepare("DELETE FROM difficulty_templates WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Emailing Service (Mock)
  app.post("/api/papers/:id/email", (req, res) => {
    const { email } = req.body;
    const paper = db.prepare("SELECT title FROM papers WHERE id = ?").get(req.params.id) as any;
    
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    console.log(`Sending paper "${paper.title}" to ${email}`);
    // In a real app, you'd use nodemailer or a service like SendGrid here
    
    setTimeout(() => {
      res.json({ success: true, message: `Question paper has been sent to ${email}` });
    }, 1000);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
