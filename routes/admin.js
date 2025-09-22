const express = require('express');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware d'authentification admin (simplifié pour l'instant)
const authenticateAdmin = (req, res, next) => {
  // Pour l'instant, on accepte tous les tokens valides
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

// === GESTION DES PARENTS ===

// Récupérer tous les parents
router.get('/parents', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parents ORDER BY name');
    res.json({ success: true, parents: result.rows });
  } catch (error) {
    console.error('Erreur récupération parents:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un parent
router.post('/parents', 
  authenticateAdmin,
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, phone, children, children_details } = req.body;

      const result = await pool.query(
        `INSERT INTO parents (name, email, phone, children, children_details) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          name,
          email,
          phone || null,
          JSON.stringify(children || []),
          JSON.stringify(children_details || [])
        ]
      );

      res.json({ 
        success: true, 
        message: 'Parent ajouté avec succès',
        parent: result.rows[0]
      });

    } catch (error) {
      console.error('Erreur ajout parent:', error);
      if (error.code === '23505') { // Duplicate email
        res.status(400).json({ error: 'Cette adresse email existe déjà' });
      } else {
        res.status(500).json({ error: 'Erreur serveur' });
      }
    }
  }
);

// Modifier un parent
router.put('/parents/:id', 
  authenticateAdmin,
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { name, email, phone, children, children_details } = req.body;

      const result = await pool.query(
        `UPDATE parents 
         SET name = $1, email = $2, phone = $3, children = $4, children_details = $5 
         WHERE id = $6 RETURNING *`,
        [
          name,
          email,
          phone || null,
          JSON.stringify(children || []),
          JSON.stringify(children_details || []),
          id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Parent non trouvé' });
      }

      res.json({ 
        success: true, 
        message: 'Parent modifié avec succès',
        parent: result.rows[0]
      });

    } catch (error) {
      console.error('Erreur modification parent:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// Supprimer un parent
router.delete('/parents/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM parents WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }

    res.json({ 
      success: true, 
      message: 'Parent supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression parent:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === GESTION DES ÉDUCATEURS ===

// Récupérer tous les éducateurs
router.get('/educators', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM educators WHERE active = true ORDER BY name');
    res.json({ success: true, educators: result.rows });
  } catch (error) {
    console.error('Erreur récupération éducateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un éducateur
router.post('/educators', 
  authenticateAdmin,
  body('name').notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, phone, specialization } = req.body;

      const result = await pool.query(
        `INSERT INTO educators (name, email, phone, specialization, active) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, email || null, phone || null, specialization || null, true]
      );

      res.json({ 
        success: true, 
        message: 'Éducateur ajouté avec succès',
        educator: result.rows[0]
      });

    } catch (error) {
      console.error('Erreur ajout éducateur:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// === GESTION DES GROUPES ===

// Récupérer tous les groupes
router.get('/groups', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM groups WHERE active = true ORDER BY age_min');
    res.json({ success: true, groups: result.rows });
  } catch (error) {
    console.error('Erreur récupération groupes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un groupe
router.post('/groups', 
  authenticateAdmin,
  body('name').notEmpty().trim(),
  body('age_min').isInt({ min: 1, max: 12 }),
  body('age_max').isInt({ min: 1, max: 12 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, age_min, age_max, description, color } = req.body;

      if (age_min >= age_max) {
        return res.status(400).json({ error: 'L\'âge minimum doit être inférieur à l\'âge maximum' });
      }

      const result = await pool.query(
        `INSERT INTO groups (name, age_min, age_max, description, color, active) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          name, 
          age_min, 
          age_max, 
          description || null, 
          color || '#3498db', 
          true
        ]
      );

      res.json({ 
        success: true, 
        message: 'Groupe ajouté avec succès',
        group: result.rows[0]
      });

    } catch (error) {
      console.error('Erreur ajout groupe:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

module.exports = router;