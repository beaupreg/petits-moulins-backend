const express = require('express');
const router = express.Router();

// Temporary placeholder route
router.get('/test', (req, res) => {
  res.json({ message: 'Parents route working' });
});

module.exports = router;