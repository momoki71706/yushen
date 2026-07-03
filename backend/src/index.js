import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat.js';
import diaryRouter from './routes/diary.js';
import lettersRouter from './routes/letters.js';
import settingsRouter from './routes/settings.js';
import pushRouter from './routes/push.js';
import { startProactiveScheduler } from './proactive.js';
import { startScheduledMessageChecker } from './scheduledMessages.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/chat', chatRouter);
app.use('/api/diary', diaryRouter);
app.use('/api/letters', lettersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/push', pushRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set — chat will use a fallback canned reply instead of real AI.');
  }
  startProactiveScheduler();
  startScheduledMessageChecker();
});
