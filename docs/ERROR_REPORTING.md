# Praćenje grešaka (Sentry)

Dva odvojena Sentry projekta, jer su greške različite prirode:

| Projekat | Šta hvata |
|---|---|
| `node-express` | Greške servera (Render) — 500, pad cron-a, neuhvaćene greške |
| `expense-tracker-app` | Padovi aplikacije na telefonu |

## Šta se NE šalje

Aplikacija drži plate i troškove, a Sentry je tuđi server. Pre slanja se briše:

- lozinke, tokeni, JWT, push tokeni
- **iznosi, opisi, nazivi** (troškovi, prihodi, štednja)
- email adrese i imena
- tela zahteva u celini

Ostaje samo: greška, gde se desila, ruta, i neproziran ID korisnika.

Zaštita je u dva sloja — `dataCollection` na nivou biblioteke i `beforeSend`
funkcija koja ručno čisti sve što prođe.

## Šta se automatski prijavljuje iz aplikacije

`src/api/client.js` ima presretač koji šalje greške **svih** API poziva, bez
potrebe da se svaki ekran menja:

- **šalje se:** greške servera (5xx) i neočekivani odgovori
- **preskače se:** nema interneta, isteklo vreme, 401 (istekla sesija), 4xx

Bez ovoga bi se greške tiho gubile u `console.log`, koji na telefonu ne
postoji.

## Source maps (trenutno isključeni)

Bez njih pad izgleda kao `a.b is not a function at 1:45892` umesto prave
linije koda. Slanje mapa traži token, a ako token nedostaje **ceo build puca**
— zato je isključeno u `eas.json` (`SENTRY_DISABLE_AUTO_UPLOAD: "true"`).

Da se uključi:

1. Sentry → **Settings → Auth Tokens → Create New Token**, opseg `project:releases`
2. ```bash
   cd mobile
   npx eas-cli secret:create --name SENTRY_AUTH_TOKEN --value <token>
   ```
3. U `eas.json` promeni `SENTRY_DISABLE_AUTO_UPLOAD` na `"false"` u oba profila
4. Novi build

Proveri i da se `organization` i `project` u `app.json` poklapaju sa Sentry-jem.

## Podešavanje na serveru

Render → **Environment** → `SENTRY_DSN`. Ako nije postavljen, aplikacija radi
normalno, samo bez izveštavanja — u logu piše `Sentry: not configured`.
