# Import Skabeloner

Denne mappe indeholder skabeloner til import af vine.

## CSV Skabelon

`vinlager_skabelon.csv` indeholder 65 realistiske vine med alle felter udfyldt.

### Format

- **Separator:** Semikolon (`;`)
- **Encoding:** UTF-8
- **Header:** Første række indeholder kolonne navne

### Felter

Alle felter skal matche datamodellen:
- `vinId` - Unik ID (fx VIN-0001)
- `varenummer` - Varenummer
- `navn` - Vinnavn
- `type` - Type (Rødvin, Hvidvin, etc.)
- `kategori` - Kategori (samme som type typisk)
- `land` - Land
- `region` - Region
- `drue` - Drue sort
- `årgang` - Årgang (tal)
- `reol` - Reol (A, B, C, etc.)
- `hylde` - Hylde (1, 2, 3, etc.)
- `antal` - Antal flasker (tal)
- `minAntal` - Minimum antal (tal)
- `indkøbspris` - Pris i kr. (decimal, fx 1250.00)

## Excel Skabelon

### Opret Excel fra CSV

1. Åbn `vinlager_skabelon.csv` i Excel
2. Excel vil automatisk bruge semikolon som separator
3. Gem som `.xlsx` fil
4. Brug denne fil til import

### Eller brug CSV direkte

CSV filer kan også importeres direkte i systemet - de konverteres automatisk.

## Brug af Skabelon

1. Åbn skabelonen i Excel eller tekst editor
2. Erstat eksempel data med dine egne vine
3. Behold header-rækken
4. Brug samme format (semikolon separator)
5. Import via "Import" siden i systemet

## Tips

- **vinId:** Skal være unik. Hvis tomt, genereres automatisk
- **Antal:** Brug tal (fx 24, ikke "24 stk")
- **Pris:** Brug punktum som decimal separator (fx 1250.50)
- **Årgang:** Kun tal (fx 2019, ikke "2019 årgang")
