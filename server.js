const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

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
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint per proxy
app.use('/proxy', createProxyMiddleware({
    target: 'http://httpbin.org/ip', // Target di default, verrà sovrascritto
    changeOrigin: true,
    pathRewrite: {
        '^/proxy': ''
    },
    onProxyReq: (proxyReq, req, res) => {
        // Configura proxy HTTP
        proxyReq.setHeader('Proxy-Authorization', 
            'Basic ' + Buffer.from(`${PROXY_CONFIG.username}:${PROXY_CONFIG.password}`).toString('base64')
        );
        
        // Estrai URL target dal query parameter
        const targetUrl = req.query.url;
        if (targetUrl) {
            try {
                const url = new URL(targetUrl);
                proxyReq.path = url.pathname + url.search;
                proxyReq.setHeader('Host', url.hostname);
                proxyReq.setHeader('X-Forwarded-Proto', url.protocol.slice(0, -1));
            } catch (error) {
                console.error('Invalid URL:', error);
                res.status(400).json({ error: 'Invalid URL' });
                return;
            }
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        // Rimuovi header che potrebbero causare problemi
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];
        
        // Aggiungi header per permettere embedding
        proxyRes.headers['X-Frame-Options'] = 'ALLOWALL';
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Proxy error occurred' });
    }
}));

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
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`WebProxy server running on port ${PORT}`);
    console.log(`Proxy configured: ${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
});
