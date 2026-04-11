import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { config } from './config/index.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  console.log(`[HTTP] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (Object.keys(req.body).length > 0) {
    const bodyCopy = { ...req.body };
    if (bodyCopy.otp) bodyCopy.otp = '******'; // Hide OTP in logs
    console.log(`[HTTP] Body:`, bodyCopy);
  }
  next();
});

if (config.nodeEnv !== 'production') {
  app.use(morgan('dev'));
}


app.use('/auth', authRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`OTP auth service listening on http://localhost:${config.port}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  server.close(() => process.exit(1));
});
