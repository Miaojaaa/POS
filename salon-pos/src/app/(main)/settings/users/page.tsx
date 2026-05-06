import Link from "next/link";

export default function SettingsUsersPage() {
  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>⚙️ สิทธิ์ผู้ใช้</h1>
      <div className="card">
        <p>จัดการพนักงานและสิทธิ์การเข้าถึง</p>
        <Link href="/hr/staff" className="btn-primary" style={{ textDecoration: "none", display: "inline-block", marginTop: "1rem" }}>
          → ไปที่หน้าจัดการพนักงาน
        </Link>
      </div>
    </div>
  );
}
