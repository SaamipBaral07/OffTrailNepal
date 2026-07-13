import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from "react-leaflet";
import { gpx as gpxToGeoJSON } from "@tmcw/togeojson";
import { lineString, point } from "@turf/helpers";
import { pointToLineDistance } from "@turf/point-to-line-distance";

const NEPAL_CENTER = [28.3949, 84.124];
const DEFAULT_ZOOM = 6;
const MIN_DISTANCE_KM = 1;
const MAX_DISTANCE_KM = 10;

const isValidCoordinate = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const FitToBounds = ({ bounds, shouldFit }) => {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (!shouldFit || !bounds || !bounds.isValid() || hasFitted.current) return;
    
    hasFitted.current = true;
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
  }, [shouldFit, bounds, map]);

  return null;
};

const FocusSelectedHomestay = ({ selectedHomestayId, homestaysWithDistance, markerRefs }) => {
  const map = useMap();

  useEffect(() => {
    if (!selectedHomestayId) return;

    const target = homestaysWithDistance.find(
      (stay) => String(stay.homestay_id) === String(selectedHomestayId)
    );
    if (!target) return;

    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });

    const marker = markerRefs.current[target.homestay_id];
    if (!marker) return;

    const timer = window.setTimeout(() => {
      marker.openPopup();
    }, 380);

    return () => window.clearTimeout(timer);
  }, [map, markerRefs, homestaysWithDistance, selectedHomestayId]);

  return null;
};

const extractRouteCoordinates = (featureCollection) => {
  const coords = [];

  for (const feature of featureCollection.features || []) {
    const geometry = feature?.geometry;
    if (!geometry) continue;

    if (geometry.type === "LineString") {
      for (const coordinate of geometry.coordinates) {
        if (Array.isArray(coordinate) && coordinate.length >= 2) {
          coords.push([coordinate[1], coordinate[0]]);
        }
      }
    }

    if (geometry.type === "MultiLineString") {
      for (const line of geometry.coordinates) {
        for (const coordinate of line) {
          if (Array.isArray(coordinate) && coordinate.length >= 2) {
            coords.push([coordinate[1], coordinate[0]]);
          }
        }
      }
    }
  }

  return coords.filter(([lat, lng]) => isValidCoordinate(lat, lng));
};

const TrailMap = ({
  trailName,
  gpxUrl,
  gpxGeojson = null,
  homestays = [],
  homestaysLoading = false,
  selectedHomestayId = null,
  distanceThresholdKm = 3,
  onDistanceThresholdChange,
  onHomestaySelect,
  onNearTrailHomestaysChange,
  onHomestayDistanceMapChange,
}) => {
  const [trailCoords, setTrailCoords] = useState([]);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const markerRefs = useRef({});

  const mappedHomestays = useMemo(
    () =>
      homestays
        .map((stay) => ({
          ...stay,
          lat: Number(stay.latitude),
          lng: Number(stay.longitude),
        }))
        .filter((stay) => isValidCoordinate(stay.lat, stay.lng)),
    [homestays]
  );

  useEffect(() => {
    let isMounted = true;

    const loadGpx = async () => {
      if (gpxGeojson) {
        try {
          const normalizedGeoJson =
            typeof gpxGeojson === "string" ? JSON.parse(gpxGeojson) : gpxGeojson;
          const extractedCoords = extractRouteCoordinates(normalizedGeoJson);

          if (!extractedCoords.length) {
            throw new Error("No route coordinates found in cached GPX data");
          }

          setTrailCoords(extractedCoords);
          setTrackError("");
          return;
        } catch (error) {
          setTrackError("Cached route data is invalid. Falling back to GPX file parsing.");
        }
      }

      if (!gpxUrl) {
        setTrailCoords([]);
        setTrackError("No GPX file available for this trail.");
        return;
      }

      setIsLoadingTrack(true);
      setTrackError("");

      try {
        const response = await fetch(gpxUrl);
        if (!response.ok) {
          throw new Error("Unable to load GPX file");
        }

        const gpxText = await response.text();
        const xmlDoc = new DOMParser().parseFromString(gpxText, "application/xml");
        const parsed = gpxToGeoJSON(xmlDoc);
        const extractedCoords = extractRouteCoordinates(parsed);

        if (!extractedCoords.length) {
          throw new Error("No route coordinates found in GPX");
        }

        if (isMounted) {
          setTrailCoords(extractedCoords);
          setTrackError("");
        }
      } catch (error) {
        if (isMounted) {
          setTrailCoords([]);
          setTrackError("Could not render GPX route. You can still download the GPX file.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingTrack(false);
        }
      }
    };

    loadGpx();

    return () => {
      isMounted = false;
    };
  }, [gpxGeojson, gpxUrl]);

  // Mark initial load complete once trail coords are loaded
  useEffect(() => {
    if (trailCoords.length > 0 && !initialLoadComplete) {
      setInitialLoadComplete(true);
    }
  }, [trailCoords, initialLoadComplete]);

  const trailLine = useMemo(() => {
    if (trailCoords.length < 2) return null;
    return lineString(trailCoords.map(([lat, lng]) => [lng, lat]));
  }, [trailCoords]);

  const homestaysWithDistance = useMemo(() => {
    return mappedHomestays.map((stay) => {
      if (!trailLine) {
        return {
          ...stay,
          distanceKm: null,
          isNearTrail: false,
        };
      }

      const distanceKm = pointToLineDistance(point([stay.lng, stay.lat]), trailLine, {
        units: "kilometers",
      });

      return {
        ...stay,
        distanceKm,
        isNearTrail: distanceKm <= distanceThresholdKm,
      };
    });
  }, [mappedHomestays, trailLine, distanceThresholdKm]);

  const nearTrailCount = useMemo(
    () => homestaysWithDistance.filter((stay) => stay.isNearTrail).length,
    [homestaysWithDistance]
  );

  useEffect(() => {
    if (!onNearTrailHomestaysChange) return;
    const nearIds = homestaysWithDistance
      .filter((stay) => stay.isNearTrail)
      .map((stay) => stay.homestay_id);
    onNearTrailHomestaysChange(nearIds);
  }, [homestaysWithDistance, onNearTrailHomestaysChange]);

  useEffect(() => {
    if (!onHomestayDistanceMapChange) return;
    const distanceMap = homestaysWithDistance.reduce((acc, stay) => {
      acc[stay.homestay_id] = stay.distanceKm;
      return acc;
    }, {});
    onHomestayDistanceMapChange(distanceMap);
  }, [homestaysWithDistance, onHomestayDistanceMapChange]);

  const mapBounds = useMemo(() => {
    const allPoints = [
      ...trailCoords,
      ...mappedHomestays.map((stay) => [stay.lat, stay.lng]),
    ];

    if (!allPoints.length) return null;
    return L.latLngBounds(allPoints);
  }, [trailCoords, mappedHomestays]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-stone-50/70">
        <h3 className="text-[17px] font-extrabold text-charcoal tracking-tight">Trail Map</h3>
        <p className="text-xs text-gray-500 mt-1">
          GPX route for {trailName} with mapped homestays nearby.
        </p>
      </div>

      {(isLoadingTrack || homestaysLoading) && (
        <div className="px-5 py-3 bg-blue-50/60 border-b border-blue-100 text-xs font-medium text-blue-700">
          Loading map data...
        </div>
      )}

      <div className="px-5 py-3 border-b border-gray-100 bg-white/80">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Near-trail radius</p>
          <p className="text-sm font-bold text-charcoal">{distanceThresholdKm} km</p>
        </div>
        <input
          type="range"
          min={MIN_DISTANCE_KM}
          max={MAX_DISTANCE_KM}
          step={1}
          value={distanceThresholdKm}
          onChange={(e) => onDistanceThresholdChange?.(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </div>

      {trackError && (
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-xs font-medium text-amber-700">
          {trackError}
        </div>
      )}

      <div className="h-[420px] w-full">
        <MapContainer
          center={NEPAL_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {trailCoords.length > 0 && (
            <Polyline
              positions={trailCoords}
              pathOptions={{ color: "#C8932A", weight: 4, opacity: 0.9 }}
            >
              <Popup>{trailName} trail route</Popup>
            </Polyline>
          )}

          {homestaysWithDistance.map((stay) => (
            <Fragment key={`group-${stay.homestay_id}`}>
              {selectedHomestayId === stay.homestay_id && (
                <CircleMarker
                  key={`pulse-${stay.homestay_id}`}
                  center={[stay.lat, stay.lng]}
                  radius={14}
                  interactive={false}
                  pathOptions={{
                    color: "#10B981",
                    weight: 1,
                    fillColor: "#34D399",
                    fillOpacity: 0.2,
                    className: "selected-marker-pulse",
                  }}
                />
              )}
              <CircleMarker
                key={stay.homestay_id}
                ref={(instance) => {
                  if (instance) {
                    markerRefs.current[stay.homestay_id] = instance;
                  }
                }}
                center={[stay.lat, stay.lng]}
                radius={selectedHomestayId === stay.homestay_id ? 9 : 7}
                pathOptions={{
                  color: stay.isNearTrail ? "#047857" : "#6B7280",
                  weight: 2,
                  fillColor: stay.isNearTrail ? "#10B981" : "#9CA3AF",
                  fillOpacity: stay.isNearTrail ? 0.9 : 0.55,
                  className: selectedHomestayId === stay.homestay_id ? "selected-marker-core" : "",
                }}
                eventHandlers={{
                  click: () => {
                    if (onHomestaySelect) {
                      onHomestaySelect(stay.homestay_id);
                    }
                  },
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm text-gray-900">{stay.name}</p>
                    <p className="text-xs text-gray-500">{stay.location}</p>
                    <p className="text-xs font-medium text-emerald-700">
                      NPR {Number(stay.price_per_night || 0).toLocaleString()} / person / night
                    </p>
                    {stay.distanceKm !== null && (
                      <p className="text-xs text-gray-500">
                        {stay.distanceKm.toFixed(2)} km from trail route
                      </p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            </Fragment>
          ))}

          {mapBounds && <FitToBounds bounds={mapBounds} shouldFit={!initialLoadComplete} />}
          <FocusSelectedHomestay
            selectedHomestayId={selectedHomestayId}
            homestaysWithDistance={homestaysWithDistance}
            markerRefs={markerRefs}
          />
        </MapContainer>
      </div>

      <div className="px-5 py-3 border-t border-gray-100 bg-white text-xs text-gray-500 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-gold" />
          Trail route
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
          Near trail ({"<="} {distanceThresholdKm} km): {nearTrailCount}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-400" />
          Outside near-trail range: {Math.max(mappedHomestays.length - nearTrailCount, 0)}
        </div>
      </div>
    </div>
  );
};

export default TrailMap;
