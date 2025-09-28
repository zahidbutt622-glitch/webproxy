const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const UserAgent = require('user-agents');

// Cache per cookie e sessioni per sembrare più realistico
const cookieJar = new Map();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione proxy
const PROXY_CONFIG = {
    host: '193.228.193.86',
    port: 12321,
    username: 'lJN6oWkG3FBUq1GO',
    password: '0199382_country-pl_session-CBY0gFXR_lifetime-2h_streaming-1_skipispstatic-1_direct-1',
    protocol: 'socks5' // Cambia in 'http' se vuoi usare HTTP proxy
};

// Middleware di sicurezza
app.use(helmet({
    contentSecurityPolicy: false, // Disabilitato per permettere proxy
    crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servi file statici
app.use(express.static(__dirname));

// Endpoint principale
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    console.log('Serving index.html from:', indexPath);
    res.sendFile(indexPath);
});

// Endpoint per proxy trasparente (usa header del browser dell'utente)
app.use('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    try {
        console.log('Proxying request to:', targetUrl);
        console.log('Using proxy protocol:', PROXY_CONFIG.protocol);
        console.log('User-Agent from browser:', req.headers['user-agent']);
        
        // Configura proxy agent in base al protocollo
        let agent;
        if (PROXY_CONFIG.protocol === 'socks5') {
            const proxyUrl = `socks5://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
            agent = new SocksProxyAgent(proxyUrl, {
                timeout: 30000,
                keepAlive: true,
                keepAliveMsecs: 30000,
                maxSockets: 50,
                maxFreeSockets: 10
            });
        } else {
            const proxyUrl = `http://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
            agent = new HttpsProxyAgent(proxyUrl, {
                timeout: 30000,
                keepAlive: true,
                keepAliveMsecs: 30000,
                maxSockets: 50,
                maxFreeSockets: 10
            });
        }
        
        // Usa gli header del browser dell'utente (molto più realistico!)
        const userHeaders = { ...req.headers };
        
        // Rimuovi header che potrebbero causare problemi
        delete userHeaders['host'];
        delete userHeaders['connection'];
        delete userHeaders['upgrade'];
        delete userHeaders['proxy-connection'];
        
        // Aggiungi/modifica header necessari
        userHeaders['Connection'] = 'keep-alive';
        userHeaders['Cache-Control'] = 'max-age=0';
        
        // Gestisci cookie per future richieste
        const targetHost = new URL(targetUrl).hostname;
        const existingCookies = cookieJar.get(targetHost) || '';
        if (existingCookies) {
            userHeaders['Cookie'] = existingCookies;
        }
        
        // Fai la richiesta tramite proxy con header del browser reale
        const response = await axios.get(targetUrl, {
            httpsAgent: agent,
            httpAgent: agent,
            timeout: 30000,
            headers: userHeaders,
            maxRedirects: 10,
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Accetta redirect
            },
            maxContentLength: 50 * 1024 * 1024, // 50MB
            maxBodyLength: 50 * 1024 * 1024, // 50MB
            decompress: true,
            responseType: 'text'
        });
        
        // Salva cookie per future richieste
        if (response.headers['set-cookie']) {
            const cookies = response.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
            cookieJar.set(targetHost, cookies);
        }
        
        // Imposta header di risposta
        res.set({
            'Content-Type': response.headers['content-type'] || 'text/html; charset=utf-8',
            'X-Frame-Options': 'ALLOWALL',
            'Cache-Control': 'no-cache'
        });
        
        // Se è HTML, riscrivi i link per farli passare attraverso il proxy
        let content = response.data;
        if (response.headers['content-type'] && response.headers['content-type'].includes('text/html')) {
            const targetHost = new URL(targetUrl).hostname;
            
            // Riscrive tutti i link assoluti per farli passare attraverso il proxy
            content = content.replace(
                /href=["'](https?:\/\/[^"']+)["']/gi,
                (match, url) => {
                    if (url.includes(targetHost)) {
                        return `href="/proxy?url=${encodeURIComponent(url)}"`;
                    }
                    return match;
                }
            );
            
            // Riscrive anche i link relativi
            content = content.replace(
                /href=["'](\/[^"']*)["']/gi,
                (match, path) => {
                    const fullUrl = `${new URL(targetUrl).protocol}//${targetHost}${path}`;
                    return `href="/proxy?url=${encodeURIComponent(fullUrl)}"`;
                }
            );
            
            // Riscrive JavaScript redirects
            content = content.replace(
                /window\.location\.href\s*=\s*["']([^"']+)["']/gi,
                (match, url) => {
                    if (url.startsWith('http')) {
                        return `window.location.href = "/proxy?url=${encodeURIComponent(url)}"`;
                    } else if (url.startsWith('/')) {
                        const fullUrl = `${new URL(targetUrl).protocol}//${targetHost}${url}`;
                        return `window.location.href = "/proxy?url=${encodeURIComponent(fullUrl)}"`;
                    }
                    return match;
                }
            );
        }
        
        console.log('Proxy request successful with real browser headers');
        res.send(content);
        
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ 
            error: 'Proxy error occurred', 
            message: error.message,
            url: targetUrl 
        });
    }
});

// Endpoint per ottenere informazioni proxy
app.get('/proxy-info', (req, res) => {
    res.json({
        status: 'active',
        server: `${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`,
        username: PROXY_CONFIG.username,
        protocol: PROXY_CONFIG.protocol.toUpperCase(),
        country: 'Poland (PL)',
        stealth_mode: 'Transparent Proxy - Real Browser Headers',
        browser: 'Uses actual user browser headers'
    });
});

// Gestione errori 404
app.use((req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    console.log('404 - Serving index.html from:', indexPath);
    try {
        res.status(404).sendFile(indexPath);
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`WebProxy server running on port ${PORT}`);
    console.log(`Proxy configured: ${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
});
