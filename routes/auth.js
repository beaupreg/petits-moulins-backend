const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Verification rate limiting
const verifyLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Trop de tentatives de vérification'
});

// Send verification code
router.post('/send-verification', 
  verifyLimit,
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      // Check if parent exists
      const parentResult = await pool.query(
        'SELECT * FROM parents WHERE email = $1',
        [email]
      );

      if (parentResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Adresse courriel non trouvée' 
        });
      }

      const parent = parentResult.rows[0];

      // Generate verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedCode = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Store verification code
      await pool.query(
        'INSERT INTO verification_codes (email, code_hash, expires_at, used) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET code_hash = $2, expires_at = $3, used = $4',
        [email, hashedCode, expiresAt, false]
      );

      // TODO: Send email (we'll implement this next)
      console.log(`Verification code for ${email}: ${code}`);

      res.json({ 
        success: true, 
        message: 'Code de vérification envoyé',
        // Remove this in production:
        dev_code: process.env.NODE_ENV === 'development' ? code : undefined
      });

    } catch (error) {
      console.error('Send verification error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// Verify code
router.post('/verify-code',
  body('email').isEmail().normalizeEmail(),
  body('code').isLength({ min: 6, max: 6 }).isNumeric(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, code } = req.body;

      // Get verification record
      const verificationResult = await pool.query(
        'SELECT * FROM verification_codes WHERE email = $1 AND used = false',
        [email]
      );

      if (verificationResult.rows.length === 0) {
        return res.status(400).json({ error: 'Code non trouvé' });
      }

      const verification = verificationResult.rows[0];

      // Check expiration
      if (new Date() > new Date(verification.expires_at)) {
        return res.status(400).json({ error: 'Code expiré' });
      }

      // Verify code
      const isValidCode = await bcrypt.compare(code, verification.code_hash);
      if (!isValidCode) {
        return res.status(400).json({ error: 'Code incorrect' });
      }

      // Mark as used
      await pool.query(
        'UPDATE verification_codes SET used = true WHERE email = $1',
        [email]
      );

      // Get parent data
      const parentResult = await pool.query(
        'SELECT * FROM parents WHERE email = $1',
        [email]
      );
      const parent = parentResult.rows[0];

      // Create JWT
      const token = jwt.sign(
        { email: parent.email, id: parent.id, role: 'parent' },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
      );

      res.json({
        success: true,
        token,
        parent: {
          id: parent.id,
          name: parent.name,
          email: parent.email,
          phone: parent.phone,
          children: parent.children,
          children_details: parent.children_details
        }
      });

    } catch (error) {
      console.error('Verify code error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

module.exports = router;