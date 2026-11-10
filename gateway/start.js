const express = require('express');
const path = require('path');
const app = require('./server');
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../dist')));

app.listen(PORT, () => {
  console.log(`[API Gateway] Rodando na porta ${PORT}`);
});
