// server/server.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { serve } from 'inngest/express';
import { clerkMiddleware } from '@clerk/express';

// Adjust these import paths to your tree:
import connectDB from './config/db.js';
import { inngest, functions } from './inngest/index.js';

const app = express();
// Decide mode: cloud on Vercel, dev locally
const INNGEST_MODE = process.env.VERCEL ? 'cloud' : 'dev';

if (!process.env.VERCEL) {
  const { config } = await import('dotenv');
  config();
}

// DB first
await connectDB();



/**
 * Inngest FIRST, with RAW body.
 * Do NOT put express.json() or Clerk before this.
 */
// Normalize the signing key just in case
if (process.env.INNGEST_SIGNING_KEY) {
  process.env.INNGEST_SIGNING_KEY = process.env.INNGEST_SIGNING_KEY.trim();
  console.log('[INNGEST DEBUG] keyTail=', process.env.INNGEST_SIGNING_KEY.slice(-6));
}


app.use(
  '/api/inngest',
  express.raw({ type: '*/*' }),
  (req, _res, next) => {
    const sig = req.get('x-inngest-signature') || '';
    const env = req.get('x-inngest-env') || '';
    const keyTail = (process.env.INNGEST_SIGNING_KEY || '').slice(-6);
    console.log(
      '[INNGEST DEBUG]',
      'buf=', Buffer.isBuffer(req.body),
      'len=', req.body?.length,
      'envHeader=', env,
      'sigTail=', sig.slice(-6),
      'keyTail=', keyTail
    );
    next();
  },
  serve({ client: inngest, functions, mode: 'cloud' })
);


// Now your usual middleware/routes
app.use(cors());
app.use(express.json());

// If Clerk is global, skip it for /api/inngest
app.use((req, res, next) => {
  if (req.path.startsWith('/api/inngest')) return next();
  return clerkMiddleware()(req, res, next);
});

// Health check
app.get('/', (req, res) => res.send('Server is Live!'));



// ✅ Export the app for Vercel
export default app;

// ✅ Local-only listener for dev:
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () =>
    console.log(`Server listening at http://localhost:${port}`)
  );
}
