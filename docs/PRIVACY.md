# Politika privatnosti — Duo Tracker

**Poslednja izmena:** 3. avgust 2026.

> Ovaj dokument je izvor istine. Javna verzija koju vidi Play Store generiše se
> iz njega komandom `node docs/build-privacy.mjs` — posle svake izmene pokreni
> je i commituj oba fajla, da se dve verzije ne raziđu.

Duo Tracker je aplikacija za zajedničko praćenje troškova, prihoda, štednje i
planova unutar jednog domaćinstva. Ovaj dokument objašnjava koje podatke
prikupljamo, zašto, gde se čuvaju i koja su vaša prava.

Podaci koje unosite su **finansijski i lični**. Prema njima se odnosimo
u skladu s tim.

---

## 1. Ko je odgovoran za podatke

Aplikaciju razvija i održava pojedinac (Vladimir), i on je rukovalac podacima
u smislu Opšte uredbe o zaštiti podataka (GDPR) i Zakona o zaštiti podataka
o ličnosti Republike Srbije.

**Kontakt:** vladimir.business0@gmail.com

---

## 2. Koje podatke prikupljamo

Prikupljamo **samo ono što sami unesete** u aplikaciju, plus najmanju
tehničku količinu potrebnu da aplikacija radi.

### Podaci naloga
| Podatak | Zašto |
|---|---|
| Ime | Prikazuje se partneru uz svaki vaš unos |
| Email adresa | Prijava na nalog |
| Lozinka | Čuva se **isključivo kao bcrypt heš** — originalna lozinka se nigde ne zapisuje i ne može se povratiti |

### Podaci koje unosite
Troškovi (iznos, valuta, kategorija, opis, datum), prihodi, štednja,
aktivnosti i planovi u kalendaru, podsetnici, liste želja i obaveza.

### Tehnički podaci
| Podatak | Zašto |
|---|---|
| Token za obaveštenja (Expo push token) | Slanje podsetnika i obaveštenja na telefon |
| Dnevnik aktivnosti | Ko je šta promenio u domaćinstvu — deo je transparentnosti između partnera |
| Izveštaji o greškama | Otkrivanje kvarova u aplikaciji (vidi tačku 4) |

**Ne prikupljamo:** lokaciju, kontakte, fotografije, sadržaj drugih
aplikacija, reklamne identifikatore. **Ne koristimo kolačiće za praćenje**
i **ne prodajemo podatke** — nikome, ni u kom obliku.

---

## 3. Ko još vidi vaše podatke

### Vaš partner u domaćinstvu
Aplikacija je namerno napravljena tako da **oba člana domaćinstva vide sve
unose** — i lične i zajedničke. To je njena svrha: potpuna finansijska
transparentnost između dvoje ljudi koji vode zajedničko domaćinstvo.

Pridruživanje domaćinstvu je uvek dobrovoljno, preko koda koji vam partner
pošalje. Niko vas ne može dodati bez vaše radnje.

### Druga domaćinstva
**Nikada.** Svaki zapis pripada tačno jednom domaćinstvu, a svaki upit ka
bazi je ograničen na domaćinstvo korisnika koji ga postavlja.

---

## 4. Servisi koje koristimo

Da bi aplikacija radila, podaci prolaze kroz nekoliko servisa. Svaki od njih
ima svoju politiku privatnosti i ugovorne obaveze zaštite podataka.

| Servis | Šta radi | Šta vidi |
|---|---|---|
| **MongoDB Atlas** (EU) | Baza podataka | Sve vaše unose |
| **Render** (EU) | Server aplikacije | Podatke u prolazu kroz zahteve |
| **Cloudflare R2** | Noćne rezervne kopije | Samo **šifrovanu** arhivu (AES-256) — sadržaj im nije čitljiv |
| **Sentry** (EU) | Prijava grešaka | **Ne vidi finansijske podatke** — iznosi, opisi, imena, email adrese, lozinke i tokeni se uklanjaju pre slanja. Šalje se samo tekst greške i mesto u kodu |
| **Expo / Firebase** | Isporuka obaveštenja | Token uređaja i tekst obaveštenja (npr. „Novi trošak: 1.200 RSD") |

Obaveštenja koja stižu na zaključan ekran mogu sadržati iznos i naziv
kategorije. Ako to ne želite, isključite prikaz sadržaja obaveštenja u
podešavanjima telefona.

---

## 5. Koliko dugo čuvamo podatke

| Podatak | Rok |
|---|---|
| Troškovi, prihodi, štednja, planovi, liste | Dok ih sami ne obrišete |
| Dnevnik aktivnosti | **12 meseci**, pa se briše automatski |
| Rezervne kopije | **90 dana**, pa se brišu automatski |
| Nalog | Dok ne zatražite brisanje |

### Ako napustite domaćinstvo
Vaši unosi **ostaju domaćinstvu**. Razlog: troškovi su zajednička finansijska
istorija — brisanje vaših stavki bi retroaktivno iskrivilo sve prethodne
mesečne obračune osobi koja ostaje. Vi gubite pristup, ali podaci ostaju
tačni.

Ako želite da se i vaši lični podaci uklone, zatražite brisanje naloga
(tačka 6) — tada se ime i email brišu, a zapisi anonimiziraju.

---

## 6. Vaša prava

Prema GDPR-u imate pravo da:

- **zatražite kopiju** svih svojih podataka, u čitljivom formatu
- **ispravite** netačne podatke (sve je izmenjivo direktno u aplikaciji)
- **obrišete nalog** i lične podatke
- **povučete pristanak** i prestanete da koristite aplikaciju u bilo kom trenutku
- **uložite pritužbu** Povereniku za informacije od javnog značaja i zaštitu
  podataka o ličnosti

Zahtev pošaljite na **vladimir.business0@gmail.com**. Odgovaramo u roku od
30 dana.

---

## 7. Bezbednost

- Lozinke se čuvaju kao **bcrypt heš**, nikada u čitljivom obliku
- Sva komunikacija ide preko **HTTPS-a**
- Rezervne kopije su **šifrovane AES-256** pre napuštanja servera
- Prijava je zaštićena od napada pogađanjem lozinke (ograničen broj pokušaja)
- Podaci jednog domaćinstva su tehnički nedostupni drugom

Nijedan sistem nije apsolutno bezbedan. U slučaju povrede podataka koja
ugrožava vaša prava, obavestićemo vas i nadležni organ u roku od 72 sata.

---

## 8. Deca

Aplikacija nije namenjena osobama mlađim od 16 godina i svesno ne
prikupljamo njihove podatke.

---

## 9. Izmene ove politike

Ako se politika bitno promeni, obavestićemo vas kroz aplikaciju pre nego što
izmena stupi na snagu. Datum poslednje izmene je na vrhu dokumenta.

---

*Napomena: ovaj dokument je pisan za aplikaciju u ličnoj upotrebi. Pre
komercijalne objave na Google Play prodavnici preporučuje se pravna provera.*
