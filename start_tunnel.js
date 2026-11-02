const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function connectTunnel() {
  console.log('🌐 جاري الاتصال بالرابط العالمي المباشر (Auto-Reconnect)...');

  const sshArgs = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'ServerAliveInterval=20',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    '-R', '80:localhost:3000',
    'nokey@localhost.run'
  ];

  const proc = spawn('ssh', sshArgs, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let lastUrl = '';

  const handleOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
    if (match && match[0] !== lastUrl) {
      lastUrl = match[0];
      fs.writeFileSync(path.join(__dirname, 'public_url.txt'), lastUrl, 'utf8');
      console.log('\n=======================================================');
      console.log('🌍 الرابط العالمي المباشر فعال الآن:');
      console.log(`🔗 رابط المستخرج (للزوار): ${lastUrl}/`);
      console.log(`🛡️ رابط لوحة المشرف (لك): ${lastUrl}/admin.html`);
      console.log('=======================================================\n');
    }
  };

  proc.stdout.on('data', handleOutput);
  proc.stderr.on('data', handleOutput);

  proc.on('close', (code) => {
    console.log(`🔄 انتهت الجلسة المؤقتة (كود ${code})، جاري إعادة الاتصال تلقائياً خلال ثانيتين...`);
    setTimeout(connectTunnel, 2000);
  });
}

connectTunnel();
