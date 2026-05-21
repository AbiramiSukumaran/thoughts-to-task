/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables (.env)
dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware
  app.use(express.json({ limit: '10mb' }));

  // API Check / Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Thoughts to Actions Conversion Endpoint
  app.post('/api/thoughts/convert', async (req, res) => {
    try {
      const { rawText, inputType } = req.body;

      if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
        return res.status(400).json({ error: 'Raw thought text is required' });
      }

      // Check key
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'Gemini API is not configured on the server. Please check your system settings or Secrets panel.'
        });
      }

      const client = getGeminiClient();

      // We append local/server date context to help Gemini compute dates (e.g. 'tomorrow')
      const currentDateString = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const systemPrompt = `You are a world-class cognitive organizer and personal productivity assistant.
Your sole job is to ingest raw thoughts (voice transcriptions, short chaotic text dumps, or brainstorming notes) and convert them into a structured, highly actionable task.

Rules:
1. Translate raw ideas into an actionable, professional, user-friendly task.
2. If given a temporal term (e.g., "by Friday evening", "day after tomorrow", "next Tuesday"), convert it into standard "YYYY-MM-DD" date format based on today's current date: ${currentDateString}.
3. Create up to 8 step-by-step sequential actionable subtasks that can be tracked.
4. Recommend a clear categorization (e.g. Work, Health, Personal, Life, Learning, Finance, Urgencies). 
5. Select a relevant task priority: low, medium, or high.
6. Provide an informative summary description about why this workflow was recommended.
7. Generate up to 5 simple, lowercase tags describing the domains.`;

      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Input Thought Type: ${inputType}\nRaw Thought Input:\n"""\n${rawText}\n"""`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "Punchy, action-oriented, professional title of the task. (e.g., 'Schedule tooth clean up' rather than 'Dentist stuff').",
              },
              description: {
                type: Type.STRING,
                description: "Brief summary or strategic rationale summarizing context from the original thought.",
              },
              priority: {
                type: Type.STRING,
                description: "Must be exactly 'low', 'medium', or 'high'.",
              },
              category: {
                type: Type.STRING,
                description: "A single tag category (e.g. Work, Personal, Fitness, Admin, Health, Shopping, Legal).",
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Up to 5 lowercase keyword tags associated with this thought.",
              },
              durationMinutes: {
                type: Type.INTEGER,
                description: "Estimated number of minutes needed to execute this overall task (e.g., 15, 30, 60, 120).",
              },
              dueDateRecommendation: {
                type: Type.STRING,
                description: "Computed absolute date in YYYY-MM-DD format parsed or implied from prompt references. Return null if no clear temporal clues.",
              },
              subtasks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Up to 8 clear, progressive, bite-sized tasks to get this done.",
              }
            },
            required: ["title", "description", "priority", "category", "tags", "durationMinutes", "subtasks"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Emply response received from Gemini model.');
      }

      // Parse JSON
      const taskData = JSON.parse(responseText.trim());
      return res.json(taskData);
    } catch (error: any) {
      console.error('Thought Conversion Failure:', error);
      return res.status(500).json({
        error: error.message || 'An error occurred while analyzing and converting your thought'
      });
    }
  });

  // Vite development vs Static Production Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();
