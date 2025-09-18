// ПРАВИЛЬНЫЙ СИНТАКСИС CATCH-ALL РОУТА ДЛЯ ИСПРАВЛЕНИЯ
// Static files
app.use(express.static('dist'));
app.get('/:path*', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'dist', 'index.html'));
});