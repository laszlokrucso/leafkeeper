# LeafKeeper

Magyar nyelvű, iPhone-ra tervezett növénynapló. React + TypeScript + Vite; GitHub Pages felület, Supabase Auth, PostgreSQL, privát Storage és Edge Function.

## Fejlesztés

Node.js 22.13 vagy újabb:

```sh
npm ci
npm run dev
npm test
npm run build
```

A Vite alapútvonala `/leafkeeper/`. Más címhez a build során állítsd a `BASE_PATH` változót. A publikus Supabase URL és publishable kulcs a `src/lib/supabase.ts` fájlban szerepel. Ezek kliensoldali adatok; a személyes rekordokat az adatbázis RLS-szabályai védik.

## Telepítés

A `.github/workflows/pages.yml` a main ág frissítésekor tesztel, buildel és GitHub Pages-re telepít. A repository Settings → Pages oldalán a Source legyen GitHub Actions. A repository láthatósága és a Pages elérhetősége a GitHub csomagtól függ.

Az adatbázis és a privát képtár a meglévő Supabase-projektben marad. Új projektben a `supabase/setup.sql` létrehozza őket. Az Auth URL Configuration alatt a Pages teljes címét (a `/leafkeeper/` útvonallal együtt) engedélyezd, és állítsd be Site URL-ként.

Az `supabase/functions/plant-search` függvényt Supabase-re kell telepíteni. A függvény érvényes felhasználói JWT-t kér, szerveroldalon is ellenőrzi a fiókot, és kizárólag nyilvános fajadatokat keres. A CORS az app originjére korlátozott. Az OpenPlantbook titkok a Supabase Edge Function Secrets beállításába kerülnek:

- `OPENPLANTBOOK_CLIENT_ID`
- `OPENPLANTBOOK_CLIENT_SECRET`

Titkot soha ne írj a frontendbe, a GitHub repositoryba vagy a buildváltozók közé. A GitHub Actions csak a statikus felületet telepíti; az Edge Function külön verziózott backend.

## Funkciók

Növényfelvétel, saját fotók, helyek, gondozási tervek, napi ellenőrzési lista, két napos halasztás, ültetés és átültetés, öntözés és tápoldatozás, metszés, szaporítás, kezelés és megfigyelés. Több növény egyszerre naplózható. A kombinált öntözés–tápoldatozás egy adatbázis-tranzakció; a visszadátumozás a legutóbbi tényleges gondozásból számol. JSON-export elérhető; a fotófájlok exportja, push értesítések és teljes offline szinkron későbbi fejlesztés.

A bemutató kert böngészőben tárolt mintaadat, a személyes felhős gyűjteménytől elkülönítve. A régi tárhelyen tárolt felhőadatok azonos Supabase-fiókkal belépve elérhetők; a régi domain bemutatóadatai és munkamenete nem költöznek át automatikusan.

## Képek

A bemutató stockfotói az Unsplash oldaláról származnak; nem a felhasználó saját növényfotói.

- feey: https://unsplash.com/photos/a-lush-green-monstera-plant-in-a-cream-pot-HRLvEf3gna8
- Esra Afşar: https://unsplash.com/photos/monstera-adansonii-plant-with-large-perforated-leaves-0O7NXDDENes
- feey: https://unsplash.com/photos/a-hand-holding-a-potted-plant-with-green-leaves-p9iWL601vts
- Hero: https://images.unsplash.com/photo-1501004318641-b39e6451bec6

## OpenPlantbook fajismeret

A növény adatlapján automatikusan betöltődnek a pontos tudományos névhez tartozó nyilvános fajadatok. Ha nincs pontos találat, szerkesztéskor a fajkeresőből választható ki a megfelelő rekord; annak azonosítója a növénnyel együtt mentődik. A kiválasztás után a szerkesztőben is látható az előnézet.

Megjelenik az elérhető hőmérséklet, megvilágítás, páratartalom, származás, köznév/szinonimák, valamint az `include=care` kategória fény-, öntözés-, talaj-, tápoldatozás- és metszésleírása. A szöveg a szolgáltató nyelvén marad. A hiányzó értékek nem alakulnak nullává, a talajszenzor-adatok és a forrásfotó külön lenyithatók. Az EC és talajnedvesség nem adagolási javaslat. A gondozási tervet nem írja felül az adatbázis.

A hitelesített `plant-search?pid=...` ugyanazt az OAuth read jogosultságot használja, mint a kereső. Csak nyilvános fajadatot ad vissza; a szolgáltatói fiók egyedi User Plant rekordjait elutasítja. A szerveren legfeljebb 100 nyilvános fajadatlap él 24 órás memóriagyorsítótárban. A képek hivatkozásként kerülnek lekérésre, nem saját fotóként mentődnek.

Meglévő adatbázis frissítése: a `supabase/setup.sql` végén szereplő ismételhető `openplantbook_pid` oszlophozzáadás.
