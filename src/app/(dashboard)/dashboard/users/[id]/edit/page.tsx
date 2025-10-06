// src/app/(dashboard)/dashboard/users/[id]/edit/page.tsx
// ------------------------------------------------------------------
// Edit user profile (email/website/names/bio/socials/avatar/password/role)
// API: GET /api/r2/users/:id
//      PATCH /api/r2/users/:id { ..., role?, avatarUrl: "", socials, newPassword? }
// ------------------------------------------------------------------

"use client";

import { Suspense, useMemo, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import MediaPicker from "@/components/media/MediaPicker";
import { SOCIAL_FIELDS } from "@/lib/users/social";

type Role = "administrator" | "editor" | "author" | "contributor" | "subscriber";

// matches API profile shape
type Profile = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  nickname: string;
  display_name: string;
  website: string;
  bio: string;
  role: Role;
  avatar_url?: string;
  socials: Record<string, string>;
};

const fetcher = async (key: string) => {
  const r = await fetch(key, { cache: "no-store" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Failed to load");
  return (await r.json()) as Profile;
};

export default function EditUserPage() {
  return (
    <Suspense fallback={<div className="container dim">Loading profile…</div>}>
      <EditUserInner />
    </Suspense>
  );
}

function EditUserInner() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || "");
  const key = `/api/r2/users/${id}`;

  const fallback: Profile = useMemo(
    () => ({
      id: Number(id) || 0,
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      nickname: "",
      display_name: "",
      website: "",
      bio: "",
      role: "subscriber",
      avatar_url: undefined,
      socials: {},
    }),
    [id]
  );

  const { data = fallback, mutate } = useSWR<Profile>(key, fetcher, { suspense: true });

  // local form state from data
  const [email, setEmail] = useState(data.email);
  const [website, setWebsite] = useState(data.website);
  const [firstName, setFirstName] = useState(data.first_name);
  const [lastName, setLastName] = useState(data.last_name);
  const [nickname, setNickname] = useState(data.nickname);
  const [displayName, setDisplayName] = useState(data.display_name);
  const [bio, setBio] = useState(data.bio);
  const [avatarUrl, setAvatarUrl] = useState<string>(data.avatar_url || "");
  const [role, setRole] = useState<Role>(data.role); // ✅ Role state
  const [socials, setSocials] = useState<Record<string, string>>({
    ...Object.fromEntries(SOCIAL_FIELDS.map((f) => [f.key, ""])),
    ...(data.socials || {}),
  });
  const [newPassword, setNewPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const payload: any = {
        email,
        website,
        first_name: firstName,
        last_name: lastName,
        nickname,
        display_name: displayName,
        bio,
        avatarUrl: avatarUrl || "", // "" => clear on server
        socials,
        role, // ✅ Try to update role (server will 403 if not admin)
      };
      if (newPassword.trim()) payload.newPassword = newPassword;

      const r = await fetch(key, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        // Friendly message when non-admin tries to change role
        if (r.status === 403 && j?.error?.toString()?.toLowerCase()?.includes("role")) {
          toast.error("Only admin can change role.");
        } else {
          toast.error(j?.error || "Update failed");
        }
        setSending(false);
        return;
      }

      toast.success("Profile updated");
      setNewPassword("");
      await mutate();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    } finally {
      setSending(false);
    }
  }

  const roleOptions: { value: Role; label: string }[] = [
    { value: "administrator", label: "Administrator" },
    { value: "editor",        label: "Editor" },
    { value: "author",        label: "Author" },
    { value: "contributor",   label: "Contributor" },
    { value: "subscriber",    label: "Subscriber" },
  ];

  return (
    <div className="container">
      <h2 className="mb-12">Edit User — {data.username}</h2>

      <form onSubmit={onSave} style={{ display: "grid", gap: 14 }}>
        {/* basics */}
        <div className="grid-2">
          <label>
            <span className="label">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            <span className="label">Website</span>
            <input className="input" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <div className="grid-2">
          <label>
            <span className="label">First Name</span>
            <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label>
            <span className="label">Last Name</span>
            <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
        </div>

        <div className="grid-2">
          <label>
            <span className="label">Nickname</span>
            <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </label>
          <label>
            <span className="label">Display Name</span>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
        </div>

        {/* ✅ Role selector */}
        <div className="grid-2">
          <label>
            <span className="label">Role</span>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <small className="dim">Only admins can change roles. Others will see an error if they try.</small>
          </label>
        </div>

        <label>
          <span className="label">Biographical Info</span>
          <textarea className="textarea" rows={5} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>

        {/* Avatar */}
        <div>
          <div className="mb-8">Profile Picture</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <button type="button" className="btn-ghost" onClick={() => setPickerOpen(true)} disabled={sending}>
                Choose Image
              </button>
              {avatarUrl && (
                <button type="button" className="btn-ghost" onClick={() => setAvatarUrl("")} disabled={sending}>
                  Clear
                </button>
              )}
            </div>
            <div className="card" style={{ width: 96, height: 96, overflow: "hidden", display: "grid", placeItems: "center" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span className="dim">—</span>
              )}
            </div>
          </div>
          <small className="dim">Pick from library or clear to remove.</small>
        </div>

        {/* Socials */}
        <div>
          <div className="mb-8">Social Profiles</div>
          <div className="grid-5" style={{ gap: 10 }}>
            {SOCIAL_FIELDS.map((f) => (
              <label key={f.key}>
                <span className="label">{f.label}</span>
                <input
                  className="input"
                  placeholder={f.placeholder || "https://… (leave blank to clear)"}
                  value={socials[f.key] || ""}
                  onChange={(e) => setSocials((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Password */}
        <label>
          <span className="label">New Password (leave empty to keep)</span>
          <input
            className="input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        {/* Media picker modal */}
        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(item) => {
            setAvatarUrl(item.guid);
            setPickerOpen(false);
          }}
          imagesOnly
        />

        <div>
          <button className="btn" type="submit" disabled={sending}>
            {sending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
