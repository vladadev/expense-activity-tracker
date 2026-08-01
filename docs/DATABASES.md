# Baze podataka — produkcija i razvoj

Dve baze na **istom Atlas klasteru** (bez dodatnog troška), razlikuje ih samo ime:

| Baza | Ko je koristi | Kada |
|---|---|---|
| `expense-tracker` | Render (produkcija), aplikacija na telefonima | uvek |
| `expense-tracker-dev` | lokalni razvoj i testovi | `NODE_ENV=development` ili `test` |

Zašto: dok ovoga nije bilo, svaki test se izvršavao nad pravim podacima —
jedna greška u `deleteMany` upitu i podaci odlaze. Sada je to nemoguće,
jer testovi ni ne vide produkcijsku bazu.

---

## Pokretanje

```bash
cd backend
npm run dev            # razvojna baza (expense-tracker-dev) — koristi ovo
npm run dev:prod-db    # PRAVA baza — samo kad zaista moraš
```

Pri pokretanju se u konzoli ispiše na koju je bazu povezan:

```
MongoDB connected — database "expense-tracker-dev" (development)
```

Ako u `development` režimu ime baze ne završava na `-dev`, ispisuje se
glasno upozorenje. Uvek proveri tu liniju pre nego što nešto brišeš.

## Kako radi

`src/config/db.js` bira URI po `NODE_ENV`:

1. `MONGODB_URI_DEV` ako je postavljen u `.env`
2. inače automatski dodaje `-dev` na ime baze iz `MONGODB_URI`

Znači ništa ne moraš da podešavaš — radi samo od sebe.

## Osvežavanje razvojne baze pravim podacima

Kad ti zatreba realan skup podataka za testiranje:

```bash
cd backend
npm run backup                                   # sveža kopija produkcije
npm run restore -- ./backups/<datum> --to=<dev-uri>
```

Traži da otkucaš ime ciljne baze, pa se ne može omaškom pogoditi produkcija.

## Vraćanje iz šifrovanog backupa

`restore` prima i `.tar.gz.gpg` arhivu direktno — sam je dešifruje i raspakuje:

```bash
npm run restore -- "C:/Users/vladi/Downloads/backup-2026-08-01.tar.gz.gpg"
```

Bez `--to=`, cilj je baza iz `MONGODB_URI` (**produkcija**). Zato prvo ispiše
ime baze i hosta i traži da otkucaš ime baze da bi nastavio.
