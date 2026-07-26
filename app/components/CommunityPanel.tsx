"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createCloudClient,
  type CloudCommunityEntry,
  type CloudDailyLeaderboard,
  type CloudItemLeaderboard,
  type CloudProfile,
  type CloudPublicProfile,
  type CloudSession,
} from "../lib/cloud.mjs";
import { itemDisplayId, type PracticeItem } from "../lib/items";
import { type AppState } from "../lib/product";

type CloudStatus = "checking" | "local" | "signed-out" | "connected" | "syncing" | "error";
type CommunityTab = "recent" | "daily" | "records" | "profile";

const communityClient = createCloudClient();
const CLOUD_EDITION_URL = "https://swift-ghost-kevin.kevinchen435.chatgpt.site";

function durationLabel(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function relativeTime(value: string) {
  const delta = Date.now() - Date.parse(value);
  if (!Number.isFinite(delta)) return "recently";
  const minutes = Math.max(0, Math.round(delta / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function CommunityPanel({
  state,
  items,
  status,
  session,
  onToggleUploads,
  onRefresh,
}: {
  state: AppState;
  items: PracticeItem[];
  status: CloudStatus;
  session: CloudSession | null;
  onToggleUploads: (enabled: boolean) => void;
  onRefresh: () => void;
}) {
  const builtins = useMemo(() => items.filter((item) => item.source === "builtin"), [items]);
  const requestedHandle = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("profile")?.trim() ?? "";
  const [tab, setTab] = useState<CommunityTab>(requestedHandle ? "profile" : "recent");
  const [recent, setRecent] = useState<CloudCommunityEntry[]>([]);
  const [daily, setDaily] = useState<CloudDailyLeaderboard | null>(null);
  const [board, setBoard] = useState<CloudItemLeaderboard | null>(null);
  const [boardItemId, setBoardItemId] = useState<string>(builtins[0]?.itemId ?? "builtin:1");
  const [loading, setLoading] = useState(!requestedHandle);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<CloudProfile | null>(session?.profile ?? null);
  const [handleLookup, setHandleLookup] = useState(requestedHandle);
  const [publicProfile, setPublicProfile] = useState<CloudPublicProfile | null>(null);

  useEffect(() => {
    if (status !== "connected" && status !== "syncing") return;
    const controller = new AbortController();
    const request = tab === "recent"
      ? communityClient.communityRecent({ limit: 20, signal: controller.signal })
      : tab === "daily"
        ? communityClient.dailyLeaderboard(new Date().toISOString().slice(0, 10), { limit: 25, signal: controller.signal })
        : tab === "records"
          ? communityClient.itemLeaderboard(boardItemId, { limit: 25, signal: controller.signal })
          : null;
    if (!request) return () => controller.abort();
    void request.then((result) => {
      if (!result.available) { if (result.reason !== "aborted") setMessage("Community data is temporarily unavailable."); return; }
      setMessage("");
      if (tab === "recent") setRecent((result.data as { entries: CloudCommunityEntry[] }).entries);
      if (tab === "daily") setDaily(result.data as CloudDailyLeaderboard);
      if (tab === "records") setBoard(result.data as CloudItemLeaderboard);
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [status, tab, boardItemId]);

  useEffect(() => {
    if (status !== "connected") return;
    if (!requestedHandle) return;
    void communityClient.publicProfile(requestedHandle).then((result) => {
      if (result.available) setPublicProfile(result.data);
      else setMessage("That profile is private or unavailable.");
    });
  }, [requestedHandle, status]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setLoading(true); setMessage("");
    const result = await communityClient.patchProfile({ handle: profile.handle, displayName: profile.displayName ?? undefined, bio: profile.bio ?? undefined, timezone: profile.timezone, isPublic: profile.isPublic, shareActivity: profile.shareActivity, showOnLeaderboards: profile.showOnLeaderboards });
    setLoading(false);
    if (!result.available) { setMessage(result.status === 409 ? "That handle is already in use." : "Profile changes could not be saved."); return; }
    setProfile(result.data); setMessage("Profile saved."); onRefresh();
  }

  async function findProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requested = handleLookup.trim().toLowerCase();
    if (!requested) return;
    setLoading(true); setMessage("");
    const result = await communityClient.publicProfile(requested);
    setLoading(false);
    if (!result.available) { setPublicProfile(null); setMessage("That profile is private or unavailable."); return; }
    setPublicProfile(result.data);
    const url = new URL(window.location.href); url.searchParams.set("profile", requested); window.history.replaceState({}, "", url);
  }

  if (status === "checking") return <section className="community-gate"><span className="eyebrow">Community records</span><h2>Checking the cloud edition…</h2><p>Your local practice remains available while this connects.</p></section>;
  if (status === "local") return <section className="community-gate"><span className="eyebrow">Local edition</span><h2>Private by default. Community when you want it.</h2><p>GitHub Pages keeps every attempt on this device. The hosted edition adds opt-in profiles, recent activity, and ranked records without weakening local practice.</p><a className="primary-button" href={CLOUD_EDITION_URL}>Open the cloud beta →</a></section>;
  if (status === "signed-out") return <section className="community-gate"><span className="eyebrow">Community beta</span><h2>Sign in before sharing a record.</h2><p>Browsing stays local until you explicitly enable uploads. Profiles and rankings are opt-in and custom snippets are never published.</p><a className="primary-button" href="/signin-with-chatgpt?return_to=%2F">Sign in with ChatGPT →</a></section>;
  if (status === "error" && !session?.authenticated) return <section className="community-gate"><span className="eyebrow">Community offline</span><h2>Your local practice is safe.</h2><p>The hosted service could not connect. Nothing was uploaded, and you can retry without leaving this page.</p><button className="outline-button" onClick={onRefresh}>Try again</button></section>;

  const selectedBoardItem = builtins.find((item) => item.itemId === boardItemId);
  return <section className="community-shell">
    <header className="community-header"><div><span className="eyebrow">Community beta</span><h2>Profiles and comparable records.</h2><p>Only built-in, completed runs can upload. Public activity and leaderboards stay off until enabled in your profile.</p></div><div className={`cloud-status ${status}`}><i />{status === "syncing" ? "Uploading" : status === "error" ? "Offline · saved locally" : "Cloud connected"}</div></header>
    <div className="community-tabs" role="tablist" aria-label="Community sections">{(["recent", "daily", "records", "profile"] as CommunityTab[]).map((value) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => { setLoading(value !== "profile"); setTab(value); }}>{value === "records" ? "Leaderboards" : value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    {message && <div className="community-message" role="status">{message}</div>}

    {tab === "recent" && <div className="community-feed"><div className="community-section-title"><span><small>Opt-in activity</small><strong>Recent clean passes</strong></span><b>{recent.length}</b></div>{loading && !recent.length ? <div className="community-empty">Loading recent runs…</div> : recent.length ? recent.map((entry, index) => <article key={`${entry.itemId}-${entry.completedAt}-${index}`}><div className="community-avatar">{entry.user.displayName.slice(0, 1).toUpperCase()}</div><span><strong>{entry.user.displayName}</strong><small>{entry.itemTitle ?? entry.itemId} · stage {entry.stage} · {relativeTime(entry.completedAt)}</small></span><b>{entry.wpm}<small> WPM</small></b><em>{entry.accuracy}%</em></article>) : <div className="community-empty">No shared runs yet. Private practice never appears here.</div>}</div>}

    {tab === "daily" && <div className="community-board"><div className="community-section-title"><span><small>UTC benchmark · stage 1 · strict-mode ranks</small><strong>{daily?.challenge?.itemTitle ?? "Today's Daily Type"}</strong></span><b>{daily?.entries.length ?? 0} ranked</b></div>{daily?.entries.length ? daily.entries.map((entry) => <article key={`${entry.rank}-${entry.user.displayName}`}><strong>#{entry.rank}</strong><span>{entry.user.displayName}</span><b>{entry.wpm}<small> WPM</small></b><em>{entry.averageAccuracy}% · {entry.completions} run{entry.completions === 1 ? "" : "s"}</em></article>) : <div className="community-empty">No qualifying Daily Type runs have been shared yet.</div>}</div>}

    {tab === "records" && <div className="community-board"><div className="community-board-filter"><label><span>Built-in exercise</span><select value={boardItemId} onChange={(event) => setBoardItemId(event.target.value)}>{builtins.map((item) => <option value={item.itemId} key={item.itemId}>{itemDisplayId(item)} {item.title}</option>)}</select></label><span><small>Exact item records</small><strong>{selectedBoardItem?.title ?? boardItemId}</strong></span></div>{board?.entries.length ? board.entries.map((entry) => <article key={`${entry.rank}-${entry.user.displayName}-${entry.completedAt}`}><strong>#{entry.rank}</strong><span>{entry.user.displayName}<small>Stage {entry.stage}</small></span><b>{entry.wpm}<small> WPM</small></b><em>{entry.accuracy}% · {durationLabel(entry.durationMs)}</em></article>) : <div className="community-empty">No qualifying strict-mode records for this exercise yet.</div>}</div>}

    {tab === "profile" && <div className="community-profile-grid"><form className="community-profile-form" onSubmit={saveProfile}><div className="community-section-title"><span><small>Your hosted identity</small><strong>{session?.user?.displayName ?? "Swift learner"}</strong></span></div><label><span>Public handle</span><input value={profile?.handle ?? ""} onChange={(event) => setProfile((current) => current ? { ...current, handle: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24) } : current)} placeholder="swift-learner" /></label><label><span>Display name</span><input value={profile?.displayName ?? ""} maxLength={48} onChange={(event) => setProfile((current) => current ? { ...current, displayName: event.target.value } : current)} /></label><label><span>Short bio</span><textarea value={profile?.bio ?? ""} maxLength={160} onChange={(event) => setProfile((current) => current ? { ...current, bio: event.target.value } : current)} placeholder="iOS engineer rebuilding interview fluency" /></label><label className="check-row"><input type="checkbox" checked={state.cloud.communityEnabled} onChange={(event) => onToggleUploads(event.target.checked)} /><span><strong>Upload built-in attempts from this device</strong><small>Custom code, drafts, and key-level telemetry never upload.</small></span></label><label className="check-row"><input type="checkbox" checked={profile?.isPublic ?? false} onChange={(event) => setProfile((current) => current ? { ...current, isPublic: event.target.checked, shareActivity: event.target.checked ? current.shareActivity : false, showOnLeaderboards: event.target.checked ? current.showOnLeaderboards : false } : current)} /><span><strong>Public profile</strong><small>Required before any activity can be shared.</small></span></label><label className="check-row"><input type="checkbox" disabled={!profile?.isPublic} checked={profile?.shareActivity ?? false} onChange={(event) => setProfile((current) => current ? { ...current, shareActivity: event.target.checked } : current)} /><span><strong>Share recent qualifying runs</strong><small>Shows display name, item, stage, WPM, accuracy, and time.</small></span></label><label className="check-row"><input type="checkbox" disabled={!profile?.isPublic} checked={profile?.showOnLeaderboards ?? false} onChange={(event) => setProfile((current) => current ? { ...current, showOnLeaderboards: event.target.checked } : current)} /><span><strong>Join community leaderboards</strong><small>One server-ranked best per comparable exercise configuration.</small></span></label><button className="primary-button" disabled={!profile || loading} type="submit">Save profile</button></form><div className="community-profile-search"><div className="community-section-title"><span><small>Public profiles</small><strong>Find a learner</strong></span></div><form onSubmit={findProfile}><input value={handleLookup} onChange={(event) => setHandleLookup(event.target.value)} placeholder="profile handle" /><button className="outline-button" type="submit">Open profile</button></form>{publicProfile && <article><div className="community-avatar large">{(publicProfile.displayName ?? publicProfile.handle).slice(0, 1).toUpperCase()}</div><span><strong>{publicProfile.displayName ?? publicProfile.handle}</strong><small>@{publicProfile.handle}</small></span><p>{publicProfile.bio || "No public bio yet."}</p></article>}</div></div>}
  </section>;
}
