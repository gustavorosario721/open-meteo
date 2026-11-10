import './style.css';
import Chart from 'chart.js/auto';
import { createWeatherEffects } from './weather-effects.js';

const weatherEffects = createWeatherEffects(document.getElementById('weatherEffects'));

const btnModoUnico = document.getElementById('btnModoUnico');
const btnModoComparar = document.getElementById('btnModoComparar');
const secaoUnica = document.getElementById('secaoUnica');
const secaoComparar = document.getElementById('secaoComparar');

const inputCidade = document.getElementById('inputCidade');
const btnBuscar = document.getElementById('btnBuscar');
const formBusca = document.getElementById('formBusca');
const listaHistorico = document.getElementById('listaHistorico');

const secaoHomonimas = document.getElementById('secaoHomonimas');
const listaHomonimas = document.getElementById('listaHomonimas');

const cardClimaAtual = document.getElementById('cardClimaAtual');
const secaoPrevisao = document.getElementById('secaoPrevisao');
const gridPrevisao = document.getElementById('gridPrevisao');
const secaoGrafico = document.getElementById('secaoGrafico');
const btnAtualizar = document.getElementById('btnAtualizar');

const mensagemErro = document.getElementById('mensagemErro');
const loadingSpinner = document.getElementById('loadingSpinner');

const inputCidadeA = document.getElementById('inputCidadeA');
const inputCidadeB = document.getElementById('inputCidadeB');
const btnComparar = document.getElementById('btnComparar');
const resultadoComparacao = document.getElementById('resultadoComparacao');
const cardCidadeA = document.getElementById('cardCidadeA');
const cardCidadeB = document.getElementById('cardCidadeB');
const diffDestaque = document.getElementById('diffDestaque');

let localAtual = null;
let chartInstanciaUnica = null;
let chartInstanciaComparar = null;
const CHAVE_HISTORICO_LOCAL = 'clima:historico';

function obterIconeWMO(codigo, ehDia = true, temperatura = null) {
  if (temperatura >= 35 && codigo >= 0 && codigo <= 3) return '🥵';

  switch (codigo) {
    case 0: return ehDia ? '☀️' : '🌙';
    case 1: return ehDia ? '🌤️' : '🌙';
    case 2: return ehDia ? '⛅' : '☁️';
    case 3: return '☁️';
    case 45: case 48: return '🌫️';
    case 51: case 53: case 55: return ehDia ? '🌦️' : '🌧️';
    case 56: case 57: return '🌧️';
    case 61: case 63: case 65: return '🌧️';
    case 66: case 67: return '🌧️';
    case 71: case 73: case 75: case 77: return '🌨️';
    case 80: case 81: case 82: return ehDia ? '🌦️' : '🌧️';
    case 85: case 86: return '🌨️';
    case 95: case 96: case 99: return '⛈️';
    default: return '❓';
  }
}

function obterTemaWMO(codigo, ehDia = true, temperatura = null) {
  if (codigo >= 95 && codigo <= 99) return 'thunderstorm';
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return 'snow';
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return 'rain';
  if (codigo >= 51 && codigo <= 57) return 'drizzle';
  if (codigo === 45 || codigo === 48) return 'fog';
  if (temperatura >= 35 && codigo >= 0 && codigo <= 3) return 'extreme-heat';
  if (codigo === 0) return ehDia ? 'clear-day' : 'clear-night';
  if (codigo === 1 || codigo === 2) return 'partly-cloudy';
  if (codigo === 3) return 'cloudy';
  return 'unknown';
}

function atualizarTemaClima(atual) {
  const tema = obterTemaWMO(atual.codigoWMO, atual.ehDia, atual.temperatura);
  const icone = obterIconeWMO(atual.codigoWMO, atual.ehDia, atual.temperatura);

  document.body.dataset.weather = tema;
  weatherEffects.setWeather(tema);
  document.getElementById('iconeDestaqueClima').textContent = icone;
  document.getElementById('iconeDestaqueComparacao').textContent = icone;
}

function formatarDataHora(isoString) {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  } catch (e) {
    return isoString;
  }
}

function validarEntradaLocal(texto) {
  if (!texto) return { valido: false, msg: 'Digite o nome de uma cidade.' };
  const limpo = texto.trim().replace(/\s+/g, ' ');
  if (limpo.length < 2) return { valido: false, msg: 'O nome da cidade deve ter pelo menos 2 caracteres.' };
  if (limpo.length > 100) return { valido: false, msg: 'O nome da cidade deve ter no máximo 100 caracteres.' };
  const regex = /^[a-zA-Z\u00C0-\u00FF\u0100-\u017F\s\'\.\-]+$/;
  if (!regex.test(limpo)) return { valido: false, msg: 'O nome da cidade possui caracteres inválidos.' };
  return { valido: true, limpo };
}

function mostrarErro(mensagem) {
  mensagemErro.textContent = mensagem;
  mensagemErro.classList.remove('hidden');
}

function ocultarErro() {
  mensagemErro.classList.add('hidden');
  mensagemErro.textContent = '';
}

function setCarregando(carregando) {
  if (carregando) {
    loadingSpinner.classList.remove('hidden');
    btnBuscar.disabled = true;
    btnAtualizar.disabled = true;
    if (btnComparar) btnComparar.disabled = true;
  } else {
    loadingSpinner.classList.add('hidden');
    btnBuscar.disabled = false;
    btnAtualizar.disabled = false;
    if (btnComparar) btnComparar.disabled = false;
  }
}

btnModoUnico.addEventListener('click', () => {
  btnModoUnico.classList.add('active');
  btnModoComparar.classList.remove('active');
  secaoUnica.classList.remove('hidden');
  secaoComparar.classList.add('hidden');
  ocultarErro();
});

btnModoComparar.addEventListener('click', () => {
  btnModoComparar.classList.add('active');
  btnModoUnico.classList.remove('active');
  secaoComparar.classList.remove('hidden');
  secaoUnica.classList.add('hidden');
  ocultarErro();
});

formBusca.addEventListener('submit', (event) => {
  event.preventDefault();
  executarBusca();
});

async function executarBusca(nomeEspecifico = null) {
  ocultarErro();
  secaoHomonimas.classList.add('hidden');

  const termo = nomeEspecifico || inputCidade.value;
  const val = validarEntradaLocal(termo);

  if (!val.valido) {
    mostrarErro(val.msg);
    return;
  }

  setCarregando(true);

  try {
    const res = await fetch(`/api/clima?cidade=${encodeURIComponent(val.limpo)}`);
    const data = await res.json();

    if (!res.ok) {
      tratarErroApi(data);
      return;
    }

    if (data.status === 'escolha') {
      exibirListaHomonimas(data.opcoes);
    } else if (data.status === 'ok') {
      exibirClimaCompleto(data);
      carregarHistorico();
    }
  } catch (err) {
    mostrarErro('Serviço meteorológico indisponível. Tente novamente em instantes.');
  } finally {
    setCarregando(false);
  }
}

async function buscarPorCoordenadas(lat, lon, nome = '', estado = '', pais = '') {
  ocultarErro();
  secaoHomonimas.classList.add('hidden');
  setCarregando(true);

  try {
    const query = `/api/clima?lat=${lat}&lon=${lon}&nome=${encodeURIComponent(nome)}&estado=${encodeURIComponent(estado)}&pais=${encodeURIComponent(pais)}`;
    const res = await fetch(query);
    const data = await res.json();

    if (!res.ok) {
      tratarErroApi(data);
      return;
    }

    exibirClimaCompleto(data);
    carregarHistorico();
  } catch (err) {
    mostrarErro('Erro ao atualizar dados da cidade.');
  } finally {
    setCarregando(false);
  }
}

function tratarErroApi(data) {
  if (data.erro) {
    switch (data.erro.codigo) {
      case 'CIDADE_NAO_ENCONTRADA':
        mostrarErro(data.erro.mensagem);
        break;
      case 'CIDADE_INVALIDA':
      case 'PARAMETRO_AUSENTE':
        mostrarErro(data.erro.mensagem);
        break;
      case 'TIMEOUT_EXTERNO':
      case 'SERVICO_INDISPONIVEL':
        mostrarErro('Serviço meteorológico indisponível no momento (Timeout/Erro de Rede).');
        break;
      default:
        mostrarErro(data.erro.mensagem || 'Falha na requisição.');
    }
  } else {
    mostrarErro('Ocorreu um erro inesperado.');
  }
}

function exibirListaHomonimas(opcoes) {
  listaHomonimas.innerHTML = '';
  opcoes.forEach(op => {
    const li = document.createElement('li');
    const localStr = `${op.nome}${op.estado ? ', ' + op.estado : ''}, ${op.pais}`;
    li.textContent = localStr;
    li.addEventListener('click', () => {
      buscarPorCoordenadas(op.latitude, op.longitude, op.nome, op.estado, op.pais);
    });
    listaHomonimas.appendChild(li);
  });
  secaoHomonimas.classList.remove('hidden');
}

function exibirClimaCompleto(data) {
  localAtual = data.local;
  salvarHistoricoLocal(data.local);
  atualizarTemaClima(data.atual);

  document.getElementById('localNome').textContent = data.local.nome;
  document.getElementById('localDetalhes').textContent = `${data.local.estado ? data.local.estado + ', ' : ''}${data.local.pais}`;
  document.getElementById('localCoords').textContent = `Lat: ${data.local.latitude.toFixed(4)} | Lon: ${data.local.longitude.toFixed(4)} (${data.local.fusoHorario})`;

  document.getElementById('iconeWMO').textContent = obterIconeWMO(data.atual.codigoWMO, data.atual.ehDia, data.atual.temperatura);
  document.getElementById('tempAtual').textContent = Math.round(data.atual.temperatura);
  document.getElementById('descWMO').textContent = data.atual.descricao;
  document.getElementById('sensacaoTermica').textContent = Math.round(data.atual.sensacaoTermica);
  document.getElementById('observadoEm').textContent = `Observado em: ${formatarDataHora(data.atual.observadoEm)}`;

  document.getElementById('ventoTexto').textContent = data.atual.ventoDirecaoTexto;
  document.getElementById('ventoVelocidade').textContent = `${data.atual.ventoVelocidade} km/h (${data.atual.ventoDirecaoGraus}°)`;

  document.getElementById('uvIndice').textContent = data.atual.indiceUV;
  document.getElementById('uvClassificacao').textContent = data.atual.classificacaoUV;

  const agoraStr = new Date(data.atualizadoEm).toLocaleTimeString('pt-BR');
  document.getElementById('atualizadoEmTexto').textContent = `Atualizado às ${agoraStr}`;

  cardClimaAtual.classList.remove('hidden');

  gridPrevisao.innerHTML = '';
  const datasChart = [];
  const maximasChart = [];
  const minimasChart = [];

  data.previsao.forEach(item => {
    const dataObj = new Date(item.data + 'T00:00:00');
    const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase();
    const dataFormatada = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    datasChart.push(dataFormatada);
    maximasChart.push(item.maxima);
    minimasChart.push(item.minima);

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <span class="day-name">${diaSemana}</span>
      <span class="day-date">${dataFormatada}</span>
      <span class="wmo-icon">${obterIconeWMO(item.codigoWMO, true)}</span>
      <span class="wmo-desc">${item.descricao}</span>
      <div class="temps">
        <span class="max">${Math.round(item.maxima)}°</span> / 
        <span class="min">${Math.round(item.minima)}°</span>
      </div>
    `;
    gridPrevisao.appendChild(card);
  });

  secaoPrevisao.classList.remove('hidden');
  renderizarGraficoUnico(datasChart, maximasChart, minimasChart);
  secaoGrafico.classList.remove('hidden');
}

btnAtualizar.addEventListener('click', () => {
  if (localAtual) {
    buscarPorCoordenadas(localAtual.latitude, localAtual.longitude, localAtual.nome, localAtual.estado, localAtual.pais);
  }
});

function renderizarGraficoUnico(rotulos, maximas, minimas) {
  const ctx = document.getElementById('graficoTemperatura').getContext('2d');
  
  if (chartInstanciaUnica) {
    chartInstanciaUnica.destroy();
  }

  chartInstanciaUnica = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rotulos,
      datasets: [
        {
          label: 'Temperatura Máxima (°C)',
          data: maximas,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Temperatura Mínima (°C)',
          data: minimas,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        y: { title: { display: true, text: '°C' } }
      }
    }
  });
}

function carregarHistorico() {
  listaHistorico.innerHTML = '';

  let historico;
  try {
    historico = JSON.parse(localStorage.getItem(CHAVE_HISTORICO_LOCAL) || '[]');
  } catch (error) {
    console.error('Falha ao carregar histórico local', error);
    historico = [];
  }

  if (!Array.isArray(historico) || historico.length === 0) {
    listaHistorico.innerHTML = '<span class="empty-history">Nenhuma busca recente</span>';
    return;
  }

  historico.forEach(item => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `${item.nome} (${item.pais})`;
    chip.addEventListener('click', () => {
      buscarPorCoordenadas(item.latitude, item.longitude, item.nome, item.estado, item.pais);
    });
    listaHistorico.appendChild(chip);
  });
}

function salvarHistoricoLocal(local) {
  try {
    const historicoAtual = JSON.parse(localStorage.getItem(CHAVE_HISTORICO_LOCAL) || '[]');
    const historico = Array.isArray(historicoAtual) ? historicoAtual : [];
    const item = {
      nome: local.nome,
      estado: local.estado,
      pais: local.pais,
      latitude: local.latitude,
      longitude: local.longitude
    };

    const recentes = historico.filter(cidade =>
      !(Math.abs(cidade.latitude - item.latitude) < 0.001 && Math.abs(cidade.longitude - item.longitude) < 0.001)
    );
    recentes.unshift(item);
    localStorage.setItem(CHAVE_HISTORICO_LOCAL, JSON.stringify(recentes.slice(0, 5)));
  } catch (error) {
    console.error('Falha ao salvar histórico local', error);
  }
}

formComparar.addEventListener('submit', async (event) => {
  event.preventDefault();
  ocultarErro();
  const valA = validarEntradaLocal(inputCidadeA.value);
  const valB = validarEntradaLocal(inputCidadeB.value);

  if (!valA.valido) return mostrarErro(`Cidade A: ${valA.msg}`);
  if (!valB.valido) return mostrarErro(`Cidade B: ${valB.msg}`);

  setCarregando(true);

  try {
    const res = await fetch(`/api/comparar?cidadeA=${encodeURIComponent(valA.limpo)}&cidadeB=${encodeURIComponent(valB.limpo)}`);
    const data = await res.json();

    if (!res.ok) {
      tratarErroApi(data);
      return;
    }

    if (data.status === 'escolha') {
      mostrarErro(`A cidade ${data.qualCidade === 'A' ? 'A' : 'B'} ("${data.consulta}") possui mais de uma localização. Por favor, especifique na busca individual.`);
      return;
    }

    exibirComparacao(data.cidadeA, data.cidadeB);
  } catch (err) {
    mostrarErro('Erro ao processar comparação entre as duas cidades.');
  } finally {
    setCarregando(false);
  }
});

function renderizarCardComparativo(container, data) {
  container.innerHTML = `
    <h3>${data.local.nome} (${data.local.pais})</h3>
    <p class="compare-temperature">
      ${obterIconeWMO(data.atual.codigoWMO, data.atual.ehDia, data.atual.temperatura)} ${Math.round(data.atual.temperatura)}°C
    </p>
    <p>${data.atual.descricao}</p>
    <p><small>Sensação: ${Math.round(data.atual.sensacaoTermica)}°C</small></p>
    <p><small>Vento: ${data.atual.ventoVelocidade} km/h ${data.atual.ventoDirecaoTexto}</small></p>
    <p><small>UV: ${data.atual.indiceUV} (${data.atual.classificacaoUV})</small></p>
  `;
}

function exibirComparacao(climaA, climaB) {
  atualizarTemaClima(climaA.atual);
  salvarHistoricoLocal(climaA.local);
  salvarHistoricoLocal(climaB.local);
  carregarHistorico();
  renderizarCardComparativo(cardCidadeA, climaA);
  renderizarCardComparativo(cardCidadeB, climaB);

  const diff = Math.abs(climaA.atual.temperatura - climaB.atual.temperatura).toFixed(1);
  const maisQuente = climaA.atual.temperatura > climaB.atual.temperatura ? climaA.local.nome : climaB.local.nome;
  diffDestaque.textContent = `${maisQuente} está ${diff}°C mais quente no momento.`;

  const rotulos = climaA.previsao.map(p => {
    const d = new Date(p.data + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  });

  const ctx = document.getElementById('graficoComparacao').getContext('2d');
  if (chartInstanciaComparar) chartInstanciaComparar.destroy();

  chartInstanciaComparar = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rotulos,
      datasets: [
        { label: `${climaA.local.nome} (Máx)`, data: climaA.previsao.map(p => p.maxima), borderColor: '#dc2626' },
        { label: `${climaA.local.nome} (Mín)`, data: climaA.previsao.map(p => p.minima), borderColor: '#f87171', borderDash: [5, 5] },
        { label: `${climaB.local.nome} (Máx)`, data: climaB.previsao.map(p => p.maxima), borderColor: '#2563eb' },
        { label: `${climaB.local.nome} (Mín)`, data: climaB.previsao.map(p => p.minima), borderColor: '#60a5fa', borderDash: [5, 5] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  resultadoComparacao.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  carregarHistorico();
});
