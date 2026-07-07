const fs = require('fs');

let content = fs.readFileSync('src/app/(main)/crm/members/page.tsx', 'utf8');
content = content.replace('🔍 ค้นหาด้วยชื่อ หรือ เบอร์โทรศัพท์...', 'ค้นหาด้วยชื่อ หรือ เบอร์โทรศัพท์...');
fs.writeFileSync('src/app/(main)/crm/members/page.tsx', content);

let newPage = fs.readFileSync('src/app/(main)/pos/new/page.tsx', 'utf8');
newPage = newPage.replace('const tabGroups: Record<string, string[]> = Object.fromEntries(', 'const stripEmoji = (s: string) => s.replace(/[\\u{1F300}-\\u{1F64F}\\u{1F680}-\\u{1F6FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}\\u{1F900}-\\u{1F9FF}\\u{1F1E6}-\\u{1F1FF}\\u2728\\u2B50\\uFE0F]/gu, \'\').trim();\n  const tabGroups: Record<string, string[]> = Object.fromEntries(');
newPage = newPage.replace('serviceGroups.map(g => [g.name, g.categories.map(c => c.name)])', 'serviceGroups.map(g => [stripEmoji(g.name), g.categories.map(c => stripEmoji(c.name))])');
newPage = newPage.replace('const tabNames = ["ทั้งหมด", ...serviceGroups.map(g => g.name)];', 'const tabNames = ["ทั้งหมด", ...serviceGroups.map(g => stripEmoji(g.name))];');
newPage = newPage.replace('allowedCategories.includes(svc.category.name)', 'allowedCategories.includes(stripEmoji(svc.category.name))');
newPage = newPage.replace('svc.category.name === selectedTab || svc.category.group?.name === selectedTab', 'stripEmoji(svc.category.name) === selectedTab || stripEmoji(svc.category.group?.name || "") === selectedTab');
newPage = newPage.replace('{svc.name} (฿{svc.price.toLocaleString()})', '{stripEmoji(svc.name)} (฿{svc.price.toLocaleString()})');
fs.writeFileSync('src/app/(main)/pos/new/page.tsx', newPage);

let svcPage = fs.readFileSync('src/app/(main)/settings/services/page.tsx', 'utf8');
svcPage = svcPage.replace('export default function ServicesSettingsPage() {', 'const stripEmoji = (s: string) => s.replace(/[\\u{1F300}-\\u{1F64F}\\u{1F680}-\\u{1F6FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}\\u{1F900}-\\u{1F9FF}\\u{1F1E6}-\\u{1F1FF}\\u2728\\u2B50\\uFE0F]/gu, \'\').trim();\n\nexport default function ServicesSettingsPage() {');
svcPage = svcPage.replace('{group.name} <span', '{stripEmoji(group.name)} <span');
svcPage = svcPage.replace('{cat.name} <span', '{stripEmoji(cat.name)} <span');
svcPage = svcPage.replace('<td>{svc.name}</td>', '<td>{stripEmoji(svc.name)}</td>');
fs.writeFileSync('src/app/(main)/settings/services/page.tsx', svcPage);

console.log('Fixed pos/new and settings/services dynamic emojis');
