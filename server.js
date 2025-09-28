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

// Endpoint per proxy con richieste realistiche
app.use('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    try {
        console.log('Proxying request to:', targetUrl);
        console.log('Using proxy protocol:', PROXY_CONFIG.protocol);
        
        // Configura proxy agent in base al protocollo con opzioni realistiche
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
        
        // Genera User-Agent realistico
        const userAgent = new UserAgent({ deviceCategory: 'desktop' });
        
        // Header HTTP ultra-realistici (identici a Chrome reale con tutti i dettagli)
        const realisticHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8,es;q=0.7,fr;q=0.6',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="136", "Chromium";v="136"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua-platform-version': '"15.0.0"',
            'sec-ch-ua-arch': '"x86"',
            'sec-ch-ua-bitness': '"64"',
            'sec-ch-ua-model': '""',
            'sec-ch-ua-full-version-list': '"Not A(Brand";v="99.0.0.0", "Google Chrome";v="136.0.6776.85", "Chromium";v="136.0.6776.85"',
            'sec-ch-prefers-color-scheme': 'light',
            'sec-ch-ua-wow64': '?0',
            'Referer': 'https://www.google.com/',
            'Origin': 'https://www.google.com'
        };
        
        // Simula comportamento umano con delay casuale
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        
        // Gestisci cookie per sembrare più realistico
        const targetHost = new URL(targetUrl).hostname;
        const existingCookies = cookieJar.get(targetHost) || '';
        if (existingCookies) {
            realisticHeaders['Cookie'] = existingCookies;
        }
        
        // Fai la richiesta tramite proxy con header realistici
        const response = await axios.get(targetUrl, {
            httpsAgent: agent,
            httpAgent: agent,
            timeout: 30000,
            headers: realisticHeaders,
            maxRedirects: 10,
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Accetta redirect
            },
            // Configurazioni per sembrare più realistico
            maxContentLength: 50 * 1024 * 1024, // 50MB
            maxBodyLength: 50 * 1024 * 1024, // 50MB
            decompress: true, // Decompressione automatica
            responseType: 'text', // Forza text per HTML
            transformResponse: [(data) => data] // Non trasformare automaticamente
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
        
        console.log('Proxy request successful');
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
        stealth_mode: 'Realistic HTTP Headers',
        browser: 'Chrome 136 User-Agent'
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
