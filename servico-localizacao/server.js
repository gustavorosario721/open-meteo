const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function validarNomeCidade(nome) {
  if (!nome || typeof nome !== 'string') return null;
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (limpo.length < 2 || limpo.length > 100) return null;
  
  const regexValida = /^[a-zA-Z\u00C0-\u00FF\u0100-\u017F\s\'\.\-]+$/;
  if (!regexValida.test(limpo)) return null;
  return limpo;
}

app.get('/localizar', async (req, res) => {
  const { nome } = req.query;
  const nomeValido = validarNomeCidade(nome);

  if (!nomeValido) {
    return res.status(400).json({
      erro: {
        codigo: 'CIDADE_INVALIDA',
        mensagem: 'O nome da cidade deve ter entre 2 e 100 caracteres válidos.',
        status: 400
      }
    });
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nomeValido)}&count=10&language=pt&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({
        erro: {
          codigo: 'SERVICO_INDISPONIVEL',
          mensagem: 'Falha ao consultar serviço externo de geocodificação.',
          status: 502
        }
      });
    }

    const data = await response.json();

    if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
      return res.json([]);
    }

    const locaisNormalizados = data.results.map(item => ({
      nome: item.name,
      estado: item.admin1 || '',
      pais: item.country || '',
      codigoPais: item.country_code || '',
      latitude: item.latitude,
      longitude: item.longitude,
      fusoHorario: item.timezone || 'UTC'
    }));

    return res.json(locaisNormalizados);
  } catch (error) {
    return res.status(502).json({
      erro: {
        codigo: 'SERVICO_INDISPONIVEL',
        mensagem: 'Erro de conexão com o serviço de geocodificação.',
        status: 502
      }
    });
  }
});

app.get('/saude', (req, res) => {
  res.json({ status: 'ok', servico: 'localizacao' });
});

app.listen(PORT, () => {
  console.log(`[Microsserviço de Localização] Rodando na porta ${PORT}`);
});
