// src/app/(dashboard)/dashboard/users/new/page.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import MediaPicker from "@/components/media/MediaPicker";

type Role = "subscriber" | "contributor" | "author" | "editor" | "administrator";

function genPassword(len = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  let out = "";
  crypto.getRandomValues(new Uint32Array(len)).forEach((n) => {
    out += chars[n % chars.length];
  });
  return out;
}

export default function AddUserPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [website, setWebsite] = useState("");
  const [password, setPassword] = useState(genPassword());
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<Role>("subscriber");
  const [bio, setBio] = useState("");

  // NEW: avatar
  const [avatarUrl, setAvatarUrl] = useState<string>(""); // stored URL after upload
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [sending, setSending] = useState(false);

  async function onChooseAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/local", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Upload failed");
      }
      const { url } = await res.json();
      setAvatarUrl(url);
      toast.success("Profile image uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearAvatar() {
    setAvatarUrl("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          avatarUrl: avatarUrl || undefined, // <-- NEW
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to create user");
      }
      toast.success("User created");
      router.push("/dashboard/users");
    } catch (e: any) {
      toast.error(e.message || "Failed to create user");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 880 }}>
      <h2 style={{ margin: "8px 0 16px" }}>Add User</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div>Username <span style={{ color: "crimson" }}>*</span></div>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            <div>Email <span style={{ color: "crimson" }}>*</span></div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div>First Name</div>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label>
            <div>Last Name</div>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
        </div>

        <label>
          <div>Website</div>
          <input type="url" placeholder="https://…" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ flex: 1 }}>
              <div>Password <span style={{ color: "crimson" }}>*</span></div>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="button" onClick={() => setPassword(genPassword())} style={{ height: 36 }}>
              Generate password
            </button>
            <button type="button" onClick={() => setShowPass((s) => !s)} style={{ height: 36 }}>
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
          <small style={{ opacity: 0.7 }}>Between 6 and 150 characters</small>
        </div>

        <label>
          <div>Role</div>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="subscriber">Subscriber</option>
            <option value="contributor">Contributor</option>
            <option value="author">Author</option>
            <option value="editor">Editor</option>
            <option value="administrator">Administrator</option>
          </select>
        </label>

        <label>
          <div>Biographical Info</div>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} />
        </label>

        {/* NEW: Profile Picture */}
        <div>
        <div style={{ marginBottom: 6 }}>Profile Picture</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <button type="button" onClick={() => setPickerOpen(true)} style={{ padding: "8px 12px" }}>
              Choose Image
            </button>
            {avatarUrl && (
              <button type="button" onClick={() => setAvatarUrl("")} style={{ padding: "6px 10px" }}>
                Clear
              </button>
            )}
          </div>

            {/* Previews like WP: Original + Thumbnail */}
            <div style={{ display: "flex", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  border: "1px solid #444",
                  borderRadius: 6,
                  background: "#222",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Original" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ opacity: 0.6 }}>—</span>
                )}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Original Size</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  border: "1px solid #444",
                  borderRadius: 6,
                  background: "#222",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Thumb" style={{ width: 80, height: 80, objectFit: "cover" }} />
                ) : (
                  <span style={{ opacity: 0.6 }}>—</span>
                )}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Thumbnail</div>
            </div>
          </div>
        </div>
        <small style={{ opacity: 0.7 }}>Pick from library or upload a new image.</small>
      </div>

      {/* ✅ Media Picker modal */}
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