// Member 4 (Rhythm): vet desk, adoption desk and adoption portal
import { supabase } from "../supabaseClient";

export const RESCUE_BUCKET = "rescue-photos";
export const ADOPTION_BUCKET = "adoption-photos";

export const MEDICAL_STATUSES = [
  { value: "under_observation", label: "Under observation" },
  { value: "under_treatment", label: "Under treatment" },
  { value: "recovering", label: "Recovering" },
  { value: "recovered", label: "Recovered" },
  { value: "cleared_for_adoption", label: "Cleared for adoption" },
];

export const ADOPTION_STATUSES = [
  { value: "available", label: "Available" },
  { value: "application_pending", label: "Application pending" },
  { value: "adopted", label: "Adopted" },
  { value: "withdrawn", label: "Withdrawn" },
];

export const medicalLabel = (value) =>
  MEDICAL_STATUSES.find((status) => status.value === value)?.label ||
  "Awaiting exam";

export const adoptionLabel = (value) =>
  ADOPTION_STATUSES.find((status) => status.value === value)?.label || value;

export const capitalize = (text) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : "Unknown";

export const shortCode = (uuid) => `PR-${uuid.slice(0, 6).toUpperCase()}`;

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Newest item first, by created_at
export const newestFirst = (items) =>
  [...(items || [])].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );

// Report photo paths, oldest first
export const photoPaths = (report) =>
  [...(report.report_photos || [])]
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((photo) => photo.storage_path);

// Private rescue photos need short-lived signed links; cache them for 4 minutes
const signedCache = new Map();

export async function signRescuePhotos(paths) {
  const now = Date.now();
  const missing = paths.filter((path) => {
    const cached = signedCache.get(path);
    return !cached || now - cached.at > 4 * 60 * 1000;
  });

  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(RESCUE_BUCKET)
      .createSignedUrls(missing, 300);

    if (error) {
      console.warn("Could not load rescue photos:", error.message);
    } else {
      data.forEach((item) => {
        if (item.path && item.signedUrl) {
          signedCache.set(item.path, { url: item.signedUrl, at: now });
        }
      });
    }
  }

  // Same order as paths; null where a photo couldn't be signed
  return paths.map((path) => signedCache.get(path)?.url || null);
}

async function uploadToAdoptionBucket(blob, extension) {
  const path = `${crypto.randomUUID()}.${extension || "jpg"}`;

  const { error } = await supabase.storage
    .from(ADOPTION_BUCKET)
    .upload(path, blob, { contentType: blob.type || "image/jpeg" });

  if (error) throw error;

  return supabase.storage.from(ADOPTION_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

// Copy a private rescue photo into the public adoption bucket
export async function copyRescuePhoto(path) {
  const { data: blob, error } = await supabase.storage
    .from(RESCUE_BUCKET)
    .download(path);

  if (error) throw error;

  return uploadToAdoptionBucket(blob, path.split(".").pop());
}

export function uploadAdoptionPhoto(file) {
  return uploadToAdoptionBucket(file, file.name.split(".").pop());
}
