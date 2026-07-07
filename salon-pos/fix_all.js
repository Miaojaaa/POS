const fs = require('fs');
const path = require('path');

const replacements = [
  // pos/new/page.tsx
  { from: '🔍 ค้นหาชื่อเคมี...', to: 'ค้นหาชื่อเคมี...' },
  { from: '🔍 ค้นหาสินค้า retail...', to: 'ค้นหาสินค้า retail...' },
  { from: '🔓 แก้ราคาได้', to: 'แก้ราคาได้' },
  { from: '🔐 ปลดล็อกแก้ราคา', to: 'ปลดล็อกแก้ราคา' },
  { from: '"💇 ผม"', to: '"ผม"' },

  // pos/queue/page.tsx
  { from: '✂ กำลังทำ', to: 'กำลังทำ' },
  { from: '💳 รอชำระเงิน', to: 'รอชำระเงิน' },
  { from: '📜 ประวัติ Transaction', to: 'ประวัติ Transaction' },
  { from: '🖥️ เปิดจอลูกค้า', to: 'เปิดจอลูกค้า' },
  { from: '🔄 รีเฟรช', to: 'รีเฟรช' },
  { from: '🔍 ค้นหาชื่อ/เบอร์...', to: 'ค้นหาชื่อ/เบอร์...' },

  // pos/history/page.tsx
  { from: 'emoji: "💇"', to: 'emoji: ""' },
  { from: 'emoji: "💅"', to: 'emoji: ""' },
  { from: 'emoji: "🧖"', to: 'emoji: ""' },
  { from: 'emoji: "✨"', to: 'emoji: ""' },
  { from: 'emoji: "📋"', to: 'emoji: ""' },

  // dashboard/page.tsx
  { from: '📥 Export รายวัน', to: 'Export รายวัน' },
  { from: '⚡ เมนูด่วน', to: 'เมนูด่วน' },
  { from: '📋 ดูคิวลูกค้า', to: 'ดูคิวลูกค้า' },
  { from: '👥 จัดการสมาชิก', to: 'จัดการสมาชิก' },
  { from: '📦 ดูสต็อก', to: 'ดูสต็อก' },
  { from: '🚀 ภาพรวมรายวัน', to: 'ภาพรวมรายวัน' },

  // crm/members/page.tsx
  { from: '🔍 ค้นหาเบอร์โทร หรือ ชื่อลูกค้า...', to: 'ค้นหาเบอร์โทร หรือ ชื่อลูกค้า...' },

  // erp/main/page.tsx
  { from: '🔍 ค้นหาสินค้า...', to: 'ค้นหาสินค้า...' },

  // erp/sub/page.tsx
  { from: '🔍 ค้นหาสินค้า...', to: 'ค้นหาสินค้า...' },

  // erp/retail/page.tsx
  { from: '🔍 ค้นหาสินค้า...', to: 'ค้นหาสินค้า...' },

  // reports/revenue/page.tsx
  { from: '📥 Export Excel', to: 'Export Excel' },

  // hr/kpi/page.tsx
  { from: '📊 KPI ทีม', to: 'KPI ทีม' },
  { from: '🏢 ทุกสาขา', to: 'ทุกสาขา' },
  { from: '🔄 รีเฟรช', to: 'รีเฟรช' },
  { from: '📥 Export', to: 'Export' },

  // hr/payroll/page.tsx
  { from: '🏢 ทุกสาขา', to: 'ทุกสาขา' },
  { from: '🔄 รีเฟรช', to: 'รีเฟรช' },
  { from: '📥 Export', to: 'Export' },
  { from: '✅ อนุมัติแล้ว', to: 'อนุมัติแล้ว' },

  // settings/branding/page.tsx
  { from: '💬 ข้อความ', to: 'ข้อความ' },

  // settings/services/page.tsx
  { from: '✏️ แก้ไขบริการ', to: 'แก้ไขบริการ' },
  { from: '💇 ผม', to: 'ผม' },
  { from: '💅 เล็บ', to: 'เล็บ' },
  { from: '💆 สปา', to: 'สปา' },
  { from: '➕ เพิ่มหมวดหมู่ใหญ่', to: 'เพิ่มหมวดหมู่ใหญ่' },
  { from: '💾 บันทึก', to: 'บันทึก' },
  { from: '✕ ยกเลิก', to: 'ยกเลิก' },
];

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8');
      let newContent = content;
      replacements.forEach(r => {
        newContent = newContent.split(r.from).join(r.to);
      });
      if (content !== newContent) {
        fs.writeFileSync(p, newContent, 'utf8');
        console.log('Fixed:', p);
      }
    }
  });
}
walk('src/app');
walk('src/components');
walk('src/lib');
