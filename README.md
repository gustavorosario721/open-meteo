# 🌤️ Aplicação de Consulta Meteorológica com Microsserviços

Aplicação web responsiva para consulta e comparação de dados meteorológicos em tempo real e previsão para 5 dias, construída em **Node.js + Express** com frontend em **JavaScript e Vite**, consumindo as APIs gratuitas da **Open-Meteo**.

---

## 🏗️ Arquitetura do Sistema

```
Frontend (Vite + HTML/CSS/JS)
        ↓
API Gateway (Express - Porta 3000) — GET /api/clima?cidade=...
        ↓                               ↓
Microsserviço de Localização       Microsserviço de Meteorologia
(Express - Porta 3001)            (Express - Porta 3002)
Open-Meteo Geocoding              Open-Meteo Forecast
```

- **Frontend:** Interface responsiva construída com Vite, com gráficos interativos (Chart.js); o gateway serve os arquivos otimizados de `dist/`.
- **API Gateway (Porta 3000):** Ponto único de entrada, centralizador de rotas, validação de entrada (2–100 caracteres), controle de histórico das últimas 5 cidades e orquestração dos microsserviços com timeout de 5 segundos.
- **Microsserviço de Localização (Porta 3001):** Consome a Open-Meteo Geocoding e normaliza dados geográficos.
- **Microsserviço de Meteorologia (Porta 3002):** Consome a Open-Meteo Forecast, mapeia os 5 dias de previsão, traduz códigos WMO para português, calcula direção do vento e classifica o índice UV.

---

## 📋 Pré-requisitos

- **Node.js:** Versão 18.0.0 ou superior (possui `fetch` nativo).
- **npm:** Versão 9.0.0 ou superior.

---

## 🚀 Instalação e Execução

### 1. Entrar no diretório do projeto:
```bash
cd projeto
```

### 2. Instalar todas as dependências:
```bash
npm run install:all
```

### 3. Executar em desenvolvimento:
```bash
npm run dev
```

O frontend fica disponível em http://localhost:5173, com as chamadas `/api` encaminhadas ao gateway.

### 4. Gerar o build e iniciar todos os serviços:
```bash
npm run start:all
```

Para gerar apenas os arquivos de produção, execute `npm run build`. O gateway serve o conteúdo gerado em `dist/`.

Endereços dos serviços:
- **API Gateway + Frontend:** http://localhost:3000
- **Serviço de Localização:** http://localhost:3001
- **Serviço de Meteorologia:** http://localhost:3002

---

## ☁️ Publicação na Vercel

O projeto está configurado para publicar o frontend Vite como arquivos estáticos e o gateway Express como uma Vercel Function em `/api/*`. A configuração está em `vercel.json`, e a função de entrada em `api/[...path].js`.

Como a Vercel não inicia os dois microsserviços locais, publique-os separadamente em serviços Node.js acessíveis por HTTPS. Em **Project Settings → Environment Variables**, configure:

| Variável | Valor |
|---|---|
| `LOCALIZACAO_URL` | URL base pública do serviço de localização, sem `/` no final |
| `METEOROLOGIA_URL` | URL base pública do serviço meteorológico, sem `/` no final |

As duas variáveis são obrigatórias na Vercel. Depois de configurá-las, faça um novo deploy. Sem as URLs dos microsserviços, a função do gateway não inicia.

O histórico mostrado na interface fica salvo no navegador (`localStorage`), para continuar disponível entre chamadas serverless e recargas da página. O endpoint `GET /api/historico` do gateway continua usando memória do processo e não deve ser tratado como armazenamento persistente na Vercel.

---

## 📡 Endpoints da API (Gateway)

### 1. `GET /api/clima`
- Por nome: `/api/clima?cidade=Salvador`
- Por coordenadas: `/api/clima?lat=-12.9711&lon=-38.5108&nome=Salvador&estado=Bahia&pais=Brasil`

### 2. `GET /api/historico`
Retorna as últimas 5 cidades consultadas com sucesso.

### 3. `GET /api/comparar`
Compara os dados meteorológicos de duas cidades:
`/api/comparar?cidadeA=Salvador&cidadeB=Lisboa`

### 4. `GET /api/saude`
Health check do sistema e status de cada microsserviço.

---

## 🧪 Exemplos de Chamadas (`curl`)

### Status 200 (Sucesso - Cidade Única)
```bash
curl -X GET "http://localhost:3000/api/clima?cidade=Salvador"
```

### Status 200 (Homônimas - Seleção Necessária)
```bash
curl -X GET "http://localhost:3000/api/clima?cidade=Santa%20Cruz"
```

### Status 400 (Parâmetro Inválido / Fora dos Limites)
```bash
curl -X GET "http://localhost:3000/api/clima?cidade=a"
```

### Status 404 (Cidade Não Encontrada)
```bash
curl -X GET "http://localhost:3000/api/clima?cidade=Xyzabcqwerty"
```

### Status 502 (Falha Externa ou Microsserviço Desligado)
Para testar, interrompa o microsserviço de meteorologia (porta 3002) e execute:
```bash
curl -X GET "http://localhost:3000/api/clima?cidade=Salvador"
```

---

## 🧪 Guia de Testes dos Casos de Uso (T01 a T14)

| # | Caso de Teste | Ação | Resultado Esperado |
|---|---|---|---|
| **T01** | Consultar Salvador | Digitar `Salvador` e clicar em Buscar | 200 OK, exibe Bahia/Brasil, UV, Vento, 5 dias e Gráfico. |
| **T02** | Três cidades BR | Consultar `São Paulo`, `Recife` e `Porto Alegre` | 200 OK para todas com dados completos. |
| **T03** | Cidade estrangeira | Consultar `Lisboa` ou `Tóquio` | 200 OK exibindo o país correspondente (Portugal/Japão). |
| **T04** | Campo vazio | Clicar em Buscar com o campo em branco | Erro 400 exibido no frontend sem chamar o backend. |
| **T05** | Nome < 2 caracteres | Digitar `a` e buscar | Mensagem de erro exigindo mínimo de 2 caracteres. |
| **T06** | Nome > 100 caracteres | Digitar texto com 101 caracteres e buscar | Mensagem de erro informando limite máximo de 100 caracteres. |
| **T07** | Cidade Inexistente | Buscar `Xyzabcqwerty` | Retorno 404 padronizado ("Não encontramos nenhuma cidade..."). |
| **T08** | Homônimas | Buscar `Santa Cruz` ou `Londres` | Retorna status `"escolha"` com a lista clicável de cidades. |
| **T09** | Microsserviço parado | Desligar a porta 3002 e buscar `Salvador` | Retorno 502 com mensagem de serviço indisponível. |
| **T10** | Timeout | Simular requisição lenta na API externa | Retorno 502 com código `TIMEOUT_EXTERNO` em até ~5 s. |
| **T11** | Botão Atualizar | Clicar em "🔄 Atualizar" no card principal | Atualiza o horário de observação via coordenadas sem refazer a busca por nome. |
| **T12** | Limite do histórico | Realizar 6 consultas de cidades distintas | O histórico exibe apenas as 5 cidades mais recentes. |
| **T13** | Comparar Cidades | Ir para aba "Comparar" e buscar `Salvador` × `Lisboa` | Exibe cards lado a lado e gráfico com 4 séries temporais. |
| **T14** | Consulta repetida | Consultar `Salvador` duas vezes seguidas | O histórico não adiciona registros duplicados. |
