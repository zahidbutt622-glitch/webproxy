# WebProxy

Una webapp semplice per navigare anonimamente utilizzando proxy dedicati.

## Caratteristiche

- ✅ Navigazione anonima tramite proxy
- ✅ Interfaccia utente semplice e moderna
- ✅ Nessuna registrazione richiesta
- ✅ Supporto per tutti i siti web
- ✅ Deploy automatico su Render

## Installazione Locale

```bash
# Clona il repository
git clone <your-repo-url>
cd webproxy

# Installa le dipendenze
npm install

# Avvia il server
npm start
```

L'app sarà disponibile su `http://localhost:3000`

## Deploy su Render

1. Collega il repository GitHub a Render
2. Render rileverà automaticamente il file `render.yaml`
3. Il deploy avverrà automaticamente

## Configurazione Proxy

I proxy sono configurati nel file `server.js` nella sezione `PROXY_CONFIG`.

## Tecnologie Utilizzate

- Node.js + Express
- http-proxy-middleware
- HTML/CSS/JavaScript vanilla
- Render per il deploy
