import express from 'express';
import cors from 'cors';
import healthRoute from './routes/health';
import { env } from './utils/env';

const app = express();
app.use(cors());
app.use(express.json());
app.use(healthRoute);

app.get('/', (_req, res) => {
  res.json({ name: 'Zenko backend', status: 'online' });
});

app.listen(env.port, () => {
  console.log(`Zenko backend listening on port ${env.port}`);
});
