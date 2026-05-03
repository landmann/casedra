# Captación

## One-Line Pitch

Draw one barrio-sized boundary, get every residential asset inside it ranked by the largest individual residential unit Casedra can prove from official cadastral data, and export the list for high-ticket listing acquisition.

## User And Problem

Debbie is trying to localize and capture 5-6 million euro homes. The hard part is not knowing which apartment buildings and chalets actually contain the largest homes; portals surface active listings, not the underlying residential stock.

Captación solves that by turning Catastro data into a prospecting list:

- Input: a drawn barrio-sized polygon.
- Output: all residential buildings and chalets inside the boundary.
- Ranking: largest individual residential unit in each building, descending.
- Export: the complete ranked list, not only thresholded leads.

## Launch Contract

- Madrid is the first active market, but the product and server code must not hardcode Madrid. The UI may default the map viewport to Madrid.
- The boundary limit is one barrio-sized area. The current hard cap is `12 km2` and `80` polygon points.
- Include every residential asset: apartment buildings, single-family homes, and chalets.
- Only residential-use units count for the ranking metric.
- Customer-facing ranking must use exact individual residential-unit surface from official alphanumeric cadastral data.
- Building-level surface is allowed only as an internal degraded preview or diagnostic label; it must never be presented as "largest apartment" truth.
- No owner names, private phones, emails, or protected personal data are collected or inferred.

## Success Criteria

Launch is ready when all of these are true:

- A Madrid barrio-sized search returns every official residential building/chalet that intersects the boundary.
- `100%` of customer-facing ranked rows in the active Madrid launch area have an exact residential-unit surface match or are blocked from exact export with a clear operator warning.
- Results are sorted by exact largest residential unit m2, highest to lowest.
- CSV export includes every returned row and enough source fields for a broker to audit the result.
- Searches above the barrio limit fail before touching external services.
- Catastro outages, missing CAT index coverage, empty boundaries, and empty result sets all produce Spanish, non-technical states.
- No code path assumes Madrid as the only possible territory; new Iberian adapters can be added without changing the product flow.

## Product Flow

1. User opens `/app/localiza` and selects `Captación`.
2. User draws a barrio-sized polygon on the map.
3. The UI shows boundary point count and prevents submission until there are at least three points.
4. On submit, the server validates coordinates, point count, and area.
5. The territory registry routes the boundary to the active cadastral adapter.
6. The adapter fetches official buildings and addresses inside the bounding box, then filters geometry against the drawn polygon.
7. The residential-unit index joins exact unit surfaces by cadastral building reference.
8. The server returns rows ranked by largest exact residential unit m2.
9. The UI shows total rows, boundary area, ranking source, warnings, and the ranked table.
10. User exports the complete CSV.

## UX States

- Empty: Spanish copy says to draw a barrio-sized boundary on the map.
- Drawing: show point count, clear-boundary control, address/neighborhood search to recenter the map, and disabled search until the polygon is valid. Clicking an existing boundary point removes it.
- Loading: keep the map visible and show that Casedra is consulting official cadastral data.
- Success: show row count, area searched, exact coverage, export button, and ranked table.
- Empty result: say no residential assets were found inside the selected boundary; keep the boundary so the user can adjust it.
- Too large: say the boundary exceeds one barrio and ask the user to draw a smaller area.
- Unsupported territory: say this area is outside the active cadastral adapter and cannot be ranked yet.
- Catastro unavailable: say the official source did not respond and let the user retry without losing the boundary.
- Missing exact CAT index: block customer-facing exact export and show that building-level preview is diagnostic only.
- Accessibility: map interaction is primary, but the selected boundary points must also be listed with remove controls so keyboard users can recover from mistakes.

## Data Sources

Primary official sources:

- Dirección General del Catastro INSPIRE `BU` WFS for building geometry, official area, current use, dwelling count, and building-unit count.
- Dirección General del Catastro INSPIRE `AD` WFS for official address labels.
- Dirección General del Catastro alphanumeric CAT/descriptive files for exact residential-unit surface.

Coverage contract:

- National Catastro handles common-territory Spain.
- País Vasco and Navarra require their own cadastral adapters.
- Portugal, Andorra, and Gibraltar require their own cadastral or equivalent public-source adapters.
- The app may launch Madrid first, but adapter routing, result types, warnings, and export columns must be territory-neutral from day one.

## Data Model

Boundary input:

- `boundary: CaptacionBoundaryPoint[]`
- `lat` between `35` and `44.5`
- `lng` between `-10` and `4.5`
- minimum `3` points, maximum `80` points
- maximum area `12 km2`

Residential-unit index artifact:

- path: `data/captacion/catastro-residential-units.jsonl`
- generated from official alphanumeric cadastral files
- one JSON object per residential unit
- required fields: `buildingReference`, `unitReference`, `surfaceM2`, `use`, `sourceVersion`, `observedAt`
- optional fields: `cadastralReference`, `addressLabel`, `municipality`, `province`
- join key: normalized first `14` cadastral-reference characters for the building
- residential filter: only units whose official use is residential/vivienda

Ranked row:

- `rank`
- `cadastralReference`
- `addressLabel`
- `municipality`
- `province`
- `centroid`
- `largestResidentialUnitM2`
- `largestResidentialUnitReference`
- `officialBuildingAreaM2`
- `residentialUnitCount`
- `buildingUnitCount`
- `currentUse`
- `rankingSurfaceM2`
- `rankingSource`
- `rankingConfidence`
- `officialSource`
- `officialUrl`

CSV columns:

- rank
- direccion_oficial
- referencia_catastral
- unidad_residencial_mayor_m2
- referencia_unidad_mayor
- superficie_edificio_m2
- viviendas
- unidades
- uso
- municipio
- provincia
- latitud
- longitud
- fuente_ranking
- confianza_ranking
- fuente_oficial
- url_oficial

## Technical Plan

Current verified scaffolding:

- `apps/web/src/app/app/localiza/LocalizaResolverClient.tsx` has the Spanish `Captación` tab, Leaflet map, boundary drawing, mutation call, result table, warnings, and CSV export.
- The UI blocks CSV export unless the server reports complete exact CAT coverage; proxy rows are diagnostic only.
- `packages/api/src/routers/listings.ts` exposes protected `listings.rankCaptacionBuildings`.
- `packages/api/src/schema/listings.ts` validates the boundary shape and Iberian coordinate range.
- `packages/api/src/context.ts` and `apps/web/src/server/localiza/service.ts` wire the Localiza service method.
- `apps/web/src/server/localiza/captacion-catastro.ts` queries Catastro INSPIRE buildings/addresses, filters residential buildings by polygon, reads the optional residential-unit JSONL index, returns exact coverage metadata, and blocks commercial export when any row is missing exact unit surface.
- `apps/web/src/server/localiza/captacion-catastro.ts` routes through a territory adapter selector so common-territory Catastro is one adapter and regional unsupported areas fail clearly.
- `packages/types/src/index.ts` defines the shared Captación result types, including exact coverage, ranking confidence, adapter, and export-enabled state.
- `scripts/build-captacion-catastro-units.mjs` converts official fixed-width CAT files, including `.gz` downloads, into the JSONL residential-unit index using type `15` residential records.

Launch build work:

1. Obtain the official Madrid alphanumeric CAT download from Catastro.
2. Run `pnpm captacion:build-index -- --input <CAT file or folder> --territory madrid --source-version <official version>`.
3. Publish the generated `data/captacion/catastro-residential-units.jsonl` as the Madrid launch artifact.
4. Enable broker-facing export only after exact coverage is complete for the active Madrid boundary set.

## Ownership And Dependencies

- Product owner: Debbie for broker workflow validation.
- Engineering owner: Nathan for implementation and source-data integration.
- Launch dependency: current official Madrid alphanumeric cadastral data must be available before broker-facing exact ranking is enabled.
- Deadline: current build; there is no separate phase for exact ranking.
- Budget: no paid third-party data dependency is required for Madrid launch.
- Compliance dependency: exports and logs must contain official property/building data only, never owner or contact data.

## Failure Modes And Handling

- Boundary too large: reject synchronously with the barrio-limit message.
- Boundary outside supported coordinate range: reject synchronously with an invalid-area message.
- Catastro WFS timeout: fail the search with retry copy; preserve the boundary.
- Catastro returns too many features: fail with a smaller-boundary message instead of truncating silently.
- CAT index missing: block exact customer export; show diagnostic preview only.
- Partial CAT coverage: block customer-facing exact export, keep the full diagnostic table labeled as incomplete, and log missing building references for operator repair.
- Mixed-territory boundary: route to unsupported unless one adapter can authoritatively cover the full polygon.
- Duplicate building/address features: normalize by building cadastral reference before ranking.
- Malformed CAT rows: skip row, count parser errors, and fail the index build if error rate is non-zero for the launch artifact.
- Rollback: disable the Captación tab or adapter flag; no user data migration is required because searches are stateless.

## Observability

Track these events or structured logs:

- `captacion_search_started`: user/org, adapter, boundary area, point count.
- `captacion_search_completed`: duration, row count, exact row count, exact coverage, warning count.
- `captacion_search_failed`: adapter, failure code, duration, external source involved.
- `captacion_export_clicked`: row count, exact coverage, ranking source.
- `captacion_index_generated`: territory, source version, row count, parser version, error count.

Operational thresholds:

- P75 search under `12s` for Madrid barrio-sized boundaries.
- Exact coverage `100%` for customer-facing Madrid launch exports.
- Zero malformed CAT rows in the published Madrid index artifact.
- No protected personal data in logs or exports.

## Strategic Fit

This belongs in Localiza because it turns official cadastral data into a broker workflow, not a research report. The output directly supports high-value captación: where to prospect before a listing appears on a portal.

Why now:

- Debbie has a concrete broker use case.
- The current Localiza Catastro foundation already resolves official source data.
- Competitors and portals are listing-first; this is stock-first prospecting.

What this does not do:

- It does not value the property.
- It does not identify owners.
- It does not automate outreach.
- It does not scrape private listing portals for personal data.

## Rollout

- Internal operator launch: Madrid active adapter plus exact CAT index, behind the existing authenticated app surface.
- Broker-facing launch: enabled only after Madrid exact-export gate passes and Debbie validates a sample set manually.
- Iberian expansion: add adapters to the same territory registry and index contract; do not fork the UI or API per country/region.

## Verification

No dedicated test files are required for this repo. Use existing build checks and manual launch verification:

- Run the existing typecheck/lint path after implementation.
- Search a known Madrid barrio-sized polygon.
- Confirm returned rows are all residential assets.
- Confirm exact coverage is `100%` before customer-facing export is enabled.
- Confirm sorting by `largestResidentialUnitM2` descending.
- Confirm CSV includes all rows and the ranking/source/confidence columns.
- Confirm too-large, unsupported territory, Catastro timeout, empty result, and missing-index states.
- Confirm `/app/localiza` still works for the existing Localiza resolver flow.

## Acceptance Checklist

- `feat/localiza.md` points to this plan as the Captación contract.
- `/app/localiza` exposes `Captación` without adding another route.
- Server rejects boundaries above one barrio-sized area.
- Ranking uses exact individual residential-unit surface for customer-facing results.
- Apartment buildings and chalets are both included.
- Only residential-use units influence the ranking metric.
- Export contains every ranked residential asset in the boundary.
- Madrid is the first active market but no implementation path is Madrid-only.
- Unsupported Iberian territories fail clearly instead of guessing.
- Exact source, ranking confidence, and official URL are visible in product and CSV.
