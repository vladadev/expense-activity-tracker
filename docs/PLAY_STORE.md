# Izlazak na Google Play — pripremljeno i preostalo

Sve u ovom dokumentu izvedeno je iz onoga što aplikacija zaista radi, ne iz
šablona. Odgovori u odeljku "Bezbednost podataka" su provereni prema kodu —
ako se aplikacija promeni tako da prikuplja nešto drugo, ovaj dokument se
menja zajedno s njom.

---

## 1. Politika privatnosti na javnom linku

Play Console traži URL koji radi bez prijave. Stranica se generiše iz
`docs/PRIVACY.md`:

```
node docs/build-privacy.mjs
```

Rezultat je `docs/public/index.html`. Da bi bio javan:

1. Na GitHub-u otvori **Settings → Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main`, folder `/docs`
4. Sačuvaj i sačekaj minut

URL će biti oblika:
`https://<tvoj-github-nalog>.github.io/<ime-repozitorijuma>/public/`

Taj link ide u Play Console i u polje `extra.privacyPolicyUrl` u `app.json`,
da stoji i u samoj aplikaciji.

**Bitno:** posle svake izmene `PRIVACY.md` ponovo pokreni skriptu i commituj
oba fajla. Politika koja postoji u dve ručno održavane kopije se razilazi, a
ona koju ljudi zaista čitaju biće zastarela.

---

## 2. Bezbednost podataka (Data safety) — odgovori

Play traži da se ovo popuni tačno. Netačna prijava je razlog za uklanjanje
aplikacije, pa je svaka stavka ovde proverena u kodu.

### Prikuplja se

| Kategorija | Šta konkretno | Zašto | Obavezno? |
|---|---|---|---|
| Ime | Ime naloga | Prikazuje se partneru uz svaki unos | Da |
| Email adresa | Za prijavu | Prijava na nalog | Da |
| Ostali finansijski podaci | Troškovi, prihodi, štednja | Osnovna funkcija aplikacije | Da |
| Ostali korisnički sadržaj | Liste, obaveze, beleške, aktivnosti | Osnovna funkcija aplikacije | Ne |
| Identifikatori uređaja | Expo push token | Slanje obaveštenja na telefon | Ne |
| Izveštaji o padovima | Greška i mesto u kodu | Otkrivanje kvarova | Ne |

### Ne prikuplja se

Lokacija · kontakti · fotografije i video · zvuk · zdravstveni podaci ·
istorija pretrage · reklamni identifikatori · podaci o korišćenju drugih
aplikacija.

### Ostali odgovori

- **Deli li se sa trećim licima?** Ne. Podaci prolaze kroz Render i MongoDB
  Atlas kao obrađivače, što nije deljenje u smislu Play definicije.
- **Šifruje se u prenosu?** Da — sve preko HTTPS-a.
- **Može li korisnik da zatraži brisanje?** Da, na
  `vladimir.business0@gmail.com`, uz odgovor u roku od 30 dana.
- **Lozinke** se čuvaju kao bcrypt heš i nikada u čitljivom obliku.

---

## 3. Opis za prodavnicu

**Kratak opis** (do 80 znakova):

```
Zajedničko praćenje troškova, planova i lista — za dvoje.
```

**Pun opis:**

```
Duo Tracker je aplikacija za dvoje ljudi koji vode zajedničko domaćinstvo.

Umesto da svako vodi svoju evidenciju, oba člana vide iste podatke u realnom
vremenu — i lične i zajedničke troškove, prihode, štednju, planove i liste.

ŠTA MOŽE

• Troškovi i prihodi — po osobi, po kategoriji, lični ili zajednički
• Statistika — mesečni i godišnji pregled, sa razdvajanjem po osobi
• Pretraga kroz celu istoriju — po nazivu, kategoriji ili iznosu
• Štednja — pojedinačna i zajednička, sa istorijom uloga i podizanja
• Kalendar — planovi i aktivnosti, sa podsetnicima
• Liste želja i obaveza — sa podfolderima, cenama i beleškama
• Obaveštenja kada partner nešto doda ili izmeni

MISLJENO ZA DVOJE

Domaćinstvo se pravi pozivnicom. Sve što jedno unese, drugo odmah vidi. Nema
odvojenih naloga koji se ručno usklađuju.

RADI I BEZ INTERNETA

Unosi napravljeni bez veze čekaju i šalju se čim se veza vrati. Podaci koji su
već učitani ostaju dostupni.

DISKRETNO

Jedan dodir sakriva sve iznose sa ekrana — kada aplikaciju pokazujete nekome
kome vaše finansije nisu namenjene.
```

---

## 4. Kategorizacija i uzrast

- **Kategorija:** Finansije (Finance)
- **Uzrast:** aplikacija nije namenjena osobama mlađim od 16, kao što stoji u
  politici privatnosti
- **Sadržaj:** nema reklama, nema kupovine unutar aplikacije, nema sadržaja
  koji podleže ograničenju
- **Ciljna grupa:** odrasli — u upitniku o ciljnoj grupi ne birati decu, jer to
  povlači dodatna pravila (Families policy)

---

## 5. Šta još treba, a nije napravljeno

- **Play Console nalog** — jednokratnih 25 USD, na tebi
- **Snimci ekrana** — najmanje 2, preporučeno 4–8, u rezoluciji telefona
- **Grafika za zaglavlje** (feature graphic) — 1024×500
- **Ikona za prodavnicu** — 512×512 PNG
- **Potpisivanje** — pri prvom slanju Play preuzima ključ (Play App Signing);
  EAS to obavlja sam
- **Zatvoreno testiranje** pre javnog izlaska — Play traži da aplikaciju neko
  vreme testira određen broj naloga

---

## 6. Komande

Build za prodavnicu (AAB, ne APK):

```
npx eas-cli build --platform android --profile production
```

Slanje u Play Console (posle prvog ručnog slanja i povezivanja naloga):

```
npx eas-cli submit --platform android --profile production
```

`production` profil već ima `autoIncrement`, pa se `versionCode` podiže sam pri
svakom build-u — Play odbija dva slanja sa istim brojem.
