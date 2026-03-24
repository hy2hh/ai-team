<!-- Extracted from .claude/agents/backend.md -->

# API Design — Express.js Example

```javascript
// Express.js API Architecture with proper error handling

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('./middleware/auth');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// API Routes with proper validation and error handling
app.get('/api/users/:id',
  authenticate,
  async (req, res, next) => {
    try {
      const user = await userService.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        data: user,
        meta: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      next(error);
    }
  }
);
```
