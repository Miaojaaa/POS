"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push("/pos/new");
    } else {
      setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--beige)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: 16, padding: "2.5rem 2rem", width: 380, boxShadow: "0 4px 24px rgba(0,0,0,0.10)" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✂️</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>ร้านเสริมสวย</h1>
          <p style={{ color: "#888", fontSize: "0.9rem", marginTop: 4 }}>ระบบบริหารจัดการร้าน</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "1rem" }}>
            <label className="label">อีเมล</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@salon.com"
              required
            />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label className="label">รหัสผ่าน</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="รหัสผ่าน"
              required
            />
          </div>
          {error && (
            <div style={{ background: "#FFF0F0", color: "var(--alert-red)", padding: "0.625rem", borderRadius: 8, marginBottom: "1rem", fontSize: "0.875rem" }}>
              {error}
            </div>
          )}
          <button className="btn-primary" type="submit" style={{ width: "100%" }} disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "var(--beige)", borderRadius: 8, fontSize: "0.8rem", color: "#666" }}>
          <strong>ทดสอบ:</strong><br />
          owner@salon.com / owner123<br />
          manager@salon.com / manager123<br />
          cashier@salon.com / cashier123<br />
          tech1@salon.com / tech123
        </div>
      </div>
    </div>
  );
}
