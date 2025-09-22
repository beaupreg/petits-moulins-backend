const express = require('express');
const router = express.Router();

// Temporary placeholder route
router.get('/test', (req, res) => {
  res.json({ message: 'Forms route working' });
});

module.exports = router;