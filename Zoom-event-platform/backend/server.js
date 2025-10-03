const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { verifyZoomWebhook, processZoomWebhook } = require('./middleware/zoomWebhook');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Production configuration
if (process.env.NODE_ENV === 'production') {
  // Trust proxy for proper HTTPS handling
  app.set('trust proxy', 1);
  
  // Stronger security headers for production
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.zoom.us", "https://zoom.us"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  // Production CORS
  app.use(cors({
    origin: [process.env.FRONTEND_URL, "https://yourdomain.com"],
    credentials: true,
    optionsSuccessStatus: 200
  }));
} else {
  // Development configuration
  app.use(helmet());
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static('uploads'));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Zoom Event Platform API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Zoom webhook endpoint (before rate limiting)
app.post('/api/webhooks/zoom', express.raw({ type: 'application/json' }), verifyZoomWebhook, processZoomWebhook);

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/events', require('./routes/events'));
app.use('/api/zoom', require('./routes/zoom'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/uploads', require('./routes/uploads'));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 API URL: http://localhost:${PORT}`);
});

module.exports = app;