# Backup i vraćanje podataka

Dva nezavisna sloja, po pravilu 3-2-1 (tri kopije, dva medija, jedna van lokacije):

| Sloj | Gde živi | Kada se pokreće | Čemu služi |
|---|---|---|---|
| **Noćni backup u oblak** (primarni) | Cloudflare R2 | svake noći u 02:00 UTC, automatski | Radi bez tvog računara. Ovo je pravi backup. |
| **Lokalni dump** (pomoćni) | `backend/backups/` | ručno, `npm run backup` | Brza kopija pre rizične izmene. |

Baza na Atlas M0 (besplatni tier) **nema sopstveni backup** — zato ovo postoji.
Kad pređeš na plaćeni tier (M2 i naviše) dobijaš i Atlas snimke, pa imaš tri sloja.

---

## Lokalni backup

```bash
cd backend
npm run backup            # -> backend/backups/<datum_vreme>/
npm run backup -- D:/put  # -> D:/put/<datum_vreme>/
```

Čuva poslednjih 30 kopija, starije briše. Folder je u `.gitignore` — sadrži
hešove lozinki i ne sme na GitHub.

## Provera backupa (uradi ovo povremeno)

Backup koji nikad nisi otvorio je pretpostavka, ne rezerva. Ova komanda
dešifruje arhivu, raspakuje je, proveri da nijedan fajl nije oštećen i uporedi
brojeve zapisa sa živom bazom — a ništa ne upisuje:

```bash
cd backend
npm run verify:backup -- "C:/putanja/do/backup-2026-08-01_18-48-57.tar.gz.gpg"
```

Traži lozinku, pa ispiše izveštaj. Na kraju mora da piše **VERIFIED**.
Preporuka: uradi ovo jednom mesečno i posle svake promene lozinke.

## Vraćanje podataka

```bash
cd backend
npm run restore -- ./backups/2026-07-25_18-26-38
```

Traži da otkucaš `RESTORE` kao potvrdu, jer **briše i zamenjuje** kolekcije
koje postoje u backupu.

Za backup iz oblaka prvo skini i dešifruj arhivu:

```bash
aws s3 cp s3://<bucket>/backup-<datum>.tar.gz.gpg . --endpoint-url <R2_ENDPOINT>
gpg --decrypt --output backup.tar.gz backup-<datum>.tar.gz.gpg
mkdir vraceno && tar -xzf backup.tar.gz -C vraceno
cd backend && npm run restore -- ../vraceno
```

---

## Postavljanje noćnog backupa (jednokratno)

### 1. Napravi Cloudflare R2 bucket

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → *Create bucket*
   (ime npr. `expense-tracker-backups`). Prvih 10 GB je besplatno.
2. **Manage R2 API Tokens** → *Create API token* → dozvola **Object Read & Write**,
   ograniči ga na taj jedan bucket.
3. Zapiši: `Access Key ID`, `Secret Access Key` i `endpoint`
   (oblika `https://<account_id>.r2.cloudflarestorage.com`).

### 2. Smisli lozinku za šifrovanje

Dugačka, nasumična. **Zapiši je u menadžer lozinki** — bez nje se backup
ne može otvoriti, ni od strane nekoga ko provali u bucket, ni od tebe.

### 3. Unesi tajne na GitHub

Repo → *Settings* → *Secrets and variables* → *Actions* → **New repository secret**:

| Ime | Vrednost |
|---|---|
| `MONGODB_URI` | isti connection string kao u `backend/.env` |
| `BACKUP_PASSPHRASE` | lozinka iz koraka 2 |
| `R2_ACCESS_KEY_ID` | iz koraka 1 |
| `R2_SECRET_ACCESS_KEY` | iz koraka 1 |
| `R2_ENDPOINT` | iz koraka 1 |
| `R2_BUCKET` | ime bucketa |

### 4. Dozvoli pristup iz GitHub Actions

Atlas → **Network Access** → dodaj `0.0.0.0/0`, ili (bezbednije) opseg
GitHub runnera. Bez ovoga se workflow ne može povezati na bazu.

### 5. Probaj

Repo → *Actions* → **Nightly database backup** → *Run workflow*.
Zeleno = radi. Proveri da se fajl pojavio u R2 bucketu.

---

## Šta backup sadrži

Sve kolekcije kao JSON: `users` (sa hešovima lozinki), `expenses`, `events`,
`incomes`, `savings`, `wishlistitems`, `categories`, `auditlogs`, plus
`_manifest.json` sa brojem dokumenata po kolekciji.

Zato se arhiva **šifruje pre slanja** (AES-256) i zato lokalni folder nikad
ne ide na GitHub.
