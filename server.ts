import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "code-reviewer-secret-key";
const db = new Database("reviewer.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    code TEXT,
    language TEXT,
    analysis TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

interface AuthRequest extends Request {
  user?: { id: number; username: string };
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  });
};

async function startServer() {
  const app = express();
  const PORT = 5000;

  app.use(express.json());

  // Auth Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const info = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, hashedPassword);
      const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET);
      res.json({ token, user: { id: info.lastInsertRowid, username } });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') return res.status(400).json({ error: "Username already exists" });
      res.status(500).json({ error: "Signup failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username: user.username } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // GitHub Routes
  app.post("/api/github/repo", async (req, res) => {
    const { url } = req.body;
    try {
      // Extract owner and repo from URL
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return res.status(400).json({ error: "Invalid GitHub URL" });
      
      const [_, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, '');
      
      const response = await axios.get(`https://api.github.com/repos/${owner}/${cleanRepo}/contents`);
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch repository content" });
    }
  });

  app.get("/api/github/file", async (req, res) => {
    const { url } = req.query;
    try {
      const response = await axios.get(url as string);
      // GitHub API returns base64 for file content
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      res.json({ content });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch file content" });
    }
  });

  // Analysis Route
  app.post("/api/analyze", async (req: AuthRequest, res) => {
    const { code, language, saveReview } = req.body;
    const authHeader = req.headers['authorization'];
    let userId: number | null = null;

    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (e) {}
    }

    if (!code) return res.status(400).json({ error: "Code is required" });

    try {
      let apiKey = process.env.GEMINI_API_KEY;
      
      // Check for placeholder or missing key
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "YOUR_GEMINI_API_KEY" || apiKey.trim() === "") {
        apiKey = undefined;
      }

      let analysisText = "";

      if (!apiKey) {
        analysisText = performStaticAnalysis(code, language);
      } else {
        const ai = new GoogleGenAI({ apiKey });
        const model = ai.models.generateContent({
          model: "gemini-1.5-flash-latest",
          contents: `Analyze this ${language} code. Provide a detailed review including:
1. Errors or bugs
2. Optimization suggestions
3. Best practices
4. Estimated time complexity

Format the response in clear Markdown.

Code:
\`\`\`${language}
${code}
\`\`\``,
        });
        const response = await model;
        analysisText = response.text || "No analysis generated.";
      }

      if (saveReview && userId) {
        db.prepare("INSERT INTO reviews (user_id, code, language, analysis) VALUES (?, ?, ?, ?)").run(userId, code, language, analysisText);
      }

      res.json({ analysis: analysisText, isStatic: !apiKey });
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      res.status(500).json({ error: "Failed to analyze code. " + error.message });
    }
  });

  app.get("/api/reviews", authenticateToken, (req: AuthRequest, res) => {
    const reviews = db.prepare("SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC").all(req.user!.id);
    res.json(reviews);
  });

  // Basic Static Analysis Fallback
  function performStaticAnalysis(code: string, language: string) {
    let suggestions = "### Static Analysis Results (AI Offline)\n\n";
    
    if (code.length < 10) {
      suggestions += "- **Warning**: Code is very short. Please provide more context.\n";
    }

    const lines = code.split('\n');
    let nestedLoopCount = 0;
    let longLoopFound = false;

    lines.forEach(line => {
      if (line.includes('for') || line.includes('while')) {
        if (line.match(/for|while/g)?.length || 0 > 1) nestedLoopCount++;
      }
      if (line.includes('range(1000000)') || line.includes('i < 1000000')) {
        longLoopFound = true;
      }
    });

    if (nestedLoopCount > 0) {
      suggestions += "- **Optimization**: Detected potential nested loops. Consider if this can be optimized to O(n) or O(n log n).\n";
    }
    if (longLoopFound) {
      suggestions += "- **Warning**: Large loop detected. Ensure this doesn't cause performance bottlenecks.\n";
    }

    suggestions += "\n- **Best Practice**: Ensure variables are named descriptively.\n";
    suggestions += "- **Best Practice**: Add comments to explain complex logic.\n";
    
    return suggestions;
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
