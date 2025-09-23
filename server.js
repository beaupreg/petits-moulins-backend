const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANT: Ajoutez cette ligne pour Render
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Les Petits Moulins API is running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Les Petits Moulins API',
    timestamp: new Date().toISOString() 
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/parents', require('./routes/parents'));
app.use('/api/forms', require('./routes/forms'));
app.use('/api/admin', require('./routes/admin'));

// Routes admin directes - ajoutez avant app.listen()
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    next();
  } else {
    res.status(401).json({ error: 'Token manquant' });
  }
};

// Pool de base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Routes admin
app.get('/api/admin/parents', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parents ORDER BY name');
    res.json({ success: true, parents: result.rows });
  } catch (error) {
    console.error('Erreur parents:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/children', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM children ORDER BY name');
    res.json({ success: true, children: result.rows });
  } catch (error) {
    console.error('Erreur children:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/educators', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM educators WHERE active = true ORDER BY name');
    res.json({ success: true, educators: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/groups', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM groups WHERE active = true ORDER BY age_min');
    res.json({ success: true, groups: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});