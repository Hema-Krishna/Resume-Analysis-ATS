
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');

const { analyze, extract } = require('./skills');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve frontend files from the project folder
app.use(express.static(__dirname));

// Database models
const S = mongoose.Schema;

const model = (name, schema) =>
  mongoose.model(name, new S(schema, { timestamps: true }));

const owner = {
  type: S.Types.ObjectId,
  ref: 'User',
  index: true,
  required: true
};

const User = model('User', {
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: String
});

const Application = model('Application', {
  user: owner,
  company: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  link: String,
  location: String,
  appliedOn: Date,
  deadline: Date,
  interviewDate: Date,
  notes: String,
  status: {
    type: String,
    enum: [
      'Applied',
      'Assessment',
      'Interview',
      'Offered',
      'Rejected',
      'Withdrawn'
    ],
    default: 'Applied'
  }
});

const Resume = model('Resume', {
  user: owner,
  fileName: String,
  text: String
});

// Authentication
const auth = (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    req.uid = jwt.verify(token, process.env.JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in again.' });
  }
};

const sign = user => ({
  token: jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  ),
  user: { name: user.name, email: user.email }
});

const wrap = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(error => {
    res.status(400).json({ error: error.message });
  });

// Register
app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password || password.length < 6) {
    throw new Error('Name, email and a password of 6+ characters are required.');
  }

  const normalizedEmail = email.toLowerCase();

  if (await User.findOne({ email: normalizedEmail })) {
    throw new Error('Email already registered.');
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: await bcrypt.hash(password, 10)
  });

  res.json(sign(user));
}));

// Login
app.post('/api/auth/login', wrap(async (req, res) => {
  const user = await User.findOne({
    email: (req.body.email || '').toLowerCase()
  });

  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) {
    throw new Error('Invalid email or password.');
  }

  res.json(sign(user));
}));

// Current user
app.get('/api/auth/me', auth, wrap(async (req, res) => {
  res.json(await User.findById(req.uid).select('-password'));
}));

// Applications
app.get('/api/applications', auth, wrap(async (req, res) => {
  const { q, status } = req.query;
  const filter = { user: req.uid };

  if (status) filter.status = status;

  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ company: regex }, { title: regex }];
  }

  res.json(await Application.find(filter).sort('-createdAt'));
}));

app.post('/api/applications', auth, wrap(async (req, res) => {
  res.json(await Application.create({
    ...req.body,
    user: req.uid
  }));
}));

app.put('/api/applications/:id', auth, wrap(async (req, res) => {
  const { user, _id, ...data } = req.body;

  const application = await Application.findOneAndUpdate(
    { _id: req.params.id, user: req.uid },
    data,
    { new: true, runValidators: true }
  );

  if (!application) {
    return res.status(404).json({ error: 'Application not found.' });
  }

  res.json(application);
}));

app.delete('/api/applications/:id', auth, wrap(async (req, res) => {
  await Application.deleteOne({
    _id: req.params.id,
    user: req.uid
  });

  res.json({ ok: true });
}));

// Resume upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.post(
  '/api/resumes',
  auth,
  upload.single('file'),
  wrap(async (req, res) => {
    const file = req.file;

    if (!file) throw new Error('No file uploaded.');

    const filename = file.originalname.toLowerCase();
    let text = '';

    try {
      if (filename.endsWith('.pdf')) {
        const parsed = await pdf(file.buffer);
        text = parsed.text;
      } else if (filename.endsWith('.docx')) {
        const parsed = await mammoth.extractRawText({ buffer: file.buffer });
        text = parsed.value;
      } else {
        throw new Error('Only PDF and DOCX files are supported.');
      }
    } catch (error) {
      if (error.message.startsWith('Only')) throw error;
      throw new Error(
        'Could not read this file. It may be corrupted or password-protected.'
      );
    }

    text = text.replace(/\s+\n/g, '\n').trim();

    if (text.length < 50) {
      throw new Error(
        'No readable text found. Upload a text-based PDF or DOCX.'
      );
    }

    res.json(await Resume.create({
      user: req.uid,
      fileName: file.originalname,
      text
    }));
  })
);

app.get('/api/resumes', auth, wrap(async (req, res) => {
  res.json(await Resume.find({ user: req.uid }).sort('-createdAt'));
}));

app.put('/api/resumes/:id', auth, wrap(async (req, res) => {
  const resume = await Resume.findOneAndUpdate(
    { _id: req.params.id, user: req.uid },
    { text: req.body.text },
    { new: true }
  );

  if (!resume) {
    return res.status(404).json({ error: 'Resume not found.' });
  }

  res.json(resume);
}));

app.delete('/api/resumes/:id', auth, wrap(async (req, res) => {
  await Resume.deleteOne({
    _id: req.params.id,
    user: req.uid
  });

  res.json({ ok: true });
}));

// Resume and job-description analysis
app.post('/api/analyze', auth, wrap(async (req, res) => {
  const resume = await Resume.findOne({
    _id: req.body.resumeId,
    user: req.uid
  });

  if (!resume) throw new Error('Select a resume first.');

  if (
    !req.body.jobDescription ||
    req.body.jobDescription.length < 30
  ) {
    throw new Error('Paste a job description (at least a few lines).');
  }

  res.json(analyze(resume.text, req.body.jobDescription));
}));

// Extract skills
app.post('/api/skills', auth, wrap(async (req, res) => {
  res.json({ skills: extract(req.body.text) });
}));

// Handle unsupported routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Error handler
app.use((err, req, res, next) => {
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? 'File is larger than 5 MB.'
    : err.message;

  res.status(400).json({ error: message });
});

// Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start after MongoDB connects
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  })
  .catch(error => {
    console.error('MongoDB connection failed:', error.message);
  });
