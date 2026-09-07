export const MAX_HISTORY_BYTES = 32_000_000;
export type ArchiveManifest = { format: "reparc-chunks-v1"; chunks: string[]; bytes: number };
export function validArchive(value: unknown): value is ArchiveManifest {
  if (!value || typeof value !== "object") return false;
  const v = value as ArchiveManifest;
  return v.format === "reparc-chunks-v1" && Number.isSafeInteger(v.bytes) && v.bytes > 0 && v.bytes <= MAX_HISTORY_BYTES
    && Array.isArray(v.chunks) && v.chunks.length > 0 && v.chunks.length <= 256 && v.chunks.every((id) => typeof id === "string" && /^[a-f0-9]{64}$/.test(id));
}
export async function archiveDigest(text: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function splitArchive(data: unknown) {
  const serialized = JSON.stringify(data);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > MAX_HISTORY_BYTES) throw new Error("This history exceeds the 32 MB account limit. Export a backup and contact support.");
  const chunks: { id: string; text: string }[] = [];
  // Slice by code points so Unicode names cannot create broken surrogate pairs.
  let part = "";
  for (const character of serialized) {
    part += character;
    if (part.length >= 128_000) { chunks.push({ id: await archiveDigest(part), text: part }); part = ""; }
  }
  if (part) chunks.push({ id: await archiveDigest(part), text: part });
  return { chunks, manifest: { format: "reparc-chunks-v1", chunks: chunks.map((item) => item.id), bytes } as ArchiveManifest };
}
export async function joinArchive(manifest: ArchiveManifest, read: (id: string) => Promise<string>) {
  if (!validArchive(manifest)) throw new Error("Invalid archive manifest");
  const parts: string[] = [];
  for (const id of manifest.chunks) {
    const part = await read(id);
    if (await archiveDigest(part) !== id) throw new Error("Archive verification failed");
    parts.push(part);
  }
  const text = parts.join("");
  if (new TextEncoder().encode(text).byteLength !== manifest.bytes) throw new Error("Incomplete archive");
  return JSON.parse(text) as unknown;
}
