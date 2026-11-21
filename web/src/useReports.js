import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "./supabaseClient";

const PHOTO_BUCKET = "rescue-photos";
const REFRESH_MS = 5000;
const SIGNED_URL_SECONDS = 60 * 60;
const RESIGN_AFTER_MS = 50 * 60 * 1000;
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=600";

// Database status value -> label shown in the dashboard
export const STATUS_LABELS = {
  pending: "New",
  reviewed: "Reviewed",
  assigned: "Assigned",
  in_progress: "In Progress",
  rescued: "Rescued",
  closed: "Closed",
  cancelled: "Cancelled",
  duplicate: "Duplicate",
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
);

const capitalize = (text) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : "Unknown";

const shortCode = (uuid) => `PR-${uuid.slice(0, 6).toUpperCase()}`;

const truncate = (text, max) =>
  text && text.length > max ? `${text.slice(0, max - 1)}…` : text || "";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function describeLocation(row, hasGps) {
  if (row.location_text && !row.location_text.startsWith("GPS location")) {
    return row.location_text;
  }
  if (hasGps) {
    return `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}`;
  }
  return "Location not shared";
}

// Turn a rescue_reports row into the shape the dashboard cards use
function toCard(row, photoUrls) {
  const hasGps = row.latitude != null && row.longitude != null;
  const ai =
    row.ai_status === "completed" && row.ai_analysis ? row.ai_analysis : null;

  return {
    id: shortCode(row.id),
    uuid: row.id,
    name: truncate(row.description, 48) || capitalize(row.animal_type),
    type: capitalize(row.animal_type),
    description: row.description,
    location: describeLocation(row, hasGps),
    mapUrl: hasGps
      ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}`
      : null,
    urgency: capitalize(row.urgency),
    severity: capitalize(row.severity),
    status: STATUS_LABELS[row.status] || capitalize(row.status),
    statusValue: row.status,
    date: formatDate(row.created_at),
    image: photoUrls[0] || PLACEHOLDER_IMAGE,
    photos: photoUrls,
    aiStatus: row.ai_status,
    ai: ai && {
      recommendedAction: ai.recommended_action || "",
      visibleConcerns: Array.isArray(ai.visible_concerns)
        ? ai.visible_concerns
        : [],
      uncertainties: Array.isArray(ai.uncertainties) ? ai.uncertainties : [],
      confidence: typeof ai.confidence === "number" ? ai.confidence : null,
    },
    duplicateOf: row.possible_duplicate_of
      ? shortCode(row.possible_duplicate_of)
      : null,
  };
}

// Live rescue reports from Supabase, refreshed every few seconds
export function useReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [error, setError] = useState(null);

  // storage path -> { url, signedAt }, so photos don't reload on every refresh
  const signedUrls = useRef(new Map());

  const refresh = useCallback(async () => {
    if (!supabase) return;

    const { data: rows, error: queryError } = await supabase
      .from("rescue_reports")
      .select("*, report_photos(storage_path, created_at)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const now = Date.now();
    const pathsToSign = rows
      .flatMap((row) => row.report_photos || [])
      .map((photo) => photo.storage_path)
      .filter((path) => {
        const cached = signedUrls.current.get(path);
        return !cached || now - cached.signedAt > RESIGN_AFTER_MS;
      });

    if (pathsToSign.length > 0) {
      const { data: signed, error: signError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(pathsToSign, SIGNED_URL_SECONDS);

      if (signError) {
        console.warn("Could not load report photos:", signError.message);
      } else {
        signed.forEach((item) => {
          if (item.path && item.signedUrl) {
            signedUrls.current.set(item.path, {
              url: item.signedUrl,
              signedAt: now,
            });
          }
        });
      }
    }

    setReports(
      rows.map((row) => {
        const photoUrls = [...(row.report_photos || [])]
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
          .map((photo) => signedUrls.current.get(photo.storage_path)?.url)
          .filter(Boolean);
        return toCard(row, photoUrls);
      })
    );
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const updateStatus = useCallback(
    async (uuid, status) => {
      if (!supabase) return "Supabase is not connected.";

      const { error: updateError } = await supabase
        .from("rescue_reports")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", uuid);

      if (updateError) return updateError.message;

      await refresh();
      return null;
    },
    [refresh]
  );

  return {
    live: supabaseConfigured,
    reports,
    loading,
    error,
    refresh,
    updateStatus,
  };
}
