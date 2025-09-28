const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione proxy
const PROXY_CONFIG = {
    host: '167.235.26.46',
    port: 12321,
    username: 'lJN6oWkG3FBUq1GO',
    password: '0199382_country-es_session-2j46VtlF_lifetime-24h_streaming-1_skipispstatic-1_direct-1'
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

// Endpoint per proxy
app.use('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    try {
        console.log('Proxying request to:', targetUrl);
        
        // Configura proxy agent
        const proxyUrl = `http://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
        const agent = new HttpsProxyAgent(proxyUrl);
        
        // Fai la richiesta tramite proxy
        const response = await axios.get(targetUrl, {
            httpsAgent: agent,
            httpAgent: agent,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // Imposta gli header della risposta
        res.set({
            'Content-Type': response.headers['content-type'] || 'text/html',
            'X-Frame-Options': 'ALLOWALL'
        });
        
        // Rimuovi header problematici
        delete response.headers['x-frame-options'];
        delete response.headers['content-security-policy'];
        
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
            
            // Riscrive i link in JavaScript (onclick, etc.)
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
        username: PROXY_CONFIG.username
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
