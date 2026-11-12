const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICO_LOCALIZACAO_URL = process.env.LOCALIZACAO_URL || (process.env.VERCEL ? '' : 'http://localhost:3001');
const SERVICO_METEOROLOGIA_URL = process.env.METEOROLOGIA_URL || (process.env.VERCEL ? '' : 'http://localhost:3002');
const TIMEOUT_MS = Number(process.env.MICROSERVICO_TIMEOUT_MS) || 90000;

if (process.env.VERCEL && (!SERVICO_LOCALIZACAO_URL || !SERVICO_METEOROLOGIA_URL)) {
  throw new Error('Configure LOCALIZACAO_URL e METEOROLOGIA_URL com as URLs públicas dos microsserviços.');
}

let historicoCidades = [];

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    const duracao = Date.now() - inicio;
    console.log(`[GATEWAY LOG] ${req.method} ${req.originalUrl} -> Status ${res.statusCode} (${duracao}ms)`);
  });
  next();
});

async function fetchComTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    // O timeout permanece ativo até o corpo da resposta ser totalmente recebido.
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) {
      const err = new Error('TIMEOUT_EXTERNO');
      err.codigo = 'TIMEOUT_EXTERNO';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function validarNomeCidade(nome) {
  if (!nome || typeof nome !== 'string') return { valido: false, codigo: 'PARAMETRO_AUSENTE', mensagem: 'O parâmetro "cidade" é obrigatório.' };
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (limpo.length < 2 || limpo.length > 100) {
    return { valido: false, codigo: 'CIDADE_INVALIDA', mensagem: 'O nome da cidade deve ter entre 2 e 100 caracteres.' };
  }
  const regexValida = /^[a-zA-Z\u00C0-\u00FF\u0100-\u017F\s\'\.\-]+$/;
  if (!regexValida.test(limpo)) {
    return { valido: false, codigo: 'CIDADE_INVALIDA', mensagem: 'O nome da cidade contém caracteres inválidos.' };
  }
  return { valido: true, nomeLimpo: limpo };
}

function salvarNoHistorico(local) {
  const item = {
    nome: local.nome,
    estado: local.estado,
    pais: local.pais,
    codigoPais: local.codigoPais,
    latitude: local.latitude,
    longitude: local.longitude
  };

  historicoCidades = historicoCidades.filter(c => 
    !(Math.abs(c.latitude - item.latitude) < 0.001 && Math.abs(c.longitude - item.longitude) < 0.001)
  );
  historicoCidades.unshift(item);
  if (historicoCidades.length > 5) {
    historicoCidades = historicoCidades.slice(0, 5);
  }
}

function filtrarHomonimasUnicas(opcoes) {
  const mapa = new Map();
  for (const item of opcoes) {
    const chave = `${item.nome.toLowerCase()}|${item.estado.toLowerCase()}|${item.pais.toLowerCase()}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, item);
    }
  }
  return Array.from(mapa.values()).slice(0, 10);
}

async function resolverClimaPorLocal(local) {
  const urlMeteo = `${SERVICO_METEOROLOGIA_URL}/clima?lat=${local.latitude}&lon=${local.longitude}`;
  const respMeteo = await fetchComTimeout(urlMeteo);
  
  if (!respMeteo.ok) {
    const erroJson = await respMeteo.json().catch(() => ({}));
    throw { status: respMeteo.status, payload: erroJson };
  }

  const dadosMeteo = await respMeteo.json();
  salvarNoHistorico(local);

  return {
    status: 'ok',
    local: {
      nome: local.nome,
      estado: local.estado,
      pais: local.pais,
      codigoPais: local.codigoPais,
      latitude: local.latitude,
      longitude: local.longitude,
      fusoHorario: local.fusoHorario || 'UTC'
    },
    atual: dadosMeteo.atual,
    previsao: dadosMeteo.previsao,
    unidades: dadosMeteo.unidades,
    atualizadoEm: new Date().toISOString()
  };
}

app.get('/api/clima', async (req, res) => {
  const { cidade, lat, lon, nome, estado, pais } = req.query;

  try {
    if (lat !== undefined && lon !== undefined) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          erro: { codigo: 'COORDENADAS_INVALIDAS', mensagem: 'Coordenadas geográficas inválidas.', status: 400 }
        });
      }

      const local = {
        nome: nome || 'Local Solicitado',
        estado: estado || '',
        pais: pais || '',
        codigoPais: '',
        latitude: latitude,
        longitude: longitude,
        fusoHorario: 'UTC'
      };

      const resultado = await resolverClimaPorLocal(local);
      return res.json(resultado);
    }

    const validacao = validarNomeCidade(cidade);
    if (!validacao.valido) {
      return res.status(400).json({
        erro: { codigo: validacao.codigo, mensagem: validacao.mensagem, status: 400 }
      });
    }

    const urlLoc = `${SERVICO_LOCALIZACAO_URL}/localizar?nome=${encodeURIComponent(validacao.nomeLimpo)}`;
    const respLoc = await fetchComTimeout(urlLoc);

    if (!respLoc.ok) {
      const errJson = await respLoc.json().catch(() => ({}));
      return res.status(respLoc.status).json(errJson);
    }

    const opcoes = await respLoc.json();

    if (!Array.isArray(opcoes) || opcoes.length === 0) {
      return res.status(404).json({
        erro: {
          codigo: 'CIDADE_NAO_ENCONTRADA',
          mensagem: `Não encontramos nenhuma cidade com o nome "${validacao.nomeLimpo}".`,
          status: 404
        }
      });
    }

    const opcoesUnicas = filtrarHomonimasUnicas(opcoes);

    if (opcoesUnicas.length > 1) {
      return res.json({
        status: 'escolha',
        consulta: validacao.nomeLimpo,
        opcoes: opcoesUnicas
      });
    }

    const resultado = await resolverClimaPorLocal(opcoesUnicas[0]);
    return res.json(resultado);

  } catch (err) {
    if (err.codigo === 'TIMEOUT_EXTERNO') {
      return res.status(502).json({
        erro: { codigo: 'TIMEOUT_EXTERNO', mensagem: 'O tempo limite de resposta de um microsserviço expirou.', status: 502 }
      });
    }
    if (err.status && err.payload) {
      return res.status(err.status).json(err.payload);
    }
    return res.status(502).json({
      erro: { codigo: 'SERVICO_INDISPONIVEL', mensagem: 'Serviço meteorológico ou de localização indisponível.', status: 502 }
    });
  }
});

app.get('/api/historico', (req, res) => {
  res.json(historicoCidades);
});

app.get('/api/comparar', async (req, res) => {
  const { cidadeA, cidadeB, latA, lonA, latB, lonB } = req.query;

  try {
    const buscarOuResolver = async (nomeC, latC, lonC) => {
      if (latC !== undefined && lonC !== undefined) {
        return { status: 'ok', local: { latitude: parseFloat(latC), longitude: parseFloat(lonC), nome: nomeC || 'Cidade' } };
      }
      const val = validarNomeCidade(nomeC);
      if (!val.valido) throw { status: 400, codigo: val.codigo, mensagem: `Erro na cidade: ${val.mensagem}` };
      
      const respLoc = await fetchComTimeout(`${SERVICO_LOCALIZACAO_URL}/localizar?nome=${encodeURIComponent(val.nomeLimpo)}`);
      if (!respLoc.ok) {
        const erro = await respLoc.json().catch(() => ({}));
        throw {
          status: respLoc.status,
          codigo: erro.erro?.codigo || 'ERRO_LOCALIZACAO',
          mensagem: erro.erro?.mensagem || 'Não foi possível localizar a cidade.'
        };
      }
      const opcoes = await respLoc.json();
      if (!Array.isArray(opcoes) || opcoes.length === 0) throw { status: 404, codigo: 'CIDADE_NAO_ENCONTRADA', mensagem: `Cidade "${val.nomeLimpo}" não encontrada.` };
      
      const unicas = filtrarHomonimasUnicas(opcoes);
      if (unicas.length > 1) {
        return { status: 'escolha', consulta: val.nomeLimpo, opcoes: unicas };
      }
      return { status: 'ok', local: unicas[0] };
    };

    const resA = await buscarOuResolver(cidadeA, latA, lonA);
    if (resA.status === 'escolha') {
      return res.json({ status: 'escolha', qualCidade: 'A', consulta: resA.consulta, opcoes: resA.opcoes });
    }

    const resB = await buscarOuResolver(cidadeB, latB, lonB);
    if (resB.status === 'escolha') {
      return res.json({ status: 'escolha', qualCidade: 'B', consulta: resB.consulta, opcoes: resB.opcoes });
    }

    const climaA = await resolverClimaPorLocal(resA.local);
    const climaB = await resolverClimaPorLocal(resB.local);

    return res.json({
      status: 'ok',
      cidadeA: climaA,
      cidadeB: climaB
    });
  } catch (err) {
    if (err.codigo === 'TIMEOUT_EXTERNO') {
      return res.status(502).json({ erro: { codigo: 'TIMEOUT_EXTERNO', mensagem: 'Timeout na requisição de comparação.', status: 502 } });
    }
    if (err.status && err.codigo) {
      return res.status(err.status).json({ erro: { codigo: err.codigo, mensagem: err.mensagem, status: err.status } });
    }
    return res.status(500).json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falha inesperada no processamento da comparação.', status: 500 } });
  }
});

app.get('/api/saude', async (req, res) => {
  let locSaude = 'off';
  let metSaude = 'off';
  try {
    const r1 = await fetch(`${SERVICO_LOCALIZACAO_URL}/saude`);
    if (r1.ok) locSaude = 'ok';
  } catch (e) {}

  try {
    const r2 = await fetch(`${SERVICO_METEOROLOGIA_URL}/saude`);
    if (r2.ok) metSaude = 'ok';
  } catch (e) {}

  const statusGeral = (locSaude === 'ok' && metSaude === 'ok') ? 'ok' : 'degradado';
  res.json({
    status: statusGeral,
    gateway: 'ok',
    servicoLocalizacao: locSaude,
    servicoMeteorologia: metSaude,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
