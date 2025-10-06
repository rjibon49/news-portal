// src/app/(dashboard)/dashboard/users/new/page.tsx
// ------------------------------------------------------------------
// Create user form (+ MediaPicker for avatar).
// - type="button" on picker buttons => no accidental form submit.
// - Sends avatarUrl in POST (repo supports writing profile_picture/wp_user_avatar).
// ------------------------------------------------------------------

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import MediaPicker from "@/components/media/MediaPicker";

type Role = "subscriber" | "contributor" | "author" | "editor" | "administrator";

// simple client password generator
function genPassword(len = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  let out = "";
  crypto.getRandomValues(new Uint32Array(len)).forEach((n) => (out += chars[n % chars.length]));
  return out;
}

export default function AddUserPage() {
  const router = useRouter();

  // form state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [website, setWebsite] = useState("");
  const [password, setPassword] = useState(genPassword());
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<Role>("subscriber");
  const [bio, setBio] = useState("");

  // avatar via media picker (URL only)
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); // prevent accidental submit
    if (!username.trim() || !email.trim() || !password) {
      toast.error("Username, Email & Password are required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/r2/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          website: website.trim(),
          bio: bio.trim(),
          role,
          avatarUrl: avatarUrl || undefined, // send only if set
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to create user");
      }
      toast.success("User created");
      router.push("/dashboard/users");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create user");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container">
      <h2 className="mb-12">Add User</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <div className="grid-2">
          <label>
            <span className="label">Username <span style={{ color: "crimson" }}>*</span></span>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            <span className="label">Email <span style={{ color: "crimson" }}>*</span></span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            <span className="label">First Name</span>
            <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </label>
          <label>
            <span className="label">Last Name</span>
            <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </label>
        </div>

        <label>
          <span className="label">Website</span>
          <input className="input" type="url" placeholder="https://…" value={website} onChange={(e) => setWebsite(e.target.value)} inputMode="url" />
        </label>

        <div>
          <div className="grid-2" style={{ alignItems: "center" }}>
            <label>
              <span className="label">Password <span style={{ color: "crimson" }}>*</span></span>
              <input
                className="input"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <small className="dim">Between 6 and 150 characters</small>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-ghost" onClick={() => setPassword(genPassword())} disabled={sending}>
                Generate password
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowPass((s) => !s)} disabled={sending}>
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        <label>
          <span className="label">Role</span>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={sending}>
            <option value="subscriber">Subscriber</option>
            <option value="contributor">Contributor</option>
            <option value="author">Author</option>
            <option value="editor">Editor</option>
            <option value="administrator">Administrator</option>
          </select>
        </label>

        <label>
          <span className="label">Biographical Info</span>
          <textarea className="textarea" value={bio} onChange={(e) => setBio(e.target.value)} rows={5} />
        </label>

        {/* Profile Picture (MediaPicker modal) */}
        <div>
          <div className="mb-12">Profile Picture</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "grid", gap: 8 }}>
              {/* IMPORTANT: type="button" */}
              <button type="button" className="btn-ghost" onClick={() => setPickerOpen(true)} disabled={sending}>
                Choose Image
              </button>
              {avatarUrl && (
                <button type="button" className="btn-ghost" onClick={() => setAvatarUrl("")} disabled={sending}>
                  Clear
                </button>
              )}
            </div>

            {/* previews */}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div className="card" style={{ width: 80, height: 80, display: "grid", placeItems: "center", overflow: "hidden" }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Original" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span className="dim">—</span>
                  )}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Original Size</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="card" style={{ width: 80, height: 80, display: "grid", placeItems: "center", overflow: "hidden" }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Thumb" style={{ width: 80, height: 80, objectFit: "cover" }} />
                  ) : (
                    <span className="dim">—</span>
                  )}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Thumbnail</div>
              </div>
            </div>
          </div>
          <small className="dim">Pick from library or upload a new image.</small>
        </div>

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
          <button type="submit" disabled={sending} className="btn">
            {sending ? "Creating…" : "Add User"}
          </button>
        </div>
      </form>
    </div>
  );
}
