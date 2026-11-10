const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

function obterDescricaoWMO(codigo) {
  const mapa = {
    0: 'Céu limpo',
    1: 'Predominantemente limpo',
    2: 'Parcialmente nublado',
    3: 'Nublado',
    45: 'Nevoeiro',
    48: 'Nevoeiro depositando geada',
    51: 'Chuvisco leve',
    53: 'Chuvisco moderado',
    55: 'Chuvisco intenso',
    56: 'Chuvisco congelante leve',
    57: 'Chuvisco congelante intenso',
    61: 'Chuva fraca',
    63: 'Chuva moderada',
    65: 'Chuva forte',
    66: 'Chuva congelante fraca',
    67: 'Chuva congelante forte',
    71: 'Queda de neve fraca',
    73: 'Queda de neve moderada',
    75: 'Queda de neve forte',
    77: 'Grãos de neve',
    80: 'Pancadas de chuva fracos',
    81: 'Pancadas de chuva moderados',
    82: 'Pancadas de chuva violentos',
    85: 'Pancadas de neve fracos',
    86: 'Pancadas de neve fortes',
    95: 'Trovoada fraca ou moderada',
    96: 'Trovoada com granizo leve',
    99: 'Trovoada com granizo forte'
  };
  return mapa[codigo] || 'Condição desconhecida';
}

function obterDirecaoVentoTexto(graus) {
  if (graus === undefined || graus === null) return 'N/D';
  const g = (graus % 360 + 360) % 360;
  if (g >= 337.5 || g < 22.5) return 'Norte (N)';
  if (g >= 22.5 && g < 67.5) return 'Nordeste (NE)';
  if (g >= 67.5 && g < 112.5) return 'Leste (L)';
  if (g >= 112.5 && g < 157.5) return 'Sudeste (SE)';
  if (g >= 157.5 && g < 202.5) return 'Sul (S)';
  if (g >= 202.5 && g < 247.5) return 'Sudoeste (SO)';
  if (g >= 247.5 && g < 292.5) return 'Oeste (O)';
  if (g >= 292.5 && g < 337.5) return 'Noroeste (NO)';
  return 'N/D';
}

function obterClassificacaoUV(uv) {
  if (uv === undefined || uv === null) return 'N/D';
  if (uv <= 2) return 'Baixo';
  if (uv <= 5) return 'Moderado';
  if (uv <= 7) return 'Alto';
  if (uv <= 10) return 'Muito alto';
  return 'Extremo';
}

app.get('/clima', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({
      erro: {
        codigo: 'COORDENADAS_INVALIDAS',
        mensagem: 'Latitude deve estar entre -90 e 90, e Longitude entre -180 e 180.',
        status: 400
      }
    });
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({
        erro: {
          codigo: 'SERVICO_INDISPONIVEL',
          mensagem: 'Falha ao obter dados da Open-Meteo Forecast.',
          status: 502
        }
      });
    }

    const data = await response.json();
    const current = data.current || {};
    const daily = data.daily || {};
    const indiceUV = current.uv_index !== undefined ? current.uv_index : 0;

    const previsao5Dias = [];
    if (daily.time && Array.isArray(daily.time)) {
      for (let i = 1; i <= 5 && i < daily.time.length; i++) {
        const codigoWMO = daily.weather_code[i];
        previsao5Dias.push({
          data: daily.time[i],
          maxima: daily.temperature_2m_max[i],
          minima: daily.temperature_2m_min[i],
          codigoWMO: codigoWMO,
          descricao: obterDescricaoWMO(codigoWMO)
        });
      }
    }

    const resultado = {
      atual: {
        observadoEm: current.time || new Date().toISOString().slice(0, 16),
        temperatura: current.temperature_2m,
        sensacaoTermica: current.apparent_temperature,
        ventoVelocidade: current.wind_speed_10m,
        ventoDirecaoGraus: current.wind_direction_10m,
        ventoDirecaoTexto: obterDirecaoVentoTexto(current.wind_direction_10m),
        indiceUV: indiceUV,
        classificacaoUV: obterClassificacaoUV(indiceUV),
        codigoWMO: current.weather_code,
        descricao: obterDescricaoWMO(current.weather_code),
        ehDia: current.is_day === 1
      },
      previsao: previsao5Dias,
      unidades: {
        temperatura: '°C',
        vento: 'km/h',
        uv: ''
      }
    };

    return res.json(resultado);
  } catch (error) {
    return res.status(502).json({
      erro: {
        codigo: 'SERVICO_INDISPONIVEL',
        mensagem: 'Erro de conexão com a API de meteorologia.',
        status: 502
      }
    });
  }
});

app.get('/saude', (req, res) => {
  res.json({ status: 'ok', servico: 'meteorologia' });
});

app.listen(PORT, () => {
  console.log(`[Microsserviço de Meteorologia] Rodando na porta ${PORT}`);
});
