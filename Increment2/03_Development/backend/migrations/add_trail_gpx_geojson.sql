-- Cache parsed GPX as GeoJSON to avoid parsing on every client page load.
ALTER TABLE trekking_trails
ADD COLUMN IF NOT EXISTS gpx_geojson JSONB;
