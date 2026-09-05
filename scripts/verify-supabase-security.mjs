import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceRoleKey, options);
const suffix = randomUUID();
const password = `R!${randomUUID()}a9`;
const emails = [`reparc-security-a-${suffix}@example.invalid`, `reparc-security-b-${suffix}@example.invalid`];
const createdIds = [];

const createTestAccount = async (email) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Security test user creation failed.");
  createdIds.push(data.user.id);
  const client = createClient(url, anonKey, options);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return { client, user: data.user };
};

try {
  const accountA = await createTestAccount(emails[0]);
  const accountB = await createTestAccount(emails[1]);
  const profile = { version: 8, updatedAt: new Date().toISOString(), profile: { displayName: "Security test" }, sessions: [], absences: [], loadProfiles: {} };

  const ownWrite = await accountA.client.from("training_profiles").upsert({
    user_id: accountA.user.id,
    value: profile,
    updated_at: profile.updatedAt,
  });
  assert.equal(ownWrite.error, null, "an account must be able to write its own profile");

  const ownRead = await accountA.client.from("training_profiles").select("user_id").eq("user_id", accountA.user.id);
  assert.equal(ownRead.error, null);
  assert.equal(ownRead.data?.length, 1, "the owner must see its own row");

  const revisionRead = await accountA.client.from("training_profiles").select("revision").eq("user_id", accountA.user.id).single();
  assert.equal(revisionRead.error, null, "the revision migration must be applied");
  const expectedRevision = Number(revisionRead.data?.revision);
  const changedProfile = { ...profile, updatedAt: new Date().toISOString(), sessions: [{ id: "atomic-write" }] };
  const atomicWrite = await accountA.client.rpc("write_training_profile", { expected_revision: expectedRevision, incoming_value: changedProfile });
  assert.equal(atomicWrite.error, null, "the owner must be able to atomically write its profile");
  assert.equal(atomicWrite.data?.[0]?.conflict, false);
  assert.equal(Number(atomicWrite.data?.[0]?.revision), expectedRevision + 1);
  const staleWrite = await accountA.client.rpc("write_training_profile", { expected_revision: expectedRevision, incoming_value: profile });
  assert.equal(staleWrite.error, null);
  assert.equal(staleWrite.data?.[0]?.conflict, true, "a stale device write must be rejected");
  assert.equal(Number(staleWrite.data?.[0]?.revision), expectedRevision + 1);

  const foreignRead = await accountB.client.from("training_profiles").select("user_id").eq("user_id", accountA.user.id);
  assert.equal(foreignRead.error, null);
  assert.equal(foreignRead.data?.length, 0, "another account must not see the row");

  const foreignUpdate = await accountB.client
    .from("training_profiles")
    .update({ updated_at: new Date().toISOString() })
    .eq("user_id", accountA.user.id)
    .select("user_id");
  assert.equal(foreignUpdate.error, null);
  assert.equal(foreignUpdate.data?.length, 0, "another account must not update the row");

  const foreignDelete = await accountB.client
    .from("training_profiles")
    .delete()
    .eq("user_id", accountA.user.id)
    .select("user_id");
  assert.equal(foreignDelete.error, null);
  assert.equal(foreignDelete.data?.length, 0, "another account must not delete the row");

  const privateLimiter = await accountA.client.from("api_rate_limits").select("user_id");
  assert.ok(privateLimiter.error, "rate-limit counters must not be readable through the Data API");

  const ownLimit = await accountA.client.rpc("consume_api_rate_limit", { request_action: "feedback_write" });
  assert.equal(ownLimit.error, null);
  assert.equal(ownLimit.data?.allowed, true, "authenticated requests must use the durable limiter");

  const anonymous = createClient(url, anonKey, options);
  const anonymousLimit = await anonymous.rpc("consume_api_rate_limit", { request_action: "feedback_write" });
  assert.ok(anonymousLimit.error, "anonymous callers must not execute the limiter");

  console.log("Supabase ownership, atomic revisions, grants, and durable rate-limit checks passed.");
} finally {
  await Promise.all(createdIds.map((id) => admin.auth.admin.deleteUser(id)));
}
