const express = require('express');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// Soumettre un formulaire
router.post('/submit', 
  authenticateToken,
  body('form_type').notEmpty(),
  body('digital_signature').notEmpty(),
  body('children').isArray({ min: 1 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        form_type,
        activity_description,
        event_date,
        children,
        consent_given,
        additional_notes,
        digital_signature
      } = req.body;

      const formId = 'FORM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

      await pool.query(
        `INSERT INTO forms (
          id, parent_email, parent_name, form_type, children, 
          activity_description, event_date, consent_given, 
          additional_notes, digital_signature, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          formId,
          req.user.email,
          req.user.name || 'Parent',
          form_type,
          JSON.stringify(children),
          activity_description,
          event_date || null,
          consent_given,
          additional_notes,
          digital_signature,
          'submitted'
        ]
      );

      res.json({ 
        success: true, 
        message: 'Formulaire soumis avec succès',
        formId: formId
      });

    } catch (error) {
      console.error('Erreur soumission:', error);
      res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
  }
);

module.exports = router;

// Récupérer tous les formulaires (pour admin)
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM forms ORDER BY date_submitted DESC'
    );
    
    res.json({
      success: true,
      forms: result.rows
    });
  } catch (error) {
    console.error('Erreur récupération formulaires:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});