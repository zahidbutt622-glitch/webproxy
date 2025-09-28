const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');

const app = express();
const PORT = process.env.PORT || 3000;

// Aggiungi plugin stealth per evitare rilevamento bot
puppeteer.use(StealthPlugin());

// Cache per browser instances
let browserInstance = null;

// Funzione per inizializzare browser con proxy
async function getBrowser() {
    if (!browserInstance) {
        const userAgent = new UserAgent({ deviceCategory: 'desktop' });
        
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ];

        // Configura proxy SOCKS5
        if (PROXY_CONFIG.protocol === 'socks5') {
            args.push(`--proxy-server=socks5://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
        } else {
            args.push(`--proxy-server=http://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
        }

        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: args,
            ignoreDefaultArgs: ['--disable-extensions'],
            defaultViewport: {
                width: 1366,
                height: 768,
                deviceScaleFactor: 1,
                hasTouch: false,
                isLandscape: true,
                isMobile: false,
            }
        });
    }
    return browserInstance;
}

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

// Endpoint per proxy con Puppeteer stealth
app.use('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    let page = null;
    
    try {
        console.log('Proxying request to:', targetUrl);
        console.log('Using proxy protocol:', PROXY_CONFIG.protocol);
        
        const browser = await getBrowser();
        page = await browser.newPage();
        
        // Configura credenziali proxy
        if (PROXY_CONFIG.username && PROXY_CONFIG.password) {
            await page.authenticate({
                username: PROXY_CONFIG.username,
                password: PROXY_CONFIG.password
            });
        }
        
        // Imposta User-Agent specifico (o usa quello generato)
        const customUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
        await page.setUserAgent(customUserAgent);
        
        // Imposta viewport realistico
        await page.setViewport({
            width: 1366,
            height: 768,
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: true,
            isMobile: false,
        });
        
        // Aggiungi header realistici
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
        });
        
        // Simula comportamento umano
        await page.evaluateOnNewDocument(() => {
            // Rimuovi webdriver traces
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // Mock languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        });
        
        // Naviga alla pagina
        await page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Aspetta un po' per simulare comportamento umano
        await page.waitForTimeout(1000 + Math.random() * 2000);
        
        // Ottieni il contenuto HTML
        let content = await page.content();
        
        // Riscrive i link per farli passare attraverso il proxy
        const targetHost = new URL(targetUrl).hostname;
        
        // Riscrive tutti i link assoluti
        content = content.replace(
            /href=["'](https?:\/\/[^"']+)["']/gi,
            (match, url) => {
                if (url.includes(targetHost)) {
                    return `href="/proxy?url=${encodeURIComponent(url)}"`;
                }
                return match;
            }
        );
        
        // Riscrive link relativi
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
        
        // Imposta header di risposta
        res.set({
            'Content-Type': 'text/html; charset=utf-8',
            'X-Frame-Options': 'ALLOWALL',
            'Cache-Control': 'no-cache'
        });
        
        console.log('Proxy request successful with Puppeteer');
        res.send(content);
        
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ 
            error: 'Proxy error occurred', 
            message: error.message,
            url: targetUrl 
        });
    } finally {
        if (page) {
            await page.close();
        }
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
        stealth_mode: 'Puppeteer + Stealth Plugin',
        browser: 'Chrome Headless (Anti-Detection)'
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
